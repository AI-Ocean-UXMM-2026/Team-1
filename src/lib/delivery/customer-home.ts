import type {
  DeliveryOrder,
  DeliveryStatus,
  StatusEvent,
} from "@/lib/delivery/types";

// Type-only imports keep this module runnable by the node test runner.
/** A parcel the customer is still waiting on, including a fresh pickup request. */
export const ACTIVE_STATUSES: readonly DeliveryStatus[] = [
  "pending",
  "assigned",
  "accepted",
  "picked_up",
  "in_transit",
];
/** A finished delivery: it moves to History and out of live views. */
export const TERMINAL_STATUSES: readonly DeliveryStatus[] = [
  "delivered",
  "failed",
  "cancelled",
];

export function isActiveStatus(status: DeliveryStatus) {
  return ACTIVE_STATUSES.includes(status);
}

export function isTerminalStatus(status: DeliveryStatus) {
  return TERMINAL_STATUSES.includes(status);
}
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "MMK",
  maximumFractionDigits: 0,
});

const MINUTE = 60_000;
const NOTIFICATION_WINDOW_MS = 7 * 24 * 60 * MINUTE;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Yangon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function yangonDay(value: string | number | Date) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? "" : dayFormatter.format(time);
}

const isActive = isActiveStatus;

function isOutForDelivery(status: DeliveryStatus) {
  return status === "picked_up" || status === "in_transit";
}

function latestEventAt(
  orderId: string,
  status: DeliveryStatus,
  events: StatusEvent[],
) {
  let latest: string | null = null;
  for (const event of events) {
    if (event.order_id !== orderId || event.status !== status) continue;
    if (!latest || event.created_at > latest) latest = event.created_at;
  }
  return latest;
}

export function normaliseCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function matchOrders(orders: DeliveryOrder[], query: string) {
  const code = normaliseCode(query);
  if (!code) return [];
  return orders.filter((order) =>
    normaliseCode(order.tracking_code).includes(code),
  );
}

export function progressPercent(order: DeliveryOrder) {
  if (order.status === "delivered") return 100;
  if (order.route_progress_percent != null) return order.route_progress_percent;
  if (order.status === "in_transit") return 72;
  if (order.status === "picked_up") return 56;
  if (order.status === "accepted") return 32;
  return 18;
}

/** One-line, state-aware summary for the greeting. */
export function homeSummary(orders: DeliveryOrder[]) {
  const active = orders.filter((order) => isActive(order.status)).length;
  if (active === 0) return "No deliveries on the way";
  return active === 1
    ? "1 delivery on the way"
    : `${active} deliveries on the way`;
}

export function pickNextParcel(orders: DeliveryOrder[]) {
  const rank: Partial<Record<DeliveryStatus, number>> = {
    in_transit: 0,
    picked_up: 1,
    accepted: 2,
    assigned: 3,
    pending: 4,
  };
  const active = orders.filter((order) => isActive(order.status));
  active.sort((a, b) => {
    const byStatus = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (byStatus) return byStatus;
    const aEta = a.estimated_delivery_at
      ? Date.parse(a.estimated_delivery_at)
      : Number.POSITIVE_INFINITY;
    const bEta = b.estimated_delivery_at
      ? Date.parse(b.estimated_delivery_at)
      : Number.POSITIVE_INFINITY;
    if (aEta === bEta) return 0;
    return aEta < bEta ? -1 : 1;
  });
  return active[0] ?? null;
}

export type TodayState =
  | "missed"
  | "delayed"
  | "arriving"
  | "on_the_way"
  | "scheduled"
  | "delivered";

export type TodayItem = {
  order: DeliveryOrder;
  state: TodayState;
  /** Only set when the ETA system has provided an estimate. */
  etaAt: string | null;
  delayMinutes: number;
};

const todayRank: Record<TodayState, number> = {
  missed: 0,
  delayed: 1,
  arriving: 2,
  on_the_way: 3,
  scheduled: 4,
  delivered: 5,
};

export function describeDelay(order: DeliveryOrder, now: number) {
  const eta = order.estimated_delivery_at
    ? Date.parse(order.estimated_delivery_at)
    : null;
  const overdue = eta !== null && now - eta > 5 * MINUTE;
  const overdueMinutes =
    overdue && eta !== null ? Math.round((now - eta) / MINUTE) : 0;
  const trafficMinutes = order.traffic_delay_minutes ?? 0;
  const isDelayed = overdue || trafficMinutes >= 10;
  return {
    isDelayed,
    minutes: overdue ? overdueMinutes : trafficMinutes,
  };
}

export function buildTodayItems(
  orders: DeliveryOrder[],
  events: StatusEvent[],
  now: number,
): TodayItem[] {
  const today = yangonDay(now);
  const items: TodayItem[] = [];

  for (const order of orders) {
    if (!isActive(order.status)) continue;

    const eta = order.estimated_delivery_at;
    const etaDay = eta ? yangonDay(eta) : "";
    const dueToday = Boolean(eta) && etaDay !== "" && etaDay <= today;
    if (!isOutForDelivery(order.status) && !dueToday) continue;

    const delay = describeDelay(order, now);
    const etaMs = eta ? Date.parse(eta) : null;
    const state: TodayState = delay.isDelayed
      ? "delayed"
      : order.status === "in_transit" &&
          etaMs !== null &&
          etaMs - now <= 5 * MINUTE
        ? "arriving"
        : isOutForDelivery(order.status)
          ? "on_the_way"
          : "scheduled";
    items.push({
      order,
      state,
      etaAt: eta,
      delayMinutes: delay.isDelayed ? delay.minutes : 0,
    });
  }

  return items.sort((a, b) => {
    const byState = todayRank[a.state] - todayRank[b.state];
    if (byState) return byState;
    const aEta = a.etaAt ? Date.parse(a.etaAt) : Number.POSITIVE_INFINITY;
    const bEta = b.etaAt ? Date.parse(b.etaAt) : Number.POSITIVE_INFINITY;
    if (aEta === bEta) return 0;
    return aEta < bEta ? -1 : 1;
  });
}

/**
 * When a finished delivery ended: its newest terminal status event, falling
 * back to the order's own timestamp when no event was recorded.
 */
export function terminalAt(order: DeliveryOrder, events: StatusEvent[]) {
  let latest: string | null = null;
  for (const event of events) {
    if (event.order_id !== order.id || event.status !== order.status) continue;
    if (!latest || event.created_at > latest) latest = event.created_at;
  }
  return latest ?? order.created_at;
}

/** Splits orders into what is still live and what is finished, newest first. */
export function splitOrders(orders: DeliveryOrder[], events: StatusEvent[]) {
  const active = orders.filter((order) => isActive(order.status));
  const history = orders
    .filter((order) => isTerminalStatus(order.status))
    .map((order) => ({ order, endedAt: terminalAt(order, events) }))
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  return { active, history };
}

export type OrdersTab = "active" | "history";
export type HistoryOutcome = "all" | "delivered" | "failed" | "cancelled";
export type OrdersQuery = {
  tab: OrdersTab;
  q: string;
  outcome: HistoryOutcome;
};

const OUTCOMES: readonly HistoryOutcome[] = [
  "all",
  "delivered",
  "failed",
  "cancelled",
];

/** Reads the Orders screen state from the URL, ignoring anything unexpected. */
export function parseOrdersQuery(params: {
  get(name: string): string | null;
}): OrdersQuery {
  const outcome = params.get("outcome") as HistoryOutcome | null;
  return {
    tab: params.get("tab") === "history" ? "history" : "active",
    q: (params.get("q") ?? "").slice(0, 80),
    outcome: outcome && OUTCOMES.includes(outcome) ? outcome : "all",
  };
}

/** The URL for an Orders state; defaults are left out so links stay short. */
export function ordersHref(query: Partial<OrdersQuery>) {
  const params = new URLSearchParams();
  if (query.tab === "history") params.set("tab", "history");
  const q = query.q?.trim();
  if (q) params.set("q", q);
  if (query.tab === "history" && query.outcome && query.outcome !== "all")
    params.set("outcome", query.outcome);
  const text = params.toString();
  return text ? `/orders?${text}` : "/orders";
}

/** Whether an order matches free-text search over code, address and name. */
export function orderMatchesQuery(order: DeliveryOrder, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const code = normaliseCode(needle);
  return (
    (code !== "" && normaliseCode(order.tracking_code).includes(code)) ||
    [order.delivery_address, order.pickup_address, order.recipient_name]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(needle))
  );
}

export type NotificationKind =
  | "missed"
  | "cod_due"
  | "arriving"
  | "out_for_delivery"
  | "collected"
  | "assigned"
  | "delivered";

export type CustomerNotification = {
  id: string;
  orderId: string;
  trackingCode: string;
  kind: NotificationKind;
  priority: "high" | "normal";
  title: string;
  body: string;
  at: string;
};

export function buildNotifications(
  orders: DeliveryOrder[],
  events: StatusEvent[],
  now: number,
): CustomerNotification[] {
  const list: CustomerNotification[] = [];

  for (const order of orders) {
    const at =
      latestEventAt(order.id, order.status, events) ?? order.created_at;
    if (now - Date.parse(at) > NOTIFICATION_WINDOW_MS) continue;
    const base = {
      orderId: order.id,
      trackingCode: order.tracking_code,
      at,
    };

    if (order.status === "failed") {
      list.push({
        ...base,
        id: `${order.id}:missed`,
        kind: "missed",
        priority: "high",
        title: "Delivery attempt missed",
        body: `${order.tracking_code} could not be delivered. Open it to see the latest status.`,
      });
    }

    if (order.status === "in_transit") {
      const eta = order.estimated_delivery_at
        ? Date.parse(order.estimated_delivery_at)
        : null;
      // "Arriving" only while the estimate is imminent, never when overdue.
      const arriving = eta !== null && Math.abs(eta - now) <= 5 * MINUTE;
      const late = eta !== null && now - eta > 5 * MINUTE;
      list.push({
        ...base,
        id: `${order.id}:${arriving ? "arriving" : "out_for_delivery"}`,
        kind: arriving ? "arriving" : "out_for_delivery",
        priority: "high",
        title: arriving ? "Your rider is arriving" : "Out for delivery",
        body: arriving
          ? `${order.tracking_code} should reach you any moment.`
          : late
            ? `${order.tracking_code} is on its way but running later than estimated.`
            : `${order.tracking_code} is on its way to you.`,
      });
    }

    if (
      order.cod_amount > 0 &&
      order.cod_status === "pending" &&
      isOutForDelivery(order.status)
    ) {
      list.push({
        ...base,
        id: `${order.id}:cod_due`,
        kind: "cod_due",
        priority: "high",
        title: "Cash on delivery due",
        body: `Have ${currency.format(order.cod_amount)} ready for ${order.tracking_code}.`,
      });
    }

    if (order.status === "picked_up") {
      list.push({
        ...base,
        id: `${order.id}:collected`,
        kind: "collected",
        priority: "normal",
        title: "Parcel collected",
        body: `${order.tracking_code} is with your rider.`,
      });
    }

    if (order.status === "assigned" || order.status === "accepted") {
      list.push({
        ...base,
        id: `${order.id}:assigned`,
        kind: "assigned",
        priority: "normal",
        title:
          order.status === "accepted" ? "Rider accepted" : "Rider assigned",
        body: `${order.tracking_code} is being prepared for pickup.`,
      });
    }

    if (order.status === "delivered") {
      list.push({
        ...base,
        id: `${order.id}:delivered`,
        kind: "delivered",
        priority: "normal",
        title: "Delivered",
        body: `${order.tracking_code} has arrived.`,
      });
    }
  }

  return list.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    return b.at.localeCompare(a.at);
  });
}

export type ContextAction =
  | { id: "cod"; label: string; detail: string; orderId: string }
  | { id: "share"; label: string; detail: string; orderId: string }
  | { id: "driver"; label: string; detail: string; phone: string };

export function contextualActions(
  order: DeliveryOrder | null,
): ContextAction[] {
  if (!order || !isActive(order.status)) return [];
  const actions: ContextAction[] = [];
  if (order.cod_amount > 0 && order.cod_status === "pending") {
    actions.push({
      id: "cod",
      label: "COD payment due",
      detail: currency.format(order.cod_amount),
      orderId: order.id,
    });
  }
  if (isOutForDelivery(order.status)) {
    actions.push({
      id: "share",
      label: "Share tracking",
      detail: order.tracking_code,
      orderId: order.id,
    });
  }
  if (order.driver_id && order.driver_phone) {
    actions.push({
      id: "driver",
      label: "Contact driver",
      detail: order.driver_name ?? "Your rider",
      phone: order.driver_phone,
    });
  }
  return actions;
}

/** Parcels that still need cash paid to the rider, out-for-delivery first. */
export function codDue(orders: DeliveryOrder[]) {
  const rank: Partial<Record<DeliveryStatus, number>> = {
    in_transit: 0,
    picked_up: 1,
    accepted: 2,
    assigned: 3,
    pending: 4,
  };
  return orders
    .filter(
      (order) =>
        order.cod_amount > 0 &&
        order.cod_status === "pending" &&
        rank[order.status] !== undefined,
    )
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
}

export const RECENT_CODE_LIMIT = 5;
const RECENT_KEY = "oern.recent-tracking-codes";

/** Pure helper: puts a code first, drops duplicates, keeps the newest few. */
export function pushRecent(list: string[], code: string) {
  const clean = code.trim();
  if (!normaliseCode(clean)) return list.slice(0, RECENT_CODE_LIMIT);
  return [
    clean,
    ...list.filter((item) => normaliseCode(item) !== normaliseCode(clean)),
  ].slice(0, RECENT_CODE_LIMIT);
}

/** Per-browser convenience only; storage can be blocked, so every access is guarded. */
export function readRecentCodes(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, RECENT_CODE_LIMIT);
  } catch {
    return [];
  }
}

export function rememberTrackingCode(code: string) {
  try {
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(pushRecent(readRecentCodes(), code)),
    );
  } catch {
    // Nothing to persist; recents simply won't appear.
  }
}
