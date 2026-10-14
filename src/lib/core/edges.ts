// Elbows and owner edges: pure geometry and markup. Where the old closure
// accumulated arcLeftExtent as scratch, these functions return the leftmost
// x their path reaches and the caller folds the minimum.
import { TEXT, TEXT_LIGHT } from "./colors";
import { FADE, GRID } from "./types";
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
// "bracket": fixed corner radius; long edges run in a straight lane.
const BRACKET_CAP = 14;

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
// leftmost x the path reaches (so the composer can reserve real margin),
// so stubs can reuse the exact geometry of the arc they stand for.
export function ownerArcPath(
  o: Row,
  r: Row,
  style: ArcStyle,
  trimMemo: boolean,
): { d: string; leftExtent: number } {
  const ox = o.x;
  const oy = o.y;
  const rx = r.x;
  const ry = r.y;
  const d = Math.hypot(rx - ox, ry - oy);
  // A memo'd ownee receives its props at the comparison gate, not at the
  // function: every style ends the edge on the memo ring.
  const trim = trimMemo && d > 20 ? 6.5 : 0;

  // The bracket without the radius: hard right angles in the same lane.
  // No caps, so no degenerate case at short spans.
  if (style === "square") {
    const lane = Math.min(ox, rx) - BRACKET_CAP;
    return { d: `M${ox},${oy} H${lane} V${ry} H${rx - trim}`, leftExtent: lane };
  }

  // Rounded orthogonal routing in a lane left of both endpoints.
  // Degenerates below two corner radii of vertical span, where the
  // ellipse (= circle at this size) is prettier anyway.
  if (style === "bracket" && Math.abs(ry - oy) > 2 * BRACKET_CAP + 2) {
    const lane = Math.min(ox, rx) - BRACKET_CAP;
    const s = ry > oy ? 1 : -1;
    const sweep = s === 1 ? 0 : 1;
    const c = BRACKET_CAP;
    return {
      d: `M${ox},${oy} H${lane + c} A${c},${c} 0,0,${sweep} ${lane},${oy + s * c} V${ry - s * c} A${c},${c} 0,0,${sweep} ${lane + c},${ry} H${rx - trim}`,
      leftExtent: lane,
    };
  }

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
    return {
      d: `M${ox},${oy} A${R},${R} 0,0,0 ${a1x},${a1y} L${a2x},${a2y} A${R},${R} 0,0,0 ${ex},${ey}`,
      leftExtent: Math.min(ox, rx, p1x - R, p2x - R),
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
  };
}

export function ownerArc(
  o: Row,
  r: Row,
  accent: boolean,
  state: RenderState,
): { svg: string; leftExtent: number } {
  // Colored iff the OWNED node is server-created. A server component's
  // owner is always a server component (client renders never produce
  // server components), so this partitions the arcs exactly like the
  // owner-tree links: server-colored into the server crown, plain into
  // client components.
  const { d, leftExtent } = ownerArcPath(
    o,
    r,
    state.arcStyle,
    Boolean(r.node.memo) && state.marks.memo,
  );
  return {
    svg: arcPath(d, accent, r.node.server ? state.opt.serverColor : undefined),
    leftExtent,
  };
}
