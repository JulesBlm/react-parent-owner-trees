// Resolve a creation-site stack (_debugStack, React 19) to an authored
// source position. The stack's app frame carries the dev server URL plus
// transformed line/column; vite serves each module with an inline
// sourcemap, so fetch the module, decode the VLQ mappings, and walk the
// segment table back to the original file. No dependencies; the decoder
// is the standard base64-VLQ algorithm.

interface RawFrame {
  url: string;
  line: number;
  col: number;
}

// First frame that is application code: skip the jsx runtime and any
// other node_modules / optimized-deps frames above it.
function firstAppFrame(stack: string): RawFrame | null {
  for (const line of stack.split("\n")) {
    const m = line.match(/(https?:\/\/[^\s()]+?):(\d+):(\d+)\)?\s*$/);
    if (!m) continue;
    const [, url, l, c] = m;
    if (url.includes("node_modules") || url.includes("/.vite/")) continue;
    return { url, line: Number(l), col: Number(c) };
  }
  return null;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Map([...B64].map((ch, i) => [ch, i]));

function decodeSegment(seg: string): number[] {
  const out: number[] = [];
  let result = 0;
  let shift = 0;
  for (const ch of seg) {
    const digit = LOOKUP.get(ch);
    if (digit === undefined) break;
    result += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
    } else {
      out.push(result & 1 ? -(result >>> 1) : result >>> 1);
      result = 0;
      shift = 0;
    }
  }
  return out;
}

interface SourceMapJson {
  sources: string[];
  mappings: string;
}

// Decoded per generated line: [genCol, srcIdx, srcLine, srcCol][] with the
// running-accumulator deltas already applied (all absolute, 0-based).
function decodeMappings(map: SourceMapJson): number[][][] {
  const lines: number[][][] = [];
  let srcIdx = 0;
  let srcLine = 0;
  let srcCol = 0;
  for (const lineStr of map.mappings.split(";")) {
    const segs: number[][] = [];
    let genCol = 0;
    if (lineStr)
      for (const segStr of lineStr.split(",")) {
        const d = decodeSegment(segStr);
        if (d.length === 0) continue;
        genCol += d[0];
        if (d.length >= 4) {
          srcIdx += d[1];
          srcLine += d[2];
          srcCol += d[3];
          segs.push([genCol, srcIdx, srcLine, srcCol]);
        }
      }
    lines.push(segs);
  }
  return lines;
}

interface LoadedMap {
  sources: string[];
  lines: number[][][];
}

const mapCache = new Map<string, Promise<LoadedMap | null>>();

function loadMap(url: string): Promise<LoadedMap | null> {
  let cached = mapCache.get(url);
  if (!cached) {
    cached = fetch(url, { headers: { Accept: "*/*" } })
      .then((res) => res.text())
      .then((text) => {
        const m = text.match(
          /\/\/# sourceMappingURL=data:application\/json[^,]*,([A-Za-z0-9+/=]+)/,
        );
        if (!m) return null;
        const json = JSON.parse(atob(m[1])) as SourceMapJson;
        return { sources: json.sources, lines: decodeMappings(json) };
      })
      .catch(() => null);
    mapCache.set(url, cached);
  }
  return cached;
}

// "src/demo/DemoApp.tsx:107:11", or null when the stack has no mappable
// app frame. Paths come back as the map's `sources` entries (absolute fs
// paths under vite); line/column are 1-based for the editor.
export async function locateFromStack(stack: string): Promise<string | null> {
  const frame = firstAppFrame(stack);
  if (!frame) return null;
  const map = await loadMap(frame.url.split("?")[0]);
  if (!map) return null;
  const segs = map.lines[frame.line - 1] ?? [];
  // Nearest segment at or before the frame column (both 0-based here).
  let best: number[] | null = null;
  for (const seg of segs) {
    if (seg[0] > frame.col - 1) break;
    best = seg;
  }
  if (!best) best = segs[0] ?? null;
  if (!best) return null;
  const [, srcIdx, srcLine, srcCol] = best;
  const source = map.sources[srcIdx];
  if (!source) return null;
  // `sources` entries resolve relative to the map's location, which for an
  // inline map is the module URL itself.
  let path = source;
  try {
    path = new URL(source, frame.url).pathname;
  } catch {
    // keep the raw entry (absolute fs paths land here)
  }
  return `${path}:${srcLine + 1}:${srcCol + 1}`;
}
