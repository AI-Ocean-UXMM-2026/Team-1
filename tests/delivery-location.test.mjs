import assert from "node:assert/strict";
import test from "node:test";
import {
  canShowParcelLocation,
  parcelLocationState,
} from "../src/lib/delivery/location-state.ts";
import { watchRiderLocations } from "../src/lib/delivery/rider-location.ts";

const timestamp = Date.parse("2026-10-20T12:00:00Z");
const point = {
  coords: { latitude: 16.8, longitude: 96.15, accuracy: 8 },
};

function fakeGps() {
  let success;
  let error;
  const cleared = [];
  return {
    cleared,
    geolocation: {
      watchPosition(onSuccess, onError) {
        success = onSuccess;
        error = onError;
        return 42;
      },
      clearWatch(id) {
        cleared.push(id);
      },
    },
    emit: () => success(point),
    fail: () => error({ code: 1, PERMISSION_DENIED: 1 }),
  };
}

test("location display honors pickup, freshness, and delivery closure", () => {
  const latest_location = { recorded_at: new Date(timestamp).toISOString() };
  for (const status of ["pending", "assigned", "accepted"]) {
    assert.equal(canShowParcelLocation(status), false);
    assert.equal(
      parcelLocationState({ status, latest_location }, timestamp),
      "waiting",
    );
  }
  assert.equal(
    parcelLocationState({ status: "picked_up", latest_location }, timestamp),
    "live",
  );
  assert.equal(
    parcelLocationState(
      { status: "in_transit", latest_location },
      timestamp + 61_000,
    ),
    "stale",
  );
  assert.equal(
    parcelLocationState(
      { status: "in_transit", latest_location: null },
      timestamp,
    ),
    "waiting",
  );
  for (const status of ["delivered", "failed", "cancelled"]) {
    assert.equal(
      parcelLocationState({ status, latest_location }, timestamp),
      "closed",
    );
  }
});

test("one GPS sample reaches every parcel on board and duplicate IDs are removed", async () => {
  const gps = fakeGps();
  const sent = [];
  const updates = [];
  const stop = watchRiderLocations({
    geolocation: gps.geolocation,
    orderIds: ["parcel-a", "parcel-b", "parcel-a"],
    now: () => timestamp,
    send: async (id) => {
      sent.push(id);
    },
    onSent: (ids) => updates.push(ids),
    onError: assert.fail,
  });
  await gps.emit();
  assert.deepEqual(sent, ["parcel-a", "parcel-b"]);
  assert.deepEqual(updates, [["parcel-a", "parcel-b"]]);
  stop();
  assert.deepEqual(gps.cleared, [42]);
});

test("logout/unmount cleanup ignores late writes, queued GPS, and permission errors", async () => {
  const gps = fakeGps();
  let finish;
  let sends = 0;
  let notifications = 0;
  const stop = watchRiderLocations({
    geolocation: gps.geolocation,
    orderIds: ["parcel-a"],
    now: () => timestamp,
    send: () => {
      sends += 1;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    onSent: () => {
      notifications += 1;
    },
    onError: () => {
      notifications += 1;
    },
  });
  const pending = gps.emit();
  stop();
  finish();
  await pending;
  await gps.emit();
  gps.fail();
  assert.equal(sends, 1);
  assert.equal(notifications, 0);
});

test("a closed parcel is removed while other collected parcels keep sharing", async () => {
  const gps = fakeGps();
  const sent = [];
  const options = {
    geolocation: gps.geolocation,
    now: () => timestamp,
    send: async (id) => {
      sent.push(id);
    },
    onSent: () => {},
    onError: assert.fail,
  };
  const stopFirst = watchRiderLocations({
    ...options,
    orderIds: ["parcel-a", "parcel-b"],
  });
  await gps.emit();
  stopFirst();
  const stopSecond = watchRiderLocations({
    ...options,
    orderIds: ["parcel-b"],
  });
  await gps.emit();
  stopSecond();
  assert.deepEqual(sent, ["parcel-a", "parcel-b", "parcel-b"]);
});

test("no parcels means no GPS watch or device permission request", () => {
  watchRiderLocations({
    geolocation: { watchPosition: assert.fail, clearWatch: assert.fail },
    orderIds: [],
    send: assert.fail,
    onSent: assert.fail,
    onError: assert.fail,
  })();
});

test("a failed parcel write does not hide successful updates for other parcels", async () => {
  const gps = fakeGps();
  const updates = [];
  const errors = [];
  const stop = watchRiderLocations({
    geolocation: gps.geolocation,
    orderIds: ["parcel-a", "parcel-b"],
    now: () => timestamp,
    send: async (id) => {
      if (id === "parcel-a") throw new Error("Assignment changed");
    },
    onSent: (ids) => updates.push(ids),
    onError: (message) => errors.push(message),
  });
  await gps.emit();
  stop();
  assert.deepEqual(updates, [["parcel-b"]]);
  assert.deepEqual(errors, ["Assignment changed"]);
});
