import type { Insertion, InsertionCache } from "./insert.ts";
import { bestInsertion, createInsertionCache } from "./insert.ts";
import { evaluateRoute } from "./route-eval.ts";
import type { Instance, Matrix, RouteEval, Stop } from "./types.ts";

export type State = {
  routes: Stop[][];
  evals: RouteEval[];
  unassigned: number[];
  /** Shared by every clone of the state; see InsertionCache. */
  cache?: InsertionCache;
};

export function emptyState(inst: Instance, matrix: Matrix): State {
  return {
    routes: inst.trucks.map(() => []),
    evals: inst.trucks.map((truck) => evaluateRoute(inst, matrix, truck, [])),
    unassigned: [],
    cache: createInsertionCache(),
  };
}

export function totalScore(state: State) {
  return state.evals.reduce((sum, e) => sum + e.score, 0);
}

/**
 * Parallel regret-2 insertion. A request feasible on exactly one truck has
 * infinite regret, so it is placed before it loses its only option. Ties go to
 * heavier orders, then the earlier window end, then the lower index.
 */
export function construct(inst: Instance, matrix: Matrix): State {
  const state = emptyState(inst, matrix);
  regretInsert(
    inst,
    matrix,
    state,
    inst.requests.map((_, r) => r),
  );
  return state;
}

/**
 * Regret-2 insertion of `requests` into an existing state, in place. Requests
 * that fit on no truck join `state.unassigned`.
 */
export function regretInsert(
  inst: Instance,
  matrix: Matrix,
  state: State,
  requests: readonly number[],
): void {
  const options = new Map<number, (Insertion | null)[]>();
  const pending = new Set(requests);

  const compute = (r: number, truckIndex: number) =>
    bestInsertion(
      inst,
      matrix,
      inst.trucks[truckIndex],
      state.routes[truckIndex],
      state.evals[truckIndex].score,
      r,
      { cache: state.cache },
    );

  while (pending.size > 0) {
    let chosen = -1;
    let chosenRegret = -Infinity;
    let chosenTruck = -1;
    for (const r of [...pending].sort((a, b) => a - b)) {
      let row = options.get(r);
      if (!row) {
        row = inst.trucks.map((_, k) => compute(r, k));
        options.set(r, row);
      }
      const feasible = row
        .map((option, k) => ({ option, k }))
        .filter(
          (entry): entry is { option: Insertion; k: number } =>
            entry.option != null,
        )
        .sort((a, b) => a.option.delta - b.option.delta || a.k - b.k);
      if (feasible.length === 0) {
        pending.delete(r);
        options.delete(r);
        state.unassigned.push(r);
        continue;
      }
      const regret =
        feasible.length === 1
          ? Number.POSITIVE_INFINITY
          : feasible[1].option.delta - feasible[0].option.delta;
      const better =
        chosen < 0 ||
        regret > chosenRegret ||
        (regret === chosenRegret && tieBefore(inst, r, chosen));
      if (better) {
        chosen = r;
        chosenRegret = regret;
        chosenTruck = feasible[0].k;
      }
    }
    if (chosen < 0) break;
    const row = options.get(chosen);
    const pick = row?.[chosenTruck];
    if (!pick) break;
    state.routes[chosenTruck] = pick.seq;
    state.evals[chosenTruck] = pick.eval;
    pending.delete(chosen);
    options.delete(chosen);
    for (const [r, entries] of options)
      entries[chosenTruck] = compute(r, chosenTruck);
  }
  state.unassigned.sort((a, b) => a - b);
}

function tieBefore(inst: Instance, a: number, b: number) {
  const ra = inst.requests[a];
  const rb = inst.requests[b];
  if (ra.weightKg !== rb.weightKg) return ra.weightKg > rb.weightKg;
  if (ra.windowEnd !== rb.windowEnd) return ra.windowEnd < rb.windowEnd;
  return a < b;
}
