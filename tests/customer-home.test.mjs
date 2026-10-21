import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotifications,
  buildTodayItems,
  codDue,
  contextualActions,
  homeSummary,
  matchOrders,
  pickNextParcel,
  pushRecent,
} from "../src/lib/delivery/customer-home.ts";

// 2026-10-20 10:00 in Yangon (UTC+6:30)
const now = Date.parse("2026-10-20T03:30:00Z");
const at = (minutes) => new Date(now + minutes * 60_000).toISOString();

function order(overrides = {}) {
  return {
    id: "o1",
    tracking_code: "OE-1001",
    status: "in_transit",
    delivery_address: "Yangon",
    cod_amount: 0,
    cod_status: "not_required",
    estimated_delivery_at: at(30),
    traffic_delay_minutes: 0,
    created_at: at(-600),
    driver_id: "d1",
    driver_name: "Aung",
    driver_phone: "09123",
    ...overrides,
  };
}

test("next parcel prefers the one already on the road", () => {
  const next = pickNextParcel([
    order({ id: "a", status: "assigned", estimated_delivery_at: at(5) }),
    order({ id: "b", status: "in_transit", estimated_delivery_at: at(60) }),
    order({ id: "c", status: "delivered" }),
  ]);
  assert.equal(next?.id, "b");
  assert.equal(pickNextParcel([order({ status: "delivered" })]), null);
});

test("arriving today covers zero, delayed and missed deliveries", () => {
  assert.deepEqual(buildTodayItems([], [], now), []);
  const items = buildTodayItems(
    [
      order({ id: "ok", estimated_delivery_at: at(40) }),
      order({ id: "late", estimated_delivery_at: at(-25) }),
      order({ id: "bad", status: "failed" }),
      order({
        id: "tomorrow",
        status: "assigned",
        estimated_delivery_at: at(60 * 24),
      }),
      order({ id: "noeta", status: "assigned", estimated_delivery_at: null }),
    ],
    [
      {
        id: 1,
        order_id: "bad",
        status: "failed",
        note: null,
        created_at: at(-20),
      },
    ],
    now,
  );
  assert.deepEqual(
    items.map((item) => [item.order.id, item.state]),
    [
      ["bad", "missed"],
      ["late", "delayed"],
      ["ok", "on_the_way"],
    ],
  );
  assert.equal(
    items.find((item) => item.order.id === "late")?.delayMinutes,
    25,
  );
});

test("out-for-delivery parcels without an ETA show no time", () => {
  const [item] = buildTodayItems(
    [order({ estimated_delivery_at: null })],
    [],
    now,
  );
  assert.equal(item.etaAt, null);
  assert.equal(item.state, "on_the_way");
});

test("notifications rank urgent alerts above routine updates", () => {
  const list = buildNotifications(
    [
      order({ id: "d", status: "delivered", created_at: at(-60) }),
      order({ id: "t", cod_amount: 5000, cod_status: "pending" }),
    ],
    [],
    now,
  );
  assert.deepEqual(
    list.map((item) => item.priority),
    ["high", "high", "normal"],
  );
  assert.deepEqual(
    new Set(list.slice(0, 2).map((item) => item.kind)),
    new Set(["cod_due", "out_for_delivery"]),
  );
  assert.equal(list[2].kind, "delivered");
  assert.equal(list.at(-1)?.priority, "normal");
});

test("contextual actions appear only when they apply", () => {
  assert.deepEqual(contextualActions(null), []);
  assert.deepEqual(contextualActions(order({ status: "delivered" })), []);
  const ids = contextualActions(
    order({ cod_amount: 5000, cod_status: "pending" }),
  ).map((action) => action.id);
  assert.deepEqual(ids, ["cod", "share", "driver"]);
  assert.deepEqual(
    contextualActions(order({ status: "assigned", driver_phone: null })),
    [],
  );
});

test("tracking number search ignores case, spaces and dashes", () => {
  const orders = [
    order({ tracking_code: "OE-1001" }),
    order({ id: "x", tracking_code: "OE-2002" }),
  ];
  assert.equal(matchOrders(orders, "oe 1001").length, 1);
  assert.equal(matchOrders(orders, "oe").length, 2);
  assert.equal(matchOrders(orders, "  ").length, 0);
  assert.equal(matchOrders(orders, "zzz").length, 0);
});

test("an overdue parcel is never announced as arriving", () => {
  const [item] = buildNotifications(
    [order({ estimated_delivery_at: at(-25) })],
    [],
    now,
  );
  assert.equal(item.kind, "out_for_delivery");
  assert.match(item.body, /later than estimated/);
  const [soon] = buildNotifications(
    [order({ estimated_delivery_at: at(3) })],
    [],
    now,
  );
  assert.equal(soon.kind, "arriving");
});

test("COD due lists unpaid parcels, nearest first, and skips finished ones", () => {
  const list = codDue([
    order({
      id: "a",
      status: "assigned",
      cod_amount: 100,
      cod_status: "pending",
    }),
    order({
      id: "b",
      status: "in_transit",
      cod_amount: 200,
      cod_status: "pending",
    }),
    order({
      id: "c",
      status: "in_transit",
      cod_amount: 300,
      cod_status: "collected",
    }),
    order({
      id: "d",
      status: "delivered",
      cod_amount: 400,
      cod_status: "pending",
    }),
    order({ id: "e", status: "in_transit", cod_amount: 0 }),
  ]);
  assert.deepEqual(
    list.map((item) => item.id),
    ["b", "a"],
  );
  assert.deepEqual(codDue([]), []);
});

test("recent tracking codes stay unique, newest first, and capped", () => {
  let list = [];
  for (const code of ["OE-1", "OE-2", "oe 1", "OE-3", "OE-4", "OE-5", "OE-6"]) {
    list = pushRecent(list, code);
  }
  assert.deepEqual(list, ["OE-6", "OE-5", "OE-4", "OE-3", "oe 1"]);
  assert.deepEqual(pushRecent(["OE-1"], "   "), ["OE-1"]);
});

test("homeSummary describes the delivery state", () => {
  assert.equal(homeSummary([]), "No deliveries on the way");
  assert.equal(
    homeSummary([order({ status: "delivered" })]),
    "No deliveries on the way",
  );
  assert.equal(homeSummary([order()]), "1 delivery on the way");
  assert.equal(
    homeSummary([order(), order({ id: "o2", status: "assigned" })]),
    "2 deliveries on the way",
  );
});
