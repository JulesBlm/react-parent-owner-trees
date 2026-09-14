// Snapshots -> slice-columns SVG, parameterized by a view scalar t:
// t=0 flat (columns side by side), t=1 stacked (the duree cube: cards
// cascading into depth, newest in front, closest to the shelf). Oblique
// projection is a 2D affine map, so every position is a plain lerp of
// the two layouts and one scalar tweens the whole figure.
//
// Threads are point-to-point lines between dot centers, so they rotate
// into the depth axis for free: at t=1 an unbroken identity reads as a
// skewer through the stack. SVG has no z-order, so stacking is DOM
// order: strict painter's order per depth (threads into card k, card
// k's box, card k's dots), with translucent card faces so each layer
// hazes what's behind it instead of erasing it. Deeper history is
// progressively dimmer; the skewers stay traceable.
//
// Right edge: the memory shelf. What the fiber holds RIGHT NOW, in two
// compartments: hook values (persist across renders) and this render's
// created values (replaced every commit). Values from old renders that the
// current fiber no longer references are faded: garbage.
//
// Every dot/text/line belonging to one identity run carries a data-thread
// attribute; main.tsx uses it for hover-to-highlight.
import type { Snapshot } from "./observe";

const LABEL_W = 100;
const PITCH = 96;
const BOX_W = 84;
const BOX_INSET = (PITCH - BOX_W) / 2;
const HEADER_H = 40;
const ROW_H = 32;
const BOX_PAD = 10;
const SHELF_GAP = 20;
const SHELF_W = 64;
const SIDE_NOTE_W = 150;
const DEAD_OPACITY = 0.3;
const FLASH_COLOR = "#e8a33d";
const EASE_OUT = 'calcMode="spline" keySplines="0.215 0.61 0.355 1"';
// Stacked-view cascade step: each older card sits one step up-left of the
// next, so its top strip and left edge stay visible behind the front card.
const STACK_DX = 26;
const STACK_DY = 34;
// Card face translucency: opaque enough to separate the layers, open
// enough that threads and dots behind stay traceable through the haze.
const CARD_FILL_OPACITY = 0.75;

export const prefersReducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// A one-shot pulse behind a fresh (just-redefined) value. SMIL plays on
// DOM insertion, and the figure is rebuilt per commit, so only elements
// emitted for THIS commit's fresh values ever flash.
function flashDot(cx: number, cy: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="4" fill="${FLASH_COLOR}">
    <animate attributeName="r" values="4;14" dur="0.6s" ${EASE_OUT} fill="freeze" />
    <animate attributeName="opacity" values="0.8;0" dur="0.6s" ${EASE_OUT} fill="freeze" />
  </circle>`;
}

function flashRect(cx: number, cy: number, w: number): string {
  return `<rect x="${cx - w / 2}" y="${cy - 11}" width="${w}" height="22"
    rx="4" fill="${FLASH_COLOR}">
    <animate attributeName="opacity" values="0.5;0" dur="0.6s" ${EASE_OUT} fill="freeze" />
  </rect>`;
}

// The static encoding of a break: a small x in the gap where the identity
// did NOT survive. This is what remains of the flash in a screenshot.
function breakMark(x: number, y: number, faded: boolean): string {
  const a = 3.2;
  return `<g stroke="${FLASH_COLOR}" stroke-width="1.5" stroke-linecap="round"
    ${faded ? `opacity="${DEAD_OPACITY}"` : ""}>
    <line x1="${x - a}" y1="${y - a}" x2="${x + a}" y2="${y + a}" />
    <line x1="${x - a}" y1="${y + a}" x2="${x + a}" y2="${y - a}" />
  </g>`;
}

type RowKind = "value" | "ref";

const ROWS: { key: string; label: string; kind: RowKind }[] = [
  { key: "query", label: "query", kind: "value" },
  { key: "setQuery", label: "setQuery", kind: "ref" },
  { key: "results", label: "results", kind: "ref" },
  { key: "style", label: "style", kind: "ref" },
  { key: "onClear", label: "onClear", kind: "ref" },
];

// Rows 0-2 live in the hook chain; rows 3-4 are created during render.
const HOOK_ROWS = 3;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function shortValue(q: string): string {
  const shown = q.length > 5 ? q.slice(0, 4) + "…" : q;
  return `"${shown}"`;
}

function fmt(v: unknown): string {
  if (typeof v === "string") return shortValue(v);
  if (typeof v === "function") return "ƒ";
  if (Array.isArray(v)) return `[${v.length}]`;
  if (v && typeof v === "object") return "{…}";
  return String(v);
}

// Tooltip repr: the actual value, so readers can check the receipts.
function fullValue(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "function")
    return `ƒ ${(v as { name?: string }).name || "anonymous"}`;
  try {
    const s = JSON.stringify(v);
    if (s === undefined) return String(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  } catch {
    return String(v);
  }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Shorten a segment by `ins` at both ends (used so value-text rows keep a
// gap in the thread where the text sits). Returns null if nothing remains.
function insetLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ins: number,
): [number, number, number, number] | null {
  const dxl = x2 - x1;
  const dyl = y2 - y1;
  const len = Math.hypot(dxl, dyl);
  if (len <= ins * 2 + 2) return null;
  const ux = dxl / len;
  const uy = dyl / len;
  return [x1 + ux * ins, y1 + uy * ins, x2 - ux * ins, y2 - uy * ins];
}

export interface FigureView {
  flash?: boolean;
  // Commit-entry progress, 0..1. Below 1, the newest card is mid-arrival:
  // the whole train sits (1 - enter) steps closer to the front than at
  // rest, the new card fades in from beyond the front edge, and `exiting`
  // (the snapshot that just left the window) recedes past the back edge
  // while fading out.
  enter?: number;
  exiting?: Snapshot | null;
}

export function figureSvg(
  snaps: Snapshot[],
  t = 0,
  view: FigureView = {},
): string {
  const { flash: allowFlash = true, enter = 1, exiting = null } = view;
  if (snaps.length === 0) return "";

  // The draw list keeps the exiting snapshot at the back while it fades.
  const list = exiting ? [exiting, ...snaps] : snaps;
  const last = list.length - 1;
  const newest = list[last].values;

  // Fractional display index per card. At rest it's the list index; the
  // window slide animates as one motion of the whole train.
  const d = (k: number) =>
    exiting
      ? k - 1 + (1 - enter)
      : enter < 1 && k === last
        ? k + (1 - enter)
        : k;
  const alpha = (k: number) =>
    exiting && k === 0 ? 1 - enter : enter < 1 && k === last ? enter : 1;

  // A value is still in memory iff the current fiber holds that exact
  // reference (or, for primitives, that exact value).
  const alive = (i: number, key: string) =>
    Object.is(list[i].values[key], newest[key]);

  // Rows redefined by the newest commit (on mount, everything is new).
  const fresh = new Set(
    ROWS.filter(
      (row) =>
        list.length === 1 ||
        !Object.is(list[last - 1].values[row.key], newest[row.key]),
    ).map((row) => row.key),
  );

  // Identity runs per row: the run index bumps at every break, so all
  // elements of one unbroken thread share a data-thread id.
  const runIds = new Map<string, number[]>();
  for (const row of ROWS) {
    const ids: number[] = [];
    let run = 0;
    for (let i = 0; i < list.length; i++) {
      if (
        i > 0 &&
        !Object.is(list[i - 1].values[row.key], list[i].values[row.key])
      )
        run++;
      ids.push(run);
    }
    runIds.set(row.key, ids);
  }
  const threadAttr = (key: string, i: number) =>
    ` data-thread="${key}-${runIds.get(key)![i]}"`;

  // Layout, interpolated between flat and stacked by t and positioned by
  // the fractional display index: the front (newest) card sits down-right,
  // older cards recede up-left.
  const dx = (k: number) => LABEL_W + lerp(d(k) * PITCH, d(k) * STACK_DX, t);
  const dy = (k: number) => t * d(k) * STACK_DY;
  const boxTopOf = (i: number) => HEADER_H + dy(i);
  const cx = (i: number) => dx(i) + PITCH / 2;
  const boxH = BOX_PAD * 2 + ROWS.length * ROW_H;
  const cy = (i: number, idx: number) =>
    boxTopOf(i) + BOX_PAD + idx * ROW_H + ROW_H / 2;

  const shelfTop = boxTopOf(last);
  const shelfX = dx(last) + PITCH + SHELF_GAP;
  const width = shelfX + SHELF_W + SIDE_NOTE_W;
  const height = shelfTop + boxH + 16;
  const fade = (i: number, key: string) =>
    alive(i, key) ? "" : ` opacity="${DEAD_OPACITY}"`;
  const flashes = allowFlash && t === 0 && !prefersReducedMotion();

  const parts: string[] = [];

  // Row labels, aligned to the front card's rows.
  for (const [idx, row] of ROWS.entries()) {
    parts.push(
      `<text x="${LABEL_W - 12}" y="${cy(last, idx) + 4}" text-anchor="end"
        fill="var(--color-text-light)">${row.label}</text>`,
    );
  }

  // Cards in depth order, back to front. Per card: first the threads and
  // break marks arriving from the previous card, then the (translucent)
  // box and header, then this card's dots and texts on its face.
  for (const [i, snap] of list.entries()) {
    if (i > 0) {
      const ga = Math.min(alpha(i - 1), alpha(i));
      if (ga < 1) parts.push(`<g opacity="${ga.toFixed(2)}">`);
      for (const [idx, row] of ROWS.entries()) {
        const x1 = cx(i - 1);
        const y1 = cy(i - 1, idx);
        const x2 = cx(i);
        const y2 = cy(i, idx);
        const same = Object.is(
          list[i - 1].values[row.key],
          list[i].values[row.key],
        );
        if (!same) {
          parts.push(
            breakMark((x1 + x2) / 2, (y1 + y2) / 2, !alive(i, row.key)),
          );
          continue;
        }
        // Value rows keep a gap around the text; ref rows thread center
        // to center (the dot draws over the line).
        const seg =
          row.kind === "value"
            ? insetLine(x1, y1, x2, y2, lerp(42, 12, t))
            : ([x1, y1, x2, y2] as const);
        if (seg) {
          parts.push(
            `<line x1="${seg[0]}" y1="${seg[1]}" x2="${seg[2]}" y2="${seg[3]}"
              stroke="var(--color-text-light)" stroke-width="1.5"${fade(i, row.key)}${threadAttr(row.key, i)} />`,
          );
        }
      }
      if (ga < 1) parts.push(`</g>`);
    }

    const bx = dx(i) + BOX_INSET;
    const bt = boxTopOf(i);
    const isNewest = i === last;
    const a = alpha(i);
    if (a < 1) parts.push(`<g opacity="${a.toFixed(2)}">`);
    parts.push(
      `<rect x="${bx}" y="${bt}" width="${BOX_W}" height="${boxH}"
        rx="6" fill="var(--color-bg)" fill-opacity="${CARD_FILL_OPACITY}"
        stroke="${isNewest ? "var(--color-text-light)" : "#e5e5e5"}" />`,
      // Header: above the card when flat, tucked into the card's visible
      // top-left corner when stacked.
      `<text x="${lerp(cx(i), bx + 34, t)}" y="${bt + lerp(-24, 14, t)}"
        text-anchor="middle" font-size="${lerp(13, 11, t).toFixed(1)}"
        ${isNewest ? 'font-weight="600"' : ""}
        fill="var(--color-text)">render ${snap.n}</text>`,
    );
    if (t < 0.999) {
      parts.push(
        `<text x="${cx(i)}" y="${bt - 8}" text-anchor="middle" font-size="11"
          opacity="${(1 - t).toFixed(2)}"
          fill="var(--color-text-lighter)">${esc(snap.trigger)}</text>`,
      );
    }

    for (const [idx, row] of ROWS.entries()) {
      const y = cy(i, idx);
      const title = `<title>${esc(fullValue(snap.values[row.key]))}</title>`;
      if (flashes && i === last && fresh.has(row.key)) {
        parts.push(
          row.kind === "value"
            ? flashRect(cx(i), y, 52)
            : flashDot(cx(i), y),
        );
      }
      if (row.kind === "value") {
        parts.push(
          `<text x="${cx(i)}" y="${y + 4}" text-anchor="middle"
            fill="var(--color-text)"${fade(i, row.key)}${threadAttr(row.key, i)}>${esc(shortValue(snap.query))}${title}</text>`,
        );
      } else {
        parts.push(
          `<circle cx="${cx(i)}" cy="${y}" r="4"
            fill="var(--color-text)"${fade(i, row.key)}${threadAttr(row.key, i)}>${title}</circle>`,
        );
      }
    }
    if (a < 1) parts.push(`</g>`);
  }

  // The memory shelf, aligned to the front card. Hook compartment: solid,
  // tinted. Render-created compartment: dashed, disposable.
  const hookH = BOX_PAD + HOOK_ROWS * ROW_H - 4;
  const propsY = shelfTop + hookH + 8;
  const propsH = shelfTop + boxH - propsY;
  parts.push(
    `<text x="${shelfX + SHELF_W / 2}" y="${shelfTop - 24}" text-anchor="middle"
      font-weight="600" fill="var(--color-text)">in memory</text>`,
    `<rect x="${shelfX}" y="${shelfTop}" width="${SHELF_W}" height="${hookH}"
      rx="6" fill="#eef3f8" stroke="#c9d7e4" />`,
    `<rect x="${shelfX}" y="${propsY}" width="${SHELF_W}" height="${propsH}"
      rx="6" fill="none" stroke="#d5d5d5" stroke-dasharray="4 3" />`,
    `<text x="${shelfX + SHELF_W + 10}" y="${shelfTop + hookH / 2 + 4}"
      font-size="11" fill="var(--color-text-lighter)">hooks · persists</text>`,
    `<text x="${shelfX + SHELF_W + 10}" y="${propsY + propsH / 2 + 4}"
      font-size="11" fill="var(--color-text-lighter)">replaced every render</text>`,
  );

  // Every current value is held in memory: thread the front card into the
  // shelf (drawn on the front card's face, which is the point).
  for (const [idx, row] of ROWS.entries()) {
    const y = cy(last, idx);
    const from =
      row.kind === "value" ? dx(last) + BOX_INSET + BOX_W : cx(last);
    parts.push(
      `<line x1="${from}" y1="${y}" x2="${shelfX}" y2="${y}"
        stroke="var(--color-text-light)" stroke-width="1.5"${threadAttr(row.key, last)} />`,
    );
  }

  // Shelf entries: the current references, formatted. Fresh ones flash:
  // that slot in memory was just rewritten.
  for (const [idx, row] of ROWS.entries()) {
    if (flashes && fresh.has(row.key)) {
      parts.push(flashRect(shelfX + SHELF_W / 2, cy(last, idx), SHELF_W - 8));
    }
    parts.push(
      `<text x="${shelfX + SHELF_W / 2}" y="${cy(last, idx) + 4}"
        text-anchor="middle" fill="var(--color-text)"${threadAttr(row.key, last)}>${esc(fmt(newest[row.key]))}<title>${esc(fullValue(newest[row.key]))}</title></text>`,
    );
  }

  return `<svg width="${width}" height="${height}"
    viewBox="0 0 ${width} ${height}">${parts.join("\n")}</svg>`;
}
