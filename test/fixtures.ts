// Hand-written InputNode trees — the third adapter at the InputNode seam
// (live extraction and the static walker are the other two). One fixture per
// notation feature, so the characterization snapshots exercise every paint
// path in core.
import type { InputNode } from "../src/lib/core";

// The one InputNode builder every spec shares; `extra` spreads last so a
// test can override anything, including children.
export function node(
  name: string,
  id: string,
  extra: Partial<InputNode> = {},
  children?: InputNode[],
): InputNode {
  return { name, id, ...(children ? { children } : {}), ...extra };
}

// Components, host rows, props, owner arcs (Stats/Post slot-composed through
// Frame's markup, so parent and owner trees differ).
export const basic: InputNode[] = [
  node("App", "1", {}, [
    node("main", "2", { dom: true }, [
      node("Stats", "3", { owner: "1", props: ["count", "dark"] }),
      node("section", "4", { dom: true }, [
        node("Post", "5", { owner: "1", props: ["title"] }),
        node("Post", "6", { owner: "1" }),
      ]),
    ]),
  ]),
];

// A six-item run: foldRepeats merges it (≥4); unfolding shows foldOpen.
export const foldedList: InputNode[] = [
  node("List", "l0", {}, [
    node("ul", "l1", { dom: true }, [
      ...Array.from({ length: 6 }, (_, i) =>
        node("Item", `i${i + 1}`, { owner: "l0" }, [
          node("li", `d${i + 1}`, { dom: true }),
        ]),
      ),
    ]),
  ]),
];

// Ghost rows, a server host row, and a 'use client' boundary entry — the
// next-rsc interleaving shape in miniature.
export const serverTree: InputNode[] = [
  node("Page", "s1", { server: true }, [
    node("ServerList", "s2", { server: true, owner: "s1" }, [
      node("article", "s3", { server: true, dom: true, owner: "s2" }, [
        node("ClientFrame", "c1", { boundary: true, owner: "s2" }, [
          node("div", "c2", { dom: true }),
        ]),
      ]),
    ]),
    node("ServerStats", "s4", { server: true, owner: "s1" }),
  ]),
];

// Two providers with consumers; context ids resolve through contextName.
export const contextTree: InputNode[] = [
  node("App", "a1", {}, [
    node("ThemeProvider", "p1", { contextProvider: "ctxA", contextValue: '"dark"' }, [
      node("div", "a2", { dom: true }, [
        node("Button", "a3", { owner: "a1", contexts: ["ctxA"] }),
        node("Icon", "a5", { owner: "a1" }),
      ]),
    ]),
    node("I18nProvider", "p2", { contextProvider: "ctxB", contextValue: "{…}" }, [
      node("Label", "a4", { owner: "a1", contexts: ["ctxB"] }),
    ]),
  ]),
];

// Suspense: a resting boundary with a declared (potential) fallback, a nested
// boundary inside it (exclusive catch region), and a suspended boundary whose
// primary subtree is dormant while the fallback is mounted.
export const suspenseTree: InputNode[] = [
  node("App", "b1", {}, [
    node("Suspense", "b2", { suspense: true }, [
      node("Content", "b3", { owner: "b1" }, [
        node("Suspense", "b5", { suspense: true }, [
          node("Inner", "b5c", { owner: "b3" }),
        ]),
      ]),
      node("Spinner", "b4", { potential: true, fallbackOf: "b2" }),
    ]),
    node("Suspense", "b6", { suspense: true, suspended: true }, [
      node("Skeleton", "b7", { fallbackOf: "b6", owner: "b1" }),
      node("Primary", "b8", { dormant: true, owner: "b1" }, [
        node("p", "b9", { dom: true }),
      ]),
    ]),
  ]),
];

// An error boundary that caught: mounted fallback plus the departed subtree
// the crash unmounted.
export const errorTree: InputNode[] = [
  node("App", "e0", {}, [
    node("Boundary", "e1", { errorBoundary: true, caught: true }, [
      node("ErrorNote", "e2", { fallbackOf: "e1", owner: "e0" }),
      node("Crashed", "e3", { departed: true, owner: "e0" }, [
        node("div", "e4", { departed: true, dom: true }),
      ]),
    ]),
  ]),
];

// Structural fibers, Profiler, portal, lazy, Activity (hidden), ViewTransition.
export const miscTree: InputNode[] = [
  node("App", "m1", {}, [
    node("Fragment", "m2", { structural: true }, [
      node("Profiler", "m3", { structural: true, profiler: true, profilerId: "nav" }, [
        node("Nav", "m3c", { owner: "m1" }),
      ]),
      node("Portal", "m4", { portal: true, portalTarget: "div#modal" }, [
        node("Widget", "m5", { owner: "m1", lazy: true }),
      ]),
      node("Activity", "m6", { activity: true, hidden: true }, [
        node("HiddenPane", "m7", { owner: "m1" }, [
          node("span", "m8", { dom: true }),
        ]),
      ]),
      node("ViewTransition", "m9", { viewTransition: true, vtName: "card" }, [
        node("Moved", "m10", { owner: "m1" }),
      ]),
    ]),
  ]),
];

// State dots, memo discs with retained props, hook strips (one over the cap).
export const memoHooksTree: InputNode[] = [
  node("App", "h1", { state: 1, hooks: ["useState", "useEffect", "useMemo", "useRef", "useCallback"] }, [
    node("Memoed", "h2", {
      owner: "h1",
      memo: true,
      memoProps: ["value", "onChange"],
      state: 2,
      hooks: ["useState", "useReducer", "useCallback"],
    }),
    node("Busy", "h3", {
      owner: "h1",
      hooks: [
        "useState", "useEffect", "useMemo", "useRef", "useCallback",
        "useLayoutEffect", "useState", "useReducer", "useSyncExternalStore",
        "useOptimistic", "useInsertionEffect", "useImperativeHandle",
        "useState", "useEffect",
      ],
    }),
    node("Classy", "h4", { owner: "h1", state: 2 }),
  ]),
];

// A deep chain all owned by the root: long-span owner arcs for every arc
// style, and a focus neighborhood whose owner sits far away.
export const deepTree: InputNode[] = [
  node("Root", "t0", {}, [
    (function chain(depth: number): InputNode {
      if (depth === 10) return node("Leaf", "t10", { owner: "t0" });
      return node(`Level${depth}`, `t${depth}`, { owner: "t0" }, [
        chain(depth + 1),
      ]);
    })(1),
  ]),
];

export const contextNames: Record<string, string> = {
  ctxA: "Theme",
  ctxB: "I18n",
};
