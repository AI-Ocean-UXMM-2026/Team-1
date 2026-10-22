import assert from "node:assert/strict";
import test from "node:test";
import {
  LATE_AFTER_MINUTES,
  relativeAgo,
  timeUntil,
} from "../src/lib/delivery/format.ts";

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

test("relativeAgo reads naturally and falls back to a date", () => {
  assert.equal(relativeAgo(at(0), now), "Just now");
  assert.equal(relativeAgo(at(-12), now), "12 min ago");
  assert.equal(relativeAgo(at(-180), now), "3 h ago");
  assert.match(relativeAgo(at(-60 * 48), now), /\d/);
  assert.equal(relativeAgo(null, now), "");
  assert.equal(relativeAgo("nonsense", now), "");
});
