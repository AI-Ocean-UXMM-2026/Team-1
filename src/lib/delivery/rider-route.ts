import type {
  DeliveryOrder,
  DeliveryStatus,
  RoadReport,
  StatusEvent,
  VehicleOption,
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

export type TurnSymbol =
  | "straight"
  | "turn-right"
  | "turn-left"
  | "slight-right"
  | "slight-left"
  | "sharp-right"
  | "sharp-left"
  | "u-turn"
  | "roundabout"
  | "fork-right"
  | "fork-left"
  | "merge"
  | "arrive"
  | "location";

export function resolveTurnSymbol(
  instruction?: string | null,
  modifier?: string | null,
  type?: string | null,
): TurnSymbol {
  const mod = modifier?.toLowerCase().trim();
  const t = type?.toLowerCase().trim();

  // 1. Explicit Mapbox modifier
  if (mod === "right") return "turn-right";
  if (mod === "left") return "turn-left";
  if (mod === "slight right") return "slight-right";
  if (mod === "slight left") return "slight-left";
  if (mod === "sharp right") return "sharp-right";
  if (mod === "sharp left") return "sharp-left";
  if (mod === "uturn") return "u-turn";
  if (mod === "straight") return "straight";

  // 2. Explicit Mapbox maneuver type
  if (t === "arrive") return "arrive";
  if (t === "roundabout" || t === "rotary" || t === "roundabout turn")
    return "roundabout";
  if (t === "merge") return "merge";
  if (t === "fork") return mod?.includes("left") ? "fork-left" : "fork-right";
  if (t === "depart" || t === "continue") return "straight";

  // 3. Fallback: Parse instruction text
  if (!instruction) return "straight";
  const text = instruction.toLowerCase();
  if (/\bu-?turn\b/.test(text)) return "u-turn";
  if (/\bsharp right\b/.test(text)) return "sharp-right";
  if (/\bsharp left\b/.test(text)) return "sharp-left";
  if (/\bslight right\b|\bbear right\b|\bkeep right\b/.test(text))
    return "slight-right";
  if (/\bslight left\b|\bbear left\b|\bkeep left\b/.test(text))
    return "slight-left";
  if (/\bturn right\b|\bright onto\b|\btake the right\b/.test(text))
    return "turn-right";
  if (/\bturn left\b|\bleft onto\b|\btake the left\b/.test(text))
    return "turn-left";
  if (/\broundabout\b|\brotary\b|\btraffic circle\b/.test(text))
    return "roundabout";
  if (/\bfork\b.*\bleft\b/.test(text)) return "fork-left";
  if (/\bfork\b.*\bright\b/.test(text)) return "fork-right";
  if (/\bmerge\b/.test(text)) return "merge";
  if (
    /\barrive\b|\bdestination\b|\bat stop\b|\byou’re at the stop\b|\byou're at the stop\b/.test(
      text,
    )
  )
    return "arrive";

  return "straight";
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
  const codOrders = [...route.active, ...delivered].filter(
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

/* ------------------------------------------------------------ route points */

/** Pickups closer than this are the same place: one stop, several parcels. */
export const SAME_PLACE_KM = 0.08;

/**
 * One place the rider has to reach. A day can hold many of these; the rider
 * works through them one at a time, so each point says exactly what to do
 * there (collect parcels, or hand one over and take the cash).
 */
export type RoutePoint = {
  key: string;
  kind: "pickup" | "dropoff";
  /** Pickups at the same place share one point. Drop-offs hold one order. */
  orders: DeliveryOrder[];
  address: string;
  point: GeoPoint | null;
  state: "done" | "failed" | "current" | "upcoming";
  /** Cash the rider must take at this point, in MMK. Always 0 at pickups. */
  codDue: number;
  etaAt: string | null;
};

export function codDueFor(order: DeliveryOrder) {
  return order.cod_amount > 0 &&
    order.cod_status !== "collected" &&
    order.cod_status !== "settled"
    ? order.cod_amount
    : 0;
}

function pickupPoint(order: DeliveryOrder): GeoPoint | null {
  return order.pickup_latitude != null && order.pickup_longitude != null
    ? { latitude: order.pickup_latitude, longitude: order.pickup_longitude }
    : null;
}

function samePlace(a: DeliveryOrder, b: DeliveryOrder) {
  const pa = pickupPoint(a);
  const pb = pickupPoint(b);
  if (pa && pb) return distanceKm(pa, pb) <= SAME_PLACE_KM;
  return (
    a.pickup_address.trim().toLowerCase() ===
    b.pickup_address.trim().toLowerCase()
  );
}

/**
 * The day's points in the order the rider reaches them: finished drop-offs,
 * then each remaining order's pickup (merged with other parcels waiting at
 * the same place) followed by its drop-off.
 */
export function buildRoutePoints(route: RiderRoute): RoutePoint[] {
  const points: RoutePoint[] = route.closedToday.map((order) => ({
    key: `${order.id}-dropoff`,
    kind: "dropoff",
    orders: [order],
    address: order.delivery_address,
    point: legFor(order).point,
    state: order.status === "delivered" ? "done" : "failed",
    codDue: 0,
    etaAt: null,
  }));

  const pending: RoutePoint[] = [];
  for (const order of route.active) {
    if (!hasParcelOnBoard(order.status)) {
      const group = pending.find(
        (item) =>
          item.kind === "pickup" &&
          item.orders.every((other) => !hasParcelOnBoard(other.status)) &&
          samePlace(item.orders[0], order),
      );
      if (group) group.orders.push(order);
      else
        pending.push({
          key: `${order.id}-pickup`,
          kind: "pickup",
          orders: [order],
          address: order.pickup_address,
          point: pickupPoint(order),
          state: "upcoming",
          codDue: 0,
          etaAt: null,
        });
    }
    pending.push({
      key: `${order.id}-dropoff`,
      kind: "dropoff",
      orders: [order],
      address: order.delivery_address,
      point:
        order.delivery_latitude != null && order.delivery_longitude != null
          ? {
              latitude: order.delivery_latitude,
              longitude: order.delivery_longitude,
            }
          : null,
      state: "upcoming",
      codDue: codDueFor(order),
      etaAt: order.estimated_delivery_at,
    });
  }
  if (pending[0]) pending[0].state = "current";
  return [...points, ...pending];
}

/** Orders to collect at the rider's current pickup, or none at a drop-off. */
export function currentPickupOrders(points: RoutePoint[]) {
  const current = points.find((item) => item.state === "current");
  return current?.kind === "pickup" ? current.orders : [];
}

/** Total cash still to collect on the open part of the route. */
export function routeCodDue(route: RiderRoute) {
  return route.active.reduce((sum, order) => sum + codDueFor(order), 0);
}

/* ------------------------------------------------------------ road cautions */

export type RoadCaution = {
  report: RoadReport;
  /** How far the report sits from the path, in km. */
  offsetKm: number;
  /** How far along the path it is, from the path's start, in km. */
  aheadKm: number;
};

/** Reports a rider should still hear about: not rejected, not expired. */
export function activeRoadReports(reports: RoadReport[], now: number) {
  return reports.filter(
    (report) =>
      report.status !== "rejected" && Date.parse(report.expires_at) > now,
  );
}

const KM_PER_DEGREE_LAT = 110.574;

/** Local flat projection in km around `origin`; plenty for city distances. */
function toKm(point: GeoPoint, origin: GeoPoint) {
  const kmPerDegreeLon = 111.32 * Math.cos((origin.latitude * Math.PI) / 180);
  return {
    x: (point.longitude - origin.longitude) * kmPerDegreeLon,
    y: (point.latitude - origin.latitude) * KM_PER_DEGREE_LAT,
  };
}

/**
 * Road reports within `radiusKm` of a path, nearest first along the way.
 * The path is the rider's road route when one is known, or the straight
 * line to the next point otherwise.
 */
export function cautionsAlong(
  path: GeoPoint[],
  reports: RoadReport[],
  now: number,
  radiusKm = 0.4,
): RoadCaution[] {
  if (path.length === 0) return [];
  const origin = path[0];
  const points = path.map((point) => toKm(point, origin));
  const cautions: RoadCaution[] = [];

  for (const report of activeRoadReports(reports, now)) {
    const target = toKm(report, origin);
    let best = { offset: Number.POSITIVE_INFINITY, along: 0 };
    let travelled = 0;
    if (points.length === 1) {
      best = {
        offset: Math.hypot(target.x - points[0].x, target.y - points[0].y),
        along: 0,
      };
    }
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const t =
        length === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((target.x - a.x) * dx + (target.y - a.y) * dy) /
                  (length * length),
              ),
            );
      const offset = Math.hypot(
        target.x - (a.x + t * dx),
        target.y - (a.y + t * dy),
      );
      if (offset < best.offset)
        best = { offset, along: travelled + t * length };
      travelled += length;
    }
    if (best.offset <= radiusKm)
      cautions.push({ report, offsetKm: best.offset, aheadKm: best.along });
  }

  return cautions.sort((a, b) => a.aheadKm - b.aheadKm);
}

const CAUTION_COPY: Record<
  RoadReport["category"],
  { title: string; advice: string }
> = {
  flooding: {
    title: "Flooding",
    advice: "Slow down, avoid deep water and keep parcels dry.",
  },
  closure: {
    title: "Road closed",
    advice: "Take another way. Your directions app may not know yet.",
  },
  roadwork: {
    title: "Roadwork",
    advice: "Lanes narrow here. Slow down and expect a short wait.",
  },
  congestion: {
    title: "Heavy traffic",
    advice: "Allow extra time. Don’t rush to make it up later.",
  },
  hazard: {
    title: "Road hazard",
    advice: "Ride carefully and keep your distance.",
  },
};

const SEVERITY_COPY: Record<RoadReport["severity"], string> = {
  low: "Minor",
  medium: "Slows traffic",
  high: "Major delay",
  blocked: "Blocked",
};

export function cautionCopy(report: RoadReport) {
  return {
    ...CAUTION_COPY[report.category],
    impact: SEVERITY_COPY[report.severity],
    confirmed: report.status === "verified",
  };
}

/* ---------------------------------------------------------- energy on route */

const ROAD_DISTANCE_FACTOR = 1.18;

export type RouteEnergy = {
  source: "fuel" | "battery";
  levelPercent: number | null;
  usableKm: number | null;
  neededKm: number | null;
  status: "unknown" | "enough" | "tight" | "short";
};

/**
 * Whether the vehicle's usable range covers what is left of today's route.
 * Straight-line distances are padded to approximate roads; a road distance
 * from the routing service is used as-is.
 */
export function energyForRoute(
  vehicle: VehicleOption | null,
  remainingKm: number | null,
  isRoadDistance = false,
): RouteEnergy {
  const source = vehicle?.energy_source === "electric" ? "battery" : "fuel";
  const levelPercent = !vehicle
    ? null
    : vehicle.energy_source === "electric"
      ? vehicle.battery_level_percent
      : vehicle.energy_source === "fuel"
        ? vehicle.fuel_level_percent
        : (vehicle.fuel_level_percent ?? vehicle.battery_level_percent);
  if (!vehicle || levelPercent == null || !vehicle.range_km_at_full)
    return {
      source,
      levelPercent,
      usableKm: null,
      neededKm: null,
      status: "unknown",
    };
  const usableKm =
    vehicle.range_km_at_full *
    (Math.max(0, levelPercent - vehicle.reserve_percent) / 100);
  const neededKm =
    remainingKm == null
      ? null
      : remainingKm * (isRoadDistance ? 1 : ROAD_DISTANCE_FACTOR);
  const status =
    neededKm == null
      ? "unknown"
      : usableKm < neededKm
        ? "short"
        : usableKm - neededKm < Math.max(5, vehicle.range_km_at_full * 0.08)
          ? "tight"
          : "enough";
  return {
    source,
    levelPercent,
    usableKm: Math.round(usableKm * 10) / 10,
    neededKm: neededKm == null ? null : Math.round(neededKm * 10) / 10,
    status,
  };
}
