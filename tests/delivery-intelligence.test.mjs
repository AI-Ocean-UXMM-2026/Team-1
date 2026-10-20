import assert from "node:assert/strict";
import test from "node:test";
import {
  haversineKilometers,
  recommendAssignments,
} from "../src/lib/delivery/intelligence.ts";

const targetOrder = {
  id: "target",
  status: "pending",
  driver_id: null,
  vehicle_id: null,
  pickup_latitude: 16.8,
  pickup_longitude: 96.15,
  parcel_weight_kg: 4,
  latest_location: null,
};

test("haversine distance is zero for the same point and plausible across Yangon", () => {
  assert.equal(
    haversineKilometers(
      { latitude: 16.8, longitude: 96.15 },
      { latitude: 16.8, longitude: 96.15 },
    ),
    0,
  );
  const distance = haversineKilometers(
    { latitude: 16.7797, longitude: 96.1434 },
    { latitude: 16.8178, longitude: 96.1566 },
  );
  assert.ok(distance > 4 && distance < 5);
});

test("recommendations favor an available nearby rider with a suitable vehicle", () => {
  const drivers = [
    { id: "near", full_name: "Near Rider", availability: "available" },
    { id: "busy", full_name: "Busy Rider", availability: "busy" },
  ];
  const vehicles = [
    {
      id: "bike",
      registration_number: "BIKE-1",
      vehicle_type: "motorcycle",
      status: "available",
      capacity_kg: 8,
    },
    {
      id: "car",
      registration_number: "CAR-1",
      vehicle_type: "car",
      status: "in_use",
      capacity_kg: 50,
    },
  ];
  const activeOrders = [
    targetOrder,
    {
      id: "near-location",
      status: "delivered",
      driver_id: "near",
      vehicle_id: null,
      latest_location: {
        latitude: 16.801,
        longitude: 96.151,
        recorded_at: "2026-10-20T10:00:00Z",
      },
    },
    {
      id: "busy-delivery",
      status: "in_transit",
      driver_id: "busy",
      vehicle_id: "car",
      latest_location: {
        latitude: 16.9,
        longitude: 96.25,
        recorded_at: "2026-10-20T10:00:00Z",
      },
    },
  ];

  const recommendations = recommendAssignments(
    targetOrder,
    drivers,
    vehicles,
    activeOrders,
  );
  assert.equal(recommendations[0].driverId, "near");
  assert.equal(recommendations[0].vehicleId, "bike");
  assert.ok(recommendations[0].reasons.includes("No active deliveries"));
  assert.ok(recommendations[0].score > recommendations[1].score);
});

test("recommendations exclude vehicles that cannot carry the parcel", () => {
  const recommendations = recommendAssignments(
    { ...targetOrder, parcel_weight_kg: 30 },
    [{ id: "rider", full_name: "Rider", availability: "available" }],
    [
      {
        id: "bike",
        registration_number: "BIKE-1",
        vehicle_type: "motorcycle",
        status: "available",
        capacity_kg: 10,
      },
    ],
    [targetOrder],
  );
  assert.deepEqual(recommendations, []);
});
