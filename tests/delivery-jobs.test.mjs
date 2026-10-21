import assert from "node:assert/strict";
import test from "node:test";
import { countdownText, nextBatchAt } from "../src/lib/delivery/jobs.ts";

test("next batch is nine hours after the last, less slack, on the hour", () => {
  const next = nextBatchAt("2026-10-23T00:00:00Z");
  assert.equal(next?.toISOString(), "2026-10-23T09:00:00.000Z");
  // Within the 5 minute slack it still runs on the ninth-hour tick.
  const slack = nextBatchAt("2026-10-23T00:00:04Z");
  assert.equal(slack?.toISOString(), "2026-10-23T09:00:00.000Z");
  // A batch that ran more than 5 minutes late misses that tick and waits an hour.
  const late = nextBatchAt("2026-10-23T00:20:00Z");
  assert.equal(late?.toISOString(), "2026-10-23T10:00:00.000Z");
});

test("no earlier batch means the next hourly check", () => {
  assert.equal(nextBatchAt(null), null);
  assert.equal(nextBatchAt("not a date"), null);
  assert.equal(countdownText(null, 0), "at the next hourly check");
});

test("countdown reads in hours and minutes", () => {
  const now = Date.parse("2026-10-23T06:00:00Z");
  assert.equal(countdownText(new Date("2026-10-23T08:15:00Z"), now), "2h 15m");
  assert.equal(countdownText(new Date("2026-10-23T09:00:00Z"), now), "3h");
  assert.equal(countdownText(new Date("2026-10-23T06:40:00Z"), now), "40m");
  assert.equal(countdownText(new Date("2026-10-23T05:00:00Z"), now), "any minute now");
});
