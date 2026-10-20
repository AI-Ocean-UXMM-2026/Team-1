import assert from "node:assert/strict";
import test from "node:test";
import {
  attentionSummary,
  hourlyBuckets,
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
  );
  assert.deepEqual(summary, {
    needsRider: 1,
    delayed: 1,
    codPending: 1,
    pendingReports: 1,
  });
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
