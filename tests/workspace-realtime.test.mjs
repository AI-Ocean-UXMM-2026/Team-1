import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeLocation,
  mergeStatusEvent,
  subscribeWorkspaceRealtime,
} from "../src/lib/delivery/workspace-realtime.ts";

const initialData = () => ({
  orders: [
    { id: "waiting", status: "pending", latest_location: null },
    { id: "moving", status: "in_transit", latest_location: null },
  ],
  statusEvents: [],
  customers: [],
  drivers: [],
  vehicles: [],
});

function harness(role, data = initialData()) {
  const handlers = new Map();
  let refreshed = 0;
  let removed = false;
  let connection;
  const channel = {
    on(_type, config, callback) {
      handlers.set(config.table, { config, callback });
      return channel;
    },
    subscribe(callback) {
      connection = callback;
      return channel;
    },
  };
  const stop = subscribeWorkspaceRealtime(
    {
      channel: () => channel,
      removeChannel: async () => {
        removed = true;
      },
    },
    {
      userId: "account",
      role,
      updateData: (updater) => {
        data = updater(data);
      },
      refresh: () => {
        refreshed += 1;
      },
    },
  );
  return {
    handlers,
    stop,
    data: () => data,
    refreshed: () => refreshed,
    removed: () => removed,
    connection: (status) => connection(status),
    emit: (table, eventType, row) =>
      handlers.get(table).callback({ eventType, new: row }),
  };
}

test("customer waiting before assignment receives status, pickup, location and timeline without reloading", () => {
  const app = harness("customer");
  assert.equal(app.handlers.get("delivery_orders").config.event, "*");
  assert.equal(
    app.handlers.get("delivery_orders").config.filter,
    "customer_id=eq.account",
  );
  app.emit("delivery_orders", "UPDATE", {
    id: "waiting",
    status: "picked_up",
    cod_status: "pending",
    estimated_delivery_at: null,
  });
  app.emit("delivery_locations", "INSERT", {
    order_id: "waiting",
    latitude: 16.8,
    longitude: 96.15,
    recorded_at: "2026-10-20T10:00:00Z",
  });
  app.emit("delivery_status_events", "INSERT", {
    id: 1,
    order_id: "waiting",
    status: "picked_up",
    created_at: "2026-10-20T10:00:00Z",
  });
  assert.equal(app.data().orders[0].status, "picked_up");
  assert.equal(app.data().orders[0].latest_location.latitude, 16.8);
  assert.equal(app.data().statusEvents[0].status, "picked_up");
  assert.equal(app.refreshed(), 1);
});

test("empty rider workspace refreshes for a new assignment and reconnect", () => {
  const app = harness("driver", { ...initialData(), orders: [] });
  assert.equal(
    app.handlers.get("delivery_assignments").config.filter,
    "driver_id=eq.account",
  );
  app.emit("delivery_assignments", "INSERT", {
    driver_id: "account",
    order_id: "new",
  });
  app.connection("SUBSCRIBED");
  assert.equal(app.refreshed(), 2);
});

test("manager receives independent parcel positions and ignores older GPS arrivals", () => {
  const data = initialData();
  const fresh = {
    order_id: "moving",
    latitude: 16.8,
    longitude: 96.2,
    recorded_at: "2026-10-20T10:01:00Z",
  };
  const updated = mergeLocation(data, fresh);
  const result = mergeLocation(updated, {
    ...fresh,
    latitude: 0,
    recorded_at: "2026-10-20T10:00:00Z",
  });
  assert.equal(result.orders[1].latest_location.latitude, 16.8);
  assert.equal(result.orders[0].latest_location, null);
});

test("replayed status events remain unique and chronological", () => {
  const event = {
    id: 2,
    order_id: "moving",
    status: "in_transit",
    created_at: "2026-10-20T10:01:00Z",
  };
  let data = mergeStatusEvent(initialData(), event);
  data = mergeStatusEvent(data, event);
  data = mergeStatusEvent(data, {
    ...event,
    id: 1,
    status: "picked_up",
    created_at: "2026-10-20T10:00:00Z",
  });
  assert.deepEqual(
    data.statusEvents.map((item) => item.id),
    [1, 2],
  );
});

test("cleanup rejects queued data and refresh callbacks from the previous account", () => {
  const app = harness("customer");
  app.stop();
  app.emit("delivery_orders", "UPDATE", { id: "waiting", status: "picked_up" });
  app.emit("delivery_assignments", "INSERT", {});
  app.connection("SUBSCRIBED");
  assert.equal(app.data().orders[0].status, "pending");
  assert.equal(app.refreshed(), 0);
  assert.equal(app.removed(), true);
});
