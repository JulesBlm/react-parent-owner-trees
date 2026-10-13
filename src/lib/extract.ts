// Must be imported before react-dom so bippy can install the DevTools hook.
import {
  instrument,
  isCompositeFiber,
  isHostFiber,
  isInstrumentationActive,
  getDisplayName,
  getNearestHostFibers,
  traverseRenderedFibers,
  type Fiber,
} from "bippy";
import { locateFromStack } from "./locate";
import { describePortalTarget, markAll, previewValue } from "./core/producer";
// Deep import, not the barrel: the extract entry must not drag the
// renderer into its bundle (ADR-0001 keeps the entries separable).
import { diffSnapshots, type TreeDiff } from "./core/diff";
import type { InputNode } from "./core";

export type { InputNode } from "./core";
export type { TreeDiff } from "./core/diff";
export { describePortalTarget } from "./core/producer";
// The page-highlight overlay ships with the live tool: getNodeHostElements
// resolves a row, createPageHighlighter draws.
export { createPageHighlighter, type PageHighlighter } from "./highlight";

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

// React sets DidCapture on a boundary fiber that is showing its fallback
// (both error boundaries and Suspense use it; we only consult it on error
// boundaries, where Suspense has the cleaner memoizedState signal).
const DID_CAPTURE = 0b10000000;

function didCapture(fiber: Fiber): boolean {
  const flags =
    (fiber as { flags?: number; effectTag?: number }).flags ??
    (fiber as { effectTag?: number }).effectTag ??
    0;
  return (flags & DID_CAPTURE) !== 0;
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

// The DOM elements a row's output governs: the row's own node for a host
// row, the nearest host descendants for a composite (what its render
// materialized as). Empty for rows with nothing on the page — ghost rows,
// departed/potential rows, structural fibers with no host output — which
// is itself honest: selecting them highlights nothing because nothing of
// theirs exists to highlight.
export function getNodeHostElements(id: string): Element[] {
  const fiber = fiberById.get(id);
  if (!fiber) return [];
  try {
    return getNearestHostFibers(fiber)
      .map((f) => f.stateNode as unknown)
      .filter((n): n is Element => n instanceof Element);
  } catch {
    // A hostile fiber shape costs the highlight, never the tool.
    return [];
  }
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
// ADR-0007: errors are local and visible. A fiber that resists extraction
// (a hostile props proxy, an internals shape from a React version this
// code hasn't met) becomes ONE placeholder row — the raw tag as its name,
// honest about what it isn't — and the walk continues beneath it. Warned
// once per fiber, not per commit — the tool runs at commit frequency.
const warnedUnknown = new Set<string>();

function placeholderRow(fiber: Fiber, error: unknown): InputNode {
  const node: InputNode = {
    name: `#${fiber.tag}`,
    id: stableId(fiber),
    unknown: true,
  };
  if (!warnedUnknown.has(node.id)) {
    warnedUnknown.add(node.id);
    console.warn(
      `react-parent-owner-trees: extraction failed on a fiber (tag ${fiber.tag}); ` +
        "rendering a placeholder row, subtree intact.",
      error,
    );
  }
  return node;
}

// Set by describeFiber during the walk, read once per snapshot: the error
// ghost bookkeeping (a full index plus a splice walk per commit) is skipped
// while the tree has no error boundary, so the common case pays nothing for
// a feature that is inert.
let sawErrorBoundary = false;

// What one fiber contributes, with every hostile-data read behind it: the
// extracted fields and the sanitized server-component chain the node nests
// under. The walk itself (children, server-row nesting) lives in visitFiber
// and reads nothing that can throw, so the degradation catch wraps
// describeFiber ALONE and recovery never re-walks children — a re-walk
// through the shared serverRows map would append them to rows the aborted
// attempt already discarded: a silently dropped subtree, the exact thing
// ADR-0007 forbids.
interface FiberFacts {
  // null: a pass-through fiber (HostText, anonymous providers, the root);
  // its children attach to the nearest included ancestor.
  node: InputNode | null;
  chain: { info: object; id: string; name: string; owner?: string }[];
}

const NO_FACTS: FiberFacts = { node: null, chain: [] };

function collectChildren(
  fiber: Fiber | null,
  out: InputNode[],
  serverRows: Map<object, InputNode>,
): void {
  let current = fiber;
  while (current) {
    try {
      visitFiber(current, out, serverRows);
    } catch (error) {
      // Unreachable in principle — every hostile read lives inside
      // describeFiber's own catch — but a walk-machinery surprise still
      // costs one row, not the commit. No child re-walk here either.
      out.push(placeholderRow(current, error));
    }
    current = current.sibling;
  }
}

function visitFiber(
  current: Fiber,
  out: InputNode[],
  serverRows: Map<object, InputNode>,
): void {
  let facts: FiberFacts;
  try {
    facts = describeFiber(current);
  } catch (error) {
    facts = { node: placeholderRow(current, error), chain: [] };
  }
  const node = facts.node;
  if (node === null) {
    collectChildren(current.child, out, serverRows);
    return;
  }
  fiberById.set(node.id, current);
  const kids: InputNode[] = [];
  // A suspended boundary holds both subtrees: the primary children live on
  // as a hidden Offscreen fiber (state preserved), the fallback mounts as
  // its sibling. Tag the primary branch dormant so it dims instead of
  // rendering undifferentiated next to the fallback. Falls back to the
  // generic walk if the fiber shape isn't the expected
  // Offscreen-plus-sibling.
  if (node.suspended && current.child && current.child.tag === OFFSCREEN_TAG) {
    const offscreen = current.child;
    const primary: InputNode[] = [];
    collectChildren(offscreen.child, primary, serverRows);
    kids.push(...markAll(primary, "dormant"));
    if (offscreen.sibling) {
      const fallback: InputNode[] = [];
      collectChildren(offscreen.sibling, fallback, serverRows);
      for (const branch of fallback) branch.fallbackOf = node.id;
      kids.push(...fallback);
    }
  } else {
    collectChildren(current.child, kids, serverRows);
  }
  if (kids.length > 0) node.children = kids;
  // A HostPortal fiber carries no _debugOwner, but its children do, and
  // they share the portal call's creator; borrow it so the portal row
  // stays attached in the owner tree instead of floating as a root.
  if (node.portal && !node.owner) node.owner = kids[0]?.owner;

  // Nest this fiber under its chain of synthesized server rows.
  let target = out;
  for (const link of facts.chain) {
    let row = serverRows.get(link.info);
    if (!row) {
      row = {
        name: link.name,
        id: link.id,
        owner: link.owner,
        server: true,
        props: [],
        children: [],
      };
      serverRows.set(link.info, row);
      target.push(row);
    }
    target = row.children!;
  }
  target.push(node);
}

function describeFiber(current: Fiber): FiberFacts {
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
  if (name === null) return NO_FACTS;
  const node: InputNode = {
    name,
    id: stableId(current),
    owner: ownerId(current),
    dom: isHostFiber(current) || undefined,
    props: propNames(current),
    contexts: consumedContexts(current),
    state: stateHookCount(current),
    hooks: hookTypes(current),
  };
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
  if (isErrorBoundary(current)) {
    node.errorBoundary = true;
    sawErrorBoundary = true;
    if (didCapture(current)) node.caught = true;
  }
  if (isMemoFiber(current)) {
    node.memo = true;
    node.memoProps = memoPropPreviews(current);
  }
  if (isLazyFiber(current)) node.lazy = true;
  const fiberOwner = (current as { _debugOwner?: Fiber | ServerComponentInfo })
    ._debugOwner;
  if (isCompositeFiber(current) && fiberOwner && isServerInfo(fiberOwner)) {
    node.boundary = true;
  }
  const chain = debugInfoChain(current).map((info) => {
    const infoOwner = info.owner;
    return {
      info: info as object,
      id: serverInfoId(info),
      name: cleanName(info.name ?? "ServerComponent"),
      owner:
        infoOwner && isServerInfo(infoOwner)
          ? serverInfoId(infoOwner)
          : undefined,
    };
  });
  return { node, chain };
}

// --- Error ghost history ---------------------------------------------------
// When a boundary catches, React unmounts the crashed subtree: fibers
// destroyed, state lost, nothing left to extract. The tool has commit
// history, so it can answer "what did this error cost": the moment a
// boundary flips to caught, its children from the PREVIOUS snapshot are
// frozen, marked departed, and spliced in above the fallback on every
// snapshot until the boundary resets. Ids are the dead fibers' old ids;
// the counter is monotonic, so they can't collide with live rows. The two
// maps are per-session (owned by startExtraction, passed in): ghost history
// and the diff's prev snapshot are both session state, kept at the same
// altitude so a second session never inherits a first session's ghosts.

function indexById(nodes: InputNode[], into: Map<string, InputNode>): void {
  for (const node of nodes) {
    into.set(node.id, node);
    if (node.children) indexById(node.children, into);
  }
}

function spliceLostSubtrees(
  nodes: InputNode[],
  lost: Map<string, InputNode[]>,
  prevById: Map<string, InputNode>,
): void {
  for (const node of nodes) {
    if (node.errorBoundary) {
      if (node.caught) {
        if (!lost.has(node.id)) {
          const prev = prevById.get(node.id);
          if (prev?.children)
            lost.set(
              node.id,
              markAll(structuredClone(prev.children), "departed"),
            );
        }
        // Whatever the boundary renders while caught IS its fallback;
        // tag it so the catch region excludes it, then splice the
        // frozen pre-crash rows above it.
        for (const branch of node.children ?? [])
          branch.fallbackOf = node.id;
        const frozen = lost.get(node.id);
        if (frozen) node.children = [...frozen, ...(node.children ?? [])];
      } else {
        lost.delete(node.id);
      }
    }
    if (node.children) spliceLostSubtrees(node.children, lost, prevById);
  }
}

// The interface's one temporal invariant, made loud (ADR-0002): this module
// must be imported before react-dom, because bippy installs the DevTools
// hook as an import side effect and React captures the hook's absence at
// its own module evaluation — permanently. The violation leaves no
// synchronous trace (React registers with the hook lazily, on first
// render), so the check is deferred: if no renderer has registered a
// while after extraction starts, the overwhelmingly likely cause is
// import order. An error, not a throw — a late-booting app would make a
// throw a false positive, and by check time there is no caller left to
// catch it.
const HOOK_GRACE_MS = 2000;

function scheduleImportOrderCheck(): void {
  if (typeof setTimeout !== "function") return;
  setTimeout(() => {
    if (isInstrumentationActive()) return;
    console.error(
      "react-parent-owner-trees: no React renderer registered with the DevTools hook " +
        `within ${HOOK_GRACE_MS / 1000}s of startExtraction(). If your app ` +
        "has already rendered, the extract entry was imported after " +
        "react-dom — import it first (before anything that pulls in " +
        "react-dom) so bippy can install the hook before React initializes. " +
        "If your app simply mounts later than this, ignore this message.",
    );
  }, HOOK_GRACE_MS);
}

// One synchronous walk over a fiber subtree, no commit machinery or ghost
// history: the seam the degradation corpus tests feed hand-built fibers
// through — the same code path the live extraction takes, so the contract
// is pinned where it is implemented.
export function snapshotFiberTree(fiber: Fiber | null): InputNode[] {
  const out: InputNode[] = [];
  collectChildren(fiber, out, new Map());
  return out;
}

export function startExtraction(
  onTree: (
    roots: InputNode[],
    diff?: TreeDiff,
    rendered?: ReadonlySet<string>,
  ) => void,
): void {
  let scheduled = false;
  // All live roots, in mount order. A page can have several (the app, dev
  // overlays, portal roots); keeping only the last-committed one shows
  // whichever app happened to commit most recently.
  const fiberRoots = new Map<object, Fiber>();
  // The previously delivered snapshot (all roots, post-splice: diffed
  // against exactly what the consumer saw last). Safe to keep by reference —
  // nothing downstream mutates delivered trees; every pass copies. Undefined
  // diff on the first commit: there is no prev to speak about.
  let prevRoots: InputNode[] | null = null;
  // Error ghost history (per-session, see the splice above): frozen
  // pre-crash subtrees by boundary id, and the pre-splice index of the
  // previous snapshot they freeze from.
  const lostSubtrees = new Map<string, InputNode[]>();
  let prevById = new Map<string, InputNode>();
  // Ids of fibers that performed work since the last delivered snapshot.
  // Collected at commit time, NOT read off flags at snapshot time: a
  // bailed-out fiber is reused by reference and keeps the PerformedWork
  // flag from whenever it last rendered, so a snapshot-time read would
  // report every row that ever rendered. traverseRenderedFibers diffs
  // against the alternate per commit, which is the honest signal — and
  // batching several commits into one rAF unions their renders, which is
  // exactly what "since the last snapshot" should mean.
  let renderedIds = new Set<string>();

  scheduleImportOrderCheck();

  instrument({
    onCommitFiberRoot(_rendererId, root) {
      const container = (root as { containerInfo?: Element }).containerInfo;
      // Next's dev tools overlay is its own React app in a <nextjs-portal>,
      // minified and without owner info. Pure noise here.
      if (container?.tagName?.startsWith("NEXTJS")) return;

      if (root.current.child) fiberRoots.set(root, root.current);
      else fiberRoots.delete(root);

      // The blink is ambient, not accounting: if a hostile fiber shape
      // breaks the render walk, this commit just doesn't blink.
      try {
        traverseRenderedFibers(root, (fiber, phase) => {
          if (phase !== "unmount") renderedIds.add(stableId(fiber));
        });
      } catch {
        /* snapshot delivery is unaffected */
      }

      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        fiberById.clear();
        sawErrorBoundary = false;
        const out: InputNode[] = [];
        const serverRows = new Map<object, InputNode>();
        for (const current of fiberRoots.values()) {
          collectChildren(current.child, out, serverRows);
        }
        // Ghost bookkeeping only while a boundary exists: indexing before
        // splicing keeps the frozen subtrees ghost-free, and skipping both
        // walks when the tree has no error boundary spares the common case
        // two O(n) passes per commit. No boundary rows also means no anchor
        // for frozen history — drop it and the stale index.
        if (sawErrorBoundary) {
          const nextById = new Map<string, InputNode>();
          indexById(out, nextById);
          spliceLostSubtrees(out, lostSubtrees, prevById);
          prevById = nextById;
        } else {
          lostSubtrees.clear();
          if (prevById.size) prevById = new Map();
        }
        const diff = prevRoots ? diffSnapshots(prevRoots, out) : undefined;
        prevRoots = out;
        const rendered = renderedIds;
        renderedIds = new Set();
        onTree(out, diff, rendered);
      });
    },
  });
}
