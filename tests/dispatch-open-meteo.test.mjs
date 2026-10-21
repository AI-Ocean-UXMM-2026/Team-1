import assert from "node:assert/strict";
import test from "node:test";

import { applyFlood } from "../src/lib/delivery/dispatch/flood.ts";
import {
  determineFloodSeverity,
  fetchLiveFloodConditions,
} from "../src/lib/delivery/dispatch/open-meteo.ts";
import { planDispatch } from "../src/lib/delivery/dispatch/plan.ts";

const DEPOT = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Central",
  code: "DEP-1",
  latitude: 16.8,
  longitude: 96.15,
  is_active: true,
  location_status: "verified",
};

const TRUCK = {
  id: "00000000-0000-0000-0000-000000000010",
  registration_number: "YGN-1",
  vehicle_type: "truck",
  energy_source: "diesel",
  capacity_kg: 1000,
  is_active: true,
  status: "available",
  profile: {
    capacity_m3: 6,
    fixed_cost_mmk: 10000,
    cost_per_km_mmk: 500,
    default_driver_id: null,
  },
};

const ORDER = {
  id: "00000000-0000-0000-0000-000000000100",
  tracking_number: "PKG-100",
  status: "pending",
  delivery_latitude: 16.85,
  delivery_longitude: 96.18,
  pickup_latitude: 16.8,
  pickup_longitude: 96.15,
  parcel_weight_kg: 5,
  logistics: {
    origin_kind: "depot",
    weight_kg: 5,
    volume_m3: 0.1,
    weight_source: "estimated",
    volume_source: "estimated",
    pickup_window_start: null,
    pickup_window_end: null,
    delivery_window_start: null,
    delivery_window_end: null,
  },
};

const dummyBuildMatrix = async (points) => {
  const n = points.length;
  return {
    matrix: {
      n,
      km: new Float64Array(n * n).fill(5),
      time: new Float64Array(n * n).fill(15),
      source: "straight_line",
      floodFrac: null,
      blocked: null,
    },
    stats: null,
  };
};

test("determineFloodSeverity categorizes rain and discharge correctly", () => {
  const clear = determineFloodSeverity(0, null);
  assert.equal(clear.severity, "clear");
  assert.equal(clear.suggestedSlowdown, 0);

  const light = determineFloodSeverity(3.2, 5);
  assert.equal(light.severity, "light_rain");
  assert.equal(light.suggestedSlowdown, 0.15);

  const heavy = determineFloodSeverity(14.5, 12);
  assert.equal(heavy.severity, "heavy_rain");
  assert.equal(heavy.suggestedSlowdown, 0.35);

  const floodRiskByRain = determineFloodSeverity(26, 10);
  assert.equal(floodRiskByRain.severity, "flood_risk");
  assert.equal(floodRiskByRain.suggestedSlowdown, 0.6);

  const floodRiskByDischarge = determineFloodSeverity(5, 65);
  assert.equal(floodRiskByDischarge.severity, "flood_risk");
  assert.equal(floodRiskByDischarge.suggestedSlowdown, 0.6);
});

test("fetchLiveFloodConditions parses valid Open-Meteo responses with custom fetch", async () => {
  const mockFetch = async (url) => {
    if (url.includes("/forecast")) {
      return {
        ok: true,
        json: async () => ({
          current: {
            precipitation: 12.4,
            rain: 12.0,
            weather_code: 63,
          },
        }),
      };
    }
    if (url.includes("/flood")) {
      return {
        ok: true,
        json: async () => ({
          daily: {
            river_discharge: [18.5, 17.2],
          },
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  const result = await fetchLiveFloodConditions(
    { lat: 16.8661, lng: 96.1951 },
    { fetch: mockFetch },
  );

  assert.ok(result);
  assert.equal(result.source, "open_meteo");
  assert.equal(result.precipitationMm, 12.4);
  assert.equal(result.rainMm, 12.0);
  assert.equal(result.weatherCode, 63);
  assert.equal(result.riverDischargeM3s, 18.5);
  assert.equal(result.severity, "heavy_rain");
  assert.equal(result.suggestedSlowdown, 0.35);
});

test("fetchLiveFloodConditions handles network errors gracefully without throwing", async () => {
  const failingFetch = async () => {
    throw new Error("Network offline");
  };

  const result = await fetchLiveFloodConditions(
    { lat: 16.8661, lng: 96.1951 },
    { fetch: failingFetch },
  );

  assert.equal(result, null);
});

test("applyFlood records live flood conditions in summary", () => {
  const dummyMatrix = {
    n: 2,
    km: new Float64Array(4).fill(2),
    time: new Float64Array(4).fill(5),
    source: "straight_line",
    floodFrac: null,
    blocked: null,
  };
  const points = [
    { lat: 16.8, lng: 96.1 },
    { lat: 16.85, lng: 96.15 },
  ];

  const live = {
    source: "open_meteo",
    fetchedAt: "2026-10-22T01:00:00Z",
    latitude: 16.8,
    longitude: 96.1,
    precipitationMm: 15,
    rainMm: 15,
    weatherCode: 65,
    riverDischargeM3s: 22,
    severity: "heavy_rain",
    suggestedSlowdown: 0.35,
  };

  const unknownWithLive = applyFlood(dummyMatrix, points, null, [], live);
  assert.equal(unknownWithLive.summary.status, "unknown");
  assert.deepEqual(unknownWithLive.summary.live, live);
});

test("planDispatch uses live flood conditions to adjust slowdown and generate warning", async () => {
  const live = {
    source: "open_meteo",
    fetchedAt: "2026-10-22T01:00:00Z",
    latitude: 16.8,
    longitude: 96.15,
    precipitationMm: 18.5,
    rainMm: 18.5,
    weatherCode: 65,
    riverDischargeM3s: 30,
    severity: "heavy_rain",
    suggestedSlowdown: 0.35,
  };

  const res = await planDispatch(
    {
      depot: DEPOT,
      serviceDate: "2026-10-22",
      now: new Date("2026-10-22T08:00:00+06:30"),
      orders: [ORDER],
      trucks: [TRUCK],
      field: null,
      reports: [],
      liveFlood: live,
    },
    {
      buildMatrix: dummyBuildMatrix,
      nowMs: () => Date.now(),
    },
  );

  assert.ok(res.ok);
  assert.deepEqual(res.quality.flood.live, live);
  assert.ok(res.warnings.some((w) => w.startsWith("live_flood_alert")));
});
