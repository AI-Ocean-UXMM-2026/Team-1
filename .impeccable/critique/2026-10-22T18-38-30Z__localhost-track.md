---
target: "http://localhost:3000/track?order=6e3049ee-f8f6-4a40-be17-26b3f1c9aed6"
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "url:http://localhost:3000/track"
timestamp: 2026-10-22T18-38-30Z
slug: localhost-track
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|:---:|---|
| 1 | Visibility of System Status | 3 | Timestamps and status chips work well; ETA headline lacks tabular figures, causing layout jitter during 15s ticks. |
| 2 | Match Between System and Real World | 3 | Yangon addresses and MMK currency are accurate, but spatial orientation is lost when scrolling past the map. |
| 3 | User Control and Freedom | 1 | **Critical Defect:** User cannot pull down, expand, or collapse the tracking summary over the live map. Spatial control is absent. |
| 4 | Consistency and Standards | 2 | Violates standard delivery tracking patterns (Grab/Deliveroo bottom sheets) and DESIGN.md rules (Full-bleed map + Sheet shadow). |
| 5 | Error Prevention | 3 | Solid handling of stale GPS notices and terminal states; accidental back navigation dismisses tracking context. |
| 6 | Recognition Rather Than Recall | 2 | Scrolling down to view driver or stops hides the live map and ETA; users must hold rider location in memory. |
| 7 | Flexibility and Efficiency of Use | 1 | Zero touch/swipe gesture ergonomics; no quick transitions between bird’s-eye route view and detailed stop audit. |
| 8 | Aesthetic and Minimalist Design | 2 | Visual fragmentation from duplicate COD notices, negative-margin card overlap hacks, and nested accordion disclosures. |
| 9 | Help Recognize & Recover from Errors | 3 | Stale GPS and cancelled states offer clear diagnostic text and recovery actions. |
| 10 | Help and Documentation | 3 | Contextual HelpSheet integration is clean and links directly to the current parcel. |
| **Total** | | **23/40** | **Acceptable (Significant improvements needed)** |

#### Design Specificity Verdict

**LLM assessment**: The visual foundation respects Oern's token system (Dispatch Navy, bilingual Inter + Noto Sans Myanmar typography, sentence case), but the layout architecture fails the core creative north star: *"The Dispatch Board"*. Instead of an authoritative, full-bleed tracking canvas where state commands the screen, `/track` is composed as a static vertical web document with a 320px cropped map and disconnected cards. The bottom modal requested by the user is completely missing — it is currently faked using CSS negative margins (`mt: -20px`) on a normal scroll block.

**Deterministic scan**: CLI scan on target source files passed cleanly with 0 syntax or pattern defects. The live mobile browser pass (`390x844`) surfaced 1 warning: `overused-font` on `body`. This finding is classified as an intentional design-system rule rather than a defect: Inter is self-hosted locally and paired with Noto Sans Myanmar to guarantee offline resilience and reliable baseline alignment on Yangon cellular networks. Color contrast, touch targets (all ≥ 48px), text sizing, and viewport containment all passed with zero violations.

**Visual overlays**: Script injection was preflighted on the dev server. Since no interactive bottom sheet element exists in the DOM to highlight, visual overlays confirm clean baseline element metrics while highlighting the structural absence of the gesture container.

#### Overall Impression

The underlying tracking state machine (`describeTracking`) and defensive edge-case copy are robust, but the interaction architecture directly undermines the mobile experience. Treating live tracking as a vertically scrollable webpage rather than a full-bleed map with an interactive expandable/collapsible bottom sheet forces customers to choose between watching their driver and checking order details.

#### What's Working

1. **State-Driven Telemetry & Defensive Copy**: Clean handling of stale GPS, route progress, and traffic delays with honest explanatory copy rather than raw database codes.
2. **Strict COD Separation**: Follows DESIGN.md by strictly separating delivery progress from cash collection status.
3. **Account-Free Deep Linking**: Customers can track orders directly via deep-linked order IDs without friction.

#### Priority Issues

- **[P0] What**: Static stacked document flow instead of an interactive, expandable and collapsible bottom sheet.
  - **Why it matters**: Breaks the spatial mental model of mobile delivery apps. Scrolling down to inspect driver phone or drop-off stops boots the map off-screen. Users cannot pull down to see Yangon traffic or expand to see full details.
  - **Fix**: Re-architect `TrackDetail` into a full-bleed map with a gesture-driven bottom sheet:
    - **Peek state (180–220px)**: Status chip, live ETA headline, journey rail, and instant call action.
    - **Expanded state (half / full)**: Driver info, address route, progress history, and COD breakdown.
    - Implement a touch/pointer grab handle (`.rf-handle`), smooth drag physics, and snap points matching DESIGN.md (`--rf-shadow-sheet`, `--radius-xl`).
  - **Suggested command**: `$impeccable layout`

- **[P1] What**: Missing primary action anchored in the mobile thumb zone.
  - **Why it matters**: Violates DESIGN.md line 273 (*The Thumb Zone Rule*). The driver call button is tucked inside a secondary card below the fold, making urgent one-handed calls difficult while walking or waiting outside.
  - **Fix**: Anchor a prominent primary action in the sheet dock (e.g., quick call or message driver when live, or confirm delivery).
  - **Suggested command**: `$impeccable bolder`

- **[P2] What**: Visual fragmentation and duplicated COD information.
  - **Why it matters**: COD amount is presented twice (in the summary banner and again inside an accordion toggle), and nested MUI accordions add unnecessary click barriers.
  - **Fix**: Remove the nested accordions. Present timeline updates in an open, legible stepper and consolidate COD into a single authoritative payment tile.
  - **Suggested command**: `$impeccable distill`

- **[P3] What**: Layout jitter on live ETA countdown ticks.
  - **Why it matters**: The 28px headline updates every 15 seconds without tabular figures, causing horizontal text bouncing and violating DESIGN.md line 254 (*The Tabular Figures Rule*).
  - **Fix**: Apply `fontFeatureSettings: '"tnum"'` / `tabular-nums` to `view.headline`.
  - **Suggested command**: `$impeccable typeset`

#### Persona Red Flags

- **Alex (Power User)**: Wants to immediately check rider distance and tap to call without scrolling past a clipped map container. Stymied by the lack of an immediate expandable sheet.
- **Jordan (First-Timer)**: Tries to swipe up on the summary card (expecting Grab or Google Maps behavior). Nothing responds. Doesn’t notice driver details further down because there is no visual grab handle or peek affordance.
- **Thiri (Yangon Customer with 68,000 MMK COD)**: High stress waiting for urgent delivery. Needs to see the map to verify if the rider is delayed at a known traffic junction while simultaneously checking driver phone and cash details. The current layout forces her to scroll back and forth repeatedly.

#### Minor Observations

- `ShareTrackingButton` uses `IosShare` on all devices, which feels unnatural on Android.
- Redundant progress bars: `LinearProgress` renders directly underneath `JourneyRail`.
- The "Sample" demo indicator is an unstyled muted caption rather than a clear badge.

#### Questions to Consider

1. Should the bottom sheet support three standard snap points (**Peek: ~200px**, **Half: 55vh**, **Full: 90vh**) with snap-to-touch gestures?
2. Should the driver call button and ETA be immediately reachable in the collapsed peek state so the customer never has to expand the sheet for the most common action?
