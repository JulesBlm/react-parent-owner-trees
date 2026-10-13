// Commit-as-edit: diffSnapshots is the contract that successive snapshots
// are comparable per id, so these pin the four axes (added/removed/changed/
// moved) and the comparison rules — arrays element-wise, renderer-internal
// fields invisible, position changes on their own axis. The extract.ts
// wiring is untested here (needs live fibers); the pure function carries
// the whole semantics.
import { describe, expect, test } from "vitest";
import { diffSnapshots } from "../src/lib/core";
import { node } from "./fixtures";

const empty = { added: new Set(), removed: new Set(), changed: new Set(), moved: new Set() };

describe("diffSnapshots", () => {
  test("identical snapshots produce an empty diff", () => {
    const make = () => [
      node("App", "1", { props: ["title"] }, [
        node("Child", "2", { owner: "1", hooks: ["useState"] }),
      ]),
    ];
    expect(diffSnapshots(make(), make())).toEqual(empty);
  });

  test("first commit: empty prev marks everything added, nothing else", () => {
    const next = [node("App", "1", {}, [node("Child", "2")])];
    expect(diffSnapshots([], next)).toEqual({
      ...empty,
      added: new Set(["1", "2"]),
    });
  });

  test("a new node is added; its untouched siblings are not", () => {
    const prev = [node("App", "1", {}, [node("A", "2")])];
    const next = [node("App", "1", {}, [node("A", "2"), node("B", "3")])];
    expect(diffSnapshots(prev, next)).toEqual({
      ...empty,
      added: new Set(["3"]),
    });
  });

  test("an unmounted subtree is removed, recursively", () => {
    const prev = [
      node("App", "1", {}, [node("A", "2", {}, [node("a", "3", { dom: true })])]),
    ];
    const next = [node("App", "1")];
    expect(diffSnapshots(prev, next)).toEqual({
      ...empty,
      removed: new Set(["2", "3"]),
    });
  });

  test("a differing scalar field marks changed", () => {
    const prev = [node("Suspense", "1", { suspense: true })];
    const next = [node("Suspense", "1", { suspense: true, suspended: true })];
    expect(diffSnapshots(prev, next).changed).toEqual(new Set(["1"]));
  });

  test("a field disappearing is as much a change as one appearing", () => {
    const prev = [node("Suspense", "1", { suspense: true, suspended: true })];
    const next = [node("Suspense", "1", { suspense: true })];
    expect(diffSnapshots(prev, next).changed).toEqual(new Set(["1"]));
  });

  test("array fields compare element-wise, not by reference", () => {
    const prev = [node("A", "1", { props: ["count", "dark"], hooks: ["useState"] })];
    const same = [node("A", "1", { props: ["count", "dark"], hooks: ["useState"] })];
    expect(diffSnapshots(prev, same)).toEqual(empty);
    const reordered = [node("A", "1", { props: ["dark", "count"], hooks: ["useState"] })];
    expect(diffSnapshots(prev, reordered).changed).toEqual(new Set(["1"]));
    const grown = [node("A", "1", { props: ["count", "dark", "onSave"], hooks: ["useState"] })];
    expect(diffSnapshots(prev, grown).changed).toEqual(new Set(["1"]));
  });

  test("renderer-internal fields (fold, foldOpen, collapsed) are invisible", () => {
    const prev = [node("Item", "1", { fold: 6 }), node("List", "2", { foldOpen: 4 })];
    const next = [node("Item", "1"), node("List", "2", { collapsed: 12 })];
    expect(diffSnapshots(prev, next)).toEqual(empty);
  });

  test("reordered siblings are moved, not changed", () => {
    const prev = [node("App", "1", {}, [node("A", "2"), node("B", "3")])];
    const next = [node("App", "1", {}, [node("B", "3"), node("A", "2")])];
    expect(diffSnapshots(prev, next)).toEqual({
      ...empty,
      moved: new Set(["2", "3"]),
    });
  });

  test("a reparented node is moved; the parents it travelled between are not", () => {
    const prev = [
      node("App", "1", {}, [node("Old", "2", {}, [node("X", "4")]), node("New", "3")]),
    ];
    const next = [
      node("App", "1", {}, [node("Old", "2"), node("New", "3", {}, [node("X", "4")])]),
    ];
    expect(diffSnapshots(prev, next)).toEqual({
      ...empty,
      moved: new Set(["4"]),
    });
  });

  test("a node hoisted to the root level is moved", () => {
    const prev = [node("App", "1", {}, [node("Overlay", "2")])];
    const next = [node("App", "1"), node("Overlay", "2")];
    expect(diffSnapshots(prev, next)).toEqual({
      ...empty,
      moved: new Set(["2"]),
    });
  });

  test("changed and moved are orthogonal: a node can be both", () => {
    const prev = [node("App", "1", {}, [node("A", "2", { props: ["a"] }), node("B", "3")])];
    const next = [node("App", "1", {}, [node("B", "3"), node("A", "2", { props: ["b"] })])];
    const diff = diffSnapshots(prev, next);
    expect(diff.changed).toEqual(new Set(["2"]));
    expect(diff.moved).toEqual(new Set(["2", "3"]));
  });

  test("an added node is only added — never also changed or moved", () => {
    const prev = [node("App", "1")];
    const next = [node("App", "1", {}, [node("New", "2", { props: ["x"] })])];
    const diff = diffSnapshots(prev, next);
    expect(diff.added).toEqual(new Set(["2"]));
    expect(diff.changed).toEqual(new Set());
    expect(diff.moved).toEqual(new Set());
  });
});
