import assert from "node:assert/strict";
import test from "node:test";
import { estimateDeliveryFee } from "../src/lib/delivery/delivery-fee.ts";
import {
  applyRewards,
  balanceFrom,
  checkCoupon,
  couponHeadline,
  ledgerForTab,
  ledgerLabel,
  normalizeCouponCode,
  pointsEarned,
  pointsToDiscount,
  withRewards,
} from "../src/lib/delivery/rewards.ts";

const coupon = (overrides = {}) => ({
  code: "WELCOME",
  kind: "percent",
  value: 20,
  minFee: 0,
  maxDiscount: null,
  startsAt: null,
  endsAt: null,
  active: true,
  maxRedemptions: null,
  redemptions: 0,
  perCustomerLimit: null,
  customerRedemptions: 0,
  ...overrides,
});

test("coupon codes ignore case and spaces", () => {
  assert.equal(normalizeCouponCode(" wel come "), "WELCOME");
});

test("percent, fixed and free delivery coupons discount the fee", () => {
  assert.deepEqual(checkCoupon(3000, coupon()), { ok: true, discount: 600 });
  assert.deepEqual(checkCoupon(3000, coupon({ kind: "fixed", value: 1000 })), {
    ok: true,
    discount: 1000,
  });
  assert.deepEqual(checkCoupon(3000, coupon({ kind: "free_delivery" })), {
    ok: true,
    discount: 3000,
  });
});

test("a discount never exceeds the fee or the coupon cap", () => {
  assert.equal(
    checkCoupon(800, coupon({ kind: "fixed", value: 1000 })).discount,
    800,
  );
  assert.equal(
    checkCoupon(5000, coupon({ value: 50, maxDiscount: 1000 })).discount,
    1000,
  );
});

test("a coupon is refused when it is off, early, expired or used up", () => {
  const now = new Date("2026-10-23T00:00:00Z");
  const reason = (overrides) =>
    checkCoupon(3000, coupon(overrides), now).reason;
  assert.match(reason({ active: false }), /turned off/);
  assert.match(reason({ startsAt: "2026-11-01T00:00:00Z" }), /not active yet/);
  assert.match(reason({ endsAt: "2026-10-01T00:00:00Z" }), /expired/);
  assert.match(reason({ maxRedemptions: 5, redemptions: 5 }), /fully used/);
  assert.match(
    reason({ perCustomerLimit: 1, customerRedemptions: 1 }),
    /already used/,
  );
  assert.match(reason({ minFee: 5000 }), /at least 5,000 MMK/);
});

test("points are capped by balance, request and half the fee", () => {
  assert.deepEqual(pointsToDiscount(1000, 1000, 3000), {
    pointsUsed: 150,
    discount: 1500,
  });
  assert.deepEqual(pointsToDiscount(40, 1000, 3000), {
    pointsUsed: 40,
    discount: 400,
  });
  assert.deepEqual(pointsToDiscount(1000, -5, 3000), {
    pointsUsed: 0,
    discount: 0,
  });
});

test("points are earned per 1,000 MMK of fee paid", () => {
  assert.equal(pointsEarned(2900), 2);
  assert.equal(pointsEarned(0), 0);
});

test("the balance is the ledger sum and never negative", () => {
  assert.equal(balanceFrom([{ delta: 5 }, { delta: -2 }]), 3);
  assert.equal(balanceFrom([{ delta: -2 }]), 0);
});

test("the coupon applies first, then points on the remaining fee", () => {
  const applied = applyRewards(3000, {
    coupon: coupon({ kind: "fixed", value: 1000 }),
    points: 500,
    balance: 500,
  });
  assert.equal(applied.couponDiscount, 1000);
  assert.equal(applied.pointsUsed, 100);
  assert.equal(applied.total, 1000);
});

test("an invalid coupon changes nothing", () => {
  const applied = applyRewards(3000, { coupon: coupon({ active: false }) });
  assert.equal(applied.discount, 0);
  assert.equal(applied.total, 3000);
});

test("the estimate shows rewards as negative lines and a lower total", () => {
  const estimate = estimateDeliveryFee({ distanceKm: 1, method: "ctzpay" });
  const applied = applyRewards(estimate.total, {
    coupon: coupon({ kind: "fixed", value: 500 }),
  });
  const result = withRewards(estimate, applied, "WELCOME");
  assert.equal(result.lines.at(-1).amount, -500);
  assert.equal(result.total, estimate.total - 500);
});

test("the history tabs split earned from used points", () => {
  const entries = [{ delta: 3 }, { delta: -2 }, { delta: 1 }];
  assert.equal(ledgerForTab(entries, "all").length, 3);
  assert.deepEqual(ledgerForTab(entries, "earned"), [
    { delta: 3 },
    { delta: 1 },
  ]);
  assert.deepEqual(ledgerForTab(entries, "used"), [{ delta: -2 }]);
  assert.match(ledgerLabel("reversal"), /not delivered/);
});

test("a coupon card headline names the offer and its cap", () => {
  assert.equal(
    couponHeadline({ kind: "percent", value: 20, maxDiscount: 1000 }),
    "20% off the fee, up to 1,000 MMK",
  );
  assert.equal(
    couponHeadline({ kind: "fixed", value: 500, maxDiscount: null }),
    "500 MMK off the fee",
  );
  assert.equal(
    couponHeadline({ kind: "free_delivery", value: 0, maxDiscount: null }),
    "Free delivery",
  );
});

const form = (overrides = {}) => ({
  code: "SAVE20",
  kind: "percent",
  value: "20",
  minFee: "",
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  maxRedemptions: "",
  perCustomerLimit: "",
  ...overrides,
});

test("a complete coupon form has no errors", async () => {
  const { validateCouponForm } = await import("../src/lib/delivery/rewards.ts");
  assert.deepEqual(validateCouponForm(form()), {});
  assert.deepEqual(
    validateCouponForm(form({ kind: "free_delivery", value: "" })),
    {},
  );
});

test("the coupon form names each bad field", async () => {
  const { validateCouponForm } = await import("../src/lib/delivery/rewards.ts");
  const errors = validateCouponForm(
    form({
      code: "a",
      value: "150",
      maxRedemptions: "0",
      startsAt: "2026-11-02",
      endsAt: "2026-11-01",
    }),
  );
  assert.deepEqual(Object.keys(errors).sort(), [
    "code",
    "endsAt",
    "maxRedemptions",
    "value",
  ]);
});

test("a coupon's state explains why it is or is not usable", async () => {
  const { couponState } = await import("../src/lib/delivery/rewards.ts");
  const now = new Date("2026-10-23T00:00:00Z");
  const base = {
    active: true,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    redemptions: 0,
  };
  assert.equal(couponState(base, now), "active");
  assert.equal(couponState({ ...base, active: false }, now), "off");
  assert.equal(
    couponState({ ...base, endsAt: "2026-10-01T00:00:00Z" }, now),
    "expired",
  );
  assert.equal(
    couponState({ ...base, startsAt: "2026-11-01T00:00:00Z" }, now),
    "scheduled",
  );
  assert.equal(
    couponState({ ...base, maxRedemptions: 2, redemptions: 2 }, now),
    "used_up",
  );
});
