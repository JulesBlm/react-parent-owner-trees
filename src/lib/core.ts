// The library's zero-dependency core: the InputNode tree shape every
// producer emits (the bippy extractor live, the static walker at build
// time) and the SVG renderer that consumes it. Importing this entry
// must never pull in bippy or react.

// Same shape diagrama emits: nesting = parent tree, owner refs = owner tree.
export interface InputNode {
  name: string;
  id: string;
  owner?: string;
  dom?: boolean;
  props?: string[];
  children?: InputNode[];
  // set by foldRepeats: this node stands in for `fold` same-named siblings
  fold?: number;
  // set by foldRepeats: first node of a run the user has unfolded
  foldOpen?: number;
  // synthesized from fiber._debugInfo: a server component (RSC) row
  server?: boolean;
  // client component whose owner is a server component: a 'use client' entry
  boundary?: boolean;
  // this row is a Context.Provider for the context with this id
  contextProvider?: string;
  // preview of the value the provider currently provides
  contextValue?: string;
  // ids of contexts this fiber reads (useContext subscriptions)
  contexts?: string[];
  // Suspense boundary (fiber tag 13); suspended = currently showing fallback
  suspense?: boolean;
  suspended?: boolean;
  // class component with getDerivedStateFromError/componentDidCatch
  errorBoundary?: boolean;
  // <Activity> boundary; hidden = mode="hidden" (subtree alive but dormant)
  activity?: boolean;
  hidden?: boolean;
  // <ViewTransition> boundary (stable since React 19.3); vtName only when
  // the author named it (shared element transitions)
  viewTransition?: boolean;
  vtName?: string;
  // Fragment/StrictMode/Profiler: a fiber React persists even though no
  // function of yours (and no DOM node) is behind it
  structural?: boolean;
  // createPortal row (HostPortal fiber): output leaves the tree here
  portal?: boolean;
  portalTarget?: string;
  // component that arrived via React.lazy (resolved lazy fiber)
  lazy?: boolean;
  // <Profiler> row; its onRender measures every render in its subtree
  profiler?: boolean;
  profilerId?: string;
  // number of state hooks living on this fiber (useState/useReducer;
  // class component state counts as one)
  state?: number;
  // primitive hook names in call order, from _debugHookTypes (dev-only;
  // custom hooks arrive flattened to their primitives)
  hooks?: string[];
  // renderer-internal: number of descendant rows hidden by a user
  // collapse (set by the renderer's prune pass, never by extraction)
  collapsed?: number;
  // wrapped in React.memo; memoProps previews the memoizedProps snapshot
  // the next shallow comparison will run against
  memo?: boolean;
  memoProps?: string[];
}

// --- Renderer -------------------------------------------------------------
// InputNode trees to indented SVG diagrams in the visual language of the
// julesblom.com parents/owners posts: 25px grid, filled circles for
// components, hollow circles for DOM nodes, solid elbow links for the tree
// structure, dashed arcs for owner edges in the parent tree.
//
// createTreeRenderer(options) returns an instance holding all interactive
// state (active areas, selection, folds, collapses, marks), so several
// diagrams on one page never share toggles. Mutators don't re-render;
// callers call parentTreeSvg/ownerTreeSvg again, as always.

const GRID = 25;
// The red state dot from the published parents/owners diagrams.
const STATE_COLOR = "#d6336c";
const MEMO_COLOR = "#5f3dc4";

// Content-tight width so two trees fit side by side: the widest row's text
// extent, not a flat right padding. Monospace makes the estimate reliable
// (13px ≈ 7.8px/char; badges at 0.75em ≈ 5.9px/char). Figures whose areas
// draw (context/boundary rects, value dots, right-anchored labels) reserve
// a right gutter so the dot column and labels don't sit on row names.
const CHAR_W = 7.8;
const BADGE_CHAR_W = 5.9;

// --- Server components ------------------------------------------------------
// RSC is drawn with the vocabulary the notation already has, nothing spatial:
// a ghost ROW variant for server components (a function of yours with no
// fiber behind it, the mirror of the structural fiber's fiber-without-a-
// function), server-colored host rows for their output, and server-colored
// owner edges wherever the owned node is itself server-created — in the
// owner tree that paints the whole server crown's links, in the parent tree
// the arcs into ghost rows. The link INTO a client component stays plain
// (only the 'use client' badge marks the boundary, and that is where props
// were serialized over the network). Parent elbows stay unmarked on
// purpose: the output structure is environment-blind, the parent tree
// can't tell. Client → server edges cannot occur; that direction never
// renders.

// --- Context areas -------------------------------------------------------
// Off by default; clicking a provider row toggles its area: a tinted rect
// over the provider's parent subtree (the context's scope) plus elbow paths
// to every fiber in range that reads the context.
const CONTEXT_COLORS = ["#2f6fab", "#8f4bbf", "#2e8b57", "#c23b77", "#b8860b"];

// --- Suspense / error boundary catch regions -----------------------------
// Click a boundary row to tint its EXCLUSIVE catch region: its subtree minus
// the subtrees of nested boundaries of the same kind. The tint is therefore
// exactly the set of components for which this boundary is the closest one.
// Parent tree only: throws and suspensions propagate up the return path.
const ERROR_COLOR = "#c0392b";
const SUSPENSE_COLOR = "#0e7490";
const PROFILER_COLOR = "#64748b";
const ACTIVITY_COLOR = "#15803d";
const VIEW_TRANSITION_COLOR = "#a21caf";

type BoundaryKind =
  | "suspense"
  | "error"
  | "profiler"
  | "activity"
  | "viewtransition";

function boundaryColor(kind: BoundaryKind): string {
  switch (kind) {
    case "error":
      return ERROR_COLOR;
    case "suspense":
      return SUSPENSE_COLOR;
    case "profiler":
      return PROFILER_COLOR;
    case "activity":
      return ACTIVITY_COLOR;
    case "viewtransition":
      return VIEW_TRANSITION_COLOR;
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function boundaryKind(node: InputNode): BoundaryKind | null {
  if (node.suspense) return "suspense";
  if (node.errorBoundary) return "error";
  if (node.profiler) return "profiler";
  if (node.activity) return "activity";
  if (node.viewTransition) return "viewtransition";
  return null;
}

const FOCUS_UP = 2;
const FOCUS_DOWN = 2;
const FADE = 0.15;

interface Focus {
  keep: Set<string>;
}

interface Row {
  node: InputNode;
  depth: number;
  y: number;
  x: number;
  // inside a hidden <Activity> subtree: alive but dormant, rendered faded
  dim: boolean;
}

function flatten(roots: InputNode[]): Row[] {
  const rows: Row[] = [];
  function visit(node: InputNode, depth: number, dim: boolean): void {
    rows.push({ node, depth, y: rows.length * GRID, x: depth * GRID, dim });
    const childDim = dim || Boolean(node.activity && node.hidden);
    node.children?.forEach((child) => visit(child, depth + 1, childDim));
  }
  roots.forEach((root) => visit(root, 0, false));
  return rows;
}

function countRows(nodes: InputNode[] | undefined): number {
  let n = 0;
  for (const node of nodes ?? []) n += 1 + countRows(node.children);
  return n;
}

// --- Owner edge styles ----------------------------------------------------
// Deep trees make semicircular arcs enormous (bulge = half the chord), so
// alternative styles are prototyped behind a toggle. What made the
// semicircles read as ONE relation repeated: identical entry angle
// (perpendicular to the chord), one shared curve family, and bulge monotone
// in span so nested ownership nests visually. Stadium and bracket keep
// those properties while bounding the width; square trades the shared entry
// angle for pure orthogonal routing.
export type ArcStyle = "arc" | "stadium" | "bracket" | "square";

// "stadium": the semicircle, uncurled. Radius grows with span as today up
// to STADIUM_R; past that the semicircle splits at its apex and a straight
// segment parallel to the chord makes up the difference, with the cap
// radius growing only logarithmically (so nested spans still separate).
// Circles are the one curve where different sizes are the same shape, so
// unlike ellipses/beziers every edge stays in one visual family, and the
// entry tangents stay perpendicular to the chord like the semicircles'.
const STADIUM_R = 36;
const STADIUM_SPREAD = 10;
// "bracket": fixed corner radius; long edges run in a straight lane.
const BRACKET_CAP = 14;

// --- Mark staging ---------------------------------------------------------
// The glossary figures introduce marks in dependency order, so each figure
// must be renderable with the not-yet-introduced marks absent (and the
// debug ids hidden). Everything defaults on; this is a figure-export knob,
// not a user-facing toggle.
export interface MarkFlags {
  arcs: boolean;
  ids: boolean;
  state: boolean;
  memo: boolean;
  // colored scope markers: context/boundary rings, name colors, badges
  markers: boolean;
  // fan sibling elbows into parallel 1px lanes centered on the trunk (the
  // published parents/owners posts' style: one visible line per child
  // instead of overpainted verticals)
  nudge: boolean;
}

// --- Hooks strip ----------------------------------------------------------
// The component's primitive hooks in call order, one small glyph per call,
// shape per category. While on it subsumes the stacked state dots (the
// state-category glyphs are the same pink, now in sequence with the rest).
// Click a strip to spread it with 45-degree labels, one row at a time;
// labels overlay neighboring rows, so they draw last with a halo.
// Parent tree only.
export type HooksMode = "off" | "trailing" | "column";

// Category per primitive. Unlisted hooks (useContext has the consumer
// lines; useId, useDebugValue and the scheduling pair answer no structural
// question) get no glyph but stay in the tooltip sequence.
type HookCategory = "state" | "effect" | "memo" | "ref";
const HOOK_CATEGORY: Record<string, HookCategory> = {
  useState: "state",
  useReducer: "state",
  useOptimistic: "state",
  useActionState: "state",
  useSyncExternalStore: "state",
  useEffect: "effect",
  useLayoutEffect: "effect",
  useInsertionEffect: "effect",
  useMemo: "memo",
  useCallback: "memo",
  useRef: "ref",
  useImperativeHandle: "ref",
};

const HOOK_CAP = 12;
const HOOK_PITCH = 8;
const HOOK_PITCH_OPEN = 16;

function hookGlyph(cat: HookCategory, cx: number): string {
  switch (cat) {
    case "state":
      return `<circle cx="${cx}" r="2.4" fill="${STATE_COLOR}" />`;
    case "effect":
      return `<path d="M${cx - 2.8},2.2 h5.6 L${cx},-2.8 Z" fill="var(--color-text)" />`;
    case "memo":
      return `<path d="M${cx - 2.6},1.2 a2.6,2.6 0 0 1 5.2,0 Z" fill="${MEMO_COLOR}" />`;
    case "ref":
      return `<rect x="${cx - 2.2}" y="-2.2" width="4.4" height="4.4" fill="none" stroke="var(--color-text-light)" />`;
  }
}

interface HookMark {
  cat: HookCategory;
  label: string;
}

// _debugHookTypes when the fiber has one; otherwise the state count walk
// stands in (class components, unrendered fibers) as anonymous state dots.
function hookMarks(node: InputNode): HookMark[] | null {
  if (node.hooks) {
    const list = node.hooks
      .filter((h) => HOOK_CATEGORY[h])
      .map((h) => ({ cat: HOOK_CATEGORY[h], label: h }));
    return list.length > 0 ? list : null;
  }
  if (node.state)
    return Array.from({ length: node.state }, () => ({
      cat: "state" as const,
      label: "state",
    }));
  return null;
}

export interface RendererOptions {
  // The "came from the server" color for ghost rows, server host rows,
  // server owner edges. One color axis, orthogonal to filled/hollow.
  serverColor?: string;
  // "content": widest row's text extent (figures, two trees side by side).
  // "fixed": indentation-based with a flat right pad (the live tool, where
  // rows churn every commit and a stable canvas beats a tight one).
  sizing?: "content" | "fixed";
  // Selection-focus affordance: the invisible hit circles and click-to-
  // focus cursor/attrs. Off for static figures — no post-hoc stripping.
  select?: boolean;
  // data-node attrs + "⌘-click to open source" hint (the live tool's
  // cmd-click navigation).
  sourceNav?: boolean;
  // Disclosure triangles + double-click subtree collapse.
  collapse?: boolean;
  // The hooks strip subsystem.
  hooks?: boolean;
  // Translucent tint rects behind contiguous runs of server rows.
  serverRegions?: boolean;
  // Resolves a context id to its display name (each producer keeps its own
  // registry; the renderer stays producer-agnostic).
  contextName?: (id: string) => string | undefined;
}

export interface TreeRenderer {
  parentTreeSvg(roots: InputNode[]): string;
  ownerTreeSvg(roots: InputNode[]): string;
  toggleContext(id: string): void;
  setContextActive(id: string, on: boolean): void;
  toggleBoundary(id: string): void;
  setBoundaryActive(id: string, on: boolean): void;
  toggleMemo(id: string): void;
  setMemoActive(id: string, on: boolean): void;
  toggleFold(id: string): void;
  toggleSelect(id: string): void;
  clearSelect(): boolean;
  toggleCollapse(id: string): void;
  toggleHooks(id: string): void;
  setHooksMode(mode: HooksMode): void;
  setArcStyle(style: ArcStyle): void;
  setMarks(partial: Partial<MarkFlags>): void;
}

export function createTreeRenderer(
  options: RendererOptions = {},
): TreeRenderer {
  const opt = {
    serverColor: options.serverColor ?? "hsl(191 65% 40%)",
    sizing: options.sizing ?? "content",
    select: options.select ?? true,
    sourceNav: options.sourceNav ?? false,
    collapse: options.collapse ?? false,
    hooks: options.hooks ?? false,
    serverRegions: options.serverRegions ?? false,
    contextName: options.contextName ?? ((id: string) => id),
  };
  const SERVER_COLOR = opt.serverColor;
  const contextName = opt.contextName;

  // --- Instance state ------------------------------------------------------
  const contextColorMap = new Map<string, string>();
  const activeContexts = new Set<string>();
  const activeBoundaries = new Set<string>();
  const activeMemos = new Set<string>();
  let selectedId: string | null = null;
  const unfoldedRuns = new Set<string>();
  const collapsedIds = new Set<string>();
  let arcStyle: ArcStyle = "arc";
  let marks: MarkFlags = {
    arcs: true,
    ids: true,
    state: true,
    memo: true,
    markers: true,
    nudge: false,
  };
  let hooksMode: HooksMode = "trailing";
  let expandedHooksId: string | null = null;
  // Per-composition scratch: strips are a parent-tree mark, and expanded
  // labels must paint over later rows, so rows stage them here and
  // composeTree appends them after everything else. arcLeftExtent is the
  // leftmost x any owner edge reaches, so svgWrap can reserve real margin
  // instead of clipping big arcs at the viewBox edge.
  let stripsInTree = false;
  let hooksColX = 0;
  let hookOverlays: string[] = [];
  let arcLeftExtent = 0;

  function contextColor(id: string): string {
    let color = contextColorMap.get(id);
    if (!color) {
      color = CONTEXT_COLORS[contextColorMap.size % CONTEXT_COLORS.length];
      contextColorMap.set(id, color);
    }
    return color;
  }

  function rowTextExtent(row: Row, memoOpen: boolean): number {
    const n = row.node;
    let badgeChars = 0;
    if (n.portal) badgeChars += (n.portalTarget ?? "node").length + 3;
    if (n.lazy) badgeChars += 5;
    if (n.profilerId) badgeChars += n.profilerId.length + 3;
    if (n.vtName) badgeChars += n.vtName.length + 3;
    if (n.boundary) badgeChars += 13;
    if (n.suspended) badgeChars += 10;
    if (n.activity) badgeChars += n.hidden ? 7 : 8;
    if (n.fold) badgeChars += String(n.fold).length + 2;
    if (n.foldOpen) badgeChars += String(n.foldOpen).length + 2;
    if (memoOpen && n.memoProps)
      badgeChars += n.memoProps.join(", ").length + 4;
    if (marks.ids) badgeChars += n.id.length + 3;
    return row.x + 6 + n.name.length * CHAR_W + badgeChars * BADGE_CHAR_W;
  }

  function svgWidth(rows: Row[], withArcs: boolean, maxDepth: number): number {
    if (opt.sizing === "fixed") return maxDepth * GRID + 260;
    const text = Math.max(
      ...rows.map((r) =>
        rowTextExtent(r, marks.memo && activeMemos.has(r.node.id)),
      ),
      0,
    );
    const hasAreas =
      withArcs &&
      marks.markers &&
      rows.some((r) => r.node.contextProvider || boundaryKind(r.node));
    return text + (hasAreas ? 110 : 30) + 1.5 * GRID;
  }

  function contextAreaMarkup(rows: Row[], width: number): string {
    const areas: string[] = [];
    let slot = 0;
    for (const id of activeContexts) {
      const p = rows.findIndex((r) => r.node.contextProvider === id);
      if (p === -1) continue;
      const provider = rows[p];
      let end = p + 1;
      while (end < rows.length && rows[end].depth > provider.depth) end++;
      const color = contextColor(id);
      const left = provider.x - GRID / 2;
      const right = width - 1.5 * GRID;
      const y = provider.y - GRID / 2;
      const height = (end - p) * GRID;
      areas.push(`<rect x="${left}" y="${y}" width="${right - left}"
        height="${height}" rx="2" fill="${color}" fill-opacity="0.07"
        stroke="${color}" stroke-opacity="0.3">
        <title>All components within this area can consume ${contextName(id)}</title>
      </rect>
      <text x="${right - 6}" y="${y + height - 5}" text-anchor="end" font-size="10"
        font-style="italic" fill="${color}">${contextName(id)}</text>`);
      // The published parent-owners-context convention: the context value is
      // a filled dot at the area's right edge on the provider's row, and a
      // delivery line runs from it down the edge and left into each
      // component that actually reads the context (useContext), ending at
      // the consumer's name. Monospace makes the name width predictable.
      const valueX = right - 10 - slot * 14;
      slot++;
      const value = provider.node.contextValue;
      areas.push(
        `${
          value
            ? `<text x="${valueX}" y="${provider.y}" dy="-0.8em" text-anchor="middle"
          font-size="10" font-style="italic" fill="${color}">${escapeXml(value)}</text>`
            : ""
        }<circle cx="${valueX}" cy="${provider.y}" r="4" fill="${color}">
        <title>Current ${contextName(id)} value</title></circle>`,
      );
      for (let i = p + 1; i < end; i++) {
        if (!rows[i].node.contexts?.includes(id)) continue;
        const nameEnd = rows[i].x + 6 + rows[i].node.name.length * 7.8 + 4;
        areas.push(`<path d="M${valueX},${provider.y} V${rows[i].y} H${nameEnd}"
        fill="none" stroke="${color}" stroke-width="1" opacity="0.8">
        <title>${rows[i].node.name} reads ${contextName(id)} here (useContext)</title></path>`);
      }
    }
    return areas.join("");
  }

  function boundaryAreaMarkup(rows: Row[], width: number): string {
    const areas: string[] = [];
    for (const id of activeBoundaries) {
      const p = rows.findIndex((r) => r.node.id === id);
      if (p === -1) continue;
      const boundary = rows[p];
      const kind = boundaryKind(boundary.node);
      if (!kind) continue;
      const color = boundaryColor(kind);
      let end = p + 1;
      while (end < rows.length && rows[end].depth > boundary.depth) end++;

      // Catch regions are EXCLUSIVE: nested same-kind subtrees are skipped,
      // since the nearest boundary catches. (The nested boundary's own row
      // stays included: if it throws or suspends while rendering itself,
      // THIS boundary still catches.) Profiler and Activity areas are
      // INCLUSIVE: nested Profilers all measure the same work, and a nested
      // Activity stays under the outer one's control, so the area is the
      // whole subtree with no subtraction.
      const runs: Array<[number, number]> = [];
      if (kind === "profiler" || kind === "activity") {
        if (end > p + 1) runs.push([p + 1, end]);
      } else {
        let i = p + 1;
        let runStart = -1;
        while (i < end) {
          if (runStart === -1) runStart = i;
          if (boundaryKind(rows[i].node) === kind) {
            runs.push([runStart, i + 1]);
            runStart = -1;
            let j = i + 1;
            while (j < end && rows[j].depth > rows[i].depth) j++;
            i = j;
            continue;
          }
          i++;
        }
        if (runStart !== -1) runs.push([runStart, end]);
      }

      const badge = boundary.node.profilerId ?? boundary.node.vtName;
      const displayName = boundary.node.name + (badge ? ` "${badge}"` : "");
      const mode = boundary.node.hidden ? "hidden" : "visible";
      const areaTitle =
        kind === "profiler"
          ? `${displayName} measures every render in this area`
          : kind === "activity"
            ? `${displayName} controls this subtree; currently ${mode}`
            : kind === "viewtransition"
              ? `${displayName} animates this subtree as one unit`
              : `${displayName} (${boundary.node.id}) is the closest ${kind} boundary here`;
      const tag = marks.ids ? ` (${boundary.node.id})` : "";
      const areaLabel =
        kind === "profiler"
          ? `measures: ${displayName}${tag}`
          : kind === "activity"
            ? `covers: ${displayName}${tag} &#183; ${mode}`
            : kind === "viewtransition"
              ? `animates: ${displayName}${tag}`
              : `catches: ${displayName}${tag}`;
      const right = width - 1.5 * GRID;
      runs.forEach(([start, stop], runIndex) => {
        const left =
          Math.min(...rows.slice(start, stop).map((r) => r.x)) - GRID / 2;
        const y = rows[start].y - GRID / 2;
        const height = (stop - start) * GRID;
        areas.push(`<rect x="${left}" y="${y}" width="${right - left}"
          height="${height}" rx="2" fill="${color}" fill-opacity="0.07"
          stroke="${color}" stroke-opacity="0.3">
          <title>${areaTitle}</title>
        </rect>${
          runIndex === 0
            ? `<text x="${right - 6}" y="${y + 8}" text-anchor="end"
          font-size="10" font-style="italic" fill="${color}">${areaLabel}</text>`
            : ""
        }`);
      });
    }
    return areas.join("");
  }

  // ContextRect-style region marking (parent-owners-context post):
  // translucent tinted rects behind contiguous runs of server rows,
  // labelled in italics.
  function serverRegionMarkup(rows: Row[], width: number): string {
    const regions: string[] = [];
    let i = 0;
    while (i < rows.length) {
      if (!rows[i].node.server) {
        i++;
        continue;
      }
      let j = i;
      while (j < rows.length && rows[j].node.server) j++;
      const run = rows.slice(i, j);
      const left = Math.min(...run.map((r) => r.x)) - GRID / 2;
      const right = width - 1.5 * GRID;
      const y = rows[i].y - GRID / 2;
      const height = (j - i) * GRID;
      regions.push(`<rect x="${left}" y="${y}" width="${right - left}"
        height="${height}" rx="2" fill="${SERVER_COLOR}" fill-opacity="0.08"
        stroke="${SERVER_COLOR}" stroke-opacity="0.25">
        <title>Rendered on the server</title>
      </rect>
      <text x="${right - 6}" y="${y + 8}" text-anchor="end"
        font-size="10" font-style="italic" fill="${SERVER_COLOR}">server</text>`);
      i = j;
    }
    return regions.join("");
  }

  // --- Selection focus ----------------------------------------------------
  // Observable-minimap style neighborhood view: click any node to focus it.
  // Kept rows: tree ancestors within FOCUS_UP, descendants within
  // FOCUS_DOWN, plus one hop in the owner graph regardless of tree distance
  // (the direct owner and ownees are the edges this tool exists to show).
  // Everything else fades in place — layout never shifts.
  function computeFocus(
    roots: InputNode[],
    byId: Map<string, Row>,
  ): Focus | null {
    if (!selectedId || !byId.has(selectedId)) return null;
    const parentOf = new Map<string, string>();
    const childrenOf = new Map<string, string[]>();
    function walk(node: InputNode): void {
      const kids = node.children ?? [];
      childrenOf.set(
        node.id,
        kids.map((k) => k.id),
      );
      for (const kid of kids) {
        parentOf.set(kid.id, node.id);
        walk(kid);
      }
    }
    roots.forEach(walk);

    const keep = new Set<string>([selectedId]);
    let up = parentOf.get(selectedId);
    for (let i = 0; i < FOCUS_UP && up; i++) {
      keep.add(up);
      up = parentOf.get(up);
    }
    let frontier = [selectedId];
    for (let i = 0; i < FOCUS_DOWN; i++) {
      frontier = frontier.flatMap((id) => childrenOf.get(id) ?? []);
      frontier.forEach((id) => keep.add(id));
    }
    const owner = byId.get(selectedId)!.node.owner;
    if (owner && byId.has(owner)) keep.add(owner);
    for (const row of byId.values())
      if (row.node.owner === selectedId) keep.add(row.node.id);
    return { keep };
  }

  // Collapse consecutive runs of same-named siblings (list output) into one
  // representative node tagged with the run length. A 262-item listbox
  // becomes one "ListBoxItem ×262" row whose subtree shows the shape of
  // each item.
  function foldRepeats(nodes: InputNode[], minRun = 4): InputNode[] {
    const out: InputNode[] = [];
    let i = 0;
    while (i < nodes.length) {
      let j = i;
      while (j < nodes.length && nodes[j].name === nodes[i].name) j++;
      const run = j - i;
      const foldChildren = (node: InputNode): InputNode => {
        const kids = node.children;
        return {
          ...node,
          children: kids ? foldRepeats(kids, minRun) : undefined,
        };
      };
      if (run >= minRun && !unfoldedRuns.has(nodes[i].id)) {
        out.push({ ...foldChildren(nodes[i]), fold: run });
        i = j;
      } else if (run >= minRun) {
        for (let k = i; k < j; k++) {
          const member = foldChildren(nodes[k]);
          if (k === i) member.foldOpen = run;
          out.push(member);
        }
        i = j;
      } else {
        out.push(foldChildren(nodes[i]));
        i++;
      }
    }
    return out;
  }

  // --- Subtree collapse ---------------------------------------------------
  // User-driven hiding, distinct from foldRepeats (which merges repeated
  // siblings). Double-click a node to hide everything below it; the row
  // stays, with a "&#9656; n" badge carrying the hidden count as the way
  // back in. Applied as a prune before layout so links, arcs, and areas
  // never see the hidden rows. Both trees share the id set; each hides the
  // node's subtree in its own sense (parent: what it contains; owner: what
  // it rendered).
  function pruneCollapsed(nodes: InputNode[]): InputNode[] {
    return nodes.map((node) => {
      if (collapsedIds.has(node.id) && node.children?.length) {
        const { children, ...rest } = node;
        return { ...rest, collapsed: countRows(children) };
      }
      return node.children
        ? { ...node, children: pruneCollapsed(node.children) }
        : node;
    });
  }

  function hooksStrip(row: Row, textContent: string): string {
    const node = row.node;
    const list = hookMarks(node);
    if (!list) return "";
    const full = node.hooks
      ? node.hooks.join(", ")
      : `${node.state} state hook${node.state! > 1 ? "s" : ""}`;
    const shown = list.length > HOOK_CAP ? list.slice(0, HOOK_CAP - 1) : list;
    const extra = list.length - shown.length;
    // Trailing sits after the row's text: strip the markup to characters and
    // use the monospace estimate (smaller tspans overestimate, which errs
    // toward a gap, never an overlap). Column is a fixed lane on the right.
    const plain = textContent
      .replace(/<title>[\s\S]*?<\/title>/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&#\d+;|&[a-z]+;/g, ".");
    const startX =
      hooksMode === "column"
        ? hooksColX - row.x
        : 6 + plain.length * 7.8 + 10;

    if (expandedHooksId === node.id) {
      const baseX = row.x + startX;
      const baseY = row.y;
      const runWidth = (shown.length - 1) * HOOK_PITCH_OPEN;
      hookOverlays.push(
        `<g transform="translate(${baseX},${baseY})" data-hooks-toggle="${node.id}" style="cursor:pointer">
        <title>${escapeXml(full)}</title>
        <rect x="-5" y="-8" width="${runWidth + 10 + (extra > 0 ? 20 : 0)}" height="16" fill="transparent" />
        ${shown
          .map(
            (m, i) =>
              hookGlyph(m.cat, i * HOOK_PITCH_OPEN) +
              `<text transform="translate(${i * HOOK_PITCH_OPEN + 2},8) rotate(45)" font-size="0.7em"
                 fill="var(--color-text-light)" paint-order="stroke" stroke="var(--color-bg)" stroke-width="3">${m.label}</text>`,
          )
          .join("")}
        ${extra > 0 ? `<text x="${runWidth + 8}" dy="0.28em" font-size="0.7em" fill="var(--color-text-lighter)">+${extra}</text>` : ""}
      </g>`,
      );
      return "";
    }

    return `<g data-hooks-toggle="${node.id}" style="cursor:pointer">
    <title>${escapeXml(full)}</title>
    <rect x="${startX - 5}" y="-7" width="${shown.length * HOOK_PITCH + (extra > 0 ? 18 : 0) + 8}" height="14" fill="transparent" />
    ${shown.map((m, i) => hookGlyph(m.cat, startX + i * HOOK_PITCH)).join("")}
    ${extra > 0 ? `<text x="${startX + shown.length * HOOK_PITCH + 2}" dy="0.28em" font-size="0.7em" fill="var(--color-text-lighter)">+${extra}</text>` : ""}
  </g>`;
  }

  function nodeMarkup(row: Row, focus: Focus | null): string {
    const { node, x, y } = row;
    const selected = node.id === selectedId;
    const focusFaded = focus ? !focus.keep.has(node.id) : false;
    // Hidden <Activity> subtrees: alive but dormant, strongly faded.
    const opacity = Math.min(row.dim ? 0.25 : 1, focusFaded ? FADE : 1);
    const propCount = node.props?.length ?? 0;
    const title =
      propCount > 0 ? `<title>${node.props!.join(", ")}</title>` : "";
    // The select affordance is emitted only when the instance is
    // interactive; figures render without it instead of stripping it.
    const sel = (id: string) =>
      opt.select ? ` data-select-toggle="${id}" style="cursor:pointer"` : "";
    const fold = node.fold
      ? ` <tspan font-weight="bold" fill="var(--color-text)" data-fold-toggle="${node.id}"
         style="cursor:pointer" text-decoration="underline">×${node.fold}</tspan>`
      : node.foldOpen
        ? ` <tspan font-weight="bold" fill="var(--color-text-lighter)" data-fold-toggle="${node.id}"
           style="cursor:pointer" text-decoration="underline">−${node.foldOpen}</tspan>`
        : "";
    // The 'use client' badge is the boundary's only mark: a fact about the
    // module, sitting on the row where a server render handed props to a
    // client component. The links into this row stay plain (the row is
    // client), so the badge alone carries the serialization story. Not in
    // the server color — the badge marks a CLIENT module, and the color
    // means "came from the server"; it dresses like the other module-fact
    // badges (portal, lazy).
    const boundary = node.boundary
      ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">'use client'<title>Server &#8594; client boundary: props arriving here crossed the network, so they had to be serializable</title></tspan>`
      : "";
    // Clickable markers: context providers and suspense/error boundaries
    // get a colored ring, a colored clickable name, and a filled circle
    // when active.
    const kind = marks.markers ? boundaryKind(node) : null;
    const marker = !marks.markers
      ? null
      : node.contextProvider
      ? {
          color: contextColor(node.contextProvider),
          toggle: `data-context-toggle="${node.contextProvider}"`,
          active: activeContexts.has(node.contextProvider),
          hint: "Click to toggle this context's area",
        }
      : kind
        ? {
            color: boundaryColor(kind),
            toggle: `data-boundary-toggle="${node.id}"`,
            active: activeBoundaries.has(node.id),
            hint:
              kind === "profiler"
                ? "Click to show what this Profiler measures"
                : kind === "activity"
                  ? "Click to show what this Activity controls"
                  : kind === "viewtransition"
                    ? "Click to show what this ViewTransition animates"
                    : `Click to show where this ${kind} boundary is the closest one`,
          }
        : null;
    // Two server row variants, one color: server color = came from the
    // server, and the filled/hollow convention carries over unchanged —
    // filled circle = component, hollow circle = host. A ghost row is a
    // server component (your function ran, nothing materialized on the
    // client: filled circle and italic name in the server color — the
    // italic name is what says "no fiber behind this"). A server-created
    // host row is its output (a real fiber and DOM node, but the element
    // arrived as payload data: hollow circle and upright name, both in the
    // server color — colored circles always come with colored names, like
    // marker rows).
    const ghost = Boolean(node.server) && !node.dom;
    const serverHost = Boolean(node.server) && Boolean(node.dom);
    const fill = marker
      ? marker.active
        ? marker.color
        : "var(--color-bg)"
      : ghost
        ? SERVER_COLOR
        : node.dom || node.structural
          ? "var(--color-bg)"
          : "var(--color-text)";
    const stroke = marker
      ? marker.color
      : serverHost
        ? SERVER_COLOR
        : node.structural
          ? "var(--color-text-lighter)"
          : node.dom
            ? "var(--color-text)"
            : "none";
    const ghostTitle = ghost
      ? `<title>Server component &#8212; ran only on the server; no fiber behind this row, ships no JS</title>`
      : serverHost
        ? `<title>Created on the server &#8212; a real DOM node, but its element arrived as payload data; only a server round trip changes it</title>`
        : "";
    const nameMarkup = marker
      ? `<tspan ${marker.toggle} style="cursor:pointer"${node.structural ? ` font-style="italic"` : ""}
         fill="${marker.color}">${node.name}</tspan>`
      : ghost
        ? `<tspan${sel(node.id)}
           font-style="italic" fill="${SERVER_COLOR}">${node.name}</tspan>`
        : serverHost
          ? `<tspan${sel(node.id)}
             fill="${SERVER_COLOR}">${node.name}</tspan>`
          : node.structural
            ? `<tspan${sel(node.id)}
               font-style="italic" fill="var(--color-text-lighter)">${node.name}</tspan>`
            : `<tspan${sel(node.id)}>${node.name}</tspan>`;
    const profilerId =
      node.profilerId && marks.markers
        ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">"${node.profilerId}"</tspan>`
        : "";
    const vtName =
      node.vtName && marks.markers
        ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">"${node.vtName}"</tspan>`
        : "";
    const suspended =
      node.suspended && marks.markers
        ? ` <tspan font-size="0.75em" font-style="italic" fill="${SUSPENSE_COLOR}">suspended</tspan>`
        : "";
    // Output leaves the tree at a portal row; the arrow badge says where it
    // lands. Children keep normal elbows: within the target they nest as
    // drawn, only this row's "output lands here" is redirected.
    const portalTarget = node.portal
      ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">&#8594; ${escapeXml(node.portalTarget ?? "node")}</tspan>`
      : "";
    const lazyBadge = node.lazy
      ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">lazy</tspan>`
      : "";
    const activityMode = node.activity && marks.markers
      ? node.hidden
        ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text)">hidden</tspan>`
        : ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">visible</tspan>`
      : "";
    const markerTitle = marker ? `<title>${marker.hint}</title>` : "";
    // Memo is a wrapper (a real fiber), so it draws as a filled disc the
    // node sits inside: containment, not adornment. The node's own circle
    // paints on top.
    const memo = node.memo && marks.memo;
    const memoRing = memo
      ? `<circle r="6.5" fill="${MEMO_COLOR}" fill-opacity="0.3" stroke="${MEMO_COLOR}"
        data-memo-toggle="${node.id}" style="cursor:pointer"><title>React.memo wraps this component &#8212; props are compared here. Click to show the retained props snapshot.</title></circle>`
      : "";
    const memoBadge =
      memo && activeMemos.has(node.id) && node.memoProps
        ? ` <tspan font-size="0.75em" fill="${MEMO_COLOR}">{ ${escapeXml(node.memoProps.join(", "))} }</tspan>`
        : "";
    // State dots stack upward from the circle: one red dot per state hook,
    // capped at three (the title carries the true count). Above is the only
    // free direction: the elbow comes in from the left, children leave
    // below, the name sits to the right.
    // The hooks strip subsumes the dots while it is on (same fact, richer
    // mark); the dots come back when the strip is toggled off.
    const stateDots =
      node.state && marks.state && !stripsInTree
        ? `<g fill="${STATE_COLOR}"><title>${node.state} state hook${node.state > 1 ? "s" : ""} here</title>${Array.from(
            { length: Math.min(node.state, 3) },
            (_, i) => `<circle cy="${-(memo ? 9.5 : 7) - i * 5}" r="2" />`,
          ).join("")}</g>`
        : "";
    // Disclosure triangle, file-explorer grammar: a very small ▾ on every
    // row with children, ▸ plus the hidden count while collapsed.
    const collapseBadge = !opt.collapse
      ? ""
      : node.collapsed
        ? ` <tspan data-collapse-toggle="${node.id}" style="cursor:pointer"
         font-weight="bold" fill="var(--color-text-lighter)">&#9656;&#8202;${node.collapsed}<title>${node.collapsed} rows hidden</title></tspan>`
        : node.children?.length
          ? ` <tspan data-collapse-toggle="${node.id}" style="cursor:pointer"
           font-size="0.6em" fill="var(--color-text-lighter)" opacity="0.7">&#9662;<title>Hide this subtree</title></tspan>`
          : "";
    const textContent = `${nameMarkup}${collapseBadge}${portalTarget}${lazyBadge}${profilerId}${vtName}${fold}${boundary}${suspended}${activityMode}${memoBadge}${marks.ids ? ` <tspan font-size="0.8em" opacity="0.6">(${node.id})</tspan>` : ""}`;
    const strip = stripsInTree ? hooksStrip(row, textContent) : "";
    const hitCircle = opt.select
      ? `<circle r="9" fill="transparent" data-select-toggle="${node.id}"
      style="cursor:pointer"><title>Click to focus this node's neighborhood${opt.sourceNav ? `; &#8984;-click to open its source` : ""}</title></circle>`
      : "";
    return `<g transform="translate(${x},${y})"${opt.sourceNav ? ` data-node="${node.id}"` : ""}${opacity < 1 ? ` opacity="${opacity}"` : ""}>
    ${title}${markerTitle}
    ${hitCircle}
    ${selected ? `<circle r="${memo ? 8.5 : 6.5}" fill="none" stroke="var(--color-text)" stroke-opacity="0.6" />` : ""}
    ${memoRing}
    <circle r="3"
      fill="${fill}"
      stroke="${stroke}">${ghostTitle}</circle>
    ${stateDots}
    <text dy="0.28em" x="6" fill="var(--color-text-light)">${textContent}</text>${
      strip
        ? `
    ${strip}`
        : ""
    }
  </g>`;
  }

  // In the owner tree, elbows are ownership drawn as structure (arcs in
  // disguise), so the server coloring follows the relation there: every
  // elbow whose target is server-created (ghost row or server host row) is
  // drawn whole in the server color, so the server crown's links read as
  // one colored region and the client subtrees stay plain. Solid, not
  // dashed — in the owner tree the relation is structural, and dashes are
  // the parent-tree arc language. Mixed-color siblings share a trunk, so
  // figures fan their elbows (marks.nudge) into parallel lanes: one visible
  // line per child, no overpainting. Parent-tree elbows are containment and
  // never carry the color. The horizontal always ends at the child's true
  // x, so entries stay on the circles regardless of lane.
  function elbow(
    x1: number,
    y1: number,
    y2: number,
    faded = false,
    server = false,
    dx = 0,
  ): string {
    return `<path d="M${x1 + dx},${y1} V${y2} H${x1 + GRID}" fill="none" stroke="${server ? SERVER_COLOR : "var(--color-text)"}"${faded ? ` opacity="${FADE}"` : ""}${server ? `><title>Server render &#8212; this element was created on the server</title></path>` : " />"}`;
  }

  // Server-owned arcs: same relation as every other arc (who rendered
  // whom), same dash, just the server color — the owned element was created
  // during a server render. The arc into a client component stays plain;
  // the boundary lives on the 'use client' badge, not the edge.
  function arcPath(d: string, accent: boolean, server = false): string {
    if (server)
      return `<path d="${d}"
      fill="none" stroke="${SERVER_COLOR}"${accent ? ' stroke-width="1.5"' : ""} stroke-dasharray="2">
      <title>Server render &#8212; this element was created on the server</title></path>`;
    return `<path d="${d}"
    fill="none" stroke="${accent ? "var(--color-text)" : "var(--color-text-light)"}"${accent ? ' stroke-width="1.5"' : ""} stroke-dasharray="2" />`;
  }

  // Returns just the path data for an owner edge in the active style, so
  // stubs can reuse the exact geometry of the arc they stand for.
  function ownerArcPath(o: Row, r: Row): string {
    const ox = o.x;
    const oy = o.y;
    const rx = r.x;
    const ry = r.y;
    const d = Math.hypot(rx - ox, ry - oy);
    // A memo'd ownee receives its props at the comparison gate, not at the
    // function: every style ends the edge on the memo ring.
    const trim = r.node.memo && marks.memo && d > 20 ? 6.5 : 0;

    // The bracket without the radius: hard right angles in the same lane.
    // No caps, so no degenerate case at short spans.
    if (arcStyle === "square") {
      const lane = Math.min(ox, rx) - BRACKET_CAP;
      arcLeftExtent = Math.min(arcLeftExtent, lane);
      return `M${ox},${oy} H${lane} V${ry} H${rx - trim}`;
    }

    // Rounded orthogonal routing in a lane left of both endpoints.
    // Degenerates below two corner radii of vertical span, where the
    // ellipse (= circle at this size) is prettier anyway.
    if (arcStyle === "bracket" && Math.abs(ry - oy) > 2 * BRACKET_CAP + 2) {
      const lane = Math.min(ox, rx) - BRACKET_CAP;
      arcLeftExtent = Math.min(arcLeftExtent, lane);
      const s = ry > oy ? 1 : -1;
      const sweep = s === 1 ? 0 : 1;
      const c = BRACKET_CAP;
      return `M${ox},${oy} H${lane + c} A${c},${c} 0,0,${sweep} ${lane},${oy + s * c} V${ry - s * c} A${c},${c} 0,0,${sweep} ${lane + c},${ry} H${rx - trim}`;
    }

    const half = d / 2;
    const ux = (rx - ox) / (d || 1);
    const uy = (ry - oy) / (d || 1);
    // The drawn (sweep 0) side lies toward (-uy, ux) from the chord.
    const vx = -uy;
    const vy = ux;

    if (arcStyle === "stadium" && half > STADIUM_R) {
      const R = STADIUM_R + STADIUM_SPREAD * Math.log(half / STADIUM_R);
      // Cap centers sit on the chord, one radius in from each endpoint; the
      // apexes sit one radius to the drawn side. Owner cap, straight run
      // parallel to the chord, ownee cap. At 2R of span this is exactly the
      // semicircle.
      const p1x = ox + R * ux;
      const p1y = oy + R * uy;
      const p2x = rx - R * ux;
      const p2y = ry - R * uy;
      const a1x = p1x + R * vx;
      const a1y = p1y + R * vy;
      const a2x = p2x + R * vx;
      const a2y = p2y + R * vy;
      arcLeftExtent = Math.min(arcLeftExtent, ox, rx, p1x - R, p2x - R);
      let ex = rx;
      let ey = ry;
      if (trim) {
        const t = trim / R;
        ex = p2x + R * (Math.cos(t) * ux + Math.sin(t) * vx);
        ey = p2y + R * (Math.cos(t) * uy + Math.sin(t) * vy);
      }
      return `M${ox},${oy} A${R},${R} 0,0,0 ${a1x},${a1y} L${a2x},${a2y} A${R},${R} 0,0,0 ${ex},${ey}`;
    }

    // The original semicircle: radius half the chord, endpoints diametric.
    const cx = (ox + rx) / 2;
    const cy = (oy + ry) / 2;
    arcLeftExtent = Math.min(arcLeftExtent, ox, rx, cx - half);
    // Walk trim/half radians back from the endpoint along the drawn side.
    let ex = rx;
    let ey = ry;
    if (trim) {
      const t = trim / half;
      ex = cx + half * (Math.cos(t) * ux + Math.sin(t) * vx);
      ey = cy + half * (Math.cos(t) * uy + Math.sin(t) * vy);
    }
    return `M${ox},${oy} A${half},${half} 0,0,0 ${ex},${ey}`;
  }

  function ownerArc(o: Row, r: Row, accent: boolean): string {
    // Colored iff the OWNED node is server-created. A server component's
    // owner is always a server component (client renders never produce
    // server components), so this partitions the arcs exactly like the
    // owner-tree links: server-colored into the server crown, plain into
    // client components.
    return arcPath(ownerArcPath(o, r), accent, Boolean(r.node.server));
  }

  function svgWrap(
    inner: string,
    rowCount: number,
    contentWidth: number,
  ): string {
    // Reserve real left margin for however far the owner edges bow out, so
    // no style ever clips at the viewBox edge.
    const leftPad = Math.max(0, -arcLeftExtent) + (arcLeftExtent < 0 ? 4 : 0);
    // Strips extend rows to the right; an expanded strip's 45-degree labels
    // descend below the last row.
    const stripPad = stripsInTree ? (hooksMode === "column" ? 130 : 90) : 0;
    const width = contentWidth + leftPad + stripPad;
    const height =
      rowCount * GRID + 25 + (stripsInTree && expandedHooksId ? 80 : 0);
    return `<svg width="${width}" height="${height}" viewBox="${-12.5 - leftPad},-12.5,${width},${height}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }

  // Shared composer for both tree views. SVG stacking is DOM order: areas
  // behind, then elbows, then owner arcs, rows on top, expanded hook
  // overlays last.
  function composeTree(unprunedRoots: InputNode[], withArcs: boolean): string {
    // Prune first so rows, links, arcs, and areas all agree on what exists.
    const roots = opt.collapse ? pruneCollapsed(unprunedRoots) : unprunedRoots;
    arcLeftExtent = 0;
    // withArcs doubles as "is the parent tree": strips are parent-tree only.
    stripsInTree = opt.hooks && withArcs && hooksMode !== "off";
    hookOverlays = [];
    const rows = flatten(roots);
    const byId = new Map(rows.map((r) => [r.node.id, r]));
    const focus = computeFocus(roots, byId);
    // Canvas metrics come from the UNPRUNED tree: collapsing removes rows
    // but must not resize the canvas or shift what remains, so hidden rows
    // keep reserving their height and hidden arcs their left margin.
    const fullRows =
      opt.collapse && collapsedIds.size > 0 ? flatten(unprunedRoots) : rows;
    if (fullRows !== rows && withArcs && marks.arcs) {
      const fullById = new Map(fullRows.map((r) => [r.node.id, r]));
      for (const r of fullRows)
        if (!r.node.dom && r.node.owner && fullById.has(r.node.owner))
          ownerArcPath(fullById.get(r.node.owner)!, r);
    }
    const maxDepth = Math.max(...fullRows.map((r) => r.depth), 0);
    const width = svgWidth(rows, withArcs, maxDepth);
    hooksColX = width - 10;

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
        const dx = marks.nudge && count > 1 ? (count - 1) / 2 - i : 0;
        links.push(elbow(from.x, from.y, to.y, faded, server, dx));
        visitLinks(child);
      });
    }
    roots.forEach(visitLinks);

    // Dashed owner arcs to component nodes. With a selection: arcs touching
    // the selected node get the accent, arcs inside the neighborhood render
    // normally, and every other arc fades in place to the same strength as
    // faded rows — edges recede with the rows they connect, nothing changes
    // shape on focus.
    const arcs = withArcs && marks.arcs
      ? rows
          .filter((r) => !r.node.dom && r.node.owner && byId.has(r.node.owner))
          .map((r) => {
            const o = byId.get(r.node.owner!)!;
            if (!focus) return ownerArc(o, r, false);
            if (r.node.id === selectedId || o.node.id === selectedId)
              return ownerArc(o, r, true);
            if (focus.keep.has(r.node.id) && focus.keep.has(o.node.id))
              return ownerArc(o, r, false);
            return `<g opacity="${FADE}">${ownerArc(o, r, false)}</g>`;
          })
      : [];

    const areas =
      (opt.serverRegions ? serverRegionMarkup(rows, width) : "") +
      (withArcs
        ? contextAreaMarkup(rows, width) + boundaryAreaMarkup(rows, width)
        : "");

    return svgWrap(
      areas +
        links.join("") +
        arcs.join("") +
        rows.map((r) => nodeMarkup(r, focus)).join("") +
        hookOverlays.join(""),
      fullRows.length,
      width,
    );
  }

  return {
    parentTreeSvg(unfoldedRoots: InputNode[]): string {
      return composeTree(foldRepeats(unfoldedRoots), true);
    },
    ownerTreeSvg(roots: InputNode[]): string {
      // Re-nest by owner refs, preserving parent-tree DFS order. In the
      // owner tree the direct owner IS the parent, so no arcs; and the
      // server/client split is clean here: ghost rows form a connected
      // crown containing the root, each 'use client' landing roots a
      // purely-client subtree.
      const parentRows = flatten(roots);
      const ownerChildren = new Map<string, InputNode[]>();
      const ownerRoots: InputNode[] = [];

      const ids = new Set(parentRows.map((r) => r.node.id));
      for (const { node } of parentRows) {
        if (node.owner && ids.has(node.owner)) {
          const list = ownerChildren.get(node.owner) ?? [];
          list.push(node);
          ownerChildren.set(node.owner, list);
        } else {
          ownerRoots.push(node);
        }
      }

      const rebuilt = (function rebuild(nodes: InputNode[]): InputNode[] {
        return nodes.map((node) => ({
          ...node,
          children: rebuild(ownerChildren.get(node.id) ?? []),
        }));
      })(ownerRoots);

      return composeTree(foldRepeats(rebuilt), false);
    },
    toggleContext(id: string): void {
      if (activeContexts.has(id)) activeContexts.delete(id);
      else activeContexts.add(id);
    },
    // Idempotent setters for figure components: apply a figure's desired
    // active state on every render (React state is the source of truth
    // there, these sets are just the renderer's view of it).
    setContextActive(id: string, on: boolean): void {
      if (on) activeContexts.add(id);
      else activeContexts.delete(id);
    },
    toggleBoundary(id: string): void {
      if (activeBoundaries.has(id)) activeBoundaries.delete(id);
      else activeBoundaries.add(id);
    },
    setBoundaryActive(id: string, on: boolean): void {
      if (on) activeBoundaries.add(id);
      else activeBoundaries.delete(id);
    },
    // Memo rows whose retained-props snapshot is shown inline (click the
    // ring).
    toggleMemo(id: string): void {
      if (activeMemos.has(id)) activeMemos.delete(id);
      else activeMemos.add(id);
    },
    setMemoActive(id: string, on: boolean): void {
      if (on) activeMemos.add(id);
      else activeMemos.delete(id);
    },
    // Runs the user has clicked open, keyed by the representative node's
    // id. The parent and owner tree share ids, so a toggle affects both
    // views.
    toggleFold(id: string): void {
      if (unfoldedRuns.has(id)) unfoldedRuns.delete(id);
      else unfoldedRuns.add(id);
    },
    toggleSelect(id: string): void {
      selectedId = selectedId === id ? null : id;
    },
    clearSelect(): boolean {
      const had = selectedId !== null;
      selectedId = null;
      return had;
    },
    toggleCollapse(id: string): void {
      if (collapsedIds.has(id)) collapsedIds.delete(id);
      else collapsedIds.add(id);
    },
    toggleHooks(id: string): void {
      expandedHooksId = expandedHooksId === id ? null : id;
    },
    setHooksMode(mode: HooksMode): void {
      hooksMode = mode;
    },
    setArcStyle(style: ArcStyle): void {
      arcStyle = style;
    },
    setMarks(partial: Partial<MarkFlags>): void {
      marks = { ...marks, ...partial };
    },
  };
}
