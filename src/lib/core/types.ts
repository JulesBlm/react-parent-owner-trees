// The InputNode contract every producer emits, the renderer's public
// interface types, and the RenderState view the pure passes read. This
// module is the shared leaf: everything in core/ may import it, it imports
// nothing.

// Nesting = parent tree, owner refs = owner tree.
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
  // class component with getDerivedStateFromError/componentDidCatch;
  // caught = currently showing its fallback (fiber DidCapture flag)
  errorBoundary?: boolean;
  caught?: boolean;
  // declared alternative, not mounted: a Suspense/error fallback drawn
  // from its prop while the boundary shows its primary content. Dashed
  // circle, faded row; no fiber exists yet.
  potential?: boolean;
  // root row of a boundary's fallback branch, carrying the boundary's
  // id (set whether the fallback is potential or mounted). A fallback
  // is never caught by its own boundary — its errors propagate to the
  // NEXT one out — so catch regions exclude their own fallback rows,
  // while an outer boundary's region rightly covers an inner
  // boundary's fallback.
  fallbackOf?: string;
  // unmounted by a crash: what stood under an error boundary before it
  // caught. Dashed circle in the error color; fibers destroyed, state
  // lost. Live tool only (needs commit history).
  departed?: boolean;
  // alive but not shown: the primary subtree of a suspended boundary
  // (React keeps it as hidden Offscreen fibers, state preserved). Dimmed
  // like a hidden <Activity> subtree — same mechanism underneath.
  dormant?: boolean;
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
  // extraction failed on this fiber (ADR-0007): the row is a placeholder —
  // name carries the raw fiber tag — but the subtree beneath it is real.
  // Errors are local and visible, never a dropped subtree.
  unknown?: boolean;
}

// The notation's coordinate grid: one row per 25px, one indent per 25px.
export const GRID = 25;

// Fade strength shared by focus-faded rows, elbows, and owner arcs.
export const FADE = 0.15;

export interface Focus {
  keep: Set<string>;
}

export interface Row {
  node: InputNode;
  depth: number;
  y: number;
  x: number;
  // inside a hidden <Activity> subtree: alive but dormant, rendered faded
  dim: boolean;
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

// --- View filtering ---------------------------------------------------------
// Which species of row the view hides (tree-sitter's named-vs-anonymous
// idea). The full InputNode tree stays the single source of truth; a hidden
// species is spliced out at compose time, children promoted, so switching a
// view never re-extracts and user state (collapse/fold/selection ids)
// survives untouched. One caveat accepted: a collapse keyed on a node the
// view hides disappears with it — the badge was on the hidden row.
export interface ViewFlags {
  // host rows (dom: true): the markup drops out, components remain
  hideDom: boolean;
  // Fragment/StrictMode/Profiler rows: React's own machinery drops out
  hideStructural: boolean;
}

// --- Hooks strip ----------------------------------------------------------
// The component's primitive hooks in call order, one small glyph per call,
// shape per category. While on it subsumes the stacked state dots (the
// state-category glyphs are the same pink, now in sequence with the rest).
// Click a strip to spread it with 45-degree labels, one row at a time;
// labels overlay neighboring rows, so they draw last with a halo.
// Parent tree only.
export type HooksMode = "off" | "trailing" | "column";

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
  // Initial display filter; everything visible by default. Mutable per
  // instance via setView — an option only so figures can open filtered.
  view?: Partial<ViewFlags>;
}

export interface TreeRenderer {
  // rendered: ids of nodes that performed work since the previous
  // snapshot (the live producer's third callback argument). Rows in the
  // set get a one-shot sub-salient blink — Observable-minimap style
  // ambient liveness. Per-call, not instance state: the caller decides
  // which renders replay it (a commit should, a toggle re-render
  // shouldn't — consume the set once).
  parentTreeSvg(roots: InputNode[], rendered?: ReadonlySet<string>): string;
  ownerTreeSvg(roots: InputNode[], rendered?: ReadonlySet<string>): string;
  toggleContext(id: string): void;
  setContextActive(id: string, on: boolean): void;
  toggleBoundary(id: string): void;
  setBoundaryActive(id: string, on: boolean): void;
  toggleMemo(id: string): void;
  setMemoActive(id: string, on: boolean): void;
  toggleFold(id: string): void;
  toggleSelect(id: string): void;
  clearSelect(): boolean;
  // The current selection, so consumers can sync selection-coupled
  // surfaces (the page highlight) after any render without tracking
  // toggle semantics themselves.
  selectedId(): string | null;
  toggleCollapse(id: string): void;
  toggleHooks(id: string): void;
  setHooksMode(mode: HooksMode): void;
  setArcStyle(style: ArcStyle): void;
  setMarks(partial: Partial<MarkFlags>): void;
  setView(partial: Partial<ViewFlags>): void;
}

// RendererOptions with every default applied.
export interface ResolvedOptions {
  serverColor: string;
  sizing: "content" | "fixed";
  select: boolean;
  sourceNav: boolean;
  collapse: boolean;
  hooks: boolean;
  serverRegions: boolean;
  contextName: (id: string) => string | undefined;
}

// The persistent context-color assignment, owned by the renderer instance so
// a named context keeps its color across renders and across both trees.
// assign() is the explicit pre-pass (row order); color() is a pure lookup
// thereafter (it lazily assigns on a miss so hand-fed ids stay safe).
export interface ContextColorRegistry {
  assign(rows: Row[]): void;
  color(id: string): string;
}

// --- RenderState ------------------------------------------------------------
// The live readonly view over a renderer instance's interactive state. The
// factory owns the mutable sets and primitives; the pure passes receive this
// view and may not (and cannot, by type) write through it. Purity of the
// passes is purity given this value.
export interface RenderState {
  readonly opt: ResolvedOptions;
  readonly colors: ContextColorRegistry;
  readonly marks: MarkFlags;
  readonly selectedId: string | null;
  readonly activeContexts: ReadonlySet<string>;
  readonly activeBoundaries: ReadonlySet<string>;
  readonly activeMemos: ReadonlySet<string>;
  readonly unfoldedRuns: ReadonlySet<string>;
  readonly collapsedIds: ReadonlySet<string>;
  readonly arcStyle: ArcStyle;
  readonly hooksMode: HooksMode;
  readonly expandedHooksId: string | null;
  readonly view: ViewFlags;
}

// Per-composition derived values, built once by composeTree after the canvas
// width is known and passed alongside RenderState — never stored.
export interface ComposeCtx {
  readonly stripsInTree: boolean;
  readonly hooksColX: number;
  // Rows that performed work since the previous snapshot; null when the
  // caller passed nothing (figures, interaction re-renders).
  readonly rendered: ReadonlySet<string> | null;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
