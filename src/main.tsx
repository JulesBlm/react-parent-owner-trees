// extract must come first: bippy installs the DevTools hook on import, before
// react-dom evaluates.
import { getNodeSource, startExtraction } from "./extract";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoApp } from "./demo/DemoApp";
import {
  parentTreeSvg,
  ownerTreeSvg,
  toggleFold,
  toggleContext,
  toggleBoundary,
  toggleMemo,
  toggleSelect,
  clearSelect,
  setArcStyle,
  setMarks,
  setHooksMode,
  toggleCollapse,
  toggleHooks,
  type ArcStyle,
  type HooksMode,
} from "./render-trees";

const parentEl = document.getElementById("parent-tree")!;
const ownerEl = document.getElementById("owner-tree")!;

let latestRoots: Parameters<typeof parentTreeSvg>[0] = [];

function render() {
  parentEl.innerHTML = parentTreeSvg(latestRoots);
  ownerEl.innerHTML = ownerTreeSvg(latestRoots);
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
  const fold = target.closest?.("[data-fold-toggle]");
  const context = target.closest?.("[data-context-toggle]");
  const boundary = target.closest?.("[data-boundary-toggle]");
  const memoRing = target.closest?.("[data-memo-toggle]");
  const hooks = target.closest?.("[data-hooks-toggle]");
  const collapse = target.closest?.("[data-collapse-toggle]");
  const select = target.closest?.("[data-select-toggle]");
  if (fold) toggleFold(fold.getAttribute("data-fold-toggle")!);
  if (context) toggleContext(context.getAttribute("data-context-toggle")!);
  if (boundary) toggleBoundary(boundary.getAttribute("data-boundary-toggle")!);
  if (memoRing) toggleMemo(memoRing.getAttribute("data-memo-toggle")!);
  if (hooks) toggleHooks(hooks.getAttribute("data-hooks-toggle")!);
  if (collapse) toggleCollapse(collapse.getAttribute("data-collapse-toggle")!);
  if (select && !fold && !context && !boundary && !memoRing && !hooks && !collapse)
    toggleSelect(select.getAttribute("data-select-toggle")!);
  if (fold || context || boundary || memoRing || hooks || collapse || select)
    render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && clearSelect()) render();
});

document.getElementById("arc-style")!.addEventListener("change", (event) => {
  setArcStyle((event.target as HTMLSelectElement).value as ArcStyle);
  render();
});

document.getElementById("hooks-mode")!.addEventListener("change", (event) => {
  setHooksMode((event.target as HTMLSelectElement).value as HooksMode);
  render();
});

// The owner tree next door answers "who owns whom"; the arcs answer
// "where do the two trees diverge, in place". Default on, but on dense
// apps the clean parent tree is sometimes the better read.
document.getElementById("show-arcs")!.addEventListener("change", (event) => {
  setMarks({ arcs: (event.target as HTMLInputElement).checked });
  render();
});

startExtraction((roots) => {
  latestRoots = roots;
  render();
});

// Figure-export hook for the glossary post: stage marks from the console
// (or a driving script), then lift the SVG straight out of the DOM.
Object.assign(window, { __rt: { setMarks, render } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
);
