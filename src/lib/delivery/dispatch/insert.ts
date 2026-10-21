import type { EvalOptions } from "./route-eval.ts";
import { evaluateRoute } from "./route-eval.ts";
import type { Instance, Matrix, RouteEval, Stop, Truck } from "./types.ts";

export type Insertion = { seq: Stop[]; eval: RouteEval; delta: number };

/**
 * Cheapest feasible way to add request `r` to `seq`, judged by the exact
 * forward pass. Door orders try every (pickup, delivery) position pair with
 * the pickup first; depot orders try every delivery position.
 */
export function bestInsertion(
  inst: Instance,
  matrix: Matrix,
  truck: Truck,
  seq: readonly Stop[],
  currentScore: number,
  r: number,
  options: EvalOptions = {},
): Insertion | null {
  const request = inst.requests[r];
  let best: Insertion | null = null;
  const consider = (candidate: Stop[]) => {
    const result = evaluateRoute(inst, matrix, truck, candidate, options);
    if (!result.feasible) return;
    const delta = result.score - currentScore;
    if (best == null || delta < best.delta - 1e-9)
      best = { seq: candidate, eval: result, delta };
  };
  const length = seq.length;
  if (request.origin === "depot") {
    for (let i = 0; i <= length; i++) {
      consider([...seq.slice(0, i), { r, kind: "D" }, ...seq.slice(i)]);
    }
    return best;
  }
  for (let i = 0; i <= length; i++) {
    for (let j = i; j <= length; j++) {
      consider([
        ...seq.slice(0, i),
        { r, kind: "P" },
        ...seq.slice(i, j),
        { r, kind: "D" },
        ...seq.slice(j),
      ]);
    }
  }
  return best;
}

export function removeRequest(seq: readonly Stop[], r: number): Stop[] {
  return seq.filter((stop) => stop.r !== r);
}
