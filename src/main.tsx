// extract must come first: bippy installs the DevTools hook on import, before
// react-dom evaluates.
import { contextName, getNodeSource, startExtraction } from "./lib/extract";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoApp } from "./demo/DemoApp";
import {
  createTreeRenderer,
  type ArcStyle,
  type HooksMode,
  type InputNode,
} from "./lib/core";

const renderer = createTreeRenderer({
  serverColor: "#d9822b",
  sizing: "fixed",
  sourceNav: true,
  collapse: true,
  hooks: true,
  serverRegions: true,
  contextName,
});

const parentEl = document.getElementById("parent-tree")!;
const ownerEl = document.getElementById("owner-tree")!;

let latestRoots: InputNode[] = [];

function render() {
  parentEl.innerHTML = renderer.parentTreeSvg(latestRoots);
  ownerEl.innerHTML = renderer.ownerTreeSvg(latestRoots);
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
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && renderer.clearSelect()) render();
});

document.getElementById("arc-style")!.addEventListener("change", (event) => {
  renderer.setArcStyle((event.target as HTMLSelectElement).value as ArcStyle);
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

startExtraction((roots) => {
  latestRoots = roots;
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
