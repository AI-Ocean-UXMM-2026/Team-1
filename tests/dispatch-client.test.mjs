import assert from "node:assert/strict";
import test from "node:test";

import {
  commitMessage,
  REASON_COPY,
  reasonCopy,
  requestPlan,
  routeCards,
  summarize,
  warningCopy,
  yangonTime,
} from "../src/lib/delivery/dispatch/client.ts";
import {
  runSyntheticPlan,
  SYNTHETIC_SCENARIOS,
} from "../src/lib/delivery/dispatch/synthetic-scenarios.ts";

const NOW = new Date("2026-10-22T03:00:00Z");

test("every unassigned reason code the planner can emit has plain-language copy", () => {
  const codes = [
    "missing_coordinates",
    "outside_service_area",
    "window_passed",
    "window_infeasible",
    "exceeds_capacity_single",
    "exceeds_range",
    "exceeds_shift",
    "flood_blocked",
    "no_eligible_truck",
    "capacity_exhausted",
    "time_exhausted",
    "manager_excluded",
    "stale_order",
    "solver_budget",
  ];
  for (const code of codes) assert.ok(REASON_COPY[code]?.title, code);
  assert.equal(reasonCopy("mystery").title, "mystery");
});

test("Yangon clock times are UTC+06:30", () => {
  assert.equal(yangonTime("2026-10-22T01:30:00Z"), "08:00");
  assert.equal(yangonTime("2026-10-21T18:00:00Z"), "00:30");
});

test("warnings never read as 'no risk'", () => {
  assert.match(
    warningCopy("flood_unknown: no flood layer"),
    /not the same as no risk/,
  );
  assert.match(warningCopy("straight_line: x"), /straight-line/);
  assert.equal(warningCopy("something_else: raw"), "something_else: raw");
});

test("commit outcomes map to the right message", () => {
  assert.equal(
    commitMessage({ committed: true, duplicate: false }).kind,
    "done",
  );
  assert.equal(
    commitMessage({ committed: false, reason: "stale", stale_orders: [] }).kind,
    "stale",
  );
  assert.match(
    commitMessage({ committed: false, reason: "future_date" }).text,
    /service day/,
  );
  assert.match(
    commitMessage({
      committed: false,
      reason: "routes_blocked",
      routes: [{ problem: "missing_driver" }, { problem: "missing_driver" }],
    }).text,
    /^Cannot commit: a truck has no driver\.$/,
  );
});

test("requestPlan returns data, API errors and network failures distinctly", async () => {
  const ok = await requestPlan({}, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ routes: [] }),
  }));
  assert.equal(ok.ok, true);
  const refused = await requestPlan({}, async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      error: { code: "draft_exists", message: "m", detail: { run_id: "r" } },
    }),
  }));
  assert.deepEqual(
    [refused.ok, refused.status, refused.error.code],
    [false, 409, "draft_exists"],
  );
  const down = await requestPlan({}, async () => {
    throw new Error("offline");
  });
  assert.deepEqual([down.ok, down.error.code], [false, "network"]);
  const garbled = await requestPlan({}, async () => ({
    ok: false,
    status: 502,
    json: async () => {
      throw new Error("html");
    },
  }));
  assert.equal(garbled.error.code, "unexpected_response");
});

test("synthetic scenarios run the real planner and are labelled", async () => {
  for (const { id } of SYNTHETIC_SCENARIOS) {
    const plan = await runSyntheticPlan(id, NOW);
    assert.equal(plan.simulated, true, id);
    assert.equal(plan.depot.code, "SYNTHETIC");
    assert.equal(plan.run.id, null);
    assert.equal(plan.quality.tier, "straight_line");
    assert.ok(plan.routes.length >= 1, id);
    // Everything is accounted for: 16 orders, each assigned once or unassigned with a reason.
    assert.equal(plan.orders.length, 16);
    for (const o of plan.unassigned) assert.ok(o.unassigned_reason);
    const reasons = plan.unassigned.map((o) => o.unassigned_reason);
    assert.ok(reasons.includes("exceeds_capacity_single"));
    assert.ok(reasons.includes("missing_coordinates"));
    assert.ok(plan.orders.every((o) => o.order_id.startsWith("5e5e5e5e")));
  }
});

test("the flood scenario adds exposure and the blocked-road scenario leaves a flood_blocked order", async () => {
  const base = await runSyntheticPlan("baseline", NOW);
  const flood = await runSyntheticPlan("flood_zone", NOW);
  const closed = await runSyntheticPlan("closed_road", NOW);
  assert.equal(base.quality.flood.status, "unknown");
  assert.equal(flood.quality.flood.status, "layer");
  assert.ok(flood.routes.some((r) => r.score_flood > 0));
  assert.ok(base.routes.every((r) => r.score_flood === 0));
  assert.equal(closed.quality.flood.status, "reports_only");
  assert.ok(
    closed.unassigned.some((o) => o.unassigned_reason === "flood_blocked"),
  );
});

test("route cards and the summary are display-ready", async () => {
  const plan = await runSyntheticPlan("baseline", NOW);
  const cards = routeCards(
    plan.routes,
    (id) => plan.trucks.find((t) => t.id === id)?.registration ?? id,
  );
  assert.deepEqual(
    cards.map((c) => c.letter),
    cards.map((_, i) => String.fromCharCode(65 + i)),
  );
  for (const card of cards) {
    assert.match(card.depart, /^\d\d:\d\d$/);
    assert.match(card.label, /^SYN-TRUCK-/);
    assert.ok(card.loadPct != null && card.loadPct <= 100);
    assert.ok(
      card.stops.every((s, i) => s.seq === i + 1 && /^\d\d:\d\d$/.test(s.time)),
    );
  }
  const summary = summarize(plan);
  assert.equal(summary.assigned + summary.unassigned, 16);
  assert.equal(summary.tone, "warn");
  assert.doesNotMatch(
    JSON.stringify([plan.basis, summary]),
    /optimal|guaranteed|accuracy/i,
  );
});
