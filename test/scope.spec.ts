// A scope narrows the view to one node's parent subtree — the large-app
// move. Like applyView it never touches the source tree: the host re-applies
// it per commit, and it dissolves to the full tree when the scoped id is
// gone (unmounted component, stale id) rather than blanking a live panel.
// Owner refs are kept, not rewritten: an owner outside the scope is no
// longer a row, which rebuildByOwner and the composer already tolerate
// (ADR-0007), so externally-owned components root the scope's owner tree.
import { describe, expect, test } from "vitest";
import {
  applyView,
  hideDom,
  scopeToSubtree,
  serializeTree,
} from "../src/lib/core";
import { rebuildByOwner } from "../src/lib/core/transform";
import { basic } from "./fixtures";

describe("scopeToSubtree", () => {
  test("the found node becomes the sole root, subtree intact", () => {
    expect(serializeTree(scopeToSubtree(basic, "2"))).toBe(
      [
        "main #2 @1 dom",
        "  Stats #3 @1 props=count,dark",
        "  section #4 @1 dom",
        "    Post #5 @1 props=title",
        "    Post #6 @1",
      ].join("\n"),
    );
  });

  test("missing id dissolves the scope: the full tree comes back", () => {
    expect(scopeToSubtree(basic, "unmounted")).toBe(basic);
  });

  test("owner refs pointing outside the scope are kept, not rewritten", () => {
    expect(serializeTree(scopeToSubtree(basic, "4"))).toBe(
      [
        "section #4 @1 dom",
        "  Post #5 @1 props=title",
        "  Post #6 @1",
      ].join("\n"),
    );
  });

  test("owner tree of a scope: externally-owned components become roots", () => {
    expect(serializeTree(rebuildByOwner(scopeToSubtree(basic, "4")))).toBe(
      [
        "section #4 @1 dom",
        "Post #5 @1 props=title",
        "Post #6 @1",
      ].join("\n"),
    );
  });

  test("composes with other views: scope first, then hide species", () => {
    expect(
      serializeTree(applyView(scopeToSubtree(basic, "2"), hideDom)),
    ).toBe(
      [
        "Stats #3 @1 props=count,dark",
        "Post #5 @1 props=title",
        "Post #6 @1",
      ].join("\n"),
    );
  });
});
