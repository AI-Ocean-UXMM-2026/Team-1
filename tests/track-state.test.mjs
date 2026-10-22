import assert from "node:assert/strict";
import test from "node:test";
import { describeTracking } from "../src/lib/delivery/track-state.ts";

const now = Date.parse("2026-10-20T04:00:00Z");
const at = (minutes) => new Date(now + minutes * 60_000).toISOString();

function order(overrides = {}) {
  return {
    id: "o1",
    tracking_code: "OR-1",
    status: "in_transit",
    estimated_delivery_at: at(20),
    traffic_delay_minutes: 0,
    driver_name: "Aung",
    driver_phone: "+95 9 1",
    latest_location: {
      latitude: 16.8,
      longitude: 96.1,
      accuracy_meters: 5,
      recorded_at: at(0),
    },
    ...overrides,
  };
}

test("a live parcel leads with its countdown and live location", () => {
  const view = describeTracking(order(), [], now);
  assert.equal(view.stage, "on_the_way");
  assert.equal(view.headline, "Arriving in 20 min");
  assert.equal(view.location.kind, "live");
  assert.equal(view.delayed, false);
  assert.equal(view.primaryAction, "track");
});

test("past the estimate reads as running late and offers the rider's number", () => {
  const view = describeTracking(
    order({ estimated_delivery_at: at(-30) }),
    [],
    now,
  );
  assert.equal(view.headline, "Running late");
  assert.equal(view.delayed, true);
  assert.equal(view.primaryAction, "call");
  assert.match(view.detail, /still on the way/);
});

test("traffic delay is flagged without calling the parcel late", () => {
  const view = describeTracking(order({ traffic_delay_minutes: 8 }), [], now);
  assert.equal(view.delayed, true);
  assert.match(view.detail, /traffic adds about 8 min/);
  assert.equal(view.headline, "Arriving in 20 min");
});

test("stale GPS names how long and warns", () => {
  const view = describeTracking(
    order({
      latest_location: {
        latitude: 1,
        longitude: 1,
        accuracy_meters: 5,
        recorded_at: at(-12),
      },
    }),
    [],
    now,
  );
  assert.equal(view.location.kind, "stale");
  assert.equal(view.location.title, "No new location for 12 min");
  assert.equal(view.location.tone, "warning");
  assert.equal(view.primaryAction, "call");
});

test("a rider between pings is not an alarm", () => {
  const view = describeTracking(
    order({
      latest_location: {
        latitude: 1,
        longitude: 1,
        accuracy_meters: 5,
        recorded_at: at(-2),
      },
    }),
    [],
    now,
  );
  assert.equal(view.location.kind, "between");
  assert.equal(view.location.tone, "info");
});

test("a collected parcel with no location yet says so", () => {
  const view = describeTracking(order({ latest_location: null }), [], now);
  assert.equal(view.location.kind, "none");
});

test("before pickup leads with the rider assignment, not an invented ETA", () => {
  const view = describeTracking(
    order({ status: "accepted", latest_location: null }),
    [],
    now,
  );
  assert.equal(view.stage, "preparing");
  assert.equal(view.headline, "Waiting for pickup");
  assert.match(view.detail, /Aung is assigned/);
  assert.equal(view.location.kind, "before_pickup");
  assert.equal(
    describeTracking(
      order({ status: "pending", latest_location: null }),
      [],
      now,
    ).headline,
    "Finding a rider",
  );
});

test("a failed delivery explains why and points to help", () => {
  const events = [
    {
      id: 1,
      order_id: "o1",
      status: "failed",
      note: "Recipient unavailable",
      created_at: at(-5),
    },
  ];
  const view = describeTracking(order({ status: "failed" }), events, now);
  assert.equal(view.stage, "stopped");
  assert.equal(view.headline, "Delivery issue");
  assert.match(view.detail, /Recipient unavailable/);
  assert.equal(view.primaryAction, "help");
  assert.equal(view.location.kind, "stopped");
});

test("a delivered parcel shows when it arrived", () => {
  const events = [
    {
      id: 1,
      order_id: "o1",
      status: "delivered",
      note: null,
      created_at: at(-60),
    },
  ];
  const view = describeTracking(order({ status: "delivered" }), events, now);
  assert.equal(view.stage, "delivered");
  assert.match(view.detail, /^Delivered /);
});
