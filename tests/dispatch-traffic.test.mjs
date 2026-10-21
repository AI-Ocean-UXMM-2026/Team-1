import test from "node:test";
import assert from "node:assert/strict";

import { applyTraffic } from "../src/lib/delivery/dispatch/traffic.ts";
import { buildStraightLineMatrix } from "../src/lib/delivery/dispatch/matrix.ts";
import { recommendAssignments } from "../src/lib/delivery/intelligence.ts";
import { buildDriverRoute } from "../src/lib/delivery/driver-route.ts";

test("applyTraffic layers signal and user interception delays onto travel-time matrix", () => {
  // Test points along known mapped Yangon corridors:
  // Node 0: Hledan / Kamayut area (16.8288, 96.1290)
  // Node 1: Sanchaung / Myaynigone area (16.8055, 96.1360)
  // Node 2: Kyauktada Downtown (16.7788, 96.1585)
  const points = [
    { lat: 16.8288, lng: 96.129 },
    { lat: 16.8055, lng: 96.136 },
    { lat: 16.7788, lng: 96.1585 },
  ];

  const params = { speedKmh: 30, roadFactor: 1.25 };
  const baseMatrix = buildStraightLineMatrix(points, params);

  const { matrix: trafficMatrix, summary } = applyTraffic(baseMatrix, points);

  assert.equal(trafficMatrix.n, 3);
  assert.ok(summary.signalsCovered > 0, "Should detect YTSC traffic signals along Pyay Rd / Downtown corridors");
  assert.ok(summary.interceptionsCovered > 0, "Should detect user-mapped interception points");
  assert.ok(summary.addedDelayMin > 0, "Traffic friction should add delay in minutes");
  assert.ok(summary.arcsWithDelay > 0, "Arcs crossing corridors should receive delay adjustments");

  // Verify that traffic matrix travel times are strictly greater than base straight line times for affected arcs
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === j) continue;
      const arc = i * 3 + j;
      assert.ok(
        trafficMatrix.time[arc] >= baseMatrix.time[arc],
        `Traffic travel time (${trafficMatrix.time[arc]}) should be >= base time (${baseMatrix.time[arc]})`,
      );
    }
  }
});

test("recommendAssignments factors in user-mapped interception waypoints", () => {
  const driver = {
    id: "driver-1",
    full_name: "Kyaw Zeya",
    phone: "0912345678",
    availability: "available",
  };

  const vehicle = {
    id: "v-1",
    registration_number: "YGN-1001",
    vehicle_type: "motorcycle",
    capacity_kg: 40,
    status: "available",
  };

  // Order with pickup in Kamayut (where interception midpoints exist)
  const order = {
    id: "order-1",
    status: "pending",
    pickup_latitude: 16.8288,
    pickup_longitude: 96.129,
    delivery_latitude: 16.8055,
    delivery_longitude: 96.136,
    parcel_weight_kg: 5,
  };

  // Driver located in Sanchaung (straight path across Kamayut/Pyay Road corridor)
  const pastOrders = [
    {
      id: "hist-1",
      driver_id: "driver-1",
      status: "in_transit",
      pickup_latitude: 16.805,
      pickup_longitude: 96.136,
      delivery_latitude: 16.805,
      delivery_longitude: 96.136,
      latest_location: {
        latitude: 16.805,
        longitude: 96.136,
        recorded_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    },
  ];

  const recs = recommendAssignments(order, [driver], [vehicle], pastOrders, 3, []);
  assert.equal(recs.length, 1);
  const rec = recs[0];
  assert.ok(rec.score > 0);
  assert.ok(
    rec.reasons.some((r) => r.includes("corridor") || r.includes("traffic") || r.includes("interception")),
    "Should explain corridor alignment and traffic friction in recommendation reasons",
  );
});

test("buildDriverRoute computes route-level traffic signal and interception counts", () => {
  const orders = [
    {
      id: "ord-1",
      driver_id: "driver-1",
      status: "picked_up",
      delivery_address: "Kamayut Station",
      delivery_latitude: 16.8288,
      delivery_longitude: 96.129,
      cod_amount: 0,
      cod_status: "pending",
      created_at: new Date().toISOString(),
    },
    {
      id: "ord-2",
      driver_id: "driver-1",
      status: "picked_up",
      delivery_address: "Myaynigone Plaza",
      delivery_latitude: 16.8055,
      delivery_longitude: 96.136,
      cod_amount: 0,
      cod_status: "pending",
      created_at: new Date().toISOString(),
    },
    {
      id: "ord-3",
      driver_id: "driver-1",
      status: "picked_up",
      delivery_address: "Sule Pagoda Rd",
      delivery_latitude: 16.7788,
      delivery_longitude: 96.1585,
      cod_amount: 0,
      cod_status: "pending",
      created_at: new Date().toISOString(),
    },
  ];

  const route = buildDriverRoute({
    orders,
    events: [],
    routeStops: [],
    driverId: "driver-1",
    now: Date.now(),
    session: null,
    arrived: [],
    handover: null,
    deferred: [],
  });

  assert.equal(route.stops.length, 3);
  assert.ok(route.signalsOnRoute != null && route.signalsOnRoute > 0, "Route should detect signals across stops");
  assert.ok(route.interceptionsOnRoute != null && route.interceptionsOnRoute > 0, "Route should detect interception midpoints");
});
