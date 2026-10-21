import assert from "node:assert/strict";
import test from "node:test";

import { FloodField } from "../src/lib/delivery/dispatch/flood.ts";
import {
  handlePlan,
  parsePlanRequest,
} from "../src/lib/delivery/dispatch/handler.ts";
import {
  buildInstance,
  usableRangeKm,
} from "../src/lib/delivery/dispatch/inputs.ts";
import {
  buildStraightLineMatrix,
  haversineKm,
} from "../src/lib/delivery/dispatch/matrix.ts";
import { withParams } from "../src/lib/delivery/dispatch/params.ts";
import { planDispatch } from "../src/lib/delivery/dispatch/plan.ts";
import { buildRoadMatrix } from "../src/lib/delivery/dispatch/road-matrix.ts";

const DEPOT = {
  id: "d0000000-0000-4000-8000-000000000001",
  code: "MGD",
  latitude: 16.9,
  longitude: 96.15,
  location_status: "verified",
  is_active: true,
};
const DATE = "2026-10-22";
const NOW = new Date("2026-10-21T20:00:00Z"); // 02:30 on the 22nd in Yangon
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Local Yangon time on DATE -> ISO.
const local = (h, m = 0, dayOffset = 0) =>
  new Date(
    Date.UTC(2026, 9, 22 + dayOffset, h, m) - 6.5 * 3600e3,
  ).toISOString();

function order(n, over = {}) {
  const lat = 16.85 + (n % 7) * 0.012;
  const lng = 96.1 + (n % 5) * 0.014;
  return {
    id: uuid(n),
    status: "pending",
    pickup_address: `Pickup ${n}`,
    pickup_latitude: lat,
    pickup_longitude: lng,
    delivery_address: `Drop ${n}`,
    delivery_latitude: lat + 0.02,
    delivery_longitude: lng + 0.015,
    parcel_weight_kg: null,
    cod_amount: n % 3 === 0 ? 5000 : 0,
    updated_at: "2026-10-21T10:00:00Z",
    logistics: {
      origin_kind: "door",
      parcel_size: "medium",
      weight_kg: null,
      weight_source: null,
      volume_m3: null,
      volume_source: null,
      pickup_window_start: local(8),
      pickup_window_end: local(17),
      window_source: "parsed_description",
      delivery_deadline_at: null,
      deadline_hard: false,
      pickup_township_pcode: `T${n % 3}`,
      delivery_township_pcode: `T${(n + 1) % 3}`,
      updated_at: "2026-10-21T10:00:01Z",
    },
    ...over,
  };
}
const truck = (n, over = {}) => ({
  id: uuid(900 + n),
  registration_number: `TRK-${n}`,
  vehicle_type: "truck",
  status: "available",
  capacity_kg: 300,
  energy_source: "fuel",
  fuel_level_percent: 80,
  battery_level_percent: null,
  range_km_at_full: 400,
  reserve_percent: 15,
  profile: {
    depot_id: null,
    default_driver_id: uuid(800 + n),
    capacity_m3: 3,
    cost_per_km_mmk: 900,
    fixed_cost_mmk: 0,
    cost_source: "assumed",
  },
  ...over,
});

const noNetwork = {
  nowMs: () => 0,
  buildMatrix: async (points, params) => ({
    matrix: buildStraightLineMatrix(points, params),
    stats: null,
  }),
};
const input = (over = {}) => ({
  depot: DEPOT,
  serviceDate: DATE,
  now: NOW,
  orders: [1, 2, 3, 4, 5, 6].map((n) => order(n)),
  trucks: [truck(1), truck(2)],
  field: null,
  reports: [],
  params: { maxIterations: 300 },
  ...over,
});

test("usable range is range x (level - reserve), by energy source", () => {
  assert.equal(usableRangeKm(truck(1)), (400 * (80 - 15)) / 100);
  assert.equal(usableRangeKm(truck(1, { fuel_level_percent: null })), null);
  assert.equal(
    usableRangeKm(
      truck(1, { energy_source: "electric", battery_level_percent: 50 }),
    ),
    (400 * 35) / 100,
  );
  assert.equal(usableRangeKm(truck(1, { range_km_at_full: null })), null);
  assert.equal(usableRangeKm(truck(1, { fuel_level_percent: 10 })), 0);
});

test("buildInstance keeps every order accounted for and records sources", () => {
  const orders = [
    order(1),
    order(2, { parcel_weight_kg: 4.5, logistics: null }),
    order(3, { logistics: { ...order(3).logistics, parcel_size: null } }),
    order(4, {
      logistics: {
        ...order(4).logistics,
        weight_kg: 12,
        weight_source: "weighed",
      },
    }),
    order(5, { delivery_latitude: null }),
    order(6, {
      logistics: {
        ...order(6).logistics,
        pickup_window_start: local(8, 0, 1),
        pickup_window_end: local(12, 0, 1),
      },
    }),
    order(7, {
      logistics: {
        ...order(7).logistics,
        pickup_window_start: local(8, 0, -1),
        pickup_window_end: local(12, 0, -1),
      },
    }),
    order(8, {
      logistics: { ...order(8).logistics, origin_kind: "depot" },
      pickup_latitude: null,
      pickup_longitude: null,
    }),
  ];
  const built = buildInstance({
    depot: DEPOT,
    serviceDate: DATE,
    now: NOW,
    orders,
    trucks: [truck(1)],
    params: withParams(),
  });
  const accounted =
    built.instance.requests.length +
    built.preExcluded.length +
    built.scheduledLater.length;
  assert.equal(accounted, orders.length);
  assert.deepEqual(
    built.preExcluded.map((x) => [x.orderId, x.reason]).sort(),
    [
      [uuid(5), "missing_coordinates"],
      [uuid(7), "window_passed"],
    ].sort(),
  );
  assert.deepEqual(built.scheduledLater, [uuid(6)]);
  const bySource = Object.fromEntries(
    built.metas.map((m) => [m.orderId, m.weightSource]),
  );
  assert.equal(bySource[uuid(1)], "size_estimate");
  assert.equal(bySource[uuid(2)], "declared"); // legacy weight kept as declared
  assert.equal(bySource[uuid(3)], "default_assumed");
  assert.equal(bySource[uuid(4)], "weighed");
  const w = Object.fromEntries(
    built.instance.requests.map((r) => [r.id, r.weightKg]),
  );
  assert.equal(w[uuid(2)], 4.5);
  assert.equal(w[uuid(4)], 12);
  assert.equal(w[uuid(1)], withParams().sizeKg.medium);
  const depotOrder = built.instance.requests.find((r) => r.id === uuid(8));
  assert.equal(depotOrder.origin, "depot");
  assert.equal(depotOrder.pickup, null);
});

test("buildInstance excludes unsuitable trucks with reasons and leaves energy unknown visible", () => {
  const built = buildInstance({
    depot: DEPOT,
    serviceDate: DATE,
    now: NOW,
    orders: [order(1)],
    params: withParams(),
    trucks: [
      truck(1),
      truck(2, { vehicle_type: "motorcycle" }),
      truck(3, { capacity_kg: null }),
      truck(4, { status: "maintenance" }),
      truck(5, { profile: { ...truck(5).profile, depot_id: "other" } }),
      truck(6, { fuel_level_percent: null, profile: null }),
    ],
  });
  assert.deepEqual(built.excludedTrucks.map((t) => t.reason).sort(), [
    "no_capacity_kg",
    "not_a_truck",
    "other_depot",
    "status_maintenance",
  ]);
  assert.equal(built.instance.trucks.length, 2);
  assert.ok(built.warnings.some((w) => w.startsWith("energy_unknown")));
  assert.ok(built.warnings.some((w) => w.startsWith("volume_unconstrained")));
});

test("the planning day starts at the shift when planning ahead, and after 'now + lead' today", () => {
  const params = withParams();
  const ahead = buildInstance({
    depot: DEPOT,
    serviceDate: "2026-10-23",
    now: NOW,
    orders: [],
    trucks: [],
    params,
  });
  assert.equal(ahead.instance.earliestDepart, params.shiftStart);
  const late = new Date(Date.UTC(2026, 9, 22, 4, 0) - 0); // 10:30 Yangon
  const today = buildInstance({
    depot: DEPOT,
    serviceDate: DATE,
    now: late,
    orders: [],
    trucks: [],
    params,
  });
  assert.equal(
    today.instance.earliestDepart,
    10.5 * 60 + params.dispatchLeadMin,
  );
});

test("a straight-line plan is valid, labelled, and accounts for every order", async () => {
  const result = await planDispatch(
    input({
      orders: [
        ...[1, 2, 3, 4, 5, 6].map((n) => order(n)),
        order(7, { delivery_longitude: null }),
        order(8, { parcel_weight_kg: 9999 }),
      ],
    }),
    noNetwork,
  );
  assert.equal(result.ok, true);
  const p = result.payload;
  assert.equal(p.data_quality, "straight_line");
  assert.equal(p.matrix, undefined);
  assert.ok(result.warnings.some((w) => w.startsWith("straight_line")));
  assert.ok(result.warnings.some((w) => w.startsWith("flood_unknown")));
  const ids = p.orders.map((o) => o.order_id);
  assert.equal(new Set(ids).size, 8);
  const reasons = Object.fromEntries(
    p.orders
      .filter((o) => o.disposition === "unassigned")
      .map((o) => [o.order_id, o.unassigned_reason]),
  );
  assert.equal(reasons[uuid(7)], "missing_coordinates");
  assert.equal(reasons[uuid(8)], "exceeds_capacity_single");
  assert.match(result.basis, /not yet validated/);
  assert.doesNotMatch(JSON.stringify(result.basis), /optimal|guarantee/i);
});

test("the payload satisfies the checks save_dispatch_run repeats in SQL", async () => {
  const result = await planDispatch(
    input({
      orders: [1, 2, 3, 4, 5, 6]
        .map((n) => order(n))
        .concat([
          order(9, {
            logistics: { ...order(9).logistics, origin_kind: "depot" },
            pickup_latitude: null,
            pickup_longitude: null,
          }),
        ]),
    }),
    noNetwork,
  );
  const p = result.payload;
  const capacity = Object.fromEntries(
    [truck(1), truck(2)].map((t) => [t.id, t.capacity_kg]),
  );
  for (const route of p.routes) {
    assert.ok(route.peak_kg <= capacity[route.vehicle_id]);
    assert.deepEqual(
      route.stops.map((s) => s.seq),
      route.stops.map((_, i) => i + 1),
    );
    assert.ok(
      new Date(route.planned_return_at) >= new Date(route.planned_depart_at),
    );
  }
  for (const o of p.orders.filter((x) => x.disposition === "assigned")) {
    const route = p.routes.find((r) => r.vehicle_id === o.vehicle_id);
    const stops = route.stops.filter((s) => s.order_id === o.order_id);
    assert.equal(stops.filter((s) => s.stop_type === "delivery").length, 1);
    const pickup = stops.find((s) => s.stop_type === "pickup");
    if (o.origin_kind === "door")
      assert.ok(
        pickup &&
          pickup.seq < stops.find((s) => s.stop_type === "delivery").seq,
      );
    else assert.equal(pickup, undefined);
  }
  for (const o of p.orders.filter((x) => x.disposition === "unassigned"))
    assert.equal(
      p.routes.some((r) => r.stops.some((s) => s.order_id === o.order_id)),
      false,
    );
});

test("planning is deterministic for the same input", async () => {
  const a = await planDispatch(input(), noNetwork);
  const b = await planDispatch(input(), noNetwork);
  assert.equal(a.plan.hash, b.plan.hash);
  assert.deepEqual(a.payload.routes, b.payload.routes);
});

function matrixApi(calls) {
  return async (url) => {
    calls.push(url);
    const coords = decodeURIComponent(url.split("/driving/")[1].split("?")[0])
      .split(";")
      .map((c) => c.split(",").map(Number));
    const pts = coords.map(([lng, lat]) => ({ lat, lng }));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        code: "Ok",
        durations: pts.map((a) =>
          pts.map((b) => ((haversineKm(a, b) * 1.4) / 30) * 3600),
        ),
        distances: pts.map((a) => pts.map((b) => haversineKm(a, b) * 1400)),
      }),
    };
  };
}

test("with road data the plan is labelled road_matrix and keeps the draft matrix", async () => {
  const calls = [];
  const deps = {
    nowMs: () => 0,
    buildMatrix: (points, params) =>
      buildRoadMatrix(points, params, {
        fetch: matrixApi(calls),
        token: "t",
        sleep: async () => {},
      }),
  };
  const result = await planDispatch(input(), deps);
  assert.equal(result.ok, true);
  assert.equal(result.payload.data_quality, "road_matrix");
  assert.equal(result.quality.matrix.coverage, 1);
  assert.ok(calls.length >= 1 && calls.length <= 55);
  assert.equal(result.payload.matrix.nodes.length, 2 * 6 + 1);
  assert.equal(result.payload.matrix.duration_s.length, 13 * 13);
  assert.ok(result.payload.matrix.elements_billed > 0);
  assert.ok(!result.warnings.some((w) => w.startsWith("straight_line")));
});

const wholeAreaHazard = (hazard) => ({
  features: [
    {
      properties: { hazard_class: hazard },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [96.0, 16.7],
            [96.4, 16.7],
            [96.4, 17.1],
            [96.0, 17.1],
            [96.0, 16.7],
          ],
        ],
      },
    },
  ],
});

test("a flood layer adds slowdown and a flood term and is shown as a static map", async () => {
  const dry = await planDispatch(input(), noNetwork);
  const wet = await planDispatch(
    input({ field: new FloodField(wholeAreaHazard(3)) }),
    noNetwork,
  );
  assert.equal(wet.quality.flood.status, "layer");
  const dryTime = dry.payload.routes.reduce((s, r) => s + r.travel_min, 0);
  const wetTime = wet.payload.routes.reduce((s, r) => s + r.travel_min, 0);
  assert.ok(wetTime > dryTime);
  assert.ok(
    wet.payload.routes.some(
      (r) => r.score_flood > 0 && r.flags.includes("flood_exposure"),
    ),
  );
  assert.ok(
    wet.payload.routes.every(
      (r) =>
        /static map, not live/.test(r.explanation.summary) ||
        r.score_flood === 0,
    ),
  );
  assert.ok(dry.payload.routes.every((r) => r.score_flood === 0));
});

test("a verified blocked report next to an order's pin leaves it unassigned as flood_blocked", async () => {
  const target = order(1);
  const reports = [
    {
      lat: target.delivery_latitude,
      lng: target.delivery_longitude,
      severity: "blocked",
    },
  ];
  const result = await planDispatch(input({ reports }), noNetwork);
  const entry = result.payload.orders.find((o) => o.order_id === target.id);
  assert.equal(entry.disposition, "unassigned");
  assert.equal(entry.unassigned_reason, "flood_blocked");
  assert.equal(result.quality.flood.status, "reports_only");
});

test("planning refuses with a clear code when it cannot proceed", async () => {
  assert.equal(
    (await planDispatch(input({ orders: [] }), noNetwork)).code,
    "no_open_orders",
  );
  assert.equal(
    (
      await planDispatch(
        input({ trucks: [truck(1, { capacity_kg: null })] }),
        noNetwork,
      )
    ).code,
    "no_eligible_trucks",
  );
  assert.equal(
    (
      await planDispatch(
        input({
          depot: {
            ...DEPOT,
            location_status: "unverified",
            latitude: null,
            longitude: null,
          },
        }),
        noNetwork,
      )
    ).code,
    "depot_unverified",
  );
  const many = Array.from({ length: 151 }, (_, i) => order(i + 1));
  assert.equal(
    (await planDispatch(input({ orders: many }), noNetwork)).code,
    "too_many_orders",
  );
});

// ---- handler -------------------------------------------------------------

function source(over = {}) {
  const saves = [];
  const s = {
    saves,
    loadDepot: async () => DEPOT,
    loadTrucks: async () => [truck(1), truck(2)],
    loadOrders: async () => [1, 2, 3, 4].map((n) => order(n)),
    loadFlood: async () => ({ field: null, layerId: null }),
    loadReports: async () => [],
    save: async (payload, key, replace) => {
      saves.push({ payload, key, replace });
      return {
        saved: true,
        duplicate: false,
        run_id: uuid(5000),
        revision: 1,
        status: "draft",
      };
    },
    ...over,
  };
  return s;
}
const ctx = (over = {}) => ({
  role: "manager",
  source: source(),
  makeDeps: () => noNetwork,
  now: NOW,
  newKey: () => uuid(7000),
  ...over,
});
const body = (over = {}) => ({ depotId: DEPOT.id, serviceDate: DATE, ...over });

test("handler: authentication and role", async () => {
  assert.equal((await handlePlan(body(), ctx({ role: null }))).status, 401);
  assert.equal(
    (await handlePlan(body(), ctx({ role: "customer" }))).status,
    403,
  );
  assert.equal((await handlePlan(body(), ctx({ role: "driver" }))).status, 403);
});

test("handler: request validation", () => {
  const bad = [
    null,
    [],
    {},
    { depotId: "x", serviceDate: DATE },
    body({ serviceDate: "22/10/2026" }),
    body({ mode: "run" }),
    body({ matrixPolicy: "yes" }),
    body({ orderIds: ["nope"] }),
    body({ vehicleIds: Array(21).fill(uuid(1)) }),
    body({ paramsOverride: { shiftEnd: 1 } }),
    body({ paramsOverride: { maxIterations: 1e9 } }),
    body({ paramsOverride: { deadlineMs: "fast" } }),
    body({ clientKey: "abc" }),
    body({ seed: 1.5 }),
    body({ driverByVehicle: { x: "y" } }),
  ];
  for (const value of bad)
    assert.equal(parsePlanRequest(value).ok, false, JSON.stringify(value));
  const good = parsePlanRequest(
    body({
      mode: "persist",
      paramsOverride: { maxIterations: 100 },
      driverByVehicle: { [uuid(901)]: null },
    }),
  );
  assert.equal(good.ok, true);
  assert.equal(good.value.replaceDraft, false);
  assert.equal(good.value.matrixPolicy, "auto");
});

test("handler: preview returns the plan without saving", async () => {
  const s = source();
  const res = await handlePlan(body(), ctx({ source: s }));
  assert.equal(res.status, 200);
  assert.equal(res.body.simulated, false);
  assert.equal(res.body.run.id, null);
  assert.equal(res.body.run.status, "preview");
  assert.equal(s.saves.length, 0);
  assert.ok(res.body.assumptions.length > 5);
  assert.equal(res.body.quality.tier, "straight_line");
  assert.equal(res.body.today, "2026-10-22");
});

test("handler: persist saves once with the client key and returns the run", async () => {
  const s = source();
  const res = await handlePlan(
    body({ mode: "persist", replaceDraft: true, clientKey: uuid(42) }),
    ctx({ source: s }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.run.id, uuid(5000));
  assert.equal(s.saves.length, 1);
  assert.equal(s.saves[0].key, uuid(42));
  assert.equal(s.saves[0].replace, true);
  assert.equal(s.saves[0].payload.depot_id, DEPOT.id);
  const generated = source();
  await handlePlan(body({ mode: "persist" }), ctx({ source: generated }));
  assert.equal(generated.saves[0].key, uuid(7000));
});

test("handler: a manager override of the driver beats the vehicle default", async () => {
  const s = source();
  await handlePlan(
    body({ mode: "persist", driverByVehicle: { [uuid(901)]: uuid(777) } }),
    ctx({ source: s }),
  );
  const drivers = Object.fromEntries(
    s.saves[0].payload.routes.map((r) => [r.vehicle_id, r.driver_id]),
  );
  if (uuid(901) in drivers) assert.equal(drivers[uuid(901)], uuid(777));
  if (uuid(902) in drivers) assert.equal(drivers[uuid(902)], uuid(802));
});

test("handler: error statuses", async () => {
  assert.equal(
    (
      await handlePlan(
        body(),
        ctx({ source: source({ loadDepot: async () => null }) }),
      )
    ).status,
    404,
  );
  const unverified = {
    ...DEPOT,
    location_status: "unverified",
    latitude: null,
    longitude: null,
  };
  const r409 = await handlePlan(
    body(),
    ctx({ source: source({ loadDepot: async () => unverified }) }),
  );
  assert.equal(r409.status, 409);
  assert.equal(r409.body.error.code, "depot_unverified");
  assert.equal(
    (
      await handlePlan(
        body(),
        ctx({ source: source({ loadOrders: async () => [] }) }),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await handlePlan(
        body(),
        ctx({ source: source({ loadTrucks: async () => [] }) }),
      )
    ).body.error.code,
    "no_eligible_trucks",
  );
  const draft = await handlePlan(
    body({ mode: "persist" }),
    ctx({
      source: source({
        save: async () => ({
          saved: false,
          reason: "draft_exists",
          run_id: uuid(9),
        }),
      }),
    }),
  );
  assert.equal(draft.status, 409);
  assert.equal(draft.body.error.code, "draft_exists");
  assert.equal(draft.body.error.detail.run_id, uuid(9));
});

test("handler: a Matrix outage degrades the data tier, it is not an error", async () => {
  const deps = {
    nowMs: () => 0,
    buildMatrix: (points, params) =>
      buildRoadMatrix(points, params, {
        fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
        token: "t",
        sleep: async () => {},
      }),
  };
  const res = await handlePlan(body(), ctx({ makeDeps: () => deps }));
  assert.equal(res.status, 200);
  assert.equal(res.body.quality.tier, "straight_line");
  assert.ok(
    res.body.quality.matrix === null ||
      res.body.quality.matrix.failedRequests > 0,
  );
});
