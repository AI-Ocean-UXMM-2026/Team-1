import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDriverRoute,
  diffRoute,
  parcelState,
  snapshotRoute,
  stopParcels,
} from "../src/lib/delivery/driver-route.ts";

const now = Date.parse("2026-10-21T04:00:00Z");
let serial = 0;

function door(id, status, extra = {}) {
  serial += 1;
  return {
    id,
    tracking_code: `OE-${id}`,
    status,
    driver_id: "driver",
    customer_name: `Customer ${id}`,
    pickup_contact_name: `Sender ${id}`,
    pickup_contact_phone: `+95 9 700 ${id}`,
    recipient_name: `Recipient ${id}`,
    recipient_phone: `+95 9 000 ${id}`,
    created_at: `2026-10-21T01:${String(serial % 60).padStart(2, "0")}:00Z`,
    pickup_address: `Pickup ${id}`,
    pickup_latitude: 16.7 + serial * 0.01,
    pickup_longitude: 96.1,
    delivery_address: `Drop ${id}`,
    delivery_latitude: 16.9 + serial * 0.01,
    delivery_longitude: 96.2,
    cod_amount: 0,
    cod_status: "not_required",
    estimated_delivery_at: null,
    ...extra,
  };
}

// Stops that came from a committed plan carry dispatch_run_stop_id.
const planStop = (order, type, seq, status = "pending", extra = {}) => ({
  id: `${order}-${type}`,
  route_id: "route",
  order_id: order,
  stop_type: type,
  sequence_number: seq,
  status,
  dispatch_run_stop_id: `run-${order}-${type}`,
  planned_arrival_at: `2026-10-21T0${seq}:00:00Z`,
  window_start_at: type === "pickup" ? "2026-10-21T01:30:00Z" : null,
  window_end_at: type === "pickup" ? "2026-10-21T05:30:00Z" : null,
  ...extra,
});

function route(orders, routeStops, extra = {}) {
  return buildDriverRoute({
    orders,
    events: [],
    routeStops,
    driverId: "driver",
    now,
    session: null,
    arrived: [],
    handover: null,
    deferred: [],
    ...extra,
  });
}

const session = {
  status: "in_progress",
  started_at: "2026-10-21T01:00:00Z",
  paused_at: null,
  closed_at: null,
  cod_declared: null,
};
const kinds = (r) =>
  r.stops.map((s) => `${s.kind}:${s.parcels.map((p) => p.id).join("+")}`);

const twoDoors = (statusA = "accepted", statusB = "accepted") => ({
  orders: [door("a", statusA), door("b", statusB)],
  stops: [
    planStop("a", "pickup", 1),
    planStop("b", "pickup", 2),
    planStop("a", "delivery", 3),
    planStop("b", "delivery", 4),
  ],
});

test("a mixed route is ordered by the plan's sequence across both stop types", () => {
  const { orders, stops } = twoDoors();
  const r = route(orders, stops, { session });
  assert.deepEqual(kinds(r), [
    "pickup:a",
    "pickup:b",
    "delivery:a",
    "delivery:b",
  ]);
  assert.deepEqual(
    r.stops.map((s) => s.number),
    [1, 2, 3, 4],
  );
  assert.ok(r.stops.every((s) => s.planned));
});

test("door parcels are not part of the depot load check", () => {
  const { orders, stops } = twoDoors();
  const r = route(orders, stops);
  assert.equal(r.toLoad.length, 0);
  assert.equal(r.toCollect.length, 2);
  assert.equal(
    r.state,
    "READY",
    "nothing to verify at the depot, so the route can start empty",
  );
});

test("a route of only door pickups is not COMPLETED at the start and is IN_PROGRESS once started", () => {
  const { orders, stops } = twoDoors();
  assert.notEqual(route(orders, stops).state, "COMPLETED");
  const started = route(orders, stops, { session });
  assert.equal(started.state, "IN_PROGRESS");
  assert.equal(started.current.kind, "pickup");
  assert.equal(started.current.address, "Pickup a");
  assert.equal(started.current.recipient, "Sender a");
  assert.equal(started.current.phone, "+95 9 700 a");
  assert.deepEqual(
    stopParcels(started.current).map((p) => p.id),
    ["a"],
  );
});

test("unacknowledged door parcels still read as ASSIGNED, then READY", () => {
  const { orders, stops } = twoDoors("assigned", "assigned");
  assert.equal(route(orders, stops).state, "ASSIGNED");
});

test("the pickup window and planned time come from the plan", () => {
  const { orders, stops } = twoDoors();
  const [first] = route(orders, stops, { session }).stops;
  assert.equal(first.windowStart, "2026-10-21T01:30:00Z");
  assert.equal(first.windowEnd, "2026-10-21T05:30:00Z");
  assert.equal(first.etaAt, "2026-10-21T01:00:00Z");
});

test("after a pickup the stop is completed and the route moves to the next actionable stop", () => {
  const { orders, stops } = twoDoors("in_transit", "accepted");
  stops[0].status = "completed";
  const r = route(orders, stops, { session });
  assert.equal(r.stops[0].state, "COMPLETED");
  // b's pickup comes before a's delivery in the plan, even though a is on board.
  assert.equal(r.current.key, "pickup:b");
  assert.equal(r.state, "IN_PROGRESS");
  assert.deepEqual(
    r.onBoard.map((p) => p.id),
    ["a"],
  );
});

test("a delivery stop is not actionable while its parcel is still to be collected", () => {
  const { orders, stops } = twoDoors("accepted", "accepted");
  const r = route(orders, stops, { session });
  const deliveryA = r.stops.find(
    (s) => s.kind === "delivery" && s.parcels[0].id === "a",
  );
  assert.equal(deliveryA.open.length, 0);
  assert.deepEqual(
    deliveryA.awaitingPickup.map((p) => p.id),
    ["a"],
  );
  assert.equal(deliveryA.notLoaded.length, 0, "not 'missing from the truck'");
  assert.equal(deliveryA.state, "PENDING");
});

test("a completed route has no pending pickups", () => {
  const orders = [door("a", "delivered"), door("b", "delivered")];
  const stops = [
    planStop("a", "pickup", 1, "completed"),
    planStop("a", "delivery", 2, "completed"),
    planStop("b", "pickup", 3, "completed"),
    planStop("b", "delivery", 4, "completed"),
  ];
  const closed = [
    {
      id: 1,
      order_id: "a",
      status: "delivered",
      note: null,
      created_at: "2026-10-21T02:00:00Z",
    },
    {
      id: 2,
      order_id: "b",
      status: "delivered",
      note: null,
      created_at: "2026-10-21T03:00:00Z",
    },
  ];
  const r = route(orders, stops, { session, events: closed });
  assert.equal(r.state, "COMPLETED");
  assert.equal(r.delivered, 2);
});

test("door parcels at the same address share one pickup stop with its own key", () => {
  const same = {
    pickup_address: "Same shop",
    pickup_latitude: 16.8,
    pickup_longitude: 96.1,
  };
  const orders = [door("a", "accepted", same), door("b", "accepted", same)];
  const stops = [
    planStop("a", "pickup", 1),
    planStop("b", "pickup", 2),
    planStop("a", "delivery", 3),
    planStop("b", "delivery", 4),
  ];
  const r = route(orders, stops, { session });
  const pickups = r.stops.filter((s) => s.kind === "pickup");
  assert.equal(pickups.length, 1);
  assert.deepEqual(
    pickups[0].collect.map((p) => p.id),
    ["a", "b"],
  );
  assert.equal(pickups[0].key, "pickup:a");
  assert.ok(r.stops.every((s) => s.kind === "pickup" || s.key !== "pickup:a"));
});

test("a failed pickup is reported on its stop, never delivered, never handed back", () => {
  const orders = [door("a", "failed"), door("b", "accepted")];
  const stops = [
    planStop("a", "pickup", 1, "failed"),
    planStop("a", "delivery", 2, "skipped"),
    planStop("b", "pickup", 3),
    planStop("b", "delivery", 4),
  ];
  const events = [
    {
      id: 1,
      order_id: "a",
      status: "failed",
      note: null,
      created_at: "2026-10-21T02:00:00Z",
    },
  ];
  const r = route(orders, stops, { session, events });
  const pickupA = r.stops.find((s) => s.key === "pickup:a");
  assert.equal(pickupA.state, "FAILED");
  assert.equal(
    r.stops.some(
      (s) => s.kind === "delivery" && s.parcels.some((p) => p.id === "a"),
    ),
    false,
  );
  assert.deepEqual(r.returns, [], "it never reached the truck");
  assert.equal(r.failed, 1);
  assert.equal(r.current.key, "pickup:b");
});

test("deferring a pickup also defers its delivery, after the other stops", () => {
  const orders = [door("a", "accepted"), door("b", "accepted")];
  const stops = [
    planStop("a", "pickup", 1),
    planStop("a", "delivery", 2),
    planStop("b", "pickup", 3),
    planStop("b", "delivery", 4),
  ];
  const r = route(orders, stops, { session, deferred: ["pickup:a"] });
  assert.deepEqual(kinds(r), [
    "pickup:b",
    "delivery:b",
    "pickup:a",
    "delivery:a",
  ]);
  assert.equal(r.current.key, "pickup:b");
});

test("legacy single-order routes are unchanged: their pickup rows are not door pickups", () => {
  // ensure_delivery_route makes a pickup and a delivery stop for every order.
  const orders = [door("a", "accepted"), door("b", "accepted")];
  const stops = ["a", "b"].flatMap((id) => [
    {
      id: `${id}-p`,
      route_id: `r-${id}`,
      order_id: id,
      stop_type: "pickup",
      sequence_number: 1,
      status: "pending",
    },
    {
      id: `${id}-d`,
      route_id: `r-${id}`,
      order_id: id,
      stop_type: "delivery",
      sequence_number: 2,
      status: "pending",
    },
  ]);
  const r = route(orders, stops);
  assert.ok(r.stops.every((s) => s.kind === "delivery" && !s.planned));
  assert.equal(r.toCollect.length, 0);
  assert.equal(r.state, "MANIFEST_VERIFICATION");
  assert.equal(r.toLoad.length, 2);
});

test("a skipped plan stop (order reassigned elsewhere) is not a door pickup", () => {
  const orders = [door("a", "accepted")];
  const stops = [
    planStop("a", "pickup", 1, "skipped"),
    planStop("a", "delivery", 2, "skipped"),
  ];
  const r = route(orders, stops);
  assert.equal(r.toCollect.length, 0);
  assert.equal(r.toLoad.length, 1);
});

test("completing a pickup does not look like the dispatcher changed the route", () => {
  const { orders, stops } = twoDoors("accepted", "accepted");
  const before = route(orders, stops, { session });
  const snapshot = snapshotRoute(before);
  const afterOrders = [door("a", "in_transit"), orders[1]];
  const afterStops = stops.map((s) =>
    s.id === "a-pickup" ? { ...s, status: "completed" } : s,
  );
  const after = route(afterOrders, afterStops, { session });
  assert.equal(diffRoute(snapshot, after, before.current.key), null);
});

test("a parcel waiting to be collected has its own state", () => {
  assert.equal(parcelState(door("a", "accepted"), true), "TO_COLLECT");
  assert.equal(parcelState(door("a", "accepted")), "ASSIGNED");
  assert.equal(parcelState(door("a", "picked_up"), false), "LOADED");
});

test("closing a parcel yourself is not a dispatcher change, but losing one from the list is", () => {
  const open = [door("a", "in_transit"), door("b", "in_transit")];
  const before = route(open, [], { session });
  const snapshot = snapshotRoute(before);
  const delivered = route([door("a", "delivered"), open[1]], [], {
    session,
    events: [
      {
        id: 1,
        order_id: "a",
        status: "delivered",
        note: null,
        created_at: "2026-10-21T03:00:00Z",
      },
    ],
  });
  assert.equal(diffRoute(snapshot, delivered, before.current.key), null);
  const reassigned = route([open[1]], [], { session });
  assert.deepEqual(
    diffRoute(snapshot, reassigned, before.current.key).removedParcels,
    ["a"],
  );
});
