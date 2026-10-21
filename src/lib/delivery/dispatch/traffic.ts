import {
  countInterceptionPointsBetween,
  countTrafficSignalsBetween,
} from "../energy-routing.ts";
import type { Matrix, Point } from "./types.ts";

export type TrafficSummary = {
  signalsCovered: number;
  interceptionsCovered: number;
  addedDelayMin: number;
  arcsWithDelay: number;
};

/**
 * Layers Yangon's signalized junctions and user-mapped interception points
 * onto the dispatch travel-time matrix.
 *
 * For each directed arc (i -> j):
 * - Signals add deceleration and red-light cycle delay (~0.95 min per signal)
 * - User interception midpoints add deceleration and traffic friction (~0.35 min per midpoint)
 *
 * This guides Clarke-Wright savings heuristics and 2-Opt/Or-Opt local search
 * to route deliveries around congested bottlenecks and avoid high-friction corridors.
 */
export function applyTraffic(
  matrix: Matrix,
  points: Point[],
  corridorThresholdKm = 0.45,
): { matrix: Matrix; summary: TrafficSummary } {
  const n = matrix.n;
  const time = new Float64Array(matrix.time);
  let signalsCovered = 0;
  let interceptionsCovered = 0;
  let addedDelayMin = 0;
  let arcsWithDelay = 0;

  for (let i = 0; i < n; i++) {
    const from = { latitude: points[i].lat, longitude: points[i].lng };
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const arc = i * n + j;
      const to = { latitude: points[j].lat, longitude: points[j].lng };

      const sigs = countTrafficSignalsBetween(from, to, corridorThresholdKm).count;
      const ints = countInterceptionPointsBetween(from, to, corridorThresholdKm).count;

      if (sigs > 0 || ints > 0) {
        // Red-light wait + intersection friction
        const arcDelay = sigs * 0.95 + ints * 0.35;
        time[arc] += arcDelay;
        signalsCovered += sigs;
        interceptionsCovered += ints;
        addedDelayMin += arcDelay;
        arcsWithDelay++;
      }
    }
  }

  return {
    matrix: {
      ...matrix,
      time,
    },
    summary: {
      signalsCovered,
      interceptionsCovered,
      addedDelayMin: Math.round(addedDelayMin * 10) / 10,
      arcsWithDelay,
    },
  };
}
