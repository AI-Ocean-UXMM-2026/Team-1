import type { DispatchParams } from "./types.ts";

/**
 * Every number here is an ASSUMED placeholder, not a measurement. The plan
 * stores a full copy with each run and the UI lists them as assumptions.
 */
export const DEFAULT_PARAMS: DispatchParams = {
  shiftStart: 8 * 60,
  shiftEnd: 20 * 60,
  maxRouteMin: 10 * 60,
  loadBaseMin: 10,
  loadPerParcelMin: 0.5,
  utilisation: 0.9,
  speedKmh: 16,
  roadFactor: 1.18,
  legSigma: 0.3,
  serviceSigma: 0.5,
  z: 1.28,
  uncertaintyWeight: 1,
  mmkPerScoreMinute: 100,
  lateWeight: 2,
  unservedPenalty: 600,
  cohesionKappa: 2,
  territoryPenalty: 8,
  floodWeight: 8,
  floodSlowdown: 0.5,
  maxIterations: 4000,
  deadlineMs: 6000,
  seed: 1,
};

export function withParams(over: Partial<DispatchParams> = {}): DispatchParams {
  return { ...DEFAULT_PARAMS, ...over };
}
