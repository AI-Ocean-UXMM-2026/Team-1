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
    hint: "Scan with any bank or wallet app that supports MMQR, CTZPay included.",
    prepaid: true,
  },
  {
    id: "ctzpay",
    label: "CTZPay",
    hint: "CTZPay is part of MMQR: pay with your CTZPay wallet before the rider arrives.",
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

type PaymentOrder = {
  payment_method?: PaymentMethod | null;
  parcel_description?: string | null;
  notes?: string | null;
};

/**
 * Matches the payment text the forms write into an order, such as
 * "Payment: prepaid MMQR 5000 MMK". The amount is absent on orders paid in
 * full before part payments existed.
 */
const PREPAID_NOTE = /payment: prepaid (mmqr|ctzpay)(?: (\d+) MMK)?/i;

function orderText(order: PaymentOrder) {
  return `${order.parcel_description ?? ""} ${order.notes ?? ""}`;
}

/**
 * The method an order was placed with. There is no database column yet, so
 * the customer and manager forms write "Payment: prepaid MMQR" into the
 * order text; an order with neither is cash on delivery.
 */
export function orderPaymentMethod(order: PaymentOrder): PaymentMethod {
  if (isPaymentMethod(order.payment_method)) return order.payment_method;
  const match = PREPAID_NOTE.exec(orderText(order));
  return match ? (match[1].toLowerCase() as PaymentMethod) : "cod";
}

/**
 * What the customer paid in the app, or null when the order text names no
 * amount: a prepaid order without one was paid in full.
 */
export function orderPrepaidAmount(order: PaymentOrder): number | null {
  const match = PREPAID_NOTE.exec(orderText(order));
  return match?.[2] ? Number(match[2]) : null;
}

/**
 * Prepaid with nothing left for the rider: either no amount was recorded
 * (paid in full) or the part payment covered the whole balance.
 */
export function isPaidInFull(order: PaymentOrder & { cod_amount: number }) {
  if (!isPrepaid(orderPaymentMethod(order))) return false;
  return orderPrepaidAmount(order) === null || order.cod_amount <= 0;
}

export type PaymentStatus = "paid" | "part_paid" | "cash_due";

/**
 * Paid once nothing is owed: prepaid in full, or the rider collected the rest.
 * A part payment leaves the balance as the cash on delivery.
 */
export function orderPaymentStatus(
  order: PaymentOrder & { cod_amount: number; cod_status?: string },
): PaymentStatus {
  if (isPaidInFull(order)) return "paid";
  if (order.cod_status === "collected" || order.cod_status === "settled")
    return "paid";
  return isPrepaid(orderPaymentMethod(order)) ? "part_paid" : "cash_due";
}

/**
 * Splits what is owed into what the customer pays now and the cash the rider
 * collects. Any amount from nothing to the whole total is allowed.
 */
export function splitPayment(total: number, payNow: number) {
  const owed = Math.max(0, Math.round(total));
  const paid = Number.isFinite(payNow)
    ? Math.min(owed, Math.max(0, Math.round(payNow)))
    : 0;
  return { paid, cashDue: owed - paid };
}

/**
 * The text form of a choice, as read back by orderPaymentMethod. Pass the
 * amount paid now for a part payment; without it a prepaid order is paid in
 * full.
 */
export function paymentNote(method: PaymentMethod, paid?: number) {
  if (!isPrepaid(method)) return "Payment: cash on delivery";
  const label = paymentMethodInfo(method).label;
  return paid === undefined
    ? `Payment: prepaid ${label}`
    : `Payment: prepaid ${label} ${Math.round(paid)} MMK`;
}

export type Payer = "me" | "other";

/**
 * How a pickup request is paid. Nothing is prepaid when the request is sent:
 * the order owes the whole delivery fee plus goods as its cash on delivery,
 * and the order only turns Paid once staff record the money arriving. What the
 * sender chose to pay online now is carried to the next screen, where they pay.
 */
export function planPickupPayment(input: {
  fee: number;
  goods: number;
  method: PaymentMethod;
  payer: Payer;
  /** As typed; empty means the whole amount. */
  payNow: string;
}) {
  const owed = Math.max(0, Math.round(input.fee + input.goods));
  const online = input.payer === "me" && isPrepaid(input.method);
  const { paid } = splitPayment(
    owed,
    input.payNow.trim() === "" ? owed : Number(input.payNow),
  );
  return {
    owed,
    codAmount: owed,
    note: paymentNote("cod"),
    payOnline: online ? paid : 0,
    method: online ? input.method : ("cod" as PaymentMethod),
  };
}

/** The order text without the payment line, for screens that show it apart. */
export function stripPaymentNote(text: string | null | undefined) {
  return (text ?? "")
    .replace(
      /\s*(?:·\s*)?payment: (?:cash on delivery|prepaid \w+(?: \d+ MMK)?)/gi,
      "",
    )
    .trim();
}

/**
 * An order after a remote payment of part or all of its COD balance. The
 * balance drops by the amount paid and the order text records the total paid
 * in the app, so every screen that reads the note shows the new state. The
 * amount is added to an existing prepaid note in either field, else appended.
 */
export function applyRemotePayment(
  order: PaymentOrder & { cod_amount: number },
  amount: number,
  method: PaymentMethod,
) {
  const paid = Math.min(order.cod_amount, Math.max(0, Math.round(amount)));
  const note = new RegExp(PREPAID_NOTE.source, "i");
  const bump = (text: string | null | undefined) => {
    const match = text ? note.exec(text) : null;
    if (!text || !match?.[2]) return null;
    return text.replace(
      note,
      paymentNote(
        match[1].toLowerCase() as PaymentMethod,
        Number(match[2]) + paid,
      ),
    );
  };
  const description = order.parcel_description ?? null;
  const notes = order.notes ?? null;
  const bumpedDescription = bump(description);
  const bumpedNotes = bumpedDescription === null ? bump(notes) : null;
  const addition = paymentNote(method, paid);
  return {
    paid,
    cod_amount: order.cod_amount - paid,
    cod_status: order.cod_amount - paid > 0 ? "pending" : "not_required",
    parcel_description:
      bumpedDescription ??
      (bumpedNotes === null
        ? [description, addition].filter(Boolean).join(" · ")
        : description),
    notes: bumpedNotes ?? notes,
  } as const;
}

/** Short label for a table or badge, such as "Prepaid · MMQR" or "COD". */
export function paymentBadge(method: PaymentMethod) {
  return isPrepaid(method)
    ? `Prepaid · ${paymentMethodInfo(method).label}`
    : "COD";
}

/** Badge for an order: "Paid · MMQR", "Part paid · MMQR" or "COD". */
export function orderPaymentBadge(
  order: PaymentOrder & { cod_amount: number; cod_status?: string },
) {
  const method = orderPaymentMethod(order);
  const status = orderPaymentStatus(order);
  const label = paymentMethodInfo(method).label;
  if (status === "part_paid") return `Part paid · ${label}`;
  if (status === "paid") return isPrepaid(method) ? `Paid · ${label}` : "Paid";
  return "COD";
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
