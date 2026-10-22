import {
  canShowParcelLocation,
  hasCollectedParcel,
} from "@/lib/delivery/location-state";
import type { GeoPoint } from "@/lib/delivery/rider-route";
import type { DeliveryOrder } from "@/lib/delivery/types";

export type DispatchRow = {
  order: DeliveryOrder;
  rider: GeoPoint;
  destination: GeoPoint | null;
};

/**
 * One marker row per order with a shareable location. In manager mode each
 * driver keeps a single row: the selected order's, otherwise the newest.
 */
export function dispatchRows(
  sourceOrders: DeliveryOrder[],
  mode: "customer" | "rider" | "manager",
  selected: DeliveryOrder | null,
): DispatchRow[] {
  const candidates = sourceOrders.flatMap((item): DispatchRow[] => {
    const latestLocation = item.latest_location;
    if (!latestLocation || !canShowParcelLocation(item.status)) return [];
    return [
      {
        order: item,
        rider: {
          latitude: latestLocation.latitude,
          longitude: latestLocation.longitude,
        },
        destination:
          item.delivery_latitude != null && item.delivery_longitude != null
            ? {
                latitude: item.delivery_latitude,
                longitude: item.delivery_longitude,
              }
            : null,
      },
    ];
  });
  if (mode !== "manager") return candidates;

  const byDriver = candidates.reduce((rows, row) => {
    const key = row.order.driver_id ?? row.order.id;
    const previous = rows.get(key);
    if (
      !previous ||
      row.order.id === selected?.id ||
      (previous.order.id !== selected?.id &&
        (row.order.latest_location?.recorded_at ?? "") >
          (previous.order.latest_location?.recorded_at ?? ""))
    )
      rows.set(key, row);
    return rows;
  }, new Map<string, DispatchRow>());
  return Array.from(byDriver.values());
}

export function latestRecordedAt(
  orders: DeliveryOrder[],
  fallback: string | null,
) {
  return orders.reduce<string | null>((latest, item) => {
    const current = item.latest_location?.recorded_at;
    return current && (!latest || current > latest) ? current : latest;
  }, fallback);
}

export function locationStatusText({
  isDemo,
  latestTimestamp,
  now,
  order,
}: {
  isDemo: boolean;
  latestTimestamp: string | null;
  now: number;
  order: DeliveryOrder | null;
}) {
  if (isDemo) return "Simulated location";
  if (!latestTimestamp) {
    return order && hasCollectedParcel(order.status)
      ? "Waiting for GPS"
      : "Available after pickup";
  }
  const parsed = new Date(latestTimestamp).getTime();
  if (Number.isNaN(parsed)) return "Location unknown";
  const locationTime = Math.max(0, Math.floor((now - parsed) / 60_000));
  return locationTime < 1 ? "Just updated" : `Updated ${locationTime}m ago`;
}
