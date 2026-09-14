// The running example for the stability post. This file is the sample code:
// it must stay clean, no instrumentation. The observer reads it from the
// fiber side.
import { useMemo, useReducer, useState } from "react";

const POSTS = [
  "flushSync",
  "useSyncExternalStore",
  "Parents & Owners",
  "Lazy component maps",
  "SVG map inset",
  "useImperativeHandle",
];

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);

  const results = useMemo(
    () => POSTS.filter((p) => p.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const style = { background: dark ? "#1a1a1a" : "#ffffff" };
  const onClear = () => setQuery("");

  return (
    <section style={style} className={dark ? "dark" : ""}>
      <input
        value={query}
        placeholder="Search posts"
        onChange={(e) => setQuery(e.target.value)}
      />
      <button onClick={() => setDark(!dark)}>
        {dark ? "light mode" : "dark mode"}
      </button>
      <ResultsList results={results} onClear={onClear} />
    </section>
  );
}

interface ResultsListProps {
  results: string[];
  onClear: () => void;
}

export function ResultsList({ results, onClear }: ResultsListProps) {
  return (
    <>
      <ul>
        {results.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
      <button onClick={onClear}>clear</button>
    </>
  );
}

// Demo shell, not part of the post's sample. Gives the third re-render
// trigger: a parent re-render that changes none of SearchBox's state.
export function App() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  return (
    <div>
      <button className="parent-btn" onClick={force}>
        re-render parent
      </button>
      <SearchBox />
    </div>
  );
}
