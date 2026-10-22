# Functional Motion Plan — Oern

Companion to [`docs/ANIMATION_STUDY.md`](./ANIMATION_STUDY.md). The study explains *why* motion
works; this document says *where* motion belongs in this codebase.

**Rule:** every entry below earns its place by doing one of four jobs. If an animation does not
serve one of them, it is decoration and is out of scope.

| Job | Question it answers |
| --- | --- |
| **Continuity** | "What moved from where?" — the user never loses the thread |
| **Causality** | "What did my action cause?" — the result is visibly tied to the press |
| **Change** | "What is different now?" — live data announces itself |
| **Direction** | "Where did I go, which way is that?" — navigation has an axis |

Tokens are the ones proposed in §13 of the study:
`--motion-fast 120ms` · `--motion-base 180ms` · `--motion-panel 280ms` · `--motion-route 360ms`
· `--motion-live 2400ms` (infinite, location pulse only).

---

## 1. Where the app already does this well

Do not regress these; they are the reference implementation for the rest of the plan.

| Surface | File | Motion |
| --- | --- | --- |
| Rider sheets, dialogs, recenter | `src/components/delivery/rider-flow.css` | `rf-fade`, `rf-rise`, `rf-pop`, `rnav-recenter-in`, width/transform transitions |
| Rider delivery flow | `src/components/delivery/rider-delivery.css` | `dv-marquee`, `dv-shimmer`, `dv-nudge`, `dv-pop`, swipe knob (`dv-swipe`) |
| Auth / form dialogs | `src/app/globals.css:2761,2782` | `fade-in`, `dialog-in` |
| Customer sheets | `src/components/delivery/customer-sheet.tsx` | MUI `SwipeableDrawer` slide |
| Rider nav camera | `src/components/delivery/mapbox-rider-nav-map.tsx:230` | `easeTo` 900–1400 ms heading-up |
| Customer tracking camera | `src/components/delivery/mapbox-location-map.tsx:165` | `easeTo` 800 ms on selection |

---

## 2. The gap, in one paragraph

The rider experience is heavily animated. **Everything else is not.** The customer app, the
manager console, the seller console, and the support console render every state change
instantly. The app is also realtime-driven
(`src/lib/delivery/workspace-realtime.ts` subscribes to `delivery_orders`, `delivery_locations`,
`road_reports`, and `rider_assistance_requests`), so live changes *do* land — they just land
silently. A manager watching the console cannot tell a parcel moved from "on route" to "arriving",
and a customer cannot tell their parcel advanced a step. That silence is the single biggest
functional-motion deficit in the product, and it is what most of this plan fixes.

---

## 3. Priority 0 — Change (live data that arrives silently)

### M1. Manager exception list: new exceptions appear without a trace

- **File:** `src/components/delivery/manager-home-view.tsx:210` (`.dash-exception-list`)
- **Now:** `managerExceptions()` recomputes on every realtime update. A rider assistance request
  or an unassigned delivery lands as a new `<li>` in the "Act now" list — instantly, at the top,
  with no indication that the list grew.
- **Motion:** enter animation for newly-inserted exception rows only (fade + 6 px rise, 180 ms,
  `--motion-base`); the row that was already there must not re-animate. Key the animation off
  "was this id in the previous render's exception set?"
- **Why functional:** the whole purpose of "Act now" is to tell a manager what changed since they
  last looked. Today, if they glance away for two seconds, the exception is simply *there*, and
  there is no way to know it is new.
- **Cost:** low. CSS class + one `useRef` diff in `manager-home-view.tsx`.

### M2. Manager KPI numbers jump instead of counting

- **File:** `src/components/delivery/manager-ui-components.tsx:12` (`KpiCell`), CSS
  `src/app/globals-late.css:358` (`.dash-kpi-value`)
- **Now:** `.dash-kpi-value` renders `value` verbatim. When the count changes from 3 to 4 the digit
  is replaced in the same frame. `.dash-kpi` already transitions `border-color`/`box-shadow`
  (`globals-late.css:334`), so the card reacts to state changes but the *number* — the actual
  information — does not.
- **Motion:** 180 ms digit roll on change (`--motion-base`; old value slides up and out, new value
  slides in from below, clipped by the value's line box). Direction is fixed (down = increase,
  up = decrease) so the direction of the change is readable at a glance.
- **Why functional:** a KPI that silently changes is indistinguishable from a KPI that was always
  wrong. The count-roll is the "change" job in its purest form.
- **Cost:** low–medium. One small `useEffect` + `key`-based swap inside `KpiCell`; no library.

### M3. Sparkline redraws with no draw-on

- **File:** `src/components/delivery/manager-ui-components.tsx:75` (`Sparkline`)
- **Now:** a static `<polyline>` whose `points` attribute is recomputed on every data change. The
  new hour's segment pops into existence.
- **Motion:** 180 ms stroke-dash draw-in for the newest segment only (`--motion-base`;
  `stroke-dasharray` + `stroke-dashoffset`), leaving the historical path untouched.
- **Why functional:** it separates "the trend moved" from "the chart redrew". Only the newest
  segment animating keeps the eye on the delta.
- **Cost:** medium. The SVG needs a stable path length (measure once per render via
  `getTotalLength`) or a `pathLength={1}` normalisation.

### M4. Customer status chips change text without announcing it

- **File:** `src/components/delivery/customer-home.tsx` (`StatusChip`, `TodayRow:525`,
  `NextParcelCard:388`), `src/components/delivery/customer-pages.tsx:309` (`TrackDetail`)
- **Now:** when the realtime `delivery_orders` UPDATE lands, `order.status` changes and the chip
  label changes from "On the way" to "Arriving now" in place. Nothing draws the eye.
- **Motion:** 180 ms label cross-fade on the chip, plus a one-shot 150 ms colour wash on the chip
  (success/attention tone) so the change is visible peripherally. Do not slide the whole card.
- **Why functional:** status is the single most-watched value in the app. Silent mutation means
  the customer re-reads the card to find out anything happened at all.
- **Cost:** medium. Chip label needs a key on the status so React remounts it for the animation.

### M5. The ETA headline rewrites itself every 15 seconds

- **File:** `src/components/delivery/customer-app.tsx:259` (15 s `now` tick) →
  `src/components/delivery/customer-home.tsx:231` (`heroCopy`)
- **Now:** "Arriving in 12 min" silently becomes "Arriving in 11 min" — the string is replaced in
  the same layout position, so the user reads over it.
- **Motion:** 180 ms vertical text roll on the changed word only (the minute number slides up and
  out, the next slides in). The rest of the sentence must not move, so the roll has to be scoped
  to the number token, not the paragraph.
- **Why functional:** this is motion doing what text cannot — it says "this value updated", which
  is otherwise indistinguishable from a stale read.
- **Cost:** medium. `heroCopy` returns strings; it needs to return parts.

### M6. Delivery progress bar jumps

- **File:** `src/components/delivery/customer-pages.tsx:390` (`LinearProgress`)
- **Now:** MUI's determinate `LinearProgress` writes `transform: translateX(...)` directly with no
  CSS transition (confirmed in `node_modules/@mui/material/LinearProgress/LinearProgress.js:443`).
  Every realtime progress update snaps the bar forward.
- **Motion:** `transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1)` on
  `.MuiLinearProgress-bar`. One line of CSS; the bar then *streams* forward like a real route
  progress bar.
- **Why functional:** the bar's whole meaning is continuous progress. A snapping bar contradicts
  the thing it represents.
- **Cost:** trivial.

### M7. New notifications arrive with no arrival

- **File:** `src/components/delivery/notifications-page.tsx:320` (`NotificationRow`),
  `src/components/delivery/customer-app.tsx:107` (`buildNotifications`)
- **Now:** a realtime order update can synthesise a new notification. It is prepended to the list
  and rendered instantly; the unread badge (`customer-home.tsx:167`) increments silently.
- **Motion:** 200 ms fade + 8 px rise for the newly added row only, and a 150 ms scale pulse on
  the badge when the unread count increments.
- **Why functional:** "unread" is an attention channel; it should cost attention when it fires.
- **Cost:** low–medium. Needs an "ids present in the previous render" diff, same helper as M1.

### M8. Rider location markers teleport between GPS ticks

- **File:** `src/components/delivery/location-map.tsx:319,361` (SVG `transform=translate(...)`),
  15 s tick at `location-map.tsx:97`
- **Now:** the fallback (no-Mapbox-token) map re-renders the rider `<g>` with a new transform each
  GPS tick. The rider jumps between two points.
- **Motion:** interpolate the marker transform over 800–1000 ms (linear, matching the GPS cadence)
  so the rider *travels*. The destination and pickup markers stay static.
- **Why functional:** direction and speed of travel are information a rider and a customer both
  read from the marker. A teleport destroys the vector.
- **Cost:** medium. Needs a small `requestAnimationFrame` tween or a CSS transition on `transform`
  for SVG groups (works in modern browsers when the transform is set via the `transform`
  attribute only if `transform-box`/`transform-origin` are right — a rAF tween is safer).

---

## 4. Priority 0 — Continuity (camera and map cuts)

### M9. The pickup map does not follow the located point

- **File:** `src/components/delivery/pickup-request.tsx:102` (`jumpTo`), `:174` (`locate`),
  `:343` / `:387` (the "Use my location" buttons)
- **Now:** the component's own doc comment promises that *"'Use my location' flies the map there"*,
  but the code does not. The effect that centres the map is guarded by a one-shot `flewToInitial`
  ref, so the camera moves exactly once — on the very first point. After the GPS fix arrives
  (`locate()` → `setPoint`), the viewport stays where it was while the centre pin and the
  reverse-geocoded address jump to the new location. The pin slides across a static map.
- **Motion:** on a new GPS fix, `map.easeTo({ center, zoom: 16, duration: 600, essential: false })`.
  Replace the one-shot `jumpTo` with an `easeTo` for the initial centring too, so the map does not
  cut in from the default Yangon view.
- **Why functional:** this is causality. The user pressed "Use my location"; the camera *is* the
  input mechanism here ("panning IS picking"), so the press must produce a visible move to the
  place it located. The motion is the feedback, not a flourish — it also restores the promise the
  doc comment already makes.
- **Cost:** trivial.

### M10. Rider map snaps from heading-up back to north-up

- **File:** `src/components/delivery/mapbox-rider-nav-map.tsx:204`
- **Now:** `map.easeTo({ bearing: 0, pitch: 0, duration: 0 })` — a true cut when the rider leaves
  navigation mode.
- **Motion:** `duration: 300` with a decelerate curve so the map *reorients* rather than teleports.
- **Why functional:** the bearing change is a semantic signal ("you are now in overview mode").
  An instant flip destroys the continuity between the two camera states the rider just lived in.
- **Cost:** trivial. Note that the follow-mode `easeTo` at line 230 already animates correctly.

### M11. Customer tracking map re-fits on every GPS tick

- **File:** `src/components/delivery/mapbox-location-map.tsx:152` (`fitToPoints` call)
- **Now:** the effect re-fits whenever `fitKey` changes. If a rider's position is in `fitPoints`,
  the camera re-fits on each realtime location row, so the map can creep or jump under the user's
  finger mid-interaction.
- **Motion:** do not add motion here — *suppress* it. Fit with `duration: 0` only on the first
  fit, and only re-fit when the set of riders changes, not when a rider moves. If the camera does
  need to follow a moving rider, use `easeTo` 900 ms as the selection path already does
  (`:165`).
- **Why functional:** camera motion must be legible as intent. Continuous re-fitting is noise.
- **Cost:** low.

---

## 5. Priority 1 — Direction (navigation and view changes)

### M12. Customer view switches with no spatial model

- **File:** `src/components/delivery/customer-app.tsx:380` (home), `:392` (track), `:435` (orders),
  `:448` (profile), `:460` (notifications)
- **Now:** five sibling views render conditionally. Switching tabs replaces the entire page
  contents in one frame. The user has no idea whether they moved forward or sideways.
- **Motion:** 180 ms fade + 8 px rise on the incoming view, and 120 ms fade-out on the outgoing
  view, with a **direction axis tied to the tab order**: horizontal slide for sibling tabs
  (orders ↔ profile), vertical rise for hierarchical navigation (home → track → notifications).
  Keep the displacement small (≤ 12 px) so it reads as a reorganisation, not a carousel.
- **Why functional:** the bottom nav has an order; the content should move consistently with it.
  This is the "direction" job that the rider app already gets right with `rf-rise`.
- **Cost:** medium. Because Next 16 keeps routes alive in `<Activity hidden>`, the outgoing view is
  still mounted — see §6 of the study and M12a.
- **M12a:** if a shared-element or FLIP transition is attempted, remember that the hidden route's
  effects are cleaned up on hide (this is exactly the class of bug the MUI ripple patch fixed).
  Prefer a CSS-only cross-fade keyed on the view id over a JS-driven FLIP.

### M13. Header title swaps instantly

- **File:** `src/components/delivery/customer-home.tsx:95` (`CustomerHeader`), title rendered at
  `customer-app.tsx:333` and `:347`
- **Now:** "Orders" becomes "Your orders" between two frames, in the same slot.
- **Motion:** 150 ms cross-fade of the title text only. The study is explicit: never slide the
  `h1` — a moving title breaks the reading order of the page.
- **Why functional:** the title is the page's identity. A cross-fade tells the user the *same*
  header now holds a different page, instead of teleporting text.
- **Cost:** low.

### M14. Bottom-nav icon swaps without a transition

- **File:** `src/components/delivery/customer-pages.tsx:129` (`const NavIcon = active ? … : …`)
- **Now:** the icon component is swapped (outline → filled) and the new SVG is painted instantly.
  The pill background already transitions colour at 150 ms (`:159`), so the pill animates while
  the glyph inside it snaps — a visible mismatch.
- **Motion:** 150 ms cross-fade between the two icon SVGs, matching the existing background
  transition exactly.
- **Why functional:** the selected tab must be distinguishable in peripheral vision. A snapping
  glyph against an animating pill reads as a glitch, not as selection.
- **Cost:** low. Render both icons and cross-fade with opacity.

### M15. Pickup form → confirmation is a hard cut

- **File:** `src/components/delivery/pickup-request.tsx:275` (`state === "sent"` branch)
- **Now:** the entire form is replaced by a success panel containing a static
  `<CheckCircleOutlined />`. There is no transition between "I submitted a form" and "it worked".
- **Motion:** 280 ms form collapse (the form's height and opacity animate out) → 150 ms check
  scale-in from 0.8 with a spring-ish curve → 180 ms fade-in of the confirmation copy. One
  `navigator.vibrate(15)` success haptic at the moment the check appears.
- **Why functional:** the causality link between the submit press and the confirmation must be
  visible. Right now the user's eye has to re-find the content.
- **Cost:** medium. The submit button should also keep its ripple/loading state until the
  transition starts.

---

## 6. Priority 1 — Causality (action → feedback)

### M16. `ActionToast` appears with no entrance or exit

- **File:** `src/components/delivery/common.tsx:176`, CSS `src/app/globals.css:4837`
  (`.operations-notice`)
- **Now:** the toast is inserted and removed from the DOM with zero animation. It appears
  instantly in the bottom of the screen, and disappears instantly 6 s later — so it is easy to
  miss, or to read only half of.
- **Motion:** enter 280 ms slide-up (12 px) + fade (`--motion-panel`); exit 180 ms fade with a
  6 px slide down. Respect `prefers-reduced-motion`.
- **Why functional:** the toast *is* the causal acknowledgement of the action the user just took.
  An element that appears and vanishes in 0 ms is easy to miss, which defeats the whole
  acknowledgement.
- **Used by:** `seller-app.tsx:473`, `support-app.tsx:411`, `fleet-insights-app.tsx:644`.
- **Cost:** low. CSS-only, since the component unmounts on dismiss (an exit animation needs a
  "leaving" state held for 180 ms, or `animation` on mount plus a delayed unmount).

### M17. `.dash-notice` appears with no entrance

- **File:** `src/components/delivery/manager-ui-components.tsx:61`, `src/components/delivery/manager-cod.tsx:149`
- **Now:** the slot renders `.dash-notice` (`src/app/globals-late.css:753`) which has colours but
  no animation. It appears and vanishes instantly.
- **Motion:** 180 ms fade + 8 px rise on the notice, matching M16 but shorter (it is inline in the
  page, not an overlay).
- **Cost:** trivial (CSS).

### M18. The customer app has no acknowledgement channel

- **File:** `src/components/delivery/customer-app.tsx:157` (`markAllRead`), `:455` (sign out)
- **Now:** "Mark all read" writes to local storage and the list re-renders; nothing tells the user
  it worked. Sign-out removes the bell with no confirmation.
- **Motion:** (a) reuse the `ActionToast` component for customer actions — it is already generic
  and already carries `aria-live="polite"`; (b) on sign-out, cross-fade the authenticated header
  state out (180 ms) rather than letting the bell vanish mid-frame.
- **Why functional:** every other console in the product acknowledges its actions. The customer
  app is the only one that does not, so customers tap and tap again.
- **Cost:** low.

---

## 7. Priority 1 — Direction (list insertion)

### M19. Rows are inserted into live lists with no entrance

- **Files:**
  - `src/components/delivery/customer-pages.tsx:731` (`OrdersPage`) — customer's order list
  - `src/components/delivery/support-app.tsx:226` (`.support-case-row`) — support queue
  - `src/components/delivery/seller-app.tsx:264` (`.operations-list-item`) — seller shipments
  - `src/components/delivery/manager-app.tsx:700` (`.manager-order-row`) — dispatch queue
  - `src/components/delivery/rider-flow.css:803` (`.rf-stop-list > li`) — the rider's own stop
    list. The rider flow animates its *sheets* (`rf-rise`) but not a stop that is inserted into
    the list, so this one is a gap too, not a reference.
- **Now:** all four consoles refresh on a 30 s reconcile (`use-workspace.ts:192`) and insert rows
  wherever a key first appears. A new case appears in the queue with no cue that it is new.
- **Motion:** 180 ms fade + 8 px rise for rows that were not in the previous render. Rows that
  were already there must not move or re-animate (this is why the animation is per-new-key, not
  per-render).
- **Why functional:** in a queue, "which row is new?" is the question the user opens the screen to
  answer. Today the answer is invisible.
- **Cost:** medium. One shared hook, e.g. `useEnteredKeys(ids: string[]): Set<string>`, reused by
  M1, M7, and M19.

### M20. Support case selection is a hard swap

- **File:** `src/components/delivery/support-app.tsx:252` (`.support-case-detail`)
- **Now:** selecting a case replaces the detail panel instantly.
- **Motion:** 150 ms cross-fade of the detail panel body only, with the case row's selected
  background transitioning at the same 150 ms (it currently has no transition, unlike the customer
  bottom nav pill).
- **Why functional:** continuity between the row the user pressed and the panel that answers it.
- **Cost:** trivial.

---

## 8. Priority 2 — Forms, scanning, and edge states

### M21. Scan result swaps instantly between fail and success

- **File:** `src/components/delivery/scan-sheet.tsx` (result rendering, `aria-live` region at `:223`)
- **Now:** a scan either fails or resolves; the sheet's contents are replaced with no transition,
  and the `aria-live` region announces the text at the same moment the visual changes.
- **Motion:** 180 ms cross-fade between scan states, plus a 150 ms scale-in on the success glyph.
  Keep the live-region announcement immediate — motion must never delay the accessible name.
- **Cost:** low.

### M22. COD settle confirmation

- **File:** `src/components/delivery/manager-cod.tsx` (ledger rows and settle action)
- **Now:** settling a row flips `cod_status` and the KPI totals change instantly.
- **Motion:** 180 ms cross-fade on the row's status badge; the "Settled" KPI value rolls (M2).
  One confirmation haptic on settle.
- **Cost:** low (reuses M2).

### M23. Error notices appear without a cue

- **Files:** `src/components/delivery/seller-app.tsx:224`, `src/components/delivery/support-app.tsx:175`
  (`.error-notice`)
- **Now:** a failed load renders an error block instantly at the top of the page.
- **Motion:** 180 ms fade + 8 px rise, `role="alert"` unchanged. Do not shake — the error is a
  system state, not a user mistake.
- **Cost:** trivial.

---

## 9. What we are deliberately not doing

- **No parallax, no decorative reveals, no page-load choreography.** The rider flow already has a
  rich motion vocabulary; extending it into the customer and operations apps would be style for
  its own sake.
- **No animated page transitions on route navigations.** Next 16 with `cacheComponents` keeps
  routes mounted in `<Activity hidden>`; a route-level transition risks re-introducing the
  ghost-ripple class of bug the MUI patch fixed. View-level CSS transitions (M12) are safe because
  they are pure CSS with no effect lifecycle.
- **No motion on data that the user did not cause and cannot act on.** The exceptions are M1, M7,
  and M19, where the change *is* actionable.
- **No infinite loops except the location pulse** (`--motion-live`). `rf-route-pulse` and
  `dv-marquee` are the only sanctioned loops.

---

## 10. Implementation contract

1. **Reduced motion is mandatory.** Every entry above must be inside a
   `@media (prefers-reduced-motion: reduce)` block that reduces it to a cross-fade of ≤ 100 ms or
   removes it. Existing reduced-motion blocks: `src/app/globals.css:40,5501,6270`,
   `src/components/delivery/rider-delivery.css:1324,1472`,
   `src/components/delivery/rider-flow.css:1729`. Add the new rules to these, not to new blocks.
2. **Never animate `width`/`height`/`top`/`left`** for anything larger than a chip. Use
   `transform` and `opacity` only; the rider flow already follows this rule.
3. **One shared helper** for "which ids are new in this render" (`useEnteredKeys`) — M1, M7, M19
   all need it. Put it in `src/components/delivery/` next to `common.tsx`.
4. **One shared timing source.** Read the tokens from CSS custom properties defined once in
   `src/app/globals.css` and injected into the MUI theme (the study §13 sketches this); do not
   hard-code `180ms` in a component.
5. **Haptics accompany the causal ones only** — M15 (request sent), M22 (settled), and the rider
   handover. Not for navigation, not for list insertion.
6. **Motion budget:** every surface stays under 700 ms total for a single interaction; nothing
   blocks input; nothing animates while a sheet is being dragged.

---

## 11. Suggested implementation order

| Order | Item | Why first |
| --- | --- | --- |
| 1 | M6 (progress bar transition) | One line of CSS, fixes an obvious "snapping" defect |
| 2 | M16 + M17 (notice/toast entrance) | Two CSS blocks, affects three consoles |
| 3 | M9 + M10 (map cuts) | Two lines each, removes two hard cuts |
| 4 | M19 + M1 + M7 (list insertion helper) | One shared hook unlocks three consoles |
| 5 | M14 + M13 + M20 (small cross-fades) | Cheap, high visible payoff |
| 6 | M12 (customer view transitions) | Biggest UX win, biggest risk — do it with CSS only |
| 7 | M4 + M5 (status/ETA) | Needs careful scoping so only the value animates |
| 8 | M2 + M3 + M22 (KPIs, sparkline, settle) | Numbers and charts |
| 9 | M15 + M18 + M21 + M23 (forms, toasts, scan) | Confirmations and acknowledgements |
| 10 | M8, M11 (marker tween, camera discipline) | Needs its own care |
