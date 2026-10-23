import { generateSynthetic } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/synthetic.ts";
import { buildStraightLineMatrix, nodePoints } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/matrix.ts";
import { construct, totalScore } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/construct.ts";
import { improve } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/improve.ts";
import { createRng } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/rng.ts";
import { evaluateRoute } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/route-eval.ts";
import { removeRequest } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/insert.ts";
import { satisfiesPrecedence } from "/Users/happer/Projects/oern/src/lib/delivery/dispatch/improve.ts";

const clock = () => 0;
const GAIN = 1e-6;

// REPLICA of the current 2-opt pass (reverse a slice, re-evaluate whole route)
function twoOptReplica(inst, matrix, state) {
  let iterations = 0;
  for (let k = 0; k < inst.trucks.length; k++) {
    let seq = state.routes[k];
    if (seq.length < 3) continue;
    let routeImproved = false;
    for (let i = 0; i < seq.length - 1; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        iterations++;
        const reversed = seq.slice(i, j + 1).reverse();
        const candidate = [...seq.slice(0, i), ...reversed, ...seq.slice(j + 1)];
        if (!satisfiesPrecedence(candidate, inst)) continue;
        const candEval = evaluateRoute(inst, matrix, inst.trucks[k], candidate);
        if (candEval.feasible && state.evals[k].score - candEval.score > GAIN) {
          state.routes[k] = candidate; state.evals[k] = candEval; seq = candidate;
          routeImproved = true; break;
        }
      }
      if (routeImproved) break;
    }
  }
  return iterations;
}

// Rebuild the state produced by construct()
function freshState(inst, matrix) {
  return construct(inst, matrix);
}

for (const [orders, trucks] of [[20,3],[30,4],[40,5]]) {
  const inst = generateSynthetic({ seed: 7, orders, trucks });
  const matrix = buildStraightLineMatrix(nodePoints(inst), inst.params);
  const base = freshState(inst, matrix);
  const afterConstruct = totalScore(base);

  // isolate: run only the 2-opt replica on the constructed state
  const clone = (s) => ({ routes: s.routes.map(r=>r.slice()), evals: s.evals.slice(), unassigned: s.unassigned.slice(), cache: s.cache });
  const only2opt = clone(base);
  const iters = twoOptReplica(inst, matrix, only2opt);
  const after2optAlone = totalScore(only2opt);

  console.log(JSON.stringify({ orders, trucks,
    construct: Number(afterConstruct.toFixed(1)),
    twoOptAlone: Number(after2optAlone.toFixed(1)),
    twoOptGainPct: Number((((afterConstruct-after2optAlone)/afterConstruct)*100).toFixed(2)),
    twoOptIters: iters }));
}
