// Must be imported before react-dom so bippy can install the DevTools hook.
import {
  instrument,
  isCompositeFiber,
  isHostFiber,
  getDisplayName,
  type Fiber,
} from "bippy";
import { locateFromStack } from "./locate";
import type { InputNode } from "./core";

export type { InputNode } from "./core";

const fiberIds = new WeakMap<Fiber, string>();
let nextId = 1;

function stableId(fiber: Fiber): string {
  const existing =
    fiberIds.get(fiber) ??
    (fiber.alternate ? fiberIds.get(fiber.alternate) : undefined);
  if (existing) return existing;
  const id = String(nextId++);
  fiberIds.set(fiber, id);
  if (fiber.alternate) fiberIds.set(fiber.alternate, id);
  return id;
}

// Parcel-compiled libraries (react-aria) ship names like
// "$7230ffa83bc0c2cf$var$DOMElement" or "bound $…$export$a54013f0d02a8f82".
// Keep the readable tail when there is one.
function cleanName(raw: string): string {
  let name = raw.startsWith("bound ") ? raw.slice(6) : raw;
  if (name.includes("$")) {
    const segments = name.split("$").filter(Boolean);
    const last = segments[segments.length - 1] ?? name;
    name = /^[0-9a-f]{8,}$/.test(last) ? `anon-${last.slice(0, 4)}` : last;
  }
  return name;
}

function fiberName(fiber: Fiber): string | null {
  if (isHostFiber(fiber)) return String(fiber.type);
  if (isCompositeFiber(fiber)) {
    return cleanName(getDisplayName(fiber.type) ?? "Anonymous");
  }
  return null;
}

// Server components never become fibers. In React 19 dev builds their
// existence reaches the client as ReactComponentInfo objects: fiber._debugInfo
// chains describe the server components that produced a subtree, and
// fiber._debugOwner can point at one instead of a fiber.
interface ServerComponentInfo {
  name?: string;
  env?: string;
  owner?: ServerComponentInfo | Fiber | null;
}

function isServerInfo(value: unknown): value is ServerComponentInfo {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { tag?: unknown }).tag !== "number"
  );
}

const infoIds = new WeakMap<object, string>();

function serverInfoId(info: object): string {
  let id = infoIds.get(info);
  if (!id) {
    id = `s${nextId++}`;
    infoIds.set(info, id);
  }
  return id;
}

function ownerId(fiber: Fiber): string | undefined {
  const owner = (fiber as { _debugOwner?: Fiber | ServerComponentInfo })
    ._debugOwner;
  if (!owner) return undefined;
  if (isServerInfo(owner)) return serverInfoId(owner);
  if (typeof (owner as Fiber).tag === "number") {
    return stableId(owner as Fiber);
  }
  return undefined;
}

function debugInfoChain(fiber: Fiber): ServerComponentInfo[] {
  const info = (fiber as { _debugInfo?: unknown })._debugInfo;
  if (!Array.isArray(info)) return [];
  return info.filter(isServerInfo);
}

function propNames(fiber: Fiber): string[] {
  const props = fiber.memoizedProps;
  if (!props || typeof props !== "object") return [];
  return Object.keys(props);
}

// --- Context detection ---------------------------------------------------
// Providers are fibers with tag 10. In React 19 the fiber's type IS the
// context object; before 19 it was type._context. Only contexts with a
// displayName are surfaced: it's the one runtime signal that separates
// deliberate user contexts from the anonymous provider stacks libraries
// wrap everything in.
const CONTEXT_PROVIDER_TAG = 10;
const CLASS_COMPONENT_TAG = 1;
const SUSPENSE_TAG = 13;
// Offscreen (22) is Activity's implementation fiber, but Suspense also uses
// it internally for its content, and newer React versions add a dedicated
// ActivityComponent tag (31) that may wrap an Offscreen child. Count a fiber
// as an Activity row only when it isn't one of those internal wrappers.
const OFFSCREEN_TAG = 22;
const ACTIVITY_TAG = 31;
// Fibers with no function or DOM node behind them, persisted all the same:
// they get rows so the parent tree honestly shows what React keeps in memory.
// Tag 8 is Mode; in current React the only mode element left is StrictMode.
const FRAGMENT_TAG = 7;
const MODE_TAG = 8;
const PROFILER_TAG = 12;
// createPortal persists a HostPortal fiber right where it's called; the
// row is the mark, and its badge names where the output actually lands.
const PORTAL_TAG = 4;

function structuralName(fiber: Fiber): string | null {
  switch (fiber.tag) {
    case FRAGMENT_TAG:
      return "Fragment";
    case MODE_TAG:
      return "StrictMode";
    case PROFILER_TAG:
      return "Profiler";
    case PORTAL_TAG:
      return "createPortal";
    default:
      return null;
  }
}

// "body", "div#modal-root": enough to find the container, no more.
export function describePortalTarget(container: unknown): string {
  const el = container as { tagName?: string; id?: string } | null;
  if (!el?.tagName) return "node";
  const tag = el.tagName.toLowerCase();
  return el.id ? `${tag}#${el.id}` : tag;
}

const REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition");
// The ViewTransition fiber (tag 30) carries the symbol on elementType;
// its `type` is null.
const VIEW_TRANSITION_TAG = 30;

function isViewTransitionFiber(fiber: Fiber): boolean {
  return (
    (fiber as { elementType?: unknown }).elementType ===
      REACT_VIEW_TRANSITION_TYPE || fiber.tag === VIEW_TRANSITION_TAG
  );
}

function isActivityFiber(fiber: Fiber): boolean {
  if (fiber.tag === ACTIVITY_TAG) return true;
  if (fiber.tag !== OFFSCREEN_TAG) return false;
  const parentTag = fiber.return?.tag;
  return parentTag !== SUSPENSE_TAG && parentTag !== ACTIVITY_TAG;
}

function isErrorBoundary(fiber: Fiber): boolean {
  if (fiber.tag !== CLASS_COMPONENT_TAG) return false;
  const t = fiber.type as {
    getDerivedStateFromError?: unknown;
    prototype?: { componentDidCatch?: unknown };
  } | null;
  return Boolean(t?.getDerivedStateFromError ?? t?.prototype?.componentDidCatch);
}

// React.memo keeps its marker on elementType ($$typeof) for both memo fiber
// shapes: MemoComponent (tag 14, custom compare) and the compare-less
// SimpleMemoComponent fast path (tag 15). The wrapper is a real fiber, which
// is why the diagram draws memo as a shell around the node: it's runtime
// structure, not a metaphor.
const REACT_MEMO_TYPE = Symbol.for("react.memo");
// A resolved lazy component keeps the lazy wrapper on elementType, same
// pattern as memo: the row is the real component, the badge says how it
// arrived.
const REACT_LAZY_TYPE = Symbol.for("react.lazy");

function isLazyFiber(fiber: Fiber): boolean {
  const elementType = (fiber as { elementType?: { $$typeof?: symbol } })
    .elementType;
  return elementType?.$$typeof === REACT_LAZY_TYPE;
}

function isMemoFiber(fiber: Fiber): boolean {
  const elementType = (fiber as { elementType?: { $$typeof?: symbol } })
    .elementType;
  return elementType?.$$typeof === REACT_MEMO_TYPE;
}

function previewValue(value: unknown): string {
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

function memoPropPreviews(fiber: Fiber): string[] {
  const props = fiber.memoizedProps;
  if (!props || typeof props !== "object") return [];
  return Object.entries(props).map(
    ([key, value]) => `${key}: ${previewValue(value)}`,
  );
}

// Count state hooks by walking the memoizedState hook chain: useState and
// useReducer hooks carry a queue with a dispatch function. (useTransition
// and useOptimistic are built on state hooks internally, so they count too.
// Truthful, if chatty.) Class components count their state object as one.
function stateHookCount(fiber: Fiber): number | undefined {
  if (!isCompositeFiber(fiber)) return undefined;
  if (fiber.tag === CLASS_COMPONENT_TAG) {
    return fiber.memoizedState != null ? 1 : undefined;
  }
  let hook = fiber.memoizedState as {
    queue?: { dispatch?: unknown } | null;
    next?: unknown;
  } | null;
  let count = 0;
  let guard = 0;
  while (hook && typeof hook === "object" && guard++ < 1000) {
    if (typeof hook.queue?.dispatch === "function") count++;
    hook = hook.next as typeof hook;
  }
  return count > 0 ? count : undefined;
}

// Row id -> live fiber for the last-committed tree, so a cmd-click can
// resolve a row back to source. Rebuilt every snapshot; server rows have
// no client fiber and stay absent.
const fiberById = new Map<string, Fiber>();

// The creation site: the JSX line in the owner's render that made this
// element (_debugStack, React 19), mapped back to the authored file
// through the module's sourcemap. Async because the map is fetched on
// demand; resolved at click time, not per commit.
export async function getNodeSource(id: string): Promise<string | null> {
  const stack = (fiberById.get(id) as { _debugStack?: Error } | undefined)
    ?._debugStack?.stack;
  return typeof stack === "string" ? locateFromStack(stack) : null;
}

// The hook-name array React maintains in dev to detect rules-of-hooks
// violations, in call order. Null on class components and on fibers that
// have not completed a render; those fall back to the state count.
function hookTypes(fiber: Fiber): string[] | undefined {
  if (!isCompositeFiber(fiber) || fiber.tag === CLASS_COMPONENT_TAG)
    return undefined;
  const types = (fiber as { _debugHookTypes?: string[] | null })
    ._debugHookTypes;
  return Array.isArray(types) && types.length > 0 ? [...types] : undefined;
}

interface ContextObject {
  displayName?: string;
}

const contextIds = new WeakMap<object, string>();

function contextId(ctx: object): string {
  let id = contextIds.get(ctx);
  if (!id) {
    id = `c${nextId++}`;
    contextIds.set(ctx, id);
  }
  return id;
}

const contextNames = new Map<string, string>();

export function contextName(id: string): string | undefined {
  return contextNames.get(id);
}

function providerContext(fiber: Fiber): ContextObject | null {
  if (fiber.tag !== CONTEXT_PROVIDER_TAG) return null;
  const t = fiber.type as { _context?: object } | null;
  const ctx = (t?._context ?? t) as ContextObject | null;
  return ctx && typeof ctx === "object" ? ctx : null;
}

function consumedContexts(fiber: Fiber): string[] | undefined {
  let dep = (
    fiber as {
      dependencies?: { firstContext?: { context: object; next?: unknown } };
    }
  ).dependencies?.firstContext;
  const out: string[] = [];
  while (dep) {
    out.push(contextId(dep.context));
    dep = dep.next as typeof dep;
  }
  return out.length > 0 ? out : undefined;
}

// Walk child/sibling chains. Fibers that are neither host nor composite
// (Fragments, providers, HostText, the HostRoot itself) are passed through:
// their children attach to the nearest included ancestor.
//
// serverRows maps a ReactComponentInfo object to its synthesized row for this
// walk: sibling fibers produced by the same server component share the info
// object by reference, so they nest under one shared server row.
function collectChildren(
  fiber: Fiber | null,
  out: InputNode[],
  serverRows: Map<object, InputNode>,
): void {
  let current = fiber;
  while (current) {
    const provided = providerContext(current);
    const providedName =
      provided && typeof provided.displayName === "string"
        ? provided.displayName
        : null;
    const suspense = current.tag === SUSPENSE_TAG;
    const activity = isActivityFiber(current);
    const viewTransition = isViewTransitionFiber(current);
    const structural = structuralName(current);
    const name = providedName
      ? `${providedName}.Provider`
      : suspense
        ? "Suspense"
        : activity
          ? "Activity"
          : viewTransition
            ? "ViewTransition"
            : (structural ?? fiberName(current));
    if (name !== null) {
      const node: InputNode = {
        name,
        id: stableId(current),
        owner: ownerId(current),
        dom: isHostFiber(current) || undefined,
        props: propNames(current),
        contexts: consumedContexts(current),
        state: stateHookCount(current),
        hooks: hookTypes(current),
        children: [],
      };
      fiberById.set(node.id, current);
      if (provided && providedName) {
        node.contextProvider = contextId(provided);
        contextNames.set(node.contextProvider, providedName);
        const value = (current.memoizedProps as { value?: unknown } | null)
          ?.value;
        if (value !== undefined) node.contextValue = previewValue(value);
      }
      if (suspense) {
        node.suspense = true;
        if (current.memoizedState !== null) node.suspended = true;
      }
      if (activity) {
        node.activity = true;
        const mode = (current.memoizedProps as { mode?: string } | null)?.mode;
        if (mode === "hidden") node.hidden = true;
      }
      if (viewTransition) {
        node.viewTransition = true;
        const vtName = (current.memoizedProps as { name?: unknown } | null)
          ?.name;
        if (typeof vtName === "string" && vtName !== "auto")
          node.vtName = vtName;
      }
      if (structural) {
        node.structural = true;
        // A Fragment fiber's memoizedProps IS its children (array or single
        // element), not a props object; Object.keys would emit junk.
        if (current.tag === FRAGMENT_TAG) node.props = [];
        if (current.tag === PROFILER_TAG) {
          node.profiler = true;
          const id = (current.memoizedProps as { id?: unknown } | null)?.id;
          if (typeof id === "string") node.profilerId = id;
        }
        if (current.tag === PORTAL_TAG) {
          node.portal = true;
          node.portalTarget = describePortalTarget(
            (current.stateNode as { containerInfo?: unknown } | null)
              ?.containerInfo,
          );
          node.props = [];
        }
      }
      if (isErrorBoundary(current)) node.errorBoundary = true;
      if (isMemoFiber(current)) {
        node.memo = true;
        node.memoProps = memoPropPreviews(current);
      }
      if (isLazyFiber(current)) node.lazy = true;
      const fiberOwner = (
        current as { _debugOwner?: Fiber | ServerComponentInfo }
      )._debugOwner;
      if (
        isCompositeFiber(current) &&
        fiberOwner &&
        isServerInfo(fiberOwner)
      ) {
        node.boundary = true;
      }
      collectChildren(current.child, node.children!, serverRows);
      if (node.children!.length === 0) delete node.children;
      // A HostPortal fiber carries no _debugOwner, but its children do,
      // and they share the portal call's creator; borrow it so the portal
      // row stays attached in the owner tree instead of floating as a
      // root.
      if (node.portal && !node.owner) node.owner = node.children?.[0]?.owner;

      // Nest this fiber under its chain of synthesized server rows.
      let target = out;
      for (const info of debugInfoChain(current)) {
        let row = serverRows.get(info);
        if (!row) {
          const infoOwner = info.owner;
          row = {
            name: cleanName(info.name ?? "ServerComponent"),
            id: serverInfoId(info),
            owner:
              infoOwner && isServerInfo(infoOwner)
                ? serverInfoId(infoOwner)
                : undefined,
            server: true,
            props: [],
            children: [],
          };
          serverRows.set(info, row);
          target.push(row);
        }
        target = row.children!;
      }
      target.push(node);
    } else {
      collectChildren(current.child, out, serverRows);
    }
    current = current.sibling;
  }
}

export function startExtraction(onTree: (roots: InputNode[]) => void): void {
  let scheduled = false;
  // All live roots, in mount order. A page can have several (the app, dev
  // overlays, portal roots); keeping only the last-committed one shows
  // whichever app happened to commit most recently.
  const fiberRoots = new Map<object, Fiber>();

  instrument({
    onCommitFiberRoot(_rendererId, root) {
      const container = (root as { containerInfo?: Element }).containerInfo;
      // Next's dev tools overlay is its own React app in a <nextjs-portal>,
      // minified and without owner info. Pure noise here.
      if (container?.tagName?.startsWith("NEXTJS")) return;

      if (root.current.child) fiberRoots.set(root, root.current);
      else fiberRoots.delete(root);

      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        fiberById.clear();
        const out: InputNode[] = [];
        const serverRows = new Map<object, InputNode>();
        for (const current of fiberRoots.values()) {
          collectChildren(current.child, out, serverRows);
        }
        onTree(out);
      });
    },
  });
}
