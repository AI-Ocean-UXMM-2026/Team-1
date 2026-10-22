import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_YANGON_FUEL_STATIONS,
  assessEnergyRoute,
  countInterceptionPointsBetween,
  countTrafficSignalsBetween,
  detectSignalBypasses,
  distanceToSegmentKm,
  findNearestFuelStation,
  findOptimalFuelStation,
  YANGON_FUEL_STATIONS,
  YANGON_TRAFFIC_SIGNALS,
  YANGON_USER_INTERCEPTION_POINTS,
} from "../src/lib/delivery/energy-routing.ts";

test("yangon fuel stations dataset contains verified major retail brands across Yangon corridors", () => {
  assert.ok(YANGON_FUEL_STATIONS.length >= 10);
  const brands = new Set(YANGON_FUEL_STATIONS.map((s) => s.brand));
  assert.ok(brands.has("Denko"));
  assert.ok(brands.has("Max Energy"));
  assert.ok(brands.has("PT Power"));
  assert.ok(brands.has("BOC"));

  for (const station of YANGON_FUEL_STATIONS) {
    assert.ok(station.latitude > 16.7 && station.latitude < 17.0);
    assert.ok(station.longitude > 96.0 && station.longitude < 96.3);
    assert.ok(station.name.length > 0);
    assert.ok(station.township.length > 0);
  }
});

test("yangon traffic signals dataset contains critical arterial junctions", () => {
  assert.ok(YANGON_TRAFFIC_SIGNALS.length >= 10);
  const names = YANGON_TRAFFIC_SIGNALS.map((s) => s.name);
  assert.ok(names.some((n) => n.includes("Hledan")));
  assert.ok(names.some((n) => n.includes("Myaynigone")));
  assert.ok(names.some((n) => n.includes("8 Mile")));
  assert.ok(names.some((n) => n.includes("Hanthawaddy")));

  for (const signal of YANGON_TRAFFIC_SIGNALS) {
    assert.ok(signal.latitude > 16.7 && signal.latitude < 17.0);
    assert.ok(signal.longitude > 96.0 && signal.longitude < 96.3);
    assert.ok(signal.estimatedCycleSeconds > 0);
  }
});

test("distanceToSegmentKm computes perpendicular distance accurately", () => {
  const a = { latitude: 16.8, longitude: 96.13 };
  const b = { latitude: 16.84, longitude: 96.13 };
  // Point directly on the segment
  const mid = { latitude: 16.82, longitude: 96.13 };
  assert.ok(distanceToSegmentKm(mid, a, b) < 0.001);

  // Point offset slightly eastward (~1 km)
  const offset = { latitude: 16.82, longitude: 96.14 };
  const dist = distanceToSegmentKm(offset, a, b);
  assert.ok(dist > 0.8 && dist < 1.3);
});

test("countTrafficSignalsBetween identifies signalized junctions along Pyay Road corridor", () => {
  // Pyay Road corridor from Sanchaung (south) to Kamayut (north)
  const south = { latitude: 16.8, longitude: 96.136 }; // near Dagon Centre / Myaynigone
  const north = { latitude: 16.835, longitude: 96.128 }; // past Hledan Junction

  const result = countTrafficSignalsBetween(south, north, 0.6);
  assert.ok(result.count >= 2);
  const signalNames = result.signals.map((s) => s.name);
  assert.ok(
    signalNames.some(
      (n) =>
        n.includes("Myaynigone") ||
        n.includes("Hledan") ||
        n.includes("Hanthawaddy"),
    ),
  );
});

test("findOptimalFuelStation finds the station with minimum detour along the route", () => {
  // Kamayut to Sanchaung along Pyay Road
  const origin = { latitude: 16.82, longitude: 96.132 };
  const destination = { latitude: 16.805, longitude: 96.136 };

  const station = findOptimalFuelStation(origin, destination);
  assert.ok(station != null);
  // Max Energy Hanthawaddy or BOC Kamayut is right on this corridor
  assert.ok(station.detourKm < 1.5);
  assert.ok(station.name.length > 0);
  assert.ok(
    ["Denko", "Max Energy", "PT Power", "BOC", "Apex"].includes(station.brand),
  );
});

test("assessEnergyRoute accounts for fuel consumption, signals, and recommends fuel stations", () => {
  const vehicle = {
    id: "truck-1",
    registration_number: "YGN-9901",
    vehicle_type: "truck",
    energy_source: "fuel",
    fuel_level_percent: 15,
    battery_level_percent: null,
    range_km_at_full: 250,
    reserve_percent: 10,
    odometer_km: 15000,
    service_due_at_km: 20000,
    status: "available",
    capacity_kg: 1000,
  };

  const order = {
    pickup_latitude: 16.8288, // Hledan
    pickup_longitude: 96.129,
    delivery_latitude: 16.8055, // Myaynigone
    delivery_longitude: 96.136,
    latest_location: null,
    parcel_weight_kg: 200, // 200 kg heavy parcel
  };

  const assessment = assessEnergyRoute(order, vehicle);
  assert.ok(assessment.distanceKm != null && assessment.distanceKm > 2);
  assert.ok(
    assessment.signalsOnRoute != null && assessment.signalsOnRoute >= 1,
  );
  assert.ok(
    assessment.idlingPenaltyLitres != null &&
      assessment.idlingPenaltyLitres > 0,
  );
  assert.ok(
    assessment.fuelLitresEstimated != null &&
      assessment.fuelLitresEstimated > 0,
  );
  assert.equal(assessment.payloadWeightKg, 200);

  // Since usable fuel range is 250 * (15 - 10)% = 12.5 km, and route is ~3.5 km + signal drain,
  // remaining range is ~8 km, which triggers "low" or "insufficient"
  assert.ok(assessment.status === "low" || assessment.status === "sufficient");
  if (assessment.status === "low") {
    assert.ok(assessment.recommendedFuelStation != null);
    assert.ok(assessment.message.includes("fuel"));
    assert.ok(assessment.message.includes("Recommended fuel station:"));
  }
});

test("assessEnergyRoute advises nearest station immediately when fuel is insufficient", () => {
  const dryVehicle = {
    id: "truck-2",
    registration_number: "YGN-8802",
    vehicle_type: "truck",
    energy_source: "fuel",
    fuel_level_percent: 10, // exactly at reserve limit
    battery_level_percent: null,
    range_km_at_full: 200,
    reserve_percent: 10,
    odometer_km: 10000,
    service_due_at_km: null,
    status: "available",
    capacity_kg: 500,
  };

  const order = {
    pickup_latitude: 16.85,
    pickup_longitude: 96.12,
    delivery_latitude: 16.78,
    delivery_longitude: 96.16,
    latest_location: null,
    parcel_weight_kg: 50,
  };

  const assessment = assessEnergyRoute(order, dryVehicle);
  assert.equal(assessment.status, "insufficient");
  assert.ok(
    assessment.message.startsWith("Add fuel before starting this route."),
  );
  assert.ok(assessment.recommendedFuelStation != null);
  assert.ok(assessment.message.includes("Nearest fuel station:"));
});

test("detectSignalBypasses finds small rotation bypasses for long cycle junctions", () => {
  const hledan = YANGON_TRAFFIC_SIGNALS.find((s) => s.name.includes("Hledan"));
  assert.ok(hledan != null);
  const bypasses = detectSignalBypasses([hledan]);
  assert.equal(bypasses.length, 1);
  assert.ok(bypasses[0].netTimeSavedMin > 0);
  assert.ok(bypasses[0].fuelSavedLitres > 0);
  assert.ok(bypasses[0].recommendedRotation.includes("Hledan"));
});

test("detectSignalBypasses finds Sain Yadanar Road bypass for Bogyoke AungSan junction", () => {
  const junction = YANGON_USER_INTERCEPTION_POINTS.find(
    (p) => p.id === "pt_1792606477515_s3c7",
  );
  assert.ok(junction != null);
  const bypasses = detectSignalBypasses([junction]);
  assert.equal(bypasses.length, 1);
  assert.equal(bypasses[0].bypassRoadName, "Sain Yadanar Rd");
  assert.ok(bypasses[0].bypassPoint != null);
  assert.ok(bypasses[0].recommendedRotation.includes("Sain Yadanar Rd"));
  assert.ok(bypasses[0].netTimeSavedMin > 0);
});

test("user-mapped interception points dataset loads 89 points with valid Yangon coordinates", () => {
  assert.equal(YANGON_USER_INTERCEPTION_POINTS.length, 89);
  for (const pt of YANGON_USER_INTERCEPTION_POINTS) {
    assert.ok(pt.latitude > 16.7 && pt.latitude < 17.1);
    assert.ok(pt.longitude > 96.0 && pt.longitude < 96.3);
    assert.ok(pt.estimatedCycleSeconds > 0);
    assert.ok(pt.township.length > 0);
    assert.equal(pt.type, "traffic_light");
    assert.ok(pt.name.includes("Traffic Light"));
  }
});

test("countInterceptionPointsBetween detects intermediate points along Kyauktada downtown corridor", () => {
  // Downtown corridor in Kyauktada
  const p1 = { latitude: 16.782, longitude: 96.143 };
  const p2 = { latitude: 16.772, longitude: 96.165 };
  const result = countInterceptionPointsBetween(p1, p2, 0.5);
  assert.ok(result.count >= 5);
  assert.ok(result.points.some((p) => p.township === "Kyauktada"));
});

test("findNearestFuelStation locates the closest station from Google Places dataset", () => {
  assert.ok(
    ALL_YANGON_FUEL_STATIONS.length >= 60,
    "Should include Google Places crawled stations",
  );

  // Near Bahan / Sayar San Road
  const bahanDriver = { latitude: 16.822, longitude: 96.161 };
  const nearest = findNearestFuelStation(bahanDriver);

  assert.ok(nearest != null);
  assert.ok(
    nearest.distanceKm < 0.8,
    "Should find station within 800m of Bahan Sayar San",
  );
  assert.ok(
    nearest.name.includes("Max Energy") || nearest.name.includes("Petro K"),
  );
  assert.ok(nearest.road.length > 0);
});

test("fuel stations can be queried directly for urgent detour and queued route pitstops", () => {
  // Driver at Kamayut needing urgent fuel
  const driverPos = { latitude: 16.8288, longitude: 96.129 };
  const urgentStation = findNearestFuelStation(driverPos);
  assert.ok(urgentStation != null);
  assert.ok(urgentStation.distanceKm < 2.0);
  assert.ok(urgentStation.name.length > 0);

  // Delivery stop at Tamwe
  const deliveryStop = { latitude: 16.81, longitude: 96.17 };
  const nextStop = { latitude: 16.83, longitude: 96.18 };
  const optimalStation = findOptimalFuelStation(deliveryStop, nextStop);
  assert.ok(optimalStation != null);
  assert.ok(optimalStation.detourKm >= 0);
  assert.ok(optimalStation.name.length > 0);
});
