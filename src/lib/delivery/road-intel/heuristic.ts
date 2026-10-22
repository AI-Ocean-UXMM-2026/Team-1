import type { RoadAction, RoadCategory, RoadSeverity } from "./types.ts";

export type NoteReading = {
  category: RoadCategory;
  severity: RoadSeverity;
  action: RoadAction;
  delayMinutes: number;
  radiusMeters: number;
  /** How long the condition is likely to last, in minutes. */
  ttlMinutes: number;
  confidence: number;
  /** The note says the problem is over. */
  cleared: boolean;
  signals: string[];
};

type Rule = { category: RoadCategory; pattern: RegExp };

// English and Burmese phrases riders use. Order matters: the first rule that
// matches wins the category, so the most specific hazards come first.
const CATEGORY_RULES: Rule[] = [
  {
    category: "flooding",
    pattern:
      /flood|water ?logg|submerg|knee[- ]deep|waist[- ]deep|ရေကြီး|ရေလျှံ|ရေလွှမ်း|ရေဝင်/i,
  },
  {
    category: "closure",
    pattern:
      /clos(ed|ure)|block(ed|age)?|barricade|no (entry|passage|access)|cannot pass|can't pass|impassable|လမ်းပိတ်|ပိတ်ထား|ဖြတ်လို့မရ/i,
  },
  {
    category: "roadwork",
    pattern:
      /road ?work|construction|digging|excavat|pothole|repair|paving|asphalt|ဆောက်လုပ်ရေး|လမ်းပြင်|ကျင်းတူး|လမ်းတူး/i,
  },
  {
    category: "hazard",
    pattern:
      /accident|crash|collision|broken ?down|breakdown|stalled|debris|fallen tree|spill|oil|police|checkpoint|ယာဉ်တိုက်|မတော်တဆ|ကားပျက်|သစ်ပင်လဲ/i,
  },
  {
    category: "congestion",
    pattern:
      /traffic|jam|congest|gridlock|queue|slow|crawl|standstill|bumper|rush hour|ကားကြပ်|ယာဉ်ကြောပိတ်ဆို့|ကားပိတ်|ပိတ်ဆို့/i,
  },
];

const CLEARED =
  /\b(cleared|clear now|all clear|reopened|re-opened|back to normal|moving again|flowing|no longer|resolved|fixed)\b|ပြန်ဖွင့်|ပြီးသွား|ရှင်းသွား/i;
const NEGATED =
  /\b(not|no|isn'?t|aren'?t|without)\s+(\w+\s+)?(blocked|closed|jam|jammed|flooded|heavy|bad)/i;
const SEVERE =
  /completely|totally|fully|both (lanes|directions|ways)|impassable|stuck|standstill|gridlock|cannot pass|can't pass|waist|knee|heavy|very|ပြင်းထန်|လုံးဝ/i;
const MILD =
  /slight|small|minor|little|a bit|somewhat|one lane|single lane|partial|moving slowly|အနည်းငယ်/i;

const DURATION = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i;

function readDurationMinutes(text: string): number | null {
  const match = DURATION.exec(text);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return /^h/i.test(match[2]) ? amount * 60 : amount;
}

const BASE: Record<
  RoadCategory,
  { delay: Record<RoadSeverity, number>; radius: number; ttl: number }
> = {
  congestion: {
    delay: { low: 2, medium: 5, high: 10, blocked: 20 },
    radius: 250,
    ttl: 45,
  },
  closure: {
    delay: { low: 5, medium: 10, high: 20, blocked: 40 },
    radius: 120,
    ttl: 180,
  },
  roadwork: {
    delay: { low: 1.5, medium: 3.5, high: 7, blocked: 15 },
    radius: 150,
    ttl: 360,
  },
  flooding: {
    delay: { low: 3, medium: 8, high: 18, blocked: 40 },
    radius: 300,
    ttl: 240,
  },
  hazard: {
    delay: { low: 1, medium: 2.5, high: 5, blocked: 10 },
    radius: 100,
    ttl: 90,
  },
};

const SEVERITIES: RoadSeverity[] = ["low", "medium", "high", "blocked"];
const step = (severity: RoadSeverity, by: number): RoadSeverity =>
  SEVERITIES[
    Math.max(
      0,
      Math.min(SEVERITIES.length - 1, SEVERITIES.indexOf(severity) + by),
    )
  ];

/**
 * Rule-based reading of a road note. It is the engine's fallback when no
 * language model is available and its sanity check when one is: the model's
 * answer is compared against it, never trusted blindly.
 */
export function readRoadNote(input: {
  description: string;
  category: RoadCategory;
  severity: RoadSeverity;
}): NoteReading {
  const text = input.description.trim();
  const signals: string[] = [];

  let category = input.category;
  const ruled = CATEGORY_RULES.find((rule) => rule.pattern.test(text));
  if (ruled && ruled.category !== input.category) {
    // The rider's own pick is kept unless the words clearly say otherwise
    category = ruled.category;
    signals.push(`wording points to ${ruled.category}`);
  }

  const cleared = CLEARED.test(text);
  const negated = NEGATED.test(text);
  let severity = input.severity;
  if (SEVERE.test(text)) {
    severity = step(severity, 1);
    signals.push("severe wording");
  } else if (MILD.test(text)) {
    severity = step(severity, -1);
    signals.push("mild wording");
  }
  if (negated) {
    severity = step(severity, -2);
    signals.push("negated wording");
  }
  if (cleared) signals.push("note says it is over");

  const base = BASE[category];
  const stated = readDurationMinutes(text);
  const ttlMinutes = Math.round(
    Math.min(720, Math.max(10, stated ?? base.ttl)),
  );
  if (stated) signals.push(`stated duration ${Math.round(stated)} min`);

  const delayMinutes = cleared ? 0 : base.delay[severity];
  const action: RoadAction = cleared
    ? "ignore"
    : severity === "blocked" || (category === "closure" && severity === "high")
      ? "avoid"
      : severity === "low"
        ? "monitor"
        : "delay";

  // Longer, specific notes carry more information than "bad"
  const words = text.split(/\s+/).filter(Boolean).length;
  let confidence = 0.45 + Math.min(0.2, words * 0.025);
  if (ruled) confidence += ruled.category === input.category ? 0.1 : 0.03;
  if (stated) confidence += 0.05;
  if (negated) confidence -= 0.15;

  return {
    category,
    severity,
    action,
    delayMinutes,
    radiusMeters: base.radius,
    ttlMinutes,
    confidence:
      Math.round(Math.max(0.2, Math.min(0.85, confidence)) * 100) / 100,
    cleared,
    signals,
  };
}
