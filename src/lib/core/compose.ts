// The composer: runs the transform passes, measures the canvas, and layers
// areas, elbows, arcs, rows, fallback cards, and hook overlays into one SVG
// string. SVG stacking is DOM order: areas behind, then elbows, then owner
// arcs, rows on top, expanded hook overlays last. Pure given RenderState —
// the one stateful collaborator it touches is the color registry's assign
// pre-pass, run at a fixed point (right after flatten) so slot choice is
// row order, never paint order.
import { boundaryColor, boundaryKind } from "./colors";
import { elbow, ownerArc, ownerArcPath } from "./edges";
import { nodeMarkup, rowTextExtent } from "./rows";
import { boundaryAreaMarkup, contextAreaMarkup, serverRegionMarkup } from "./areas";
import {
  applyView,
  computeFocus,
  flatten,
  foldRepeats,
  hideDom,
  hideStructural,
  pruneCollapsed,
  stripPotential,
} from "./transform";
import { FADE, GRID } from "./types";
import type {
  ComposeCtx,
  InputNode,
  RenderState,
  Row,
  ViewFlags,
} from "./types";

// The default view skips the splice entirely: nothing hidden means the
// roots pass through by reference — byte-identical output guaranteed
// structurally rather than trusted to a no-op rebuild.
function viewFiltered(roots: InputNode[], view: ViewFlags): InputNode[] {
  return view.hideDom || view.hideStructural
    ? applyView(
        roots,
        (n) =>
          (view.hideDom && hideDom(n)) ||
          (view.hideStructural && hideStructural(n)),
      )
    : roots;
}

function svgWidth(
  rows: Row[],
  withArcs: boolean,
  maxDepth: number,
  state: RenderState,
  fallbackBadges?: Map<string, string>,
): number {
  if (state.opt.sizing === "fixed") return maxDepth * GRID + 260;
  const text = Math.max(
    ...rows.map((r) =>
      rowTextExtent(
        r,
        state,
        state.marks.memo && state.activeMemos.has(r.node.id),
        fallbackBadges?.get(r.node.id),
      ),
    ),
    0,
  );
  const hasAreas =
    withArcs &&
    state.marks.markers &&
    rows.some((r) => r.node.contextProvider || boundaryKind(r.node));
  return text + (hasAreas ? 110 : 30) + 1.5 * GRID;
}

function svgWrap(
  inner: string,
  rowCount: number,
  contentWidth: number,
  minBottom: number,
  arcLeftExtent: number,
  stripsInTree: boolean,
  state: RenderState,
): string {
  // Reserve real left margin for however far the owner edges bow out, so
  // no style ever clips at the viewBox edge.
  const leftPad = Math.max(0, -arcLeftExtent) + (arcLeftExtent < 0 ? 4 : 0);
  // Strips extend rows to the right; an expanded strip's 45-degree labels
  // descend below the last row.
  const stripPad = stripsInTree ? (state.hooksMode === "column" ? 130 : 90) : 0;
  const width = contentWidth + leftPad + stripPad;
  // minBottom: a fallback annex card may extend past the last row.
  const height = Math.max(
    rowCount * GRID + 25 + (stripsInTree && state.expandedHooksId ? 80 : 0),
    minBottom,
  );
  return `<svg width="${width}" height="${height}" viewBox="${-12.5 - leftPad},-12.5,${width},${height}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

export function composeTree(
  inputRoots: InputNode[],
  withArcs: boolean,
  state: RenderState,
  rendered?: ReadonlySet<string>,
): string {
  // The input-tree pipeline, in order and in one place: view splice → fold
  // → collapse prune → potential strip → flatten. The view runs before
  // foldRepeats (hiding wrappers can make same-named siblings adjacent, and
  // those new runs should fold) and before pruneCollapsed (collapse keys
  // off what the view shows). The owner tree's rebuildByOwner is the one
  // genuinely per-tree step and stays with the caller.
  const unprunedRoots = foldRepeats(
    viewFiltered(inputRoots, state.view),
    state.unfoldedRuns,
  );
  // Prune so rows, links, arcs, and areas all agree on what exists.
  const fallbackCards = new Map<string, InputNode[]>();
  const roots = stripPotential(
    state.opt.collapse
      ? pruneCollapsed(unprunedRoots, state.collapsedIds)
      : unprunedRoots,
    fallbackCards,
  );
  let arcLeftExtent = 0;
  // withArcs doubles as "is the parent tree": strips are parent-tree only.
  const stripsInTree =
    state.opt.hooks && withArcs && state.hooksMode !== "off";
  const overlays: string[] = [];
  const rows = flatten(roots);
  const byId = new Map(rows.map((r) => [r.node.id, r]));
  const focus = computeFocus(roots, byId, state.selectedId);
  // Color slots are assigned here, in row order, before anything paints.
  state.colors.assign(rows);
  // Canvas metrics come from the UNPRUNED tree: collapsing removes rows
  // but must not resize the canvas or shift what remains, so hidden rows
  // keep reserving their height and hidden arcs their left margin.
  const fullRows =
    state.opt.collapse && state.collapsedIds.size > 0
      ? flatten(unprunedRoots)
      : rows;
  if (fullRows !== rows && withArcs && state.marks.arcs) {
    const fullById = new Map(fullRows.map((r) => [r.node.id, r]));
    for (const r of fullRows)
      if (!r.node.dom && r.node.owner && fullById.has(r.node.owner)) {
        const { leftExtent } = ownerArcPath(
          fullById.get(r.node.owner)!,
          r,
          state.arcStyle,
          Boolean(r.node.memo) && state.marks.memo,
        );
        arcLeftExtent = Math.min(arcLeftExtent, leftExtent);
      }
  }
  const maxDepth = Math.max(...fullRows.map((r) => r.depth), 0);

  // Declared fallbacks swap between two displays: while the boundary's
  // area is OFF, a compact "fallback: Name" badge on the boundary row
  // (always in the owner view, which has no areas); while it is ON, a
  // dashed overlay inside the area's right gutter holding the fallback
  // subtree. Measure both before fixing the width.
  const fallbackBadges = new Map<string, string>();
  const cardOverlays: Array<{
    bid: string;
    local: Row[];
    cardW: number;
    cardH: number;
  }> = [];
  for (const [bid, branch] of fallbackCards) {
    if (branch.length === 0) continue;
    const active =
      withArcs && state.marks.markers && state.activeBoundaries.has(bid);
    if (!active) {
      fallbackBadges.set(
        bid,
        branch[0].name + (branch.length > 1 ? " …" : ""),
      );
    } else if (byId.has(bid)) {
      const local = flatten(branch);
      const inset = GRID / 2 + 4;
      const cardW =
        Math.max(...local.map((r) => rowTextExtent(r, state, false)), 40) +
        inset +
        10;
      const cardH = (local.length - 1) * GRID + 32;
      cardOverlays.push({ bid, local, cardW, cardH });
    }
  }
  let width = svgWidth(rows, withArcs, maxDepth, state, fallbackBadges);
  // Widen when an overlay outgrows the right gutter the area sizing
  // already reserves. Overlays never sit side by side, so the widest
  // one decides.
  width += cardOverlays.reduce(
    (extra, o) => Math.max(extra, o.cardW + 20 - 110),
    0,
  );
  const ctx: ComposeCtx = {
    stripsInTree,
    hooksColX: width - 10,
    rendered: rendered ?? null,
  };

  // withArcs doubles as the view flag: parent tree draws arcs, owner tree
  // doesn't (there the direct owner IS the parent).
  const ownerView = !withArcs;
  const links: string[] = [];
  function visitLinks(node: InputNode): void {
    const from = byId.get(node.id)!;
    const count = node.children?.length ?? 0;
    node.children?.forEach((child, i) => {
      const to = byId.get(child.id)!;
      const faded = focus
        ? !(focus.keep.has(node.id) && focus.keep.has(child.id))
        : false;
      const server = ownerView && Boolean(child.server);
      const dx = state.marks.nudge && count > 1 ? (count - 1) / 2 - i : 0;
      links.push(
        elbow(
          from.x,
          from.y,
          to.y,
          faded,
          server ? state.opt.serverColor : undefined,
          dx,
        ),
      );
      visitLinks(child);
    });
  }
  roots.forEach(visitLinks);

  // Dashed owner arcs to component nodes. With a selection: arcs touching
  // the selected node get the accent, arcs inside the neighborhood render
  // normally, and every other arc fades in place to the same strength as
  // faded rows — edges recede with the rows they connect, nothing changes
  // shape on focus.
  const arcs =
    withArcs && state.marks.arcs
      ? rows
          .filter((r) => !r.node.dom && r.node.owner && byId.has(r.node.owner))
          .map((r) => {
            const o = byId.get(r.node.owner!)!;
            const draw = (accent: boolean) => {
              const { svg, leftExtent } = ownerArc(o, r, accent, state);
              arcLeftExtent = Math.min(arcLeftExtent, leftExtent);
              return svg;
            };
            if (!focus) return draw(false);
            if (r.node.id === state.selectedId || o.node.id === state.selectedId)
              return draw(true);
            if (focus.keep.has(r.node.id) && focus.keep.has(o.node.id))
              return draw(false);
            return `<g opacity="${FADE}">${draw(false)}</g>`;
          })
      : [];

  // A fallback branch can be taller than the subtree it replaces (one
  // lazy row, a multi-row fallback); the area stretches down to keep
  // the card inside rather than letting it break out past the bottom.
  const cardBottoms = new Map<string, number>();
  for (const { bid, cardH } of cardOverlays) {
    const b = byId.get(bid);
    if (b) cardBottoms.set(bid, b.y + GRID / 2 + 16 + cardH + 8);
  }

  const areas =
    (state.opt.serverRegions
      ? serverRegionMarkup(rows, width, state.opt.serverColor)
      : "") +
    (withArcs
      ? contextAreaMarkup(rows, width, state) +
        boundaryAreaMarkup(rows, width, state, cardBottoms)
      : "");

  // Fallback overlays: the declared fallback drawn inside its area's
  // right gutter — waiting inside the region it will claim. Dashed
  // frame in the boundary's color over a translucent bg wash so the
  // dashed rows separate from the tint; below the "catches:" label.
  const cards: string[] = [];
  let cardBottom = 0;
  if (cardOverlays.length > 0) {
    const areaRight = width - 1.5 * GRID;
    for (const { bid, local, cardW, cardH } of cardOverlays) {
      const b = byId.get(bid)!;
      const kind = boundaryKind(b.node);
      if (!kind) continue;
      const color = boundaryColor(kind);
      const localById = new Map(local.map((r) => [r.node.id, r]));
      const inset = GRID / 2 + 4;
      const x0 = areaRight - cardW - 8;
      const y0 = b.y + GRID / 2 + 16;
      const localLinks: string[] = [];
      function visitCardLinks(node: InputNode): void {
        const from = localById.get(node.id)!;
        node.children?.forEach((child) => {
          const to = localById.get(child.id)!;
          localLinks.push(elbow(from.x, from.y, to.y));
          visitCardLinks(child);
        });
      }
      for (const r of local) if (r.depth === 0) visitCardLinks(r.node);
      cards.push(`<g transform="translate(${x0},${y0})">
      <rect width="${cardW}" height="${cardH}" rx="3" fill="var(--color-bg)"
        fill-opacity="0.55" stroke="${color}" stroke-opacity="0.5" stroke-dasharray="3 2">
        <title>Declared fallback &#8212; not mounted; replaces this area when the boundary ${kind === "error" ? "catches" : "suspends"}</title></rect>
      <g transform="translate(${inset},17)"><g opacity="0.55">${localLinks.join("")}</g>${local
        .map((r) => {
          const m = nodeMarkup(r, null, state, ctx);
          if (m.overlay) overlays.push(m.overlay);
          return m.svg;
        })
        .join("")}</g>
    </g>`);
      // Reserve past the stretched area bottom (card bottom + 8), not
      // just the card, so the area's lower edge never clips.
      cardBottom = Math.max(cardBottom, y0 + cardH + 8 + 16);
    }
  }

  const rowMarkup = rows
    .map((r) => {
      const m = nodeMarkup(r, focus, state, ctx, fallbackBadges.get(r.node.id));
      if (m.overlay) overlays.push(m.overlay);
      return m.svg;
    })
    .join("");

  return svgWrap(
    areas + links.join("") + arcs.join("") + rowMarkup + cards.join("") + overlays.join(""),
    fullRows.length,
    width,
    cardBottom,
    arcLeftExtent,
    stripsInTree,
    state,
  );
}
