import type { ObjectiveWeights, RoutingCost } from "../routing-cost.ts";
import type { DispatchParams, Matrix, Truck } from "./types.ts";
import {
  getHistoricalTrafficConfig,
  getHistoricalArcCostEnhancement,
  blendMapboxAndHistorical,
  getArcCostMetadataTracker,
  logHistoricalCostDecision,
} from "./historical-integration.ts";

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
 *
 * Phase 5 Integration: Enhanced with historical traffic data
 * - Checks for YUTRA historical data if available
 * - Blends with Mapbox when both are present
 * - Falls back gracefully to Haversine if needed
 */
export function arcCost(
  matrix: Matrix,
  from: number,
  to: number,
  truck: Pick<Truck, "costPerKm">,
  params: Pick<DispatchParams, "floodSlowdown" | "floodWeight">,
  minutesSinceMidnight?: number,
): RoutingCost {
  const arc = from * matrix.n + to;
  const frac = matrix.floodFrac?.[arc] ?? 0;
  const km = matrix.km[arc];

  // Base Mapbox cost (always calculated)
  const mapboxCost: RoutingCost = {
    durationSeconds: matrix.time[arc] * (1 + params.floodSlowdown * frac) * 60,
    distanceMeters: km * 1000,
    operatingCostMMK: km * truck.costPerKm,
    riskPenaltySeconds: params.floodWeight * frac * km * 60,
    confidence: CONFIDENCE[matrix.source],
    blocked: matrix.blocked?.[arc] === 1,
  };

  // Phase 5: Try to enhance with historical data
  const config = getHistoricalTrafficConfig();
  if (!config.enabled || minutesSinceMidnight === undefined) {
    // Historical layer disabled or no time context
    return mapboxCost;
  }

  // Generate arc ID from node indices (placeholder)
  // In production: This should be the geospatially matched arc_id from CSV
  const arcId = `arc_${from}_${to}`;

  // Try to get historical enhancement
  const historicalCost = getHistoricalArcCostEnhancement(
    arcId,
    minutesSinceMidnight,
    config
  );

  if (!historicalCost) {
    // No historical data available, use Mapbox only
    const tracker = getArcCostMetadataTracker();
    tracker.record(arc, {
      source: CONFIDENCE[matrix.source] >= 0.7 ? "mapbox_live" : "haversine",
      confidence: CONFIDENCE[matrix.source],
      blended: false,
    });
    return mapboxCost;
  }

  // Both available: Blend with Mapbox preference
  const blendedCost = blendMapboxAndHistorical(mapboxCost, historicalCost);

  // Track for monitoring
  const tracker = getArcCostMetadataTracker();
  tracker.record(arc, {
    source: "yutra_historical",
    confidence: historicalCost.confidence,
    blended: true,
    historicalArcId: arcId,
  });

  logHistoricalCostDecision(arc, from, to, {
    source: "yutra_historical",
    confidence: historicalCost.confidence,
    blended: true,
  }, blendedCost);

  return blendedCost;
}

/** The weights the solver's objective uses, for scoring costs from any layer. */
export function objectiveWeights(
  params: Pick<DispatchParams, "mmkPerScoreMinute">,
): ObjectiveWeights {
  return { time: 1, mmkPerScoreMinute: params.mmkPerScoreMinute, risk: 1 };
}
