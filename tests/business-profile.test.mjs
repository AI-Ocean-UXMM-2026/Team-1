import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PICKUP_LOCATIONS,
  sanitizeBusinessProfile,
} from "../src/lib/delivery/business-profile.ts";

test("junk becomes an empty profile", () => {
  for (const raw of [null, 5, "x", []]) {
    const profile = sanitizeBusinessProfile(raw);
    assert.equal(profile.name, "");
    assert.deepEqual(profile.pickupLocations, []);
    assert.equal(profile.defaultPayment, "cod");
  }
});

test("locations need an id and address, are unique and capped", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `p${i}`,
    address: `Street ${i}`,
  }));
  const profile = sanitizeBusinessProfile({
    name: " Shwe Bakery ",
    defaultPayment: "ctzpay",
    pickupLocations: [
      { id: "a", address: "" },
      { address: "No id" },
      { id: "dup", address: "One" },
      { id: "dup", address: "Two" },
      ...many,
    ],
  });
  assert.equal(profile.name, "Shwe Bakery");
  assert.equal(profile.defaultPayment, "ctzpay");
  assert.equal(profile.pickupLocations[0].address, "One");
  assert.equal(profile.pickupLocations[0].label, "One");
  assert.equal(profile.pickupLocations.length, MAX_PICKUP_LOCATIONS);
});

test("an unknown payment method falls back to cash", () => {
  assert.equal(
    sanitizeBusinessProfile({ defaultPayment: "paypal" }).defaultPayment,
    "cod",
  );
});
