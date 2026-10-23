import type { FeeEstimate } from "./delivery-fee.ts";

/** Placeholder loyalty rules in MMK until the business sets real ones. */
export const REWARD_RULES = {
  /** MMK of fee discount one point is worth. */
  mmkPerPoint: 10,
  /** Largest share of the fee points may cover. */
  maxPointsShare: 0.5,
  /** Fee paid (MMK) that earns one point. */
  mmkPerEarnedPoint: 1000,
} as const;

export type CouponKind = "percent" | "fixed" | "free_delivery";

export type Coupon = {
  code: string;
  kind: CouponKind;
  /** Percent (1-100) for `percent`, MMK for `fixed`, ignored for `free_delivery`. */
  value: number;
  minFee: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  maxRedemptions: number | null;
  redemptions: number;
  perCustomerLimit: number | null;
  customerRedemptions: number;
};

export type CouponCheck =
  | { ok: true; discount: number }
  | { ok: false; reason: string };

export type LedgerEntry = { delta: number };

export type RewardsApplied = {
  couponDiscount: number;
  pointsUsed: number;
  pointsDiscount: number;
  discount: number;
  total: number;
};

export const normalizeCouponCode = (code: string) =>
  code.replace(/\s+/g, "").toUpperCase();

/** Why a coupon cannot be used on a fee right now, or the discount it gives. */
export function checkCoupon(
  fee: number,
  coupon: Coupon,
  now: Date = new Date(),
): CouponCheck {
  if (!coupon.active)
    return { ok: false, reason: "This coupon is turned off." };
  if (coupon.startsAt && now < new Date(coupon.startsAt))
    return { ok: false, reason: "This coupon is not active yet." };
  if (coupon.endsAt && now > new Date(coupon.endsAt))
    return { ok: false, reason: "This coupon has expired." };
  if (
    coupon.maxRedemptions !== null &&
    coupon.redemptions >= coupon.maxRedemptions
  )
    return { ok: false, reason: "This coupon has been fully used." };
  if (
    coupon.perCustomerLimit !== null &&
    coupon.customerRedemptions >= coupon.perCustomerLimit
  )
    return { ok: false, reason: "You have already used this coupon." };
  if (fee < coupon.minFee)
    return {
      ok: false,
      reason: `Needs a delivery fee of at least ${coupon.minFee.toLocaleString("en-US")} MMK.`,
    };

  let discount =
    coupon.kind === "free_delivery"
      ? fee
      : coupon.kind === "percent"
        ? Math.floor((fee * coupon.value) / 100)
        : coupon.value;
  if (coupon.maxDiscount !== null)
    discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.max(0, Math.min(discount, fee));
  if (discount === 0)
    return {
      ok: false,
      reason: "This coupon gives no discount on this order.",
    };
  return { ok: true, discount };
}

/** Points that can be spent on a fee, and the MMK they take off. */
export function pointsToDiscount(
  balance: number,
  requested: number,
  fee: number,
  rules = REWARD_RULES,
) {
  const capPoints = Math.floor(
    (fee * rules.maxPointsShare) / rules.mmkPerPoint,
  );
  const pointsUsed = Math.max(
    0,
    Math.min(Math.floor(requested), Math.floor(balance), capPoints),
  );
  return { pointsUsed, discount: pointsUsed * rules.mmkPerPoint };
}

export const pointsEarned = (feePaid: number, rules = REWARD_RULES) =>
  Math.max(0, Math.floor(feePaid / rules.mmkPerEarnedPoint));

export const balanceFrom = (ledger: readonly LedgerEntry[]) =>
  Math.max(
    0,
    ledger.reduce((sum, entry) => sum + entry.delta, 0),
  );

/** Coupon first, then points on what is left of the fee. */
export function applyRewards(
  fee: number,
  options: {
    coupon?: Coupon | null;
    points?: number;
    balance?: number;
    now?: Date;
  } = {},
): RewardsApplied {
  const check = options.coupon
    ? checkCoupon(fee, options.coupon, options.now)
    : null;
  const couponDiscount = check?.ok ? check.discount : 0;
  const points = pointsToDiscount(
    options.balance ?? 0,
    options.points ?? 0,
    fee - couponDiscount,
  );
  const discount = couponDiscount + points.discount;
  return {
    couponDiscount,
    pointsUsed: points.pointsUsed,
    pointsDiscount: points.discount,
    discount,
    total: fee - discount,
  };
}

/** The fee estimate with coupon and points shown as negative lines. */
export function withRewards(
  estimate: FeeEstimate,
  applied: RewardsApplied,
  couponCode?: string,
): FeeEstimate {
  const lines = [...estimate.lines];
  if (applied.couponDiscount > 0)
    lines.push({
      id: "discount",
      label: couponCode ? `Coupon ${couponCode}` : "Coupon",
      amount: -applied.couponDiscount,
    });
  if (applied.pointsDiscount > 0)
    lines.push({
      id: "discount",
      label: `${applied.pointsUsed.toLocaleString("en-US")} points`,
      amount: -applied.pointsDiscount,
    });
  return { ...estimate, lines, total: applied.total };
}

/**
 * Rewards when the coupon discount comes from the database already: points are
 * then spent on what is left of the fee.
 */
export function applyServerRewards(
  fee: number,
  options: { couponDiscount?: number; usePoints?: boolean; balance?: number },
): RewardsApplied {
  const couponDiscount = Math.max(
    0,
    Math.min(options.couponDiscount ?? 0, fee),
  );
  const points = pointsToDiscount(
    options.balance ?? 0,
    options.usePoints ? Number.MAX_SAFE_INTEGER : 0,
    fee - couponDiscount,
  );
  const discount = couponDiscount + points.discount;
  return {
    couponDiscount,
    pointsUsed: points.pointsUsed,
    pointsDiscount: points.discount,
    discount,
    total: fee - discount,
  };
}

export type LedgerReason = "delivered" | "redeemed" | "adjustment" | "reversal";
export type LedgerTab = "all" | "earned" | "used";

export function ledgerForTab<T extends { delta: number }>(
  entries: readonly T[],
  tab: LedgerTab,
) {
  return tab === "all"
    ? [...entries]
    : entries.filter((entry) =>
        tab === "earned" ? entry.delta > 0 : entry.delta < 0,
      );
}

export function ledgerLabel(reason: string) {
  switch (reason) {
    case "delivered":
      return "Delivery completed";
    case "redeemed":
      return "Used on a delivery fee";
    case "reversal":
      return "Returned: order not delivered";
    case "adjustment":
      return "Adjustment by Oern";
    default:
      return "Points";
  }
}

/** What a coupon offers, in the words printed on its card. */
export function couponHeadline(
  coupon: Pick<Coupon, "kind" | "value" | "maxDiscount">,
) {
  const cap =
    coupon.maxDiscount !== null
      ? `, up to ${coupon.maxDiscount.toLocaleString("en-US")} MMK`
      : "";
  if (coupon.kind === "free_delivery") return "Free delivery";
  if (coupon.kind === "percent") return `${coupon.value}% off the fee${cap}`;
  return `${coupon.value.toLocaleString("en-US")} MMK off the fee`;
}

export type CouponForm = {
  code: string;
  kind: CouponKind;
  value: string;
  minFee: string;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  perCustomerLimit: string;
};

export type CouponFormErrors = Partial<Record<keyof CouponForm, string>>;

const wholeNumber = (text: string) =>
  text.trim() !== "" && /^\d+$/.test(text.trim()) ? Number(text) : null;

/** Field errors for the manager's coupon form; empty when it can be saved. */
export function validateCouponForm(form: CouponForm): CouponFormErrors {
  const errors: CouponFormErrors = {};
  const code = normalizeCouponCode(form.code);
  if (!/^[A-Z0-9_-]{3,24}$/.test(code))
    errors.code = "Use 3 to 24 letters, numbers, - or _.";
  if (form.kind !== "free_delivery") {
    const value = wholeNumber(form.value);
    if (value === null || value < 1)
      errors.value = "Enter a whole number above 0.";
    else if (form.kind === "percent" && value > 100)
      errors.value = "A percentage cannot be above 100.";
  }
  for (const field of [
    "minFee",
    "maxDiscount",
    "maxRedemptions",
    "perCustomerLimit",
  ] as const) {
    if (form[field].trim() === "") continue;
    const value = wholeNumber(form[field]);
    if (value === null || (field !== "minFee" && value < 1))
      errors[field] = "Enter a whole number, or leave it empty.";
  }
  if (
    form.startsAt &&
    form.endsAt &&
    new Date(form.endsAt) <= new Date(form.startsAt)
  )
    errors.endsAt = "The end must be after the start.";
  return errors;
}

export const emptyCouponForm: CouponForm = {
  code: "",
  kind: "percent",
  value: "",
  minFee: "",
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  maxRedemptions: "",
  perCustomerLimit: "",
};

/** Where a coupon stands today, for the manager's table. */
export function couponState(
  coupon: Pick<Coupon, "active" | "startsAt" | "endsAt" | "maxRedemptions"> & {
    redemptions: number;
  },
  now: Date = new Date(),
): "active" | "off" | "scheduled" | "expired" | "used_up" {
  if (!coupon.active) return "off";
  if (coupon.endsAt && now > new Date(coupon.endsAt)) return "expired";
  if (coupon.startsAt && now < new Date(coupon.startsAt)) return "scheduled";
  if (
    coupon.maxRedemptions !== null &&
    coupon.redemptions >= coupon.maxRedemptions
  )
    return "used_up";
  return "active";
}
