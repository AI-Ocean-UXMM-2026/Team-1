/*
 * TypeScript twin of private.parse_parcel_description (SQL). The customer
 * pickup form packs size, fragility and the pickup slot into parcel_description;
 * both parsers must agree, and tests/dispatch-parcel-description.test.mjs and
 * the SQL workflow test share the same vectors.
 */

export type ParsedParcel = {
  parcelSize: "small" | "medium" | "large" | null;
  fragile: boolean;
  windowLabel: "Morning" | "Afternoon" | "Evening" | null;
  windowStart: Date | null;
  windowEnd: Date | null;
};

/** Asia/Yangon is UTC+06:30 all year (no daylight saving). */
const YANGON_OFFSET_MS = 6.5 * 60 * 60 * 1000;

const WINDOWS = {
  morning: { label: "Morning", from: 8, to: 12 },
  afternoon: { label: "Afternoon", from: 12, to: 17 },
  evening: { label: "Evening", from: 17, to: 20 },
} as const;

export function parseParcelDescription(
  description: string | null | undefined,
  createdAt: Date,
): ParsedParcel {
  const text = description ?? "";
  const size = /(small|medium|large) size/i.exec(text);
  const schedule = /Pickup (today|tomorrow), (morning|afternoon|evening)/i.exec(
    text,
  );

  const result: ParsedParcel = {
    parcelSize: size
      ? (size[1].toLowerCase() as ParsedParcel["parcelSize"])
      : null,
    fragile: /\bfragile\b/i.test(text),
    windowLabel: null,
    windowStart: null,
    windowEnd: null,
  };
  if (!schedule || Number.isNaN(createdAt.getTime())) return result;

  const local = new Date(createdAt.getTime() + YANGON_OFFSET_MS);
  const dayOffset = schedule[1].toLowerCase() === "tomorrow" ? 1 : 0;
  const window = WINDOWS[schedule[2].toLowerCase() as keyof typeof WINDOWS];
  const at = (hour: number) =>
    new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() + dayOffset,
        hour,
      ) - YANGON_OFFSET_MS,
    );
  result.windowLabel = window.label;
  result.windowStart = at(window.from);
  result.windowEnd = at(window.to);
  return result;
}
