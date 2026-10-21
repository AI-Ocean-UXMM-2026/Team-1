import type { MapPoint } from "@/lib/delivery/map-projection";

export const PICKUP_DRAFT_KEY = "oern.pickup-draft.v1";

export const pickupDays = ["Today", "Tomorrow"] as const;
export const pickupWindows = [
  { value: "Morning", hours: "8–12" },
  { value: "Afternoon", hours: "12–5" },
  { value: "Evening", hours: "5–8" },
] as const;
export const parcelKinds = [
  "Documents",
  "Clothing",
  "Food",
  "Electronics",
  "Other",
] as const;
export const parcelSizes = [
  { value: "Small", hint: "Fits a bag" },
  { value: "Medium", hint: "Fits a box" },
  { value: "Large", hint: "Bulky" },
] as const;

export type PickupDay = (typeof pickupDays)[number];
export type PickupWindow = (typeof pickupWindows)[number]["value"];
export type ParcelKind = (typeof parcelKinds)[number];
export type ParcelSize = (typeof parcelSizes)[number]["value"];

export type PickupDraft = {
  pickupAddress: string;
  pickupPoint: MapPoint | null;
  contactPhone: string;
  deliveryAddress: string;
  deliveryPoint: MapPoint | null;
  recipientName: string;
  recipientPhone: string;
  parcelKind: ParcelKind | null;
  parcelSize: ParcelSize;
  fragile: boolean;
  parcelDetails: string;
  codAmount: string;
  notes: string;
  day: PickupDay;
  window: PickupWindow;
};

/** The first window that has not already started, rolling to tomorrow after 8 pm. */
export function defaultSchedule(now = new Date()): {
  day: PickupDay;
  window: PickupWindow;
} {
  const hour = now.getHours();
  if (hour < 11) return { day: "Today", window: "Afternoon" };
  if (hour < 16) return { day: "Today", window: "Evening" };
  return { day: "Tomorrow", window: "Morning" };
}

export function emptyDraft(
  schedule: { day: PickupDay; window: PickupWindow } = {
    day: "Today",
    window: "Afternoon",
  },
): PickupDraft {
  return {
    pickupAddress: "",
    pickupPoint: null,
    contactPhone: "",
    deliveryAddress: "",
    deliveryPoint: null,
    recipientName: "",
    recipientPhone: "",
    parcelKind: null,
    parcelSize: "Small",
    fragile: false,
    parcelDetails: "",
    codAmount: "",
    notes: "",
    ...schedule,
  };
}

export function loadDraft(): PickupDraft {
  const fresh = emptyDraft(defaultSchedule());
  if (typeof window === "undefined") return fresh;
  try {
    const raw = window.localStorage.getItem(PICKUP_DRAFT_KEY);
    if (!raw) return fresh;
    return { ...fresh, ...(JSON.parse(raw) as Partial<PickupDraft>) };
  } catch {
    return fresh;
  }
}

export function saveDraft(draft: PickupDraft) {
  try {
    window.localStorage.setItem(PICKUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private browsing: the draft then lives only on this page.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(PICKUP_DRAFT_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/** One line the rider and manager can read: kind, size, handling, then details. */
export function describeParcel(draft: PickupDraft) {
  const head = [
    draft.parcelKind ?? "Parcel",
    `${draft.parcelSize.toLowerCase()} size`,
    draft.fragile ? "fragile" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return [
    head,
    draft.parcelDetails.trim(),
    `Pickup ${draft.day.toLowerCase()}, ${draft.window.toLowerCase()}`,
    draft.notes.trim() && `Note: ${draft.notes.trim()}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Digits-only Myanmar mobile check: 09 or +959 followed by 7–9 digits. */
export function isMyanmarPhone(value: string) {
  const digits = value.replace(/[\s()-]/g, "");
  return /^(\+?95|0)9\d{7,9}$/.test(digits);
}
