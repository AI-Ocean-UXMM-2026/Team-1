import assert from "node:assert/strict";
import test from "node:test";
import {
  destinationKeyFor,
  formatDriveMinutes,
  needsRouteRequest,
  parseRoadRoute,
  speedLimitAt,
  ROUTE_MAX_AGE_MS,
  ROUTE_MOVE_KM,
} from "../src/lib/delivery/mapbox.ts";

const yangon = { latitude: 16.8007, longitude: 96.15 };
const now = Date.parse("2026-10-21T06:00:00Z");

test("parseRoadRoute reads distance, duration, geometry and the first step", () => {
  const route = parseRoadRoute({
    routes: [
      {
        distance: 4200,
        duration: 780,
        geometry: {
          coordinates: [
            [96.15, 16.8],
            [96.16, 16.81],
          ],
        },
        legs: [
          {
            steps: [
              {
                distance: 120,
                maneuver: { instruction: "Head north on Pyay Road" },
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(route.distanceKm, 4.2);
  assert.equal(route.durationMin, 13);
  assert.equal(route.coordinates.length, 2);
  assert.deepEqual(route.firstStep, {
    instruction: "Head north on Pyay Road",
    distanceKm: 0.12,
  });
});

test("parseRoadRoute returns null when there is no usable road", () => {
  assert.equal(parseRoadRoute({ routes: [] }), null);
  assert.equal(
    parseRoadRoute({
      routes: [
        { distance: 0, duration: 0, geometry: { coordinates: [[96, 16]] } },
      ],
    }),
    null,
  );
});

test("parseRoadRoute leaves firstStep empty when Mapbox gives no instruction", () => {
  const route = parseRoadRoute({
    routes: [
      {
        distance: 1000,
        duration: 60,
        geometry: {
          coordinates: [
            [96.15, 16.8],
            [96.16, 16.81],
          ],
        },
        legs: [{ steps: [{ distance: 1000 }] }],
      },
    ],
  });
  assert.equal(route.firstStep, null);
});

test("needsRouteRequest requests on the first call and when the destinations change", () => {
  const destinationKey = destinationKeyFor([yangon]);
  assert.equal(needsRouteRequest(null, destinationKey, 0, now), true);
  const last = { destinationKey, at: now };
  assert.equal(
    needsRouteRequest(
      last,
      destinationKeyFor([{ latitude: 1, longitude: 2 }]),
      0,
      now,
    ),
    true,
  );
});

test("needsRouteRequest waits for real movement or age before re-requesting", () => {
  const destinationKey = destinationKeyFor([yangon]);
  const last = { destinationKey, at: now };
  // GPS jitter well under the move threshold (about 20 m) does not re-request.
  assert.equal(
    needsRouteRequest(last, destinationKey, 0.02, now + 5_000),
    false,
  );
  // Moving past the threshold (about 220 m) re-requests.
  assert.ok(ROUTE_MOVE_KM < 0.2);
  assert.equal(
    needsRouteRequest(last, destinationKey, 0.22, now + 5_000),
    true,
  );
  // Age alone re-requests even without movement.
  assert.equal(
    needsRouteRequest(last, destinationKey, 0, now + ROUTE_MAX_AGE_MS),
    true,
  );
});

test("formatDriveMinutes keeps short and long durations readable", () => {
  assert.equal(formatDriveMinutes(null), "—");
  assert.equal(formatDriveMinutes(0.2), "1 min");
  assert.equal(formatDriveMinutes(12.4), "12 min");
  assert.equal(formatDriveMinutes(60), "1 h");
  assert.equal(formatDriveMinutes(75), "1 h 15 min");
});

test("parseRoadRoute reads posted speed limits and speedLimitAt finds the nearest", () => {
  const route = parseRoadRoute({
    routes: [
      {
        distance: 900,
        duration: 120,
        geometry: {
          coordinates: [
            [96.15, 16.8],
            [96.151, 16.8],
            [96.152, 16.8],
          ],
        },
        legs: [
          {
            annotation: {
              maxspeed: [
                { speed: 40, unit: "km/h" },
                { speed: 30, unit: "mph" },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.deepEqual(route.speedLimitsKmh, [40, 48]);
  assert.equal(speedLimitAt(route, { latitude: 16.8, longitude: 96.1501 }), 40);
  assert.equal(speedLimitAt(route, { latitude: 16.8, longitude: 96.1509 }), 48);
});

test("speedLimitAt is null when Mapbox has no limit for the road", () => {
  const route = parseRoadRoute({
    routes: [
      {
        distance: 100,
        duration: 10,
        geometry: {
          coordinates: [
            [96.15, 16.8],
            [96.151, 16.8],
          ],
        },
        legs: [{ annotation: { maxspeed: [{ unknown: true }] } }],
      },
    ],
  });
  assert.deepEqual(route.speedLimitsKmh, [null]);
  assert.equal(speedLimitAt(route, yangon), null);
  assert.equal(
    speedLimitAt({ coordinates: [], speedLimitsKmh: [] }, yangon),
    null,
  );
});
