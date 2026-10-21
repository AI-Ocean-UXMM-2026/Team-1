import assert from "node:assert/strict";
import test from "node:test";
import {
  attentionSummary,
  deliveredToday,
  hourlyBuckets,
  managerExceptions,
  needsRider,
  recentOrders,
} from "../src/lib/delivery/dashboard.ts";

const now = Date.parse("2026-10-20T12:00:00Z");

function order(overrides = {}) {
  return {
    id: "order",
    status: "pending",
    driver_id: null,
    cod_amount: 0,
    cod_status: "not_required",
    traffic_delay_minutes: 0,
    created_at: "2026-10-20T11:30:00Z",
    ...overrides,
  };
}

test("needsRider flags pending and failed orders plus unassigned active ones", () => {
  assert.equal(needsRider(order({ status: "pending" })), true);
  assert.equal(needsRider(order({ status: "failed", driver_id: "r1" })), true);
  assert.equal(needsRider(order({ status: "assigned" })), true);
  assert.equal(
    needsRider(order({ status: "assigned", driver_id: "r1" })),
    false,
  );
  assert.equal(
    needsRider(order({ status: "in_transit", driver_id: "r1" })),
    false,
  );
});

test("hourlyBuckets counts orders into the last twelve hours, oldest first", () => {
  const buckets = hourlyBuckets(
    [
      order({ created_at: "2026-10-20T11:30:00Z" }),
      order({ created_at: "2026-10-20T11:45:00Z" }),
      order({ created_at: "2026-10-20T01:00:00Z" }),
      order({ created_at: "2026-10-19T00:00:00Z" }),
      order({ created_at: "2026-10-20T13:00:00Z" }),
    ],
    12,
    now,
  );
  assert.equal(buckets.length, 12);
  assert.equal(buckets[11], 2);
  assert.equal(buckets[0], 1);
  assert.equal(
    buckets.reduce((sum, value) => sum + value, 0),
    3,
  );
});

test("attentionSummary counts each operational exception once", () => {
  const summary = attentionSummary(
    [
      order({ status: "pending" }),
      order({
        status: "in_transit",
        driver_id: "r1",
        traffic_delay_minutes: 12,
      }),
      order({
        status: "delivered",
        driver_id: "r1",
        cod_amount: 5000,
        cod_status: "pending",
      }),
    ],
    [{ status: "pending" }, { status: "verified" }],
    now,
    [
      {
        order_id: "delivered",
        status: "delivered",
        created_at: "2026-10-20T11:00:00Z",
      },
    ],
  );
  assert.deepEqual(summary, {
    needsRider: 1,
    delayed: 1,
    codPending: 1,
    codPendingTotal: 5000,
    codToSettle: 0,
    codToSettleTotal: 0,
    deliveredToday: 1,
    gpsLive: 0,
    staleLocations: 1,
    pendingReports: 1,
  });
});

test("attentionSummary separates live GPS and collected cash exposure", () => {
  const summary = attentionSummary(
    [
      order({
        status: "in_transit",
        driver_id: "r1",
        latest_location: { recorded_at: "2026-10-20T11:59:30Z" },
      }),
      order({
        id: "stale",
        status: "picked_up",
        driver_id: "r2",
        latest_location: { recorded_at: "not-a-date" },
      }),
      order({
        id: "cash",
        status: "delivered",
        cod_amount: 12000,
        cod_status: "collected",
      }),
    ],
    [],
    now,
  );

  assert.equal(summary.gpsLive, 1);
  assert.equal(summary.staleLocations, 1);
  assert.equal(summary.codPending, 0);
  assert.equal(summary.codToSettle, 1);
  assert.equal(summary.codToSettleTotal, 12000);
});

test("deliveredToday uses the manager's local calendar day", () => {
  const localNow = new Date(2026, 9, 20, 0, 30).getTime();
  const sameDay = new Date(2026, 9, 20, 0, 1).toISOString();
  const previousDay = new Date(2026, 9, 19, 23, 59).toISOString();

  assert.equal(
    deliveredToday({ status: "delivered", created_at: sameDay }, localNow),
    true,
  );
  assert.equal(
    deliveredToday({ status: "delivered", created_at: previousDay }, localNow),
    false,
  );
  assert.equal(
    deliveredToday({ status: "cancelled", created_at: sameDay }, localNow),
    false,
  );
});

test("managerExceptions ranks urgent location and rider safety cases first", () => {
  const exceptions = managerExceptions(
    [
      order({
        id: "stale",
        tracking_code: "OERN-STALE",
        status: "in_transit",
        driver_id: "r1",
        driver_name: "Ko Aung",
        latest_location: { recorded_at: "2026-10-20T11:50:00Z" },
      }),
      order({
        id: "cash",
        tracking_code: "OERN-CASH",
        status: "delivered",
        cod_amount: 9000,
        cod_status: "collected",
      }),
      order({ id: "new", tracking_code: "OERN-NEW", status: "pending" }),
    ],
    [
      {
        id: "request",
        driver_name: "Ma Nilar",
        status: "open",
        category: "accident",
        note: "Minor collision",
        created_at: "2026-10-20T11:58:00Z",
      },
    ],
    now,
    3,
  );

  assert.deepEqual(
    exceptions.map((item) => item.id),
    ["location-stale", "request-request", "cod-cash"],
  );
});

test("recentOrders sorts newest first and caps the list", () => {
  const list = recentOrders(
    [
      order({ id: "a", created_at: "2026-10-20T09:00:00Z" }),
      order({ id: "b", created_at: "2026-10-20T11:00:00Z" }),
      order({ id: "c", created_at: "2026-10-20T10:00:00Z" }),
    ],
    2,
  );
  assert.deepEqual(
    list.map((item) => item.id),
    ["b", "c"],
  );
});
