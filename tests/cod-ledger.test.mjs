import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCodLedger,
  summariseCodLedger,
} from "../src/lib/delivery/cod-ledger.ts";

const order = (id, status, cod_amount, extra = {}) => ({
  id,
  tracking_code: id.toUpperCase(),
  status,
  cod_amount,
  driver_name: "Aung",
  customer_name: "May",
  ...extra,
});
const payment = (order_id, amount, status = "collected") => ({
  order_id,
  amount,
  status,
  collected_at: "2026-10-20T05:00:00Z",
  settled_at: null,
});

test("orders without COD, and failed or cancelled orders, owe nothing", () => {
  const rows = buildCodLedger(
    [
      order("a", "delivered", 0),
      order("b", "failed", 5000),
      order("c", "cancelled", 5000),
    ],
    [],
    [],
  );
  assert.deepEqual(rows, []);
});

test("collected cash is to settle, exact or not", () => {
  const rows = buildCodLedger(
    [order("a", "delivered", 68000), order("b", "delivered", 30000)],
    [payment("a", 68000), payment("b", 25000)],
    [
      {
        order_id: "b",
        cod_collected: 25000,
        cod_discrepancy_reason: "Customer short of cash",
        reported_at: "2026-10-20T05:01:00Z",
      },
    ],
  );
  const b = rows.find((row) => row.order.id === "b");
  assert.equal(b.state, "to_settle");
  assert.equal(b.difference, -5000);
  assert.equal(b.reason, "Customer short of cash");
  assert.equal(rows.find((row) => row.order.id === "a").difference, 0);
});

test("a delivered order with no cash recorded is an exception, listed first", () => {
  const rows = buildCodLedger(
    [order("a", "delivered", 1000), order("b", "delivered", 2000)],
    [payment("a", 1000)],
    [],
  );
  assert.equal(rows[0].order.id, "b");
  assert.equal(rows[0].state, "not_collected");
  assert.equal(rows[0].difference, -2000);
});

test("orders still on the road are awaiting collection", () => {
  const [row] = buildCodLedger([order("a", "in_transit", 9000)], [], []);
  assert.equal(row.state, "awaiting");
  assert.equal(row.collected, null);
});

test("summary totals settle, wait and flag exceptions", () => {
  const rows = buildCodLedger(
    [
      order("a", "delivered", 1000),
      order("b", "delivered", 2000),
      order("c", "delivered", 3000),
      order("d", "in_transit", 4000),
    ],
    [payment("a", 1000), payment("b", 1500, "settled")],
    [],
  );
  assert.deepEqual(summariseCodLedger(rows), {
    awaitingTotal: 4000,
    toSettleTotal: 1000,
    toSettleCount: 1,
    settledTotal: 1500,
    exceptionCount: 2,
  });
});
