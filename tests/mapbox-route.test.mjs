import assert from "node:assert/strict";
import test from "node:test";
import {
  destinationKeyFor,
  evaluateRouteTraffic,
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

test("parseRoadRoute gathers speed limits across all legs in a multi-leg route", () => {
  const route = parseRoadRoute({
    routes: [
      {
        distance: 2500,
        duration: 300,
        geometry: {
          coordinates: [
            [96.15, 16.8],
            [96.151, 16.8],
            [96.152, 16.8],
            [96.153, 16.8],
          ],
        },
        legs: [
          {
            annotation: {
              maxspeed: [{ speed: 30, unit: "km/h" }],
            },
          },
          {
            annotation: {
              maxspeed: [{ speed: 45, unit: "km/h" }, { speed: 50, unit: "km/h" }],
            },
          },
        ],
      },
    ],
  });
  assert.ok(route);
  assert.deepEqual(route.speedLimitsKmh, [30, 45, 50]);
});

test("parseRoadRoute selects Sain Yadanar Road bypass to avoid junction bottleneck", () => {
  // Route 0: straight through Kaung Kyite traffic light junction (16.956317, 96.080967)
  const routeThroughJunction = {
    distance: 960,
    duration: 218,
    geometry: {
      coordinates: [
        [96.0762, 16.9569], // Zeta
        [96.0785, 16.9565], // Myoe Ma Aung
        [96.08096, 16.95632], // Kaung Kyite junction
        [96.082, 16.959], // Mother's Taste
      ],
    },
    legs: [
      {
        steps: [
          {
            distance: 500,
            maneuver: { instruction: "Drive east on Bogyoke AungSan Road" },
          },
          {
            distance: 460,
            maneuver: { instruction: "Turn left onto Ngway Street" },
          },
        ],
      },
    ],
  };

  // Route 1: turns onto Sain Yadanar Road, skipping the junction entirely
  const routeViaSainYadanarBypass = {
    distance: 876,
    duration: 201,
    geometry: {
      coordinates: [
        [96.0762, 16.9569], // Zeta
        [96.0768, 16.9586], // Bayintnaung Rd
        [96.0821, 16.9582], // Sain Yadanar Rd
        [96.082, 16.959], // Mother's Taste
      ],
    },
    legs: [
      {
        steps: [
          {
            distance: 200,
            maneuver: { instruction: "Drive north on Bayintnaung Road" },
          },
          {
            distance: 500,
            name: "Sain Yadanar Rd",
            maneuver: { instruction: "Turn right onto Sain Yadanar Road" },
          },
          {
            distance: 176,
            maneuver: { instruction: "Turn left onto Thiri Mingalar Pat Road" },
          },
        ],
      },
    ],
  };

  const chosenRoute = parseRoadRoute({
    routes: [routeThroughJunction, routeViaSainYadanarBypass],
  });

  assert.ok(chosenRoute != null);
  // Must choose the bypass route (Route 1)
  assert.equal(chosenRoute.distanceKm, 0.876);
  assert.equal(chosenRoute.durationMin, 201 / 60);
  assert.ok(chosenRoute.bypassInfo != null);
  assert.equal(chosenRoute.bypassInfo.bypassRoad, "Sain Yadanar Rd");
  assert.ok(chosenRoute.bypassInfo.timeSavedMin > 0);
});

test("evaluateRouteTraffic layers traffic lights and road reports onto route duration", () => {
  const coordsOnJunction = [
    [96.0762, 16.9569],
    [96.08096, 16.95632], // near Kamayut Traffic Light #8
    [96.082, 16.959],
  ];

  const roadReports = [
    {
      id: "rr-1",
      category: "congestion",
      severity: "high",
      status: "verified",
      latitude: 16.95632,
      longitude: 96.08096,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const delays = evaluateRouteTraffic(coordsOnJunction, { roadReports });
  assert.ok(delays.signalDelayMin > 0, "Should detect traffic light delay");
  assert.ok(
    delays.reportDelayMin >= 4.0,
    "Should detect high congestion report delay",
  );
  assert.ok(delays.totalDelayMin >= 4.5);
  assert.ok(delays.junctionsEncountered.length > 0);
});
