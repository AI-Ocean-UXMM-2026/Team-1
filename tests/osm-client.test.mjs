import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOverpassQuery,
  fetchOsmYangonData,
  parseOverpassJson,
  YANGON_METRO_BBOX,
} from "../src/lib/delivery/osm-client.ts";

test("buildOverpassQuery generates syntactically valid Overpass QL", () => {
  const query = buildOverpassQuery(YANGON_METRO_BBOX, 20);
  assert.ok(query.includes("[out:json][timeout:20]"));
  assert.ok(query.includes('node["amenity"="fuel"](16.7,96,17.05,96.3)'));
  assert.ok(query.includes('node["highway"="traffic_signals"]'));
});

test("parseOverpassJson extracts fuel stations and traffic signals correctly", () => {
  const sampleOverpassResponse = {
    elements: [
      {
        type: "node",
        id: 3372811490,
        lat: 16.8147723,
        lon: 96.1303348,
        tags: {
          amenity: "fuel",
          brand: "Max Energy",
          name: "Max Hanthawaddy",
          "fuel:octane_95": "yes",
          "fuel:diesel": "yes",
          "addr:street": "Pyay Road",
        },
      },
      {
        type: "node",
        id: 419800443,
        lat: 16.8172862,
        lon: 96.1260399,
        tags: {
          highway: "traffic_signals",
          name: "Hledan Crossing",
          "traffic_signals:direction": "both",
        },
      },
    ],
  };

  const result = parseOverpassJson(sampleOverpassResponse);
  assert.equal(result.fuelStations.length, 1);
  assert.equal(result.trafficSignals.length, 1);

  const station = result.fuelStations[0];
  assert.equal(station.id, "osm-3372811490");
  assert.equal(station.name, "Max Hanthawaddy");
  assert.equal(station.brand, "Max Energy");
  assert.equal(station.latitude, 16.8147723);
  assert.equal(station.longitude, 96.1303348);
  assert.equal(station.fuels?.diesel, true);
  assert.equal(station.fuels?.octane95, true);

  const signal = result.trafficSignals[0];
  assert.equal(signal.id, "osm-419800443");
  assert.equal(signal.name, "Hledan Crossing");
  assert.equal(signal.latitude, 16.8172862);
  assert.equal(signal.direction, "both");
});

test("fetchOsmYangonData falls back gracefully to curated dataset on offline or 502/504 errors", async () => {
  // Using an unroutable endpoint to test immediate fallback
  const result = await fetchOsmYangonData({
    endpoints: ["https://127.0.0.1:59999/fake-endpoint"],
    timeoutMs: 50,
  });

  assert.equal(result.fromCache, true);
  assert.equal(result.endpointUsed, null);
  assert.ok(result.fuelStations.length >= 10);
  assert.ok(result.trafficSignals.length >= 10);

  const brands = result.fuelStations.map((s) => s.brand);
  assert.ok(brands.includes("Denko"));
  assert.ok(brands.includes("Max Energy"));
  assert.ok(brands.includes("PT Power"));
});
