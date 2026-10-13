// The notation as text: one line per node, indented by depth — the corpus
// format (ADR-0007). Golden tests compare producer output as these strings
// so a regression diffs as a legible tree, not a JSON blob; the degradation
// contract is pinned against it. Total and deterministic: every InputNode
// field appears in a fixed order or not at all, so equal trees serialize
// byte-identical.
import type { InputNode } from "./types";

// Every boolean field of InputNode, derived from the type: serializeTree is
// the oracle the corpus tests compare against, so a flag it silently omits
// is a flag the tests are blind to.
type FlagKey = {
  [K in keyof Required<InputNode>]: Required<InputNode>[K] extends boolean
    ? K
    : never;
}[keyof InputNode];

// Boolean flags in declaration order (types.ts), one token each.
const FLAGS = [
  "dom",
  "server",
  "boundary",
  "structural",
  "portal",
  "suspense",
  "suspended",
  "errorBoundary",
  "caught",
  "potential",
  "departed",
  "dormant",
  "activity",
  "hidden",
  "viewTransition",
  "lazy",
  "profiler",
  "memo",
  "unknown",
] as const satisfies readonly FlagKey[];

// Compile-time exhaustiveness: this line errors when a boolean flag is
// added to InputNode but not listed in FLAGS. (Order stays convention —
// only membership is typeable.)
true satisfies [Exclude<FlagKey, (typeof FLAGS)[number]>] extends [never]
  ? true
  : never;

function line(node: InputNode, depth: number): string {
  const parts = [`${"  ".repeat(depth)}${node.name}`];
  if (node.fold) parts.push(`×${node.fold}`);
  if (node.foldOpen) parts.push(`−${node.foldOpen}`);
  parts.push(`#${node.id}`);
  if (node.owner) parts.push(`@${node.owner}`);
  for (const flag of FLAGS) if (node[flag]) parts.push(flag);
  if (node.portalTarget) parts.push(`→${node.portalTarget}`);
  if (node.vtName) parts.push(`vt=${node.vtName}`);
  if (node.profilerId) parts.push(`profile=${node.profilerId}`);
  if (node.contextProvider) parts.push(`ctx=${node.contextProvider}`);
  if (node.contexts?.length) parts.push(`reads=${node.contexts.join(",")}`);
  if (node.fallbackOf) parts.push(`fallbackOf=${node.fallbackOf}`);
  if (node.state) parts.push(`state=${node.state}`);
  if (node.hooks?.length) parts.push(`hooks=${node.hooks.join(",")}`);
  if (node.props?.length) parts.push(`props=${node.props.join(",")}`);
  if (node.collapsed) parts.push(`collapsed=${node.collapsed}`);
  return parts.join(" ");
}

export function serializeTree(roots: InputNode[]): string {
  const lines: string[] = [];
  function visit(node: InputNode, depth: number): void {
    lines.push(line(node, depth));
    node.children?.forEach((child) => visit(child, depth + 1));
  }
  roots.forEach((root) => visit(root, 0));
  return lines.join("\n");
}
