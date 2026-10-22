// playground/data.js — Prototype seed data
// Complaints sampled from complaints_train.csv (SYNTHETIC_NOT_REAL data).
// Category taxonomy from category_taxonomy.json. Priority policy from priority_policy.json.
// All data is illustrative only — not validated production ground truth.

export const TAXONOMY = [
  {
    key: "tracking_visibility",
    label: "Delivery tracking & visibility",
    queue: "Tracking Desk",
  },
  {
    key: "delivery_delay",
    label: "Late or stalled delivery",
    queue: "Dispatch Manager",
  },
  {
    key: "driver_assignment",
    label: "Driver assignment & availability",
    queue: "Dispatch Manager",
  },
  {
    key: "route_navigation",
    label: "Route & navigation problems",
    queue: "Dispatch Manager",
  },
  {
    key: "cod_settlement",
    label: "Cash on delivery & settlement",
    queue: "Finance Officer",
  },
  {
    key: "vehicle_capacity_energy",
    label: "Vehicle load, fuel & battery",
    queue: "Fleet / Dispatch Manager",
  },
  {
    key: "gps_technical",
    label: "GPS & tracking technical issues",
    queue: "Technical Support",
  },
  {
    key: "status_proof",
    label: "Order status & proof of delivery",
    queue: "Delivery Operations",
  },
  {
    key: "notification_alerts",
    label: "Notifications & exception alerts",
    queue: "Technical Support",
  },
  {
    key: "access_privacy",
    label: "Unauthorized access & privacy",
    queue: "Security / System Admin",
  },
  {
    key: "delivery_failure",
    label: "Failed delivery & recipient contact",
    queue: "Delivery Operations",
  },
  {
    key: "address_quality",
    label: "Address & geocoding quality",
    queue: "Dispatch Manager",
  },
  {
    key: "other_general",
    label: "Other / Unclassified request",
    queue: "Human Triage",
  },
];

export const PRIORITY_POLICY = {
  P1: {
    label: "Critical",
    minutes: 15,
    hex: "#dc2626",
    bg: "#fef2f2",
    description: "Immediate human escalation",
  },
  P2: {
    label: "High",
    minutes: 60,
    hex: "#ea580c",
    bg: "#fff7ed",
    description: "Manager review urgently",
  },
  P3: {
    label: "Medium",
    minutes: 240,
    hex: "#ca8a04",
    bg: "#fefce8",
    description: "Operational response in working hours",
  },
  P4: {
    label: "Low",
    minutes: 1440,
    hex: "#16a34a",
    bg: "#f0fdf4",
    description: "Minor / non-urgent feedback",
  },
};

export const USERS = [
  {
    id: "u-admin",
    name: "Admin User",
    role: "admin",
    email: "admin@oern.mm",
    branch: "Yangon HQ",
  },
  {
    id: "u-dispatch",
    name: "Ma Thandar",
    role: "dispatcher",
    email: "dispatch@oern.mm",
    branch: "Yangon HQ",
  },
  {
    id: "u-driver1",
    name: "Ko Zaw Lin",
    role: "driver",
    email: "driver1@oern.mm",
    branch: "Yangon HQ",
  },
  {
    id: "u-finance",
    name: "U Hla Myint",
    role: "finance",
    email: "finance@oern.mm",
    branch: "Yangon HQ",
  },
  {
    id: "u-seller1",
    name: "Ma Aye Aye Shop",
    role: "seller",
    email: "seller1@oern.mm",
    branch: "Yangon HQ",
  },
];

export const ORDERS = [
  {
    id: "ORD-001",
    trackingNumber: "TRK-AA-001",
    status: "in_transit",
    seller: "Ma Aye Aye Shop",
    driver: "Ko Zaw Lin",
    recipient: "Daw Khin Ma",
    cod: { expected: 35000, collected: 35000, settled: 35000, currency: "MMK" },
    gps: {
      lat: 16.8409,
      lng: 96.1735,
      recordedAt: new Date(Date.now() - 2 * 60000).toISOString(),
      stale: false,
    },
    events: [
      { status: "order_created", at: "2024-01-15T08:00:00Z" },
      { status: "picked_up", at: "2024-01-15T09:30:00Z" },
      { status: "in_transit", at: "2024-01-15T10:00:00Z" },
    ],
  },
  {
    id: "ORD-002",
    trackingNumber: "TRK-BB-002",
    status: "delivered",
    seller: "Ma Aye Aye Shop",
    driver: "Ko Zaw Lin",
    recipient: "Ko Aung Kyaw",
    cod: { expected: 18500, collected: 18500, settled: 18500, currency: "MMK" },
    gps: {
      lat: 16.87,
      lng: 96.18,
      recordedAt: new Date(Date.now() - 95 * 60000).toISOString(),
      stale: true,
    },
    events: [
      { status: "order_created", at: "2024-01-14T07:00:00Z" },
      { status: "picked_up", at: "2024-01-14T09:00:00Z" },
      { status: "delivered", at: "2024-01-14T14:30:00Z" },
    ],
  },
  {
    id: "ORD-003",
    trackingNumber: "TRK-CC-003",
    status: "failed",
    seller: "Ko Min Thu Store",
    driver: "Ma Ei Phyu",
    recipient: "U Tin Maung",
    cod: { expected: 52000, collected: 0, settled: 0, currency: "MMK" },
    gps: null,
    events: [
      { status: "order_created", at: "2024-01-13T08:00:00Z" },
      { status: "picked_up", at: "2024-01-13T11:00:00Z" },
      { status: "failed", at: "2024-01-13T15:00:00Z" },
    ],
  },
];

let _nextId = 100;
function mkId() {
  return `DEMO-C${String(_nextId++).padStart(4, "0")}`;
}

export const SEED_COMPLAINTS = [
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    text: "My overloaded vehicle is unstable and I am at immediate risk on the road.",
    language: "en",
    category: "vehicle_capacity_energy",
    priority: "P1",
    proposedPriority: "P1",
    confidence: 0.91,
    priorityConfidence: 0.87,
    mode: "mock",
    reviewRequired: true,
    policyReasons: [
      "Critical safety phrase detected — requires verification",
      "P1 requires explicit human review before resolution",
    ],
    status: "NEW",
    queue: "Fleet / Dispatch Manager",
    orderId: "ORD-001",
    reporterRole: "driver",
    assignedTo: null,
    resolution: null,
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 5 * 60000).toISOString(),
      },
    ],
  },
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    text: "We confirmed customer phone numbers are publicly accessible without logging in.",
    language: "en",
    category: "access_privacy",
    priority: "P1",
    proposedPriority: "P1",
    confidence: 0.95,
    priorityConfidence: 0.92,
    mode: "mock",
    reviewRequired: true,
    policyReasons: [
      "Financial or security complaint requires human review",
      "P1 requires explicit human review before resolution",
    ],
    status: "IN_REVIEW",
    queue: "Security / System Admin",
    orderId: null,
    reporterRole: "seller",
    assignedTo: "u-admin",
    resolution: null,
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 15 * 60000).toISOString(),
      },
      {
        from: "NEW",
        to: "IN_REVIEW",
        note: "Assigned to admin for P1 review",
        at: new Date(Date.now() - 10 * 60000).toISOString(),
      },
    ],
  },
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
    text: "The COD amount collected by the driver does not match the order total. Difference of 15,000 MMK.",
    language: "en",
    category: "cod_settlement",
    priority: "P2",
    proposedPriority: "P2",
    confidence: 0.88,
    priorityConfidence: 0.79,
    mode: "mock",
    reviewRequired: true,
    policyReasons: ["Financial or security complaint requires human review"],
    status: "IN_PROGRESS",
    queue: "Finance Officer",
    orderId: "ORD-002",
    reporterRole: "seller",
    assignedTo: "u-finance",
    resolution: null,
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 45 * 60000).toISOString(),
      },
      {
        from: "NEW",
        to: "IN_REVIEW",
        note: "Assigned to finance officer",
        at: new Date(Date.now() - 30 * 60000).toISOString(),
      },
      {
        from: "IN_REVIEW",
        to: "IN_PROGRESS",
        note: "Finance officer investigating",
        at: new Date(Date.now() - 20 * 60000).toISOString(),
      },
    ],
  },
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    text: "Tracking စာမျက်နှာမှာ ကျွန်တော့်ပါဆယ်ရဲ့ တည်နေရာ မပေါ်ပါဘူး။",
    language: "my",
    category: "tracking_visibility",
    priority: "P3",
    proposedPriority: "P3",
    confidence: 0.82,
    priorityConfidence: 0.74,
    mode: "mock",
    reviewRequired: false,
    policyReasons: [],
    status: "NEW",
    queue: "Tracking Desk",
    orderId: "ORD-001",
    reporterRole: "recipient",
    assignedTo: null,
    resolution: null,
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 2 * 3600000).toISOString(),
      },
    ],
  },
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    text: "My parcel was supposed to arrive yesterday. The status has been 'in transit' for 36 hours.",
    language: "en",
    category: "delivery_delay",
    priority: "P3",
    proposedPriority: "P3",
    confidence: 0.79,
    priorityConfidence: 0.7,
    mode: "mock",
    reviewRequired: false,
    policyReasons: [],
    status: "RESOLVED",
    queue: "Dispatch Manager",
    orderId: "ORD-002",
    reporterRole: "recipient",
    assignedTo: "u-dispatch",
    resolution: "Driver re-assigned. Parcel delivered at 3pm.",
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
      {
        from: "NEW",
        to: "IN_PROGRESS",
        note: "Dispatcher investigating",
        at: new Date(Date.now() - 2 * 3600000).toISOString(),
      },
      {
        from: "IN_PROGRESS",
        to: "RESOLVED",
        note: "Driver re-assigned. Parcel delivered at 3pm.",
        at: new Date(Date.now() - 1 * 3600000).toISOString(),
      },
    ],
  },
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    text: "GPS ပြနေတဲ့ တည်နေရာက မှားနေပါတယ်။ App က ကျွန်တော်ကို မြို့ပြင်မှာ ပြနေပါတယ်။",
    language: "my",
    category: "gps_technical",
    priority: "P3",
    proposedPriority: "P3",
    confidence: 0.62,
    priorityConfidence: 0.58,
    mode: "mock",
    reviewRequired: true,
    policyReasons: ["Low classification confidence"],
    status: "IN_REVIEW",
    queue: "Technical Support",
    orderId: null,
    reporterRole: "driver",
    assignedTo: "u-dispatch",
    resolution: null,
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 4 * 3600000).toISOString(),
      },
      {
        from: "NEW",
        to: "IN_REVIEW",
        note: "Low confidence — human review",
        at: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
    ],
  },
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    text: "What are the customer service opening hours at Oern?",
    language: "en",
    category: "other_general",
    priority: "P4",
    proposedPriority: "P4",
    confidence: 0.68,
    priorityConfidence: 0.65,
    mode: "mock",
    reviewRequired: false,
    policyReasons: [],
    status: "RESOLVED",
    queue: "Human Triage",
    orderId: null,
    reporterRole: "recipient",
    assignedTo: "u-dispatch",
    resolution: "Our support hours are 8AM–8PM daily.",
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 6 * 3600000).toISOString(),
      },
      {
        from: "NEW",
        to: "RESOLVED",
        note: "Our support hours are 8AM–8PM daily.",
        at: new Date(Date.now() - 5 * 3600000).toISOString(),
      },
    ],
  },
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    text: "A batch of deliveries failed without drivers recording any reason.",
    language: "en",
    category: "delivery_failure",
    priority: "P2",
    proposedPriority: "P2",
    confidence: 0.84,
    priorityConfidence: 0.77,
    mode: "mock",
    reviewRequired: false,
    policyReasons: [],
    status: "NEW",
    queue: "Delivery Operations",
    orderId: "ORD-003",
    reporterRole: "dispatcher",
    assignedTo: null,
    resolution: null,
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 90 * 60000).toISOString(),
      },
    ],
  },
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    text: "Several buyers missed delivery because all arrival alerts failed this morning.",
    language: "en",
    category: "notification_alerts",
    priority: "P2",
    proposedPriority: "P2",
    confidence: 0.77,
    priorityConfidence: 0.71,
    mode: "mock",
    reviewRequired: false,
    policyReasons: ["Multiple orders affected"],
    status: "IN_PROGRESS",
    queue: "Technical Support",
    orderId: null,
    reporterRole: "seller",
    assignedTo: "u-dispatch",
    resolution: null,
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 5 * 3600000).toISOString(),
      },
      {
        from: "NEW",
        to: "IN_PROGRESS",
        note: "Investigating alert failures",
        at: new Date(Date.now() - 4 * 3600000).toISOString(),
      },
    ],
  },
  {
    id: mkId(),
    createdAt: new Date(Date.now() - 7 * 3600000).toISOString(),
    text: "Incorrect geocoding is sending ten drivers to the wrong neighborhood.",
    language: "en",
    category: "address_quality",
    priority: "P2",
    proposedPriority: "P2",
    confidence: 0.8,
    priorityConfidence: 0.72,
    mode: "mock",
    reviewRequired: false,
    policyReasons: [],
    status: "NEW",
    queue: "Dispatch Manager",
    orderId: null,
    reporterRole: "dispatcher",
    assignedTo: null,
    resolution: null,
    history: [
      {
        from: null,
        to: "NEW",
        note: "Complaint submitted",
        at: new Date(Date.now() - 7 * 3600000).toISOString(),
      },
    ],
  },
];

// Keyword-based mock classifier — clearly labeled "mock", no Jev API call
export function mockClassify(text) {
  const patterns = [
    [
      "cod_settlement",
      /\bcod\b|cash.?on.?delivery|settlement|မတူ.*ငွေ|ငွေ.*ပေးချေ/i,
    ],
    [
      "access_privacy",
      /privacy|unauthorized|data breach|phone.*accessible|ပေါက်ကြား|ကိုယ်ရေး/i,
    ],
    ["gps_technical", /gps|location.*wrong|location.*stop|ဂျီပီ|တည်နေရာ.*မှား/i],
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
    ["notification_alerts", /notif|alert|message.*not.*receiv|alert.*fail/i],
    [
      "delivery_failure",
      /failed.*deliver|no.*contact|marked.*unavailable|batch.*fail/i,
    ],
    [
      "address_quality",
      /geocod|wrong.*neighborhood|landmark|address.*missing/i,
    ],
  ];

  let category = "other_general";
  for (const [key, re] of patterns) {
    if (re.test(text)) {
      category = key;
      break;
    }
  }

  const tax = TAXONOMY.find((t) => t.key === category);
  const critical =
    /\b(threat|injur|accident|fire|assault|breach|at immediate risk|publicly accessible|all.*down)\b|အသက်အန္တရာယ်|ပေါက်ကြား/i.test(
      text,
    );
  const financial =
    ["cod_settlement", "access_privacy"].includes(category) ||
    /\b(cod|fraud|stolen|unauthorized)\b|ငွေ/i.test(text);
  const highImpact =
    /batch|multiple|every|all (order|deliver|courier)|several|ten driver/i.test(
      text,
    );
  const feedback =
    /suggest|feature request|question|opening hours|would prefer/i.test(text);

  let priority = "P3";
  const reasons = [];

  if (critical) {
    priority = "P1";
    reasons.push(
      "Critical safety or security phrase detected — requires verification",
    );
    reasons.push("P1 requires explicit human review before resolution");
  } else if (financial) {
    priority = "P2";
    reasons.push("Financial or security complaint requires human review");
  } else if (highImpact) {
    priority = "P2";
    reasons.push("Multiple orders/couriers affected — elevated to P2");
  } else if (feedback) {
    priority = "P4";
  }

  const confidence = parseFloat((0.55 + Math.random() * 0.4).toFixed(2));
  const priorityConfidence = parseFloat((0.5 + Math.random() * 0.4).toFixed(2));

  if (confidence < 0.65)
    reasons.push("Low classification confidence — human review recommended");

  return {
    category,
    categoryLabel: tax?.label || category,
    priority,
    proposedPriority: priority,
    confidence,
    priorityConfidence,
    mode: "mock", // ALWAYS labeled "mock"
    reviewRequired: reasons.length > 0 || category === "access_privacy",
    policyReasons: reasons,
    queue: tax?.queue || "Human Triage",
  };
}
