import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateRadiusPixels,
  checkRouteFloodExposure,
  generateCirclePolygon,
  getYangonFloodZones,
  haversineDistanceKm,
  pointInPolygon,
  YANGON_FLOOD_ZONES,
} from "../src/lib/delivery/flood-zones.ts";

test("getYangonFloodZones returns default curated zones when custom is empty", () => {
  const zones = getYangonFloodZones(null);
  assert.equal(zones.length, YANGON_FLOOD_ZONES.length);
  assert.ok(zones.some((z) => z.id === "flood-zone-thingangyun"));
  assert.ok(zones.some((z) => z.id === "flood-zone-hlaing-bayintnaung"));
});

test("getYangonFloodZones parses custom GeoJson polygons", () => {
  const customGeoJson = {
    features: [
      {
        properties: { name: "Test Insein Canal", hazard_class: 3 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [96.1, 16.9],
              [96.12, 16.9],
              [96.12, 16.92],
              [96.1, 16.92],
              [96.1, 16.9],
            ],
          ],
        },
      },
    ],
  };

  const zones = getYangonFloodZones(customGeoJson);
  assert.equal(zones.length, 1);
  assert.equal(zones[0].name, "Test Insein Canal");
  assert.equal(zones[0].hazardClass, 3);
  assert.equal(zones[0].severity, "severe");
});

test("pointInPolygon accurately identifies points inside and outside polygon ring", () => {
  const ring = [
    [96.1, 16.8],
    [96.2, 16.8],
    [96.2, 16.9],
    [96.1, 16.9],
    [96.1, 16.8],
  ];

  // Inside
  assert.ok(pointInPolygon(16.85, 96.15, ring));
  // Outside North
  assert.ok(!pointInPolygon(16.95, 96.15, ring));
  // Outside South
  assert.ok(!pointInPolygon(16.75, 96.15, ring));
  // Outside West
  assert.ok(!pointInPolygon(16.85, 96.05, ring));
  // Outside East
  assert.ok(!pointInPolygon(16.85, 96.25, ring));
});

test("haversineDistanceKm computes accurate distance across Yangon", () => {
  const p1 = { latitude: 16.8007, longitude: 96.15 };
  const p2 = { latitude: 16.8107, longitude: 96.15 };
  const dist = haversineDistanceKm(p1, p2);
  // ~1.11 km for 0.01 deg latitude
  assert.ok(dist > 1.0 && dist < 1.2);
});

test("generateCirclePolygon returns closed polygon ring", () => {
  const center = { latitude: 16.8, longitude: 96.15 };
  const ring = generateCirclePolygon(center, 0.4, 16);
  assert.equal(ring.length, 17);
  // Closed loop: first and last coordinates match
  assert.deepEqual(ring[0], ring[ring.length - 1]);
});

test("calculateRadiusPixels computes expected pixel radius", () => {
  const px15 = calculateRadiusPixels(400, 16.8, 15);
  const px14 = calculateRadiusPixels(400, 16.8, 14);
  assert.ok(px15 > px14);
  assert.ok(px15 > 50 && px15 < 150);
});

test("checkRouteFloodExposure detects route passing through flood zones and reports", () => {
  const thingangyunZone = YANGON_FLOOD_ZONES.find(
    (z) => z.id === "flood-zone-thingangyun",
  );
  assert.ok(thingangyunZone);

  // Route cutting through Thingangyun Canal Corridor
  const route = [
    [96.17, 16.81],
    [96.195, 16.815], // Inside zone
    [96.21, 16.83],
  ];

  const reports = [
    {
      id: "flood-rep-1",
      category: "flooding",
      severity: "high",
      status: "verified",
      description: "Water on road",
      latitude: 16.815,
      longitude: 96.195,
      reported_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    },
  ];

  const exposure = checkRouteFloodExposure(route, YANGON_FLOOD_ZONES, reports);
  assert.ok(exposure.hasFloodRisk);
  assert.ok(exposure.intersectedZones.length >= 1);
  assert.ok(
    exposure.intersectedZones.some((z) => z.id === "flood-zone-thingangyun"),
  );
  assert.equal(exposure.nearbyFloodReports.length, 1);
  assert.ok(exposure.suggestedSlowdownPercent >= 35);
  assert.ok(exposure.warningMessage?.includes("Thingangyun Canal Corridor"));
});

test("checkRouteFloodExposure returns clean status when route is outside flood zones", () => {
  // Clear route far from flood zones
  const clearRoute = [
    [96.15, 16.86],
    [96.15, 16.87],
  ];

  const exposure = checkRouteFloodExposure(clearRoute, YANGON_FLOOD_ZONES, []);
  assert.equal(exposure.hasFloodRisk, false);
  assert.equal(exposure.intersectedZones.length, 0);
  assert.equal(exposure.nearbyFloodReports.length, 0);
  assert.equal(exposure.suggestedSlowdownPercent, 0);
  assert.equal(exposure.warningMessage, null);
});
