# Animation Study: UX and UI Motion on Mobile Apps

An evidence-based review of motion on mobile — why it exists, what perceptual
research says about duration and easing, which patterns work, how they fail in
practice, and how the rules apply to an operator-heavy delivery app like Oern.

Readers: designers and engineers working on the rider, customer, and manager
surfaces (`DESIGN.md` §11 is the companion rulebook; this study explains *why*
those rules exist and how they get violated).

---

## 1. Executive summary

- **Motion is information, not decoration.** Animations that encode spatial
  relationships, causality, or state change earn their frame budget; polish-only
  animation competes with the operator's time and attention.
- **Perceptual anchors are stable and measurable.** ~100 ms reads as instant,
  150–220 ms reads as "the app responded," 300–500 ms reads as "announced,"
  ≥1 s reads as a stall. Oern's rule of 150–220 ms for state changes matches
  the perceptual research.
- **Easing matters as much as duration.** Enter with decelerate, exit with
  accelerate, interrupt gracefully. Springs for gestures; curves for
  click-and-go.
- **The failure modes are systematic, not random.** Ghost ripples, frozen
  sheets, replayed transitions, and delayed taps come from a small set of
  engineering causes (layered rendering, effect cleanup, gesture conflicts,
  preserved navigation) — all preventable with the checks in §10–§12.
- **Motion must be optional.** `prefers-reduced-motion` is not an edge case:
  inward/breathless motion is a sum of duration, distance, and area. Provide
  equivalent non-animated state cues (glyph, color, text) for every animated cue.

---

## 2. Why animation exists on mobile — four jobs

| Job | Question it answers | Example |
| --- | --- | --- |
| **Continuity** | Where did that come from / where did it go? | Sheet growing out of its list card; card expanding into a detail screen |
| **Causality** | Did *my* action cause this? | Button press feedback (ripple, `:active` state layer), form shake on error |
| **Change** | What changed, and how much? | Progress bar easing to the new value; ETA text flipping with a slide-up |
| **Direction / status** | Which way is the flow going? | Enter-from-forward-axis on push, reverse on back; checkmark morph on success |

Rough rule by Apple's and Material's guidance: every animated element must
answer one of these four questions quietly, in ≤2 perceptual steps. If you can
mute the animation and lose no information, it is decoration — cap it at
micro-durations and treat it as disposable.

---

## 3. Perceptual foundations (what research converges on)

### 3.1 Latency thresholds

These figures repeat across HCI literature (Nielsen, Miller, Doherty's
400 ms rule, Google's Material research) and remain the practical anchors:

| Interval | Perception | Design consequence |
| --- | --- | --- |
| ≤100 ms | Instant / simultaneous | Press feedback must land here. A ripple starting later than this feels unrelated to the press. |
| 100–300 ms | Noticeable change | Sweet spot for most UI transitions. Oern's 150–220 ms sits in the middle. |
| ~300–500 ms | Deliberate, announced | Route transitions, sheets, morphs. Never put everyday state changes here. |
| >1 s | Breakdown | Requires progress UI or optimistic UI; spinner alone is a failure state. |

### 3.2 Perceived duration is not real duration

- **Anticipation pins the clock.** A skeleton that matches the content's shape
  makes a 900 ms load feel shorter than a spinner does. Matching the *final
  layout* matters more than animating the wait elegantly.
- **Occupied time is shorter.** An animated countdown, shimmer on the exact
  field that will change, or streaming content "feels" faster than idle waiting.
- **Interruptibility dominates.** Users value "responds to me *while* it moves"
  (tappable mid-animation) over snappiness. Non-interruptible transitions
  (lock sweeps, forced full-screen morphs) are the #1 reason users perceive an
  app as slow even when it is fast.

### 3.3 Biology constraints

- **Retinal persistence** makes flicker unusable below ~20 fps and dimmed
  fast-flip regions read as shimmer or smear; only slow fades of small areas
  stay safe. The AA/AAA thresholds in WCAG 2.2 (§2.3.1, §2.3.2) forbid content flashing >3 times/second over a
  large area — pulse animations must therefore be slow (1–3 s cycles) and small.
- **Vestibular mismatch** (screen content slides while body is static) causes
  nausea for a sizable minority. Full-screen side-in/out transitions and
  parallax are the highest-risk patterns; scale-and-fade (cross-fade with
  subtle zoom of ≤5%) is the safest replacement.
- **Motion sensitivity rises with distance covered.** Two animations of equal
  duration and equal *distance* generate different complaint rates based on the
  fraction of the screen swept. Prefer small-area motion.

---

## 4. Duration and easing taxonomy

### 4.1 Duration ladder

| Tier | Range | Use |
| --- | --- | --- |
| T0 **Reaction** | 80–120 ms | Press/press-out state layer, checkbox tick |
| T1 **State** | 150–220 ms | Chips toggling, badges, inline expand, snackbar in/out, skeleton fade |
| T2 **Element** | 250–350 ms | Panels, sheets entering/leaving, deck of list items staggering |
| T3 **Scene** | 300–500 ms | Full-screen route transitions, map fly-to |
| T4 **Feedback loops** | unlimited | Live pulses (rider location), route-progress fills — user-agnostic loops gated by reduced-motion |

Oern's rule: T1 for state changes (DESIGN.md §11). T2–T3 reserved for
navigation and the rider sheet. Never mix tiers on one axis at once (e.g., a
sheet whose content staggers slower than the sheet itself enters reads as a
separate screen drawing itself twice).

### 4.2 Easing grammar

| Curves | Where |
| --- | --- |
| **Decelerate (ease-out)** | Things arriving toward the user: sheets, menus, toasts. Fast start, gentle landing. |
| **Accelerate (ease-in)** | Things leaving: dismiss, collapse. Slow start, fast exit — leaves the stage quickly. |
| **Standard symmetric (ease-in-out)** | State flips that don't traverse space: selection toggle, expansion in place. |
| **Spring / damped** | Gesture-driven motion: drag-to-dismiss must track the finger 1:1 with velocity carry. Never drive a gesture by a fixed curve. |
| **Linear** | Continuous phenomena only (progress fill, indeterminate sweep). Not for UI transitions — linear UI motion reads mechanical. |

Two non-negotiable pairings:

1. **Asymmetric transitions**: enter slower than exit (exit ≈ 60–70% of enter
   duration). Screen content the user asked for deserves the long draw;
   disappearing content must not block what they're moving to.
2. **Interruptibility**: any animated value that can change mid-animation must
   re-target, not restart. Restarting is what makes stiff apps feel worse than
   slow ones.

### 4.3 Stagger

Stagger list/card entrances 20–40 ms per item, capped total ≤250 ms. Above
that the list reads as "dramatically unaware of the user" — the user has
already scrolled by. Never stagger on refresh of an already-visible list; only
on first appearance.

---

## 5. Touch feedback: the ripple case study

Press feedback is the most frequent animation in any app — typically 10–20
events per minute per user — so its failure modes are amplified.

### 5.1 What a touch indicator must do

1. Begin within 100 ms of contact (research answer to perceived latency; ties
   to 3.1).
2. Anchor to the *pressed control*, never to focus or proximity.
3. End cleanly even when the interaction is cancelled (scroll, navigation,
   second finger, route change).
4. Not double-trigger (one visual event for one pointer action — touch-down
   plus emulated mouse events must collapse to one).
5. Fade out, not vanish: exit must animate from the current state.

### 5.2 Material ripples — mechanics and known weak points

The MUI `TouchRipple` is a 550 ms-scale animation with an 80 ms touch delay
used to distinguish a tap from a scroll. `Ripple` cleanup is driven by an
internal timer inside `useEffect`; the visual element only leaves the DOM once
that timer fires.

Failure classes we verified empirically in this repo (see §5.4):

| Failure | Trigger | Symptom |
| --- | --- | --- |
| **Focus-bleed ripple** | Programmatic focus (sheet open, focus trap, view switch) starts the pulsating keyboard ripple on whatever control receives focus | "I tapped A, B lit up instead." `BottomNavigationAction` hard-codes `focusRipple: true` and has no `disableFocusRipple` prop |
| **Stuck/ghost ripple** | Route hides mid-ripple; kept-mounted navigation cancels effect-internal management while the DOM stays alive | Ripple rectangle visible forever on the returned screen |
| **Scroll flash** | Indicator starts on a touch that becomes a scroll | Pointless bursts while scrolling lists |
| **Double ripple** | Touch synthesizes mouse events on some platforms / with React 19's synthetic event model | Two ripples for one tap |
| **touchcancel gap** | Browser cancels the touch (gesture nav, native scroll takeover) and nothing listens for `touchcancel` | Active ripple never stops until blur |

### 5.3 Decision guide: ripple vs state layer

| Surface | Recommendation |
| --- | --- |
| Primary action buttons, cards (desktop-pointer contexts) | Ripple — communicates direction of attention well |
| Bottom navigation bars, always-visible chrome | **State layer + `:active` press scale** — persistent chrome with a ripple reads noisy; 0.04 alpha overlay is Material's own state-layer answer |
| Long scrub-friendly lists | Ripple with delayed start (80 ms), and scroll must cancel it |
| Reduced motion | Replace with static state layer instantly |

### 5.4 The Oern fixes (2026-10) as validation

All three failure symptoms above were live in the rider/customer surfaces and
fixed with a three-layer change (worth reading as a template for similar bugs):

1. **App theme** (`src/components/delivery/mui-provider.tsx`): pulsate/focus
   ripples disabled globally via
   `MuiTouchRipple-ripplePulsate { display: none }` + `disableFocusRipple` on
   the components that accept it; keyboard focus keeps the explicit outline
   (a11y unaffected).
2. **MUI patch** (`patches/@mui%2Fmaterial@9.5.0.patch`, as a `bun patch`):
   touch input routed through the mouse commit path (no 80ms deferral), plus a
   `touchcancel` handler, plus a `useLayoutEffect`-cleanup state reset.
3. **Navigation-preserving fix**: the layout effect reset runs when the App
   Router hides a route inside `<Activity>` (`cacheComponents`), deleting the
   frozen ripple state right at hide-time, so a bug mid-inspect has no host to
   live in.

Regression coverage in `e2e/ripple.spec.ts`: tap ripples the tapped control,
pulsate never mounts visibly, and no `.MuiTouchRipple-rippleVisible` survives a
navigation roundtrip. Lessons: **animation correctness must be asserted by
tests, because preserved navigation makes visual bugs invisible in review.**

---

## 6. Navigation transitions

### 6.1 Axis and containment

- **Forward** = content enters from the motion axis of "deeper into the app"
  (Material: shared-X axis; iOS: push from right). **Back** = same animation,
  mirrored. Mixed axis direction on back is instant disorientation.
- Prefer shared-axis (z/scale + fade) over horizontal sliding on Android-style
  apps; horizontal sliding is only justified by a hand-consistent drag gesture
  (swipe-back on iOS) where the gesture itself supplies continuity.

### 6.2 Preserved-navigation caveats (Next 16 `<Activity>`)

When routes are hidden rather than unmounted:

| Symptom | Cause to suspect | Mitigation |
| --- | --- | --- |
| Stuck/garbage animation state on return | Transient animation state preserved with the route | Reset transient state in `useLayoutEffect` cleanup (guide pattern) |
| Elements "replay" their entrance on back | Entrance animation keyed to mount rather than to "new content" | Gate entrance on a data-change signal, not mount |
| Re-created timers visible after return | Cleanup while hidden; not restarted on show | Every effect with a timer must be paired with re-arming, and cleaned on hide |
| focal weirdness (focus lost/misplaced on return) | Focus restoration across hidden boundaries | Re-focus intentionally on the return path |

### 6.3 Sheets and bottom drawers

- **Follow the finger for drag; fall back to a curve for taps.** Sheet must be
  1:1 under the drag pointer, vertically capped, with snap points at detents —
  and must not start with a bounce that implies it is already detented.
- Grab affordance size ≥44 px, centered horizontally.
- When inside a map (rider), the map pan gesture must lose conflicts with the
  sheet — a single-finger drag on the sheet moves the sheet, never camera
  (this is an Oern rule, DESIGN.md §11). Two-finger moves camera.
- Push-back behind the sheet: the previous layer dims and scales back ~2–5%.
  Above that the back layer reads as its own page.
- Dismiss velocity: track the lift velocity; if velocity > ~1000 px/s toward
  dismiss, complete the dismissal even from 30% progress — with velocity carry.

---

## 7. Loading, progress, and success/error

- **Skeletons beat spinners** wherever layout is known (DESIGN.md §11:
  skeleton for stable layout). Skeletons over full-width rows for
  ≤800 ms loads; combined with real content for optimistic displays.
- **Progress = distance + direction**: deterministic bars must ease to target,
  never snap. Indeterminate sweeps only when nothing can be estimated; pair
  with a text step ("finding riders") so users can predict wait.
- **Success morph**: checkmark draw-in (150 ms) at the point of completion
  forms stronger memory anchoring than a toast alone; drives one action reward
  per task end, not every intermediate state.
- **Error states animate cause, not just symptom**: shake the invalid field
  (one 300 ms damped shake — max 5% side-to-side), or shake the submit itself.
  Never shake the container.

---

## 8. Live data and maps (rider deliver)

- Live pulses (locations, arrivals) cycle 1.5–3 s at ≤0.3 alpha peak and are
  never the only status cue (DESIGN.md §11). Pulse amplitude constant —
  pulsing *size* (grow/shrink circles), not opacity flicker: opacity flicker at
  1 Hz frequencies sits under the flash threshold.
- **Camera moves only for user intent or major turn-ahead** — notification
  updates should not animate the camera. Rider heading-up camera: rotate with
  a damped turn-follow (spring, ~6–10%/deg s) so turn markers stay readable.
- **ETA numbers tween**, never cross-fade (cross-fade over letters reads like
  two lies in sequence); slide the numeric digits with a 120 ms step.
- **Route fill** on the map should grow along the polyline rather than a
  fill-percent gradient; fill-percent on a route is a data lie.
- **Smooth scrolling on maps** should be soft, with tapping a marker
  immediately recentering with a short 300ms ease-out — no long fly-throughs in
  an operational app.

---

## 9. Haptics as the other half of touch motion

| Interaction | Haptic | Duration pairing |
| --- | --- | --- |
| Press begins (heavy primary CTA) | Light impact, tick | ≤40 ms, before the ripple is visible |
| Toggle/confirm | Light impact | With the state flip, not before |
| Pull-to-refresh detent | Tick | At the snap point, not during stretch |
| Warnings/destructive confirm guard (e.g., COD settle) | Two-tap warning (strength platform-dependent) | With the modal entry |
| Failure | Triple-pulse error pattern | With the shake |

Rules: never pair haptics with infinite loops (would vibrate forever within a
pulse), keep haptic count ≤2 per gesture, and give a global way to disable
haptics without disabling motion. Vibration is part of the motion budget, not
an add-on.

---

## 10. Accessibility contract

| Requirement | Rule | Verification |
| --- | --- | --- |
| `prefers-reduced-motion` | Disable everything except opacity ≤0.15 changes and small (≤10 px) displacement | Playwright `colorScheme`/`reducedMotion: 'reduce'` context |
| Flash threshold (WCAG 2.2 §2.3.1) | Nothing over 3 flashes/s in any 300 ms window; no fullscreen | Frame-sampling in QA |
| Animation from interactions (WCAG 2.3.3) | Motion response to *user actions* must be disable-able | Setting-based kill switch on the reveal effects (`<details>`, popups) |
| Timing | No reference to an animation for correctness (e.g., text isn't only readable during a 2 s window) | Manual pass |
| Gesture replacements | Every swipe-only or drag-only target needs a visible button equivalent | DESIGN.md §11 already requires this |
| Vestibular safety | Full-screen slide-in ≤400 px/s; scale ≤ 5% | App-configured viewport in dev overlay |

The app currently ships global reduced-motion CSS (`src/app/globals.css`
`prefers-reduced-motion` blocks) — extend the sweep whenever a new animation
lands. Every **new** animation needs the same reduced-motion test as the
mobile-390 viewport run.

---

## 11. Performance budget

| Budget | Value | Reason |
| --- | --- | --- |
| Main-thread budget/animation frame | ≤6 ms (@120 Hz) | Composited transforms/opacity only with `will-change` sparingly |
| First-tap feedback | ≤100 ms | Includes JS dispatch + style invalidation + first paint of the indicator |
| Long-task in-flight | 0 | A long task during a transition is the "app is old" signature |
| Animation-related listeners | Passive, gesture-local (not `touch-action: none` globally) | Scrolling must never be sacrificed for animated flourish |
| Memory: concurrent animations | ≤4 simultaneously visible | Beyond that both readability and jank drop on low-end devices |
| Battery | No loops except: live pulse (rider), skeleton (loading) | Pulse loops are the only loops; every other loop needs an exit condition |

Concretely for this codebase: animate `transform`, `opacity`, and `clip-path`
only. Never animate layout properties (top/left/width/height) — the reviewer
tip is to search `grep -rn "transition.*width\|transition.*height\|transition.*margin"`.

---

## 12. Measuring whether the motion is working

| Metric | How | Target |
| --- | --- | --- |
| **Perceived responsiveness** | "First feedback" timestamp from a recording (touchstart→first visual change) | ≤100 ms |
| **Interrupt coverage** | % of transitions that can be interrupted mid-flight | ≥80% |
| **Replay correctness** | Route A→B→A screenshot diff at t=0 — no entrance animation replay | 0 differences after 1 frame |
| **Reduced-motion parity** | Feature flag accessibility diff with motion off | 100% state identification |
| **Ghost artifacts** | DOM scan after navigation in e2e (`e2e/ripple.spec.ts` pattern) | 0 leftover animation elements |

The leanest practical setup: a shared Playwright helper that, after any
navigation, asserts `document.getAnimations().length === 0` (finished) and
that no element with an "-"-suffixed animation class remains. This single
check catches most preserved-navigation animation bugs.

---

## 13. Applied: Oern motion token proposal

Grounded on DESIGN.md §11 and this study; proposed as the shared vocabulary:

```
--motion-fast:       120ms   /* T0 reactions: press, state layer, checkbox */
--motion-base:       180ms   /* T1 state changes: chips, badges, inline expand */
--motion-panel:      280ms   /* T2 sheets, modals, snackbars */
--motion-route:      360ms   /* T3 screen transitions, map recentering */
--motion-live:       2400ms  /* infinite loops: location pulse only */
--ease-enter: cubic-bezier(0.2, 0, 0, 1)     /* decelerate */
--ease-exit:  cubic-bezier(0.4, 0, 1, 1)     /* accelerate */
--ease-swap:  cubic-bezier(0.4, 0, 0.2, 1)   /* standard */
--motion-lift: 0 8px 24px rgba(23, 43, 77, 0.18) /* shadow while moving */
```

Screen-by-screen mapping for this app:

| Screen | Pattern | Token |
| --- | --- | --- |
| Rider flow buttons (`.rf-btn`) | Already uses `:active` + color shift, no ripple — keep | `--motion-fast` |
| Customer/manager MUI buttons | Ripple retained + touch-fix patch; never a focus ripple | `--motion-fast` |
| Bottom nav (all roles) | `:active` press scale (≤0.97), no ripple | `--motion-fast` |
| Rider sheet | Drag-follow + snap; velocity carry; push-back dim | `--motion-panel` |
| Customer header title change | Cross-fade ≤180 ms (never a full slide of the h1) | `--motion-base` |
| Tracking updates (ETA, status chip) | Chip cross-fade + digit slide | `--motion-base` |
| Map recenter (rider heading-up) | 300 ms decelerate, aborted on user pan | `--motion-route` |
| Order history reload | Skeleton (no stagger on refresh) | `--motion-base` |
| COD settle confirm | Modal 280 ms + warning haptic | `--motion-panel` |
| Success after handover | Checkmark morph 150 ms + single success haptic | `--motion-fast` |

---

## 14. Review checklist (PR)

1. Does each animation answer one of the four jobs in §2?
2. Is the first response ≤100 ms from pointer down?
3. Enter decelerates, exit accelerates, gesture-driven motion follows 1:1?
4. Can it be interrupted without a restart?
5. Does the reduced-motion path still communicate exactly the same state?
6. Does it survive hidden-route (Activity) preservation with no stuck state?
7. Does it survive browser gesture cancellation (`touchcancel`)?
8. Is the loop gated by reduced-motion and dated/battery-conscious?
9. Is the pointer area huge enough and the animation size small enough that it
   isn't the primary information carrier?
10. Is there an e2e assertion for the new animation's cleanup?

---

## 15. Open questions

- **Audio + motion?** Rider sound cues (move-to-rescue) could combine with
  motion; silent-safe restriction applies while driving so no current change.
- **MUI v9 `theme.motion` tokens** unify with app CSS tokens — worth defining
  `--motion-*` as SASS-friendly values that can be injected into `createTheme`
  so MUI and hand-rolled CSS stay in single source of truth.
- **Cross-format visual diffing** — comparing animations on mobile-360/390/430
  widths means component layouts migrate; revisit after the responsive audit.
