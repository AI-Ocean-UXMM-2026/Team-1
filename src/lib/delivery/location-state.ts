import type { DeliveryOrder, DeliveryStatus } from "@/lib/delivery/types";

export const LIVE_LOCATION_MAX_AGE_MS = 60_000;

export function hasCollectedParcel(status: DeliveryStatus) {
  return status === "picked_up" || status === "in_transit";
}

export function canShowParcelLocation(status: DeliveryStatus) {
  return (
    hasCollectedParcel(status) ||
    status === "delivered" ||
    status === "failed" ||
    status === "cancelled"
  );
}

export function parcelLocationState(
  order: Pick<DeliveryOrder, "status" | "latest_location"> | null,
  now: number,
) {
  if (!order) return "waiting" as const;
  if (!hasCollectedParcel(order.status)) {
    return canShowParcelLocation(order.status)
      ? ("closed" as const)
      : ("waiting" as const);
  }
  const recordedAt = order.latest_location?.recorded_at;
  if (!recordedAt) return "waiting" as const;
  const age = now - Date.parse(recordedAt);
  return Number.isFinite(age) &&
    age >= -30_000 &&
    age <= LIVE_LOCATION_MAX_AGE_MS
    ? ("live" as const)
    : ("stale" as const);
}
