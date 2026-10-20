import assert from "node:assert/strict";
import test from "node:test";
import {
  bearingDegrees,
  buildRiderRoute,
  compassDirection,
  distanceKm,
  formatDistance,
  legFor,
  summariseRoute,
} from "../src/lib/delivery/rider-route.ts";

const now = Date.parse("2026-10-21T06:00:00Z");
const today = "2026-10-21T03:00:00Z";
const yesterday = "2026-10-19T03:00:00Z";

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
    ...extra,
  };
}

test("distance, bearing, and labels describe a direct heading honestly", () => {
  const sule = { latitude: 16.7746, longitude: 96.1588 };
  const shwedagon = { latitude: 16.7983, longitude: 96.1497 };
  assert.ok(Math.abs(distanceKm(sule, shwedagon) - 2.81) < 0.05);
  assert.equal(compassDirection(bearingDegrees(sule, shwedagon)), "north");
  assert.equal(compassDirection(359), "north");
  assert.equal(compassDirection(92), "east");
  assert.equal(formatDistance(0.347), "350 m");
  assert.equal(formatDistance(1.24), "1.2 km");
  assert.equal(formatDistance(null), "—");
});

test("the next leg is the pickup until the parcel is on board", () => {
  assert.equal(legFor(order("a", "accepted")).kind, "pickup");
  assert.equal(legFor(order("a", "picked_up")).kind, "dropoff");
  assert.equal(legFor(order("a", "in_transit")).address, "Drop a");
  assert.equal(
    legFor(order("a", "assigned", { pickup_latitude: null })).point,
    null,
  );
});

test("route phase and order follow delivery progress", () => {
  const events = [
    { id: 1, order_id: "done", status: "delivered", created_at: today },
    { id: 2, order_id: "old", status: "delivered", created_at: yesterday },
  ];
  const ready = buildRiderRoute(
    [order("bb", "assigned"), order("a", "assigned")],
    [],
    "rider",
    now,
  );
  assert.equal(ready.phase, "ready");
  assert.deepEqual(
    ready.active.map((o) => o.id),
    ["a", "bb"],
  );

  const active = buildRiderRoute(
    [
      order("old", "delivered"),
      order("done", "delivered"),
      order("a", "accepted"),
      order("bb", "in_transit"),
      order("other", "assigned", { driver_id: "someone-else" }),
    ],
    events,
    "rider",
    now,
  );
  assert.equal(active.phase, "active");
  assert.equal(active.current.id, "bb");
  assert.deepEqual(
    active.stops.map((o) => o.id),
    ["done", "bb", "a"],
  );

  const complete = buildRiderRoute(
    [order("done", "delivered")],
    events,
    "rider",
    now,
  );
  assert.equal(complete.phase, "complete");
  assert.equal(buildRiderRoute([], [], "rider", now).phase, "idle");
});

test("route summary keeps delivery and COD outcomes separate", () => {
  const orders = [
    order("a", "delivered", { cod_amount: 25000, cod_status: "collected" }),
    order("bb", "delivered", { cod_amount: 10000, cod_status: "pending" }),
    order("ccc", "failed", { cod_amount: 5000, cod_status: "pending" }),
  ];
  const events = orders.map((o, index) => ({
    id: index,
    order_id: o.id,
    status: o.status,
    created_at: `2026-10-21T0${index + 2}:00:00Z`,
  }));
  const route = buildRiderRoute(orders, events, "rider", now);
  const summary = summariseRoute(route, events);
  assert.equal(summary.delivered, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.codExpected, 35000);
  assert.equal(summary.codCollected, 25000);
  assert.equal(summary.codOutstanding, 10000);
  assert.equal(summary.codAwaitingHandover, 25000);
  assert.equal(summary.durationMinutes, 120);
});
