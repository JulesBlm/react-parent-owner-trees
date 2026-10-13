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
//
// This factory is the only stateful module in core/: it owns the toggles
// and exposes them to the pure passes as RenderState — a live readonly
// view (the sets are shared by reference; reassigned primitives surface
// through getters).
import { createContextColorRegistry } from "./colors";
import { composeTree } from "./compose";
import { rebuildByOwner } from "./transform";
import type {
  ArcStyle,
  HooksMode,
  InputNode,
  MarkFlags,
  RendererOptions,
  RenderState,
  TreeRenderer,
  ViewFlags,
} from "./types";

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

  // --- Instance state ------------------------------------------------------
  const colors = createContextColorRegistry(opt.contextName);
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
  let view: ViewFlags = {
    hideDom: false,
    hideStructural: false,
    ...options.view,
  };

  const state: RenderState = {
    opt,
    colors,
    activeContexts,
    activeBoundaries,
    activeMemos,
    unfoldedRuns,
    collapsedIds,
    get marks() {
      return marks;
    },
    get selectedId() {
      return selectedId;
    },
    get arcStyle() {
      return arcStyle;
    },
    get hooksMode() {
      return hooksMode;
    },
    get expandedHooksId() {
      return expandedHooksId;
    },
    get view() {
      return view;
    },
  };

  return {
    // composeTree owns the input-tree pipeline (view → fold → prune →
    // strip); only the owner tree's re-nesting is per-tree. Re-nesting the
    // FULL tree before the pipeline means a hidden node's owner-children
    // promote to its nearest visible owner-ancestor, mirroring the parent
    // tree's promotion semantics.
    parentTreeSvg(roots: InputNode[], rendered?: ReadonlySet<string>): string {
      return composeTree(roots, true, state, rendered);
    },
    ownerTreeSvg(roots: InputNode[], rendered?: ReadonlySet<string>): string {
      return composeTree(rebuildByOwner(roots), false, state, rendered);
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
    selectedId(): string | null {
      return selectedId;
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
    setView(partial: Partial<ViewFlags>): void {
      view = { ...view, ...partial };
    },
  };
}
