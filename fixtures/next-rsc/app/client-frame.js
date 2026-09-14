"use client";
import { useState } from "react";

export function ClientFrame({ sidebar, children }) {
  const [count, setCount] = useState(0);
  return (
    <div style={{ display: "flex", gap: 16, padding: 16 }}>
      <aside>{sidebar}</aside>
      <main>
        {children}
        <button onClick={() => setCount((c) => c + 1)}>clicked {count}</button>
      </main>
    </div>
  );
}
