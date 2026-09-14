// Must be imported before react-dom so bippy can install the DevTools hook.
import { instrument, type Fiber } from "bippy";
import { SearchBox, ResultsList } from "./SearchBox";

// One snapshot per commit: references to the values the figure tracks,
// captured from the fiber side. Holding the references is the point; the
// figure compares them across commits with Object.is.
export interface Snapshot {
  n: number; // 1-based commit index
  trigger: string;
  query: string;
  values: Record<string, unknown>;
}

// Sliding window. Old snapshots (and the references they hold) drop out.
const WINDOW = 5;

interface HookNode {
  memoizedState: unknown;
  queue: { dispatch?: unknown } | null;
  next: HookNode | null;
}

function findFiber(fiber: Fiber | null, type: unknown): Fiber | null {
  for (let f = fiber; f; f = f.sibling) {
    if (f.type === type) return f;
    const inChild = findFiber(f.child, type);
    if (inChild) return inChild;
  }
  return null;
}

export interface Observer {
  reset: () => void;
}

export function startObserving(
  onSnapshots: (snaps: Snapshot[]) => void,
): Observer {
  const snapshots: Snapshot[] = [];
  let commitIndex = 0;
  let prevDark: unknown;

  instrument({
    onCommitFiberRoot(_rendererId, root) {
      const box = findFiber(root.current.child, SearchBox);
      if (!box) return;

      // Hook chain, in call order: useState(query), useState(dark),
      // useMemo(results). Order-dependent by design; the demo owns the
      // component.
      const queryHook = box.memoizedState as unknown as HookNode | null;
      const darkHook = queryHook?.next ?? null;
      const memoHook = darkHook?.next ?? null;

      const query = queryHook?.memoizedState;
      const setQuery = queryHook?.queue?.dispatch;
      const dark = darkHook?.memoizedState;
      const results = Array.isArray(memoHook?.memoizedState)
        ? (memoHook.memoizedState as unknown[])[0]
        : undefined;

      const section = findFiber(box.child, "section");
      const style = (section?.memoizedProps as { style?: unknown } | null)
        ?.style;
      const list = findFiber(box.child, ResultsList);
      const onClear = (list?.memoizedProps as { onClear?: unknown } | null)
        ?.onClear;

      commitIndex++;
      const prev = snapshots[snapshots.length - 1];
      const trigger = !prev
        ? "mount"
        : !Object.is(prev.values.query, query)
          ? "setQuery"
          : !Object.is(prevDark, dark)
            ? "setDark"
            : "parent";
      prevDark = dark;

      snapshots.push({
        n: commitIndex,
        trigger,
        query: String(query ?? ""),
        values: { query, setQuery, results, style, onClear },
      });
      if (snapshots.length > WINDOW) snapshots.shift();
      onSnapshots([...snapshots]);
    },
  });

  return {
    reset() {
      snapshots.length = 0;
      commitIndex = 0;
      prevDark = undefined;
      onSnapshots([]);
    },
  };
}
