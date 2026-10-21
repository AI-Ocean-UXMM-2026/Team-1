import { buildStraightLineMatrix, haversineKm } from "./matrix.ts";
import type { DispatchParams, Matrix, Point } from "./types.ts";

/*
 * Road matrix from the Mapbox Matrix API (profile "driving": up to 25
 * coordinates and 60 requests a minute; "driving-traffic" allows only 10 and 30).
 * Nodes are split into blocks of 12 along a Hilbert curve so each block is
 * spatially compact; one request carries the union of two blocks (at most 24
 * coordinates, 576 elements). Pairs that were not fetched, or that Mapbox
 * returned as null, are estimated from straight-line values scaled by a ratio
 * measured on the pairs that were fetched, and the plan is labelled accordingly.
 */

export type RoadMatrixDeps = {
  fetch: typeof fetch;
  token: string;
  baseUrl?: string;
  sleep?: (ms: number) => Promise<void>;
};

export type RoadMatrixStats = {
  requests: number;
  failedRequests: number;
  tilesPlanned: number;
  tilesFetched: number;
  elementsBilled: number;
  realPairs: number;
  totalPairs: number;
  coverage: number;
};

const BLOCK = 12;
const BANDS = [2, 5, 10];

/** Distance along a Hilbert curve for a point scaled onto a 2^16 grid. */
function hilbertIndex(x: number, y: number) {
  let d = 0;
  const side = 1 << 16;
  for (let s = side >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = side - 1 - x;
        y = side - 1 - y;
      }
      [x, y] = [y, x];
    }
  }
  return d;
}

export function hilbertOrder(points: Point[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const minLng = Math.min(...lngs);
  const spanLat = Math.max(...lats) - minLat || 1;
  const spanLng = Math.max(...lngs) - minLng || 1;
  return points
    .map((p, index) => ({
      index,
      d: hilbertIndex(
        Math.floor(((p.lng - minLng) / spanLng) * 65535),
        Math.floor(((p.lat - minLat) / spanLat) * 65535),
      ),
    }))
    .sort((a, b) => a.d - b.d || a.index - b.index)
    .map((entry) => entry.index);
}

type Tile = { nodes: number[]; gap: number; order: number };

function blockBox(points: Point[], nodes: number[]) {
  const lats = nodes.map((i) => points[i].lat);
  const lngs = nodes.map((i) => points[i].lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

/** Gap in km between two bounding boxes (0 when they overlap). */
function boxGapKm(
  a: ReturnType<typeof blockBox>,
  b: ReturnType<typeof blockBox>,
) {
  const dLat = Math.max(0, a.minLat - b.maxLat, b.minLat - a.maxLat) * 111;
  const midLat = (a.minLat + a.maxLat + b.minLat + b.maxLat) / 4;
  const dLng =
    Math.max(0, a.minLng - b.maxLng, b.minLng - a.maxLng) *
    111 *
    Math.cos((midLat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/**
 * Tiles to fetch, nearest block pairs first, stopping at the request and
 * element budget. Exported for tests and for showing the cost before a run.
 */
export function planTiles(
  points: Point[],
  budget: { maxRequests: number; maxElements: number },
): { tiles: Tile[]; totalTiles: number } {
  const order = hilbertOrder(points);
  const blocks: number[][] = [];
  for (let i = 0; i < order.length; i += BLOCK)
    blocks.push(order.slice(i, i + BLOCK));
  const boxes = blocks.map((nodes) => blockBox(points, nodes));
  const all: Tile[] = [];
  if (blocks.length === 1) all.push({ nodes: blocks[0], gap: 0, order: 0 });
  for (let a = 0; a < blocks.length; a++)
    for (let b = a + 1; b < blocks.length; b++)
      all.push({
        nodes: [...blocks[a], ...blocks[b]],
        gap: boxGapKm(boxes[a], boxes[b]),
        order: all.length,
      });
  all.sort((x, y) => x.gap - y.gap || x.order - y.order);
  const tiles: Tile[] = [];
  let elements = 0;
  for (const tile of all) {
    const cost = tile.nodes.length ** 2;
    if (
      tiles.length >= budget.maxRequests ||
      elements + cost > budget.maxElements
    )
      break;
    tiles.push(tile);
    elements += cost;
  }
  return { tiles, totalTiles: all.length };
}

type MatrixResponse = {
  code?: string;
  durations?: (number | null)[][];
  distances?: (number | null)[][];
};

async function fetchTile(
  tile: Tile,
  points: Point[],
  deps: RoadMatrixDeps,
): Promise<MatrixResponse | null> {
  const coordinates = tile.nodes
    .map((i) => `${points[i].lng.toFixed(6)},${points[i].lat.toFixed(6)}`)
    .join(";");
  const url =
    `${deps.baseUrl ?? "https://api.mapbox.com"}/directions-matrix/v1/mapbox/driving/${coordinates}` +
    `?annotations=duration,distance&access_token=${encodeURIComponent(deps.token)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await deps.fetch(url);
      if (response.ok) {
        const body = (await response.json()) as MatrixResponse;
        return body.code === "Ok" || body.code == null ? body : null;
      }
      if (response.status !== 429 && response.status < 500) return null;
    } catch {
      // Network failure: retry once, then give up on this tile.
    }
    if (attempt === 0)
      await (deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(
        400,
      );
  }
  return null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const bandOf = (km: number) => {
  const index = BANDS.findIndex((limit) => km < limit);
  return index < 0 ? BANDS.length : index;
};

export async function buildRoadMatrix(
  points: Point[],
  params: Pick<
    DispatchParams,
    | "speedKmh"
    | "roadFactor"
    | "truckTimeFactor"
    | "trafficMultiplier"
    | "maxMatrixElements"
    | "maxMatrixRequests"
  >,
  deps: RoadMatrixDeps | null,
  concurrency = 6,
): Promise<{ matrix: Matrix; stats: RoadMatrixStats }> {
  const base = buildStraightLineMatrix(points, params);
  const n = points.length;
  const totalPairs = n * (n - 1);
  const empty: RoadMatrixStats = {
    requests: 0,
    failedRequests: 0,
    tilesPlanned: 0,
    tilesFetched: 0,
    elementsBilled: 0,
    realPairs: 0,
    totalPairs,
    coverage: 0,
  };
  if (!deps?.token || n < 2) return { matrix: base, stats: empty };

  const { tiles } = planTiles(points, {
    maxRequests: params.maxMatrixRequests,
    maxElements: params.maxMatrixElements,
  });
  const realTime = new Float64Array(n * n).fill(Number.NaN);
  const realKm = new Float64Array(n * n).fill(Number.NaN);
  const scale = (params.truckTimeFactor * params.trafficMultiplier) / 60;
  let failed = 0;
  let fetched = 0;
  let elements = 0;

  let next = 0;
  const worker = async () => {
    while (next < tiles.length) {
      const tile = tiles[next++];
      const body = await fetchTile(tile, points, deps);
      if (!body?.durations || !body.distances) {
        failed++;
        continue;
      }
      fetched++;
      elements += tile.nodes.length ** 2;
      for (let a = 0; a < tile.nodes.length; a++)
        for (let b = 0; b < tile.nodes.length; b++) {
          const i = tile.nodes[a];
          const j = tile.nodes[b];
          const d = body.durations[a]?.[b];
          const m = body.distances[a]?.[b];
          if (
            i === j ||
            d == null ||
            m == null ||
            !Number.isNaN(realTime[i * n + j])
          )
            continue;
          realTime[i * n + j] = d * scale;
          realKm[i * n + j] = m / 1000;
        }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tiles.length) }, worker),
  );

  // Calibration ratios per straight-line distance band, from fetched pairs.
  const timeRatios: number[][] = BANDS.map(() => []).concat([[]]);
  const kmRatios: number[][] = BANDS.map(() => []).concat([[]]);
  let realPairs = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const k = i * n + j;
      if (i === j || Number.isNaN(realTime[k])) continue;
      realPairs++;
      if (base.time[k] > 0 && base.km[k] > 0) {
        const band = bandOf(haversineKm(points[i], points[j]));
        timeRatios[band].push(realTime[k] / base.time[k]);
        kmRatios[band].push(realKm[k] / base.km[k]);
      }
    }
  if (realPairs === 0)
    return {
      matrix: base,
      stats: {
        ...empty,
        requests: tiles.length,
        failedRequests: failed,
        tilesPlanned: tiles.length,
      },
    };

  const overallT = median(timeRatios.flat()) ?? 1;
  const overallK = median(kmRatios.flat()) ?? 1;
  const ratioT = timeRatios.map((r) => median(r) ?? overallT);
  const ratioK = kmRatios.map((r) => median(r) ?? overallK);

  const time = new Float64Array(n * n);
  const km = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const k = i * n + j;
      if (!Number.isNaN(realTime[k])) {
        time[k] = realTime[k];
        km[k] = realKm[k];
      } else {
        const band = bandOf(haversineKm(points[i], points[j]));
        time[k] = base.time[k] * ratioT[band];
        km[k] = base.km[k] * ratioK[band];
      }
    }
  const coverage = totalPairs === 0 ? 0 : realPairs / totalPairs;
  return {
    matrix: {
      n,
      time,
      km,
      floodFrac: null,
      blocked: null,
      source: realPairs === totalPairs ? "road_matrix" : "road_calibrated",
    },
    stats: {
      requests: tiles.length,
      failedRequests: failed,
      tilesPlanned: tiles.length,
      tilesFetched: fetched,
      elementsBilled: elements,
      realPairs,
      totalPairs,
      coverage,
    },
  };
}
