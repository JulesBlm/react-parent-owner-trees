// Behavioral tests of the renderer: liveness halos, the props reveal and
// its placement fallbacks, and render stability across toggles.
import { describe, expect, test } from "vitest";
import { createTreeRenderer } from "../src/lib/core";
import { basic, foldedList, node } from "./fixtures";
import type { InputNode } from "../src/lib/core";

// Eight props on an adjacent-row arc (the shortest bow the grid makes):
// the radial fan can't keep its pitch and must fall back to the
// under-row stack.
const manyPropped: InputNode[] = [
  node("App", "1", {}, [
    node("Child", "2", {
      owner: "1",
      props: ["count", "dark", "locale", "onSelect", "onHover", "items", "renderRow", "variant"],
    }),
  ]),
];

describe("renderer behavior", () => {
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

  // Selection doubles as the props reveal: spokes on the selected row's
  // owner arc in the parent tree (rotated labels), the under-row stack
  // in the owner tree, where the owner edge is structure and there is no
  // arc to hang them on.
  test("selecting a row reveals its props: spokes in the parent tree, under-row in the owner tree", () => {
    const r = createTreeRenderer({ props: true });
    r.toggleSelect("3");
    const parent = r.parentTreeSvg(basic);
    const owner = r.ownerTreeSvg(basic);
    expect(parent).toContain(">count</text>");
    expect(parent).toContain(">dark</text>");
    expect(parent).toContain("rotate(");
    expect(owner).toContain(">count</text>");
    expect(owner).toContain(">dark</text>");
    expect(owner).not.toContain("rotate(");
    r.clearSelect();
    expect(r.parentTreeSvg(basic)).not.toContain(">count</text>");
  });

  // Eight props on an adjacent-row bow: the fan can't keep its 14px
  // pitch, so the radial placement itself falls back to the under-row
  // stack.
  test("crowded bow: radial falls back to the under-row stack", () => {
    const r = createTreeRenderer({ props: true });
    r.toggleSelect("2");
    const svg = r.parentTreeSvg(manyPropped);
    expect(svg).not.toContain("rotate(");
    expect(svg).toContain(">count</text>");
    expect(svg).toContain(">+3 more</text>");
  });

  // Placement is live instance state, not construction-time config: the
  // tool's dropdown flips an existing renderer between the two forms, and
  // flipping back restores the original markup exactly.
  test("setPropsPlacement flips the reveal between spokes and the under-row stack", () => {
    const r = createTreeRenderer({ props: true });
    r.toggleSelect("3");
    const radial = r.parentTreeSvg(basic);
    expect(radial).toContain("rotate(");
    r.setPropsPlacement("under");
    const under = r.parentTreeSvg(basic);
    expect(under).not.toContain("rotate(");
    expect(under).toContain(">count</text>");
    r.setPropsPlacement("radial");
    expect(r.parentTreeSvg(basic)).toBe(radial);
  });

  test("props feature off: selection reveals nothing", () => {
    const r = createTreeRenderer();
    r.toggleSelect("3");
    expect(r.parentTreeSvg(basic)).not.toContain(">count</text>");
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
