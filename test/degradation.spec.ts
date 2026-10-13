// The degradation contract (ADR-0007), pinned where it bites: a fiber that
// resists extraction costs exactly its own row — never a sibling, never a
// subtree, never the commit. Fibers here are hand-built plain objects fed
// through snapshotFiberTree, the same walk the live extraction runs; the
// hostile ones throw from a props proxy, the one failure shape we can
// manufacture without a React version from the future.
import { afterEach, describe, expect, test, vi } from "vitest";
import { snapshotFiberTree } from "../src/lib/extract";
import { createTreeRenderer, serializeTree } from "../src/lib/core";
import type { InputNode } from "../src/lib/core";

interface FakeFiber {
  tag: number;
  type: unknown;
  elementType: unknown;
  memoizedProps: unknown;
  memoizedState: unknown;
  child: FakeFiber | null;
  sibling: FakeFiber | null;
  return: FakeFiber | null;
  alternate: null;
}

function link(tag: number, type: unknown, props: unknown, children: FakeFiber[]): FakeFiber {
  const fiber: FakeFiber = {
    tag,
    type,
    elementType: type,
    memoizedProps: props,
    memoizedState: null,
    child: null,
    sibling: null,
    return: null,
    alternate: null,
  };
  let prev: FakeFiber | null = null;
  for (const c of children) {
    c.return = fiber;
    if (prev) prev.sibling = c;
    else fiber.child = c;
    prev = c;
  }
  return fiber;
}

function comp(name: string, props: object = {}, children: FakeFiber[] = []): FakeFiber {
  const fn = { [name]: () => null }[name];
  return link(0, fn, props, children);
}

function host(tag: string, props: object = {}, children: FakeFiber[] = []): FakeFiber {
  return link(5, tag, props, children);
}

// Throws the moment propNames runs Object.keys on it — extraction mid-row.
function hostileProps(): object {
  return new Proxy({}, {
    ownKeys() {
      throw new Error("hostile props");
    },
  });
}

const snapshot = (fiber: FakeFiber) =>
  snapshotFiberTree(fiber as unknown as Parameters<typeof snapshotFiberTree>[0]);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("snapshotFiberTree, healthy trees", () => {
  test("walks composite and host fibers into the corpus format", () => {
    const tree = comp("App", { title: 1 }, [
      host("div", { className: 1 }, [comp("Child")]),
    ]);
    const out = snapshot(tree);
    const [app] = out;
    const [div] = app.children!;
    const [child] = div.children!;
    expect(serializeTree(out)).toBe(
      [
        `App #${app.id} props=title`,
        `  div #${div.id} dom props=className`,
        `    Child #${child.id}`,
      ].join("\n"),
    );
  });
});

describe("extraction degradation (ADR-0007)", () => {
  test("a hostile fiber becomes one unknown row, subtree intact", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tree = comp("App", {}, [
      link(0, function Hostile() {}, hostileProps(), [comp("Child")]),
    ]);
    const out = snapshot(tree);
    const [app] = out;
    const [unknown] = app.children!;
    const [child] = unknown.children!;
    expect(serializeTree(out)).toBe(
      [
        `App #${app.id}`,
        `  #0 #${unknown.id} unknown`,
        `    Child #${child.id}`,
      ].join("\n"),
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("a hostile sibling costs nothing around it", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const tree = comp("App", {}, [
      comp("Before"),
      link(0, function Hostile() {}, hostileProps(), []),
      comp("After"),
    ]);
    const [app] = snapshot(tree);
    expect(app.children!.map((n) => n.name)).toEqual(["Before", "#0", "After"]);
    expect(app.children![1].unknown).toBe(true);
  });

  test("a deep hostile fiber stays local: ancestors keep their rows", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const tree = comp("App", {}, [
      comp("Section", {}, [
        link(0, function Hostile() {}, hostileProps(), [comp("Leaf")]),
      ]),
    ]);
    const [app] = snapshot(tree);
    const [section] = app.children!;
    expect(app.unknown).toBeUndefined();
    expect(section.unknown).toBeUndefined();
    expect(section.children![0].unknown).toBe(true);
    expect(section.children![0].children![0].name).toBe("Leaf");
  });

  test("hostile _debugInfo degrades the row; children collected exactly once", () => {
    // Throws from the server-chain read — AFTER the node's own fields — so
    // this pins that recovery never re-walks children (a re-walk through
    // the shared serverRows map appends them to discarded rows: a silently
    // dropped subtree, which ADR-0007 forbids).
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const hostile = comp("Shell", {}, [comp("Child")]);
    (hostile as { _debugInfo?: unknown })._debugInfo = [
      new Proxy({}, {
        get() {
          throw new Error("hostile debug info");
        },
      }),
    ];
    const tree = comp("App", {}, [hostile]);
    const [app] = snapshot(tree);
    const [unknown] = app.children!;
    expect(unknown.unknown).toBe(true);
    expect(unknown.children!.map((n) => n.name)).toEqual(["Child"]);
  });

  test("warns once per fiber, not per snapshot", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hostile = link(0, function Hostile() {}, hostileProps(), []);
    const tree = comp("App", {}, [hostile]);
    snapshot(tree);
    snapshot(tree);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("renderer tolerance", () => {
  test("an unknown row draws the quiet diamond, not a component circle", () => {
    const roots: InputNode[] = [{ name: "#31", id: "u1", unknown: true }];
    const svg = createTreeRenderer().parentTreeSvg(roots);
    expect(svg).toContain(`rotate(45)`);
    expect(svg).toContain("placeholder");
  });

  test("an owner ref pointing at a row that no longer exists is skipped", () => {
    const roots: InputNode[] = [
      { name: "App", id: "1", children: [{ name: "Child", id: "2", owner: "gone" }] },
    ];
    const r = createTreeRenderer();
    expect(() => r.parentTreeSvg(roots)).not.toThrow();
    expect(() => r.ownerTreeSvg(roots)).not.toThrow();
  });
});

describe("serializeTree", () => {
  test("flags, fold, owner, and detail fields in fixed order", () => {
    const roots: InputNode[] = [
      {
        name: "App",
        id: "1",
        hooks: ["useState", "useEffect"],
        props: ["title"],
        children: [
          { name: "Suspense", id: "2", owner: "1", suspense: true, suspended: true },
          { name: "Item", id: "3", owner: "1", fold: 12, memo: true },
          { name: "nav", id: "4", dom: true },
        ],
      },
    ];
    expect(serializeTree(roots)).toBe(
      [
        "App #1 hooks=useState,useEffect props=title",
        "  Suspense #2 @1 suspense suspended",
        "  Item ×12 #3 @1 memo",
        "  nav #4 dom",
      ].join("\n"),
    );
  });

  test("equal trees serialize byte-identical", () => {
    const tree = (): InputNode[] => [
      { name: "A", id: "1", children: [{ name: "B", id: "2", owner: "1" }] },
    ];
    expect(serializeTree(tree())).toBe(serializeTree(tree()));
  });
});
