// The notation's palette: boundary-kind colors, the context palette and its
// persistent assignment, and the node-kind classifier the colors key off.
import type { ContextColorRegistry, InputNode, Row } from "./types";

// --- Neutrals -------------------------------------------------------------
// The four neutrals read from namespaced custom properties with light-mode
// fallbacks, so the SVG renders correctly on any page and a dark host can
// flip them by defining --rpot-* (README "Dark mode"). This is a dark/light
// hook, not a theming API: the accent colors below stay literal so the
// notation reads the same everywhere.
export const BG = "var(--rpot-bg, #fdfdfd)";
export const TEXT = "var(--rpot-text, #1a1a1a)";
export const TEXT_LIGHT = "var(--rpot-text-light, #4a4a4a)";
export const TEXT_LIGHTER = "var(--rpot-text-lighter, #8a8a8a)";

// The red state dot from the published parents/owners diagrams.
export const STATE_COLOR = "#d6336c";
export const MEMO_COLOR = "#5f3dc4";

// --- Context areas -------------------------------------------------------
// Off by default; clicking a provider row toggles its area: a tinted rect
// over the provider's parent subtree (the context's scope) plus elbow paths
// to every fiber in range that reads the context.
// The fifth slot is a muted indigo, not goldenrod: goldenrod sat 15 hue
// degrees from the amber that now means "suspended", and the fifth
// context color has no semantics to defend.
export const CONTEXT_COLORS = [
  "#2f6fab",
  "#8f4bbf",
  "#2e8b57",
  "#c23b77",
  "#4f5d95",
];

// --- Suspense / error boundary catch regions -----------------------------
// Amber = waiting (the pending color), red = failed, and the server teal
// stays exclusively "came from the server". The amber is the exact value
// the server grammar vacated when it went teal, so it is proven at these
// mark sizes.
export const ERROR_COLOR = "#c0392b";
export const SUSPENSE_COLOR = "#d9822b";
export const PROFILER_COLOR = "#64748b";
export const ACTIVITY_COLOR = "#15803d";
export const VIEW_TRANSITION_COLOR = "#a21caf";

export type BoundaryKind =
  | "suspense"
  | "error"
  | "profiler"
  | "activity"
  | "viewtransition";

export function boundaryColor(kind: BoundaryKind): string {
  switch (kind) {
    case "error":
      return ERROR_COLOR;
    case "suspense":
      return SUSPENSE_COLOR;
    case "profiler":
      return PROFILER_COLOR;
    case "activity":
      return ACTIVITY_COLOR;
    case "viewtransition":
      return VIEW_TRANSITION_COLOR;
  }
}

export function boundaryKind(node: InputNode): BoundaryKind | null {
  if (node.suspense) return "suspense";
  if (node.errorBoundary) return "error";
  if (node.profiler) return "profiler";
  if (node.activity) return "activity";
  if (node.viewTransition) return "viewtransition";
  return null;
}

// Colors key on the resolved display name, not the raw id: composition
// prefixes make the same context a new id in every figure, and a named
// context should keep its color across figures. Unnamed contexts (generic
// "Context", or no resolution) fall back to the id so two anonymous
// contexts stay distinguishable. The map lives for the renderer instance;
// assign() fills it in row order so slot choice never depends on paint
// order.
export function createContextColorRegistry(
  contextName: (id: string) => string | undefined,
): ContextColorRegistry {
  const map = new Map<string, string>();
  const key = (id: string): string => {
    const name = contextName(id);
    return name && name !== "Context" ? name : id;
  };
  const colorFor = (k: string): string => {
    let color = map.get(k);
    if (!color) {
      color = CONTEXT_COLORS[map.size % CONTEXT_COLORS.length];
      map.set(k, color);
    }
    return color;
  };
  return {
    assign(rows: Row[]): void {
      for (const row of rows)
        if (row.node.contextProvider) colorFor(key(row.node.contextProvider));
    },
    color(id: string): string {
      return colorFor(key(id));
    },
  };
}
