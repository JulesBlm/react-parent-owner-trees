// Small demo app with slot composition so the owner tree visibly differs from
// the parent tree: Stats and the Posts are owned by DemoApp but sit inside
// Frame's aside/main in the parent tree. ThemeContext exercises the context
// area display: one consumer shallow (Stats), one deep (Post), Feed unrelated.
import {
  Activity,
  ViewTransition,
  Component,
  createContext,
  memo,
  Profiler,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  type ReactNode,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const ThemeContext = createContext<"light" | "dark">("light");
ThemeContext.displayName = "ThemeContext";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>something broke</p> : this.props.children;
  }
}

function Frame({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="frame">
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  );
}

function Stats({ count, label }: { count: number; label: string }) {
  const theme = useContext(ThemeContext);
  const display = useMemo(() => count.toLocaleString(), [count]);
  return (
    <section data-theme={theme}>
      <strong>{display}</strong> {label}
    </section>
  );
}

// Exercises the memo ring: the owner arc from DemoApp ends at Stats's
// comparison gate rather than at the function's node.
const MemoStats = memo(Stats);

function Feed({ children }: { children: ReactNode }) {
  return <ul>{children}</ul>;
}

// Exercises the createPortal row: the toast's output leaves the tree and
// lands in document.body, while the fiber stays right here.
function Toast() {
  const el = useRef<HTMLOutputElement>(null);
  useLayoutEffect(() => {
    el.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], 150);
  }, []);
  return createPortal(<output ref={el}>saved</output>, document.body);
}

function Post({ title }: { title: string }) {
  const theme = useContext(ThemeContext);
  return <li data-theme={theme}>{title}</li>;
}

export function DemoApp() {
  const [count, setCount] = useState(0);
  const [showFeed, setShowFeed] = useState(true);
  const increment = useCallback(() => setCount((c) => c + 1), []);
  useEffect(() => {
    document.title = `clicked ${count}`;
  }, [count]);
  return (
    <ThemeContext.Provider value="light">
      <ErrorBoundary>
        <Frame
          sidebar={
            <Suspense fallback={<p>loading stats</p>}>
              <Profiler id="stats" onRender={() => {}}>
                <MemoStats count={count} label="clicks" />
              </Profiler>
            </Suspense>
          }
        >
          <Toast />
          <Activity mode={showFeed ? "visible" : "hidden"}>
            <ErrorBoundary>
              <ViewTransition>
              <Feed>
                <Post title="Hello" />
                <Post title="World" />
              </Feed>
              </ViewTransition>
            </ErrorBoundary>
          </Activity>
          <>
            <button onClick={increment}>
              clicked {count}
            </button>
            <button onClick={() => setShowFeed((s) => !s)}>
              {showFeed ? "hide" : "show"} feed
            </button>
          </>
        </Frame>
      </ErrorBoundary>
    </ThemeContext.Provider>
  );
}
