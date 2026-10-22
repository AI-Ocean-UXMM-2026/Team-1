import type { ObjectiveWeights, RoutingCost } from "../routing-cost.ts";
import type { DispatchParams, Matrix, Truck } from "./types.ts";

const CONFIDENCE: Record<Matrix["source"], number> = {
  road_matrix: 1,
  road_calibrated: 0.7,
  straight_line: 0.4,
};

/**
 * One matrix arc as a RoutingCost, in the units navigation uses. Time, money
 * and flood risk stay apart so they can be weighed the same way in both
 * layers; the solver's own leg score is exactly `scoreCost` of this under
 * `objectiveWeights` (plus the fixed truck cost and waiting, which belong to
 * the route, not the arc).
 */
export function arcCost(
  matrix: Matrix,
  from: number,
  to: number,
  truck: Pick<Truck, "costPerKm">,
  params: Pick<DispatchParams, "floodSlowdown" | "floodWeight">,
): RoutingCost {
  const arc = from * matrix.n + to;
  const frac = matrix.floodFrac?.[arc] ?? 0;
  const km = matrix.km[arc];
  return {
    durationSeconds: matrix.time[arc] * (1 + params.floodSlowdown * frac) * 60,
    distanceMeters: km * 1000,
    operatingCostMMK: km * truck.costPerKm,
    riskPenaltySeconds: params.floodWeight * frac * km * 60,
    confidence: CONFIDENCE[matrix.source],
    blocked: matrix.blocked?.[arc] === 1,
  };
}

/** The weights the solver's objective uses, for scoring costs from any layer. */
export function objectiveWeights(
  params: Pick<DispatchParams, "mmkPerScoreMinute">,
): ObjectiveWeights {
  return { time: 1, mmkPerScoreMinute: params.mmkPerScoreMinute, risk: 1 };
}
