import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFlood,
  FloodField,
  legExposure,
} from "../src/lib/delivery/dispatch/flood.ts";
import { haversineKm } from "../src/lib/delivery/dispatch/matrix.ts";
import { DEFAULT_PARAMS } from "../src/lib/delivery/dispatch/params.ts";
import {
  buildRoadMatrix,
  hilbertOrder,
  planTiles,
} from "../src/lib/delivery/dispatch/road-matrix.ts";

const grid = (n, step = 0.01) =>
  Array.from({ length: n }, (_, i) => ({
    lat: 16.9 + (i % 10) * step,
    lng: 96.1 + Math.floor(i / 10) * step,
  }));

// A fake Matrix API: car-like speed over 1.4x straight-line roads.
function fakeFetch(options = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (options.status)
      return { ok: false, status: options.status, json: async () => ({}) };
    const coords = decodeURIComponent(url.split("/driving/")[1].split("?")[0])
      .split(";")
      .map((c) => c.split(",").map(Number));
    const pts = coords.map(([lng, lat]) => ({ lat, lng }));
    const nulls = options.nullPair;
    const durations = pts.map((a, i) =>
      pts.map((b, j) =>
        nulls && i === nulls[0] && j === nulls[1]
          ? null
          : ((haversineKm(a, b) * 1.4) / 30) * 3600,
      ),
    );
    const distances = pts.map((a) =>
      pts.map((b) => haversineKm(a, b) * 1.4 * 1000),
    );
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: "Ok", durations, distances }),
    };
  };
  fn.calls = calls;
  return fn;
}
const sleep = async () => {};

test("hilbert order is a permutation", () => {
  const order = hilbertOrder(grid(40));
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    grid(40).map((_, i) => i),
  );
});

test("tile planning respects the request and element budgets", () => {
  const points = grid(121);
  const full = planTiles(points, { maxRequests: 1000, maxElements: 1e9 });
  assert.equal(full.tiles.length, 55); // k = 11 blocks -> 11*10/2
  assert.ok(full.tiles.every((t) => t.nodes.length <= 24));
  const capped = planTiles(points, { maxRequests: 12, maxElements: 1e9 });
  assert.equal(capped.tiles.length, 12);
  const small = planTiles(points, { maxRequests: 1000, maxElements: 2000 });
  assert.ok(small.tiles.length * 576 <= 2000 + 576);
  // nearest tiles come first
  assert.ok(capped.tiles[0].gap <= capped.tiles[11].gap);
});

test("a full fetch yields the road_matrix tier and every pair is real", async () => {
  const points = grid(30);
  const fetchFn = fakeFetch();
  const { matrix, stats } = await buildRoadMatrix(points, DEFAULT_PARAMS, {
    fetch: fetchFn,
    token: "t",
    sleep,
  });
  assert.equal(matrix.source, "road_matrix");
  assert.equal(stats.coverage, 1);
  assert.ok(
    fetchFn.calls.every((u) =>
      u.includes("directions-matrix/v1/mapbox/driving/"),
    ),
  );
  assert.ok(stats.elementsBilled <= stats.requests * 576);
  // durations carry the truck and traffic factors
  const expected =
    ((haversineKm(points[0], points[1]) * 1.4) / 30) *
    60 *
    DEFAULT_PARAMS.truckTimeFactor *
    DEFAULT_PARAMS.trafficMultiplier;
  assert.ok(Math.abs(matrix.time[1] - expected) < 1e-6);
});

test("a request budget leaves gaps that are estimated and labelled calibrated", async () => {
  const points = grid(61);
  const { matrix, stats } = await buildRoadMatrix(
    points,
    { ...DEFAULT_PARAMS, maxMatrixRequests: 3 },
    { fetch: fakeFetch(), token: "t", sleep },
  );
  assert.equal(matrix.source, "road_calibrated");
  assert.ok(stats.coverage > 0 && stats.coverage < 1);
  // estimated cells are positive and finite
  for (let i = 0; i < matrix.n; i++)
    for (let j = 0; j < matrix.n; j++)
      if (i !== j)
        assert.ok(
          Number.isFinite(matrix.time[i * matrix.n + j]) &&
            matrix.time[i * matrix.n + j] > 0,
        );
});

test("a null element is estimated and downgrades the tier", async () => {
  const { matrix } = await buildRoadMatrix(grid(10), DEFAULT_PARAMS, {
    fetch: fakeFetch({ nullPair: [1, 2] }),
    token: "t",
    sleep,
  });
  assert.equal(matrix.source, "road_calibrated");
});

test("no token, or a failing API, falls back to the straight-line tier", async () => {
  const none = await buildRoadMatrix(grid(10), DEFAULT_PARAMS, null);
  assert.equal(none.matrix.source, "straight_line");
  const down = await buildRoadMatrix(grid(30), DEFAULT_PARAMS, {
    fetch: fakeFetch({ status: 503 }),
    token: "t",
    sleep,
  });
  assert.equal(down.matrix.source, "straight_line");
  assert.ok(down.stats.failedRequests > 0);
  const limited = await buildRoadMatrix(grid(10), DEFAULT_PARAMS, {
    fetch: fakeFetch({ status: 429 }),
    token: "t",
    sleep,
  });
  assert.equal(limited.matrix.source, "straight_line");
});

const square = (lat, lng, d, hazard) => ({
  properties: { hazard_class: hazard },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  },
});

test("flood field: inside, outside and holes", () => {
  const field = new FloodField({
    features: [
      {
        properties: { hazard_class: 3 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [96.0, 16.0],
              [96.2, 16.0],
              [96.2, 16.2],
              [96.0, 16.2],
              [96.0, 16.0],
            ],
            [
              [96.09, 16.09],
              [96.11, 16.09],
              [96.11, 16.11],
              [96.09, 16.11],
              [96.09, 16.09],
            ],
          ],
        },
      },
    ],
  });
  assert.equal(field.weightAt(16.05, 96.05), 1);
  assert.equal(field.weightAt(16.1, 96.1), 0); // in the hole
  assert.equal(field.weightAt(17, 97), 0);
});

test("leg exposure scales with the share of the chord inside hazard", () => {
  const field = new FloodField({ features: [square(16.9, 96.15, 0.01, 2)] });
  const through = legExposure(
    { lat: 16.9, lng: 96.1 },
    { lat: 16.9, lng: 96.2 },
    field,
    [],
  );
  const around = legExposure(
    { lat: 16.95, lng: 96.1 },
    { lat: 16.95, lng: 96.2 },
    field,
    [],
  );
  assert.ok(through.fraction > 0 && through.fraction < 0.6);
  assert.equal(around.fraction, 0);
  assert.equal(through.blocked, false);
});

test("only a verified blocked report forbids an arc; the static layer never does", () => {
  const field = new FloodField({ features: [square(16.9, 96.15, 0.05, 3)] });
  const a = { lat: 16.9, lng: 96.1 };
  const b = { lat: 16.9, lng: 96.2 };
  assert.equal(legExposure(a, b, field, []).blocked, false);
  assert.equal(
    legExposure(a, b, null, [{ lat: 16.9, lng: 96.15, severity: "high" }])
      .blocked,
    false,
  );
  assert.equal(
    legExposure(a, b, null, [{ lat: 16.9, lng: 96.15, severity: "blocked" }])
      .blocked,
    true,
  );
});

test("applyFlood reports an unknown status instead of 'no risk' when nothing is loaded", async () => {
  const points = grid(6);
  const { matrix } = await buildRoadMatrix(points, DEFAULT_PARAMS, null);
  const none = applyFlood(matrix, points, null, []);
  assert.equal(none.summary.status, "unknown");
  assert.equal(none.matrix.floodFrac, null);
  const reportsOnly = applyFlood(matrix, points, null, [
    { lat: 16.9, lng: 96.1, severity: "blocked" },
  ]);
  assert.equal(reportsOnly.summary.status, "reports_only");
  assert.ok(reportsOnly.summary.blockedArcs > 0);
  const layered = applyFlood(
    matrix,
    points,
    new FloodField({ features: [square(16.925, 96.1, 0.03, 3)] }),
    [],
  );
  assert.equal(layered.summary.status, "layer");
  assert.ok(layered.summary.exposedArcs > 0);
  // symmetric
  assert.equal(
    layered.matrix.floodFrac[1 * 6 + 3],
    layered.matrix.floodFrac[3 * 6 + 1],
  );
});
