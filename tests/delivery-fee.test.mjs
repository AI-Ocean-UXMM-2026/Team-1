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
    method: "ctzpay",
  });
  assert.deepEqual(
    fee.lines.map((line) => line.id),
    ["base"],
  );
  // No pins and no address: nothing is known about where the trip runs, so
  // the downtown row is used, named as a plain base fee. It is priced from
  // the one end the estimate has, so it does not reach the raw rule base.
  assert.equal(fee.total, fee.lines[0].amount);
  assert.equal(fee.zones.label, "Base fee");
});

test("distance, weight and urgent are added as separate lines", () => {
  const fee = estimateDeliveryFee({
    distanceKm: 5,
    weightKg: 10,
    method: "ctzpay",
    urgent: true,
  });
  assert.deepEqual(
    fee.lines.map((line) => line.id),
    ["base", "distance", "weight", "urgent"],
  );
  assert.equal(fee.lines[1].amount, 1200);
  assert.equal(fee.lines[2].amount, 7 * FEE_RULES.perKgOver);
  assert.equal(
    fee.total,
    fee.lines.reduce((sum, line) => sum + line.amount, 0),
  );
});

test("cash on delivery adds a handling fee that prepaid does not", () => {
  const input = { distanceKm: 1, weightKg: 1 };
  const cod = estimateDeliveryFee({ ...input, method: "cod" });
  const prepaid = estimateDeliveryFee({ ...input, method: "ctzpay" });
  assert.equal(cod.total - prepaid.total, FEE_RULES.codHandling);
});

test("road distance is longer than a straight line and null without points", () => {
  const a = { latitude: 16.8, longitude: 96.15 };
  const b = { latitude: 16.85, longitude: 96.2 };
  assert.ok(roadDistanceKm(a, b) > 7);
  assert.equal(roadDistanceKm(a, null), null);
});

test("a pickup in Shwe Pyi Thar pays that city's base fee", () => {
  const fee = estimateDeliveryFee({
    distanceKm: 1,
    method: "cod",
    cashHandling: false,
    pickupAddress: "No. 5, Shwepyithar Township, Yangon",
    pickupPoint: { latitude: 16.96, longitude: 96.09 },
  });
  assert.equal(fee.zones.pickup.zone, "Shwe Pyi Thar");
  assert.equal(fee.zones.pickup.base, 4500);
  assert.equal(fee.lines[0].amount, 4500);
  assert.equal(fee.total, 4500);
});

test("a pin further from a township's centre pays more than one at it", () => {
  const at = (point) =>
    estimateDeliveryFee({
      distanceKm: 5,
      method: "cod",
      cashHandling: false,
      pickupAddress: "Shwe Pyi Thar",
      pickupPoint: point,
    });
  const centre = at({ latitude: 16.96, longitude: 96.09 });
  const towardsEdge = at({ latitude: 16.92, longitude: 96.09 });
  assert.equal(centre.zones.pickup.zone, "Shwe Pyi Thar");
  assert.equal(towardsEdge.zones.pickup.zone, "Shwe Pyi Thar");
  assert.ok(
    towardsEdge.zones.pickup.base > centre.zones.pickup.base,
    `towards the edge ${towardsEdge.zones.pickup.base} should cost more than the centre ${centre.zones.pickup.base}`,
  );
});

test("a small township is not swallowed by the wide one drawn around it", () => {
  // Central Shwe Pyi Thar also falls inside rural Htantabin's wide circle.
  const fee = estimateDeliveryFee({
    distanceKm: 1,
    method: "cod",
    cashHandling: false,
    pickupAddress: "Shwe Pyi Thar",
    pickupPoint: { latitude: 16.96, longitude: 96.09 },
  });
  assert.equal(fee.zones.pickup.zone, "Shwe Pyi Thar");
  assert.equal(fee.zones.pickup.base, 4500);
});

test("a trip that stays in one township is billed that township once", () => {
  const both = estimateDeliveryFee({
    distanceKm: 1,
    method: "cod",
    cashHandling: false,
    pickupAddress: "Bahan",
    pickupPoint: { latitude: 16.805, longitude: 96.155 },
    deliveryAddress: "Bahan",
    deliveryPoint: { latitude: 16.81, longitude: 96.16 },
  });
  assert.equal(both.zones.local, true);
  assert.match(both.lines[0].label, /Bahan zone, both ends/);
  // Charging both ends in full would bill the township twice over.
  assert.ok(
    both.zones.total < both.zones.pickup.base + both.zones.delivery.base,
    "an in-township trip should not pay both end fees in full",
  );
});

test("crossing the city is priced from both zones, not just the pickup", () => {
  const shared = {
    distanceKm: 12,
    method: "cod",
    cashHandling: false,
    pickupAddress: "Hlaing Thar Yar",
    pickupPoint: { latitude: 16.87, longitude: 96.03 },
  };
  const single = estimateDeliveryFee(shared);
  const cross = estimateDeliveryFee({
    ...shared,
    deliveryAddress: "Kyauktada",
    deliveryPoint: { latitude: 16.775, longitude: 96.155 },
  });
  assert.equal(cross.zones.local, false);
  assert.match(cross.lines[0].label, /Hlaing Thar Yar to/);
  assert.ok(cross.zones.delivery.charged > 0);
  assert.notEqual(cross.zones.total, single.zones.total);
});

test("a delivery in Shwe Pyi Thar is priced by that township too", () => {
  const fee = estimateDeliveryFee({
    distanceKm: 1,
    method: "cod",
    cashHandling: false,
    pickupAddress: "12 Pansodan Street, Kyauktada",
    deliveryAddress: "Ward 3, Shwe Pyi Thar, Yangon",
  });
  assert.equal(fee.zones.delivery.zone, "Shwe Pyi Thar");
  // Its base is blended with the pickup end, so it is not that township's
  // full fee on its own.
  assert.ok(fee.zones.delivery.base > 0);
  assert.ok(
    fee.zones.delivery.base < fee.zones.pickup.base + fee.zones.delivery.base,
  );
});

test("other pickups keep the standard base fee", () => {
  const fee = estimateDeliveryFee({
    distanceKm: 1,
    method: "cod",
    cashHandling: false,
    pickupAddress: "12 Pansodan Street, Kyauktada",
  });
  // No pin and no known township: the downtown row prices the trip.
  assert.equal(fee.lines[0].amount, fee.total);
  assert.match(fee.lines[0].label, /Base fee/);
});

test("cash handling can be left out whatever the method", () => {
  const lines = estimateDeliveryFee({
    distanceKm: 1,
    method: "cod",
    cashHandling: false,
  }).lines.map((line) => line.id);
  assert.deepEqual(lines, ["base"]);
});

test("no city base fee passes the cap and every city is matched", async () => {
  const { CITY_BASE_FEES, MAX_BASE_FEE, baseFeeFor } = await import(
    "../src/lib/delivery/delivery-fee.ts"
  );
  assert.equal(MAX_BASE_FEE, 6000);
  for (const entry of CITY_BASE_FEES) {
    assert.ok(entry.base <= MAX_BASE_FEE, `${entry.city} is over the cap`);
    assert.ok(entry.base >= FEE_RULES.base, `${entry.city} is under the base`);
    assert.equal(baseFeeFor(`Ward 3, ${entry.city}`).city, entry.city);
  }
});

test("a specific township wins over the shorter name it contains", async () => {
  const { baseFeeFor } = await import("../src/lib/delivery/delivery-fee.ts");
  assert.equal(baseFeeFor("Hlaing Thar Yar Township").base, 4000);
  assert.equal(baseFeeFor("Hlaing Thar Yar").city, "Hlaing Thar Yar");
  assert.equal(baseFeeFor("Hlaing Township").base, 2000);
  assert.equal(baseFeeFor("North Dagon, Yangon").base, 3000);
  assert.equal(baseFeeFor("Kyauktan").base, 5500);
  assert.equal(baseFeeFor("Pabedan, downtown").base, FEE_RULES.base);
});

test("a fallback above the cap is held to the cap", async () => {
  const { baseFeeFor } = await import("../src/lib/delivery/delivery-fee.ts");
  const { MAX_BASE_FEE } = await import("../src/lib/delivery/delivery-fee.ts");
  assert.equal(baseFeeFor("anywhere", 9000).base, MAX_BASE_FEE);
});

test("total delivery fee never exceeds MAX_DELIVERY_FEE (6,500 MMK)", () => {
  const fee = estimateDeliveryFee({
    distanceKm: 28.2,
    weightKg: 5,
    method: "cod",
    pickupPoint: { latitude: 16.96, longitude: 96.09 },
    pickupAddress: "Shwe Pyi Thar, 8 Ward, Shin Saw Pu Park, 353",
    deliveryPoint: { latitude: 16.775, longitude: 96.155 },
    deliveryAddress: "Shwedagonpagoda",
    cashHandling: false,
  });
  assert.equal(fee.total, 6500);
  assert.equal(
    fee.total,
    fee.lines.reduce((sum, line) => sum + line.amount, 0),
  );
  // Lines should not contain an awkward negative adjustment line
  assert.ok(!fee.lines.some((line) => line.id === "discount"));
});

test("typing part of a township name finds it, spaces and spelling aside", async () => {
  const { matchCities } = await import("../src/lib/delivery/delivery-fee.ts");
  assert.equal(matchCities("shwepyi")[0].city, "Shwe Pyi Thar");
  // 4500 is the rate the business set for Shwe Pyi Thar. The suggestion pins
  // the township centre, so it quotes that centre rate.
  assert.equal(matchCities("Shwe Pyi Thar")[0].base, 4500);
  assert.equal(matchCities("hlaing thar")[0].city, "Hlaing Thar Yar");
  assert.deepEqual(matchCities("zz"), []);
  assert.ok(matchCities("mandalay")[0].point.latitude > 21);
});
