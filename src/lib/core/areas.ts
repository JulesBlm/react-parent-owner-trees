// Area markup: the tinted rects showing what a clickable row governs —
// context areas (scope of possible consumers), exclusive catch regions,
// inclusive profiler/activity regions, and server regions. Pure given rows,
// canvas width, and RenderState.
import { boundaryColor, boundaryKind } from "./colors";
import { escapeXml, GRID } from "./types";
import type { RenderState, Row } from "./types";

export function contextAreaMarkup(
  rows: Row[],
  width: number,
  state: RenderState,
): string {
  const contextName = state.opt.contextName;
  const areas: string[] = [];
  let slot = 0;
  for (const id of state.activeContexts) {
    const p = rows.findIndex((r) => r.node.contextProvider === id);
    if (p === -1) continue;
    const provider = rows[p];
    let end = p + 1;
    while (end < rows.length && rows[end].depth > provider.depth) end++;
    const color = state.colors.color(id);
    const left = provider.x - GRID / 2;
    const right = width - 1.5 * GRID;
    const y = provider.y - GRID / 2;
    const height = (end - p) * GRID;
    areas.push(`<rect x="${left}" y="${y}" width="${right - left}"
        height="${height}" rx="2" fill="${color}" fill-opacity="0.07"
        stroke="${color}" stroke-opacity="0.3">
        <title>All components within this area can consume ${contextName(id)}</title>
      </rect>`);
    // The published parent-owners-context convention: the context value is
    // a filled dot at the area's right edge on the provider's row, and a
    // delivery line runs from it down the edge and left into each
    // component that actually reads the context (useContext), ending at
    // the consumer's name. Monospace makes the name width predictable.
    // The context's name hangs just under its provider's row at the
    // area's right edge: each provider has its own row, so stacked
    // areas can't collide there, unlike the shared bottom-right corner
    // where co-terminating areas overlapped. End-anchored so long
    // names grow into the area instead of past the canvas edge.
    const valueX = right - 10 - slot * 14;
    slot++;
    const value = provider.node.contextValue;
    areas.push(
      `${
        value
          ? `<text x="${valueX}" y="${provider.y}" dy="-0.8em" text-anchor="middle"
          font-size="10" font-style="italic" fill="${color}">${escapeXml(value)}</text>`
          : ""
      }<circle cx="${valueX}" cy="${provider.y}" r="4" fill="${color}">
        <title>Current ${contextName(id)} value</title></circle>
        <text x="${right - 2}" y="${provider.y}" dy="1.5em" text-anchor="end"
          font-size="10" font-style="italic" fill="${color}">${contextName(id)}</text>`,
    );
    for (let i = p + 1; i < end; i++) {
      if (!rows[i].node.contexts?.includes(id)) continue;
      const nameEnd = rows[i].x + 6 + rows[i].node.name.length * 7.8 + 4;
      areas.push(`<path d="M${valueX},${provider.y} V${rows[i].y} H${nameEnd}"
        fill="none" stroke="${color}" stroke-width="1" opacity="0.8">
        <title>${rows[i].node.name} reads ${contextName(id)} here (useContext)</title></path>`);
    }
  }
  return areas.join("");
}

export function boundaryAreaMarkup(
  rows: Row[],
  width: number,
  state: RenderState,
  // bid -> bottom y its fallback annex card needs; the area's last run
  // stretches down so the card stays inside the region it will claim.
  cardBottoms?: Map<string, number>,
): string {
  const areas: string[] = [];
  for (const id of state.activeBoundaries) {
    const p = rows.findIndex((r) => r.node.id === id);
    if (p === -1) continue;
    const boundary = rows[p];
    const kind = boundaryKind(boundary.node);
    if (!kind) continue;
    const color = boundaryColor(kind);
    let end = p + 1;
    while (end < rows.length && rows[end].depth > boundary.depth) end++;

    // Catch regions are EXCLUSIVE: nested same-kind subtrees are skipped,
    // since the nearest boundary catches. (The nested boundary's own row
    // stays included: if it throws or suspends while rendering itself,
    // THIS boundary still catches.) The boundary's OWN fallback branch
    // is skipped entirely — the area is what the fallback replaces, and
    // an error in the fallback propagates to the next boundary out.
    // Profiler and Activity areas are INCLUSIVE: nested Profilers all
    // measure the same work, and a nested Activity stays under the
    // outer one's control, so the area is the whole subtree with no
    // subtraction.
    const runs: Array<[number, number]> = [];
    if (kind === "profiler" || kind === "activity") {
      if (end > p + 1) runs.push([p + 1, end]);
    } else {
      let i = p + 1;
      let runStart = -1;
      while (i < end) {
        if (rows[i].node.fallbackOf === id) {
          if (runStart !== -1 && runStart < i) runs.push([runStart, i]);
          runStart = -1;
          let j = i + 1;
          while (j < end && rows[j].depth > rows[i].depth) j++;
          i = j;
          continue;
        }
        if (runStart === -1) runStart = i;
        if (boundaryKind(rows[i].node) === kind) {
          runs.push([runStart, i + 1]);
          runStart = -1;
          let j = i + 1;
          while (j < end && rows[j].depth > rows[i].depth) j++;
          i = j;
          continue;
        }
        i++;
      }
      if (runStart !== -1) runs.push([runStart, end]);
    }

    const badge = boundary.node.profilerId ?? boundary.node.vtName;
    const displayName = boundary.node.name + (badge ? ` "${badge}"` : "");
    const mode = boundary.node.hidden ? "hidden" : "visible";
    const areaTitle =
      kind === "profiler"
        ? `${displayName} measures every render in this area`
        : kind === "activity"
          ? `${displayName} controls this subtree; currently ${mode}`
          : kind === "viewtransition"
            ? `${displayName} animates this subtree as one unit`
            : `${displayName} (${boundary.node.id}) is the closest ${kind} boundary here`;
    const tag = state.marks.ids ? ` (${boundary.node.id})` : "";
    const areaLabel =
      kind === "profiler"
        ? `measures: ${displayName}${tag}`
        : kind === "activity"
          ? `covers: ${displayName}${tag} &#183; ${mode}`
          : kind === "viewtransition"
            ? `animates: ${displayName}${tag}`
            : `catches: ${displayName}${tag}`;
    const right = width - 1.5 * GRID;
    runs.forEach(([start, stop], runIndex) => {
      const left =
        Math.min(...rows.slice(start, stop).map((r) => r.x)) - GRID / 2;
      const y = rows[start].y - GRID / 2;
      let height = (stop - start) * GRID;
      if (runIndex === runs.length - 1) {
        const needed = cardBottoms?.get(id);
        if (needed) height = Math.max(height, needed - y);
      }
      areas.push(`<rect x="${left}" y="${y}" width="${right - left}"
          height="${height}" rx="2" fill="${color}" fill-opacity="0.07"
          stroke="${color}" stroke-opacity="0.3">
          <title>${areaTitle}</title>
        </rect>${
          runIndex === 0
            ? `<text x="${right - 6}" y="${y + 8}" text-anchor="end"
          font-size="10" font-style="italic" fill="${color}">${areaLabel}</text>`
            : ""
        }`);
    });
  }
  return areas.join("");
}

// ContextRect-style region marking (parent-owners-context post):
// translucent tinted rects behind contiguous runs of server rows,
// labelled in italics.
export function serverRegionMarkup(
  rows: Row[],
  width: number,
  serverColor: string,
): string {
  const regions: string[] = [];
  let i = 0;
  while (i < rows.length) {
    if (!rows[i].node.server) {
      i++;
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j].node.server) j++;
    const run = rows.slice(i, j);
    const left = Math.min(...run.map((r) => r.x)) - GRID / 2;
    const right = width - 1.5 * GRID;
    const y = rows[i].y - GRID / 2;
    const height = (j - i) * GRID;
    regions.push(`<rect x="${left}" y="${y}" width="${right - left}"
        height="${height}" rx="2" fill="${serverColor}" fill-opacity="0.08"
        stroke="${serverColor}" stroke-opacity="0.25">
        <title>Rendered on the server</title>
      </rect>
      <text x="${right - 6}" y="${y + 8}" text-anchor="end"
        font-size="10" font-style="italic" fill="${serverColor}">server</text>`);
    i = j;
  }
  return regions.join("");
}
