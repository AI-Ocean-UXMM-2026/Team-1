import assert from "node:assert/strict";
import test from "node:test";
import {
  construct,
  totalScore,
} from "../src/lib/delivery/dispatch/construct.ts";
import {
  buildStraightLineMatrix,
  nodePoints,
} from "../src/lib/delivery/dispatch/matrix.ts";
import { DEFAULT_PARAMS } from "../src/lib/delivery/dispatch/params.ts";
import { evaluateRoute } from "../src/lib/delivery/dispatch/route-eval.ts";
import { solve } from "../src/lib/delivery/dispatch/solve.ts";
import { generateSynthetic } from "../src/lib/delivery/dispatch/synthetic.ts";
import { validateSolution } from "../src/lib/delivery/dispatch/validate.ts";

const clock = () => 0;
const matrixFor = (inst) =>
  buildStraightLineMatrix(nodePoints(inst), inst.params);

function tiny(overrides = {}) {
  const inst = generateSynthetic({ seed: 7, orders: 0, trucks: 1 });
  const base = {
    id: "A",
    origin: "door",
    pickup: { lat: 16.91, lng: 96.15 },
    delivery: { lat: 16.92, lng: 96.16 },
    weightKg: 5,
    volumeM3: 0.05,
    windowStart: 8 * 60,
    windowEnd: 12 * 60,
    deadline: null,
    deadlineHard: false,
    pickupService: 5,
    deliveryService: 5,
    pickupTownship: null,
    deliveryTownship: null,
  };
  inst.requests = [{ ...base, ...overrides }];
  return inst;
}

test("synthetic instances are labelled and reproducible", () => {
  const a = generateSynthetic({ seed: 3, orders: 10, trucks: 2 });
  const b = generateSynthetic({ seed: 3, orders: 10, trucks: 2 });
  assert.equal(a.synthetic, true);
  assert.match(a.label, /SYNTHETIC/);
  assert.deepEqual(a.requests, b.requests);
});

test("a door order is picked up before it is delivered and the truck returns", () => {
  const inst = tiny();
  const plan = solve(inst, matrixFor(inst), { nowMs: clock });
  const [route] = plan.routes;
  assert.deepEqual(
    route.stops.map((s) => s.kind),
    ["P", "D"],
  );
  assert.ok(route.eval.ret > route.eval.depart);
  assert.deepEqual(validateSolution(inst, matrixFor(inst), plan), []);
});

test("a depot order is on board from departure and has no pickup stop", () => {
  const inst = tiny({ origin: "depot", pickup: null });
  const matrix = matrixFor(inst);
  const plan = solve(inst, matrix, { nowMs: clock });
  assert.deepEqual(
    plan.routes[0].stops.map((s) => s.kind),
    ["D"],
  );
  assert.equal(plan.routes[0].eval.peakKg, 5);
});

test("precedence violations are caught by the evaluator", () => {
  const inst = tiny();
  const matrix = matrixFor(inst);
  const bad = evaluateRoute(inst, matrix, inst.trucks[0], [
    { r: 0, kind: "D" },
    { r: 0, kind: "P" },
  ]);
  assert.equal(bad.feasible, false);
  assert.ok(bad.violations.includes("precedence"));
});

test("an order heavier than every truck is unassigned with a reason", () => {
  const inst = tiny({ weightKg: 5000 });
  const plan = solve(inst, matrixFor(inst), { nowMs: clock });
  assert.deepEqual(plan.unassigned, [
    { requestId: "A", reason: "exceeds_capacity_single" },
  ]);
  assert.equal(plan.objective.unserved, DEFAULT_PARAMS.unservedPenalty);
});

test("a pickup window that closed before the truck can leave is window_passed", () => {
  const inst = tiny({ windowStart: 8 * 60, windowEnd: 9 * 60 });
  inst.earliestDepart = 11 * 60;
  const plan = solve(inst, matrixFor(inst), { nowMs: clock });
  assert.equal(plan.unassigned[0].reason, "window_passed");
});

test("capacity is cumulative: two orders that fit alone but not together split or drop", () => {
  const inst = tiny();
  inst.trucks[0].capKg = 10 / DEFAULT_PARAMS.utilisation; // 10 kg usable
  const first = inst.requests[0];
  first.weightKg = 6;
  inst.requests.push({
    ...first,
    id: "B",
    delivery: { lat: 16.93, lng: 96.17 },
  });
  // Different windows force overlap on board only if both picked before delivering.
  const matrix = matrixFor(inst);
  const plan = solve(inst, matrix, { nowMs: clock });
  assert.deepEqual(validateSolution(inst, matrix, plan), []);
  for (const route of plan.routes) assert.ok(route.eval.peakKg <= 10 + 1e-6);
});

test("flood exposure raises a route's score and a blocked arc is infeasible", () => {
  const inst = tiny();
  const matrix = matrixFor(inst);
  const seq = [
    { r: 0, kind: "P" },
    { r: 0, kind: "D" },
  ];
  const dry = evaluateRoute(inst, matrix, inst.trucks[0], seq);
  const wet = {
    ...matrix,
    floodFrac: new Float64Array(matrix.n * matrix.n).fill(0.5),
  };
  const flooded = evaluateRoute(inst, wet, inst.trucks[0], seq);
  assert.ok(flooded.score > dry.score);
  assert.ok(flooded.terms.flood > 0);
  const shut = {
    ...matrix,
    blocked: new Uint8Array(matrix.n * matrix.n).fill(1),
  };
  const blocked = evaluateRoute(inst, shut, inst.trucks[0], seq);
  assert.ok(blocked.violations.includes("blocked"));
});

test("solving is deterministic for a seed and never worse than construction", () => {
  const inst = generateSynthetic({ seed: 11, orders: 24, trucks: 4 });
  const matrix = matrixFor(inst);
  const a = solve(inst, matrix, { nowMs: clock });
  const b = solve(inst, matrix, { nowMs: clock });
  assert.equal(a.hash, b.hash);
  assert.equal(a.iterations, b.iterations);
  const start = construct(inst, matrix);
  const startTotal =
    totalScore(start) + start.unassigned.length * inst.params.unservedPenalty;
  assert.ok(a.objective.total <= startTotal + 1e-6);
});

test("random instances yield zero violations and no dropped orders", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const inst = generateSynthetic({
      seed,
      orders: 12 + (seed % 10),
      trucks: 2 + (seed % 3),
      depotShare: (seed % 4) / 4,
      params: { maxIterations: 300 },
    });
    const matrix = matrixFor(inst);
    const plan = solve(inst, matrix, { nowMs: clock });
    assert.deepEqual(validateSolution(inst, matrix, plan), [], `seed ${seed}`);
    const placed = plan.routes.reduce(
      (n, route) => n + route.stops.filter((s) => s.kind === "D").length,
      0,
    );
    assert.equal(
      placed + plan.unassigned.length,
      inst.requests.length,
      `seed ${seed}`,
    );
  }
});

test("the iteration cap stops the search and is recorded", () => {
  const inst = generateSynthetic({
    seed: 5,
    orders: 20,
    trucks: 3,
    params: { maxIterations: 5 },
  });
  const plan = solve(inst, matrixFor(inst), { nowMs: clock });
  assert.equal(plan.stopReason, "iterations");
  assert.ok(plan.iterations <= 5);
});
