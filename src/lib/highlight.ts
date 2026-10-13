// Page highlighting: the diagram's claim made literal. While a row is
// focused, the DOM region its output governs is outlined in the running
// app — the second coordinated surface (OBSERVABLE_MINIMAP.md): Observable
// underlined references in the editor itself, and the pairing of abstract
// view with the user's own artifact is what made the mental model stick.
//
// DOM-only, no bippy and no react: the caller resolves rows to elements
// (getNodeHostElements in extract) and this module only draws. Quiet by
// design: a thin outline and a faint wash, fixed-position boxes that never
// affect page layout, pointer-events none throughout. Observable's own
// wire blue, as a nod.
const HIGHLIGHT_COLOR = "#3b5fc0";

// One under the panel (which sits at 2147483646) so the outline never
// covers the tool itself.
const Z_INDEX = "2147483645";

export interface PageHighlighter {
  // Replaces the current highlight; an empty list clears. Boxes are
  // re-measured on scroll and resize while active, so the outline tracks
  // the elements without the caller re-calling.
  highlight(elements: Element[]): void;
  clear(): void;
}

export function createPageHighlighter(): PageHighlighter {
  let container: HTMLDivElement | null = null;
  let current: Element[] = [];
  let listening = false;
  let raf = 0;

  function ensureContainer(): HTMLDivElement {
    if (!container) {
      container = document.createElement("div");
      container.style.cssText =
        `position:fixed;inset:0;pointer-events:none;z-index:${Z_INDEX}`;
      document.body.append(container);
    }
    return container;
  }

  function draw(): void {
    if (!container) return;
    container.textContent = "";
    for (const el of current) {
      // A commit can unmount a highlighted element between measurements;
      // skip rather than outline a stale rect.
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const box = document.createElement("div");
      box.style.cssText = [
        "position:fixed",
        `left:${r.left - 2}px`,
        `top:${r.top - 2}px`,
        `width:${r.width + 4}px`,
        `height:${r.height + 4}px`,
        `border:1.5px solid ${HIGHLIGHT_COLOR}`,
        "border-radius:2px",
        "background:rgba(59,95,192,0.08)",
        "box-sizing:border-box",
      ].join(";");
      container.append(box);
    }
  }

  // One re-measure per frame no matter how many scroll events arrive;
  // capture catches nested scroll containers, not just the window.
  function schedule(): void {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      draw();
    });
  }

  function listen(on: boolean): void {
    if (on === listening) return;
    listening = on;
    if (on) {
      window.addEventListener("scroll", schedule, {
        capture: true,
        passive: true,
      });
      window.addEventListener("resize", schedule, { passive: true });
    } else {
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    }
  }

  function clear(): void {
    current = [];
    listen(false);
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (container) container.textContent = "";
  }

  return {
    highlight(elements: Element[]): void {
      if (elements.length === 0) {
        clear();
        return;
      }
      current = elements;
      ensureContainer();
      listen(true);
      draw();
    },
    clear,
  };
}
