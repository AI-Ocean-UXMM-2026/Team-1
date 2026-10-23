# Manager Dashboard - Classification Widget Visual Guide

## Dashboard Layout with Widget

```
MANAGER DASHBOARD (/manager/home)
═════════════════════════════════════════════════════════════════════════════

┌─ Summary Metrics ────────────────────────────────────────────────────────┐
│ 📦 Moving: 12  │  ✓ Delivered: 45  │  ⚠ At Risk: 3  │  🆘 Urgent: 2    │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Left Column ────────────────┬─ Right Column ────────────────────────────┐
│                              │                                          │
│ ┌─ Alerts ────────────────┐  │  ┌─ Operational Health ─────────────┐   │
│ │ • GPS stale (2 riders)  │  │  │ • Rider GPS: ✓ Normal           │   │
│ │ • Delayed (+1 order)    │  │  │ • Dispatch: ⚠ Needs rider (3)   │   │
│ │ • COD variance (+$5.2k) │  │  │ • Traffic delays: ⚠ (1 active)  │   │
│ └─────────────────────────┘  │  │ • Cash settlement: ✓ Normal     │   │
│                              │  │ • Road reports: ⚠ 2 to review   │   │
│ ┌─ Recent Deliveries ─────┐  │  └────────────────────────────────┘   │
│ │ TRK-001: ✓ Delivered   │  │                                        │
│ │ TRK-002: 📍 In transit  │  │  ┌─ Capacity ─────────────────────┐   │
│ │ TRK-003: ⚠ Late        │  │  │ • Riders: 5 / 12 available     │   │
│ │ TRK-004: ❌ Failed      │  │  │ • Vehicles: 3 / 8 ready       │   │
│ └─────────────────────────┘  │  │ • Cash: ₹45,230 to settle     │   │
│                              │  │ • Tasks: 8 open · 12 queued   │   │
│ ╔═ AI COMPLAINT CLASSIFIER ═╗ │  └────────────────────────────────┘   │
│ ║ 🆘 AI Complaint Classifier║ │                                        │
│ ║ Classify delivery...       ║ │                                        │
│ ╠════════════════════════════╣ │                                        │
│ ║                            ║ │                                        │
│ ║ Complaint Text             ║ │                                        │
│ ║ ┌──────────────────────┐   ║ │                                        │
│ ║ │ Enter complaint...   │   ║ │  ← WIDGET IS HERE                    │
│ ║ │                      │   ║ │  ← Integrated in dashboard            │
│ ║ └──────────────────────┘   ║ │  ← Same card styling as other widgets │
│ ║ 0 / 2000 characters        ║ │                                        │
│ ║                            ║ │                                        │
│ ║ [✨ Classify] [Clear]       ║ │                                        │
│ ║                            ║ │                                        │
│ ║ [Empty State]              ║ │                                        │
│ ║ 🆘 Enter text to start     ║ │                                        │
│ ║                            ║ │                                        │
│ ╚════════════════════════════╝ │                                        │
│                              │                                        │
└──────────────────────────────┴─────────────────────────────────────────┘

```

## Widget States

### 1. Empty State (Default)

```
╔══════════════════════════════════════════╗
║ 🆘 AI Complaint Classifier               ║
║ Classify delivery complaints by category │
╠══════════════════════════════════════════╣
║                                          ║
║ Complaint Text                           ║
║ ┌──────────────────────────────────────┐ ║
║ │ Enter complaint text...               │ ║
║ │ (max 2000 characters)                │ ║
║ └──────────────────────────────────────┘ ║
║ 0 / 2000 characters                      ║
║                                          ║
║ [✨ Classify] [Clear]                     ║
║                                          ║
║                                          ║
║        🆘 Enter text to start             ║
║                                          ║
╚══════════════════════════════════════════╝
```

### 2. Input State (With Text)

```
╔══════════════════════════════════════════╗
║ 🆘 AI Complaint Classifier               ║
║ Classify delivery complaints by category │
╠══════════════════════════════════════════╣
║                                          ║
║ Complaint Text                           ║
║ ┌──────────────────────────────────────┐ ║
║ │ My package is 2 days late and I need│ ║
║ │ it urgently for my wedding. The     │ ║
║ │ tracking shows it's stuck at the    │ ║
║ │ distribution center.                │ ║
║ └──────────────────────────────────────┘ ║
║ 127 / 2000 characters                    ║
║                                          ║
║ [✨ Classify] [Clear]                     ║
║                                          ║
║                                          ║
║        🆘 Enter text to start             ║
║                                          ║
╚══════════════════════════════════════════╝
```

### 3. Loading State (Classifying)

```
╔══════════════════════════════════════════╗
║ 🆘 AI Complaint Classifier               ║
║ Classify delivery complaints by category │
╠══════════════════════════════════════════╣
║                                          ║
║ Complaint Text                           ║
║ ┌──────────────────────────────────────┐ ║
║ │ My package is 2 days late and I need│ ║
║ │ it urgently for my wedding...       │ ║
║ └──────────────────────────────────────┘ ║
║ 127 / 2000 characters                    ║
║                                          ║
║ [🔄 Classifying...] [Clear]               ║
║                                          ║
╚══════════════════════════════════════════╝
```

### 4. Results State (P1 - Critical)

```
╔══════════════════════════════════════════╗
║ 🆘 AI Complaint Classifier               ║
║ Classify delivery complaints by category │
╠══════════════════════════════════════════╣
║                                          ║
║ Complaint Text                           ║
║ ┌──────────────────────────────────────┐ ║
║ │ My package is 2 days late...        │ ║
║ └──────────────────────────────────────┘ ║
║ 127 / 2000 characters                    ║
║                                          ║
║ [✨ Classify] [Clear]                     ║
║                                          ║
║ ┌──────────────────────────────────────┐ ║
║ │ Mode          │ [AI (Jev)]           │ ║
║ │ Category      │ Delivery Delay       │ ║
║ │ Priority      │ ❌ Critical (P1)     │ ║
║ │ Confidence    │ ████████░ 92%       │ ║
║ └──────────────────────────────────────┘ ║
║                                          ║
║ [📋 Copy Results]                         ║
║                                          ║
╚══════════════════════════════════════════╝
```

### 5. Results State (P2 - High)

```
╔══════════════════════════════════════════╗
║ 🆘 AI Complaint Classifier               ║
║ Classify delivery complaints by category │
╠══════════════════════════════════════════╣
║                                          ║
║ [Results Grid]                           ║
║ ┌──────────────────────────────────────┐ ║
║ │ Mode          │ [Pattern-Based]      │ ║  ← Orange badge
║ │ Category      │ COD Settlement       │ ║  ← Pattern matching (no API)
║ │ Priority      │ ⚠ High (P2)         │ ║  ← Orange icon
║ │ Confidence    │ ████░░░░░ 62%       │ ║  ← Medium confidence
║ └──────────────────────────────────────┘ ║
║                                          ║
║ [📋 Copy Results]                         ║
║                                          ║
╚══════════════════════════════════════════╝
```

### 6. Results State (P3 - Medium)

```
╔══════════════════════════════════════════╗
║ 🆘 AI Complaint Classifier               ║
║ Classify delivery complaints by category │
╠══════════════════════════════════════════╣
║                                          ║
║ [Results Grid]                           ║
║ ┌──────────────────────────────────────┐ ║
║ │ Mode          │ [AI (Jev)]           │ ║  ← Blue badge
║ │ Category      │ Tracking Visibility  │ ║  ← Tracking issue
║ │ Priority      │ ℹ Medium (P3)       │ ║  ← Blue info icon
║ │ Confidence    │ ████████░ 78%       │ ║  ← Good confidence
║ └──────────────────────────────────────┘ ║
║                                          ║
║ [📋 Copy Results]                         ║
║                                          ║
╚══════════════════════════════════════════╝
```

### 7. Results State (P4 - Low)

```
╔══════════════════════════════════════════╗
║ 🆘 AI Complaint Classifier               ║
║ Classify delivery complaints by category │
╠══════════════════════════════════════════╣
║                                          ║
║ [Results Grid]                           ║
║ ┌──────────────────────────────────────┐ ║
║ │ Mode          │ [Pattern-Based]      │ ║  ← Orange badge
║ │ Category      │ Other / Unclassified │ ║  ← General query
║ │ Priority      │ ✓ Low (P4)          │ ║  ← Green check
║ │ Confidence    │ ████░░░░░ 55%       │ ║  ← Lower confidence
║ └──────────────────────────────────────┘ ║
║                                          ║
║ [📋 Copy Results]                         ║
║                                          ║
╚══════════════════════════════════════════╝
```

### 8. Error State

```
╔══════════════════════════════════════════╗
║ 🆘 AI Complaint Classifier               ║
║ Classify delivery complaints by category │
╠══════════════════════════════════════════╣
║                                          ║
║ Complaint Text                           ║
║ ┌──────────────────────────────────────┐ ║
║ │ My package is lost and urgent       │ ║
║ └──────────────────────────────────────┘ ║
║ 45 / 2000 characters                     ║
║                                          ║
║ [✨ Classify] [Clear]                     ║
║                                          ║
║ ┌──────────────────────────────────────┐ ║
║ │ ⚠ Classification failed. Please try  │ ║
║ │   again or check your connection.   │ ║
║ └──────────────────────────────────────┘ ║
║                                          ║
╚══════════════════════════════════════════╝
```

## Priority Color Coding

### Visual Indicators

```
P1 - CRITICAL
╔════════════════╗
║ ❌ Critical    ║  ← Red with cross icon
║ (P1)           ║  ← Red background
║ 15 min SLA     ║  ← Urgent action required
╚════════════════╝

P2 - HIGH
╔════════════════╗
║ ⚠ High         ║  ← Orange with warning
║ (P2)           ║  ← Orange background
║ 60 min SLA     ║  ← Manager review needed
╚════════════════╝

P3 - MEDIUM
╔════════════════╗
║ ℹ Medium       ║  ← Blue with info icon
║ (P3)           ║  ← Blue background
║ 4 hr SLA       ║  ← Standard processing
╚════════════════╝

P4 - LOW
╔════════════════╗
║ ✓ Low          ║  ← Green with checkmark
║ (P4)           ║  ← Green background
║ 24 hr SLA      ║  ← Non-urgent feedback
╚════════════════╝
```

## Classification Category Examples

### By Priority

**P1 - Critical**
```
• "My vehicle is overloaded and unstable - URGENT"
  → vehicle_capacity_energy | P1 | 91% confidence

• "Customer phone numbers are publicly accessible!"
  → access_privacy | P1 | 95% confidence

• "All GPS showing wrong locations, all drivers stuck"
  → gps_technical | P1 | 87% confidence
```

**P2 - High**
```
• "COD amount doesn't match - 15,000 MMK difference"
  → cod_settlement | P2 | 88% confidence

• "Batch of 10 deliveries failed without reasons"
  → delivery_failure | P2 | 84% confidence

• "All alert notifications failed this morning"
  → notification_alerts | P2 | 77% confidence
```

**P3 - Medium**
```
• "Tracking page not showing my package location"
  → tracking_visibility | P3 | 82% confidence

• "My parcel was due yesterday, still in transit"
  → delivery_delay | P3 | 79% confidence

• "GPS showing wrong neighborhood"
  → gps_technical | P3 | 62% confidence
```

**P4 - Low**
```
• "What are your customer service hours?"
  → other_general | P4 | 68% confidence

• "Can I change my delivery address?"
  → other_general | P4 | 55% confidence

• "Would you offer a loyalty program?"
  → other_general | P4 | 71% confidence
```

## Copy Results Format

When clicking "Copy Results", the clipboard contains:

```
Category: Delivery Delay
Priority: High (P2)
Confidence: 92%
Mode: AI (Jev)
```

Can then be pasted directly into:
- Support case notes
- Team messaging
- Documentation
- Reports

## Responsive Behavior

### Desktop (>1024px)
```
┌────────────────────────────────────────┐
│ Complaint Text  [4-column grid]         │
│ ┌──────────────────────────────────┐   │
│ │ Mode       Category   Priority   │   │
│ │ Confidence [Copy]                │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

### Tablet (768px - 1024px)
```
┌────────────────────────────────────────┐
│ Complaint Text  [2-column grid]         │
│ ┌──────────────────────────────────┐   │
│ │ Mode          Category           │   │
│ │ Priority      Confidence [Copy]  │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

### Mobile (<768px)
```
┌──────────────────────────────┐
│ Complaint Text [1-column]     │
│ ┌──────────────────────────┐ │
│ │ Mode                     │ │
│ │ Category                 │ │
│ │ Priority                 │ │
│ │ Confidence               │ │
│ │ [Copy Results] (full)   │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

## Interaction Flows

### Flow 1: Successful Classification (AI Mode)
```
1. Manager reads complaint
2. Copies complaint text
3. Pastes into widget textarea
4. Clicks "Classify"
5. (2-3 seconds waiting)
6. Sees results with mode: "AI (Jev)"
7. Clicks "Copy Results"
8. Pastes into support case notes
```

### Flow 2: Quick Classification (Pattern Mode)
```
1. Manager types short complaint
2. Clicks "Classify"
3. (Instant response)
4. Sees results with mode: "Pattern-Based"
5. Reviews priority and category
6. Clicks "Clear" for next complaint
```

### Flow 3: Error Recovery
```
1. Manager enters complaint
2. Clicks "Classify"
3. Network error occurs
4. Error message displayed
5. Can click "Classify" again to retry
6. Falls back to pattern matching
```

## Integration with Workflow

### Typical Manager Dashboard Session

```
Morning Briefing
└─ Review Alerts section
   └─ See urgent complaints
   └─ Use widget to quickly classify
   └─ Copy results for support team

During Operations
└─ Monitor Recent Deliveries
   └─ Click to support widget when complaint comes in
   └─ Quick classification
   └─ Share results with team

End of Day
└─ Review patterns
   └─ Use widget to classify feedback
   └─ Export classification reports
```

## Summary

The Classification Widget integrates seamlessly into the Manager Dashboard, providing:

- ✅ Easy access to complaint classification
- ✅ Visual priority indicators
- ✅ Mode indication (AI vs Pattern)
- ✅ Confidence scoring
- ✅ Quick copy for sharing
- ✅ Responsive design
- ✅ Matches existing dashboard styling
- ✅ Non-intrusive placement

Ready for production use! 🚀
