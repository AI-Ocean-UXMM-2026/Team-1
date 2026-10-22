import { formatDateTime, LATE_AFTER_MINUTES, timeUntil } from "./format.ts";
import {
  hasCollectedParcel,
  isRecentLocation,
  parcelLocationState,
} from "./location-state.ts";
import type { DeliveryOrder, StatusEvent } from "./types.ts";

export type TrackTone = "info" | "warning" | "error" | "success" | "neutral";

export type LocationNotice = {
  kind:
    | "live"
    | "between"
    | "stale"
    | "none"
    | "before_pickup"
    | "ended"
    | "stopped";
  title: string;
  body: string;
  tone: TrackTone;
};

export type TrackingView = {
  /** Which kind of screen to lead with. */
  stage: "preparing" | "on_the_way" | "delivered" | "stopped";
  headline: string;
  detail: string;
  /** Past its estimate, or flagged as delayed by traffic. */
  delayed: boolean;
  location: LocationNotice;
  /** The one action that helps most right now. */
  primaryAction: "track" | "call" | "help";
};

function latest(order: DeliveryOrder, events: StatusEvent[]) {
  return (
    events
      .filter((e) => e.order_id === order.id && e.status === order.status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/**
 * Everything the tracking screen says about a parcel, decided in one place so
 * stale GPS, a missing location, a delay and a failure each get their own
 * explanation and next step.
 */
export function describeTracking(
  order: DeliveryOrder,
  events: StatusEvent[],
  now: number,
): TrackingView {
  if (order.status === "delivered") {
    const at = latest(order, events)?.created_at ?? null;
    return {
      stage: "delivered",
      headline: "Delivered",
      detail: at ? `Delivered ${formatDateTime(at)}` : "Delivery confirmed",
      delayed: false,
      location: {
        kind: "ended",
        title: "Location sharing has ended",
        body: "The delivery record stays here.",
        tone: "neutral",
      },
      primaryAction: "help",
    };
  }

  if (order.status === "failed" || order.status === "cancelled") {
    const event = latest(order, events);
    const failed = order.status === "failed";
    return {
      stage: "stopped",
      headline: failed ? "Delivery issue" : "Delivery cancelled",
      detail: [
        event ? formatDateTime(event.created_at) : null,
        event?.note ??
          (failed
            ? "The rider couldn’t complete this delivery."
            : "This delivery was cancelled."),
      ]
        .filter(Boolean)
        .join(" · "),
      delayed: false,
      location: {
        kind: "stopped",
        title: "Tracking has stopped",
        body: "Get help and we’ll sort out what happens next.",
        tone: "error",
      },
      primaryAction: "help",
    };
  }

  if (!hasCollectedParcel(order.status)) {
    const hasRider = order.status === "accepted" || order.status === "assigned";
    return {
      stage: "preparing",
      headline:
        order.status === "pending" ? "Finding a rider" : "Waiting for pickup",
      detail: hasRider
        ? `${order.driver_name ?? "A rider"} is assigned and will collect your parcel.`
        : "We’re matching your parcel with a rider.",
      delayed: false,
      location: {
        kind: "before_pickup",
        title: "Live location starts at pickup",
        body: "You’ll see your rider on the map once they have the parcel.",
        tone: "neutral",
      },
      primaryAction: "track",
    };
  }

  const until = timeUntil(order.estimated_delivery_at, now);
  const overdue = until === "Running late";
  const delayed = overdue || order.traffic_delay_minutes > 0;
  const headline = overdue
    ? "Running late"
    : until === "Arriving now"
      ? until
      : `Arriving in ${until}`;
  const estimate = order.estimated_delivery_at
    ? formatDateTime(order.estimated_delivery_at)
    : null;
  const detail = overdue
    ? `Was estimated around ${estimate}. Your rider is still on the way.`
    : estimate
      ? `Estimated around ${estimate}${
          order.traffic_delay_minutes > 0
            ? ` · traffic adds about ${order.traffic_delay_minutes} min`
            : ""
        }`
      : "An arrival estimate is being worked out.";

  const state = parcelLocationState(order, now);
  const minutes = order.latest_location
    ? Math.max(
        1,
        Math.round(
          (now - Date.parse(order.latest_location.recorded_at)) / 60_000,
        ),
      )
    : 0;
  const location: LocationNotice =
    state === "live"
      ? {
          kind: "live",
          title: "Live location",
          body: "The map updates automatically while your rider keeps their app open.",
          tone: "info",
        }
      : state === "stale" && isRecentLocation(order, now)
        ? {
            kind: "between",
            title: "Your rider’s latest location",
            body: "The map refreshes on its own every few seconds.",
            tone: "info",
          }
        : state === "stale"
          ? {
              kind: "stale",
              title: `No new location for ${minutes} min`,
              body: "Showing the last known position. Your rider may have lost connection; call them if you’re worried.",
              tone: "warning",
            }
          : {
              kind: "none",
              title: "Waiting for your rider’s first location",
              body: "Your parcel is collected. The map updates when your rider shares a GPS point.",
              tone: "neutral",
            };

  const slowLocation = location.kind === "stale" || location.kind === "none";
  return {
    stage: "on_the_way",
    headline,
    detail,
    delayed,
    location,
    primaryAction:
      (delayed || slowLocation) && order.driver_phone
        ? "call"
        : delayed
          ? "help"
          : "track",
  };
}

export { LATE_AFTER_MINUTES };
