import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRiderRoute,
  buildRoutePoints,
  cautionCopy,
  cautionsAlong,
  currentPickupOrders,
  energyForRoute,
  routeCodDue,
} from "../src/lib/delivery/rider-route.ts";

const now = Date.parse("2026-10-21T06:00:00Z");
const hub = { pickup_latitude: 16.769, pickup_longitude: 96.1744 };

function order(id, status, extra = {}) {
  return {
    id,
    tracking_code: `OE-${id}`,
    status,
    driver_id: "rider",
    created_at: `2026-10-21T0${id.length}:00:00Z`,
    pickup_address: `Pickup ${id}`,
    delivery_address: `Drop ${id}`,
    pickup_latitude: 16.8,
    pickup_longitude: 96.15,
    delivery_latitude: 16.81,
    delivery_longitude: 96.16,
    cod_amount: 0,
    cod_status: "not_required",
    estimated_delivery_at: null,
    ...extra,
  };
}

function report(id, latitude, longitude, extra = {}) {
  return {
    id,
    driver_id: "other",
    driver_name: "Rider",
    order_id: null,
    category: "flooding",
    severity: "high",
    description: "Water over the road",
    latitude,
    longitude,
    status: "verified",
    reported_at: "2026-10-21T05:30:00Z",
    expires_at: "2026-10-21T09:00:00Z",
    ...extra,
  };
}

test("parcels waiting at one place become a single pickup point", () => {
  const route = buildRiderRoute(
    [
      order("a", "accepted", { ...hub, created_at: "2026-10-21T01:00:00Z" }),
      order("b", "accepted", {
        pickup_latitude: 16.7692,
        pickup_longitude: 96.1745,
        created_at: "2026-10-21T02:00:00Z",
      }),
      order("c", "accepted", { created_at: "2026-10-21T03:00:00Z" }),
    ],
    [],
    "rider",
    now,
  );
  const points = buildRoutePoints(route);
  assert.deepEqual(
    points.map((point) => `${point.kind}:${point.orders.map((o) => o.id)}`),
    ["pickup:a,b", "dropoff:a", "dropoff:b", "pickup:c", "dropoff:c"],
  );
  assert.equal(points[0].state, "current");
  assert.deepEqual(
    currentPickupOrders(points).map((item) => item.id),
    ["a", "b"],
  );
});

test("parcels on board go straight to their drop-offs", () => {
  const route = buildRiderRoute(
    [
      order("a", "in_transit", { cod_amount: 68000, cod_status: "pending" }),
      order("bb", "accepted"),
    ],
    [],
    "rider",
    now,
  );
  const points = buildRoutePoints(route);
  assert.equal(points[0].kind, "dropoff");
  assert.equal(points[0].state, "current");
  assert.equal(points[0].codDue, 68000);
  assert.deepEqual(currentPickupOrders(points), []);
});

test("cash to collect counts only what is still owed", () => {
  const route = buildRiderRoute(
    [
      order("a", "in_transit", { cod_amount: 68000, cod_status: "pending" }),
      order("bb", "accepted", { cod_amount: 125000, cod_status: "pending" }),
      order("ccc", "accepted", { cod_amount: 5000, cod_status: "collected" }),
    ],
    [],
    "rider",
    now,
  );
  assert.equal(routeCodDue(route), 193000);
});

test("road cautions are the live reports near the path, nearest first", () => {
  const path = [
    { latitude: 16.8, longitude: 96.15 },
    { latitude: 16.83, longitude: 96.15 },
  ];
  const cautions = cautionsAlong(
    path,
    [
      report("far-ahead", 16.825, 96.1505),
      report("near-start", 16.805, 96.151),
      report("off-route", 16.815, 96.17),
      report("rejected", 16.81, 96.15, { status: "rejected" }),
      report("expired", 16.81, 96.15, {
        expires_at: "2026-10-21T05:00:00Z",
      }),
    ],
    now,
  );
  assert.deepEqual(
    cautions.map((caution) => caution.report.id),
    ["near-start", "far-ahead"],
  );
  assert.ok(cautions[0].aheadKm < cautions[1].aheadKm);
  assert.ok(cautions[0].offsetKm < 0.4);
});

test("caution copy says what it is, how bad, and what to do", () => {
  const copy = cautionCopy(report("r", 16.8, 96.15, { severity: "blocked" }));
  assert.equal(copy.title, "Flooding");
  assert.equal(copy.impact, "Blocked");
  assert.equal(copy.confirmed, true);
  assert.ok(copy.advice.length > 0);
  assert.equal(
    cautionCopy(report("p", 16.8, 96.15, { status: "pending" })).confirmed,
    false,
  );
});

test("route energy compares usable range with what is left to ride", () => {
  const ebike = {
    id: "v",
    registration_number: "YGN",
    vehicle_type: "e_bike",
    status: "available",
    energy_source: "electric",
    fuel_level_percent: null,
    battery_level_percent: 40,
    range_km_at_full: 70,
    reserve_percent: 15,
    odometer_km: 0,
    service_due_at_km: null,
    capacity_kg: 12,
  };
  // 25% usable of 70 km = 17.5 km.
  assert.equal(energyForRoute(ebike, 5).status, "enough");
  assert.equal(energyForRoute(ebike, 12, true).status, "tight");
  assert.equal(energyForRoute(ebike, 20, true).status, "short");
  assert.equal(energyForRoute(ebike, 20).source, "battery");
  assert.equal(energyForRoute(null, 5).status, "unknown");
  assert.equal(energyForRoute(ebike, null).status, "unknown");
});
