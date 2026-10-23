# Jev Classification - Code Examples

Quick reference for developers using Jev classification in the Oern app.

## Client-Side Usage

### In React Components

```typescript
import { classifyComplaint } from "@/lib/delivery/classify-api";
import { useState } from "react";

export function MyComponent() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleClassify(complaintText: string) {
    setLoading(true);
    try {
      const result = await classifyComplaint(complaintText);
      setResult(result);
      console.log("Category:", result.category);
      console.log("Priority:", result.priority);
      console.log("Confidence:", result.categoryConfidence);
      console.log("Mode:", result.mode);
    } catch (error) {
      console.error("Classification failed:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={() => handleClassify("My package is late")}>
        {loading ? "Classifying..." : "Classify"}
      </button>
      {result && <p>Priority: {result.priority}</p>}
    </div>
  );
}
```

## Server-Side Usage

### Direct Import

```typescript
// server-side route or API handler
import {
  classifyWithJev,
  mapJevPriorityToAppPriority,
} from "@/lib/delivery/classify-jev";

async function classifyComplaint(text: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const result = await classifyWithJev(text, apiKey);
  
  return {
    category: result.category,
    jevPriority: result.priority,
    appPriority: mapJevPriorityToAppPriority(result.priority),
    confidence: result.categoryConfidence,
    mode: result.mode,
  };
}
```

### Mock Classification Only

```typescript
import { mockClassify } from "@/lib/delivery/classify-jev";

// Force use of mock (no API call)
const result = mockClassify("My delivery is stuck");
console.log(result.priority); // "P1", "P2", "P3", or "P4"
```

## API Usage

### Direct API Call

```typescript
// POST to /api/classify
const response = await fetch("/api/classify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "My GPS location is wrong",
  }),
});

const result = await response.json();
console.log(result.priority);      // "P1", "P2", "P3", "P4"
console.log(result.category);      // Category key
console.log(result.appPriority);   // "urgent", "high", "normal", "low"
console.log(result.mode);          // "jev" or "mock"
```

## Result Structure

### Classification Result Type

```typescript
interface JevClassificationResult {
  category: string;           // e.g., "delivery_delay"
  categoryConfidence: number | null;  // 0-1 confidence
  priority: string;           // "P1", "P2", "P3", "P4"
  priorityConfidence: number | null;  // 0-1 confidence
  mode: "jev" | "mock";       // Which classifier was used
}

// With app priority mapping
interface ClassificationWithAppPriority extends JevClassificationResult {
  appPriority: "urgent" | "high" | "normal" | "low";
}
```

## Response Examples

### Urgent (P1) Classification

```json
{
  "category": "vehicle_capacity_energy",
  "categoryConfidence": 0.91,
  "priority": "P1",
  "priorityConfidence": 0.87,
  "mode": "jev",
  "appPriority": "urgent"
}
```

### Using Mock (No API Key)

```json
{
  "category": "delivery_delay",
  "categoryConfidence": 0.78,
  "priority": "P3",
  "priorityConfidence": 0.72,
  "mode": "mock",
  "appPriority": "normal"
}
```

## Priority Mapping Reference

```typescript
// Jev → App Priority Mapping
const priorityMap: Record<string, "urgent" | "high" | "normal" | "low"> = {
  "P1": "urgent",
  "P2": "high",
  "P3": "normal",
  "P4": "low",
};

// Or use the helper function
import { mapJevPriorityToAppPriority } from "@/lib/delivery/classify-jev";

const appPriority = mapJevPriorityToAppPriority("P1"); // "urgent"
```

## Category Keys

```typescript
const categories = {
  tracking_visibility: "Delivery tracking & visibility",
  delivery_delay: "Late or stalled delivery",
  driver_assignment: "Driver assignment & availability",
  route_navigation: "Route & navigation problems",
  cod_settlement: "Cash on delivery & settlement",
  vehicle_capacity_energy: "Vehicle load, fuel & battery",
  gps_technical: "GPS & tracking technical issues",
  status_proof: "Order status & proof of delivery",
  notification_alerts: "Notifications & exception alerts",
  access_privacy: "Unauthorized access & privacy",
  delivery_failure: "Failed delivery & recipient contact",
  address_quality: "Address & geocoding quality",
  other_general: "Other / Unclassified request",
};
```

## Error Handling

### Client-Side

```typescript
import { classifyComplaint } from "@/lib/delivery/classify-api";

try {
  const result = await classifyComplaint(text);
  // Use result
} catch (error) {
  if (error instanceof Error) {
    console.error("Classification error:", error.message);
  }
  // Gracefully handle - app already fell back to mock
}
```

### Server-Side

```typescript
import { classifyWithJev } from "@/lib/delivery/classify-jev";

const result = await classifyWithJev(text, process.env.OPENROUTER_API_KEY);
// classifyWithJev automatically:
// - Falls back to mock if API key missing
// - Falls back to mock if API call fails
// - Returns same interface in both cases
```

## Usage in Support App

### Classification Button Handler

```typescript
import { classifyComplaint } from "@/lib/delivery/classify-api";

async function classifySelectedCase(caseDescription: string) {
  try {
    const result = await classifyComplaint(caseDescription);
    console.log(`Classified as ${result.priority} priority`);
    console.log(`Category: ${result.category}`);
    console.log(`Confidence: ${(result.categoryConfidence * 100).toFixed(0)}%`);
    console.log(`Mode: ${result.mode === "jev" ? "AI" : "Pattern"}`);
    
    // Update UI with results
    setClassificationResult(result);
  } catch (error) {
    console.error("Failed to classify:", error);
  }
}
```

### Display Results

```jsx
{classificationResult && (
  <div className="classification-results">
    <p>
      <strong>Priority:</strong> {classificationResult.priority}
    </p>
    <p>
      <strong>Category:</strong> {classificationResult.category}
    </p>
    <p>
      <strong>Confidence:</strong>{" "}
      {(classificationResult.categoryConfidence * 100).toFixed(0)}%
    </p>
    <p>
      <strong>Mode:</strong> {classificationResult.mode.toUpperCase()}
    </p>
  </div>
)}
```

## Environment Setup

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-your-actual-key-here

# Next.js will automatically read this in API routes
```

## Testing Examples

### Test with Different Complaint Types

```typescript
const testCases = [
  "My vehicle is overloaded and unstable - URGENT",  // P1
  "COD amount doesn't match the order",              // P2
  "Tracking page is showing wrong location",        // P3
  "Can you tell me opening hours?",                 // P4
];

for (const text of testCases) {
  const result = await classifyComplaint(text);
  console.log(`"${text}" → ${result.priority}`);
}
```

### Performance Monitoring

```typescript
async function classifyWithTiming(text: string) {
  const start = performance.now();
  const result = await classifyComplaint(text);
  const duration = performance.now() - start;
  
  console.log(`Classification took ${duration.toFixed(2)}ms`);
  console.log(`Mode: ${result.mode} (${result.mode === "jev" ? "API" : "local"})`);
  
  return result;
}
```

## Batch Classification (Future)

```typescript
// Not currently implemented, but could be added
async function batchClassify(texts: string[]) {
  const results = await Promise.all(
    texts.map(text => classifyComplaint(text))
  );
  return results;
}
```

## Type Safety

```typescript
import type {
  JevClassificationResult,
} from "@/lib/delivery/classify-jev";

// Properly typed function
function handleClassificationResult(result: JevClassificationResult) {
  // TypeScript ensures you handle all properties
  const priority: "P1" | "P2" | "P3" | "P4" = result.priority;
  const mode: "jev" | "mock" = result.mode;
}
```

## Additional Resources

- **Taxonomy**: See `./playground/data.js` for TAXONOMY export
- **Priority Policy**: See `./playground/data.js` for PRIORITY_POLICY export
- **Original Implementation**: See `./playground/backend.js` classifyWithJev()
- **Integration Guide**: See `./JEV_INTEGRATION_GUIDE.md`
- **Summary**: See `./JEV_INTEGRATION_SUMMARY.md`
