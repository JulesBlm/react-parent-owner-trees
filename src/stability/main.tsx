// observe must come first: bippy installs the DevTools hook on import,
// before react-dom evaluates.
import { startObserving, type Snapshot } from "./observe";
import { createRoot } from "react-dom/client";
import { App } from "./SearchBox";
import { figureSvg, prefersReducedMotion } from "./figure";

const figureEl = document.getElementById("figure")!;

// Two animated scalars, one rAF loop. t: 0 = flat slice columns, 1 =
// stacked duree cube (the whole layout is a lerp of the two). enter:
// commit-entry progress; below 1 the new card is arriving from the near
// side while history recedes a step and the card that left the window
// (exiting) fades out past the back edge.
let lastSnaps: Snapshot[] = [];
let t = 0;
let target = 0;
let enter = 1;
let exiting: Snapshot | null = null;
let raf = 0;

const draw = (allowFlash = false) => {
  figureEl.innerHTML = figureSvg(lastSnaps, t, {
    flash: allowFlash,
    enter,
    exiting,
  });
};

const tick = () => {
  let settled = true;
  t += (target - t) * 0.14;
  if (Math.abs(target - t) < 0.004) t = target;
  else settled = false;
  if (enter < 1) {
    enter += (1 - enter) * 0.16;
    if (1 - enter < 0.008) {
      enter = 1;
      exiting = null;
    } else settled = false;
  }
  raf = settled ? 0 : requestAnimationFrame(tick);
  draw();
};
const kick = () => {
  if (!raf) raf = requestAnimationFrame(tick);
};

const observer = startObserving((snaps: Snapshot[]) => {
  const prev = lastSnaps;
  lastSnaps = snaps;
  // In the stacked view a commit plays as motion: the whole train recedes
  // one step, the new card arrives, the dropped snapshot fades out. The
  // flat view keeps the instant redraw; there the flash carries the event.
  if (t > 0 && prev.length > 0 && snaps.length > 0 && !prefersReducedMotion()) {
    exiting = prev[0].n !== snaps[0].n ? prev[0] : null;
    enter = 0;
    draw();
    kick();
  } else {
    enter = 1;
    exiting = null;
    draw(true);
  }
});

const viewBtn = document.getElementById("view")!;
viewBtn.addEventListener("click", () => {
  target = target === 0 ? 1 : 0;
  viewBtn.textContent = target === 1 ? "flat" : "stack";
  if (prefersReducedMotion()) {
    t = target;
    draw();
  } else {
    kick();
  }
});

// Hover any dot/value: highlight its identity thread, dim the others.
// Delegated on the container since the SVG is rebuilt every commit.
figureEl.addEventListener("mouseover", (event) => {
  const target = (event.target as Element).closest?.("[data-thread]");
  if (!target) return;
  const id = target.getAttribute("data-thread");
  for (const el of figureEl.querySelectorAll("[data-thread]")) {
    el.classList.toggle("thread-hl", el.getAttribute("data-thread") === id);
    el.classList.toggle("thread-dim", el.getAttribute("data-thread") !== id);
  }
});
figureEl.addEventListener("mouseout", (event) => {
  if (!(event.target as Element).closest?.("[data-thread]")) return;
  for (const el of figureEl.querySelectorAll(".thread-hl, .thread-dim")) {
    el.classList.remove("thread-hl", "thread-dim");
  }
});

const root = createRoot(document.getElementById("root")!);
let appKey = 0;
const renderApp = () => root.render(<App key={appKey} />);

// Reset: remount the demo (fresh state) and clear the snapshot window,
// so the mount story replays from render 1.
document.getElementById("reset")!.addEventListener("click", () => {
  appKey++;
  observer.reset();
  renderApp();
});

renderApp();
