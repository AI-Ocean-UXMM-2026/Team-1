import test from "node:test";
import assert from "node:assert/strict";

import { applyTraffic } from "../src/lib/delivery/dispatch/traffic.ts";
import { buildStraightLineMatrix } from "../src/lib/delivery/dispatch/matrix.ts";
import { planDispatch } from "../src/lib/delivery/dispatch/plan.ts";
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

test("applyTraffic factors in live road reports (congestion, roadworks, closures)", () => {
  const points = [
    { lat: 16.8288, lng: 96.129 }, // Kamayut
    { lat: 16.8055, lng: 96.136 }, // Sanchaung
    { lat: 16.7788, lng: 96.1585 }, // Kyauktada
  ];
  const params = { speedKmh: 30, roadFactor: 1.25 };
  const baseMatrix = buildStraightLineMatrix(points, params);

  // Road report: heavy congestion on Pyay Road between Kamayut and Sanchaung
  const congestionReport = {
    lat: 16.817,
    lng: 16.817 ? 96.132 : 96.132,
    category: "congestion",
    severity: "high",
  };

  // Road report: road closure near downtown
  const closureReport = {
    lat: 16.78,
    lng: 96.158,
    category: "closure",
    severity: "blocked",
  };

  const { matrix, summary } = applyTraffic(baseMatrix, points, {
    reports: [congestionReport, closureReport],
  });

  assert.ok(summary.reportsCovered >= 2, "Both road reports should be matched to nearby arcs");
  assert.ok(summary.blockedArcs > 0, "Closure report should mark affected arc(s) as blocked");
  assert.ok(matrix.blocked != null, "Matrix should carry blocked array");

  // Check arc from Kamayut (0) to Sanchaung (1) has high congestion delay
  const arc01 = 0 * 3 + 1;
  const arcWithoutReports = applyTraffic(baseMatrix, points).matrix.time[arc01];
  assert.ok(
    matrix.time[arc01] > arcWithoutReports,
    `Congestion should add travel time beyond base signals (with reports: ${matrix.time[arc01]}, signals only: ${arcWithoutReports})`,
  );
});

test("applyTraffic layers order-level traffic delays onto delivery destinations", () => {
  const points = [
    { lat: 16.86, lng: 96.12 }, // Depot
    { lat: 16.8288, lng: 96.129 }, // Node 1: Delivery A
    { lat: 16.8055, lng: 96.136 }, // Node 2: Delivery B
  ];
  const params = { speedKmh: 30, roadFactor: 1.25 };
  const baseMatrix = buildStraightLineMatrix(points, params);

  const orders = [
    {
      id: "ord-heavy-traffic",
      delivery_latitude: 16.8055,
      delivery_longitude: 96.136,
      traffic_delay_minutes: 15,
    },
  ];

  const { matrix, summary } = applyTraffic(baseMatrix, points, { orders });

  assert.equal(summary.ordersWithTrafficDelay, 1, "Should count 1 order with traffic delay");

  // Arcs arriving at Node 2 (index 2) should carry the 15 min traffic delay
  const arc02 = 0 * 3 + 2; // Depot -> Node 2
  const arc12 = 1 * 3 + 2; // Node 1 -> Node 2
  const base02 = applyTraffic(baseMatrix, points).matrix.time[arc02];
  const base12 = applyTraffic(baseMatrix, points).matrix.time[arc12];

  assert.equal(
    Math.round(matrix.time[arc02] - base02),
    15,
    "Incoming arc from depot to delivery stop should receive order traffic delay",
  );
  assert.equal(
    Math.round(matrix.time[arc12] - base12),
    15,
    "Incoming arc from node 1 to delivery stop should receive order traffic delay",
  );
});

test("planDispatch incorporates traffic road reports and order traffic delays", async () => {
  const depot = {
    id: "d0000000-0000-4000-8000-000000000001",
    code: "YGN-MAIN",
    latitude: 16.86,
    longitude: 96.12,
    location_status: "verified",
    is_active: true,
  };

  const orders = [
    {
      id: "ord-1",
      status: "pending",
      pickup_address: "Kamayut",
      pickup_latitude: 16.8288,
      pickup_longitude: 96.129,
      delivery_address: "Sanchaung",
      delivery_latitude: 16.8055,
      delivery_longitude: 96.136,
      parcel_weight_kg: 5,
      cod_amount: 0,
      traffic_delay_minutes: 8,
      updated_at: new Date().toISOString(),
      logistics: null,
    },
    {
      id: "ord-2",
      status: "pending",
      pickup_address: "Bahan",
      pickup_latitude: 16.81,
      pickup_longitude: 96.155,
      delivery_address: "Downtown",
      delivery_latitude: 16.7788,
      delivery_longitude: 96.1585,
      parcel_weight_kg: 3,
      cod_amount: 0,
      traffic_delay_minutes: 0,
      updated_at: new Date().toISOString(),
      logistics: null,
    },
  ];

  const trucks = [
    {
      id: "truck-1",
      registration_number: "YGN-9001",
      vehicle_type: "truck",
      status: "available",
      capacity_kg: 1000,
      energy_source: "fuel",
      fuel_level_percent: 90,
      battery_level_percent: null,
      range_km_at_full: 300,
      reserve_percent: 10,
      profile: {
        depot_id: depot.id,
        default_driver_id: null,
        capacity_m3: 6,
        cost_per_km_mmk: 1200,
        fixed_cost_mmk: 0,
        cost_source: "assumed",
      },
    },
  ];

  const trafficReport = {
    lat: 16.817,
    lng: 96.132,
    category: "congestion",
    severity: "medium",
  };

  const deps = {
    nowMs: () => Date.now(),
    buildMatrix: async (points, params) => ({
      matrix: buildStraightLineMatrix(points, params),
      stats: null,
    }),
  };

  const result = await planDispatch(
    {
      depot,
      serviceDate: "2026-10-22",
      now: new Date(),
      orders,
      trucks,
      params: { maxIterations: 100 },
      field: null,
      reports: [trafficReport],
    },
    deps,
  );

  assert.equal(result.ok, true);
  assert.ok(result.quality.traffic != null, "Quality should include traffic summary");
  assert.ok(result.quality.traffic.signalsCovered > 0, "Should detect signals along routes");
  assert.ok(result.quality.traffic.reportsCovered >= 1, "Should count matched traffic report");
  assert.equal(result.quality.traffic.ordersWithTrafficDelay, 1, "Should count order with traffic delay");
  assert.ok(result.quality.traffic.addedDelayMin > 0, "Added delay should be greater than zero");
  assert.ok(
    result.warnings.some((w) => w.startsWith("traffic_reports:")),
    "Should include traffic_reports warning",
  );
  assert.ok(
    result.warnings.some((w) => w.startsWith("order_traffic_delays:")),
    "Should include order_traffic_delays warning",
  );
});



test("applyTraffic prices a report by the engine's decision, not its raw category", () => {
  // Two points in open country, away from any mapped signal
  const points = [
    { lat: 17.2, lng: 96.3 },
    { lat: 17.2, lng: 96.31 },
  ];
  const base = buildStraightLineMatrix(points, { speedKmh: 30, roadFactor: 1.25 });
  const at = { lat: 17.2, lng: 96.305 };
  const run = (report) => applyTraffic(base, points, { reports: [report] });

  const raw = run({ ...at, category: "closure", severity: "blocked" });
  assert.equal(raw.summary.blockedArcs, 2);

  const delayed = run({
    ...at,
    category: "closure",
    severity: "blocked",
    decision: { action: "delay", severity: "high", delayMinutes: 6, radiusMeters: 120 },
  });
  assert.equal(delayed.summary.blockedArcs, 0);
  assert.equal(delayed.summary.addedDelayMin, 12);

  const avoid = run({
    ...at,
    category: "closure",
    severity: "blocked",
    decision: { action: "avoid", severity: "blocked", delayMinutes: 30, radiusMeters: 120 },
  });
  assert.equal(avoid.summary.blockedArcs, 2);

  const monitored = run({
    ...at,
    category: "congestion",
    severity: "high",
    decision: { action: "monitor", severity: "low", delayMinutes: 0, radiusMeters: 120 },
  });
  assert.equal(monitored.summary.addedDelayMin, 0);
});
