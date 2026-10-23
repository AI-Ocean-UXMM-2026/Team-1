import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRemotePayment,
  defaultPaymentMethod,
  isAwayFromHome,
  orderPaymentBadge,
  orderPaymentMethod,
  orderPaymentStatus,
  orderPrepaidAmount,
  paymentBadge,
  paymentNote,
  planPickupPayment,
  splitPayment,
  stripPaymentNote,
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
  assert.equal(paymentBadge("ctzpay"), "Prepaid · CTZPay");
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

test("the customer can pay any amount now; the rest is cash", () => {
  assert.deepEqual(splitPayment(8300, 5000), { paid: 5000, cashDue: 3300 });
  assert.deepEqual(splitPayment(8300, 8300), { paid: 8300, cashDue: 0 });
  assert.deepEqual(splitPayment(8300, 20000), { paid: 8300, cashDue: 0 });
  assert.deepEqual(splitPayment(8300, -5), { paid: 0, cashDue: 8300 });
  assert.deepEqual(splitPayment(8300, Number.NaN), { paid: 0, cashDue: 8300 });
});

test("a part payment is written and read back from the order text", () => {
  const note = paymentNote("mmqr", 5000);
  assert.equal(note, "Payment: prepaid MMQR 5000 MMK");
  assert.equal(orderPrepaidAmount({ notes: note }), 5000);
  assert.equal(orderPaymentMethod({ notes: note }), "mmqr");
  assert.equal(orderPrepaidAmount({ notes: paymentNote("mmqr") }), null);
});

test("an order is paid once nothing is left to collect", () => {
  const part = { notes: paymentNote("mmqr", 5000), cod_status: "pending" };
  assert.equal(orderPaymentStatus({ ...part, cod_amount: 3300 }), "part_paid");
  assert.equal(
    orderPaymentBadge({ ...part, cod_amount: 3300 }),
    "Part paid · MMQR",
  );
  assert.equal(orderPaymentStatus({ ...part, cod_amount: 0 }), "paid");
  assert.equal(orderPaymentBadge({ ...part, cod_amount: 0 }), "Paid · MMQR");
  assert.equal(
    orderPaymentStatus({ ...part, cod_amount: 3300, cod_status: "collected" }),
    "paid",
  );
  // Older prepaid orders name no amount and were paid in full.
  assert.equal(
    orderPaymentStatus({
      notes: paymentNote("ctzpay"),
      cod_amount: 5000,
      cod_status: "pending",
    }),
    "paid",
  );
  assert.equal(
    orderPaymentStatus({ cod_amount: 5000, cod_status: "pending" }),
    "cash_due",
  );
  assert.equal(
    orderPaymentBadge({ cod_amount: 5000, cod_status: "settled" }),
    "Paid",
  );
});

test("paying the COD balance remotely reduces it and records the payment", () => {
  const cash = {
    cod_amount: 8300,
    parcel_description: "Docs · Payment: cash on delivery",
    notes: null,
  };
  const part = applyRemotePayment(cash, 5000, "mmqr");
  assert.equal(part.cod_amount, 3300);
  assert.equal(part.cod_status, "pending");
  assert.equal(orderPrepaidAmount(part), 5000);
  assert.equal(orderPaymentStatus(part), "part_paid");

  const rest = applyRemotePayment(part, 3300, "mmqr");
  assert.equal(rest.cod_amount, 0);
  assert.equal(rest.cod_status, "not_required");
  assert.equal(orderPrepaidAmount(rest), 8300);
  assert.equal(orderPaymentStatus(rest), "paid");
  assert.equal(orderPaymentBadge(rest), "Paid · MMQR");
});

test("a remote payment adds to a part payment written in the notes", () => {
  const order = {
    cod_amount: 1900,
    parcel_description: "Food",
    notes: "Call first · Payment: prepaid MMQR 5000 MMK",
  };
  const done = applyRemotePayment(order, 1900, "mmqr");
  assert.equal(done.notes, "Call first · Payment: prepaid MMQR 6900 MMK");
  assert.equal(done.parcel_description, "Food");
  assert.equal(orderPrepaidAmount(done), 6900);
});

test("a remote payment never exceeds the balance", () => {
  const done = applyRemotePayment({ cod_amount: 2000 }, 9000, "ctzpay");
  assert.equal(done.paid, 2000);
  assert.equal(done.cod_amount, 0);
});

test("the payment line is dropped from the text shown beside it", () => {
  assert.equal(
    stripPaymentNote("Food · Small · Payment: prepaid MMQR 5000 MMK"),
    "Food · Small",
  );
  assert.equal(stripPaymentNote("Docs · Payment: cash on delivery"), "Docs");
  assert.equal(stripPaymentNote(null), "");
});

test("a pickup request owes everything until the payment is recorded", () => {
  const me = planPickupPayment({
    fee: 3300,
    goods: 5000,
    method: "mmqr",
    payer: "me",
    payNow: "5000",
  });
  assert.equal(me.codAmount, 8300);
  assert.equal(me.note, "Payment: cash on delivery");
  assert.equal(me.payOnline, 5000);
  assert.equal(me.method, "mmqr");

  const all = planPickupPayment({
    fee: 3300,
    goods: 0,
    method: "ctzpay",
    payer: "me",
    payNow: "",
  });
  assert.equal(all.payOnline, 3300);

  const other = planPickupPayment({
    fee: 3300,
    goods: 0,
    method: "mmqr",
    payer: "other",
    payNow: "",
  });
  assert.equal(other.payOnline, 0);
  assert.equal(other.codAmount, 3300);
  assert.equal(other.method, "cod");
});
