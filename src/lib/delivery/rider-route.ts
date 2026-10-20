import type {
  DeliveryOrder,
  DeliveryStatus,
  StatusEvent,
} from "@/lib/delivery/types";

export type GeoPoint = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;
const CLOSED: DeliveryStatus[] = ["delivered", "failed", "cancelled"];
const ACTIVE_RANK: Partial<Record<DeliveryStatus, number>> = {
  in_transit: 0,
  picked_up: 1,
  accepted: 2,
  assigned: 3,
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(from: GeoPoint, to: GeoPoint) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial compass bearing in degrees, 0 = north, clockwise. */
export function bearingDegrees(from: GeoPoint, to: GeoPoint) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

export function compassDirection(bearing: number) {
  return COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

export function formatDistance(km: number | null) {
  if (km == null || !Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function isClosed(status: DeliveryStatus) {
  return CLOSED.includes(status);
}

export function hasParcelOnBoard(status: DeliveryStatus) {
  return status === "picked_up" || status === "in_transit";
}

export type StopLeg = {
  kind: "pickup" | "dropoff";
  address: string;
  point: GeoPoint | null;
};

/** Where the rider should go next for this order: the pickup until the parcel is on board. */
export function legFor(order: DeliveryOrder): StopLeg {
  if (hasParcelOnBoard(order.status) || isClosed(order.status)) {
    return {
      kind: "dropoff",
      address: order.delivery_address,
      point:
        order.delivery_latitude != null && order.delivery_longitude != null
          ? {
              latitude: order.delivery_latitude,
              longitude: order.delivery_longitude,
            }
          : null,
    };
  }
  return {
    kind: "pickup",
    address: order.pickup_address,
    point:
      order.pickup_latitude != null && order.pickup_longitude != null
        ? { latitude: order.pickup_latitude, longitude: order.pickup_longitude }
        : null,
  };
}

function yangonDay(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Yangon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function closedAt(order: DeliveryOrder, events: StatusEvent[]) {
  const closing = events
    .filter((event) => event.order_id === order.id && isClosed(event.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return closing?.created_at ?? null;
}

export type RiderRoute = {
  /** Every stop on today's route in display order: finished first, then the queue. */
  stops: DeliveryOrder[];
  active: DeliveryOrder[];
  closedToday: DeliveryOrder[];
  current: DeliveryOrder | null;
  phase: "idle" | "ready" | "active" | "complete";
};

export function buildRiderRoute(
  orders: DeliveryOrder[],
  events: StatusEvent[],
  driverId: string | null,
  now = Date.now(),
): RiderRoute {
  const mine = orders.filter(
    (order) => driverId == null || order.driver_id === driverId,
  );
  const today = yangonDay(now);
  const closedToday = mine
    .filter((order) => isClosed(order.status))
    .map((order) => ({ order, at: closedAt(order, events) }))
    .filter(({ at }) => at != null && yangonDay(at) === today)
    .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))
    .map(({ order }) => order);
  const active = mine
    .filter((order) => ACTIVE_RANK[order.status] != null)
    .sort(
      (a, b) =>
        (ACTIVE_RANK[a.status] ?? 9) - (ACTIVE_RANK[b.status] ?? 9) ||
        a.created_at.localeCompare(b.created_at),
    );
  const phase = active.length
    ? active.every((order) => order.status === "assigned")
      ? "ready"
      : "active"
    : closedToday.length
      ? "complete"
      : "idle";
  return {
    stops: [...closedToday, ...active],
    active,
    closedToday,
    current: active[0] ?? null,
    phase,
  };
}

export type RouteSummary = {
  assigned: number;
  delivered: number;
  failed: number;
  directDistanceKm: number | null;
  durationMinutes: number | null;
  codExpected: number;
  codCollected: number;
  codOutstanding: number;
  codAwaitingHandover: number;
};

export function summariseRoute(
  route: RiderRoute,
  events: StatusEvent[],
): RouteSummary {
  const delivered = route.closedToday.filter((o) => o.status === "delivered");
  const codOrders = [...route.active, ...route.closedToday].filter(
    (order) => order.cod_amount > 0,
  );
  const collected = codOrders.filter(
    (order) =>
      order.cod_status === "collected" || order.cod_status === "settled",
  );
  const sum = (items: DeliveryOrder[]) =>
    items.reduce((total, order) => total + order.cod_amount, 0);

  const legs = route.closedToday.flatMap((order) =>
    order.pickup_latitude != null &&
    order.pickup_longitude != null &&
    order.delivery_latitude != null &&
    order.delivery_longitude != null
      ? [
          distanceKm(
            {
              latitude: order.pickup_latitude,
              longitude: order.pickup_longitude,
            },
            {
              latitude: order.delivery_latitude,
              longitude: order.delivery_longitude,
            },
          ),
        ]
      : [],
  );

  const ids = new Set(route.stops.map((order) => order.id));
  const times = events
    .filter((event) => ids.has(event.order_id) && event.status !== "assigned")
    .map((event) => Date.parse(event.created_at))
    .filter(Number.isFinite);

  return {
    assigned: route.stops.length,
    delivered: delivered.length,
    failed: route.closedToday.length - delivered.length,
    directDistanceKm: legs.length ? legs.reduce((a, b) => a + b, 0) : null,
    durationMinutes:
      times.length > 1
        ? Math.round((Math.max(...times) - Math.min(...times)) / 60_000)
        : null,
    codExpected: sum(codOrders),
    codCollected: sum(collected),
    codOutstanding: sum(codOrders) - sum(collected),
    codAwaitingHandover: sum(
      codOrders.filter((order) => order.cod_status === "collected"),
    ),
  };
}

export function formatDuration(minutes: number | null) {
  if (minutes == null) return "—";
  if (minutes < 1) return "Under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}
