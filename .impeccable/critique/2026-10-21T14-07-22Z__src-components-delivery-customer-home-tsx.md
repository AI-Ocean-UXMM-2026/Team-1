---
target: customer app / (user only)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-21T14-07-22Z
slug: src-components-delivery-customer-home-tsx
---
## Critique: customer app (`/`, user side)
Method: DEGRADED single-context. Detector: 0 findings (8 files). Score 25/40, Acceptable.

Heuristics: 1 Visibility 3 | 2 Real world 3 | 3 Control 3 | 4 Consistency 2 | 5 Error prevention 2 | 6 Recognition 3 | 7 Flexibility 2 | 8 Minimalist 2 | 9 Error recovery 2 | 10 Help 3.

Specificity: mixed. Welcome screen and the navy ETA card are authored; the rest is a generic card stack, mascot absent after welcome.

Priority issues:
1. [P1] Track contradicts itself (last known location vs updated 1m ago) and the map is buried below the hero. Fix: one freshness line, map under ETA. clarify, layout.
2. [P1] Home puts Request a pickup and a COD chip above the live parcel. Fix: live card first. layout.
3. [P1] Tab bar: two items look active, Home is not a tab, Request pickup duplicated as a card. layout, polish.
4. [P2] Orders list truncates meta text, mixes status pill and plain text, shows no ETA or COD. layout.
5. [P2] Copy and continuity: "sign in with your team account above" points at nothing, sign-in drops the mascot, pickup CTA disabled with no reason, phone field in the address group. clarify, polish.

Personas: Jordan, Casey, Sam red flags as in the chat report.
