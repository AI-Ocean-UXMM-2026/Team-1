import { isPaymentMethod, type PaymentMethod } from "./payment-methods.ts";

export const BUSINESS_PROFILE_KEY = "oern.business-profile.v1";
export const MAX_PICKUP_LOCATIONS = 8;

export type PickupLocation = {
  id: string;
  label: string;
  address: string;
  contactName: string;
  contactPhone: string;
};

export type BusinessProfile = {
  name: string;
  phone: string;
  defaultPayment: PaymentMethod;
  pickupLocations: PickupLocation[];
};

export const emptyBusinessProfile = (): BusinessProfile => ({
  name: "",
  phone: "",
  defaultPayment: "cod",
  pickupLocations: [],
});

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Accepts only the shape this module writes, so stored junk can't break the page. */
export function sanitizeBusinessProfile(raw: unknown): BusinessProfile {
  if (!raw || typeof raw !== "object") return emptyBusinessProfile();
  const r = raw as Record<string, unknown>;
  const locations = Array.isArray(r.pickupLocations) ? r.pickupLocations : [];
  const seen = new Set<string>();
  const pickupLocations: PickupLocation[] = [];
  for (const item of locations) {
    if (!item || typeof item !== "object") continue;
    const l = item as Record<string, unknown>;
    const id = text(l.id, 40);
    const address = text(l.address, 300);
    if (!id || !address || seen.has(id)) continue;
    seen.add(id);
    pickupLocations.push({
      id,
      address,
      label: text(l.label, 60) || address.slice(0, 60),
      contactName: text(l.contactName, 120),
      contactPhone: text(l.contactPhone, 30),
    });
    if (pickupLocations.length >= MAX_PICKUP_LOCATIONS) break;
  }
  return {
    name: text(r.name, 120),
    phone: text(r.phone, 30),
    defaultPayment: isPaymentMethod(r.defaultPayment)
      ? r.defaultPayment
      : "cod",
    pickupLocations,
  };
}

export function loadBusinessProfile(): BusinessProfile {
  if (typeof window === "undefined") return emptyBusinessProfile();
  try {
    const raw = window.localStorage.getItem(BUSINESS_PROFILE_KEY);
    return raw
      ? sanitizeBusinessProfile(JSON.parse(raw))
      : emptyBusinessProfile();
  } catch {
    return emptyBusinessProfile();
  }
}

export function saveBusinessProfile(profile: BusinessProfile) {
  try {
    window.localStorage.setItem(BUSINESS_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Private mode or full storage: the page still works for this visit.
  }
}
