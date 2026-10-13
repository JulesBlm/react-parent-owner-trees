// Commit-as-edit: what changed between two snapshots, as data. Node
// matching is already solved upstream — producers emit stable ids (the
// live extractor follows fiber alternates) — so this is not tree diffing,
// just a per-id field comparison. Pure and zero-dep so any producer (or a
// consumer holding two snapshots from anywhere) can use it; what a change
// LOOKS like is the renderer's problem, not this module's.
import type { InputNode } from "./types";

export interface TreeDiff {
  added: Set<string>;
  removed: Set<string>;
  // any extracted field differs (name, props, flags, ...). Orthogonal to
  // moved: a node can be both.
  changed: Set<string>;
  // different parent id, or different index among siblings — position is
  // not a field on the node, so it gets its own axis.
  moved: Set<string>;
}

// Renderer-internal annotations (set by foldRepeats / the collapse prune,
// never by extraction) must not light a node up through bookkeeping: a
// snapshot is the same snapshot before and after renderer passes. id is the
// match key and children is structure — structure lands on the moved/added/
// removed axes, not on changed. `satisfies` keeps the list honest against
// InputNode when fields are renamed.
const EXCLUDED_FIELDS = [
  "id",
  "children",
  "fold",
  "foldOpen",
  "collapsed",
] as const satisfies readonly (keyof InputNode)[];

function excluded(key: string): boolean {
  return (EXCLUDED_FIELDS as readonly string[]).includes(key);
}

// Shallow, with one level of element-wise array comparison: extraction
// rebuilds props/hooks/contexts arrays every commit, so reference equality
// would mark every node changed on every commit.
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  }
  return false;
}

// Runs per matched node per commit, so it allocates nothing: fields in a
// (shared or dropped) are compared in the first loop — a field dropped from
// the snapshot (suspended clearing, a prop removed) is as much a change as
// one appearing — and fields that only appeared in b are caught by the
// reverse containment check.
function sameFields(a: InputNode, b: InputNode): boolean {
  for (const key in a) {
    if (excluded(key)) continue;
    if (!sameValue(a[key as keyof InputNode], b[key as keyof InputNode]))
      return false;
  }
  for (const key in b) {
    if (
      !(key in a) &&
      !excluded(key) &&
      b[key as keyof InputNode] !== undefined
    )
      return false;
  }
  return true;
}

interface Position {
  node: InputNode;
  parent: string | undefined;
  index: number;
}

function indexPositions(roots: InputNode[]): Map<string, Position> {
  const byId = new Map<string, Position>();
  function visit(nodes: InputNode[], parent: string | undefined): void {
    nodes.forEach((node, index) => {
      byId.set(node.id, { node, parent, index });
      if (node.children) visit(node.children, node.id);
    });
  }
  visit(roots, undefined);
  return byId;
}

// One indexing walk per side, one comparison loop over the indexes:
// O(total nodes).
export function diffSnapshots(prev: InputNode[], next: InputNode[]): TreeDiff {
  const prevById = indexPositions(prev);
  const nextById = indexPositions(next);
  const diff: TreeDiff = {
    added: new Set(),
    removed: new Set(),
    changed: new Set(),
    moved: new Set(),
  };
  for (const [id, { node, parent, index }] of nextById) {
    const was = prevById.get(id);
    if (!was) {
      diff.added.add(id);
      continue;
    }
    if (!sameFields(was.node, node)) diff.changed.add(id);
    if (was.parent !== parent || was.index !== index) diff.moved.add(id);
  }
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) diff.removed.add(id);
  }
  return diff;
}
