# Button and control design for one-handed, outdoor mobile use (Oern)

Method note: ~25 tool calls (search + fetch). Several primary pages (Apple HIG, M3, Polaris, NN/g touch/thumb pages, Karlson PDF) returned empty, partial or oversized content, so items from them are marked as secondary or unverified. Oern code was spot-checked in src/app/globals.css and mui-provider.tsx.

## 1. Touch target size (standards and empirical evidence)

### Takeaway
Standards converge on about 44-48 px/pt as a floor (WCAG 2.5.8 is only 24 CSS px), and empirical work puts safe one-thumb targets at roughly 9-10 mm (7 mm centre, ~12 mm corners per Hoober) with larger targets needed when moving. Oern's 48px minimum and 52-56px primary buttons are at or above the evidence for a seated or standing user. At low-DPI Android sizes 48 CSS px is only about 8.5-9 mm (inference), so 48 is a true floor, not a comfortable size, for gloved or moving riders.

### Cited Findings
- WCAG 2.5.8 (AA) requires targets of at least 24x24 CSS px, or smaller targets whose 24px-diameter circles do not hit neighbours; the W3C recommends meeting the minimum even where spacing passes and aiming for the stricter 2.5.5 for important controls. Rationale cites tremor and imprecise input — [W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Material/Android: at least 48x48dp with 8dp or more between targets; visible element may be smaller if padding supplies the target; Material notes iOS uses 44 — [Android accessibility help](https://support.google.com/accessibility/android/answer/7101858), [Material density](https://material.io/design/layout/applying-density.html) (via search snippets; the M3 page itself fetched empty)
- web.dev (Google) guidance: about 48 CSS px targets spaced about 8px apart (page last updated 2020) — [web.dev accessible tap targets](https://web.dev/articles/accessible-tap-targets)
- Apple 44x44pt: only confirmed through general knowledge/secondary mentions (HIG page fetched empty) — see Material density link above, which states iOS uses 44.
- NN/g: minimum 1 cm x 1 cm, citing Parhi, Karlson and Bederson (2006); fingertip width 1.6-2 cm, thumb impact area about 2.5 cm (MIT Touch Lab); larger targets for primary CTAs, use while moving, older users; about 2 mm minimum spacing; side-by-side gives more room for error than stacking; the article gives no miss-rate percentages — [NN/g Touch Target Size](https://www.nngroup.com/articles/touch-target-size/)
- Parhi, Karlson, Bederson (MobileHCI 2006): 9.2 mm recommended for discrete one-thumb tasks (buttons/checkboxes) and 9.6 mm for serial tasks without degrading performance and preference; exact error-rate thresholds were garbled in my source — [MS Research abstract](https://www.microsoft.com/en-us/research/?p=155150), [DOI](https://dx.doi.org/10.1145/1152215.1152260). A later citing paper reportedly says error rate differences in discrete tasks were not significant (secondary, unverified).
- Hoober (2017, 120M+ touch events plus 1,300+ observations): targets can be as small as 7 mm at screen centre and about 12 mm at corners; sizes chosen to capture 95% of taps; old 22 mm ISO figure obsolete; vendor pixel-based sizes unreliable, so specify physical units — [UXmatters 2017](https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php)
- Finger-touch model: error under 4% needs about 4.3 mm under visible-boundary rule; error rises sharply at 5 mm and below (search snippet, secondary) — [LMU review PDF](https://www.mmi.ifi.lmu.de/lehre/ss15/ps/papers/Huber-InputOnTouchDevices.pdf)
- Motor-impaired users: 3x more tap errors than mouse; study recommends at least 18 mm (snippet) — [CHI 2017 Touchscreen Access](https://faculty.washington.edu/leahkf/pubs/CHI2017-TouchscreenAccess.pdf)
- Walking (Schildbach and Rukzio, MobileHCI 2010, n=16): +31% selection time, +23% error rate vs standing; enlarging targets 20% gave significant gains and 40% almost fully offset the walking penalty — [Schildbach and Rukzio PDF](https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.100/institut/Papers/Prof_Rukzio/2010/SchildbachMobileHCI2010.pdf) (snippet summary, not full text)
- Myanmar screens: top mobile resolutions Sept 2026 are 360x800 (15.2%), 393x873 (10.6%), 414x896 (7.3%), 360x806 (6.0%), 393x851 (4.4%), 407x904 (4.0%); StatCounter gives no Android/low-end split — [StatCounter Myanmar](https://gs.statcounter.com/screen-resolution-stats/mobile/myanmar)

### Inferences
- Unit conversion (my arithmetic, not sourced): a 6.1-6.5" phone with 360 CSS px viewport width is about 64-67 mm wide, so 1 CSS px is about 0.18-0.19 mm. 48px is about 8.5-9 mm; 52px about 9.5-10 mm; 56px about 10-10.5 mm. Oern's 48px floor is slightly under the 9.2 mm Parhi figure on small phones; 56px primaries meet it with margin. Verify with real devices.
- No located study tested gloves, wet fingers or motorbike vibration. Best proxy is the walking study (+20% to +40% size) and the motor-impairment 18 mm figure; so riders' critical controls (arrived, delivered) should target 56-64px, and the rest 48px with 8-12px gaps.
- Capacitive screens often fail with thick gloves regardless of target size; size cannot fix hardware (no source; general knowledge).

### Gaps
- No empirical miss rates at 7-9 / 10 / 12 mm broken down by condition were retrieved (Karlson PDF too large, NN/g gives none).
- No gloved/wet-finger study found; no motorbike study found.
- Apple HIG 44pt and M3 accessibility page not directly verified.
- No Myanmar-specific low-end Android DPI/size data.

## 2. One-handed ergonomics, bottom bars, bottom sheets

### Takeaway
Hoober's data shows one-handed thumb use is common but not universal (49% in 2013; about 75% touch with one thumb in 2017), and the classic "thumb zone" sweep map is disputed by Hoober himself. Bottom or centre placement is still safer, and users do tap top-corner Back buttons. Evidence on bottom sheets vs modals is thin.

### Cited Findings
- 2013 observation of 780 touching users: 49% one-handed, 36% cradled, 15% two-handed — [Roselli quoting Hoober](https://adrianroselli.com/2013/03/observing-users-with-mobile-devices.html), [UXmatters 2013](https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php); revised 2017: 75% touch with one thumb, fewer than 50% hold one-handed, 36% cradle, 10% finger of other hand — [UXmatters 2017](https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php)
- Hoober 2017 calls the widely circulated thumb-sweep chart incorrect, says people prefer to view and touch the screen centre, users often tap a top-right Back button, and dangerous controls should sit away from other items — same UXmatters 2017 link
- Wroblewski and Grigsby: top navigation is far from ideal on touch devices; fixed-bottom bars cost screen space and need JS (2012 deck) — [Adactio summary](https://adactio.com/links/5427), [LukeW deck](https://static.lukew.com/omwe_04242012.pdf). "Top 40% dead zone" figure is unsourced; do not rely on it.
- NN/g modal guidance: modals suit irreversible or destructive warnings and blocking info; interruptions cost context, and overuse trains dismissal; nonmodal desktop popups may become full-screen modals on mobile; avoid modals in high-stakes flows like checkout — [NN/g Modal vs nonmodal](https://www.nngroup.com/articles/modal-nonmodal-dialog/)

### Inferences
- Oern's bottom-anchored primary and bottom sheet fit the evidence, but since Hoober says reach is uneven and many users cradle, avoid putting rare destructive links directly under the primary (they are in the thumb path). Keep "Report a problem" separated by 12-16px or place it in a "more" menu.
- A persistent bottom sheet over a map is nonmodal in NN/g terms; use a true modal only for irreversible confirmations.

### Gaps
- No peer-reviewed comparison of bottom sheet vs modal for error rates found.
- Floating vs fixed bottom bar: no evidence found.
- Large-phone reach: only unsourced blog claims; no primary data.

## 3. Button hierarchy, shape and labels

### Takeaway
All major systems use one primary per view, secondary as a lower-emphasis button, and sentence-case verb labels. I found no evidence that pill vs rounded-rect affects affordance; shape is a brand choice if fill and contrast are clear.

### Cited Findings
- GOV.UK: one default (primary) button per page, avoid multiple; secondary for secondary CTAs; warning button sparingly for serious irreversible actions with a confirmation step and not red alone; sentence-case action labels ("Save and continue"); avoid disabled buttons because of poor contrast and confusion — [GOV.UK Button](https://design-system.service.gov.uk/components/button/)
- Apple HIG recommended (not verified on page): one prominent button per context, destructive role for irreversible actions — HIG fetch returned empty; see [HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- Polaris, Carbon, Primer, Atlassian, M3: fetches failed or not attempted; no verified quotes.

### Inferences
- Oern's primary/outline/text-link triad matches common practice. Underlined tertiary links at 48px are fine, but two stacked in the sheet increase mis-tap risk; consider one "More" or put "Report a problem" as an outlined 48px button on a separate row.
- Code finding (confidence medium): globals.css defines `.button` at min-height 43px, 12px font, then a later override sets 52px, 15px, `--radius-md` (12px) and `.button-small` 48px; MUI Button sets minHeight 48, radius 999. So class-based `.button` is a 12px-radius rect, not the pill DESIGN.md calls for on phones; and the base `.icon-button` is 36px, overridden to 48 later. Check which cascade wins per screen.

### Gaps
- No affordance study on pill vs rect shapes found.
- Verb-first labels: only GOV.UK examples; no experimental evidence located.

## 4. Critical and irreversible actions

### Takeaway
Slide-to-confirm is established in rider apps but is a path-based gesture; WCAG requires a non-gesture alternative. Evidence says confirm dialogs suffer fatigue and undo is preferred for reversible actions, though this is expert consensus, not controlled studies.

### Cited Findings
- WCAG 2.5.1 (Level A): path-based gestures such as swipe need a single-pointer alternative without a path gesture, unless essential — [W3C 2.5.1](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html)
- WCAG 2.5.7 (AA): any dragging functionality needs a single-pointer non-drag alternative (e.g. tap track on slider); an alternative cannot rely only on swipe/flick — [W3C 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- Slide-to-confirm: keep the slider but add a plain button/accessibility action with a clear consequence label — [Apple Developer Forums thread](https://developer.apple.com/forums/thread/729098), [LogRocket](https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers)
- Uber and delivery-driver apps use swipe controls for arrive/start/finish; Grab driver app not documented in what I found — [Uber drive basics](https://www.uber.com/nz/en/drive/basics/how-to-take-trips/), [Onde driver tutorial](https://support.onde.app/en/articles/1047459-driver-app-tutorial)
- Confirmation dialogs lose effect when overused; undo suits reversible actions; typed confirmation for severe cases; one source states no controlled studies compare undo and confirmation — [DEV Community overview](https://dev.to/137foundry/how-to-choose-between-confirmation-dialogs-undo-windows-and-soft-delete-patterns-1opj), [Matuschak note](https://notes.andymatuschak.org/zXH4ASvHNz488hCNgrBjQJK) (weak sources)
- GOV.UK confirmation step uses a different button style first, then a warning button for the final — GOV.UK link above

### Inferences (not sourced; my recommendation)
- Picked up: tap button with 5-8s undo toast (reversible by manager). Delivered (no cash): large tap button, undo toast. COD collected: amount shown on the button ("Confirm MMK 68,000 collected"), single tap on a confirm sheet; money is the real irreversible risk, so use confirm sheet, not swipe. Swipe-to-slide is optional for "delivered", always paired with a visible button (matches DESIGN.md Don't).
- Tap-and-hold as the only confirm is worse for tremor or bumpy rides (timed gestures); use as an optional extra only (also noted in the search result as inference).
- Manager reassign: undo toast plus audit log; reconcile: confirm sheet summarising totals; destructive cancels: typed or secondary confirm.
- Slide control on a moving motorbike mount is path-sensitive; a 56px+ button with a confirm sheet is more robust (inference).

### Gaps
- No slip-error experimental data for swipe vs tap in rider settings.
- No documented teardown of Grab, Lalamove, Foodpanda, DoorDash driver controls; Uber/Onde are vendor help pages.
- NN/g/Baymard confirm-vs-undo pages not retrieved.

## 5. States: loading, disabled, pressed, focus, double submit

### Takeaway
Experts advise keeping submit buttons enabled with explanations, using native `disabled` or `aria-disabled` deliberately, and protecting against double submit on both client and server.

### Cited Findings
- Roselli: default disabled styling is a poor signal, disabled controls are exempt from contrast rules, users still try to click them; keep submit buttons enabled and show a polite message; handle double submits on the back end; use `aria-disabled` only when necessary — [Roselli, Don't disable form controls](https://adrianroselli.com/2024/02/dont-disable-form-controls.html)
- aria-disabled keeps focus and click events (you must block behaviour yourself); Deque says native buttons should use `disabled` — [Deque](https://docs.deque.com/issue-help/1.0.0/en/button-state-disabled/) (via snippet)
- GOV.UK: ignore the second click with `data-prevent-double-click`, which needs JS, so also guard on the server; show a spinner on slow connections — GOV.UK link in section 3
- Oern code: `.button:disabled` is opacity 0.55 and `:active` is translateY(1px); MUI focus ripples disabled — src/app/globals.css (lines ~538-544), mui-provider.tsx

### Inferences
- Add an idempotency key per action (e.g. delivery-complete with client-generated UUID) so retries on flaky networks cannot duplicate COD records; show "Saving..." with the label stable in width and `aria-busy`, and keep the button focusable but ignore taps (inference).
- 55% opacity on orange-with-white text fails contrast but is exempt; add a visible reason line under the button ("Scan the parcel to continue").
- :active in iOS Safari only fires with a touchstart listener or `-webkit-tap-highlight`; test (general web knowledge, not verified here). MUI ripple covers the press cue.

### Gaps
- NN/g disabled-button page not retrieved; no empirical data on double-tap rates on flaky networks.

## 6. Form controls, chips, segmented controls, tabs

### Takeaway
I found no authoritative sizing sources in this pass beyond the target-size rules; the bottom-tab, chip and segmented norms in Oern DESIGN.md (labeled tabs, 48px targets) are consistent with the 48dp/8dp rule.

### Cited Findings
- Oern's 28px status chips are display-only per DESIGN.md; any tappable chip must still meet 24px (WCAG) and ideally 48px target with padding — [W3C 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Android touch target](https://support.google.com/accessibility/android/answer/7101858)
- Input font size 16px avoids iOS zoom-on-focus (DESIGN.md Input rule; browser behaviour not re-verified here)

### Inferences
- Filter chips: visual height 36px with 48px hit area via padding, 8px gaps.

### Gaps
- Material tab, chip, segmented-button specs, Carbon, Primer and Atlassian sizes not retrieved.

## 7. Haptics and sound on web

### Takeaway
Vibration API works in Chromium-family Android browsers but never in iOS Safari, so haptics can only be a progressive enhancement and cannot carry meaning.

### Cited Findings
- `navigator.vibrate` supported in Chrome 30+, Edge, Opera, Samsung Internet, Android Browser; not supported in Safari iOS (all versions listed through 27.x) and listed unsupported in Firefox 129+ — [caniuse Vibration](https://caniuse.com/vibration)
- MDN: Limited availability, not Baseline; `vibrate()` does nothing when unsupported, so feature-detect; patterns are ms arrays; page does not cover activation rules — [MDN Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)

### Inferences
- Use `navigator.vibrate?.(30)` on success and a double pulse on error for Android riders; pair with a visible state change and optional short audio. No evidence found that haptics help outdoor/moving riders; helmets, gloves and engine vibration likely mask it (speculation).

### Gaps
- No studies on haptic feedback efficacy for riders; no iOS PWA haptic workaround verified (iOS PWAs still lack Vibration API per caniuse for Safari).

## Summary comparison with Oern rules (recommendations, inference unless cited above)
- 48px min / 8px spacing: keep, matches Material, web.dev; raise rider critical actions to 56-64px and gaps to 12px for moving use.
- 56px pill primary: good; confirm cascade so `.button` isn't 43-52px rect on rider screens.
- 1px #64748b outline secondary: fine; ensure it is 48px+ tall.
- Stacked tertiary links under primary: separate or consolidate to reduce mis-taps.
- 55% disabled: keep only with a visible reason; prefer enabled-with-error for submits.
- Swipe: always keep a visible button (already in DESIGN.md); COD uses confirm sheet with amount; use undo toasts for reversible steps.
- Focus ring 3px #fdba74: check 3:1 contrast against white (apricot likely fails non-text contrast; not measured here).
- Haptics: enhancement only.
