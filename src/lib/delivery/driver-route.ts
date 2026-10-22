import type { GeoPoint } from "@/lib/delivery/rider-route";
import type {
  DeliveryOrder,
  DeliveryStatus,
  RouteStop,
  StatusEvent,
} from "@/lib/delivery/types";
import {
  countInterceptionPointsBetween,
  countTrafficSignalsBetween,
} from "./energy-routing.ts";

// Type-only imports keep this module runnable by the Node test runner.
const isClosed = (status: DeliveryStatus) =>
  status === "delivered" || status === "failed" || status === "cancelled";
const hasParcelOnBoard = (status: DeliveryStatus) =>
  status === "picked_up" || status === "in_transit";

function distanceKm(from: GeoPoint, to: GeoPoint) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLon = rad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.latitude)) *
      Math.cos(rad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/*
 * The driver's day as Oern models it. A route is everything one driver and
 * truck carry today. A stop is one place and one recipient; it can hold
 * several parcels. A parcel is one delivery order. Parcel statuses are the
 * persisted truth; route and stop states are derived from them plus the
 * driver's route session and arrival marks.
 */

export type ParcelState =
  | "ASSIGNED"
  | "TO_COLLECT"
  | "LOADED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "RETURN_PENDING";

export type StopState =
  | "PENDING"
  | "NAVIGATING"
  | "ARRIVED"
  | "HANDOVER_IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "RESCHEDULED";

export type RouteState =
  | "NONE"
  | "ASSIGNED"
  | "MANIFEST_VERIFICATION"
  | "READY"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "CLOSED";

export type RouteSession = {
  status: "in_progress" | "paused" | "closed";
  started_at: string;
  paused_at: string | null;
  closed_at: string | null;
  cod_declared: number | null;
};

/**
 * Failed parcels stay on the truck until they are handed back at the depot.
 * A door parcel that is still to be collected at the customer's address is
 * TO_COLLECT, not "not loaded": it is never loaded at the depot.
 */
export function parcelState(
  order: DeliveryOrder,
  toCollect = false,
): ParcelState {
  if (toCollect) return "TO_COLLECT";
  switch (order.status) {
    case "picked_up":
      return "LOADED";
    case "in_transit":
      return "OUT_FOR_DELIVERY";
    case "delivered":
      return "DELIVERED";
    case "failed":
      return "RETURN_PENDING";
    case "cancelled":
      return "FAILED";
    default:
      return "ASSIGNED";
  }
}

export const PARCEL_STATE_LABELS: Record<ParcelState, string> = {
  ASSIGNED: "Not loaded",
  TO_COLLECT: "To collect",
  LOADED: "Loaded",
  OUT_FOR_DELIVERY: "On board",
  DELIVERED: "Delivered",
  FAILED: "Cancelled",
  RETURN_PENDING: "Return to depot",
};

export type DeliveryStop = {
  /** A delivery to a recipient, or a door pickup at a customer's address. */
  kind: "delivery" | "pickup";
  key: string;
  /** Position in today's route, from 1. */
  number: number;
  parcels: DeliveryOrder[];
  /** Parcels on the truck and still to hand over. */
  open: DeliveryOrder[];
  /** Parcels added to this stop that are not on the truck yet. */
  notLoaded: DeliveryOrder[];
  /** Pickup stops: parcels still to collect here. Empty for deliveries. */
  collect: DeliveryOrder[];
  /** Delivery stops: door parcels whose pickup has not happened yet. */
  awaitingPickup: DeliveryOrder[];
  /** Pickup stops: the customer's pickup window, ISO times. */
  windowStart: string | null;
  windowEnd: string | null;
  /** True when dispatch planned this stop (it has a sequence from the plan). */
  planned: boolean;
  recipient: string;
  phone: string | null;
  address: string;
  point: GeoPoint | null;
  /** Cash still to collect here, in MMK. */
  codDue: number;
  etaAt: string | null;
  state: StopState;
};

/** Destinations closer than this, for the same recipient, are one stop. */
const SAME_STOP_KM = 0.03;

function deliveryPoint(order: DeliveryOrder): GeoPoint | null {
  return order.delivery_latitude != null && order.delivery_longitude != null
    ? { latitude: order.delivery_latitude, longitude: order.delivery_longitude }
    : null;
}

function recipientKey(order: DeliveryOrder) {
  const phone = order.recipient_phone?.replace(/\D/g, "");
  if (phone) return `p${phone}`;
  return `n${(order.recipient_name ?? order.customer_name ?? "").trim().toLowerCase()}`;
}

function sameStop(a: DeliveryOrder, b: DeliveryOrder) {
  if (recipientKey(a) !== recipientKey(b)) return false;
  const pa = deliveryPoint(a);
  const pb = deliveryPoint(b);
  if (pa && pb) return distanceKm(pa, pb) <= SAME_STOP_KM;
  return (
    a.delivery_address.trim().toLowerCase() ===
    b.delivery_address.trim().toLowerCase()
  );
}

export function codDue(order: DeliveryOrder) {
  return order.cod_amount > 0 && order.cod_status === "pending"
    ? order.cod_amount
    : 0;
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

function closedToday(
  order: DeliveryOrder,
  events: StatusEvent[],
  today: string,
) {
  const closing = events
    .filter((event) => event.order_id === order.id && isClosed(event.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return closing != null && yangonDay(closing.created_at) === today;
}

/**
 * Dispatch order for a parcel: the route stop sequence when dispatch set one,
 * then the promised ETA, then when it was created.
 */
function sequenceKey(order: DeliveryOrder, sequence: Map<string, number>) {
  return [
    sequence.get(order.id) ?? Number.MAX_SAFE_INTEGER,
    order.estimated_delivery_at ?? "~",
    order.created_at,
  ] as const;
}

function compareSequence(
  a: readonly [number, string, string],
  b: readonly [number, string, string],
) {
  return a[0] - b[0] || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]);
}

export type DriverRouteInput = {
  orders: DeliveryOrder[];
  events: StatusEvent[];
  routeStops: RouteStop[];
  driverId: string | null;
  now: number;
  session: RouteSession | null;
  /** Stop keys the driver marked as arrived. */
  arrived: string[];
  /** Stop key whose handover form is open. */
  handover: string | null;
  /** Stops the driver chose to try again later, moved to the end. */
  deferred: string[];
};

export type DriverRoute = {
  state: RouteState;
  stops: DeliveryStop[];
  current: DeliveryStop | null;
  /** Open stops after the current one, in order. */
  upcoming: DeliveryStop[];
  /** Today's parcels for this driver, finished ones included. */
  parcels: DeliveryOrder[];
  /** Assigned by dispatch and not yet acknowledged by the driver. */
  unacknowledged: DeliveryOrder[];
  /** Acknowledged, loaded at the depot, but not on the truck yet. */
  toLoad: DeliveryOrder[];
  /** Door parcels still to be collected from customers. */
  toCollect: DeliveryOrder[];
  onBoard: DeliveryOrder[];
  /** Failed parcels that go back to the depot. */
  returns: DeliveryOrder[];
  codExpected: number;
  codCollected: number;
  codToCollect: number;
  delivered: number;
  failed: number;
  signalsOnRoute: number;
  interceptionsOnRoute: number;
};

const ACTIVE = new Set(["assigned", "accepted", "picked_up", "in_transit"]);

function pickupPoint(order: DeliveryOrder): GeoPoint | null {
  return order.pickup_latitude != null && order.pickup_longitude != null
    ? { latitude: order.pickup_latitude, longitude: order.pickup_longitude }
    : null;
}

function samePickupPlace(a: DeliveryOrder, b: DeliveryOrder) {
  const pa = pickupPoint(a);
  const pb = pickupPoint(b);
  if (pa && pb) return distanceKm(pa, pb) <= SAME_STOP_KM;
  return (
    a.pickup_address.trim().toLowerCase() ===
    b.pickup_address.trim().toLowerCase()
  );
}

/** Key of a pickup stop: named after its earliest parcel, apart from delivery keys. */
export const pickupStopKey = (parcels: DeliveryOrder[]) =>
  `pickup:${stopKey(parcels)}`;

/** The parcels a driver can act on at this stop right now. */
export const stopParcels = (stop: DeliveryStop) =>
  stop.kind === "pickup" ? stop.collect : stop.open;

export const isActionable = (stop: DeliveryStop) =>
  stopParcels(stop).length > 0;

export function buildDriverRoute(input: DriverRouteInput): DriverRoute {
  const today = yangonDay(input.now);
  const mine = input.orders.filter(
    (order) => input.driverId == null || order.driver_id === input.driverId,
  );
  const parcels = mine.filter(
    (order) =>
      ACTIVE.has(order.status) ||
      (isClosed(order.status) &&
        order.status !== "cancelled" &&
        closedToday(order, input.events, today)),
  );

  // Dispatch order for the delivery stops (legacy and planned alike).
  const sequence = new Map<string, number>();
  // Stops that came from a committed plan carry a run-stop id. A parcel is a
  // door pickup only if its order has such a pickup stop; everything else
  // behaves exactly as before (loaded at the depot).
  const planPickup = new Map<string, RouteStop>();
  const planDelivery = new Map<string, RouteStop>();
  for (const stop of input.routeStops) {
    if (stop.stop_type === "delivery")
      sequence.set(stop.order_id, stop.sequence_number);
    if (!stop.dispatch_run_stop_id || stop.status === "skipped") continue;
    if (stop.stop_type === "pickup") planPickup.set(stop.order_id, stop);
    else planDelivery.set(stop.order_id, stop);
  }
  const isDoor = (order: DeliveryOrder) => planPickup.has(order.id);
  const pickupPending = (order: DeliveryOrder) => {
    const stop = planPickup.get(order.id);
    return (
      stop != null &&
      (order.status === "assigned" || order.status === "accepted") &&
      (stop.status === "pending" || stop.status === "arrived")
    );
  };
  // It was never on the truck: nothing to deliver, nothing to hand back.
  const pickupFailed = (order: DeliveryOrder) =>
    planPickup.get(order.id)?.status === "failed";

  const ordered = [...parcels].sort((a, b) =>
    compareSequence(sequenceKey(a, sequence), sequenceKey(b, sequence)),
  );

  // Group parcels for the same recipient at the same place into one stop.
  const groups: DeliveryOrder[][] = [];
  for (const order of ordered) {
    if (pickupFailed(order)) continue;
    const group = groups.find((items) => sameStop(items[0], order));
    if (group) group.push(order);
    else groups.push([order]);
  }

  // Group door parcels collected at the same place into one pickup stop.
  const pickupGroups: DeliveryOrder[][] = [];
  const byPickup = parcels
    .filter(isDoor)
    .sort(
      (a, b) =>
        (planPickup.get(a.id)?.sequence_number ?? 0) -
        (planPickup.get(b.id)?.sequence_number ?? 0),
    );
  for (const order of byPickup) {
    const group = pickupGroups.find((items) =>
      samePickupPlace(items[0], order),
    );
    if (group) group.push(order);
    else pickupGroups.push([order]);
  }

  const minPlanSeq = (items: DeliveryOrder[], map: Map<string, RouteStop>) => {
    const values = items
      .map((order) => map.get(order.id)?.sequence_number)
      .filter((value): value is number => value != null);
    return values.length ? Math.min(...values) : null;
  };

  const deliveryStops: DeliveryStop[] = groups.map((items) => {
    const first = items[0];
    const open = items.filter((order) => hasParcelOnBoard(order.status));
    const awaitingPickup = items.filter(pickupPending);
    const notLoaded = items.filter(
      (order) =>
        (order.status === "assigned" || order.status === "accepted") &&
        !pickupPending(order),
    );
    const etas = items
      .map(
        (order) =>
          order.estimated_delivery_at ??
          planDelivery.get(order.id)?.planned_arrival_at ??
          null,
      )
      .filter((value): value is string => value != null)
      .sort();
    return {
      kind: "delivery",
      key: stopKey(items),
      number: 0,
      parcels: items,
      open,
      notLoaded,
      collect: [],
      awaitingPickup,
      windowStart: null,
      windowEnd: null,
      planned: items.every((order) => planDelivery.has(order.id)),
      recipient: first.recipient_name || first.customer_name || "Recipient",
      phone:
        items.find((order) => order.recipient_phone)?.recipient_phone ?? null,
      address: first.delivery_address,
      point: deliveryPoint(first),
      codDue: items.reduce((sum, order) => sum + codDue(order), 0),
      etaAt: etas[0] ?? null,
      state: "PENDING",
    };
  });

  const pickupStops: DeliveryStop[] = pickupGroups.map((items) => {
    const first = items[0];
    const stops = items
      .map((order) => planPickup.get(order.id))
      .filter((stop): stop is RouteStop => stop != null);
    const arrivals = stops
      .map((stop) => stop.planned_arrival_at)
      .filter((value): value is string => value != null)
      .sort();
    return {
      kind: "pickup",
      key: pickupStopKey(items),
      number: 0,
      parcels: items,
      open: [],
      notLoaded: [],
      collect: items.filter(pickupPending),
      awaitingPickup: [],
      windowStart:
        stops.map((stop) => stop.window_start_at).find(Boolean) ?? null,
      windowEnd: stops.map((stop) => stop.window_end_at).find(Boolean) ?? null,
      planned: true,
      recipient: first.pickup_contact_name || first.customer_name || "Customer",
      phone:
        items.find((order) => order.pickup_contact_phone)
          ?.pickup_contact_phone ?? null,
      address: first.pickup_address,
      point: pickupPoint(first),
      codDue: 0,
      etaAt: arrivals[0] ?? null,
      state: "PENDING",
    };
  });

  const finished = (stop: DeliveryStop) =>
    stop.kind === "pickup"
      ? stop.collect.length === 0
      : stop.parcels.every((order) => isClosed(order.status));

  // A deferred pickup takes its deliveries with it, so a parcel is never
  // delivered before it has been collected.
  const deferred = new Set(input.deferred);
  for (const pickup of pickupStops)
    if (deferred.has(pickup.key))
      for (const delivery of deliveryStops)
        if (delivery.parcels.some((order) => pickup.parcels.includes(order)))
          deferred.add(delivery.key);

  // Order: planned stops by the plan's sequence, then anything dispatch did
  // not plan by promised time. Finished first, open next, deferred last.
  const seqOf = (stop: DeliveryStop) =>
    stop.kind === "pickup"
      ? minPlanSeq(stop.parcels, planPickup)
      : stop.planned
        ? minPlanSeq(stop.parcels, planDelivery)
        : null;
  const stops = [...deliveryStops, ...pickupStops];
  const sortKey = (stop: DeliveryStop) => {
    const seq = seqOf(stop);
    if (seq != null) return [0, seq, "", ""] as const;
    // Not planned: keep the dispatcher's own order, then promised time.
    const legacy = stop.parcels
      .map((order) => sequence.get(order.id))
      .filter((value): value is number => value != null);
    return [
      1,
      legacy.length ? Math.min(...legacy) : Number.MAX_SAFE_INTEGER,
      stop.etaAt ?? "~",
      stop.parcels.map((order) => order.created_at).sort()[0] ?? "",
    ] as const;
  };
  stops.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    return (
      ka[0] - kb[0] ||
      ka[1] - kb[1] ||
      ka[2].localeCompare(kb[2]) ||
      ka[3].localeCompare(kb[3])
    );
  });
  const finishedStops = stops.filter(finished);
  const openStops = stops.filter(
    (stop) => !finished(stop) && !deferred.has(stop.key),
  );
  const deferredStops = stops.filter(
    (stop) => !finished(stop) && deferred.has(stop.key),
  );

  const detourDelta = (
    previous: DeliveryStop,
    candidate: DeliveryStop,
    next: DeliveryStop | null,
  ) => {
    if (!previous.point || !candidate.point) return Number.POSITIVE_INFINITY;
    if (!next?.point) {
      const signals = countTrafficSignalsBetween(
        previous.point,
        candidate.point,
      ).count;
      const interceptions = countInterceptionPointsBetween(
        previous.point,
        candidate.point,
      ).count;
      return (
        distanceKm(previous.point, candidate.point) +
        signals * 0.45 +
        interceptions * 0.25
      );
    }
    const addedDistance =
      distanceKm(previous.point, candidate.point) +
      distanceKm(candidate.point, next.point) -
      distanceKm(previous.point, next.point);
    const addedSignals =
      countTrafficSignalsBetween(previous.point, candidate.point).count +
      countTrafficSignalsBetween(candidate.point, next.point).count -
      countTrafficSignalsBetween(previous.point, next.point).count;
    const addedInterceptions =
      countInterceptionPointsBetween(previous.point, candidate.point).count +
      countInterceptionPointsBetween(candidate.point, next.point).count -
      countInterceptionPointsBetween(previous.point, next.point).count;
    return (
      addedDistance +
      Math.max(0, addedSignals) * 0.45 +
      Math.max(0, addedInterceptions) * 0.25
    );
  };

  for (const deferredStop of deferredStops) {
    // Planned pickup and delivery stops retain their relative dispatch order,
    // which guarantees a door parcel is collected before it is delivered.
    if (deferredStop.planned || openStops.length <= 1) {
      openStops.push(deferredStop);
      continue;
    }

    let bestIndex = openStops.length;
    let minimumDetour = Number.POSITIVE_INFINITY;
    for (let index = 1; index <= openStops.length; index += 1) {
      const delta = detourDelta(
        openStops[index - 1],
        deferredStop,
        index < openStops.length ? openStops[index] : null,
      );
      if (delta < minimumDetour) {
        minimumDetour = delta;
        bestIndex = index;
      }
    }
    openStops.splice(bestIndex, 0, deferredStop);
  }

  stops.splice(0, stops.length, ...finishedStops, ...openStops);
  stops.forEach((stop, index) => {
    stop.number = index + 1;
  });

  const toCollect = parcels.filter(pickupPending);
  const unacknowledged = parcels.filter((order) => order.status === "assigned");
  // Door parcels are collected on the road, never loaded at the depot.
  const toLoad = parcels.filter(
    (order) => order.status === "accepted" && !pickupPending(order),
  );
  const onBoard = parcels.filter((order) => hasParcelOnBoard(order.status));
  const active = parcels.filter((order) => ACTIVE.has(order.status));
  const started =
    parcels.some((order) => order.status === "in_transit") ||
    input.session?.status === "in_progress" ||
    input.session?.status === "paused";

  const state: RouteState =
    !active.length && input.session?.status === "closed"
      ? "CLOSED"
      : !parcels.length
        ? "NONE"
        : !onBoard.length &&
            !unacknowledged.length &&
            !toLoad.length &&
            !toCollect.length
          ? "COMPLETED"
          : input.session?.status === "paused"
            ? "PAUSED"
            : started && (onBoard.length || toCollect.length)
              ? "IN_PROGRESS"
              : unacknowledged.length
                ? "ASSIGNED"
                : toLoad.length
                  ? "MANIFEST_VERIFICATION"
                  : "READY";

  // A paused route keeps its place so the driver sees where they stopped.
  const navigable = state === "IN_PROGRESS" || state === "PAUSED";
  let current: DeliveryStop | null = null;
  for (const stop of stops) {
    if (finished(stop)) {
      const failed =
        stop.kind === "pickup"
          ? stop.parcels.every(pickupFailed)
          : stop.parcels.every((order) => order.status === "failed");
      stop.state = failed ? "FAILED" : "COMPLETED";
      continue;
    }
    if (navigable && !current && isActionable(stop)) {
      current = stop;
      stop.state =
        input.handover === stop.key
          ? "HANDOVER_IN_PROGRESS"
          : input.arrived.includes(stop.key)
            ? "ARRIVED"
            : "NAVIGATING";
    }
  }

  const upcoming = stops.filter(
    (stop) => stop !== current && stop.state === "PENDING",
  );
  const codOrders = parcels.filter((order) => order.cod_amount > 0);
  const codCollected = codOrders
    .filter(
      (order) =>
        order.cod_status === "collected" || order.cod_status === "settled",
    )
    .reduce((sum, order) => sum + order.cod_amount, 0);

  let signalsOnRoute = 0;
  let interceptionsOnRoute = 0;
  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = stops[index].point;
    const to = stops[index + 1].point;
    if (!from || !to) continue;
    signalsOnRoute += countTrafficSignalsBetween(from, to).count;
    interceptionsOnRoute += countInterceptionPointsBetween(from, to).count;
  }

  return {
    state,
    stops,
    current,
    upcoming,
    parcels,
    unacknowledged,
    toLoad,
    toCollect,
    onBoard,
    returns: parcels.filter(
      (order) => order.status === "failed" && !pickupFailed(order),
    ),
    codExpected: codOrders.reduce((sum, order) => sum + order.cod_amount, 0),
    codCollected,
    codToCollect: parcels.reduce((sum, order) => sum + codDue(order), 0),
    delivered: parcels.filter((order) => order.status === "delivered").length,
    failed: parcels.filter((order) => order.status === "failed").length,
    signalsOnRoute,
    interceptionsOnRoute,
  };
}

/** Stable across reloads: the stop is named after its earliest parcel. */
export function stopKey(parcels: DeliveryOrder[]) {
  return [...parcels.map((order) => order.id)].sort()[0];
}

/* ------------------------------------------------------- route revisions */

/** What the driver last acknowledged: stop keys in order, and parcel ids. */
export type RouteSnapshot = { stops: string[]; parcels: string[] };

export function snapshotRoute(route: DriverRoute): RouteSnapshot {
  return {
    stops: route.stops
      .filter((stop) => stop.state === "PENDING" || stop === route.current)
      .map((stop) => stop.key),
    parcels: route.parcels
      .filter((order) => !isClosed(order.status))
      .map((order) => order.id)
      .sort(),
  };
}

export type RouteRevision = {
  addedParcels: DeliveryOrder[];
  removedParcels: string[];
  /** Open stops that now come in a different order. */
  reordered: boolean;
  /** The stop the driver is working on is no longer first or no longer theirs. */
  currentChanged: boolean;
  /** Dispatch must hear back: new parcels need acknowledging. */
  needsAcknowledgement: boolean;
};

export function diffRoute(
  previous: RouteSnapshot | null,
  route: DriverRoute,
  previousCurrent: string | null,
): RouteRevision | null {
  if (!previous) return null;
  const next = snapshotRoute(route);
  const before = new Set(previous.parcels);
  const after = new Set(next.parcels);
  const addedParcels = route.parcels.filter(
    (order) => after.has(order.id) && !before.has(order.id),
  );
  // Removed means gone from the driver's list (reassigned or cancelled). A
  // parcel the driver closed themselves is still listed, with its outcome.
  const listed = new Set(route.parcels.map((order) => order.id));
  const removedParcels = previous.parcels.filter((id) => !listed.has(id));
  const kept = next.stops.filter((key) => previous.stops.includes(key));
  const keptBefore = previous.stops.filter((key) => kept.includes(key));
  const reordered = kept.some((key, index) => keptBefore[index] !== key);
  const currentChanged =
    previousCurrent != null &&
    route.current != null &&
    route.current.key !== previousCurrent &&
    !route.stops.some(
      (stop) =>
        stop.key === previousCurrent &&
        (stop.state === "COMPLETED" || stop.state === "FAILED"),
    );
  if (
    !addedParcels.length &&
    !removedParcels.length &&
    !reordered &&
    !currentChanged
  )
    return null;
  return {
    addedParcels,
    removedParcels,
    reordered,
    currentChanged,
    needsAcknowledgement: addedParcels.some(
      (order) => order.status === "assigned",
    ),
  };
}

/* -------------------------------------------------------------- handover */

export type CodMode = "full" | "different";

export type HandoverDraft = {
  /** Parcel ids the driver checked against the manifest. */
  verified: string[];
  receivedBy: string;
  codMode: CodMode | null;
  codAmount: string;
  codReason: string;
  note: string;
  /** One request id per parcel, kept across retries so a resend is not a second delivery. */
  requestIds: Record<string, string>;
  /** Pickup stops: the weight read on the scale per parcel id, in kg, as typed. */
  weights?: Record<string, string>;
};

export const EMPTY_HANDOVER: HandoverDraft = {
  verified: [],
  receivedBy: "",
  codMode: null,
  codAmount: "",
  codReason: "",
  note: "",
  requestIds: {},
};

export type Requirement = { key: string; label: string; met: boolean };

export function handoverRequirements(
  stop: DeliveryStop,
  draft: HandoverDraft,
): Requirement[] {
  const requirements: Requirement[] = [
    {
      key: "parcels",
      label:
        stop.open.length > 1
          ? `Check all ${stop.open.length} parcels`
          : "Check the parcel",
      met: stop.open.every((order) => draft.verified.includes(order.id)),
    },
    {
      key: "recipient",
      label: "Record who received it",
      met: draft.receivedBy.trim().length > 0,
    },
  ];
  if (stop.codDue > 0) {
    const amount = Number(draft.codAmount);
    requirements.push({
      key: "cod",
      label: "Record the cash received",
      met:
        draft.codMode === "full" ||
        (draft.codMode === "different" &&
          draft.codAmount.trim() !== "" &&
          Number.isFinite(amount) &&
          amount >= 0 &&
          draft.codReason.trim().length >= 3),
    });
  }
  return requirements;
}

/** What must be done before a door pickup can be recorded as collected. */
export function pickupRequirements(
  stop: DeliveryStop,
  draft: HandoverDraft,
): Requirement[] {
  const weights = draft.weights ?? {};
  const badWeight = stop.collect.some((order) => {
    const typed = (weights[order.id] ?? "").trim();
    if (typed === "") return false;
    const value = Number(typed);
    return !Number.isFinite(value) || value <= 0 || value > 100000;
  });
  return [
    {
      key: "parcels",
      label:
        stop.collect.length > 1
          ? `Check all ${stop.collect.length} parcels`
          : "Check the parcel",
      met: stop.collect.every((order) => draft.verified.includes(order.id)),
    },
    {
      key: "weight",
      label: "Enter a weight above 0 kg, or leave it empty",
      met: !badWeight,
    },
  ];
}

export type PickupReasonOption = {
  id:
    | "customer_unavailable"
    | "parcel_not_ready"
    | "wrong_parcel"
    | "refused"
    | "oversize"
    | "other";
  label: string;
  detail: string;
};

export const PICKUP_REASONS: PickupReasonOption[] = [
  {
    id: "customer_unavailable",
    label: "Nobody there",
    detail: "No one to hand the parcel over",
  },
  {
    id: "parcel_not_ready",
    label: "Parcel not ready",
    detail: "Not packed or not available yet",
  },
  {
    id: "wrong_parcel",
    label: "Wrong parcel",
    detail: "Doesn’t match the order",
  },
  {
    id: "refused",
    label: "Customer cancelled",
    detail: "Doesn’t want it collected",
  },
  {
    id: "oversize",
    label: "Too big or heavy",
    detail: "Won’t fit or can’t be lifted safely",
  },
  {
    id: "other",
    label: "Something else",
    detail: "Describe it for operations",
  },
];

/**
 * Splits the cash received at a stop across its COD parcels in route order.
 * Each parcel gets up to its own amount; any shortfall lands on the later ones.
 */
export function allocateCod(parcels: DeliveryOrder[], received: number) {
  let left = Math.max(0, received);
  const result = new Map<string, number>();
  const due = parcels.filter((order) => codDue(order) > 0);
  due.forEach((order, index) => {
    const share =
      index === due.length - 1 ? left : Math.min(left, order.cod_amount);
    result.set(order.id, share);
    left -= share;
  });
  return result;
}

/* ------------------------------------------------------------ exceptions */

export type ExceptionReason =
  | "recipient_unavailable"
  | "recipient_unreachable"
  | "incorrect_address"
  | "cannot_access"
  | "recipient_refused"
  | "cod_not_paid"
  | "parcel_damaged"
  | "parcel_missing"
  | "other";

export type NextAction = "retry_later" | "reschedule" | "return_to_depot";

export type ExceptionOption = {
  id: ExceptionReason;
  label: string;
  detail: string;
  /** Applies to chosen parcels rather than the whole stop. */
  perParcel: boolean;
  actions: NextAction[];
};

export const EXCEPTION_OPTIONS: ExceptionOption[] = [
  {
    id: "recipient_unavailable",
    label: "Recipient not there",
    detail: "Nobody to receive the parcel",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
  {
    id: "recipient_unreachable",
    label: "Can’t contact recipient",
    detail: "Calls and messages not answered",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
  {
    id: "incorrect_address",
    label: "Wrong or incomplete address",
    detail: "Address doesn’t exist or can’t be found",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
  {
    id: "cannot_access",
    label: "Can’t reach the destination",
    detail: "Truck can’t enter, road closed, gate locked",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
  {
    id: "recipient_refused",
    label: "Recipient refused",
    detail: "Doesn’t want the parcel",
    perParcel: true,
    actions: ["return_to_depot"],
  },
  {
    id: "cod_not_paid",
    label: "Recipient can’t pay COD",
    detail: "Don’t hand over the parcel",
    perParcel: true,
    actions: ["reschedule", "return_to_depot"],
  },
  {
    id: "parcel_damaged",
    label: "Parcel damaged",
    detail: "Torn, wet or broken",
    perParcel: true,
    actions: ["return_to_depot", "reschedule"],
  },
  {
    id: "parcel_missing",
    label: "Parcel missing",
    detail: "Not on the truck",
    perParcel: true,
    actions: ["reschedule"],
  },
  {
    id: "other",
    label: "Something else",
    detail: "Describe it for operations",
    perParcel: false,
    actions: ["retry_later", "reschedule", "return_to_depot"],
  },
];

export const NEXT_ACTION_LABELS: Record<NextAction, string> = {
  retry_later: "Try again later today",
  reschedule: "Reschedule for another day",
  return_to_depot: "Return to depot",
};

/* --------------------------------------------------------------- metrics */

/** Latest promised ETA among open stops, if dispatch set one. */
export function finishEstimate(route: DriverRoute) {
  return (
    route.stops
      .filter((stop) => stop.state !== "COMPLETED" && stop.state !== "FAILED")
      .map((stop) => stop.etaAt)
      .filter((value): value is string => value != null)
      .sort()
      .at(-1) ?? null
  );
}

/** Time shown for a stop: a pickup's window, or a delivery's promised time. */
export function isPickup(stop: DeliveryStop) {
  return stop.kind === "pickup";
}

export function openStops(route: DriverRoute) {
  return route.stops.filter(
    (stop) => stop.state !== "COMPLETED" && stop.state !== "FAILED",
  );
}
