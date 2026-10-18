// Area markup: the tinted rects showing what a clickable row governs —
// context areas (scope of possible consumers), exclusive catch regions,
// inclusive profiler/activity regions, and server regions. Pure given rows,
// canvas width, and RenderState.
//
// Each area renders as one translated <g> (the row/card idiom): the group
// carries a data attribute as the unit handle for styling and highlighting,
// and everything inside is in area-local coordinates.
import { boundaryColor, boundaryKind } from "./colors";
import type { BoundaryKind } from "./colors";
import type { RenderState, Row } from "./types";
import { escapeXml, GRID } from "./types";

// One past the last row of the subtree rooted at rows[i]: flattening puts
// a subtree directly after its root, at greater depth.
function subtreeEnd(rows: Row[], i: number): number {
  let end = i + 1;
  while (end < rows.length && rows[end].depth > rows[i].depth) end++;
  return end;
}

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
    if (p === -1) {
      continue;
    }

    const provider = rows[p];
    const end = subtreeEnd(rows, p);
    const color = state.colors.color(id);
    const left = provider.x - GRID / 2;
    const areaW = width - 1.5 * GRID - left;
    const height = (end - p) * GRID;

    // Group anchored at (left edge, provider row): local x is distance
    // into the area, local y distance below the provider's row — the
    // right-edge cluster (dot, value, name) all sits at y 0.
    const parts: string[] = [];
    parts.push(`<rect x="0" y="${-GRID / 2}" width="${areaW}"
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
    const valueX = areaW - 10 - slot * 14;
    slot++;
    const value = provider.node.contextValue;
    parts.push(
      `${
        value
          ? `<text x="${valueX-8}" y="0" dominant-baseline="middle" text-anchor="end" data-test-id="context-value"
          font-size="10" font-style="italic" fill="${color}">${escapeXml(value)}</text>`
          : ""
      }<circle cx="${valueX}" cy="0" r="4" fill="${color}">
        <title>Current ${contextName(id)} value</title></circle>
        <text x="${areaW - 2}" y="-19" dominant-baseline="middle" text-anchor="end" data-test-id="context-value"
          font-size="10" font-style="italic" fill="${color}">${contextName(id)}</text>`,
    );
    for (let i = p + 1; i < end; i++) {
      if (!rows[i].node.contexts?.includes(id)) {
        continue;
      }
      const nameEnd = rows[i].x + 6 + rows[i].node.name.length * 7.8 + 4;

      parts.push(`<path d="M${valueX},0 V${rows[i].y - provider.y} H${nameEnd - left}"
        fill="none" stroke="${color}" stroke-width="1" opacity="0.8">
        <title>${rows[i].node.name} reads ${contextName(id)} here (useContext)</title></path>`);
    }
    areas.push(
      `<g data-context-id="${escapeXml(id)}" transform="translate(${left},${provider.y})">${parts.join("")}</g>`,
    );
  }
  return areas.join("");
}

// Which rows of the boundary's subtree [p+1, end) its area does NOT cover.
// Catch regions (suspense, error, viewtransition) are EXCLUSIVE:
//  - The boundary's OWN fallback branch is out entirely, row and subtree —
//    the area is what the fallback replaces, and an error in the fallback
//    propagates to the next boundary out.
//  - A nested same-kind boundary's SUBTREE is out, since the nearest
//    boundary catches — but the nested boundary's own row stays in: if it
//    throws or suspends while rendering itself, THIS boundary catches.
// Profiler and Activity areas are INCLUSIVE: nested Profilers all measure
// the same work, and a nested Activity stays under the outer one's
// control, so nothing is excluded.
function excludedRows(
  rows: Row[],
  p: number,
  end: number,
  id: string,
  kind: BoundaryKind,
): Set<number> {
  const excluded = new Set<number>();
  if (kind === "profiler" || kind === "activity") return excluded;
  for (let i = p + 1; i < end; i++) {
    const ownFallback = rows[i].node.fallbackOf === id;
    if (!ownFallback && boundaryKind(rows[i].node) !== kind) continue;
    if (ownFallback) excluded.add(i);
    const stop = subtreeEnd(rows, i);
    for (let j = i + 1; j < stop; j++) excluded.add(j);
  }
  return excluded;
}

// Contiguous stretches of included rows in [from, to), as [start, stop)
// pairs — each stretch becomes one tinted rect.
function contiguousRuns(
  from: number,
  to: number,
  included: (i: number) => boolean,
): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  for (let i = from; i < to; i++) {
    if (!included(i)) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else runs.push([i, i + 1]);
  }
  return runs;
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
    const end = subtreeEnd(rows, p);

    const excluded = excludedRows(rows, p, end, id, kind);
    const runs = contiguousRuns(p + 1, end, (i) => !excluded.has(i));

    const badge = boundary.node.profilerId ?? boundary.node.vtName;
    const displayName = boundary.node.name + (badge ? ` "${badge}"` : "");
    const mode = boundary.node.hidden ? "hidden" : "visible";
    const closest = `${displayName} (${boundary.node.id}) is the closest ${kind} boundary here`;
    const areaTitle = {
      suspense: closest,
      error: closest,
      viewtransition: `${displayName} animates this subtree as one unit`,
      profiler: `${displayName} measures every render in this area`,
      activity: `${displayName} controls this subtree; currently ${mode}`,
    }[kind];
    const tag = state.marks.ids ? ` (${boundary.node.id})` : "";
    const areaLabel = {
      suspense: `catches: ${displayName}${tag}`,
      error: `catches: ${displayName}${tag}`,
      viewtransition: `animates: ${displayName}${tag}`,
      profiler: `measures: ${displayName}${tag}`,
      activity: `covers: ${displayName}${tag} &#183; ${mode}`,
    }[kind];
    // Group anchored at the boundary's row: local coordinates are each
    // run's offset right of and below the boundary that governs it.
    const right = width - 1.5 * GRID - boundary.x;
    const parts: string[] = [];
    runs.forEach(([start, stop], runIndex) => {
      const left =
        Math.min(...rows.slice(start, stop).map((r) => r.x)) -
        GRID / 2 -
        boundary.x;
      const y = rows[start].y - GRID / 2 - boundary.y;
      let height = (stop - start) * GRID;
      if (runIndex === runs.length - 1) {
        const needed = cardBottoms?.get(id);
        if (needed) height = Math.max(height, needed - boundary.y - y);
      }
      parts.push(`<rect x="${left}" y="${y}" width="${right - left}"
          height="${height}" rx="2" fill="${color}" fill-opacity="0.07"
          stroke="${color}" stroke-opacity="0.3">
          <title>${areaTitle}</title>
        </rect>${
          runIndex === 0
            ? `<text x="${right - 6}" y="${y + 8}" text-anchor="end" dominant-baseline="middle"
          font-size="10" font-style="italic" fill="${color}">${areaLabel}</text>`
            : ""
        }`);
    });
    if (parts.length > 0)
      areas.push(
        `<g data-boundary-id="${escapeXml(id)}" transform="translate(${boundary.x},${boundary.y})">${parts.join("")}</g>`,
      );
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
    const areaW = width - 1.5 * GRID - left;
    const y = rows[i].y - GRID / 2;
    const height = (j - i) * GRID;
    regions.push(`<g data-server-region transform="translate(${left},${y})"><rect x="0" y="0" width="${areaW}"
        height="${height}" rx="2" fill="${serverColor}" fill-opacity="0.08"
        stroke="${serverColor}" stroke-opacity="0.25">
        <title>Rendered on the server</title>
      </rect>
      <text x="${areaW - 6}" y="8" text-anchor="end"
        font-size="10" font-style="italic" fill="${serverColor}">server</text></g>`);
    i = j;
  }
  return regions.join("");
}
