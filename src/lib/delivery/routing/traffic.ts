import { distanceToSegmentKm } from "../energy-routing.ts";
import { signalDelayMin } from "../signal-index.ts";
import { createGraph, type Graph } from "./graph.ts";

export type TrafficSignalLike = {
  latitude: number;
  longitude: number;
  estimatedCycleSeconds: number;
};

/**
 * Total signal delay (minutes) for a single edge, checking every segment of its
 * geometry. Each signal is counted at most once per edge even when it sits near
 * a shared vertex.
 */
export function edgeSignalDelayMinutes(
  edge: {
    coordinates?: readonly { latitude: number; longitude: number }[];
    trafficSignalsApplied?: boolean;
  },
  signals: readonly TrafficSignalLike[],
  radiusKm = 0.045,
): number {
  if (!edge.coordinates || edge.coordinates.length < 2) return 0;
  if (edge.trafficSignalsApplied) return 0;
  const coords = edge.coordinates;
  const seen = new Set<number>();
  let delayMinutes = 0;
  for (let s = 0; s < coords.length - 1; s++) {
    const start = coords[s];
    const end = coords[s + 1];
    for (let i = 0; i < signals.length; i++) {
      if (seen.has(i)) continue;
      const distance = distanceToSegmentKm(signals[i], start, end);
      if (distance <= radiusKm) {
        seen.add(i);
        delayMinutes += signalDelayMin(signals[i].estimatedCycleSeconds);
      }
    }
  }
  return delayMinutes;
}

/**
 * Return a copy of `graph` with red-light wait time folded into edge weights.
 * Does not mutate the input graph and is idempotent: edges already carrying
 * traffic-signal delay are not adjusted again.
 */
export function applyTrafficSignals(
  graph: Graph,
  signals: readonly TrafficSignalLike[],
  speedKmh: number,
  radiusKm = 0.045,
): Graph {
  const kmPerMinute = speedKmh / 60;
  const result = createGraph(
    graph.nodeCount,
    graph.coordinates ? [...graph.coordinates] : undefined,
  );
  for (let u = 0; u < graph.nodeCount; u++) {
    result.adjacency[u] = graph.adjacency[u].map((edge) => {
      if (edge.trafficSignalsApplied) return { ...edge };
      const delayMinutes = edgeSignalDelayMinutes(edge, signals, radiusKm);
      const weight =
        delayMinutes > 0
          ? edge.weight + delayMinutes * kmPerMinute * 1000
          : edge.weight;
      return {
        ...edge,
        weight,
        trafficSignalsApplied:
          delayMinutes > 0 ? true : edge.trafficSignalsApplied,
      };
    });
  }
  // Mark applied even when no delay, so repeated calls stay idempotent.
  for (let u = 0; u < graph.nodeCount; u++) {
    result.adjacency[u] = result.adjacency[u].map((edge) => ({
      ...edge,
      trafficSignalsApplied: true,
    }));
  }
  return result;
}
