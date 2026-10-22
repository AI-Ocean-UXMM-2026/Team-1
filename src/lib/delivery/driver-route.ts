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

/** Failed parcels stay on the truck until they are handed back at the depot. */
export function parcelState(order: DeliveryOrder): ParcelState {
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
  LOADED: "Loaded",
  OUT_FOR_DELIVERY: "On board",
  DELIVERED: "Delivered",
  FAILED: "Cancelled",
  RETURN_PENDING: "Return to depot",
};

export type DeliveryStop = {
  key: string;
  /** Position in today's route, from 1. */
  number: number;
  parcels: DeliveryOrder[];
  /** Parcels on the truck and still to hand over. */
  open: DeliveryOrder[];
  /** Parcels added to this stop that are not on the truck yet. */
  notLoaded: DeliveryOrder[];
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
    order.created_at ?? "",
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
  /** Acknowledged but not on the truck yet. */
  toLoad: DeliveryOrder[];
  onBoard: DeliveryOrder[];
  /** Failed parcels that go back to the depot. */
  returns: DeliveryOrder[];
  codExpected: number;
  codCollected: number;
  codToCollect: number;
  delivered: number;
  failed: number;
  signalsOnRoute?: number;
  interceptionsOnRoute?: number;
};

const ACTIVE = new Set(["assigned", "accepted", "picked_up", "in_transit"]);

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

  const sequence = new Map<string, number>();
  for (const stop of input.routeStops)
    if (stop.stop_type === "delivery")
      sequence.set(stop.order_id, stop.sequence_number);

  const ordered = [...parcels].sort((a, b) =>
    compareSequence(sequenceKey(a, sequence), sequenceKey(b, sequence)),
  );

  // Group parcels for the same recipient at the same place into one stop.
  const groups: DeliveryOrder[][] = [];
  for (const order of ordered) {
    const group = groups.find((items) => sameStop(items[0], order));
    if (group) group.push(order);
    else groups.push([order]);
  }

  const deferred = new Set(input.deferred);
  const finished = (items: DeliveryOrder[]) =>
    items.every((order) => isClosed(order.status));

  function groupPoint(items: DeliveryOrder[]): GeoPoint | null {
    for (const order of items) {
      const pt = deliveryPoint(order);
      if (pt) return pt;
    }
    return null;
  }

  function detourDelta(
    prev: DeliveryOrder[],
    cand: DeliveryOrder[],
    next: DeliveryOrder[] | null,
  ): number {
    const pPrev = groupPoint(prev);
    const pCand = groupPoint(cand);
    if (!pPrev || !pCand) return Number.POSITIVE_INFINITY;
    if (!next) {
      const legKm = distanceKm(pPrev, pCand);
      const sigs = countTrafficSignalsBetween(pPrev, pCand).count;
      const ints = countInterceptionPointsBetween(pPrev, pCand).count;
      return legKm + sigs * 0.45 + ints * 0.25;
    }
    const pNext = groupPoint(next);
    if (!pNext) return Number.POSITIVE_INFINITY;
    const directKm =
      distanceKm(pPrev, pCand) +
      distanceKm(pCand, pNext) -
      distanceKm(pPrev, pNext);
    const addedSigs =
      countTrafficSignalsBetween(pPrev, pCand).count +
      countTrafficSignalsBetween(pCand, pNext).count -
      countTrafficSignalsBetween(pPrev, pNext).count;
    const addedInts =
      countInterceptionPointsBetween(pPrev, pCand).count +
      countInterceptionPointsBetween(pCand, pNext).count -
      countInterceptionPointsBetween(pPrev, pNext).count;
    return (
      directKm +
      Math.max(0, addedSigs) * 0.45 +
      Math.max(0, addedInts) * 0.25
    );
  }

  // Finished stops first; deferred stops are intelligently re-inserted
  // at the minimum marginal detour position among upcoming stops.
  const finishedGroups = groups.filter((g) => finished(g));
  const openGroups = groups.filter(
    (g) => !finished(g) && !deferred.has(stopKey(g)),
  );
  const deferredGroups = groups.filter(
    (g) => !finished(g) && deferred.has(stopKey(g)),
  );

  for (const defGroup of deferredGroups) {
    if (openGroups.length <= 1) {
      openGroups.push(defGroup);
      continue;
    }

    let bestIndex = openGroups.length;
    let minDetour = Number.POSITIVE_INFINITY;

    for (let k = 1; k <= openGroups.length; k++) {
      const prev = openGroups[k - 1];
      const next = k < openGroups.length ? openGroups[k] : null;
      const delta = detourDelta(prev, defGroup, next);
      if (delta < minDetour) {
        minDetour = delta;
        bestIndex = k;
      }
    }

    openGroups.splice(bestIndex, 0, defGroup);
  }

  const sortedGroups = [...finishedGroups, ...openGroups];

  const stops: DeliveryStop[] = sortedGroups.map((items, index) => {
    const first = items[0];
    const open = items.filter((order) => hasParcelOnBoard(order.status));
    const notLoaded = items.filter(
      (order) => order.status === "assigned" || order.status === "accepted",
    );
    const etas = items
      .map((order) => order.estimated_delivery_at)
      .filter((value): value is string => value != null)
      .sort();
    return {
      key: stopKey(items),
      number: index + 1,
      parcels: items,
      open,
      notLoaded,
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

  const unacknowledged = parcels.filter((order) => order.status === "assigned");
  const toLoad = parcels.filter((order) => order.status === "accepted");
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
        : !onBoard.length && !unacknowledged.length && !toLoad.length
          ? "COMPLETED"
          : input.session?.status === "paused"
            ? "PAUSED"
            : started && onBoard.length
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
    if (finished(stop.parcels)) {
      const failed = stop.parcels.every((order) => order.status === "failed");
      stop.state = failed ? "FAILED" : "COMPLETED";
      continue;
    }
    if (navigable && !current && stop.open.length) {
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
  for (let s = 0; s < stops.length - 1; s++) {
    const pA = stops[s].point;
    const pB = stops[s + 1].point;
    if (pA && pB) {
      signalsOnRoute += countTrafficSignalsBetween(pA, pB).count;
      interceptionsOnRoute += countInterceptionPointsBetween(pA, pB).count;
    }
  }

  return {
    state,
    stops,
    current,
    upcoming,
    parcels,
    unacknowledged,
    toLoad,
    onBoard,
    returns: parcels.filter((order) => order.status === "failed"),
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
  const removedParcels = previous.parcels.filter((id) => !after.has(id));
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

export function openStops(route: DriverRoute) {
  return route.stops.filter(
    (stop) => stop.state !== "COMPLETED" && stop.state !== "FAILED",
  );
}
