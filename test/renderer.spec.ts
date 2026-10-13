// Characterization snapshots of the renderer, taken against the pre-carve
// core.ts. The carve must keep every snapshot byte-identical: the output
// string IS the behavior.
//
// Context scenarios activate providers in row order on purpose — color slots
// are assigned on first paint, and row order is the one order the pre-carve
// and post-carve assignment agree on by construction.
import { describe, expect, test } from "vitest";
import {
  createTreeRenderer,
  type RendererOptions,
  type TreeRenderer,
} from "../src/lib/core";
import {
  basic,
  contextNames,
  contextTree,
  deepTree,
  errorTree,
  foldedList,
  memoHooksTree,
  miscTree,
  serverTree,
  suspenseTree,
} from "./fixtures";
import type { InputNode } from "../src/lib/core";

interface Scenario {
  name: string;
  roots: InputNode[];
  options?: RendererOptions;
  setup?: (r: TreeRenderer) => void;
}

const scenarios: Scenario[] = [
  { name: "basic", roots: basic },
  {
    name: "basic fixed sizing, no select, sourceNav",
    roots: basic,
    options: { sizing: "fixed", select: false, sourceNav: true },
  },
  {
    name: "basic marks off",
    roots: basic,
    setup: (r) =>
      r.setMarks({ arcs: false, ids: false, state: false, memo: false, markers: false }),
  },
  { name: "basic nudge", roots: basic, setup: (r) => r.setMarks({ nudge: true }) },
  { name: "folded", roots: foldedList },
  { name: "folded unfolded", roots: foldedList, setup: (r) => r.toggleFold("i1") },
  {
    name: "folded collapse ul",
    roots: foldedList,
    options: { collapse: true },
    setup: (r) => r.toggleCollapse("l1"),
  },
  { name: "server regions", roots: serverTree, options: { serverRegions: true } },
  {
    name: "server custom color",
    roots: serverTree,
    options: { serverRegions: true, serverColor: "rebeccapurple" },
  },
  {
    name: "context resting",
    roots: contextTree,
    options: { contextName: (id) => contextNames[id] },
  },
  {
    name: "context first area on",
    roots: contextTree,
    options: { contextName: (id) => contextNames[id] },
    setup: (r) => r.toggleContext("ctxA"),
  },
  {
    name: "context both areas on",
    roots: contextTree,
    options: { contextName: (id) => contextNames[id] },
    setup: (r) => {
      r.toggleContext("ctxA");
      r.toggleContext("ctxB");
    },
  },
  { name: "suspense resting", roots: suspenseTree },
  {
    name: "suspense outer area on (fallback card)",
    roots: suspenseTree,
    setup: (r) => r.toggleBoundary("b2"),
  },
  {
    name: "suspense suspended area on",
    roots: suspenseTree,
    setup: (r) => r.toggleBoundary("b6"),
  },
  { name: "error caught area on", roots: errorTree, setup: (r) => r.toggleBoundary("e1") },
  { name: "misc resting", roots: miscTree },
  {
    name: "misc profiler + activity + vt areas on",
    roots: miscTree,
    setup: (r) => {
      r.toggleBoundary("m3");
      r.toggleBoundary("m6");
      r.toggleBoundary("m9");
    },
  },
  { name: "memo hooks dots (hooks option off)", roots: memoHooksTree },
  {
    name: "memo open",
    roots: memoHooksTree,
    setup: (r) => r.toggleMemo("h2"),
  },
  { name: "hooks trailing", roots: memoHooksTree, options: { hooks: true } },
  {
    name: "hooks column",
    roots: memoHooksTree,
    options: { hooks: true },
    setup: (r) => r.setHooksMode("column"),
  },
  {
    name: "hooks off mode",
    roots: memoHooksTree,
    options: { hooks: true },
    setup: (r) => r.setHooksMode("off"),
  },
  {
    name: "hooks expanded",
    roots: memoHooksTree,
    options: { hooks: true },
    setup: (r) => r.toggleHooks("h3"),
  },
  { name: "selection mid-chain", roots: deepTree, setup: (r) => r.toggleSelect("t5") },
  {
    name: "selection cleared",
    roots: deepTree,
    setup: (r) => {
      r.toggleSelect("t5");
      r.clearSelect();
    },
  },
  { name: "arcs stadium", roots: deepTree, setup: (r) => r.setArcStyle("stadium") },
  { name: "arcs bracket", roots: deepTree, setup: (r) => r.setArcStyle("bracket") },
  { name: "arcs square", roots: deepTree, setup: (r) => r.setArcStyle("square") },
];

describe("renderer characterization", () => {
  for (const s of scenarios) {
    test(`${s.name} — parent tree`, () => {
      const r = createTreeRenderer(s.options);
      s.setup?.(r);
      expect(r.parentTreeSvg(s.roots)).toMatchSnapshot();
    });
    test(`${s.name} — owner tree`, () => {
      const r = createTreeRenderer(s.options);
      s.setup?.(r);
      expect(r.ownerTreeSvg(s.roots)).toMatchSnapshot();
    });
  }

  // The blink (ambient per-commit liveness) is per-call data, never
  // instance state: passing a rendered set adds exactly the halo markup
  // on those rows, and the next call without one is byte-identical to a
  // call that never blinked.
  test("rendered set draws a one-shot halo, then leaves no trace", () => {
    const r = createTreeRenderer();
    const plain = r.parentTreeSvg(basic);
    const blinked = r.parentTreeSvg(basic, new Set(["3"]));
    expect(blinked).not.toBe(plain);
    expect(blinked).toContain('<animate attributeName="opacity"');
    expect(plain).not.toContain("<animate");
    expect(r.parentTreeSvg(basic)).toBe(plain);
  });

  test("second render after toggles is stable", () => {
    const r = createTreeRenderer({ collapse: true });
    r.toggleCollapse("l1");
    const first = r.parentTreeSvg(foldedList);
    r.toggleCollapse("l1");
    r.toggleCollapse("l1");
    expect(r.parentTreeSvg(foldedList)).toBe(first);
  });
});
