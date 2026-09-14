// The library's zero-dependency core: the InputNode tree shape every
// producer emits (the bippy extractor live, the static walker at build
// time) and, soon, the SVG renderer that consumes it. Importing this
// entry must never pull in bippy or react.

// Same shape diagrama emits: nesting = parent tree, owner refs = owner tree.
export interface InputNode {
  name: string;
  id: string;
  owner?: string;
  dom?: boolean;
  props?: string[];
  children?: InputNode[];
  // set by foldRepeats: this node stands in for `fold` same-named siblings
  fold?: number;
  // set by foldRepeats: first node of a run the user has unfolded
  foldOpen?: number;
  // synthesized from fiber._debugInfo: a server component (RSC) row
  server?: boolean;
  // client component whose owner is a server component: a 'use client' entry
  boundary?: boolean;
  // this row is a Context.Provider for the context with this id
  contextProvider?: string;
  // preview of the value the provider currently provides
  contextValue?: string;
  // ids of contexts this fiber reads (useContext subscriptions)
  contexts?: string[];
  // Suspense boundary (fiber tag 13); suspended = currently showing fallback
  suspense?: boolean;
  suspended?: boolean;
  // class component with getDerivedStateFromError/componentDidCatch
  errorBoundary?: boolean;
  // <Activity> boundary; hidden = mode="hidden" (subtree alive but dormant)
  activity?: boolean;
  hidden?: boolean;
  // <ViewTransition> boundary (stable since React 19.3); vtName only when
  // the author named it (shared element transitions)
  viewTransition?: boolean;
  vtName?: string;
  // Fragment/StrictMode/Profiler: a fiber React persists even though no
  // function of yours (and no DOM node) is behind it
  structural?: boolean;
  // createPortal row (HostPortal fiber): output leaves the tree here
  portal?: boolean;
  portalTarget?: string;
  // component that arrived via React.lazy (resolved lazy fiber)
  lazy?: boolean;
  // <Profiler> row; its onRender measures every render in its subtree
  profiler?: boolean;
  profilerId?: string;
  // number of state hooks living on this fiber (useState/useReducer;
  // class component state counts as one)
  state?: number;
  // primitive hook names in call order, from _debugHookTypes (dev-only;
  // custom hooks arrive flattened to their primitives)
  hooks?: string[];
  // renderer-internal: number of descendant rows hidden by a user
  // collapse (set by the renderer's prune pass, never by extraction)
  collapsed?: number;
  // wrapped in React.memo; memoProps previews the memoizedProps snapshot
  // the next shallow comparison will run against
  memo?: boolean;
  memoProps?: string[];
}
