import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

/**
 * Jev Classification Result
 * Matches the structure from playground/backend.js classifyWithJev()
 */
export interface JevClassificationResult {
  category: string;
  categoryConfidence: number | null;
  priority: string;
  priorityConfidence: number | null;
  mode: "jev" | "mock";
}

/**
 * Mock classification for fallback when API is unavailable
 * Mirrors the mockClassify() function from playground/data.js
 */
export function mockClassify(text: string): JevClassificationResult {
  const patterns = [
    [
      "cod_settlement",
      /\bcod\b|cash.?on.?delivery|settlement|မတူ.*ငွေ|ငွေ.*ပေးချေ/i,
    ],
    [
      "access_privacy",
      /privacy|unauthorized|data breach|phone.*accessible|ပေါက်ကြား|ကိုယ်ရေး/i,
    ],
    [
      "gps_technical",
      /gps|location.*wrong|location.*stop|ဂျီပီ|တည်နေရာ.*မှား/i,
    ],
    ["delivery_delay", /\blate\b|delay|overdue|36 hour|နောက်ကျ|ကြာသွား/i],
    [
      "tracking_visibility",
      /track|map.*blank|not.*locat|တည်နေရာ.*မပေါ်|tracking.*မပြ/i,
    ],
    ["driver_assignment", /assign|no driver|available|ယာဉ်မောင်း.*မရ/i],
    ["route_navigation", /route|navigation|wrong.*road|လမ်းကြောင်း/i],
    [
      "vehicle_capacity_energy",
      /overload|battery|fuel|unstable|at immediate risk|ဘက်ထရီ/i,
    ],
    ["status_proof", /proof.?of.?delivery|marked.*delivered|status.*blank/i],
    [
      "notification_alerts",
      /notif|alert|message.*not.*receiv|alert.*fail/i,
    ],
    [
      "delivery_failure",
      /failed.*deliver|no.*contact|marked.*unavailable|batch.*fail/i,
    ],
    [
      "address_quality",
      /geocod|wrong.*neighborhood|landmark|address.*missing/i,
    ],
  ] as const;

  let category = "other_general";
  for (const [key, re] of patterns) {
    if (re.test(text)) {
      category = key as string;
      break;
    }
  }

  const critical =
    /\b(threat|injur|accident|fire|assault|breach|at immediate risk|publicly accessible|all.*down)\b|အသက်အန္တရာယ်|ပေါက်ကြား/i.test(
      text,
    );
  const financial =
    [
      "cod_settlement",
      "access_privacy",
    ].includes(category) ||
    /\b(cod|fraud|stolen|unauthorized)\b|ငွေ/i.test(text);
  const highImpact =
    /batch|multiple|every|all (order|deliver|courier)|several|ten driver/i.test(
      text,
    );
  const feedback =
    /suggest|feature request|question|opening hours|would prefer/i.test(text);

  let priority = "P3";

  if (critical) {
    priority = "P1";
  } else if (financial) {
    priority = "P2";
  } else if (highImpact) {
    priority = "P2";
  } else if (feedback) {
    priority = "P4";
  }

  const categoryConfidence = parseFloat(
    (0.55 + Math.random() * 0.4).toFixed(2),
  );
  const priorityConfidence = parseFloat(
    (0.5 + Math.random() * 0.4).toFixed(2),
  );

  return {
    category,
    categoryConfidence,
    priority,
    priorityConfidence,
    mode: "mock",
  };
}

/**
 * Taxonomy mapping from playground/data.js
 * Used for the Jev classification
 */
const TAXONOMY = [
  {
    key: "tracking_visibility",
    label: "Delivery tracking & visibility",
  },
  {
    key: "delivery_delay",
    label: "Late or stalled delivery",
  },
  {
    key: "driver_assignment",
    label: "Driver assignment & availability",
  },
  {
    key: "route_navigation",
    label: "Route & navigation problems",
  },
  {
    key: "cod_settlement",
    label: "Cash on delivery & settlement",
  },
  {
    key: "vehicle_capacity_energy",
    label: "Vehicle load, fuel & battery",
  },
  {
    key: "gps_technical",
    label: "GPS & tracking technical issues",
  },
  {
    key: "status_proof",
    label: "Order status & proof of delivery",
  },
  {
    key: "notification_alerts",
    label: "Notifications & exception alerts",
  },
  {
    key: "access_privacy",
    label: "Unauthorized access & privacy",
  },
  {
    key: "delivery_failure",
    label: "Failed delivery & recipient contact",
  },
  {
    key: "address_quality",
    label: "Address & geocoding quality",
  },
  {
    key: "other_general",
    label: "Other / Unclassified request",
  },
];

const PRIORITY_POLICY = {
  P1: {
    label: "Critical",
    minutes: 15,
    description: "Immediate human escalation",
  },
  P2: {
    label: "High",
    minutes: 60,
    description: "Manager review urgently",
  },
  P3: {
    label: "Medium",
    minutes: 240,
    description: "Operational response in working hours",
  },
  P4: {
    label: "Low",
    minutes: 1440,
    description: "Minor / non-urgent feedback",
  },
};

/**
 * Classify text using Jev API via OpenRouter
 * Falls back to mock classification if API key is not available
 */
export async function classifyWithJev(
  text: string,
  apiKey?: string,
): Promise<JevClassificationResult> {
  // If no API key is provided, use mock classification
  if (!apiKey) {
    return mockClassify(text);
  }

  try {
    const categories = Object.fromEntries(
      TAXONOMY.map((item) => [item.key, item.label]),
    );
    const priorities = Object.fromEntries(
      Object.entries(PRIORITY_POLICY).map(([key, item]) => [
        key,
        item.description,
      ]),
    );

    const client = new TypeSafeClient({
      apiKey,
      baseURL: "https://openrouter.ai/api",
      defaultModel: "jev-1.14",
      timeout: 20000,
      retry: { maxRetries: 1 },
    });

    const response = await client.systemOne({
      state: { complaint: text },
      questions: {
        category: choice(
          "Choose the single best Oern delivery complaint category. Use other_general when unclear.",
          categories,
        ),
        priority: choice(
          "Choose urgency using only facts stated in the complaint.",
          priorities,
        ),
      },
    });

    const category = response.answers.category;
    const priority = response.answers.priority;

    return {
      category: category.choice,
      categoryConfidence: category.confidence,
      priority: priority.choice,
      priorityConfidence: priority.confidence,
      mode: "jev",
    };
  } catch (error) {
    // If Jev API fails, fall back to mock
    console.warn("Jev classification failed, falling back to mock:", error);
    return mockClassify(text);
  }
}

/**
 * Map Jev priority (P1-P4) to app priority levels
 */
export function mapJevPriorityToAppPriority(
  jevPriority: string,
): "urgent" | "high" | "normal" | "low" {
  switch (jevPriority) {
    case "P1":
      return "urgent";
    case "P2":
      return "high";
    case "P3":
      return "normal";
    case "P4":
      return "low";
    default:
      return "normal";
  }
}
