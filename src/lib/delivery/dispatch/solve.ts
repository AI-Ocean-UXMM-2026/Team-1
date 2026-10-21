import { construct, totalScore } from "./construct.ts";
import { diagnose, refine } from "./diagnose.ts";
import { improve } from "./improve.ts";
import { hashString } from "./rng.ts";
import { evaluateRoute } from "./route-eval.ts";
import type { Instance, Matrix, Plan, PlanRoute } from "./types.ts";

export type SolveDeps = { nowMs: () => number };

/**
 * Plan every request onto the trucks. Pure and deterministic: the same
 * instance, matrix, seed and iteration cap always give the same plan hash.
 */
export function solve(
  inst: Instance,
  matrix: Matrix,
  deps: SolveDeps = { nowMs: () => Date.now() },
): Plan {
  const state = construct(inst, matrix);
  const result = improve(inst, matrix, state, deps.nowMs);

  const routeRefs = state.routes
    .map((seq, truckIndex) => ({
      truckIndex,
      seq,
      score: state.evals[truckIndex].score,
    }))
    .filter((route) => route.seq.length > 0);
  const unassigned = state.unassigned.map((r) => ({
    requestId: inst.requests[r].id,
    reason: refine(inst, matrix, r, diagnose(inst, matrix, r), routeRefs),
  }));

  const routes = inst.trucks.map((truck, k) => ({
    truckId: truck.id,
    stops: state.routes[k],
    eval: state.evals[k],
  }));
  // Recompute with detail so the plan carries per-stop timings.
  // (Search runs without detail; this is one extra pass per used route.)
  return finish(inst, matrix, routes, unassigned, totalScore(state), result);
}

function finish(
  inst: Instance,
  matrix: Matrix,
  routes: PlanRoute[],
  unassigned: Plan["unassigned"],
  _score: number,
  result: { iterations: number; stopReason: Plan["stopReason"] },
): Plan {
  const detailed = routes.map((route, k) => ({
    ...route,
    eval: evaluateRoute(inst, matrix, inst.trucks[k], route.stops, {
      detail: true,
    }),
  }));
  const routeTotal = detailed.reduce((sum, route) => sum + route.eval.score, 0);
  const unserved = unassigned.length * inst.params.unservedPenalty;
  const signature = detailed
    .map(
      (route) =>
        `${route.truckId}:${route.stops.map((s) => `${inst.requests[s.r].id}${s.kind}`).join(",")}`,
    )
    .concat(unassigned.map((u) => `x:${u.requestId}:${u.reason}`))
    .join("|");
  return {
    routes: detailed,
    unassigned,
    objective: { routes: routeTotal, unserved, total: routeTotal + unserved },
    seed: inst.params.seed,
    iterations: result.iterations,
    stopReason: result.stopReason,
    dataQuality: matrix.source,
    hash: hashString(signature),
  };
}
