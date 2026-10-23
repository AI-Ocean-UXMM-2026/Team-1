# Jev Integration Guide

## Overview

This document describes the integration of Jev AI-powered complaint classification into the Oern app. Jev automatically classifies delivery complaints into categories and urgency levels (P1-P4).

## What is Jev?

Jev is a specialized language model accessed via OpenRouter API that classifies delivery complaints into:

- **Categories**: 13 types of delivery issues (tracking, delays, driver assignment, GPS, COD, etc.)
- **Priority Levels**: P1 (Critical), P2 (High), P3 (Medium), P4 (Low)
- **Confidence Scores**: Probability estimates for both category and priority

## Files Added

### 1. **Classification Service** (`./src/lib/delivery/classify-jev.ts`)
Core classification logic with:
- `classifyWithJev()` - Main function that calls Jev API via OpenRouter
- `mockClassify()` - Fallback keyword-based classifier (no API needed)
- `mapJevPriorityToAppPriority()` - Maps Jev priorities to app priorities

**Features:**
- Automatic fallback to mock if API unavailable
- Supports text up to 2000 characters
- Returns confidence scores
- Includes full taxonomy and priority policies

### 2. **API Route** (`./src/app/api/classify/route.ts`)
Next.js API endpoint for server-side classification:
- POST `/api/classify`
- Input: `{ text: string }`
- Output: Classification result with app priority mapping

### 3. **Client Hook** (`./src/lib/delivery/classify-api.ts`)
Lightweight client-side helper to call the API endpoint

### 4. **Updated Support App** (`./src/components/delivery/support-app.tsx`)
Enhanced UI with:
- "Classify with Jev" button in support case detail panel
- Classification result display showing:
  - Mode (JEV or MOCK)
  - Category
  - Suggested priority
  - Confidence percentage
- Loading state during classification

## Setup Instructions

### 1. Environment Configuration

Add to your `.env.local`:

```env
# Optional: For Jev via OpenRouter
OPENROUTER_API_KEY=your-api-key-here
```

**Without API key:** The system automatically falls back to `mockClassify()` using pattern matching.

**With API key:** Classification uses Jev-1.14 model via OpenRouter.

### 2. No Additional Dependencies

The required `@typesafe-ai/sdk` is already in `package.json`.

### 3. Verify Installation

Check that all files exist:

```bash
ls ./src/lib/delivery/classify-jev.ts
ls ./src/app/api/classify/route.ts
ls ./src/lib/delivery/classify-api.ts
```

## Usage

### For Support Desk Users

1. Open the support app (`/support`)
2. Select a support case
3. Click **"Classify with Jev"** button
4. View classification results:
   - **Mode**: Shows "JEV" if API available, "MOCK" for fallback
   - **Category**: Type of delivery issue
   - **Suggested Priority**: P1-P4 level
   - **Confidence**: Probability score (%)

### For Developers

#### Import and use in components:

```typescript
import { classifyComplaint } from "@/lib/delivery/classify-api";

// In a component
const result = await classifyComplaint("My package is lost");
console.log(result.priority);    // "P1", "P2", "P3", or "P4"
console.log(result.category);    // "delivery_failure", etc.
console.log(result.mode);        // "jev" or "mock"
```

#### Use server-side:

```typescript
import {
  classifyWithJev,
  mapJevPriorityToAppPriority,
} from "@/lib/delivery/classify-jev";

const result = await classifyWithJev(text, process.env.OPENROUTER_API_KEY);
const appPriority = mapJevPriorityToAppPriority(result.priority);
```

## Category Taxonomy

Jev classifies complaints into these 13 categories:

| Key | Label |
|-----|-------|
| `tracking_visibility` | Delivery tracking & visibility |
| `delivery_delay` | Late or stalled delivery |
| `driver_assignment` | Driver assignment & availability |
| `route_navigation` | Route & navigation problems |
| `cod_settlement` | Cash on delivery & settlement |
| `vehicle_capacity_energy` | Vehicle load, fuel & battery |
| `gps_technical` | GPS & tracking technical issues |
| `status_proof` | Order status & proof of delivery |
| `notification_alerts` | Notifications & exception alerts |
| `access_privacy` | Unauthorized access & privacy |
| `delivery_failure` | Failed delivery & recipient contact |
| `address_quality` | Address & geocoding quality |
| `other_general` | Other / Unclassified request |

## Priority Mapping

**Jev Priority → App Priority:**

| Jev | App | Label | Response Time |
|-----|-----|-------|----------------|
| P1 | urgent | Critical | 15 minutes |
| P2 | high | High | 60 minutes |
| P3 | normal | Medium | 4 hours |
| P4 | low | Low | 24 hours |

## Fallback Behavior

If Jev API is unavailable or API key is missing:

1. `mockClassify()` runs keyword-based pattern matching
2. Returns same interface as Jev (category, priority, confidence)
3. Sets `mode: "mock"` instead of `mode: "jev"`
4. Confidence scores are estimated (0.55-0.95 range)

**Mock Patterns:**
- Detects P1 keywords: "threat", "fire", "injury", "security breach", etc.
- Detects financial issues: "COD mismatch", "fraud", etc.
- Detects high-impact: "batch", "multiple orders", "all drivers", etc.
- Defaults to P3 or P4 based on patterns

## Testing

### Manual Testing

1. Start the dev server: `npm run dev`
2. Navigate to `/support`
3. Select a support case
4. Click "Classify with Jev"
5. Check the result display

### Testing with Mock (No API Key)

1. Remove or don't set `OPENROUTER_API_KEY`
2. All classifications will use `mockClassify()`
3. Results show `mode: "MOCK"`

### Testing with Real API

1. Set `OPENROUTER_API_KEY` in `.env.local`
2. Classifications use Jev-1.14
3. Results show `mode: "JEV"`

## Architecture

```
User Action (Click "Classify with Jev")
    ↓
support-app.tsx (Component)
    ↓
classifyComplaint() → /api/classify (Client Hook)
    ↓
/api/classify/route.ts (API Endpoint)
    ↓
classifyWithJev() (Service)
    ├─→ TypeSafeClient (Jev API) [if API key present]
    └─→ mockClassify() [if no API or request fails]
    ↓
Result displayed in UI
```

## Performance Considerations

- **Jev API calls**: ~2-3 seconds typically
- **Mock classification**: <100ms (instant)
- **Confidence scores**: Higher with Jev, estimated with mock
- **Rate limiting**: OpenRouter API has standard rate limits

## Troubleshooting

### "Classification failed" error

1. Check `OPENROUTER_API_KEY` is set (if using Jev)
2. Check network connection
3. Try refresh the page
4. Falls back to mock mode automatically

### Empty classification results

1. Ensure you have a support case selected
2. Description field should have text (minimum 5 characters recommended)
3. Check browser console for errors

### Mode always shows "MOCK"

Either:
1. `OPENROUTER_API_KEY` is not set (expected)
2. API is unreachable (check network)
3. Valid key but API quota exceeded

## Future Enhancements

Potential improvements:

1. **Database storage**: Save classification results to `support_cases` table
2. **Bulk classification**: Classify multiple cases in batch
3. **Fine-tuning**: Train custom model on Oern complaint data
4. **Integration**: Auto-assign cases based on category and queue
5. **Multi-language**: Extend mock patterns for Burmese, Thai, etc.
6. **Analytics**: Dashboard showing classification accuracy and trends

## References

- **Jev Model**: Accessed via TypeSafeClient
- **OpenRouter API**: https://openrouter.ai/api
- **TypeSafeClient Docs**: `node_modules/@typesafe-ai/sdk`
- **Playground**: `./playground/backend.js` (original implementation)
- **Sample Data**: `./playground/data.js` (taxonomy and policies)
