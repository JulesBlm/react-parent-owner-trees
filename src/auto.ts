// Standalone build: attach the trees panel to any dev-mode React app via a
// classic <script> tag (must load before the app bundle so bippy's hook is
// installed before react-dom evaluates; classic scripts run during parse,
// module scripts are deferred, so any position in <head> works).
import {
  contextName,
  createPageHighlighter,
  getNodeHostElements,
  startExtraction,
} from "./lib/extract";
import {
  createTreeRenderer,
  scopeToSubtree,
  type ArcStyle,
  type InputNode,
} from "./lib/core";

const renderer = createTreeRenderer({
  sizing: "fixed",
  hooks: true,
  serverRegions: true,
  contextName,
});

// Scope to the RSC program the app author wrote: server components plus
// everything they transitively own. The framework's own wrapper components
// (routers, boundaries, segment bookkeeping) belong to a different program
// and drop out; kept rows hoist to their nearest kept ancestor. No-op when
// the page has no server rows at all.
function appOnly(nodes: InputNode[]): InputNode[] {
  const flat: InputNode[] = [];
  (function walk(list: InputNode[]): void {
    for (const node of list) {
      flat.push(node);
      walk(node.children ?? []);
    }
  })(nodes);

  const kept = new Set<string>();
  for (const node of flat) if (node.server) kept.add(node.id);
  if (kept.size === 0) return nodes;
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of flat) {
      if (!kept.has(node.id) && node.owner && kept.has(node.owner)) {
        kept.add(node.id);
        grew = true;
      }
    }
  }

  function prune(list: InputNode[]): InputNode[] {
    const out: InputNode[] = [];
    for (const node of list) {
      const kids = prune(node.children ?? []);
      if (kept.has(node.id)) {
        out.push({ ...node, children: kids.length > 0 ? kids : undefined });
      } else {
        out.push(...kids);
      }
    }
    return out;
  }
  return prune(nodes);
}

// DOM fibers stripped, their component children hoisted to the nearest
// composite ancestor. Owner refs stay valid: owners are always composites.
function stripDom(nodes: InputNode[]): InputNode[] {
  const out: InputNode[] = [];
  for (const node of nodes) {
    const kids = stripDom(node.children ?? []);
    if (node.dom) {
      out.push(...kids);
    } else {
      out.push({ ...node, children: kids.length > 0 ? kids : undefined });
    }
  }
  return out;
}

function createPanel() {
  const panel = document.createElement("aside");
  panel.id = "react-parent-owner-trees-panel";
  panel.style.cssText = [
    "--color-bg:#fdfdfd",
    "--color-text:#1a1a1a",
    "--color-text-light:#4a4a4a",
    "--color-text-lighter:#8a8a8a",
    "position:fixed",
    "top:0",
    "right:0",
    "bottom:0",
    "width:min(880px,70vw)",
    "z-index:2147483646",
    "background:var(--color-bg)",
    "color:var(--color-text)",
    "border-left:1px solid #e5e5e5",
    "box-shadow:-4px 0 16px rgba(0,0,0,0.06)",
    "font-family:monospace",
    "font-size:13px",
    "overflow:auto",
    "padding:12px 16px",
  ].join(";");

  panel.innerHTML = `
    <div style="display:flex;gap:16px;align-items:center;font-family:system-ui,sans-serif;font-size:12px;color:var(--color-text-lighter);position:sticky;top:0;left:0;background:var(--color-bg);padding-block:4px">
      <strong style="color:var(--color-text-light)">react-parent-owner-trees</strong>
      <label style="display:flex;gap:4px;align-items:center;cursor:pointer">
        <input type="checkbox" id="rt-show-dom" /> DOM nodes
      </label>
      <label style="display:flex;gap:4px;align-items:center;cursor:pointer">
        <input type="checkbox" id="rt-show-arcs" checked /> owner arcs
      </label>
      <label style="display:flex;gap:4px;align-items:center;cursor:pointer">
        <input type="checkbox" id="rt-app-only" checked /> app only
      </label>
      <select id="rt-arc-style" style="cursor:pointer">
        <option value="arc">arc</option>
        <option value="stadium">stadium</option>
        <option value="bracket">bracket</option>
        <option value="square">square</option>
      </select>
      <span id="rt-scope" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
      <button id="rt-hide" style="margin-left:auto;cursor:pointer">hide</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
      <div><h4 style="font-family:system-ui,sans-serif;font-weight:500;color:var(--color-text-lighter);margin:8px 0">Parent tree</h4><div id="rt-parent"></div></div>
      <div><h4 style="font-family:system-ui,sans-serif;font-weight:500;color:var(--color-text-lighter);margin:8px 0">Owner tree</h4><div id="rt-owner"></div></div>
    </div>`;

  const badge = document.createElement("button");
  badge.textContent = "trees";
  badge.style.cssText =
    "position:fixed;bottom:12px;right:12px;z-index:2147483646;display:none;cursor:pointer;font-family:monospace";

  badge.addEventListener("click", () => {
    panel.style.display = "block";
    badge.style.display = "none";
  });

  const attach = () => {
    document.body.append(panel, badge);
    panel.querySelector("#rt-hide")!.addEventListener("click", () => {
      panel.style.display = "none";
      badge.style.display = "block";
    });
  };
  if (document.body) attach();
  else document.addEventListener("DOMContentLoaded", attach);

  return panel;
}

const panel = createPanel();
const highlighter = createPageHighlighter();
let latestRoots: InputNode[] = [];
// Subtree scope: a view over latestRoots, reapplied per commit and applied
// before the species views (app only, DOM) so those filter the scoped
// region. The full tree stays the source of truth, so the breadcrumb knows
// the true ancestry even while the diagram shows one subtree.
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
// commit-triggered renders only, never on a checkbox toggle re-render.
let justRendered: ReadonlySet<string> | undefined;

function render() {
  const showDom = (
    panel.querySelector("#rt-show-dom") as HTMLInputElement | null
  )?.checked;
  const appScoped = (
    panel.querySelector("#rt-app-only") as HTMLInputElement | null
  )?.checked;
  let roots = latestRoots;
  if (scopedId) {
    const scopedView = scopeToSubtree(roots, scopedId);
    // Identity means the id is gone (unmounted): the diagram has already
    // dissolved to the full tree — drop the stale scope so the breadcrumb
    // stays honest with it.
    if (scopedView === roots) scopedId = null;
    else roots = scopedView;
  }
  if (appScoped) roots = appOnly(roots);
  if (!showDom) roots = stripDom(roots);
  const blink = justRendered;
  justRendered = undefined;
  panel.querySelector("#rt-parent")!.innerHTML = renderer.parentTreeSvg(
    roots,
    blink,
  );
  panel.querySelector("#rt-owner")!.innerHTML = renderer.ownerTreeSvg(
    roots,
    blink,
  );
  panel.querySelector("#rt-scope")!.innerHTML = scopeUi();
  // The page highlight follows the selection, re-resolved on every render:
  // commits can remount the elements behind a selected row, and the fresh
  // lookup keeps the outline on what exists now.
  const selected = renderer.selectedId();
  highlighter.highlight(selected ? getNodeHostElements(selected) : []);
}

panel.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "rt-arc-style")
    renderer.setArcStyle(target.value as ArcStyle);
  if (target.id === "rt-show-arcs")
    renderer.setMarks({ arcs: target.checked });
  if (
    target.id === "rt-show-dom" ||
    target.id === "rt-app-only" ||
    target.id === "rt-arc-style" ||
    target.id === "rt-show-arcs"
  )
    render();
});

panel.addEventListener("click", (event) => {
  const target = event.target as Element;
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
  const select = target.closest?.("[data-select-toggle]");
  if (fold) renderer.toggleFold(fold.getAttribute("data-fold-toggle")!);
  if (context)
    renderer.toggleContext(context.getAttribute("data-context-toggle")!);
  if (boundary)
    renderer.toggleBoundary(boundary.getAttribute("data-boundary-toggle")!);
  if (memoRing) renderer.toggleMemo(memoRing.getAttribute("data-memo-toggle")!);
  if (select && !fold && !context && !boundary && !memoRing)
    renderer.toggleSelect(select.getAttribute("data-select-toggle")!);
  if (fold || context || boundary || memoRing || select) render();
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

startExtraction((roots, _diff, rendered) => {
  latestRoots = roots;
  justRendered = rendered;
  render();
});
