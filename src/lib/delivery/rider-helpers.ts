import type { RouteSnapshot } from "@/lib/delivery/driver-route";
import type { GeoPoint } from "@/lib/delivery/rider-route";
import type {
  DeliveryOrder,
  RouteStop,
  StatusEvent,
  WorkspaceData,
} from "@/lib/delivery/types";

export type DevicePosition = GeoPoint & {
  heading: number | null;
  /** Ground speed in km/h from the device, when it reports one. */
  speedKmh: number | null;
  accuracy: number | null;
  at: number;
};

/** What the driver last saw of the route, so dispatcher changes can be shown. */
export type Acknowledged = {
  snapshot: RouteSnapshot;
  current: string | null;
  finishBy: string | null;
};

export const STALE_AFTER_MS = 60_000;
export const ARRIVAL_RADIUS_KM = 0.08;
export const ALLOW_PREVIEW = process.env.NODE_ENV !== "production";

/** Orders, stops and events of a sample job, which only exist on this phone. */
export type LocalJobData = {
  orders: DeliveryOrder[];
  routeStops: RouteStop[];
  statusEvents: StatusEvent[];
};

export const EMPTY_LOCAL_JOB: LocalJobData = {
  orders: [],
  routeStops: [],
  statusEvents: [],
};

// createOrdersForJob names every sample parcel "job-…".
export const isLocalJobId = (id: string) => id.startsWith("job-");

export function withLocalJob(
  data: WorkspaceData,
  local: LocalJobData,
): WorkspaceData {
  return {
    ...data,
    orders: [
      ...data.orders.filter((order) => !isLocalJobId(order.id)),
      ...local.orders,
    ],
    routeStops: [
      ...data.routeStops.filter((stop) => !isLocalJobId(stop.order_id)),
      ...local.routeStops,
    ],
    statusEvents: [
      ...data.statusEvents.filter((event) => !isLocalJobId(event.order_id)),
      ...local.statusEvents,
    ],
  };
}

export function pickLocalJob(data: WorkspaceData): LocalJobData {
  return {
    orders: data.orders.filter((order) => isLocalJobId(order.id)),
    routeStops: data.routeStops.filter((stop) => isLocalJobId(stop.order_id)),
    statusEvents: data.statusEvents.filter((event) =>
      isLocalJobId(event.order_id),
    ),
  };
}

/** Where the current job starts within the day's shift. */
export type JobMark = { hidden: string[]; awaitingStart: boolean };
export const EMPTY_JOB_MARK: JobMark = { hidden: [], awaitingStart: false };

export function friendlyError(cause: unknown, fallback: string) {
  if (cause instanceof TypeError || /fetch|network/i.test(String(cause)))
    return "Couldn’t reach the server. Nothing was lost — your entries are kept. Try again.";
  return cause instanceof Error ? cause.message : fallback;
}

export function yangonDate(now: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Yangon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
