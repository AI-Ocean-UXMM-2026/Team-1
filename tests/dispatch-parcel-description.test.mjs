import assert from "node:assert/strict";
import test from "node:test";

import { parseParcelDescription } from "../src/lib/delivery/dispatch/parcel-description.ts";

// Keep these vectors identical to the ones in supabase/tests/delivery_workflows.sql.
const vectors = [
  {
    name: "afternoon today",
    text: "Electronics, medium size · Pickup today, afternoon",
    created: "2026-10-21T04:00:00Z", // 10:30 in Yangon
    expect: [
      "medium",
      false,
      "Afternoon",
      "2026-10-21T05:30:00Z",
      "2026-10-21T10:30:00Z",
    ],
  },
  {
    name: "fragile large tomorrow morning",
    text: "Other, large size, fragile · glass shelf · Pickup tomorrow, morning · Note: gate code 12",
    created: "2026-10-21T04:00:00Z",
    expect: [
      "large",
      true,
      "Morning",
      "2026-10-22T01:30:00Z",
      "2026-10-22T05:30:00Z",
    ],
  },
  {
    // 23:00 UTC on the 21st is already 05:30 on the 22nd in Yangon.
    name: "day is relative to Yangon, not UTC",
    text: "Food, small size · Pickup today, evening",
    created: "2026-10-21T23:00:00Z",
    expect: [
      "small",
      false,
      "Evening",
      "2026-10-22T10:30:00Z",
      "2026-10-22T13:30:00Z",
    ],
  },
  {
    name: "free text without the packed pattern",
    text: "two boxes of tea",
    created: "2026-10-21T04:00:00Z",
    expect: [null, false, null, null, null],
  },
];

for (const v of vectors) {
  test(`parseParcelDescription: ${v.name}`, () => {
    const out = parseParcelDescription(v.text, new Date(v.created));
    assert.deepEqual(
      [
        out.parcelSize,
        out.fragile,
        out.windowLabel,
        out.windowStart?.toISOString().replace(".000Z", "Z") ?? null,
        out.windowEnd?.toISOString().replace(".000Z", "Z") ?? null,
      ],
      v.expect,
    );
  });
}

test("null and empty descriptions parse to nothing", () => {
  const out = parseParcelDescription(null, new Date("2026-10-21T04:00:00Z"));
  assert.equal(out.parcelSize, null);
  assert.equal(out.windowStart, null);
});
