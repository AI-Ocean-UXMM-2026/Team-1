import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFoodParcelDescription,
  getFoodItemById,
  getFoodVendorsByCategory,
  getFoodVendorsByTownship,
  searchFoodVendors,
  YANGON_FOOD_CATEGORIES,
  YANGON_FOOD_ITEMS,
  YANGON_FOOD_VENDORS,
} from "../src/lib/delivery/data/yangon-food-vendors.ts";
import { parseParcelDescription } from "../src/lib/delivery/dispatch/parcel-description.ts";
import { foodPresets } from "../src/lib/delivery/pickup-draft.ts";

test("yangon food vendors dataset contains realistic Yangon establishments", () => {
  assert.ok(YANGON_FOOD_VENDORS.length >= 15);

  const YANGON_BOUNDS = {
    minLat: 16.7,
    maxLat: 17.0,
    minLng: 96.05,
    maxLng: 96.3,
  };

  for (const vendor of YANGON_FOOD_VENDORS) {
    assert.ok(
      vendor.id.startsWith("food_vendor_"),
      `Vendor ID format: ${vendor.id}`,
    );
    assert.ok(vendor.name.length > 2, `Vendor name required: ${vendor.name}`);
    assert.ok(
      vendor.nativeName.length > 2,
      `Burmese native name required: ${vendor.nativeName}`,
    );
    assert.ok(vendor.address.length > 5, `Address required: ${vendor.address}`);
    assert.ok(
      vendor.township.length > 2,
      `Township required: ${vendor.township}`,
    );
    assert.ok(vendor.phone.length > 5, `Phone required: ${vendor.phone}`);
    assert.ok(
      vendor.rating >= 4.0 && vendor.rating <= 5.0,
      `Rating in range: ${vendor.rating}`,
    );

    assert.ok(
      vendor.latitude >= YANGON_BOUNDS.minLat &&
        vendor.latitude <= YANGON_BOUNDS.maxLat,
      `${vendor.name} latitude ${vendor.latitude} should be inside Yangon bounds`,
    );
    assert.ok(
      vendor.longitude >= YANGON_BOUNDS.minLng &&
        vendor.longitude <= YANGON_BOUNDS.maxLng,
      `${vendor.name} longitude ${vendor.longitude} should be inside Yangon bounds`,
    );

    assert.ok(vendor.items.length >= 2, `${vendor.name} has at least 2 items`);
  }
});

test("yangon food items have positive prices, realistic weights and valid flags", () => {
  assert.ok(YANGON_FOOD_ITEMS.length >= 40);

  for (const item of YANGON_FOOD_ITEMS) {
    assert.ok(item.id.length > 2, `Item ID required: ${item.id}`);
    assert.ok(item.name.length > 2, `Item name required: ${item.name}`);
    assert.ok(
      item.nativeName.length > 2,
      `Native name required: ${item.nativeName}`,
    );
    assert.ok(
      item.description.length > 5,
      `Description required: ${item.description}`,
    );
    assert.ok(
      item.priceMmk >= 1000 && item.priceMmk <= 100000,
      `Reasonable MMK price: ${item.priceMmk}`,
    );
    assert.ok(
      item.typicalWeightKg > 0 && item.typicalWeightKg <= 10,
      `Realistic weight: ${item.typicalWeightKg}`,
    );
    assert.equal(typeof item.isPerishable, "boolean");
    assert.equal(typeof item.requiresThermalBag, "boolean");
    assert.equal(typeof item.isFragile, "boolean");
    assert.ok(item.vendorId.length > 0);
    assert.ok(item.vendorName.length > 0);
  }
});

test("food categories cover Yangon food scene archetypes", () => {
  const categoryIds = YANGON_FOOD_CATEGORIES.map((c) => c.id);
  assert.ok(categoryIds.includes("tea_shop"));
  assert.ok(categoryIds.includes("noodles"));
  assert.ok(categoryIds.includes("traditional_curry"));
  assert.ok(categoryIds.includes("bakery_cafe"));
  assert.ok(categoryIds.includes("biryani_halal"));
  assert.ok(categoryIds.includes("grocery_produce"));
  assert.ok(categoryIds.includes("beverages"));

  for (const cat of YANGON_FOOD_CATEGORIES) {
    const matching = getFoodVendorsByCategory(cat.id);
    assert.ok(
      matching.length >= 1,
      `Category ${cat.id} has at least one vendor`,
    );
  }
});

test("searchFoodVendors matches English names, Burmese names, and menu items", () => {
  const luckySeven = searchFoodVendors("Lucky Seven");
  assert.ok(luckySeven.some((v) => v.id === "food_vendor_lucky_seven"));

  const burmeseMohinga = searchFoodVendors("မုန့်ဟင်းခါး");
  assert.ok(
    burmeseMohinga.length >= 2,
    "Found vendors offering Mohinga in Burmese",
  );

  const sanchaungVendors = getFoodVendorsByTownship("Sanchaung");
  assert.ok(sanchaungVendors.length >= 2, "Found vendors in Sanchaung");

  const bahanVendors = getFoodVendorsByTownship("Bahan");
  assert.ok(bahanVendors.length >= 2, "Found vendors in Bahan");
});

test("getFoodItemById retrieves item with its vendor", () => {
  const result = getFoodItemById("l7_mohinga_special");
  assert.ok(result);
  assert.equal(result.name, "Mohinga Special with Duck Egg & Crispy Fritters");
  assert.equal(result.vendor.id, "food_vendor_lucky_seven");
});

test("buildFoodParcelDescription produces strings compatible with dispatch parser", () => {
  const desc = buildFoodParcelDescription({
    vendorName: "Lucky Seven Tea House",
    itemSummary: "Mohinga & crispy fritters",
    size: "small",
    fragile: false,
    requiresThermalBag: true,
    schedule: { day: "today", window: "morning" },
  });

  assert.equal(
    desc,
    "Food, small size · Lucky Seven Tea House · Mohinga & crispy fritters (thermal bag required) · Pickup today, morning",
  );

  const parsed = parseParcelDescription(desc, new Date("2026-10-21T02:00:00Z"));
  assert.equal(parsed.parcelSize, "small");
  assert.equal(parsed.fragile, false);
  assert.equal(parsed.windowLabel, "Morning");
});

test("foodPresets in pickup-draft are valid and well-structured", () => {
  assert.ok(foodPresets.length >= 5);
  for (const preset of foodPresets) {
    assert.ok(preset.label.length > 0);
    assert.ok(preset.details.length > 0);
    assert.ok(["Small", "Medium", "Large"].includes(preset.size));
    assert.equal(typeof preset.fragile, "boolean");
  }
});
