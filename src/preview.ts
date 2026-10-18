// Live notation gallery at /preview.html: the test fixtures rendered by
// real renderer instances with every toggle wired, so a notation change can
// be poked at in the browser without a React app behind it. Each panel owns
// its renderer — toggles never bleed across panels — and the header's
// arc-style/arcs controls fan out to all of them.
import {
  createTreeRenderer,
  type ArcStyle,
  type InputNode,
  type RendererOptions,
  type TreeRenderer,
} from "./lib/core";
import {
  basic,
  contextNames,
  contextTree,
  deepTree,
  memoHooksTree,
  node,
} from "../test/fixtures";

interface Panel {
  title: string;
  roots: InputNode[];
  trees?: Array<"parent" | "owner">;
  options?: RendererOptions;
  setup?: (r: TreeRenderer) => void;
  // Placement-lab mode: several renderers over the SAME roots side by
  // side, one per option variant (each gets its own renderer + wiring,
  // all parent-tree). Overrides `trees`.
  variants?: Array<{ label: string; options: RendererOptions }>;
}

// Fixture variants for the props grammar: the shared fixtures stay pristine
// (the characterization specs own them), the gallery adds props where the
// reveal needs something to show.
const memoRoots = structuredClone(memoHooksTree);
memoRoots[0].children![0].props = ["value", "onChange", "variant"];

const deepRoots = structuredClone(deepTree);
(function stuff(n: InputNode): void {
  if (n.id === "t10")
    n.props = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
  n.children?.forEach(stuff);
})(deepRoots[0]);

const panels: Panel[] = [
  {
    title: "placements — Stats selected: spokes on the arc (default) vs stack under the row",
    roots: basic,
    setup: (r) => r.toggleSelect("3"),
    variants: [
      { label: "radial (spokes)", options: { props: true } },
      { label: "under the row", options: { props: true, propsPlacement: "under" } },
    ],
  },
  {
    title: "crowded bow — 8 props on an adjacent-row arc: the fan can't keep its pitch, radial falls back to the under-row stack",
    roots: [
      node("App", "x1", {}, [
        node("Child", "x2", {
          owner: "x1",
          props: ["count", "dark", "locale", "onSelect", "onHover", "items", "renderRow", "variant"],
        }),
      ]),
    ],
    setup: (r) => r.toggleSelect("x2"),
    variants: [{ label: "radial placement, auto-fallback", options: { props: true } }],
  },
  {
    title: "basic — parent and owner tree, Stats selected (no arcs in the owner tree: under-row fallback)",
    roots: basic,
    trees: ["parent", "owner"],
    options: { props: true },
    setup: (r) => r.toggleSelect("3"),
  },
  {
    title: "memo row — received props stack outside the gate, retained snapshot inside (click the ring)",
    roots: memoRoots,
    options: { props: true },
    setup: (r) => {
      r.toggleSelect("h2");
      r.toggleMemo("h2");
    },
  },
  {
    title: "deep spans — Leaf selected, large arc: spokes flip to the inside",
    roots: deepRoots,
    setup: (r) => r.toggleSelect("t10"),
    variants: [
      { label: "radial (spokes, inside)", options: { props: true } },
      { label: "under the row", options: { props: true, propsPlacement: "under" } },
    ],
  },
  {
    title: "contexts — providers, areas, delivery lines",
    roots: contextTree,
    options: { props: true, contextName: (id) => contextNames[id] },
  },
];

// One delegated handler per panel, mirroring the live tool's branching:
// every data-*-toggle acts, selection only when nothing else hit, and a
// click into empty canvas clears the selection.
function wire(container: HTMLElement, r: TreeRenderer, rerender: () => void): void {
  const toggles: Array<[string, (id: string) => void]> = [
    ["data-fold-toggle", r.toggleFold],
    ["data-context-toggle", r.toggleContext],
    ["data-boundary-toggle", r.toggleBoundary],
    ["data-memo-toggle", r.toggleMemo],
    ["data-collapse-toggle", r.toggleCollapse],
    ["data-hooks-toggle", r.toggleHooks],
  ];
  container.addEventListener("click", (event) => {
    const target = event.target as Element;
    let hit = false;
    for (const [attr, toggle] of toggles) {
      const el = target.closest?.(`[${attr}]`);
      if (el) {
        toggle(el.getAttribute(attr)!);
        hit = true;
      }
    }
    if (!hit) {
      const select = target.closest?.("[data-select-toggle]");
      if (select) {
        r.toggleSelect(select.getAttribute("data-select-toggle")!);
        hit = true;
      } else if (r.clearSelect()) hit = true;
    }
    if (hit) rerender();
  });
}

const gallery = document.getElementById("gallery")!;
const rerenders: Array<() => void> = [];
const renderers: TreeRenderer[] = [];

for (const p of panels) {
  const section = document.createElement("section");
  const h3 = document.createElement("h3");
  h3.textContent = p.title;
  const trees = document.createElement("div");
  trees.className = "trees";
  section.append(h3, trees);
  gallery.append(section);

  if (p.variants) {
    // One renderer per variant over the same roots, each independently
    // wired so clicking around one treatment doesn't move the others.
    for (const v of p.variants) {
      const renderer = createTreeRenderer(v.options);
      p.setup?.(renderer);
      renderers.push(renderer);
      const slot = document.createElement("div");
      const label = document.createElement("h3");
      label.textContent = v.label;
      const svgHost = document.createElement("div");
      slot.append(label, svgHost);
      trees.append(slot);
      const rerender = () => {
        svgHost.innerHTML = renderer.parentTreeSvg(p.roots);
      };
      wire(slot, renderer, rerender);
      rerenders.push(rerender);
      rerender();
    }
    continue;
  }

  const renderer = createTreeRenderer(p.options);
  p.setup?.(renderer);
  renderers.push(renderer);

  const kinds = p.trees ?? ["parent"];
  const slots = kinds.map(() => document.createElement("div"));
  trees.append(...slots);

  const rerender = () => {
    kinds.forEach((kind, i) => {
      slots[i].innerHTML =
        kind === "parent"
          ? renderer.parentTreeSvg(p.roots)
          : renderer.ownerTreeSvg(p.roots);
    });
  };
  wire(trees, renderer, rerender);
  rerenders.push(rerender);
  rerender();
}

const renderAll = () => rerenders.forEach((fn) => fn());

document.getElementById("arc-style")!.addEventListener("change", (event) => {
  const style = (event.target as HTMLSelectElement).value as ArcStyle;
  renderers.forEach((r) => r.setArcStyle(style));
  renderAll();
});

document.getElementById("show-arcs")!.addEventListener("change", (event) => {
  const on = (event.target as HTMLInputElement).checked;
  renderers.forEach((r) => r.setMarks({ arcs: on }));
  renderAll();
});

// Esc clears every panel's selection, like the tool.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  let any = false;
  for (const r of renderers) if (r.clearSelect()) any = true;
  if (any) renderAll();
});

// keep the unused-import linters honest: `node` is re-exported for quick
// console experiments on this page.
Object.assign(window, { __preview: { node, renderers, renderAll } });
