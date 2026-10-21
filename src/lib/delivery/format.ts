import type { DeliveryOrder, DeliveryStatus } from "@/lib/delivery/types";

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "MMK",
  maximumFractionDigits: 0,
});

export function formatTime(value: string | null) {
  if (!value) return "Being arranged";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Yangon",
  }).format(d);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Yangon",
  }).format(d);
}

export function timeUntil(value: string | null) {
  if (!value) return "Soon";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Soon";
  const minutes = Math.max(0, Math.round((d.getTime() - Date.now()) / 60_000));
  if (minutes < 1) return "Arriving now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function isLiveStatus(status: DeliveryStatus) {
  return status === "picked_up" || status === "in_transit";
}

export function nextCustomerAction(status: DeliveryStatus, delayed = false) {
  if (status === "failed" || status === "cancelled") return "Get help";
  if (status === "delivered") return "View delivery details";
  if (delayed) return "View delay";
  if (status === "picked_up" || status === "in_transit") return "Track live";
  if (status === "assigned") return "See rider details";
  return "View order";
}

export function relativeUpdatedAt(value: string | null, now = Date.now()) {
  if (!value) return "Not updated yet";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not updated yet";
  const minutes = Math.max(0, Math.round((now - d.getTime()) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes === 1) return "Updated 1 min ago";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  return `Updated ${Math.round(minutes / 60)} hr ago`;
}

export function statusTone(status: DeliveryStatus) {
  if (status === "delivered") return "status-success";
  if (status === "failed" || status === "cancelled") return "status-danger";
  if (status === "in_transit" || status === "picked_up") return "status-live";
  if (status === "accepted" || status === "assigned") return "status-warm";
  return "status-muted";
}

export function prioritiseOrders(orders: DeliveryOrder[]) {
  const rank: Record<DeliveryStatus, number> = {
    in_transit: 0,
    picked_up: 1,
    accepted: 2,
    assigned: 3,
    pending: 4,
    failed: 5,
    delivered: 6,
    cancelled: 7,
  };
  return [...orders].sort((a, b) => rank[a.status] - rank[b.status]);
}

/** Database enums ("in_progress", "high") as interface labels ("In progress"). */
export function sentenceCase(value: string) {
  const text = value.replaceAll("_", " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
