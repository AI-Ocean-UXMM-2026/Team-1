import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultPaymentMethod,
  isAwayFromHome,
  orderPaymentMethod,
  paymentNote,
  paymentBadge,
} from "../src/lib/delivery/payment-methods.ts";

const home = { latitude: 16.8409, longitude: 96.1735 };

test("a customer who says they are away is away", () => {
  assert.equal(isAwayFromHome({ declaredAway: true }), true);
});

test("a pickup far from a saved home is away, near it is not", () => {
  const far = { latitude: 16.9, longitude: 96.2 };
  assert.equal(isAwayFromHome({ homePoint: home, pickupPoint: far }), true);
  assert.equal(isAwayFromHome({ homePoint: home, pickupPoint: home }), false);
});

test("without a saved home the customer is not assumed away", () => {
  assert.equal(isAwayFromHome({ pickupPoint: home }), false);
});

test("away from home defaults to prepaid, otherwise cash", () => {
  assert.equal(defaultPaymentMethod({ awayFromHome: true }), "mmqr");
  assert.equal(defaultPaymentMethod({ awayFromHome: false }), "cod");
  assert.equal(
    defaultPaymentMethod({ awayFromHome: true, preferred: "ctzpay" }),
    "ctzpay",
  );
  assert.equal(
    defaultPaymentMethod({ awayFromHome: true, preferred: "cod" }),
    "mmqr",
  );
});

test("orders with no method are cash on delivery", () => {
  assert.equal(orderPaymentMethod({}), "cod");
  assert.equal(orderPaymentMethod({ payment_method: "ctzpay" }), "ctzpay");
  assert.equal(paymentBadge("mmqr"), "Prepaid · MMQR");
  assert.equal(paymentBadge("cod"), "COD");
});

test("the method is read back from the order text", () => {
  assert.equal(
    orderPaymentMethod({ parcel_description: "Food · Payment: prepaid MMQR" }),
    "mmqr",
  );
  assert.equal(
    orderPaymentMethod({ notes: "Call first. Payment: prepaid CTZPay" }),
    "ctzpay",
  );
  assert.equal(
    orderPaymentMethod({ parcel_description: paymentNote("cod") }),
    "cod",
  );
});
