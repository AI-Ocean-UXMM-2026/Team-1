---
target: manager jobs page
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-10-22T07-34-01Z
slug: src-components-delivery-manager-jobs-tsx
---
# Job board critique (before fixes) — 23/40, Acceptable
Heuristics: status 2, real-world 2, control 2, consistency 2, error prevention 1, recognition 3, flexibility 2, minimalist 3, error recovery 2, help 1.
Specificity: generic admin CRUD; requests→queue→jobs pipeline not expressed.
Detector: CLI 0 findings; browser 2 (disabled-button contrast 4.3:1 — WCAG-exempt; Inter 100% — taste). No overflow, no <44px targets, no <12px text.
Priority issues: [P0] Confirm vs Auto-accept ambiguous; [P1] bulk post without safeguard; [P1] layout hides pipeline; [P2] demo mode not signalled; [P2] dead-end empty states.
Persona flags: Alex — no multi-select/filter; Sam — row buttons unlabeled by order; Casey — wall of identical CTAs, queue/jobs far down.
Fixed in same run: P0, P1 layout, P2 demo, P2 empty states, row aria-labels, status color+label. Open: undo/confirmation for bulk post, raw DB error text, township filter/multi-select.
