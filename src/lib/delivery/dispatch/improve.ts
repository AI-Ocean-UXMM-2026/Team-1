import type { State } from "./construct.ts";
import { totalScore } from "./construct.ts";
import { bestInsertion, removeRequest } from "./insert.ts";
import { createRng } from "./rng.ts";
import { evaluateRoute } from "./route-eval.ts";
import type { Instance, Matrix } from "./types.ts";

export type ImproveResult = {
  iterations: number;
  stopReason: "converged" | "iterations" | "deadline";
};

const GAIN = 1e-6;

/**
 * Deterministic local search: relocate each request to its best position on
 * any truck, retry unassigned requests, and swap pairs across trucks. It never
 * accepts a worse or infeasible plan. Visiting order comes from the seeded RNG
 * and the budget is an iteration count; the deadline is only a safety valve.
 */
export function improve(
  inst: Instance,
  matrix: Matrix,
  state: State,
  nowMs: () => number,
): ImproveResult {
  const p = inst.params;
  const rng = createRng(p.seed);
  const startedAt = nowMs();
  let iterations = 0;

  const owner = (r: number) =>
    state.routes.findIndex((seq) => seq.some((stop) => stop.r === r));

  const budgetLeft = (): ImproveResult["stopReason"] | null => {
    if (iterations >= p.maxIterations) return "iterations";
    if (nowMs() - startedAt > p.deadlineMs) return "deadline";
    return null;
  };

  for (;;) {
    let improved = false;

    // Place anything that was unplaceable earlier.
    for (const r of [...state.unassigned]) {
      let best: {
        k: number;
        ins: NonNullable<ReturnType<typeof bestInsertion>>;
      } | null = null;
      for (let k = 0; k < inst.trucks.length; k++) {
        const ins = bestInsertion(
          inst,
          matrix,
          inst.trucks[k],
          state.routes[k],
          state.evals[k].score,
          r,
        );
        if (ins && (best == null || ins.delta < best.ins.delta))
          best = { k, ins };
      }
      if (best) {
        state.routes[best.k] = best.ins.seq;
        state.evals[best.k] = best.ins.eval;
        state.unassigned = state.unassigned.filter((x) => x !== r);
        improved = true;
      }
    }

    const order = rng.shuffle(inst.requests.map((_, r) => r));
    for (const r of order) {
      const stop = budgetLeft();
      if (stop) return { iterations, stopReason: stop };
      iterations++;
      const from = owner(r);
      if (from < 0) continue;
      const before = state.evals[from].score;
      const without = removeRequest(state.routes[from], r);
      const withoutEval = evaluateRoute(
        inst,
        matrix,
        inst.trucks[from],
        without,
      );
      if (!withoutEval.feasible) continue;
      let bestK = -1;
      let bestGain = GAIN;
      let bestSeq = null as ReturnType<typeof bestInsertion>;
      for (let k = 0; k < inst.trucks.length; k++) {
        const baseSeq = k === from ? without : state.routes[k];
        const baseScore = k === from ? withoutEval.score : state.evals[k].score;
        const ins = bestInsertion(
          inst,
          matrix,
          inst.trucks[k],
          baseSeq,
          baseScore,
          r,
        );
        if (!ins) continue;
        const gain =
          k === from
            ? before - ins.eval.score
            : before +
              state.evals[k].score -
              (withoutEval.score + ins.eval.score);
        if (gain > bestGain) {
          bestGain = gain;
          bestK = k;
          bestSeq = ins;
        }
      }
      if (bestK >= 0 && bestSeq) {
        if (bestK !== from) {
          state.routes[from] = without;
          state.evals[from] = withoutEval;
        }
        state.routes[bestK] = bestSeq.seq;
        state.evals[bestK] = bestSeq.eval;
        improved = true;
      }
    }

    // Swap one request between two trucks.
    for (let a = 0; a < inst.trucks.length; a++) {
      for (let b = a + 1; b < inst.trucks.length; b++) {
        const ra = [...new Set(state.routes[a].map((s) => s.r))];
        const rb = [...new Set(state.routes[b].map((s) => s.r))];
        for (const x of ra) {
          for (const y of rb) {
            const stop = budgetLeft();
            if (stop) return { iterations, stopReason: stop };
            iterations++;
            if (
              !state.routes[a].some((s) => s.r === x) ||
              !state.routes[b].some((s) => s.r === y)
            )
              continue;
            const aw = removeRequest(state.routes[a], x);
            const bw = removeRequest(state.routes[b], y);
            const aEval = evaluateRoute(inst, matrix, inst.trucks[a], aw);
            const bEval = evaluateRoute(inst, matrix, inst.trucks[b], bw);
            if (!aEval.feasible || !bEval.feasible) continue;
            const insY = bestInsertion(
              inst,
              matrix,
              inst.trucks[a],
              aw,
              aEval.score,
              y,
            );
            const insX = bestInsertion(
              inst,
              matrix,
              inst.trucks[b],
              bw,
              bEval.score,
              x,
            );
            if (!insX || !insY) continue;
            const gain =
              state.evals[a].score +
              state.evals[b].score -
              (insY.eval.score + insX.eval.score);
            if (gain > GAIN) {
              state.routes[a] = insY.seq;
              state.evals[a] = insY.eval;
              state.routes[b] = insX.seq;
              state.evals[b] = insX.eval;
              improved = true;
            }
          }
        }
      }
    }

    if (!improved) return { iterations, stopReason: "converged" };
  }
}

export { totalScore };
