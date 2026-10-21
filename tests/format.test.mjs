import assert from "node:assert/strict";
import test from "node:test";
import { LATE_AFTER_MINUTES, timeUntil } from "../src/lib/delivery/format.ts";

const now = Date.parse("2026-10-20T03:30:00Z");
const at = (minutes) => new Date(now + minutes * 60_000).toISOString();

test("timeUntil counts down to the estimate", () => {
  assert.equal(timeUntil(at(18), now), "18 min");
  assert.equal(timeUntil(at(95), now), "1 hr 35 min");
  assert.equal(timeUntil(at(120), now), "2 hr");
});

test("timeUntil says arriving now only around the estimate", () => {
  assert.equal(timeUntil(at(0), now), "Arriving now");
  assert.equal(timeUntil(at(-LATE_AFTER_MINUTES), now), "Arriving now");
});

test("timeUntil reports a parcel past its estimate as running late", () => {
  assert.equal(timeUntil(at(-(LATE_AFTER_MINUTES + 1)), now), "Running late");
  assert.equal(timeUntil(at(-30), now), "Running late");
});

test("timeUntil handles a missing estimate", () => {
  assert.equal(timeUntil(null, now), "Soon");
});
