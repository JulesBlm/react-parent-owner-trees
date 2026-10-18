// The library's zero-dependency core: the InputNode tree shape every
// producer emits (the bippy extractor live, the static walker at build
// time) and the SVG renderer that consumes it. Importing this entry
// must never pull in bippy or react.
//
// This barrel is the module's interface; everything else in core/ is
// implementation — internal seams used by the composer and by tests.
export type {
  ArcStyle,
  HooksMode,
  InputNode,
  MarkFlags,
  PropsPlacement,
  RendererOptions,
  TreeRenderer,
  ViewFlags,
} from "./types";
export { createTreeRenderer } from "./renderer";
// Views are a display filter over the one true tree (tree-sitter's
// named-vs-anonymous idea): hosts composing their own predicates ("app
// only" later) need the splice and the canonical species to build from.
export { applyView, hideDom, hideStructural } from "./transform";
// A scope is a view narrowed to one subtree (the large-app move); hosts
// apply it per commit, before any other view, and own the picking gesture.
export { scopeToSubtree } from "./transform";
// The corpus format (ADR-0007): producers' golden tests and user debugging
// both read trees as this text, so it is interface, not seam.
export { serializeTree } from "./serialize";
// Commit-as-edit: per-id comparison of successive snapshots. Interface, not
// seam — the live producer delivers a TreeDiff with every commit, and any
// consumer holding two snapshots may diff them.
export { diffSnapshots, type TreeDiff } from "./diff";
