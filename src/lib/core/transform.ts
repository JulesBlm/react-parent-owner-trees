// The pure tree passes: InputNode trees in, InputNode trees or Row[] out.
// Everything here is deterministic given its arguments — the interactive
// state arrives as explicit parameters (sets of ids), never ambiently.
import { GRID } from "./types";
import type { Focus, InputNode, Row } from "./types";

export function flatten(roots: InputNode[]): Row[] {
  const rows: Row[] = [];
  function visit(node: InputNode, depth: number, dim: boolean): void {
    // dormant dims the marked row AND its subtree (the whole primary
    // branch of a suspended boundary); hidden <Activity> dims children
    // only, as before.
    const own = dim || Boolean(node.dormant);
    rows.push({ node, depth, y: rows.length * GRID, x: depth * GRID, dim: own });
    const childDim = own || Boolean(node.activity && node.hidden);
    node.children?.forEach((child) => visit(child, depth + 1, childDim));
  }
  roots.forEach((root) => visit(root, 0, false));
  return rows;
}

export function countRows(nodes: InputNode[] | undefined): number {
  let n = 0;
  for (const node of nodes ?? []) n += 1 + countRows(node.children);
  return n;
}

// Collapse consecutive runs of same-named siblings (list output) into one
// representative node tagged with the run length. A 262-item listbox
// becomes one "ListBoxItem ×262" row whose subtree shows the shape of
// each item.
export function foldRepeats(
  nodes: InputNode[],
  unfoldedRuns: ReadonlySet<string>,
  minRun = 4,
): InputNode[] {
  const out: InputNode[] = [];
  let i = 0;
  while (i < nodes.length) {
    let j = i;
    while (j < nodes.length && nodes[j].name === nodes[i].name) j++;
    const run = j - i;
    const foldChildren = (node: InputNode): InputNode => {
      const kids = node.children;
      return {
        ...node,
        children: kids ? foldRepeats(kids, unfoldedRuns, minRun) : undefined,
      };
    };
    if (run >= minRun && !unfoldedRuns.has(nodes[i].id)) {
      out.push({ ...foldChildren(nodes[i]), fold: run });
      i = j;
    } else if (run >= minRun) {
      for (let k = i; k < j; k++) {
        const member = foldChildren(nodes[k]);
        if (k === i) member.foldOpen = run;
        out.push(member);
      }
      i = j;
    } else {
      out.push(foldChildren(nodes[i]));
      i++;
    }
  }
  return out;
}

// --- Subtree collapse ---------------------------------------------------
// User-driven hiding, distinct from foldRepeats (which merges repeated
// siblings). Double-click a node to hide everything below it; the row
// stays, with a "&#9656; n" badge carrying the hidden count as the way
// back in. Applied as a prune before layout so links, arcs, and areas
// never see the hidden rows. Both trees share the id set; each hides the
// node's subtree in its own sense (parent: what it contains; owner: what
// it rendered).
export function pruneCollapsed(
  nodes: InputNode[],
  collapsedIds: ReadonlySet<string>,
): InputNode[] {
  return nodes.map((node) => {
    if (collapsedIds.has(node.id) && node.children?.length) {
      const { children, ...rest } = node;
      return { ...rest, collapsed: countRows(children) };
    }
    return node.children
      ? { ...node, children: pruneCollapsed(node.children, collapsedIds) }
      : node;
  });
}

// --- View filtering -------------------------------------------------------
// tree-sitter's named-vs-anonymous split applied to rows: the full InputNode
// tree stays the single source of truth, and a view hides whole species of
// row without re-extraction. A hidden node is spliced out — its children
// promoted into its place in the parent's child list — so depth reassignment
// and elbow reattachment to the nearest visible ancestor fall out of flatten,
// no special edge code. Owner refs are deliberately NOT rewritten: an arc
// whose endpoint row is hidden is dropped by the composer's byId.has guards,
// the same tolerance ADR-0007 relies on for unresolvable owners.
export function applyView(
  nodes: InputNode[],
  hide: (n: InputNode) => boolean,
): InputNode[] {
  const out: InputNode[] = [];
  for (const node of nodes) {
    // Children filter first, so a chain of hidden nodes promotes its
    // deepest visible descendants in one pass, and a hidden root hands
    // its children to the forest.
    const kids = node.children ? applyView(node.children, hide) : undefined;
    if (hide(node)) {
      if (kids) out.push(...kids);
    } else {
      out.push(kids ? { ...node, children: kids } : node);
    }
  }
  return out;
}

// The two canonical species predicates. "App only" (server components plus
// everything they transitively own) composes from these later, in app code —
// transitive ownership needs the whole tree, not one node, so it is not a
// per-node predicate and does not belong here.
export const hideDom = (n: InputNode): boolean => Boolean(n.dom);
export const hideStructural = (n: InputNode): boolean => Boolean(n.structural);

// Declared fallbacks are boundary facts, not tree structure: rows and
// elbows claim "this exists here", which a not-mounted fallback does
// not. Potential branches are pulled out of the row flow entirely and
// drawn as a dashed annex card beside the boundary's area, only while
// that area is toggled on. The resting owner tree drops them too:
// nothing has rendered the fallback yet.
export function stripPotential(
  nodes: InputNode[],
  cards: Map<string, InputNode[]>,
): InputNode[] {
  const out: InputNode[] = [];
  for (const node of nodes) {
    if (node.potential) {
      if (node.fallbackOf) {
        const list = cards.get(node.fallbackOf) ?? [];
        list.push(node);
        cards.set(node.fallbackOf, list);
      }
      continue;
    }
    out.push(
      node.children
        ? { ...node, children: stripPotential(node.children, cards) }
        : node,
    );
  }
  return out;
}

const FOCUS_UP = 2;
const FOCUS_DOWN = 2;

// --- Selection focus ----------------------------------------------------
// Observable-minimap style neighborhood view: click any node to focus it.
// Kept rows: tree ancestors within FOCUS_UP, descendants within
// FOCUS_DOWN, plus one hop in the owner graph regardless of tree distance
// (the direct owner and ownees are the edges this tool exists to show).
// Everything else fades in place — layout never shifts.
export function computeFocus(
  roots: InputNode[],
  byId: Map<string, Row>,
  selectedId: string | null,
): Focus | null {
  if (!selectedId || !byId.has(selectedId)) return null;
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  function walk(node: InputNode): void {
    const kids = node.children ?? [];
    childrenOf.set(
      node.id,
      kids.map((k) => k.id),
    );
    for (const kid of kids) {
      parentOf.set(kid.id, node.id);
      walk(kid);
    }
  }
  roots.forEach(walk);

  const keep = new Set<string>([selectedId]);
  let up = parentOf.get(selectedId);
  for (let i = 0; i < FOCUS_UP && up; i++) {
    keep.add(up);
    up = parentOf.get(up);
  }
  let frontier = [selectedId];
  for (let i = 0; i < FOCUS_DOWN; i++) {
    frontier = frontier.flatMap((id) => childrenOf.get(id) ?? []);
    frontier.forEach((id) => keep.add(id));
  }
  const owner = byId.get(selectedId)!.node.owner;
  if (owner && byId.has(owner)) keep.add(owner);
  for (const row of byId.values())
    if (row.node.owner === selectedId) keep.add(row.node.id);
  return { keep };
}

// Re-nest by owner refs, preserving parent-tree DFS order. In the owner
// tree the direct owner IS the parent, so no arcs; and the server/client
// split is clean here: ghost rows form a connected crown containing the
// root, each 'use client' landing roots a purely-client subtree.
export function rebuildByOwner(roots: InputNode[]): InputNode[] {
  const parentRows = flatten(roots);
  const ownerChildren = new Map<string, InputNode[]>();
  const ownerRoots: InputNode[] = [];

  const ids = new Set(parentRows.map((r) => r.node.id));
  for (const { node } of parentRows) {
    if (node.owner && ids.has(node.owner)) {
      const list = ownerChildren.get(node.owner) ?? [];
      list.push(node);
      ownerChildren.set(node.owner, list);
    } else {
      ownerRoots.push(node);
    }
  }

  return (function rebuild(nodes: InputNode[]): InputNode[] {
    return nodes.map((node) => ({
      ...node,
      children: rebuild(ownerChildren.get(node.id) ?? []),
    }));
  })(ownerRoots);
}
