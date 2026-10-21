import type {
  DeliveryOrder,
  RiderRequest,
  RoadReport,
  StatusEvent,
} from "@/lib/delivery/types";
import { parcelLocationState } from "./location-state.ts";

const activeStatuses = ["assigned", "accepted", "picked_up", "in_transit"];
const movingStatuses = ["picked_up", "in_transit"];
const HOUR_MS = 3_600_000;

export function isActiveOrder(order: DeliveryOrder) {
  return activeStatuses.includes(order.status);
}

export function isMovingOrder(order: DeliveryOrder) {
  return movingStatuses.includes(order.status);
}

export function needsRider(order: DeliveryOrder) {
  return (
    ["pending", "failed"].includes(order.status) ||
    (!order.driver_id && ["assigned", "accepted"].includes(order.status))
  );
}

/** Cash still owed by the recipient or not yet handed over by the rider. */
export function codPending(order: DeliveryOrder) {
  return order.cod_amount > 0 && order.cod_status === "pending";
}

export function codToSettle(order: DeliveryOrder) {
  return order.cod_amount > 0 && order.cod_status === "collected";
}

export function deliveredToday(
  event: Pick<StatusEvent, "status" | "created_at">,
  now = Date.now(),
) {
  if (event.status !== "delivered") return false;
  const created = new Date(event.created_at);
  const today = new Date(now);
  return (
    Number.isFinite(created.getTime()) &&
    created.getFullYear() === today.getFullYear() &&
    created.getMonth() === today.getMonth() &&
    created.getDate() === today.getDate()
  );
}

export function hourlyBuckets(
  orders: DeliveryOrder[],
  hours = 12,
  now = Date.now(),
) {
  const buckets = Array.from({ length: hours }, () => 0);
  for (const order of orders) {
    const age = now - Date.parse(order.created_at);
    if (!Number.isFinite(age) || age < 0) continue;
    const hoursAgo = Math.floor(age / HOUR_MS);
    if (hoursAgo < hours) buckets[hours - 1 - hoursAgo] += 1;
  }
  return buckets;
}

export function attentionSummary(
  orders: DeliveryOrder[],
  roadReports: RoadReport[],
  now = Date.now(),
  statusEvents: StatusEvent[] = [],
) {
  const onRoute = orders.filter(isMovingOrder);
  const gpsLive = onRoute.filter(
    (order) => parcelLocationState(order, now) === "live",
  );
  const staleLocations = onRoute.filter(
    (order) => parcelLocationState(order, now) !== "live",
  );
  const pendingCod = orders.filter(codPending);
  const unsettledCod = orders.filter(codToSettle);
  return {
    needsRider: orders.filter(needsRider).length,
    delayed: orders.filter(
      (order) => isActiveOrder(order) && order.traffic_delay_minutes > 0,
    ).length,
    codPending: pendingCod.length,
    codPendingTotal: pendingCod.reduce(
      (total, order) => total + order.cod_amount,
      0,
    ),
    codToSettle: unsettledCod.length,
    codToSettleTotal: unsettledCod.reduce(
      (total, order) => total + order.cod_amount,
      0,
    ),
    deliveredToday: new Set(
      statusEvents
        .filter((event) => deliveredToday(event, now))
        .map((event) => event.order_id),
    ).size,
    gpsLive: gpsLive.length,
    staleLocations: staleLocations.length,
    pendingReports: roadReports.filter((report) => report.status === "pending")
      .length,
  };
}

export type ManagerException = {
  id: string;
  tone: "critical" | "warning" | "info";
  title: string;
  detail: string;
  meta: string;
  href: string;
  priority: number;
};

function minutesSince(value: string | null | undefined, now: number) {
  if (!value) return null;
  const age = Math.floor((now - Date.parse(value)) / 60_000);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

function ageText(minutes: number | null) {
  if (minutes == null) return "Time unknown";
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

export function managerExceptions(
  orders: DeliveryOrder[],
  riderRequests: RiderRequest[],
  now = Date.now(),
  limit = 5,
) {
  const exceptions: ManagerException[] = [];

  for (const order of orders) {
    if (isMovingOrder(order) && parcelLocationState(order, now) !== "live") {
      exceptions.push({
        id: `location-${order.id}`,
        tone: "critical",
        title: `${order.tracking_code} location is stale`,
        detail: order.driver_name ?? "Assigned rider",
        meta: order.latest_location
          ? `Last GPS ${ageText(minutesSince(order.latest_location.recorded_at, now)).toLowerCase()}`
          : "No GPS update",
        href: `/manager/track?id=${order.id}`,
        priority: 0,
      });
    }
    if (isActiveOrder(order) && order.traffic_delay_minutes > 0) {
      exceptions.push({
        id: `delay-${order.id}`,
        tone: order.traffic_delay_minutes >= 30 ? "critical" : "warning",
        title: `${order.tracking_code} is delayed`,
        detail: order.driver_name ?? "Assigned rider",
        meta: `${order.traffic_delay_minutes} min delay`,
        href: `/manager/track?id=${order.id}`,
        priority: order.traffic_delay_minutes >= 30 ? 1 : 3,
      });
    }
    if (needsRider(order)) {
      exceptions.push({
        id: `rider-${order.id}`,
        tone: order.status === "failed" ? "critical" : "warning",
        title:
          order.status === "failed"
            ? `${order.tracking_code} needs reassignment`
            : `${order.tracking_code} needs a rider`,
        detail: order.customer_name,
        meta: ageText(minutesSince(order.created_at, now)),
        href: `/manager/order?filter=unassigned&id=${order.id}`,
        priority: order.status === "failed" ? 1 : 4,
      });
    }
    if (codToSettle(order)) {
      exceptions.push({
        id: `cod-${order.id}`,
        tone: "warning",
        title: `${order.tracking_code} cash needs settlement`,
        detail: order.driver_name ?? "Rider not recorded",
        meta: `${order.cod_amount.toLocaleString()} MMK collected`,
        href: "/manager/cod",
        priority: 2,
      });
    }
  }

  for (const request of riderRequests) {
    if (request.status === "resolved") continue;
    const critical = ["accident", "unsafe_area", "parcel_damaged"].includes(
      request.category,
    );
    exceptions.push({
      id: `request-${request.id}`,
      tone: critical ? "critical" : "info",
      title: `${request.driver_name} needs help`,
      detail: request.note || request.category.replaceAll("_", " "),
      meta: ageText(minutesSince(request.created_at, now)),
      href: "/manager/track#rider-requests",
      priority: critical ? 0 : 3,
    });
  }

  return exceptions
    .sort((left, right) => left.priority - right.priority)
    .slice(0, limit);
}

export function recentOrders(orders: DeliveryOrder[], limit = 8) {
  return [...orders]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, limit);
}
