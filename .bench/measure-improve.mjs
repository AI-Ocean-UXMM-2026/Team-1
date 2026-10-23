import { generateSynthetic } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/synthetic.ts";
import { buildStraightLineMatrix, nodePoints } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/matrix.ts";
import { construct, totalScore } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/construct.ts";
import { improve } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/improve.ts";
import { ruinAndRecreate } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/ruin.ts";
import { solve } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/solve.ts";
import { withParams } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/params.ts";

const clock = () => 0;

for (const [orders, trucks] of [[20,3],[30,4],[40,5]]) {
  const inst = generateSynthetic({ seed: 7, orders, trucks });
  const matrix = buildStraightLineMatrix(nodePoints(inst), inst.params);
  const state = construct(inst, matrix);
  const afterConstruct = totalScore(state);
  const imp = improve(inst, matrix, state, clock, { startedAt: 0 });
  const afterImprove = totalScore(state);
  const evalsAfterImprove = state.cache.evaluations;
  const ruin = ruinAndRecreate(inst, matrix, state, clock, { iterations: 200, startedAt: 0, patience: 0 });
  const afterRuin = totalScore(state);
  const t0 = process.hrtime.bigint();
  const plan = solve(inst, matrix, { nowMs: clock });
  const t1 = process.hrtime.bigint();
  console.log(JSON.stringify({
    orders, trucks,
    construct: Number(afterConstruct.toFixed(1)),
    improve: Number(afterImprove.toFixed(1)),
    ruin200: Number(afterRuin.toFixed(1)),
    improvedPct: +(((afterConstruct - afterImprove) / afterConstruct) * 100).toFixed(2),
    ruinPct: +(((afterImprove - afterRuin) / afterImprove) * 100).toFixed(2),
    improveIters: imp.iterations, impStop: imp.stopReason,
    evalsAfterImprove,
    ruinOnlyIters: ruin.iterations,
    solveObjective: Number(plan.objective.total.toFixed(1)),
    solveIters: plan.iterations,
    solveMs: Number(t1 - t0) / 1e6,
  }));
  console.log("  weights: ruinIterations", inst.params.ruinIterations, "maxIterations", inst.params.maxIterations, "deadlineMs", inst.params.deadlineMs);
}
