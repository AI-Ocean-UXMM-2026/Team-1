import type { DispatchParams, Matrix, Point } from "../dispatch/types.ts";
import type { ContractionHierarchy } from "./contraction-hierarchies.ts";
import { chQuery, contractGraph } from "./contraction-hierarchies.ts";
import { shortestPath } from "./dijkstra.ts";
import type { Graph } from "./graph.ts";
import { haversineKm } from "./graph.ts";
import { snapToNode } from "./snap.ts";

export function buildStraightLineFallback(
  points: Point[],
  params: Pick<DispatchParams, "speedKmh" | "roadFactor">,
): Matrix {
  const n = points.length;
  const time = new Float64Array(n * n);
  const km = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const road =
        haversineKm(
          { latitude: points[i].lat, longitude: points[i].lng },
          { latitude: points[j].lat, longitude: points[j].lng },
        ) * params.roadFactor;
      km[i * n + j] = road;
      time[i * n + j] = (road / params.speedKmh) * 60;
    }
  }
  return {
    n,
    time,
    km,
    floodFrac: null,
    blocked: null,
    source: "straight_line",
  };
}

type MatrixBuildOptions = {
  maxSnapKm?: number;
  ch?: ContractionHierarchy;
  contractionHierarchy?: ContractionHierarchy;
};

function resolveOptions(arg: unknown): MatrixBuildOptions {
  if (typeof arg === "number") return { maxSnapKm: arg };
  if (arg && typeof arg === "object") return arg as MatrixBuildOptions;
  return {};
}

/**
 * All-pairs shortest paths over a road graph. Points are snapped to the nearest
 * graph node; distances are converted to minutes using the supplied speed.
 */
export function buildShortestPathMatrix(
  graph: Graph,
  points: Point[],
  params: Pick<
    DispatchParams,
    "speedKmh" | "truckTimeFactor" | "trafficMultiplier"
  > & { maxSnapKm?: number },
  maxSnapKmOrOptions?: number | MatrixBuildOptions,
  contractionHierarchy?: ContractionHierarchy,
): Matrix {
  const n = points.length;
  const opts = resolveOptions(maxSnapKmOrOptions);
  const maxSnapKm =
    opts.maxSnapKm ?? params.maxSnapKm ?? Number.POSITIVE_INFINITY;
  const ch =
    opts.ch ??
    opts.contractionHierarchy ??
    contractionHierarchy ??
    contractGraph(graph);

  const snapped: (number | null)[] = points.map((point) =>
    snapToNode(graph, { latitude: point.lat, longitude: point.lng }, maxSnapKm),
  );

  const time = new Float64Array(n * n);
  const km = new Float64Array(n * n);
  const scale = (params.truckTimeFactor * params.trafficMultiplier) / 60;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (snapped[i] === null || snapped[j] === null) {
        // Off-network point: fall back to straight line.
        const road =
          haversineKm(
            { latitude: points[i].lat, longitude: points[i].lng },
            { latitude: points[j].lat, longitude: points[j].lng },
          ) * 1.18;
        km[i * n + j] = road;
        time[i * n + j] = (road / params.speedKmh) * 60 * scale;
        continue;
      }
      const dist = chQuery(ch, snapped[i] as number, snapped[j] as number);
      if (!Number.isFinite(dist)) {
        // Fall back to straight line for disconnected pairs.
        const road =
          haversineKm(
            { latitude: points[i].lat, longitude: points[i].lng },
            { latitude: points[j].lat, longitude: points[j].lng },
          ) * 1.18;
        km[i * n + j] = road;
        time[i * n + j] = (road / params.speedKmh) * 60 * scale;
        continue;
      }
      km[i * n + j] = dist / 1000;
      time[i * n + j] = (dist / 1000 / params.speedKmh) * 60 * scale;
    }
  }
  return {
    n,
    time,
    km,
    floodFrac: null,
    blocked: null,
    source: "road_matrix",
  };
}

export function shortestPathBetween(
  graph: Graph,
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  maxSnapKm = Number.POSITIVE_INFINITY,
) {
  const source = snapToNode(graph, from, maxSnapKm);
  const target = snapToNode(graph, to, maxSnapKm);
  if (source === null || target === null)
    return { distance: Infinity, path: [] };
  return shortestPath(graph, source, target);
}
