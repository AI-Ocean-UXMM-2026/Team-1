import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateDeliveryFee,
  FEE_RULES,
  roadDistanceKm,
} from "../src/lib/delivery/delivery-fee.ts";

test("a short light prepaid parcel pays only the base fee", () => {
  const fee = estimateDeliveryFee({
    distanceKm: 1.5,
    weightKg: 1,
    method: "mmqr",
  });
  assert.deepEqual(
    fee.lines.map((line) => line.id),
    ["base"],
  );
  assert.equal(fee.total, FEE_RULES.base);
});

test("distance, weight and urgent are added as separate lines", () => {
  const fee = estimateDeliveryFee({
    distanceKm: 6,
    weightKg: 10,
    method: "ctzpay",
    urgent: true,
  });
  assert.deepEqual(
    fee.lines.map((line) => line.id),
    ["base", "distance", "weight", "urgent"],
  );
  assert.equal(fee.lines[1].amount, 1600);
  assert.equal(fee.lines[2].amount, 7 * FEE_RULES.perKgOver);
  assert.equal(
    fee.total,
    fee.lines.reduce((sum, line) => sum + line.amount, 0),
  );
});

test("cash on delivery adds a handling fee that prepaid does not", () => {
  const input = { distanceKm: 1, weightKg: 1 };
  const cod = estimateDeliveryFee({ ...input, method: "cod" });
  const prepaid = estimateDeliveryFee({ ...input, method: "mmqr" });
  assert.equal(cod.total - prepaid.total, FEE_RULES.codHandling);
});

test("road distance is longer than a straight line and null without points", () => {
  const a = { latitude: 16.8, longitude: 96.15 };
  const b = { latitude: 16.85, longitude: 96.2 };
  assert.ok(roadDistanceKm(a, b) > 7);
  assert.equal(roadDistanceKm(a, null), null);
});
