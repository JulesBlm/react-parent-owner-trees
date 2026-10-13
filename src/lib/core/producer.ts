// The producer toolkit: notation conventions shared by every InputNode
// producer (the live extractor, the static walker). Zero-dep so it can live
// in core (ADR-0001); not part of the published core interface — producers
// deep-import it. One home means the conventions can't drift: previews and
// portal-target names are user-visible text, and the two producers had
// already diverged on truncation (21 vs 24 chars) before this module.
import type { InputNode } from "./types";

// The value preview grammar for contextValue and memoProps: functions get
// the ƒ prefix, long strings truncate at 21 chars + ellipsis (so the quoted
// result stays within ~24), arrays and objects show shape, not contents.
export function previewValue(value: unknown): string {
  if (typeof value === "function")
    return `ƒ ${(value as { name?: string }).name || "anonymous"}`;
  if (typeof value === "string")
    return JSON.stringify(
      value.length > 24 ? `${value.slice(0, 21)}…` : value,
    );
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object" && value !== null) return "{…}";
  return String(value);
}

// "body", "div#modal-root": enough to find the container, no more.
export function describePortalTarget(container: unknown): string {
  const el = container as { tagName?: string; id?: string } | null;
  if (!el?.tagName) return "node";
  const tag = String(el.tagName).toLowerCase();
  return el.id ? `${tag}#${el.id}` : tag;
}

// Tag a walked subtree as a not-mounted alternative (potential), a
// crash-unmounted one (departed), or a suspended primary (dormant).
// Always recursive: these are per-node facts, and the owner tree re-nests
// nodes, so positional propagation from a branch root would lose slotted
// descendants there (Albums under a suspended Panel hangs off ArtistPage
// in the owner tree).
export function markAll(
  nodes: InputNode[],
  key: "potential" | "departed" | "dormant",
): InputNode[] {
  for (const node of nodes) {
    node[key] = true;
    if (node.children) markAll(node.children, key);
  }
  return nodes;
}
