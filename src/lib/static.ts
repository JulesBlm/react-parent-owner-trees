// Static parent/owner tree extraction: the bippy-free producer.
//
// The extract entry reads these trees from live fibers, but that only
// works in development builds (production React strips _debugOwner).
// Small, pure, static component trees can be computed straight from the
// element tree instead: call each component function, walk what it
// returns, and record which component's render created each element (the
// owner). Hooks are served by a minimal dispatcher (context reads come
// from a provider stack maintained by the walk itself), which also
// records useContext consumers for the context area's elbow paths.
// Deterministic, so it runs identically during SSG and hydration.
import * as React from "react";
import { describePortalTarget, markAll, previewValue } from "./core/producer";
import type { InputNode } from "./core";

export type { InputNode } from "./core";

const CONTEXT_TYPE = Symbol.for("react.context");
const MEMO_TYPE = Symbol.for("react.memo");
const LAZY_TYPE = Symbol.for("react.lazy");
const VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition");
const PORTAL_TYPE = Symbol.for("react.portal");
const FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
const ELEMENT_TYPES = new Set<symbol>([
  Symbol.for("react.element"),
  Symbol.for("react.transitional.element"),
]);

const contextRegistry = new Map<string, string>();

export function contextName(id: string): string {
  return contextRegistry.get(id) ?? id;
}

// Stands in for the 'use client' directive: this file has no module
// boundaries for the real directive to live on, so client entry points are
// marked on the component itself. Only consulted when the walk runs in RSC
// mode.
export function markUseClient<T>(component: T): T {
  (component as { $$useClient?: boolean } & T).$$useClient = true;
  return component;
}

// React 19 keeps the current hooks dispatcher on shared internals under
// `H`; React 18 under `ReactCurrentDispatcher.current`. Swapping it for
// the duration of a component call is exactly what test renderers do.
function swapDispatcher(dispatcher: unknown): () => void {
  // Variable keys, not member access: webpack hard-errors on a static
  // namespace access naming an export the installed React doesn't have
  // (the 18 name is gone in 19 and vice versa).
  const KEY_19 =
    "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE";
  const KEY_18 = "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED";
  const reactAny = React as unknown as Record<string, any>;
  const internals = reactAny[KEY_19] ?? reactAny[KEY_18];
  if ("H" in internals) {
    const prev = internals.H;
    internals.H = dispatcher;
    return () => (internals.H = prev);
  }
  const holder = internals.ReactCurrentDispatcher;
  const prev = holder.current;
  holder.current = dispatcher;
  return () => (holder.current = prev);
}

export function elementToTree(
  root: React.ReactNode,
  prefix = "t",
  opts?: {
    rsc?: boolean;
    // Draw every Suspense boundary mid-suspension: primary subtree
    // dormant (dimmed), fallback mounted. Default is the resting state,
    // fallback drawn as a dashed potential subtree.
    suspended?: boolean;
    // Force every error boundary into its caught state: happy-path
    // subtree drawn as departed (error-dashed), fallback mounted. Only
    // boundaries with getDerivedStateFromError can be simulated.
    errored?: boolean;
  },
): InputNode[] {
  const rsc = Boolean(opts?.rsc);
  const suspendAll = Boolean(opts?.suspended);
  const errorAll = Boolean(opts?.errored);
  let n = 0;

  // Ownership travels with the ELEMENT, not with the walk position: an
  // element slotted through another component's props keeps the creator
  // that made it. After a component runs, everything reachable from its
  // output through props is its creation, except elements already tagged
  // by an earlier (outer) render, which is exactly React's owner rule.
  // The creator's environment rides along, so a server-created element
  // threaded through a client component's children hole stays server.
  const creations = new WeakMap<object, { id: string; server: boolean }>();

  function tagCreations(value: unknown, id: string, server: boolean): void {
    if (value == null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) tagCreations(item, id, server);
      return;
    }
    const obj = value as any;
    if (obj.$$typeof === PORTAL_TYPE) {
      tagCreations(obj.children, id, server);
      return;
    }
    if (!ELEMENT_TYPES.has(obj.$$typeof) || creations.has(obj)) return;
    creations.set(obj, { id, server });
    const props = (obj.props ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(props)) tagCreations(props[key], id, server);
  }
  let ctxCount = 0;
  const ctxIds = new Map<unknown, string>();
  const ctxStack = new Map<unknown, unknown[]>();

  const ctxId = (ctx: any): string => {
    let id = ctxIds.get(ctx);
    if (!id) {
      id = `${prefix}c${++ctxCount}`;
      ctxIds.set(ctx, id);
      contextRegistry.set(id, ctx.displayName ?? "Context");
    }
    return id;
  };

  const readCtx = (ctx: any): unknown => {
    const stack = ctxStack.get(ctx);
    return stack && stack.length > 0
      ? stack[stack.length - 1]
      : ctx._currentValue;
  };

  function makeDispatcher(record: { contexts: Set<unknown>; state: number }) {
    const noop = () => {};
    const readAndRecord = (ctx: unknown) => {
      record.contexts.add(ctx);
      return readCtx(ctx);
    };
    return {
      useContext: readAndRecord,
      readContext: readAndRecord,
      use(usable: any) {
        if (usable?.$$typeof === CONTEXT_TYPE) return readAndRecord(usable);
        throw new Error("static walk: use(promise) is not supported");
      },
      useState(initial: unknown) {
        record.state++;
        return [
          typeof initial === "function" ? (initial as () => unknown)() : initial,
          noop,
        ];
      },
      useReducer(_r: unknown, initArg: unknown, init?: (a: unknown) => unknown) {
        record.state++;
        return [init ? init(initArg) : initArg, noop];
      },
      useMemo: (fn: () => unknown) => fn(),
      useCallback: (cb: unknown) => cb,
      useRef: (v: unknown) => ({ current: v }),
      useEffect: noop,
      useLayoutEffect: noop,
      useInsertionEffect: noop,
      useImperativeHandle: noop,
      useDebugValue: noop,
      useId: () => `:static-${++n}:`,
      useTransition: () => [false, noop],
      useDeferredValue: (v: unknown) => v,
      useSyncExternalStore: (_s: unknown, getSnapshot: () => unknown) =>
        getSnapshot(),
      useOptimistic: (v: unknown) => [v, noop],
      useActionState: (_a: unknown, s: unknown) => [s, noop, false],
      // Returns the handler itself; effects never run in the static
      // walk, so nothing ever calls it.
      useEffectEvent: (fn: unknown) => fn,
      // Compiler-output components: a fresh cache of unset sentinels
      // makes every c(n) slot recompute, which is just a plain render.
      useMemoCache: (size: number) =>
        new Array(size).fill(Symbol.for("react.memo_cache_sentinel")),
    };
  }

  // Any hook the dispatcher doesn't model should name itself instead of
  // surfacing as `C.H.useX is not a function` from minified React.
  function guardDispatcher(dispatcher: Record<string, unknown>) {
    return new Proxy(dispatcher, {
      get(target, prop) {
        if (typeof prop === "symbol" || prop in target)
          return target[prop as string];
        return () => {
          throw new Error(`static walk: ${String(prop)} is not supported`);
        };
      },
    });
  }

  // Only server components can be async (a client component has no way
  // to be awaited), so the function's own constructor tells us the
  // environment with no RSC mode needed. Holds as long as the code kept
  // native async; downleveled async compiles to a plain function.
  function isAsyncComponent(type: unknown): boolean {
    return (
      typeof type === "function" && type.constructor?.name === "AsyncFunction"
    );
  }

  function callFunction(
    type: (props: unknown) => React.ReactNode,
    props: unknown,
    node: InputNode,
  ): React.ReactNode {
    // An async component returns a promise this sync walk can't open;
    // calling it would only fire its side effects up to the first await
    // and leave an unhandled rejection behind. Server-marked leaf row
    // (the marking happens in componentEnv).
    if (isAsyncComponent(type)) return null;
    const record = { contexts: new Set<unknown>(), state: 0 };
    const restore = swapDispatcher(guardDispatcher(makeDispatcher(record)));
    try {
      return type(props);
    } finally {
      restore();
      if (record.state > 0) node.state = record.state;
      if (record.contexts.size > 0)
        node.contexts = [...record.contexts].map(ctxId);
    }
  }

  // serverEnv is the environment of the render that CREATED these elements
  // (the owner's environment). It travels with ownerId, which is what makes
  // interleaving come out right: a server-created element slotted through a
  // client component's children hole keeps its server owner and its server
  // env. Only meaningful in RSC mode; root elements are server-created.
  function walkList(
    children: React.ReactNode,
    ownerId?: string,
    serverEnv = rsc,
  ): InputNode[] {
    const out: InputNode[] = [];
    for (const child of Array.isArray(children) ? children : [children]) {
      if (child == null || typeof child === "boolean") continue;
      if (typeof child === "string" || typeof child === "number") continue;
      if (Array.isArray(child)) {
        out.push(...walkList(child, ownerId, serverEnv));
        continue;
      }
      // createPortal returns a portal object, not an element: a real node
      // in the tree whose output lands in containerInfo instead of here.
      if ((child as any).$$typeof === PORTAL_TYPE) {
        const portal = child as any;
        const node: InputNode = {
          id: `${prefix}${++n}`,
          name: "createPortal",
          structural: true,
          portal: true,
          portalTarget: describePortalTarget(portal.containerInfo),
        };
        if (ownerId) node.owner = ownerId;
        const kids = walkList(portal.children, ownerId, serverEnv);
        if (kids.length > 0) node.children = kids;
        out.push(node);
        continue;
      }
      if (ELEMENT_TYPES.has((child as any).$$typeof)) {
        const tag = creations.get(child as object);
        out.push(
          walkElement(
            child as React.ReactElement,
            tag?.id ?? ownerId,
            tag ? tag.server : serverEnv,
          ),
        );
      }
    }
    return out;
  }

  // A component's output: tag its creations, then walk them with the
  // component as owner and its environment as the creating env.
  function walkOutput(
    out: React.ReactNode,
    node: InputNode,
    server: boolean,
  ): InputNode[] {
    tagCreations(out, node.id, server);
    return walkList(out, node.id, server);
  }

  // A component's own environment: server unless its module is a client
  // module, i.e. marked 'use client' or reached from one (an unmarked
  // component rendered by client code runs on the client too). Records the
  // row facts while at it: server components are ghost rows (no fiber on
  // the client), and a marked component created by a server render is a
  // wire landing, so it wears the 'use client' badge.
  function componentEnv(
    type: unknown,
    node: InputNode,
    serverEnv: boolean,
  ): boolean {
    // Async means server, in or out of RSC mode, and regardless of any
    // 'use client' marking (an async client component is invalid React).
    if (isAsyncComponent(type)) {
      node.server = true;
      return true;
    }
    if (!rsc) return serverEnv;
    if ((type as { $$useClient?: boolean })?.$$useClient) {
      if (serverEnv) node.boundary = true;
      return false;
    }
    if (serverEnv) node.server = true;
    return serverEnv;
  }

  function walkElement(
    element: React.ReactElement,
    ownerId?: string,
    serverEnv = rsc,
  ): InputNode {
    const type = element.type as any;
    const props = (element.props ?? {}) as Record<string, unknown>;
    const node: InputNode = { id: `${prefix}${++n}`, name: "" };
    if (ownerId) node.owner = ownerId;
    const keys = Object.keys(props);
    if (keys.length > 0) node.props = keys;

    let kids: InputNode[];
    if (typeof type === "string") {
      node.name = type;
      node.dom = true;
      // Host output created by a server render: a real fiber and DOM node
      // on the client, but the element description arrived as payload
      // data, so no client code can re-produce it. Survives SSR: an SSR'd
      // client component's output is executed on the server, not created
      // there in the Flight sense.
      if (serverEnv && rsc) node.server = true;
      kids = walkList(props.children as React.ReactNode, ownerId, serverEnv);
    } else if (type === React.Fragment) {
      node.name = "Fragment";
      node.structural = true;
      delete node.props;
      kids = walkList(props.children as React.ReactNode, ownerId, serverEnv);
    } else if (type === React.StrictMode) {
      node.name = "StrictMode";
      node.structural = true;
      kids = walkList(props.children as React.ReactNode, ownerId, serverEnv);
    } else if (type === React.Suspense) {
      node.name = "Suspense";
      node.suspense = true;
      // The fallback is a declared alternative, readable straight from
      // the prop, so it is always drawable. Resting: primary mounted,
      // fallback dashed-potential below it. Suspended: the roles flip in
      // place — primary dormant (alive as hidden Offscreen fibers, state
      // preserved), fallback mounted.
      const primary = walkList(
        props.children as React.ReactNode,
        ownerId,
        serverEnv,
      );
      const fallback =
        props.fallback != null
          ? walkList(props.fallback as React.ReactNode, ownerId, serverEnv)
          : [];
      for (const branch of fallback) branch.fallbackOf = node.id;
      if (suspendAll && fallback.length > 0) {
        node.suspended = true;
        kids = [...markAll(primary, "dormant"), ...fallback];
      } else {
        kids = [...primary, ...markAll(fallback, "potential")];
      }
    } else if (type === React.Profiler) {
      node.name = "Profiler";
      node.structural = true;
      node.profiler = true;
      if (typeof props.id === "string") node.profilerId = props.id;
      kids = walkList(props.children as React.ReactNode, ownerId, serverEnv);
    } else if (type === VIEW_TRANSITION_TYPE) {
      node.name = "ViewTransition";
      node.viewTransition = true;
      if (typeof props.name === "string" && props.name !== "auto")
        node.vtName = props.name;
      kids = walkList(props.children as React.ReactNode, ownerId, serverEnv);
    } else if ((React as any).Activity && type === (React as any).Activity) {
      node.name = "Activity";
      node.activity = true;
      node.hidden = props.mode === "hidden";
      kids = walkList(props.children as React.ReactNode, ownerId, serverEnv);
    } else if (type?.$$typeof === CONTEXT_TYPE) {
      const id = ctxId(type);
      node.name = `${contextName(id)}.Provider`;
      node.contextProvider = id;
      if (props.value !== undefined)
        node.contextValue = previewValue(props.value);
      const stack = ctxStack.get(type) ?? [];
      ctxStack.set(type, stack);
      stack.push(props.value);
      kids = walkList(props.children as React.ReactNode, ownerId, serverEnv);
      stack.pop();
    } else if (type?.$$typeof === LAZY_TYPE) {
      // A resolved lazy renders its component with a `lazy` badge. Before
      // the import settles there is no component, just the lazy fiber,
      // which is the honest unresolved figure (and what Suspense covers).
      const payload = type._payload as { _status?: number; _result?: any };
      if (payload?._status === 1) {
        const resolved = payload._result?.default ?? payload._result;
        node.lazy = true;
        node.name = resolved.displayName || resolved.name || "lazy";
        kids = walkOutput(
          callFunction(resolved, props, node),
          node,
          componentEnv(resolved, node, serverEnv),
        );
      } else {
        // Unresolved: no component yet, just the lazy fiber, drawn as a
        // grey placeholder row (the name already says lazy, no badge).
        node.name = "lazy";
        node.structural = true;
        kids = [];
      }
    } else if (type?.$$typeof === MEMO_TYPE) {
      const inner = type.type;
      node.name = type.displayName || inner.displayName || inner.name || "Memo";
      node.memo = true;
      node.memoProps = keys.map(
        (key) => `${key}: ${previewValue(props[key])}`,
      );
      // The directive may sit on the wrapper (markUseClient(memo(...))) or
      // on the wrapped function's module.
      kids = walkOutput(
        callFunction(inner, props, node),
        node,
        componentEnv(type.$$useClient ? type : inner, node, serverEnv),
      );
    } else if (type?.$$typeof === FORWARD_REF_TYPE) {
      node.name = type.render.displayName || type.render.name || "ForwardRef";
      kids = walkOutput(
        type.render(props, null),
        node,
        componentEnv(type, node, serverEnv),
      );
    } else if (type?.prototype?.isReactComponent) {
      node.name = type.displayName || type.name;
      if (type.getDerivedStateFromError || type.prototype.componentDidCatch)
        node.errorBoundary = true;
      const instance = new type(props);
      instance.props = props;
      if (instance.state != null) node.state = 1;
      const env = componentEnv(type, node, serverEnv);
      const happy = walkOutput(instance.render(), node, env);
      if (node.errorBoundary && errorAll && type.getDerivedStateFromError) {
        // Force the caught state: what stood here draws as departed
        // (error-dashed, "this is what the crash cost"), the fallback
        // render below it as what's shown now. Boundaries that rely
        // solely on componentDidCatch can't be simulated statically and
        // keep their happy path.
        node.caught = true;
        instance.state = {
          ...instance.state,
          ...type.getDerivedStateFromError(new Error("figure")),
        };
        const shown = walkOutput(instance.render(), node, env);
        for (const branch of shown) branch.fallbackOf = node.id;
        kids = [...markAll(happy, "departed"), ...shown];
      } else if (node.errorBoundary && (props as { fallback?: unknown }).fallback != null) {
        // The declared alternative is only knowable when the boundary
        // follows the fallback-prop convention; arbitrary render logic
        // has no statically readable alternative, so no potential branch
        // is guessed. walkOutput, not walkList: the fallback gets the
        // same ownership treatment as the boundary's render output
        // (already-tagged elements keep their real creator).
        const declared = markAll(
          walkOutput(
            (props as { fallback?: React.ReactNode }).fallback,
            node,
            env,
          ),
          "potential",
        );
        for (const branch of declared) branch.fallbackOf = node.id;
        kids = [...happy, ...declared];
      } else {
        kids = happy;
      }
    } else {
      node.name = type.displayName || type.name || "Anonymous";
      kids = walkOutput(
        callFunction(type, props, node),
        node,
        componentEnv(type, node, serverEnv),
      );
    }

    if (kids.length > 0) node.children = kids;
    return node;
  }

  // During SSG there is no document, but examples calling
  // createPortal(..., document.body) execute inside this walk. A minimal
  // stand-in keeps the docs code runnable; it reports the same "body"
  // target the browser does, so SSG and hydration agree.
  const needsDocumentShim = typeof document === "undefined";
  if (needsDocumentShim)
    (globalThis as any).document = { body: { nodeType: 1, tagName: "BODY" } };
  try {
    return walkList(root);
  } finally {
    if (needsDocumentShim) delete (globalThis as any).document;
  }
}
