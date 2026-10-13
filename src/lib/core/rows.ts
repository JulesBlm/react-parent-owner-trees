// Row markup: the node glyph, name, badges, state dots, memo disc, and the
// hooks strip. Pure given RenderState + ComposeCtx; the expanded-strip
// overlay (which must paint over later rows) is a return value the composer
// appends last, not a side channel.
import { boundaryColor, boundaryKind, MEMO_COLOR, STATE_COLOR, SUSPENSE_COLOR, ERROR_COLOR } from "./colors";
import { escapeXml, FADE } from "./types";
import type { ComposeCtx, Focus, InputNode, RenderState, Row } from "./types";

// Content-tight width so two trees fit side by side: the widest row's text
// extent, not a flat right padding. Monospace makes the estimate reliable
// (13px ≈ 7.8px/char; badges at 0.75em ≈ 5.9px/char). Figures whose areas
// draw (context/boundary rects, value dots, right-anchored labels) reserve
// a right gutter so the dot column and labels don't sit on row names.
export const CHAR_W = 7.8;
export const BADGE_CHAR_W = 5.9;

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

// The scope-marker click hints with one-off phrasings; kinds not listed
// fall through to the closest-boundary phrasing.
const MARKER_HINT: Record<string, string> = {
  profiler: "Click to show what this Profiler measures",
  activity: "Click to show what this Activity controls",
  viewtransition: "Click to show what this ViewTransition animates",
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

export function rowTextExtent(
  row: Row,
  state: RenderState,
  memoOpen: boolean,
  fallbackBadge?: string,
): number {
  const n = row.node;
  let badgeChars = 0;
  if (n.portal) badgeChars += (n.portalTarget ?? "node").length + 3;
  if (n.lazy) badgeChars += 5;
  if (n.profilerId) badgeChars += n.profilerId.length + 3;
  if (n.vtName) badgeChars += n.vtName.length + 3;
  if (n.boundary) badgeChars += 13;
  if (n.suspended) badgeChars += 10;
  if (n.caught) badgeChars += 7;
  if (fallbackBadge) badgeChars += fallbackBadge.length + 12;
  if (n.activity) badgeChars += n.hidden ? 7 : 8;
  if (n.fold) badgeChars += String(n.fold).length + 2;
  if (n.foldOpen) badgeChars += String(n.foldOpen).length + 2;
  if (memoOpen && n.memoProps) badgeChars += n.memoProps.join(", ").length + 4;
  if (state.marks.ids) badgeChars += n.id.length + 3;
  return row.x + 6 + n.name.length * CHAR_W + badgeChars * BADGE_CHAR_W;
}

function hooksStrip(
  row: Row,
  textContent: string,
  state: RenderState,
  ctx: ComposeCtx,
): { inline: string; overlay?: string } {
  const node = row.node;
  const list = hookMarks(node);
  if (!list) return { inline: "" };
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
    state.hooksMode === "column"
      ? ctx.hooksColX - row.x
      : 6 + plain.length * 7.8 + 10;

  if (state.expandedHooksId === node.id) {
    const baseX = row.x + startX;
    const baseY = row.y;
    const runWidth = (shown.length - 1) * HOOK_PITCH_OPEN;
    const overlay = `<g transform="translate(${baseX},${baseY})" data-hooks-toggle="${node.id}" style="cursor:pointer">
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
      </g>`;
    return { inline: "", overlay };
  }

  return {
    inline: `<g data-hooks-toggle="${node.id}" style="cursor:pointer">
    <title>${escapeXml(full)}</title>
    <rect x="${startX - 5}" y="-7" width="${shown.length * HOOK_PITCH + (extra > 0 ? 18 : 0) + 8}" height="14" fill="transparent" />
    ${shown.map((m, i) => hookGlyph(m.cat, startX + i * HOOK_PITCH)).join("")}
    ${extra > 0 ? `<text x="${startX + shown.length * HOOK_PITCH + 2}" dy="0.28em" font-size="0.7em" fill="var(--color-text-lighter)">+${extra}</text>` : ""}
  </g>`,
  };
}

export function nodeMarkup(
  row: Row,
  focus: Focus | null,
  state: RenderState,
  ctx: ComposeCtx,
  fallbackName?: string,
): { svg: string; overlay?: string } {
  const { node, x, y } = row;
  const { marks, selectedId } = state;
  const opt = state.opt;
  const SERVER_COLOR = opt.serverColor;
  const selected = node.id === selectedId;
  const focusFaded = focus ? !focus.keep.has(node.id) : false;
  // Hidden <Activity> subtrees: alive but dormant, strongly faded.
  const opacity = Math.min(
    row.dim ? 0.25 : 1,
    focusFaded ? FADE : 1,
    // Not-mounted rows are blueprint-faint but must stay readable.
    node.potential || node.departed ? 0.55 : 1,
  );
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
        color: state.colors.color(node.contextProvider),
        toggle: `data-context-toggle="${node.contextProvider}"`,
        active: state.activeContexts.has(node.contextProvider),
        hint: "Click to toggle this context's area",
      }
    : kind
      ? {
          color: boundaryColor(kind),
          toggle: `data-boundary-toggle="${node.id}"`,
          active: state.activeBoundaries.has(node.id),
          hint:
            MARKER_HINT[kind] ??
            `Click to show where this ${kind} boundary is the closest one`,
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
  // Dashed circle = not mounted; the color carries the reason. Plain
  // dashed is a declared fallback waiting its turn; error-red dashed is
  // a subtree the crash unmounted. Blueprint outlines: no fill, so the
  // filled/hollow (component/host) axis is deliberately suspended
  // inside not-mounted branches — nothing exists to be either.
  const notMounted = Boolean(node.potential) || Boolean(node.departed);
  const fill = marker
    ? marker.active
      ? marker.color
      : "var(--color-bg)"
    : notMounted
      ? "var(--color-bg)"
      : ghost
        ? SERVER_COLOR
        : node.dom || node.structural
          ? "var(--color-bg)"
          : "var(--color-text)";
  const stroke = marker
    ? marker.color
    : node.departed
      ? ERROR_COLOR
      : node.potential
        ? "var(--color-text)"
        : serverHost
          ? SERVER_COLOR
          : node.structural
            ? "var(--color-text-lighter)"
            : node.dom
              ? "var(--color-text)"
              : "none";
  const dash = notMounted ? ` stroke-dasharray="2"` : "";
  const ghostTitle = node.departed
    ? `<title>Unmounted by the crash &#8212; this stood here before the boundary caught; fibers destroyed, state lost</title>`
    : node.potential
      ? `<title>Declared fallback &#8212; not mounted; shown when this boundary suspends or catches</title>`
      : ghost
        ? `<title>Server component &#8212; ran only on the server; no fiber behind this row, ships no JS</title>`
        : serverHost
          ? `<title>Created on the server &#8212; a real DOM node, but its element arrived as payload data; only a server round trip changes it</title>`
          : "";
  // One name tspan, three independent derivations. Click affordance:
  // marker rows toggle their area, every other row selects. Italic marks
  // "no rendered output of yours behind this name" (ghost, structural,
  // unknown). Fill priority: a marker's color wins (colored circles come
  // with colored names), then the quiet gray shared by structural and
  // unknown rows, then the server color for both server row variants.
  const nameAttrs = marker
    ? ` ${marker.toggle} style="cursor:pointer"`
    : sel(node.id);
  const nameItalic = node.unknown || Boolean(node.structural) || ghost;
  const nameFill = marker
    ? marker.color
    : node.unknown || node.structural
      ? "var(--color-text-lighter)"
      : node.server
        ? SERVER_COLOR
        : null;
  const nameMarkup = `<tspan${nameAttrs}${nameItalic ? ` font-style="italic"` : ""}${nameFill ? ` fill="${nameFill}"` : ""}>${escapeXml(node.name)}</tspan>`;
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
  // The error-side mirror of `suspended`: this boundary is currently
  // showing its fallback.
  const caught =
    node.caught && marks.markers
      ? ` <tspan font-size="0.75em" font-style="italic" fill="${ERROR_COLOR}">caught<title>This boundary caught a render error and shows its fallback; the subtree it replaced is gone</title></tspan>`
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
    ? `<circle r="6.5" fill="${MEMO_COLOR}" stroke="${MEMO_COLOR}"
        data-memo-toggle="${node.id}" style="cursor:pointer"><title>React.memo wraps this component &#8212; props are compared here. Click to show the retained props snapshot.</title></circle>`
    : "";
  const memoBadge =
    memo && state.activeMemos.has(node.id) && node.memoProps
      ? ` <tspan font-size="0.75em" fill="${MEMO_COLOR}">{ ${escapeXml(node.memoProps.join(", "))} }</tspan>`
      : "";
  // State dots stack upward from the circle: one red dot per state hook,
  // capped at three (the title carries the true count). Above is the only
  // free direction: the elbow comes in from the left, children leave
  // below, the name sits to the right.
  // The hooks strip subsumes the dots while it is on (same fact, richer
  // mark); the dots come back when the strip is toggled off.
  const stateDots =
    node.state && marks.state && !ctx.stripsInTree
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
  // Names the declared alternative while the boundary's area (and with
  // it the fallback overlay) is off — the compact scent, dressed like
  // the other declaration badges (portal, lazy).
  const fallbackBadge = fallbackName
    ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">fallback: ${escapeXml(fallbackName)}<title>Declared fallback &#8212; not mounted; toggle the boundary to see it</title></tspan>`
    : "";
  const textContent = `${nameMarkup}${collapseBadge}${portalTarget}${lazyBadge}${profilerId}${vtName}${fold}${boundary}${suspended}${caught}${fallbackBadge}${activityMode}${memoBadge}${marks.ids ? ` <tspan font-size="0.8em" opacity="0.6">(${node.id})</tspan>` : ""}`;
  const strip = ctx.stripsInTree
    ? hooksStrip(row, textContent, state, ctx)
    : { inline: "" };
  const hitCircle = opt.select
    ? `<circle r="9" fill="transparent" data-select-toggle="${node.id}"
      style="cursor:pointer"><title>Click to focus this node's neighborhood${opt.sourceNav ? `; &#8984;-click to open its source` : ""}</title></circle>`
    : "";
  // The blink: this row performed work since the previous snapshot. A
  // halo behind the glyph fading from barely-there to gone — ambient
  // liveness in the Observable-minimap sense, pitched to be ignorable in
  // peripheral vision (salience tracks importance; "ran again" is a
  // heartbeat, not an alarm). SMIL rather than a stylesheet so the SVG
  // string stays self-contained, and it replays naturally because every
  // snapshot re-creates the elements. Group opacity multiplies on top,
  // so a focus-faded row's blink recedes with it.
  const blink = ctx.rendered?.has(node.id)
    ? `<circle r="8" fill="var(--color-text-lighter)" opacity="0.25" pointer-events="none">
      <animate attributeName="opacity" from="0.25" to="0" dur="0.6s" fill="freeze" /></circle>`
    : "";
  // Boundary rows (Suspense, error boundaries, Profiler, Activity,
  // ViewTransition) and structural fibers (Fragment, StrictMode,
  // createPortal) draw as squares: React's own machinery is a different
  // species from the components you write, and the silhouette says so
  // before any marker color does. Circles stay for the rows that map to
  // rendered output — your components and host DOM nodes. The
  // filled/hollow axis, dash, and marker colors carry over unchanged. The
  // selection outline follows the glyph so focus reads as the same shape,
  // grown.
  const square = boundaryKind(node) !== null || Boolean(node.structural);
  // A boundary square is always filled — in its marker color when
  // markers are on — rather than borrowing the context providers'
  // hollow-until-active toggle. Not-mounted rows stay hollow and
  // dashed; nothing exists there to be filled.
  const squareFill = marker && !notMounted ? marker.color : fill;
  // An unknown row (ADR-0007) is a third silhouette — a hollow diamond —
  // because the circle/square axis answers "your output or React's
  // machinery?" and this row's honest answer is "can't say". Quiet by
  // design (ADR-0005): a failed extraction is information, not an alarm.
  // The not-mounted axes still apply: a departed placeholder (frozen by a
  // boundary catch) keeps the error-color dashed stroke that convention
  // promises everywhere else.
  const diamond = node.unknown ? ` transform="rotate(45)"` : "";
  const glyph = node.unknown
    ? `<rect x="-2.8" y="-2.8" width="5.6" height="5.6"${diamond}
      fill="var(--color-bg)" stroke="${node.departed ? ERROR_COLOR : "var(--color-text-lighter)"}"${dash}><title>Extraction failed on this fiber &#8212; the row is a placeholder (its name is the raw fiber tag); the subtree beneath it is real</title></rect>`
    : square
    ? `<rect x="-2.8" y="-2.8" width="5.6" height="5.6"
      fill="${squareFill}"
      stroke="${stroke}"${dash}>${ghostTitle}</rect>`
    : `<circle r="3"
      fill="${fill}"
      stroke="${stroke}"${dash}>${ghostTitle}</circle>`;
  const selectedOutline = node.unknown || square
    ? `<rect x="-6" y="-6" width="12" height="12"${diamond} fill="none" stroke="var(--color-text)" stroke-opacity="0.6" />`
    : `<circle r="${memo ? 8.5 : 6.5}" fill="none" stroke="var(--color-text)" stroke-opacity="0.6" />`;
  const svg = `<g transform="translate(${x},${y})"${opt.sourceNav ? ` data-node="${node.id}"` : ""}${opacity < 1 ? ` opacity="${opacity}"` : ""}>
    ${title}${markerTitle}${blink}
    ${hitCircle}
    ${selected ? selectedOutline : ""}
    ${memoRing}
    ${glyph}
    ${stateDots}
    <text dy="0.28em" x="6" fill="var(--color-text-light)">${textContent}</text>${
      strip.inline
        ? `
    ${strip.inline}`
        : ""
    }
  </g>`;
  return strip.overlay ? { svg, overlay: strip.overlay } : { svg };
}
