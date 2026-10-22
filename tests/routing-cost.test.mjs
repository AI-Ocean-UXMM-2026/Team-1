import assert from "node:assert/strict";
import test from "node:test";
import {
  arcCost,
  objectiveWeights,
} from "../src/lib/delivery/dispatch/arc-cost.ts";
import { buildStraightLineMatrix } from "../src/lib/delivery/dispatch/matrix.ts";
import { DEFAULT_PARAMS } from "../src/lib/delivery/dispatch/params.ts";
import { applyTraffic } from "../src/lib/delivery/dispatch/traffic.ts";
import { evaluateRouteTraffic } from "../src/lib/delivery/mapbox.ts";
import {
  addCosts,
  priceRoadReport,
  scoreCost,
  ZERO_COST,
} from "../src/lib/delivery/routing-cost.ts";

const NOW = Date.parse("2026-10-21T06:00:00Z");
// Open country, away from every mapped signal
const A = { lat: 17.2, lng: 96.3 };
const B = { lat: 17.2, lng: 96.31 };
const mid = { latitude: 17.2, longitude: 96.305 };
const matrix = buildStraightLineMatrix([A, B], {
  speedKmh: 30,
  roadFactor: 1.25,
});

const navReport = (over) => ({
  id: "r1",
  driver_id: "d",
  driver_name: "d",
  order_id: null,
  description: "",
  ...mid,
  status: "verified",
  reported_at: "2026-10-21T05:00:00Z",
  expires_at: "2026-10-21T09:00:00Z",
  ...over,
});

/** The same report, priced by navigation along the path and by dispatch on the arc. */
function both(report) {
  const nav = evaluateRouteTraffic(
    [
      [A.lng, A.lat],
      [B.lng, B.lat],
    ],
    { roadReports: [report], now: NOW },
  );
  const dispatch = applyTraffic(matrix, [A, B], {
    reports: [{ ...report, lat: report.latitude, lng: report.longitude }],
    nowMs: NOW,
  });
  return { nav, dispatch };
}

test("dispatch and navigation price a raw report identically", () => {
  for (const [category, severity] of [
    ["congestion", "high"],
    ["congestion", "medium"],
    ["congestion", "low"],
    ["roadwork", "high"],
    ["hazard", "low"],
  ]) {
    const { nav, dispatch } = both(navReport({ category, severity }));
    // two directed arcs, each priced once
    assert.equal(
      dispatch.summary.addedDelayMin,
      Math.round(nav.reportDelayMin * 2 * 10) / 10,
      `${category}/${severity}`,
    );
    assert.equal(dispatch.summary.blockedArcs, 0);
  }
});

test("dispatch and navigation price an engine decision identically", () => {
  for (const decision of [
    { action: "delay", severity: "high", delayMinutes: 6, radiusMeters: 120 },
    { action: "avoid", severity: "high", delayMinutes: 3, radiusMeters: 120 },
    { action: "monitor", severity: "low", delayMinutes: 0, radiusMeters: 120 },
  ]) {
    const { nav, dispatch } = both(
      navReport({
        category: "congestion",
        severity: "high",
        decision: { ...decision, expiresAt: "2026-10-21T09:00:00Z" },
      }),
    );
    assert.equal(
      dispatch.summary.addedDelayMin,
      Math.round(nav.reportDelayMin * 2 * 10) / 10,
      decision.action,
    );
  }
});

test("a closure blocks in both layers, and a rejected or expired report in neither", () => {
  const closure = both(navReport({ category: "closure", severity: "blocked" }));
  assert.equal(closure.nav.isBlocked, true);
  assert.equal(closure.dispatch.summary.blockedArcs, 2);

  const rejected = both(
    navReport({ category: "closure", severity: "blocked", status: "rejected" }),
  );
  assert.equal(rejected.nav.isBlocked, false);
  assert.equal(rejected.dispatch.summary.blockedArcs, 0);

  const expired = both(
    navReport({
      category: "closure",
      severity: "blocked",
      expires_at: "2026-10-21T05:30:00Z",
    }),
  );
  assert.equal(expired.nav.isBlocked, false);
  assert.equal(expired.dispatch.summary.blockedArcs, 0);
});

test("an ignored decision prices to nothing", () => {
  assert.equal(
    priceRoadReport(
      {
        category: "closure",
        severity: "blocked",
        decision: {
          action: "ignore",
          severity: "low",
          delayMinutes: 0,
          radiusMeters: 50,
        },
      },
      NOW,
    ),
    null,
  );
});

test("costs add, keep the weakest confidence, and a block is never cheap", () => {
  const a = {
    ...ZERO_COST,
    durationSeconds: 600,
    operatingCostMMK: 500,
    riskPenaltySeconds: 60,
    confidence: 0.9,
  };
  const b = { ...ZERO_COST, durationSeconds: 300, confidence: 0.5 };
  const sum = addCosts(a, b);
  assert.equal(sum.durationSeconds, 900);
  assert.equal(sum.confidence, 0.5);
  // 15 min + 5 MMK-minutes + 1 risk minute
  assert.equal(scoreCost(sum), 15 + 5 + 1);
  assert.equal(
    scoreCost({ ...ZERO_COST, blocked: true }),
    Number.POSITIVE_INFINITY,
  );
  assert.equal(addCosts(a, { ...ZERO_COST, blocked: true }).blocked, true);
});

test("a matrix arc scores the way the solver scores the same leg", () => {
  const points = [A, B];
  const base = buildStraightLineMatrix(points, {
    speedKmh: 30,
    roadFactor: 1.25,
  });
  const flooded = {
    ...base,
    floodFrac: Float64Array.from([0, 0.4, 0, 0]),
    blocked: Uint8Array.from([0, 0, 1, 0]),
  };
  const params = { ...DEFAULT_PARAMS, floodSlowdown: 0.5, floodWeight: 8 };
  const truck = { costPerKm: 1000 };

  const cost = arcCost(flooded, 0, 1, truck, params);
  const km = flooded.km[1];
  const solver =
    flooded.time[1] * (1 + 0.5 * 0.4) +
    (1000 * km) / params.mmkPerScoreMinute +
    8 * 0.4 * km;
  assert.ok(
    Math.abs(scoreCost(cost, objectiveWeights(params)) - solver) < 1e-9,
  );
  assert.equal(cost.blocked, false);
  assert.equal(cost.confidence, 0.4);
  assert.equal(arcCost(flooded, 1, 0, truck, params).blocked, true);
});
