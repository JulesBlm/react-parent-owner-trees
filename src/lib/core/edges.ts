// Elbows and owner edges: pure geometry and markup. Where the old closure
// accumulated arcLeftExtent as scratch, these functions return the leftmost
// x their path reaches and the caller folds the minimum.
import { BG, TEXT, TEXT_LIGHT } from "./colors";
import { escapeXml, FADE, GRID } from "./types";
import type { ArcStyle, RenderState, Row } from "./types";

// "stadium": the semicircle, uncurled. Radius grows with span as today up
// to STADIUM_R; past that the semicircle splits at its apex and a straight
// segment parallel to the chord makes up the difference, with the cap
// radius growing only logarithmically (so nested spans still separate).
// Circles are the one curve where different sizes are the same shape, so
// unlike ellipses/beziers every edge stays in one visual family, and the
// entry tangents stay perpendicular to the chord like the semicircles'.
const STADIUM_R = 36;
const STADIUM_SPREAD = 10;

// In the owner tree, elbows are ownership drawn as structure (arcs in
// disguise), so the server coloring follows the relation there: every
// elbow whose target is server-created (ghost row or server host row) is
// drawn whole in the server color, so the server crown's links read as
// one colored region and the client subtrees stay plain. Solid, not
// dashed — in the owner tree the relation is structural, and dashes are
// the parent-tree arc language. Mixed-color siblings share a trunk, so
// figures fan their elbows (marks.nudge) into parallel lanes: one visible
// line per child, no overpainting. Parent-tree elbows are containment and
// never carry the color. The horizontal always ends at the child's true
// x, so entries stay on the circles regardless of lane.
export function elbow(
  x1: number,
  y1: number,
  y2: number,
  faded = false,
  serverColor?: string,
  dx = 0,
): string {
  return `<path d="M${x1 + dx},${y1} V${y2} H${x1 + GRID}" fill="none" stroke="${serverColor ?? TEXT}"${faded ? ` opacity="${FADE}"` : ""}${serverColor ? `><title>Server render &#8212; this element was created on the server</title></path>` : " />"}`;
}

// Server-owned arcs: same relation as every other arc (who rendered
// whom), same dash, just the server color — the owned element was created
// during a server render. The arc into a client component stays plain;
// the boundary lives on the 'use client' badge, not the edge.
export function arcPath(d: string, accent: boolean, serverColor?: string): string {
  if (serverColor)
    return `<path d="${d}"
      fill="none" stroke="${serverColor}"${accent ? ' stroke-width="1.5"' : ""} stroke-dasharray="2">
      <title>Server render &#8212; this element was created on the server</title></path>`;
  return `<path d="${d}"
    fill="none" stroke="${accent ? TEXT : TEXT_LIGHT}"${accent ? ' stroke-width="1.5"' : ""} stroke-dasharray="2" />`;
}

// Returns the path data for an owner edge in the given style plus the
// leftmost x and bottommost y the path reaches (so the composer can
// reserve real margin on both axes — a diagonal chord's semicircle bulges
// BELOW the ownee row, not just left of the tree) and the apex: the
// drawn-side extreme where the prop stack's brace makes contact. Stubs
// can reuse the exact geometry of the arc they stand for.
export function ownerArcPath(
  o: Row,
  r: Row,
  style: ArcStyle,
  trimMemo: boolean,
): {
  d: string;
  leftExtent: number;
  bottomExtent: number;
  apexX: number;
  apexY: number;
} {
  const ox = o.x;
  const oy = o.y;
  const rx = r.x;
  const ry = r.y;
  const d = Math.hypot(rx - ox, ry - oy);
  // A memo'd ownee receives its props at the comparison gate, not at the
  // function: every style ends the edge on the memo ring.
  const trim = trimMemo && d > 20 ? 6.5 : 0;

  const half = d / 2;
  const ux = (rx - ox) / (d || 1);
  const uy = (ry - oy) / (d || 1);
  // The drawn (sweep 0) side lies toward (-uy, ux) from the chord.
  const vx = -uy;
  const vy = ux;

  if (style === "stadium" && half > STADIUM_R) {
    const R = STADIUM_R + STADIUM_SPREAD * Math.log(half / STADIUM_R);
    // Cap centers sit on the chord, one radius in from each endpoint; the
    // apexes sit one radius to the drawn side. Owner cap, straight run
    // parallel to the chord, ownee cap. At 2R of span this is exactly the
    // semicircle.
    const p1x = ox + R * ux;
    const p1y = oy + R * uy;
    const p2x = rx - R * ux;
    const p2y = ry - R * uy;
    const a1x = p1x + R * vx;
    const a1y = p1y + R * vy;
    const a2x = p2x + R * vx;
    const a2y = p2y + R * vy;
    let ex = rx;
    let ey = ry;
    if (trim) {
      const t = trim / R;
      ex = p2x + R * (Math.cos(t) * ux + Math.sin(t) * vx);
      ey = p2y + R * (Math.cos(t) * uy + Math.sin(t) * vy);
    }
    // When the drawn side has any downward component (vy > 0, i.e. the
    // ownee is indented right of the owner) a cap can reach a full R
    // below its center; straight-down may sit just outside the cap's
    // quarter sweep, so this over-reserves by at most R(1 - vy) of
    // whitespace, never clips.
    const capDrop = vy > 0 ? R : 0;
    return {
      d: `M${ox},${oy} A${R},${R} 0,0,0 ${a1x},${a1y} L${a2x},${a2y} A${R},${R} 0,0,0 ${ex},${ey}`,
      leftExtent: Math.min(ox, rx, p1x - R, p2x - R),
      bottomExtent: Math.max(oy, ry, a1y, a2y, p1y + capDrop, p2y + capDrop),
      // Midpoint of the straight run: the stadium's drawn-side extreme.
      apexX: (a1x + a2x) / 2,
      apexY: (a1y + a2y) / 2,
    };
  }

  // The original semicircle: radius half the chord, endpoints diametric.
  const cx = (ox + rx) / 2;
  const cy = (oy + ry) / 2;
  // Walk trim/half radians back from the endpoint along the drawn side.
  let ex = rx;
  let ey = ry;
  if (trim) {
    const t = trim / half;
    ex = cx + half * (Math.cos(t) * ux + Math.sin(t) * vx);
    ey = cy + half * (Math.cos(t) * uy + Math.sin(t) * vy);
  }
  return {
    d: `M${ox},${oy} A${half},${half} 0,0,0 ${ex},${ey}`,
    leftExtent: Math.min(ox, rx, cx - half),
    // Straight-down lies on the drawn half exactly when the bulge has a
    // downward component; on a vertical chord cy + half = ry, so the
    // formula degrades to the endpoint on its own.
    bottomExtent: vy > 0 ? cy + half : Math.max(oy, ry),
    apexX: cx + half * vx,
    apexY: cy + half * vy,
  };
}

// --- Props display ---------------------------------------------------------
// Received props are a fact about the owner edge delivered to the ownee,
// and selection is the reveal. Two forms share the work: radial spokes on
// the arc (the notation's preferred form) and the under-row stack (the
// universal fallback — crowded bows, the owner tree, rows with no arc in
// view). Both are deliberately NOT the memo badge's { } pair: received
// props and the ownee's retained snapshot must never share a mark.
const PROP_CAP = 6;
const PROP_LINE = 12;
// 10px monospace (13px ≈ 7.8px/char, scaled down).
const PROP_CHAR_W = 6;

function propLines(props: string[]): string[] {
  const shown = props.length > PROP_CAP ? props.slice(0, PROP_CAP - 1) : props;
  return props.length > shown.length
    ? [...shown, `+${props.length - shown.length} more`]
    : shown;
}

// The under-row form: props hanging directly below the receiving row — a
// horizontal gathering brace, cusp up at the glyph where the arc lands,
// names stacked beneath. Overlays whatever follows the row, which the
// selection focus has already faded; the composer paints it in the
// overlay layer (last) with haloed text.
export function underProps(
  r: Row,
  props: string[],
): { svg: string; bottom: number } {
  const lines = propLines(props);
  const widest = Math.max(...lines.map((l) => l.length), 0);
  const bw = Math.min(Math.max(widest * PROP_CHAR_W, 24), 70);
  const bx = r.x - 4;
  const by = r.y + 11;
  const cuspX = r.x + 3;
  const brace = `<path d="M${bx},${by + 4} Q${bx},${by} ${bx + 5},${by} H${cuspX - 5} Q${cuspX},${by} ${cuspX},${by - 5} Q${cuspX},${by} ${cuspX + 5},${by} H${bx + bw - 5} Q${bx + bw},${by} ${bx + bw},${by + 4}"
    fill="none" stroke="${TEXT_LIGHT}" />`;
  const text = lines
    .map(
      (line, i) =>
        `<text x="${bx}" y="${by + 10 + i * PROP_LINE}" dy="0.32em"
      font-size="10" fill="${TEXT_LIGHT}"
      paint-order="stroke" stroke="${BG}" stroke-width="3">${escapeXml(line)}</text>`,
    )
    .join("");
  return {
    svg: `<g pointer-events="none">
      <title>Props ${escapeXml(r.node.name)} received from its owner</title>${brace}${text}</g>`,
    bottom: by + 10 + (lines.length - 1) * PROP_LINE + 8,
  };
}

// Point on the drawn owner edge at fraction f of its length, with the
// outward normal (away from the curve's center, i.e. the convex side)
// and the tangent direction of travel. Shared parametrization for both
// styles; the small stadium degenerates to the semicircle exactly as the
// path builder does.
function arcPointAt(
  o: Row,
  r: Row,
  style: ArcStyle,
  f: number,
): { x: number; y: number; nx: number; ny: number; tx: number; ty: number } {
  const ox = o.x;
  const oy = o.y;
  const rx = r.x;
  const ry = r.y;
  const d = Math.hypot(rx - ox, ry - oy);
  const half = d / 2;
  const ux = (rx - ox) / (d || 1);
  const uy = (ry - oy) / (d || 1);
  const vx = -uy;
  const vy = ux;
  // The drawn side sweeps by negative rotation: normal n(a) = start
  // normal rotated by -a, tangent = n rotated a further -90° = (ny,-nx).
  const sweep = (
    cx: number,
    cy: number,
    R: number,
    sx: number,
    sy: number,
    a: number,
  ) => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const nx = sx * ca + sy * sa;
    const ny = -sx * sa + sy * ca;
    return { x: cx + R * nx, y: cy + R * ny, nx, ny, tx: ny, ty: -nx };
  };
  if (style === "stadium" && half > STADIUM_R) {
    const R = STADIUM_R + STADIUM_SPREAD * Math.log(half / STADIUM_R);
    const run = d - 2 * R;
    const cap = (Math.PI / 2) * R;
    const s = f * (2 * cap + run);
    const p1x = ox + R * ux;
    const p1y = oy + R * uy;
    const p2x = rx - R * ux;
    const p2y = ry - R * uy;
    if (s <= cap) return sweep(p1x, p1y, R, -ux, -uy, ((s / cap) * Math.PI) / 2);
    if (s >= cap + run)
      return sweep(p2x, p2y, R, vx, vy, (((s - cap - run) / cap) * Math.PI) / 2);
    const t = (s - cap) / run;
    return {
      x: p1x + R * vx + (p2x - p1x) * t,
      y: p1y + R * vy + (p2y - p1y) * t,
      nx: vx,
      ny: vy,
      tx: ux,
      ty: uy,
    };
  }
  return sweep((ox + rx) / 2, (oy + ry) / 2, half, -ux, -uy, Math.PI * f);
}

// The radial form: each prop name a straight label lying along the arc's
// NORMAL at its anchor — a spoke, 90° from the tangent. Where the arc
// runs vertically (the apex) the label is horizontal; as the bow turns,
// the labels fan with it. Labels flip to stay upright and keep one end
// at the stroke. They extend beyond the curve, so the caller must fold
// the returned extents into the canvas reservation. Returns null when
// the fan cannot keep its pitch on this bow (many props, short arc) —
// the caller falls back to the under-row form.
export function radialProps(
  o: Row,
  r: Row,
  style: ArcStyle,
  props: string[],
): { svg: string; leftExtent: number; bottom: number } | null {
  // No cap here: the fit guard below is the only limit. A bow with room
  // for the walk shows the WHOLE payload (that room is the point of the
  // radial form); one without any falls back to the under-row stack,
  // which carries the +n overflow instead.
  const lines = props;
  // Spokes start just below the owner's departure and step DOWN the bow
  // at a fixed arc-length pitch — the payload is listed where the edge
  // leaves its author, and a longer list simply walks further down. No
  // distribution math, no apex significance.
  const chord = Math.hypot(r.x - o.x, r.y - o.y);
  const half = chord / 2;
  const R =
    style === "stadium" && half > STADIUM_R
      ? STADIUM_R + STADIUM_SPREAD * Math.log(half / STADIUM_R)
      : half;
  const arcLen =
    style === "stadium" && half > STADIUM_R
      ? Math.PI * R + (chord - 2 * R)
      : Math.PI * half;
  const LEAD = 12;
  const PITCH = 14;
  if (LEAD + lines.length * PITCH > 0.92 * arcLen) return null;
  let leftExtent = 0;
  let bottom = 0;
  // Small bows hang their spokes on the outside (the inside is cramped
  // against the tree); large bows flip them to the INSIDE, where the
  // concave lane is wide open and the labels don't push the margin out.
  const inside = chord > 150;
  const labels = lines.map((name, i) => {
    const f = (LEAD + i * PITCH) / arcLen;
    const p = arcPointAt(o, r, style, f);
    const dx = inside ? -p.nx : p.nx;
    const dy = inside ? -p.ny : p.ny;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    let anchor: "start" | "end" = "start";
    // Upside-down spokes flip 180° and anchor at their end, so the text
    // body stays on its side of the curve with one end at the stroke.
    if (deg > 90 || deg < -90) {
      deg += deg > 0 ? -180 : 180;
      anchor = "end";
    }
    const gap = 6;
    const ax = p.x + dx * gap;
    const ay = p.y + dy * gap;
    const far = gap + name.length * PROP_CHAR_W + 4;
    leftExtent = Math.min(leftExtent, p.x + dx * far);
    bottom = Math.max(bottom, p.y + Math.max(dy * far, 0), ay + 6);
    return `<text transform="translate(${ax},${ay}) rotate(${deg})"
      text-anchor="${anchor}" dy="0.32em" font-size="10" fill="${TEXT_LIGHT}"
      paint-order="stroke" stroke="${BG}" stroke-width="3">${escapeXml(name)}</text>`;
  });
  return {
    svg: `<g pointer-events="none">
    <title>Props ${escapeXml(r.node.name)} received from its owner</title>${labels.join("")}</g>`,
    leftExtent,
    bottom,
  };
}

export function ownerArc(
  o: Row,
  r: Row,
  accent: boolean,
  state: RenderState,
): {
  svg: string;
  leftExtent: number;
  bottomExtent: number;
  apexX: number;
  apexY: number;
} {
  // Colored iff the OWNED node is server-created. A server component's
  // owner is always a server component (client renders never produce
  // server components), so this partitions the arcs exactly like the
  // owner-tree links: server-colored into the server crown, plain into
  // client components.
  const { d, leftExtent, bottomExtent, apexX, apexY } = ownerArcPath(
    o,
    r,
    state.arcStyle,
    Boolean(r.node.memo) && state.marks.memo,
  );
  return {
    svg: arcPath(d, accent, r.node.server ? state.opt.serverColor : undefined),
    leftExtent,
    bottomExtent,
    apexX,
    apexY,
  };
}
