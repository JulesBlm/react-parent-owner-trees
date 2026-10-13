// Filtering as a view (tree-sitter's named-vs-anonymous idea): the full
// InputNode tree stays the single source of truth; applyView splices hidden
// species out, promoting their children, without re-extraction. Pinned here:
// the splice semantics themselves, and the pipeline consequences the design
// leans on instead of special cases — elbows reattach because promotion
// changes the tree (not the elbow code), arcs to hidden endpoints drop
// through the composer's byId guards (ADR-0007's tolerance), and wrappers
// dropping out creates new foldable runs because the view runs before
// foldRepeats.
import { describe, expect, test } from "vitest";
import {
  applyView,
  createTreeRenderer,
  hideDom,
  hideStructural,
  serializeTree,
} from "../src/lib/core";
import { basic, miscTree, node } from "./fixtures";

describe("applyView", () => {
  test("a hidden node is spliced out, children promoted into its place", () => {
    expect(serializeTree(applyView(basic, hideDom))).toBe(
      [
        "App #1",
        "  Stats #3 @1 props=count,dark",
        "  Post #5 @1 props=title",
        "  Post #6 @1",
      ].join("\n"),
    );
  });

  test("promoted children keep the hidden node's slot among its siblings", () => {
    const roots = [
      node("Root", "r", {}, [
        node("A", "a"),
        node("wrap", "w", { dom: true }, [node("X", "x"), node("Y", "y")]),
        node("B", "b"),
      ]),
    ];
    expect(serializeTree(applyView(roots, hideDom))).toBe(
      ["Root #r", "  A #a", "  X #x", "  Y #y", "  B #b"].join("\n"),
    );
  });

  test("a chain of hidden nodes promotes the deepest visible descendant", () => {
    const roots = [
      node("Root", "r", {}, [
        node("outer", "o", { dom: true }, [
          node("inner", "i", { dom: true }, [node("Leaf", "l")]),
        ]),
      ]),
    ];
    expect(serializeTree(applyView(roots, hideDom))).toBe(
      ["Root #r", "  Leaf #l"].join("\n"),
    );
  });

  test("a hidden root hands its children to the forest", () => {
    const roots = [
      node("wrap", "w", { dom: true }, [node("A", "a"), node("B", "b")]),
    ];
    expect(serializeTree(applyView(roots, hideDom))).toBe(
      ["A #a", "B #b"].join("\n"),
    );
  });

  test("hideStructural drops React's machinery, keeps what it wrapped", () => {
    expect(serializeTree(applyView(miscTree, hideStructural))).toBe(
      [
        "App #m1",
        "  Nav #m3c @m1",
        "  Portal #m4 portal →div#modal",
        "    Widget #m5 @m1 lazy",
        "  Activity #m6 activity hidden",
        "    HiddenPane #m7 @m1",
        "      span #m8 dom",
        "  ViewTransition #m9 viewTransition vt=card",
        "    Moved #m10 @m1",
      ].join("\n"),
    );
  });

  test("owner refs survive untouched on the visible rows", () => {
    const out = applyView(basic, hideDom);
    expect(out[0].children!.map((n) => n.owner)).toEqual(["1", "1", "1"]);
  });
});

describe("renderer views", () => {
  test("elbows reattach to the nearest visible ancestor by promotion", () => {
    const r = createTreeRenderer();
    r.setView({ hideDom: true });
    const svg = r.parentTreeSvg(basic);
    // App (0,0) now links straight to the promoted grandchildren at depth 1:
    // Stats y=25, Post y=50, Post y=75 — no special elbow code involved.
    expect(svg).toContain('"M0,0 V25 H25"');
    expect(svg).toContain('"M0,0 V50 H25"');
    expect(svg).toContain('"M0,0 V75 H25"');
    expect(svg).toContain("Stats");
    expect(svg).not.toContain("section");
  });

  test("an arc whose owner row the view hides is skipped, not drawn or thrown", () => {
    const roots = [
      node("App", "1", {}, [
        node("wrap", "w", { dom: true }, [node("Child", "c", { owner: "w" })]),
      ]),
    ];
    const r = createTreeRenderer();
    expect(r.parentTreeSvg(roots)).toContain('stroke-dasharray="2"');
    r.setView({ hideDom: true });
    const svg = r.parentTreeSvg(roots);
    expect(svg).not.toContain('stroke-dasharray="2"');
    expect(svg).toContain("Child");
    expect(() => r.ownerTreeSvg(roots)).not.toThrow();
  });

  test("in the owner tree a hidden owner's ownees promote to its owner", () => {
    const roots = [
      node("App", "1", {}, [
        node("wrap", "w", { dom: true, owner: "1" }, [
          node("Child", "c", { owner: "w" }),
        ]),
      ]),
    ];
    const r = createTreeRenderer();
    r.setView({ hideDom: true });
    const svg = r.ownerTreeSvg(roots);
    // App (0,0) to Child at depth 1 — wrap's row is gone from the owner
    // view, its owner-children handed to App.
    expect(svg).toContain('"M0,0 V25 H25"');
    expect(svg).toContain("Child");
  });

  test("hiding wrappers creates new runs that fold", () => {
    const roots = [
      node("Root", "r", {}, [
        node("Item", "i1", { owner: "r" }),
        node("Item", "i2", { owner: "r" }),
        node("div", "d1", { dom: true }, [node("Item", "i3", { owner: "r" })]),
        node("Item", "i4", { owner: "r" }),
      ]),
    ];
    const r = createTreeRenderer();
    // Split 2/1/1 by the wrapper, no run reaches minRun.
    expect(r.parentTreeSvg(roots)).not.toContain("×4");
    r.setView({ hideDom: true });
    // Adjacent after the splice: the view runs before foldRepeats.
    expect(r.parentTreeSvg(roots)).toContain("×4");
  });

  test("a collapse keyed on a hidden node disappears with its row", () => {
    const roots = [
      node("App", "1", {}, [
        node("wrap", "w", { dom: true }, [node("Child", "c")]),
      ]),
    ];
    const r = createTreeRenderer({ collapse: true });
    r.toggleCollapse("w");
    expect(r.parentTreeSvg(roots)).not.toContain("Child");
    // The view splices wrap out before pruneCollapsed runs, so the badge
    // (and the hiding it carried) goes with it; the subtree shows.
    r.setView({ hideDom: true });
    expect(r.parentTreeSvg(roots)).toContain("Child");
  });

  test("the default view is a true no-op: toggling off restores the exact string", () => {
    const r = createTreeRenderer();
    const resting = r.parentTreeSvg(basic);
    r.setView({ hideDom: true, hideStructural: true });
    r.parentTreeSvg(basic);
    r.setView({ hideDom: false, hideStructural: false });
    expect(r.parentTreeSvg(basic)).toBe(resting);
  });

  test("the view option seeds the initial filter", () => {
    const r = createTreeRenderer({ view: { hideDom: true } });
    const svg = r.parentTreeSvg(basic);
    expect(svg).not.toContain("section");
    expect(svg).toContain("Stats");
  });
});
