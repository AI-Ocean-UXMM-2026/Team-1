/**
 * Dispatch solver benchmark over synthetic instances. Deterministic: the
 * clock is pinned so the wall-clock deadline never cuts a run short, and every
 * scenario uses a fixed seed. Compare totals before and after a solver change.
 *
 *   node --experimental-strip-types scripts/dispatch-bench.mts [--json] [--ruin=N]
 */
import {
  construct,
  totalScore,
} from "../src/lib/delivery/dispatch/construct.ts";
import {
  buildStraightLineMatrix,
  nodePoints,
} from "../src/lib/delivery/dispatch/matrix.ts";
import { solve } from "../src/lib/delivery/dispatch/solve.ts";
import { generateSynthetic } from "../src/lib/delivery/dispatch/synthetic.ts";
import type { DispatchParams } from "../src/lib/delivery/dispatch/types.ts";
import { validateSolution } from "../src/lib/delivery/dispatch/validate.ts";

type Scenario = {
  name: string;
  orders: number;
  trucks: number;
  depotShare: number;
};

const SCENARIOS: Scenario[] = [
  { name: "small", orders: 20, trucks: 3, depotShare: 0.25 },
  { name: "medium", orders: 40, trucks: 5, depotShare: 0.25 },
  { name: "large", orders: 60, trucks: 6, depotShare: 0.25 },
  { name: "doors", orders: 40, trucks: 4, depotShare: 0 },
  { name: "tight", orders: 50, trucks: 3, depotShare: 0.5 },
];
const SEEDS = [1, 2, 3, 4, 5];

const args = process.argv.slice(2);
const json = args.includes("--json");
const ruinArg = args.find((a) => a.startsWith("--ruin="));
const params: Partial<DispatchParams> = {};
if (ruinArg) params.ruinIterations = Number(ruinArg.slice("--ruin=".length));

type Row = {
  scenario: string;
  seed: number;
  start: number;
  total: number;
  unassigned: number;
  km: number;
  ms: number;
  violations: number;
};

const rows: Row[] = [];
for (const scenario of SCENARIOS) {
  for (const seed of SEEDS) {
    const inst = generateSynthetic({
      seed,
      orders: scenario.orders,
      trucks: scenario.trucks,
      depotShare: scenario.depotShare,
      params,
    });
    const matrix = buildStraightLineMatrix(nodePoints(inst), inst.params);
    const initial = construct(inst, matrix);
    const startedAt = performance.now();
    const plan = solve(inst, matrix, { nowMs: () => 0 });
    const ms = performance.now() - startedAt;
    rows.push({
      scenario: scenario.name,
      seed,
      start:
        totalScore(initial) +
        initial.unassigned.length * inst.params.unservedPenalty,
      total: plan.objective.total,
      unassigned: plan.unassigned.length,
      km: plan.routes.reduce((sum, route) => sum + route.eval.km, 0),
      ms,
      violations: validateSolution(inst, matrix, plan).length,
    });
  }
}

if (json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const fmt = (n: number, places = 1) => n.toFixed(places).padStart(9);
  console.log(
    `${"scenario".padEnd(8)} ${"construct".padStart(9)} ${"solved".padStart(9)} ${"gain%".padStart(9)} ${"unasgn".padStart(9)} ${"km".padStart(9)} ${"ms".padStart(9)}`,
  );
  for (const scenario of SCENARIOS) {
    const group = rows.filter((row) => row.scenario === scenario.name);
    const sum = (pick: (row: Row) => number) =>
      group.reduce((acc, row) => acc + pick(row), 0);
    const start = sum((row) => row.start);
    const total = sum((row) => row.total);
    console.log(
      `${scenario.name.padEnd(8)} ${fmt(start)} ${fmt(total)} ${fmt(((start - total) / start) * 100, 2)} ${fmt(
        sum((row) => row.unassigned),
        0,
      )} ${fmt(sum((row) => row.km))} ${fmt(
        sum((row) => row.ms),
        0,
      )}`,
    );
  }
  const total = rows.reduce((acc, row) => acc + row.total, 0);
  const bad = rows.reduce((acc, row) => acc + row.violations, 0);
  console.log(
    `\nSum of solved totals: ${total.toFixed(1)}  violations: ${bad}`,
  );
}
