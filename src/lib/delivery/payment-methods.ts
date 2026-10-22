import { haversineKilometers } from "./intelligence.ts";

export type PaymentMethod = "mmqr" | "ctzpay" | "cod";

export type PaymentMethodInfo = {
  id: PaymentMethod;
  label: string;
  hint: string;
  /** Paid in the app before the rider arrives, so the rider collects no fee. */
  prepaid: boolean;
};

export const PAYMENT_METHODS: readonly PaymentMethodInfo[] = [
  {
    id: "mmqr",
    label: "MMQR",
    hint: "Scan with any bank or wallet app that supports MMQR.",
    prepaid: true,
  },
  {
    id: "ctzpay",
    label: "CTZPay",
    hint: "Pay with your CTZPay wallet before the rider arrives.",
    prepaid: true,
  },
  {
    id: "cod",
    label: "Cash on delivery",
    hint: "The rider collects cash at the drop-off.",
    prepaid: false,
  },
] as const;

export function paymentMethodInfo(method: PaymentMethod) {
  return (
    PAYMENT_METHODS.find((item) => item.id === method) ?? PAYMENT_METHODS[2]
  );
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.some((item) => item.id === value);
}

export function isPrepaid(method: PaymentMethod) {
  return paymentMethodInfo(method).prepaid;
}

/**
 * The method an order was placed with. There is no database column yet, so
 * the customer and manager forms write "Payment: prepaid MMQR" into the
 * order text; an order with neither is cash on delivery.
 */
export function orderPaymentMethod(order: {
  payment_method?: PaymentMethod | null;
  parcel_description?: string | null;
  notes?: string | null;
}): PaymentMethod {
  if (isPaymentMethod(order.payment_method)) return order.payment_method;
  const text = `${order.parcel_description ?? ""} ${order.notes ?? ""}`;
  const match = /payment: prepaid (mmqr|ctzpay)/i.exec(text);
  return match ? (match[1].toLowerCase() as PaymentMethod) : "cod";
}

/** The text form of a choice, as read back by orderPaymentMethod. */
export function paymentNote(method: PaymentMethod) {
  return isPrepaid(method)
    ? `Payment: prepaid ${paymentMethodInfo(method).label}`
    : "Payment: cash on delivery";
}

/** Short label for a table or badge, such as "Prepaid · MMQR" or "COD". */
export function paymentBadge(method: PaymentMethod) {
  return isPrepaid(method)
    ? `Prepaid · ${paymentMethodInfo(method).label}`
    : "COD";
}

type Point = { latitude: number; longitude: number };

/** How far from a saved home the pickup can be before the customer is "away". */
export const HOME_RADIUS_KM = 1;

/**
 * A customer is away from home when they say so, or when a saved home
 * location exists and the pickup is well outside it. Away from home nobody is
 * guaranteed to have cash ready, so prepaid is the better default.
 */
export function isAwayFromHome(input: {
  declaredAway?: boolean;
  homePoint?: Point | null;
  pickupPoint?: Point | null;
}) {
  if (input.declaredAway) return true;
  if (!input.homePoint || !input.pickupPoint) return false;
  return (
    haversineKilometers(input.homePoint, input.pickupPoint) > HOME_RADIUS_KM
  );
}

/** Prepaid when away from home, otherwise the customer's usual cash option. */
export function defaultPaymentMethod(input: {
  awayFromHome: boolean;
  codAvailable?: boolean;
  preferred?: PaymentMethod;
}): PaymentMethod {
  const codAvailable = input.codAvailable ?? true;
  if (input.awayFromHome || !codAvailable) {
    return input.preferred && isPrepaid(input.preferred)
      ? input.preferred
      : "mmqr";
  }
  return input.preferred ?? "cod";
}
