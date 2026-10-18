// extract must come first: bippy installs the DevTools hook on import, before
// react-dom evaluates.
import {
  contextName,
  createPageHighlighter,
  getNodeHostElements,
  getNodeSource,
  startExtraction,
} from "./lib/extract";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoApp } from "./demo/DemoApp";
import {
  createTreeRenderer,
  scopeToSubtree,
  type ArcStyle,
  type HooksMode,
  type InputNode,
  type PropsPlacement,
} from "./lib/core";

// The hooks strip is alpha notation: off unless opted into via
// localStorage "rpot-alpha-hooks" = "1" (same flag the standalone build
// reads). The hooks-mode select hides with it.
const alphaHooks = localStorage.getItem("rpot-alpha-hooks") === "1";

const renderer = createTreeRenderer({
  sizing: "fixed",
  sourceNav: true,
  collapse: true,
  props: true,
  hooks: alphaHooks,
  serverRegions: true,
  contextName,
});

if (!alphaHooks)
  (document.getElementById("hooks-ui") as HTMLElement).style.display = "none";

const parentEl = document.getElementById("parent-tree")!;
const ownerEl = document.getElementById("owner-tree")!;
const scopeEl = document.getElementById("scope-ui")!;

let latestRoots: InputNode[] = [];
// Subtree scope: a view over latestRoots, reapplied per commit. The full
// tree stays the source of truth, so the breadcrumb always knows the true
// ancestry even while the diagram shows one subtree.
let scopedId: string | null = null;

function pathTo(nodes: InputNode[], id: string): InputNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const rest = node.children && pathTo(node.children, id);
    if (rest) return [node, ...rest];
  }
  return null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

const CRUMB_BTN =
  "cursor:pointer;background:none;border:none;padding:0;font:inherit;color:inherit;text-decoration:underline";

// Selection grows the scope affordance; a scope swaps it for the exit: a
// breadcrumb of true ancestors (last three, from the full tree), each
// re-scoping there, with "whole app" / ✕ clearing. Quiet text — the scope
// is ambient context, not a mark competing with the diagram.
function scopeUi(): string {
  if (scopedId) {
    const path = pathTo(latestRoots, scopedId);
    if (!path) return "";
    const crumbs = path.slice(0, -1).slice(-3);
    const elided = path.length - 1 > crumbs.length ? " › …" : "";
    return (
      [
        `<button data-scope-clear style="${CRUMB_BTN}">whole app</button>${elided}`,
        ...crumbs.map(
          (n) =>
            `<button data-scope-to="${n.id}" style="${CRUMB_BTN}">${esc(n.name)}</button>`,
        ),
        `<span>⟨${esc(path[path.length - 1].name)}⟩</span>`,
      ].join(" › ") +
      ` <button data-scope-clear style="${CRUMB_BTN};text-decoration:none">✕</button>`
    );
  }
  const selected = renderer.selectedId();
  const path = selected && pathTo(latestRoots, selected);
  if (!path) return "";
  return `<button data-scope-to="${selected}" style="${CRUMB_BTN}">▸ scope to ${esc(path[path.length - 1].name)}</button>`;
}
// Consumed by the next render() and then dropped: the blink replays on
// commit-triggered renders only, never on an interaction re-render.
let justRendered: ReadonlySet<string> | undefined;

// The page highlight follows the selection, re-resolved on every render:
// commits can remount the elements behind a selected row, and the fresh
// lookup keeps the outline on what exists now.
const highlighter = createPageHighlighter();

function render() {
  let view = latestRoots;
  if (scopedId) {
    const scopedView = scopeToSubtree(latestRoots, scopedId);
    // Identity means the id is gone (unmounted): the diagram has already
    // dissolved to the full tree — drop the stale scope so the breadcrumb
    // stays honest with it.
    if (scopedView === latestRoots) scopedId = null;
    else view = scopedView;
  }
  const blink = justRendered;
  justRendered = undefined;
  parentEl.innerHTML = renderer.parentTreeSvg(view, blink);
  ownerEl.innerHTML = renderer.ownerTreeSvg(view, blink);
  scopeEl.innerHTML = scopeUi();
  const selected = renderer.selectedId();
  highlighter.highlight(selected ? getNodeHostElements(selected) : []);
}

document.getElementById("panel")!.addEventListener("click", (event) => {
  const target = event.target as Element;
  // Cmd-click (ctrl on non-mac) opens the row's creation site in the
  // editor: the JSX line in the owner's render that made this element.
  // Matched on the row's root group so it works on every row, including
  // ones whose name is a context/boundary/memo toggle; cmd suppresses
  // those toggles entirely.
  const navigate = target.closest?.("[data-node]");
  if ((event.metaKey || event.ctrlKey) && navigate) {
    void getNodeSource(navigate.getAttribute("data-node")!).then(
      (source) => {
        if (source)
          void fetch(`/__open-in-editor?file=${encodeURIComponent(source)}`);
      },
    );
    return;
  }
  // Scoping is a deliberate second step after selection, so entering a
  // scope consumes the selection that offered it.
  const scopeTo = target.closest?.("[data-scope-to]");
  const scopeClear = target.closest?.("[data-scope-clear]");
  if (scopeTo) {
    scopedId = scopeTo.getAttribute("data-scope-to");
    renderer.clearSelect();
    render();
    return;
  }
  if (scopeClear) {
    scopedId = null;
    render();
    return;
  }
  const fold = target.closest?.("[data-fold-toggle]");
  const context = target.closest?.("[data-context-toggle]");
  const boundary = target.closest?.("[data-boundary-toggle]");
  const memoRing = target.closest?.("[data-memo-toggle]");
  const hooks = target.closest?.("[data-hooks-toggle]");
  const collapse = target.closest?.("[data-collapse-toggle]");
  const select = target.closest?.("[data-select-toggle]");
  if (fold) renderer.toggleFold(fold.getAttribute("data-fold-toggle")!);
  if (context)
    renderer.toggleContext(context.getAttribute("data-context-toggle")!);
  if (boundary)
    renderer.toggleBoundary(boundary.getAttribute("data-boundary-toggle")!);
  if (memoRing) renderer.toggleMemo(memoRing.getAttribute("data-memo-toggle")!);
  if (hooks) renderer.toggleHooks(hooks.getAttribute("data-hooks-toggle")!);
  if (collapse)
    renderer.toggleCollapse(collapse.getAttribute("data-collapse-toggle")!);
  if (select && !fold && !context && !boundary && !memoRing && !hooks && !collapse)
    renderer.toggleSelect(select.getAttribute("data-select-toggle")!);
  if (fold || context || boundary || memoRing || hooks || collapse || select)
    render();
  // Click-away: a click that hit no toggle clears the selection (and with
  // it the page highlight) — the third exit alongside Esc and re-click.
  // Form controls are exempt: adjusting a dropdown is not a statement
  // about the selection.
  else if (
    !target.closest?.("select, input, button, label") &&
    renderer.clearSelect()
  )
    render();
});

// Two-stage Escape: first press clears the selection, second the scope —
// two presses walk all the way out of any nested view.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (renderer.clearSelect()) render();
  else if (scopedId) {
    scopedId = null;
    render();
  }
});

document.getElementById("arc-style")!.addEventListener("change", (event) => {
  renderer.setArcStyle((event.target as HTMLSelectElement).value as ArcStyle);
  render();
});

document
  .getElementById("props-placement")!
  .addEventListener("change", (event) => {
    renderer.setPropsPlacement(
      (event.target as HTMLSelectElement).value as PropsPlacement,
    );
    render();
  });

document.getElementById("hooks-mode")!.addEventListener("change", (event) => {
  renderer.setHooksMode((event.target as HTMLSelectElement).value as HooksMode);
  render();
});

// The owner tree next door answers "who owns whom"; the arcs answer
// "where do the two trees diverge, in place". Default on, but on dense
// apps the clean parent tree is sometimes the better read.
document.getElementById("show-arcs")!.addEventListener("change", (event) => {
  renderer.setMarks({ arcs: (event.target as HTMLInputElement).checked });
  render();
});

startExtraction((roots, _diff, rendered) => {
  latestRoots = roots;
  justRendered = rendered;
  render();
});

// Figure-export hook for the glossary post: stage marks from the console
// (or a driving script), then lift the SVG straight out of the DOM.
Object.assign(window, {
  __rt: { setMarks: renderer.setMarks, renderer, render },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
);
