import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateCod,
  buildDriverRoute,
  diffRoute,
  EMPTY_HANDOVER,
  handoverRequirements,
  parcelState,
  snapshotRoute,
} from "../src/lib/delivery/driver-route.ts";

const now = Date.parse("2026-10-21T06:00:00Z");

let serial = 0;
function parcel(id, status, extra = {}) {
  serial += 1;
  return {
    id,
    tracking_code: `OE-${id}`,
    status,
    driver_id: "driver",
    customer_name: `Customer ${id}`,
    recipient_name: `Recipient ${id}`,
    recipient_phone: `+95 9 000 ${id}`,
    created_at: `2026-10-21T01:${String(serial % 60).padStart(2, "0")}:00Z`,
    pickup_address: "Depot",
    delivery_address: `Address ${id}`,
    delivery_latitude: 16.8 + serial * 0.01,
    delivery_longitude: 96.15,
    cod_amount: 0,
    cod_status: "not_required",
    estimated_delivery_at: null,
    ...extra,
  };
}

function route(orders, extra = {}) {
  return buildDriverRoute({
    orders,
    events: [],
    routeStops: [],
    driverId: "driver",
    now,
    session: null,
    arrived: [],
    handover: null,
    deferred: [],
    ...extra,
  });
}

const sameRecipient = (id, status, extra = {}) =>
  parcel(id, status, {
    recipient_name: "Daw Hla",
    recipient_phone: "+95 9 111 222",
    delivery_address: "No. 12, Bogyoke Road",
    delivery_latitude: 16.9,
    delivery_longitude: 96.2,
    ...extra,
  });

test("no assigned parcels is an empty route", () => {
  assert.equal(route([]).state, "NONE");
  assert.equal(route([parcel("x", "assigned", { driver_id: "other" })]).state, "NONE");
});

test("20 parcels across 12 stops: parcels and stops are counted separately", () => {
  const orders = [];
  for (let stop = 0; stop < 12; stop += 1) {
    const count = stop < 4 ? 3 : 1; // 4×3 + 8×1 = 20
    for (let index = 0; index < count; index += 1)
      orders.push(
        parcel(`s${stop}p${index}`, "in_transit", {
          recipient_phone: `+95 9 ${stop}`,
          delivery_latitude: 16.8 + stop * 0.02,
          delivery_longitude: 96.15,
        }),
      );
  }
  const result = route(orders);
  assert.equal(result.parcels.length, 20);
  assert.equal(result.stops.length, 12);
  assert.equal(result.state, "IN_PROGRESS");
  assert.equal(result.current.number, 1);
  assert.equal(result.current.parcels.length, 3);
});

test("several parcels for one recipient form one stop and stay individual", () => {
  const result = route([
    sameRecipient("a", "in_transit"),
    sameRecipient("b", "in_transit"),
    sameRecipient("c", "in_transit", { cod_amount: 15000, cod_status: "pending" }),
    parcel("d", "in_transit"),
  ]);
  assert.equal(result.stops.length, 2);
  assert.equal(result.current.open.length, 3);
  assert.equal(result.current.codDue, 15000);
  assert.equal(result.codToCollect, 15000);
});

test("route state follows acknowledgement, loading, start, pause and close", () => {
  assert.equal(route([parcel("a", "assigned")]).state, "ASSIGNED");
  assert.equal(route([parcel("a", "accepted")]).state, "MANIFEST_VERIFICATION");
  assert.equal(route([parcel("a", "picked_up")]).state, "READY");
  assert.equal(route([parcel("a", "in_transit")]).state, "IN_PROGRESS");
  const paused = route([parcel("a", "in_transit")], {
    session: { status: "paused", started_at: "", paused_at: "", closed_at: null, cod_declared: null },
  });
  assert.equal(paused.state, "PAUSED");
  assert.ok(paused.current, "a paused route still knows its current stop");
  const done = [parcel("a", "delivered")];
  const events = [{ id: 1, order_id: "a", status: "delivered", note: null, created_at: "2026-10-21T05:00:00Z" }];
  assert.equal(route(done, { events }).state, "COMPLETED");
  assert.equal(
    route(done, {
      events,
      session: { status: "closed", started_at: "", paused_at: null, closed_at: "", cod_declared: 0 },
    }).state,
    "CLOSED",
  );
});

test("only one stage is active at the current stop", () => {
  const orders = [parcel("a", "in_transit"), parcel("b", "in_transit")];
  const navigating = route(orders);
  assert.equal(navigating.current.state, "NAVIGATING");
  const key = navigating.current.key;
  assert.equal(route(orders, { arrived: [key] }).current.state, "ARRIVED");
  assert.equal(
    route(orders, { arrived: [key], handover: key }).current.state,
    "HANDOVER_IN_PROGRESS",
  );
  assert.equal(route(orders, { arrived: [key] }).upcoming[0].state, "PENDING");
});

test("completing a stop advances to the next unfinished stop", () => {
  const events = [{ id: 1, order_id: "a", status: "delivered", note: null, created_at: "2026-10-21T05:00:00Z" }];
  const result = route([parcel("a", "delivered"), parcel("b", "in_transit")], { events });
  assert.equal(result.stops[0].state, "COMPLETED");
  assert.equal(result.current.parcels[0].id, "b");
  assert.equal(result.current.number, 2);
});

test("trying a stop later moves it behind the others without writing a failure", () => {
  const orders = [parcel("a", "in_transit"), parcel("b", "in_transit")];
  const first = route(orders).current.key;
  const result = route(orders, { deferred: [first] });
  assert.notEqual(result.current.key, first);
  assert.equal(result.stops.at(-1).key, first);
  assert.equal(result.stops.at(-1).parcels[0].status, "in_transit");
});

test("a dispatcher-added stop is reported as a revision, current stop unchanged", () => {
  const orders = [parcel("a", "in_transit"), parcel("b", "in_transit")];
  const before = route(orders);
  const snapshot = snapshotRoute(before);
  const after = route([...orders, parcel("c", "assigned")]);
  assert.equal(after.state, "IN_PROGRESS");
  assert.equal(after.current.key, before.current.key);
  const revision = diffRoute(snapshot, after, before.current.key);
  assert.equal(revision.addedParcels.length, 1);
  assert.equal(revision.needsAcknowledgement, true);
  assert.equal(revision.currentChanged, false);
  assert.equal(after.stops.at(-1).notLoaded.length, 1);
});

test("a dispatcher reorder is reported without touching parcel state", () => {
  const a = parcel("a", "in_transit");
  const b = parcel("b", "in_transit");
  const stops = (first, second) => [
    { order_id: first, stop_type: "delivery", sequence_number: 1 },
    { order_id: second, stop_type: "delivery", sequence_number: 2 },
  ];
  const before = route([a, b], { routeStops: stops("a", "b") });
  const after = route([a, b], { routeStops: stops("b", "a") });
  const revision = diffRoute(snapshotRoute(before), after, before.current.key);
  assert.equal(revision.reordered, true);
  assert.equal(revision.currentChanged, true);
  assert.equal(revision.needsAcknowledgement, false);
  assert.equal(diffRoute(snapshotRoute(after), after, after.current.key), null);
});

test("handover cannot complete without parcel check, recipient and COD", () => {
  const stop = route([
    sameRecipient("a", "in_transit", { cod_amount: 20000, cod_status: "pending" }),
    sameRecipient("b", "in_transit"),
  ]).current;
  const unmet = (draft) =>
    handoverRequirements(stop, draft).filter((item) => !item.met).map((item) => item.key);
  assert.deepEqual(unmet(EMPTY_HANDOVER), ["parcels", "recipient", "cod"]);
  assert.deepEqual(unmet({ ...EMPTY_HANDOVER, verified: ["a"], receivedBy: "Daw Hla", codMode: "full" }), ["parcels"]);
  assert.deepEqual(
    unmet({ ...EMPTY_HANDOVER, verified: ["a", "b"], receivedBy: "Daw Hla", codMode: "different", codAmount: "15000" }),
    ["cod"],
    "a different amount needs a reason",
  );
  assert.deepEqual(
    unmet({ ...EMPTY_HANDOVER, verified: ["a", "b"], receivedBy: "Daw Hla", codMode: "different", codAmount: "15000", codReason: "Paid rest by KPay" }),
    [],
  );
});

test("cash received at a stop is split across its COD parcels in order", () => {
  const parcels = [
    parcel("a", "in_transit", { cod_amount: 10000, cod_status: "pending" }),
    parcel("b", "in_transit"),
    parcel("c", "in_transit", { cod_amount: 5000, cod_status: "pending" }),
  ];
  assert.deepEqual([...allocateCod(parcels, 15000)], [["a", 10000], ["c", 5000]]);
  assert.deepEqual([...allocateCod(parcels, 12000)], [["a", 10000], ["c", 2000]]);
  assert.deepEqual([...allocateCod(parcels, 8000)], [["a", 8000], ["c", 0]]);
});

test("failed parcels are returns, and parcel states map from order status", () => {
  const events = [{ id: 1, order_id: "a", status: "failed", note: null, created_at: "2026-10-21T05:00:00Z" }];
  const result = route([parcel("a", "failed")], { events });
  assert.equal(result.returns.length, 1);
  assert.equal(result.stops[0].state, "FAILED");
  assert.equal(parcelState(parcel("x", "accepted")), "ASSIGNED");
  assert.equal(parcelState(parcel("x", "picked_up")), "LOADED");
  assert.equal(parcelState(parcel("x", "in_transit")), "OUT_FOR_DELIVERY");
  assert.equal(parcelState(parcel("x", "failed")), "RETURN_PENDING");
});
