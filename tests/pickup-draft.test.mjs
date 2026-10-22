import assert from "node:assert/strict";
import test from "node:test";
import {
  availableWindows,
  defaultSchedule,
  describeParcel,
  emptyDraft,
  isMyanmarPhone,
  parseCod,
  sanitizeDraft,
  validateAddresses,
  validateDetails,
  yangonHour,
} from "../src/lib/delivery/pickup-draft.ts";

// Yangon is UTC+6:30, so 03:30Z is 10:00 there.
const yangon = (hour, minute = 0) =>
  Date.UTC(2026, 9, 20, 0, 0) + ((hour - 6.5) * 60 + minute) * 60_000;

test("yangonHour ignores the device's own timezone", () => {
  assert.equal(yangonHour(Date.parse("2026-10-20T03:30:00Z")), 10);
  assert.equal(yangonHour(Date.parse("2026-10-20T18:00:00Z")), 0.5);
});

test("the default schedule is the next window a rider can still make", () => {
  assert.deepEqual(defaultSchedule(yangon(9)), {
    day: "Today",
    window: "Morning",
  });
  assert.deepEqual(defaultSchedule(yangon(12, 30)), {
    day: "Today",
    window: "Afternoon",
  });
  assert.deepEqual(defaultSchedule(yangon(18)), {
    day: "Today",
    window: "Evening",
  });
  assert.deepEqual(defaultSchedule(yangon(20, 15)), {
    day: "Tomorrow",
    window: "Morning",
  });
  assert.deepEqual(defaultSchedule(yangon(2)), {
    day: "Today",
    window: "Morning",
  });
});

test("windows that have ended today are not offered; tomorrow is always open", () => {
  assert.deepEqual(
    availableWindows("Today", yangon(13)).map((w) => w.value),
    ["Afternoon", "Evening"],
  );
  assert.equal(availableWindows("Tomorrow", yangon(23)).length, 3);
});

test("describeParcel states the window in the form the database parses", () => {
  const draft = {
    ...emptyDraft({ day: "Today", window: "Afternoon" }),
    parcelKind: "Documents",
  };
  assert.match(describeParcel(draft), /Pickup today, afternoon/);
});

test("COD is whole kyat; blank means none", () => {
  assert.equal(parseCod(""), 0);
  assert.equal(parseCod(" 25,000 "), 25000);
  assert.equal(parseCod("12.5"), null);
  assert.equal(parseCod("-5"), null);
  assert.equal(parseCod("1e5"), null);
  assert.equal(parseCod("999999999999"), null);
});

test("Myanmar mobile numbers", () => {
  for (const ok of ["09421555018", "+95 9 421 555 018", "09 421-555-018"])
    assert.equal(isMyanmarPhone(ok), true, ok);
  for (const bad of ["12345", "0812345678", "abc"])
    assert.equal(isMyanmarPhone(bad), false, bad);
});

test("each step reports what is missing, in plain words", () => {
  const draft = emptyDraft({ day: "Today", window: "Evening" });
  assert.deepEqual(Object.keys(validateAddresses(draft)).sort(), [
    "deliveryAddress",
    "pickupAddress",
  ]);
  assert.deepEqual(Object.keys(validateDetails(draft, yangon(10))).sort(), [
    "recipientName",
    "recipientPhone",
  ]);
  const ok = {
    ...draft,
    recipientName: "May",
    recipientPhone: "09421555018",
    codAmount: "25000",
  };
  assert.deepEqual(validateDetails(ok, yangon(10)), {});
  assert.ok(
    validateDetails({ ...ok, codAmount: "12.5" }, yangon(10)).codAmount,
  );
  assert.ok(
    validateDetails({ ...ok, contactPhone: "123" }, yangon(10)).contactPhone,
  );
  // The chosen window ended: evening is over at 21:00.
  assert.ok(validateDetails(ok, yangon(21)).window);
});

test("a stored draft is cleaned before use", () => {
  const fresh = emptyDraft({ day: "Today", window: "Afternoon" });
  const clean = sanitizeDraft(
    {
      pickupAddress: "x".repeat(1000),
      pickupPoint: { latitude: 999, longitude: 0 },
      deliveryPoint: { latitude: 16.8, longitude: 96.1 },
      parcelKind: "Explosives",
      parcelSize: "Large",
      fragile: "yes",
      day: "Someday",
      window: "Evening",
      recipientName: 42,
    },
    fresh,
  );
  assert.equal(clean.pickupAddress.length, 300);
  assert.equal(clean.pickupPoint, null);
  assert.deepEqual(clean.deliveryPoint, { latitude: 16.8, longitude: 96.1 });
  assert.equal(clean.parcelKind, null);
  assert.equal(clean.parcelSize, "Large");
  assert.equal(clean.fragile, false);
  assert.equal(clean.day, "Today");
  assert.equal(clean.window, "Evening");
  assert.equal(clean.recipientName, "");
  assert.equal(sanitizeDraft("junk", fresh), fresh);
});
