import assert from "node:assert/strict";
import test from "node:test";
import { fromTrackingPayload } from "../src/lib/delivery/public-tracking.ts";

const payload = {
  id: "o1",
  tracking_code: "abc123",
  status: "in_transit",
  pickup_address: "Shop",
  delivery_address: "Home",
  pickup_latitude: null,
  pickup_longitude: null,
  delivery_latitude: 16.8,
  delivery_longitude: 96.1,
  cod_amount: "15000.00",
  cod_status: "pending",
  estimated_delivery_at: "2026-10-21T05:00:00Z",
  route_progress_percent: 40,
  traffic_delay_minutes: 5,
  eta_confidence: "medium",
  eta_updated_at: "2026-10-21T04:30:00Z",
  created_at: "2026-10-21T02:00:00Z",
  has_driver: true,
  driver_first_name: "Aung",
  vehicle_type: "e_bike",
  latest_location: null,
  events: [{ id: 7, status: "picked_up", created_at: "2026-10-21T03:00:00Z" }],
};

test("fromTrackingPayload maps the public lookup without private fields", () => {
  const result = fromTrackingPayload(payload);
  assert.ok(result);
  assert.equal(result.order.cod_amount, 15000);
  assert.equal(result.order.driver_name, "Aung");
  assert.equal(result.order.vehicle_label, "E-bike");
  assert.equal(result.order.driver_phone, null);
  assert.equal(result.order.recipient_phone, null);
  assert.deepEqual(result.events[0], {
    id: 7,
    order_id: "o1",
    status: "picked_up",
    note: null,
    created_at: "2026-10-21T03:00:00Z",
  });
});

test("fromTrackingPayload returns null for a missing parcel", () => {
  assert.equal(fromTrackingPayload(null), null);
  assert.equal(fromTrackingPayload({}), null);
});
