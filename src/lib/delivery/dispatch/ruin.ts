import type { State } from "./construct.ts";
import { regretInsert, totalScore } from "./construct.ts";
import { bestInsertion, removeRequest } from "./insert.ts";
import { createRng } from "./rng.ts";
import { deliveryNode, evaluateRoute } from "./route-eval.ts";
import type { Instance, Matrix } from "./types.ts";

export type RuinResult = {
  iterations: number;
  stopReason: "iterations" | "deadline" | "stagnated";
};

type Rng = ReturnType<typeof createRng>;
type Ruin = (
  inst: Instance,
  matrix: Matrix,
  state: State,
  count: number,
  rng: Rng,
) => number[];

const GAIN = 1e-6;
/** Adaptive weights: reward for a new best, a better current, an accepted worse plan. */
const REWARD = { best: 33, better: 9, accepted: 13 };
const SEGMENT = 50;
const REACTION = 0.1;

const objective = (inst: Instance, state: State) =>
  totalScore(state) + state.unassigned.length * inst.params.unservedPenalty;

const clone = (state: State): State => ({
  routes: state.routes.slice(),
  evals: state.evals.slice(),
  unassigned: state.unassigned.slice(),
  cache: state.cache,
});

const assigned = (state: State) =>
  state.routes.flatMap((seq) =>
    seq.filter((stop) => stop.kind === "D").map((stop) => stop.r),
  );

/**
 * Take `r` off its truck, in place. Skipped (returns false) when the shorter
 * route would be infeasible, e.g. the new adjacent arc is blocked.
 */
function take(inst: Instance, matrix: Matrix, state: State, r: number) {
  const k = state.routes.findIndex((seq) => seq.some((stop) => stop.r === r));
  if (k < 0) return false;
  const seq = removeRequest(state.routes[k], r);
  const result = evaluateRoute(inst, matrix, inst.trucks[k], seq);
  if (!result.feasible) return false;
  state.routes[k] = seq;
  state.evals[k] = result;
  return true;
}

const randomRuin: Ruin = (inst, matrix, state, count, rng) => {
  const out: number[] = [];
  for (const r of rng.shuffle(assigned(state))) {
    if (out.length >= count) break;
    if (take(inst, matrix, state, r)) out.push(r);
  }
  return out;
};

/** Shaw removal: a random seed order plus the orders closest to it in place and time. */
const relatedRuin: Ruin = (inst, matrix, state, count, rng) => {
  const pool = assigned(state);
  if (pool.length === 0) return [];
  const seed = pool[rng.int(pool.length)];
  const n = matrix.n;
  const a = deliveryNode(seed);
  const relatedness = (r: number) => {
    const b = deliveryNode(r);
    const travel = (matrix.time[a * n + b] + matrix.time[b * n + a]) / 2;
    const window = Math.abs(
      inst.requests[seed].windowStart - inst.requests[r].windowStart,
    );
    return travel + 0.1 * window;
  };
  const ranked = pool
    .map((r) => ({ r, d: relatedness(r) }))
    .sort((x, y) => x.d - y.d || x.r - y.r);
  const out: number[] = [];
  for (const { r } of ranked) {
    if (out.length >= count) break;
    if (take(inst, matrix, state, r)) out.push(r);
  }
  return out;
};

/** Worst removal: orders whose removal saves the most, with some randomness. */
const worstRuin: Ruin = (inst, matrix, state, count, rng) => {
  const out: number[] = [];
  while (out.length < count) {
    const savings: { r: number; saving: number }[] = [];
    state.routes.forEach((seq, k) => {
      for (const stop of seq) {
        if (stop.kind !== "D") continue;
        const without = evaluateRoute(
          inst,
          matrix,
          inst.trucks[k],
          removeRequest(seq, stop.r),
        );
        if (without.feasible)
          savings.push({
            r: stop.r,
            saving: state.evals[k].score - without.score,
          });
      }
    });
    if (savings.length === 0) break;
    savings.sort((x, y) => y.saving - x.saving || x.r - y.r);
    const pick = savings[Math.floor(rng.next() ** 3 * savings.length)];
    if (!take(inst, matrix, state, pick.r)) break;
    out.push(pick.r);
  }
  return out;
};

/** Route removal: empty one truck, preferring short routes, so its orders redistribute. */
const routeRuin: Ruin = (inst, matrix, state, count, rng) => {
  const used = state.routes
    .map((seq, k) => ({ k, size: seq.length }))
    .filter((route) => route.size > 0)
    .sort((x, y) => x.size - y.size || x.k - y.k);
  if (used.length === 0) return [];
  const { k } = used[Math.floor(rng.next() ** 2 * used.length)];
  const requests = [...new Set(state.routes[k].map((stop) => stop.r))];
  return requests
    .slice(0, Math.max(count, 2))
    .filter((r) => take(inst, matrix, state, r));
};

const RUINS: Ruin[] = [randomRuin, relatedRuin, worstRuin, routeRuin];

/**
 * Adaptive large neighbourhood search. Each iteration removes a handful of
 * orders with one of several ruin operators and puts them back, together with
 * anything still unassigned, by regret insertion. Simulated annealing accepts
 * some worse plans so the search can leave a local optimum; the best plan seen
 * is written back into `state`. Deterministic for a seed and iteration count.
 */
export function ruinAndRecreate(
  inst: Instance,
  matrix: Matrix,
  state: State,
  nowMs: () => number,
  budget: { iterations: number; startedAt: number; patience?: number },
): RuinResult {
  const p = inst.params;
  const rng = createRng((p.seed ^ 0x9e3779b9) >>> 0);
  let current = clone(state);
  let currentScore = objective(inst, current);
  let best = clone(state);
  let bestScore = currentScore;

  // A plan 5% worse is accepted half the time at the start, almost never at the end.
  const startTemp = (0.05 * currentScore) / Math.LN2;
  const endTemp = startTemp * 0.002;
  const cooling =
    budget.iterations > 1
      ? (endTemp / startTemp) ** (1 / (budget.iterations - 1))
      : 1;
  let temp = startTemp;

  // Orders that fit on no truck even alone stay unassigned; never retry them.
  const hopeless = new Set(
    state.unassigned.filter((r) =>
      inst.trucks.every(
        (truck) =>
          bestInsertion(inst, matrix, truck, [], 0, r, {
            cache: state.cache,
          }) == null,
      ),
    ),
  );

  const weights = RUINS.map(() => 1);
  const scores = RUINS.map(() => 0);
  const uses = RUINS.map(() => 0);

  let iterations = 0;
  let sinceBest = 0;
  let stopReason: RuinResult["stopReason"] = "iterations";
  while (iterations < budget.iterations) {
    // Adaptive budget: give up once the best plan has not moved for `patience`
    // iterations. Iteration-based, so it stays deterministic.
    if (budget.patience && sinceBest >= budget.patience) {
      stopReason = "stagnated";
      break;
    }
    if (nowMs() - budget.startedAt > p.deadlineMs) {
      stopReason = "deadline";
      break;
    }
    iterations++;

    let pick = 0;
    let roll = rng.next() * weights.reduce((sum, w) => sum + w, 0);
    while (pick < RUINS.length - 1 && roll >= weights[pick]) {
      roll -= weights[pick];
      pick++;
    }

    const placed = inst.requests.length - current.unassigned.length;
    const most = Math.max(2, Math.min(15, Math.ceil(0.3 * placed)));
    const count = 2 + rng.int(most - 1);
    const candidate = clone(current);
    const removed = RUINS[pick](inst, matrix, candidate, count, rng);
    const retry = candidate.unassigned.filter((r) => !hopeless.has(r));
    candidate.unassigned = candidate.unassigned.filter((r) => hopeless.has(r));
    regretInsert(inst, matrix, candidate, [...removed, ...retry]);
    const score = objective(inst, candidate);

    uses[pick]++;
    sinceBest++;
    if (score < bestScore - GAIN) {
      sinceBest = 0;
      best = clone(candidate);
      bestScore = score;
      current = candidate;
      currentScore = score;
      scores[pick] += REWARD.best;
    } else if (score < currentScore - GAIN) {
      current = candidate;
      currentScore = score;
      scores[pick] += REWARD.better;
    } else if (
      score - currentScore > GAIN &&
      rng.next() < Math.exp((currentScore - score) / temp)
    ) {
      current = candidate;
      currentScore = score;
      scores[pick] += REWARD.accepted;
    }
    temp *= cooling;

    if (iterations % SEGMENT === 0) {
      for (let i = 0; i < RUINS.length; i++) {
        if (uses[i] > 0)
          weights[i] =
            (1 - REACTION) * weights[i] + (REACTION * scores[i]) / uses[i];
        weights[i] = Math.max(weights[i], 0.1);
        scores[i] = 0;
        uses[i] = 0;
      }
    }
  }

  state.routes = best.routes;
  state.evals = best.evals;
  state.unassigned = best.unassigned.sort((a, b) => a - b);
  return { iterations, stopReason };
}
