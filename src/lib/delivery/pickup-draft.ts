import type { MapPoint } from "@/lib/delivery/map-projection";

export const PICKUP_DRAFT_KEY = "oern.pickup-draft.v1";

export const pickupDays = ["Today", "Tomorrow"] as const;
/** `startHour`/`endHour` are Yangon local time and match the database's windows. */
export const pickupWindows = [
  { value: "Morning", hours: "8–12", startHour: 8, endHour: 12 },
  { value: "Afternoon", hours: "12–5", startHour: 12, endHour: 17 },
  { value: "Evening", hours: "5–8", startHour: 17, endHour: 20 },
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

export const foodPresets = [
  {
    label: "Hot Soup & Mohinga",
    details: "Hot soup & mohinga noodles (thermal bag required)",
    size: "Small" as const,
    fragile: false,
  },
  {
    label: "Tea Shop & Snacks",
    details: "Tea shop snacks & steamed buns (pauksi)",
    size: "Small" as const,
    fragile: false,
  },
  {
    label: "Shan Noodles / Meeshay",
    details: "Shan khauk swé & crispy tofu packs",
    size: "Small" as const,
    fragile: false,
  },
  {
    label: "Bakery / Cake",
    details: "Fresh bakery cake & pastries box (keep level)",
    size: "Medium" as const,
    fragile: true,
  },
  {
    label: "Hot Curry Meal Box",
    details: "Burmese curry set with rice & side soup",
    size: "Medium" as const,
    fragile: false,
  },
  {
    label: "Groceries & Fresh Produce",
    details: "Fresh vegetables, eggs & grocery essentials carton",
    size: "Large" as const,
    fragile: false,
  },
  {
    label: "Boba & Cold Drinks",
    details: "Chilled beverages & milk tea in cup carrier",
    size: "Small" as const,
    fragile: true,
  },
] as const;

export type FoodPreset = (typeof foodPresets)[number];

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

/** Hour of day (0-23.99) in Yangon, UTC+6:30, whatever the device's own zone. */
export function yangonHour(now: Date | number = new Date()) {
  const ms = typeof now === "number" ? now : now.getTime();
  const minutes = Math.floor(ms / 60_000) + 6 * 60 + 30;
  return (((minutes % 1440) + 1440) % 1440) / 60;
}

/**
 * Windows still open for a day: every window tomorrow, and today only those
 * that have not ended in Yangon time.
 */
export function availableWindows(
  day: PickupDay,
  now: Date | number = new Date(),
) {
  if (day === "Tomorrow") return [...pickupWindows];
  const hour = yangonHour(now);
  return pickupWindows.filter((window) => window.endHour > hour);
}

/** The next window a rider can still make; tomorrow morning once today is over. */
export function defaultSchedule(now: Date | number = new Date()): {
  day: PickupDay;
  window: PickupWindow;
} {
  const next = availableWindows("Today", now)[0];
  return next
    ? { day: "Today", window: next.value }
    : { day: "Tomorrow", window: "Morning" };
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

const text = (value: unknown, max = 500) =>
  typeof value === "string" ? value.slice(0, max) : "";

function cleanPoint(value: unknown): MapPoint | null {
  if (!value || typeof value !== "object") return null;
  const { latitude, longitude } = value as Record<string, unknown>;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return { latitude, longitude };
}

/** Accepts only the shape this module writes, so stored junk can't break a form. */
export function sanitizeDraft(raw: unknown, fresh: PickupDraft): PickupDraft {
  if (!raw || typeof raw !== "object") return fresh;
  const r = raw as Record<string, unknown>;
  const day = pickupDays.find((item) => item === r.day) ?? fresh.day;
  const window = pickupWindows.find((item) => item.value === r.window)?.value;
  return {
    pickupAddress: text(r.pickupAddress, 300),
    pickupPoint: cleanPoint(r.pickupPoint),
    contactPhone: text(r.contactPhone, 30),
    deliveryAddress: text(r.deliveryAddress, 300),
    deliveryPoint: cleanPoint(r.deliveryPoint),
    recipientName: text(r.recipientName, 120),
    recipientPhone: text(r.recipientPhone, 30),
    parcelKind: parcelKinds.find((item) => item === r.parcelKind) ?? null,
    parcelSize:
      parcelSizes.find((item) => item.value === r.parcelSize)?.value ??
      fresh.parcelSize,
    fragile: r.fragile === true,
    parcelDetails: text(r.parcelDetails, 300),
    codAmount: text(r.codAmount, 12),
    notes: text(r.notes, 300),
    day,
    window: window ?? fresh.window,
  };
}

export function loadDraft(now: Date | number = new Date()): PickupDraft {
  const fresh = emptyDraft(defaultSchedule(now));
  if (typeof window === "undefined") return fresh;
  try {
    const raw = window.localStorage.getItem(PICKUP_DRAFT_KEY);
    if (!raw) return fresh;
    const draft = sanitizeDraft(JSON.parse(raw), fresh);
    // A saved "this afternoon" is wrong by evening: move to the next open slot.
    return availableWindows(draft.day, now).some(
      (w) => w.value === draft.window,
    )
      ? draft
      : { ...draft, ...defaultSchedule(now) };
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

/** COD in whole kyat: blank means none, anything else must be a sensible integer. */
export function parseCod(input: string): number | null {
  const value = input.replace(/[,\s]/g, "");
  if (value === "") return 0;
  if (!/^\d{1,9}$/.test(value)) return null;
  const amount = Number(value);
  return amount <= 50_000_000 ? amount : null;
}

export type PickupErrors = Partial<
  Record<
    | "pickupAddress"
    | "deliveryAddress"
    | "recipientName"
    | "recipientPhone"
    | "contactPhone"
    | "codAmount"
    | "window",
    string
  >
>;

/** Step 1: both addresses. */
export function validateAddresses(draft: PickupDraft): PickupErrors {
  const errors: PickupErrors = {};
  if (!draft.pickupAddress.trim())
    errors.pickupAddress = "Add the pickup address or choose it on the map.";
  if (!draft.deliveryAddress.trim())
    errors.deliveryAddress = "Add the delivery address.";
  return errors;
}

/** Step 2: who receives it, when to collect, and any optional numbers. */
export function validateDetails(
  draft: PickupDraft,
  now: Date | number = new Date(),
): PickupErrors {
  const errors: PickupErrors = {};
  if (!draft.recipientName.trim())
    errors.recipientName = "Add the recipient’s name.";
  if (!draft.recipientPhone.trim())
    errors.recipientPhone = "Add the recipient’s phone number.";
  else if (!isMyanmarPhone(draft.recipientPhone))
    errors.recipientPhone = "Use a Myanmar mobile number, like 09 421 555 018.";
  if (draft.contactPhone.trim() && !isMyanmarPhone(draft.contactPhone))
    errors.contactPhone = "Use a Myanmar mobile number, like 09 421 555 018.";
  if (parseCod(draft.codAmount) === null)
    errors.codAmount = "Enter the amount in whole kyat, like 25000.";
  if (!availableWindows(draft.day, now).some((w) => w.value === draft.window))
    errors.window = "That pickup time has passed. Choose another.";
  return errors;
}
