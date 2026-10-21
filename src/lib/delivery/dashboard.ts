import type { DeliveryOrder, RoadReport } from "@/lib/delivery/types";

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
) {
  return {
    needsRider: orders.filter(needsRider).length,
    delayed: orders.filter(
      (order) => isActiveOrder(order) && order.traffic_delay_minutes > 0,
    ).length,
    codPending: orders.filter(codPending).length,
    codToSettle: orders.filter(
      (order) => order.cod_amount > 0 && order.cod_status === "collected",
    ).length,
    pendingReports: roadReports.filter((report) => report.status === "pending")
      .length,
  };
}

export function recentOrders(orders: DeliveryOrder[], limit = 8) {
  return [...orders]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, limit);
}
