import { bestInsertion } from "./insert.ts";
import { evaluateRoute } from "./route-eval.ts";
import type { Instance, Matrix, UnassignedReason } from "./types.ts";

/**
 * Why a request is unplaced: try it alone on an empty truck, in a fixed order
 * (single-truck capacity, then window / shift / range / flood), and if it fits
 * alone but not in the fleet, say whether capacity or time ran out.
 */
export function diagnose(
  inst: Instance,
  matrix: Matrix,
  r: number,
): UnassignedReason {
  const request = inst.requests[r];
  const p = inst.params;
  if (inst.trucks.length === 0) return "no_eligible_truck";
  const fitsSome = inst.trucks.some(
    (t) =>
      request.weightKg <= t.capKg * p.utilisation &&
      request.volumeM3 <= t.capM3 * p.utilisation,
  );
  if (!fitsSome) return "exceeds_capacity_single";

  const seen = new Set<string>();
  for (const truck of inst.trucks) {
    const alone = bestInsertion(inst, matrix, truck, [], 0, r);
    if (alone) {
      return "capacity_exhausted" as UnassignedReason;
    }
    // Rebuild the lone route unchecked to read which rule it breaks.
    const seq =
      request.origin === "depot"
        ? [{ r, kind: "D" as const }]
        : [
            { r, kind: "P" as const },
            { r, kind: "D" as const },
          ];
    for (const code of evaluateRoute(inst, matrix, truck, seq, {
      ignoreCapacity: true,
    }).violations)
      seen.add(code);
  }
  if (seen.has("blocked")) return "flood_blocked";
  if (seen.has("window")) {
    const earliest = Math.max(p.shiftStart, inst.earliestDepart);
    return request.windowEnd < earliest ? "window_passed" : "window_infeasible";
  }
  if (seen.has("deadline")) return "window_infeasible";
  if (seen.has("range")) return "exceeds_range";
  if (seen.has("shift")) return "exceeds_shift";
  return "capacity_exhausted";
}

/** Fits when capacity is ignored but not otherwise: time, not capacity, ran out. */
export function refine(
  inst: Instance,
  matrix: Matrix,
  r: number,
  base: UnassignedReason,
  routes: {
    truckIndex: number;
    seq: import("./types.ts").Stop[];
    score: number;
  }[],
): UnassignedReason {
  if (base !== "capacity_exhausted") return base;
  for (const route of routes) {
    const ins = bestInsertion(
      inst,
      matrix,
      inst.trucks[route.truckIndex],
      route.seq,
      route.score,
      r,
      { ignoreCapacity: true },
    );
    if (ins) return "capacity_exhausted";
  }
  return "time_exhausted";
}
