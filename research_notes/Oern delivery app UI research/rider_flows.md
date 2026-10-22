# Rider/driver app UI flow patterns vs Oern's current rider flow

Method note: web search in this session returned thin, mostly vendor/help-center material. Many of the named apps (Grab, Foodpanda, Shopee/SPX, Glovo, Deliveroo, Routific, Circuit, Track-POD) have NO verifiable driver-side documentation found. Those are listed under Gaps rather than guessed. Oern facts come from reading the repo (DESIGN.md, PRODUCT.md, grep of rider-*.tsx), not from the web.

## Oern's current rider flow (baseline, from repo)

### Takeaway
Oern already has the core skeleton: a lockable job board, a bottom-anchored stop sheet over a full-bleed map, a guarded "I've arrived", separate COD chip, a reason-based failure flow. Differences vs competitors are mostly in POD evidence, offline writes, accept-timer/offer semantics and cash reconciliation.

### Cited Findings
- Stop sheet: grab handle, orange eyebrow ("Stop 1 of 1 · Deliver parcel"), recipient name, address, 28px ETA with confidence label, parcel/COD chips, one full-width pill primary, two underlined tertiary links; turn card with "Directions" action at top of map — /Users/happer/Projects/oern/DESIGN.md (Components > Rider stop sheet; documented, read directly)
- Primary phone buttons 56px, min target 48px, 8px spacing; advance action in bottom third; swipes always have a button alternative; COD shown as its own chip in MMK; irreversible COD transitions confirmed in dialog — /Users/happer/Projects/oern/DESIGN.md (Layout, Do's and Don'ts)
- Product scope: rider workflow includes acceptance, pickup, navigation, COD recording, completion, issue reporting; location sharing only after pickup, browser permission, background tracking not guaranteed (web app, not native) — /Users/happer/Projects/oern/PRODUCT.md
- Code: job board has a `lockReason(job)` that blocks starting a job; "I've arrived" asks for confirmation when rider is beyond a distance threshold ("You're X away. Arrived anyway?"); COD has a `codMode` ("full" etc.) and `codDue`; can't-deliver flow = reason chips + parcel selection + "what happens next" action, "other" requires a >=3 char note; the can't-deliver submit shows "You're offline. This needs a connection to record."; pickup has a "cannot collect" reason list — /Users/happer/Projects/oern/src/components/delivery/rider-job-board.tsx, rider-active.tsx, rider-handover.tsx, rider-pickup.tsx (grep only; not fully read, medium confidence)
- grep found no photo, signature, OTP/PIN, or accept-countdown handling in the rider files — same files (absence by grep; confirm before acting)

### Inferences
- No evidence-grade POD (photo/PIN) and no offline queue for exception writes appear to exist; these are the biggest gaps vs fleet software below.

### Gaps
- I did not read the full files, rider-delivery CSS, or RLS/COD tables, so "does not exist" claims need verifying.

## Job board and job acceptance (card content, price, timers, locking)

### Takeaway
Documented offer content across Lalamove/DoorDash is: pickup and drop locations, distances, price/fare, vehicle type, and a short decision window. Penalties for ignoring/declining exist at Grab and DoorDash. Oern's "board with lock reasons" is closer to a scheduled-job model than to a push-offer model; both are valid but should be chosen explicitly.

### Cited Findings
- Lalamove driver alert shows pickup/drop-off, distance to each point, estimated fare and required vehicle type; accept by tapping; declining allowed within the given time — [Lalamove KSA guide](https://www.lalamove.com/en-sa/blog/how-to-take-orders-on-the-lalamove-driver-app) (official; regional)
- Lalamove Sa'ar/US blog adds order type and user order notes shown before accepting — via search summary of [Lalamove US guide](https://www.lalamove.us/en-us/blog/how-to-take-orders-on-the-driver-app) (not fetched; medium-low confidence)
- DoorDash offer: payout, restaurant/pickup distance, approx drop distance, timer ~45s — [third-party explainer](https://joingerald.com/learn/work--income/how-doordash-dasher-app-works) (secondary; timer length unconfirmed)
- DoorDash Earn by Time: one decline/unassign per hour; timed-out offers count; second ends dash or switches mode — [DoorDash help](https://help.doordash.com/en-us/dashers/article/time-earnings-mode) (official)
- DoorDash, some stores: mileage/delivery pay not shown before accept; hourly minimum shown instead — [DoorDash help](https://help.doordash.com/en-us/dashers/article/new-pickup-process-at-some-stores-lower-wait-times) (official)
- Grab "Driver Timeout": drivers who consistently ignore/cancel are marked Unavailable; visible countdown; minimum 30s, escalating — [Grab blog](https://www.grab.com/my/ms/blog/driver/car/driver-timeout-feature-protecting-high-performing-driver-partners/) (official, rollout 2018, may be outdated)
- Grab Back2Back: accept next job while finishing the current one — [Grab](https://grab.com/ph/appfeatures/back-to-back) (official; offer-screen detail not found)
- Dispatch software generally: offer expires and returns to dispatcher if timer lapses — [Autocab DC+](https://support.autocab.com/portal/en/kb/articles/how-to-accept-or-reject-a-job-dc-plus) (official, taxi software, not courier)

### Inferences
- Showing earnings AND distance AND pickup/drop summary on the card is the common minimum; hiding pay (DoorDash pickup variant) is a documented controversial choice, so Oern (salaried/assigned riders, probably) should show distance/COD/parcel count but need not show earnings unless pay is per job.
- If Oern keeps manager-assigned jobs, skip countdown timers; if it later adds open offers, pair any timer with a visible non-punitive decline and escalate only after repeated ignores (Grab/DoorDash pattern).

### Gaps
- No verified current Grab, Foodpanda, SPX, Glovo, Deliveroo, Uber, Circuit, Routific, Track-POD job-board layouts found. Mobbin/Page Flows MCP tools were not used in this session.

## Stop execution: state sequence, arrived, navigation hand-off

### Takeaway
Lalamove documents an explicit "slide to confirm arrival" at pickup plus photo, then explicit "Delivered". I found no documented geofence auto-arrival for any named app. Oern's explicit arrived with distance guard is consistent with practice.

### Cited Findings
- Lalamove: at pickup, drivers slide to confirm arrival and take a clear photo of the item; at drop-off tap "Delivered" — [Lalamove](https://www.lalamove.com/en-sa/blog/how-to-take-orders-on-the-lalamove-driver-app) and search summary of [Lalamove FAQ](https://www.lalamove.com/en-hk/app-faq) (the KSA page itself did not mention the slide/photo; the slide claim came from the search summary of another Lalamove page, medium confidence)
- Lalamove: built-in map or external navigation app permitted — [Lalamove KSA](https://www.lalamove.com/en-sa/blog/how-to-take-orders-on-the-lalamove-driver-app)
- Lalamove: confirm delivery time/location with customer before trip — same page
- DoorDash: customer-unavailable flow starts with call and text — [DoorDash help](https://help.doordash.com/en-us/dashers/article/how-to-complete-a-delivery-when-the-customer-is-unavailable)

### Inferences
- A slide-to-confirm for "arrived" is a deliberate mis-tap guard; Oern uses distance-conditional confirmation instead, which adds friction only when needed. Note DESIGN.md says swipe must never be the only path; Lalamove-style slide would need a button alternative.
- Not verifiable: whether any app auto-advances state by geofence. Treat as design option, not precedent.

### Gaps
- No documentation found for Grab/Foodpanda/SPX state sequences, bottom-sheet contents, or Google Maps/Waze deep-link vs in-app turn-by-turn behavior.

## Proof of delivery

### Takeaway
Fleet vendors offer photo, signature, barcode, ID check and PIN; consumer-delivery platforms rely on photo, which is documented as weak evidence in disputes. For Yangon motorbike COD, recipient name + cash confirmation + optional photo/OTP is probably the realistic evidence set.

### Cited Findings
- Onfleet POD: photo, barcode (multiple, can be required), contactless signature, age/ID verification, notes — [Onfleet](https://onfleet.com/proof-of-delivery) (vendor marketing; offline and geofence not covered on page)
- Circuit: e-signature, photo of package at door, separate recipient and internal notes; POD stored indefinitely — via search summary of [Circuit blog](https://getcircuit.com/blog/proof-of-delivery-app) (not fetched; vendor)
- Uber Direct developer POD options: signature, barcode, picture, identification, PIN code — [Uber developer docs](https://developer.uber.com/docs/deliveries/guides/proof-of-delivery) (official, API product, not Eats driver app)
- Uber driver app prompts for the required proof; support reachable in app — [Uber blog](https://www.uber.com/en-AU/blog/delivering-non-food-items) (official)
- Lalamove valid photo: clear, well-lit, shows delivered item and drop location (house number/door/logo); selfies, blurry or zoomed photos invalid — [Lalamove US FAQ](https://www.lalamove.us/en-us/faq) (via search summary)
- Photo-as-proof can be gamed: driver photographed order on doorstep then took it; platform initially treated photo as proof until CCTV — [AOL report](https://www.aol.com/news/uber-eats-driver-customer-takeaway-blackpool-163332288.html) (news anecdote)
- HERE Last Mile "Unable" tab allows a photo with reason and note for failed delivery — [HERE docs](https://developer.here.com/documentation/last-mile/user_guide/topics/driverapp-complete-delivery.html)

### Inferences
- Photo alone is weak evidence; timestamp + GPS stamp + recipient-visible confirmation (PIN/OTP or customer in-app "received") is stronger. Inferred, not from a single source.
- Friction rank (inference): recipient name < photo < PIN (needs customer to have/receive code, SMS cost/coverage) < signature on small screen in sun/rain.

### Gaps
- Offline capture and upload retry behaviors: no vendor doc found. Evidence on Myanmar SMS/OTP deliverability not searched.
- Deliveroo/Foodpanda/Glovo PIN or handover flows: not found.

## Cash on delivery

### Takeaway
Documented practice is to label payment mode clearly and have an explicit failed-collection path that doesn't penalize the rider. No source found on short/over-payment, change, or end-of-shift reconciliation UI.

### Cited Findings
- Lalamove marks wallet-paid orders "Received by credit" so drivers never ask for cash; cash orders paid in exact amount to driver — [Lalamove UAE](https://www.lalamove.com/en-ae/blog/how-to-check-payment-mode-is-it-a-cash-or-wallet-payment), [Lalamove HK FAQ](https://www.lalamove.com/en-hk/app-faq)
- Lalamove advises payment fully settled before completing — [Lalamove KSA](https://www.lalamove.com/en-sa/blog/how-to-take-orders-on-the-lalamove-driver-app)
- DoorDash COD: tap "Issue Collecting Cash Payment" and pick a reason; base pay kept, rating unaffected — [DoorDash help](https://help.doordash.com/en-au/dashers/article/cash-on-delivery-overview-and-faq)
- DoorDash Drive COD: wait 5 min for unavailable customer, then abandon; fee still charged, no cash collected — [DoorDash Drive](https://developer.doordash.com/docs/drive/how_to/deliver_cash_orders)
- SPX COD: courier collects on delivery, remitted to seller after success — [EasyParcel](https://blog.easyparcel.com/my/spx-cod/) (aggregator; no driver UI)

### Inferences
- A visible "expected amount" vs "collected" confirmation with a reason when different is a sensible pattern (Oern already has `codMode`, and confirms irreversible COD in a dialog per DESIGN.md), but I have no cited precedent for short/over payment UI.

### Gaps
- Short/over payment, change, end-of-shift cash handover, documented fraud patterns: nothing reliable found. Needs separate research (e.g. Pakistan/India COD courier cash-deposit flows, SPX/Ninja Van hub deposit).

## Failed delivery

### Takeaway
Reason lists with optional photo/note and (in Detrack) per-reason signature requirement are documented; DoorDash couples call/text, a wait timer, then safe-drop photo. SPX user reviews show the main harm: riders marking failed without contacting customer.

### Cited Findings
- Detrack: admin lists reasons requiring signature; driver picking one is prompted for signature before submitting — [Detrack help](https://help.detrack.com/en/articles/6553420-how-to-capture-a-signature-for-specific-failed-delivery-collection-reasons-in-the-driver-app) (official)
- HERE: Unable tab -> photo, reason from scrollable list, dispatcher comment — [HERE docs](https://developer.here.com/documentation/last-mile/user_guide/topics/driverapp-complete-delivery.html)
- DoorDash: call and text first, in-app timer gives customer minutes to collect, then guided safe drop with photo and description; skipping risks deactivation — [DoorDash help](https://help.doordash.com/en-us/dashers/article/how-to-complete-a-delivery-when-the-customer-is-unavailable)
- SPX.ph customers report failed attempts with no call/text, riders marking failed while customer was home — [Trustpilot SPX PH](https://ca.trustpilot.com/review/spx.ph) (anecdotal)

### Inferences
- Oern could require a call attempt (logged tap on call button) and a minimum elapsed wait before enabling "Customer unreachable", addressing the SPX complaint; Oern's reason + next-action flow already matches the HERE/DoorDash shape.

### Gaps
- Return-to-sender and reattempt flows of named apps not found.

## Safety and ergonomics for motorbike riders

### Takeaway
Fleet apps lock or simplify the UI above ~5 mph; I found no courier-specific documentation (Grab, Foodpanda) and no CHI/CSCW paper on delivery-rider UI.

### Cited Findings
- Samsara Driver App switches to simplified locked screen over 5 mph, navigation apps still usable — [Samsara KB](https://kb.samsara.com/hc/en-us/articles/41951191118477); Geotab Drive locks above 5 mph — [Geotab](https://support.geotab.com/help/geotab-drive/hos-and-eld/driving-lock-screen) (fleet trucks, not motorbikes)
- Rider-safety research: South Africa survey of 109 riders links gig pressure to fatigue/near-misses — [CSIR](https://researchspace.csir.co.za/bitstreams/3a2eecd7-e06a-4508-81f6-dd6f05d914e5/download); Vietnam 550-rider study: time pressure and job demands influence risk-taking — [Accesson JDS](https://accesson.kr/jds/v.18/5/49/36151) (secondary summaries via search; not read)
- CSCW 2019 rideshare driver safety paper (cars) — [NJIT](https://researchwith.njit.edu/en/publications/individual-and-collaborative-behaviors-of-rideshare-drivers-in-pr/)

### Inferences
- Because Oern is a web app without reliable background GPS, any "locked while moving" mode would depend on foreground geolocation speed; a moving-state UI of only turn card + ETA + one "Call" button is plausible but unvalidated.
- Accept timers and tight ETAs are plausibly part of the time-pressure mechanism in the cited studies (inference).

### Gaps
- Voice control, lock-screen notifications, battery/data-saving, and Yangon GPS accuracy: no sources found.

## Documented rider-app UX complaints

### Takeaway
Evidence gathered is anecdotal and passenger-skewed; only the SPX riders-mark-failed-without-contact complaint is relevant and sourced.

### Cited Findings
- SPX.ph reviews: failed attempts without contact; parcels stuck out for delivery for weeks — [Trustpilot](https://ca.trustpilot.com/review/spx.ph) (customer-side)
- Grab app store analysis mentions driver wait times and order-accuracy issues, not country-specific — [Kimola](https://kimola.com/reports/insightful-grab-app-feedback-analysis-report-now-available-google-play-en-144425) (aggregator, passenger-leaning)

### Gaps
- No driver-side app store review analysis or forum data (r/ojol, Myanmar groups) was retrieved.

## Recommendations for Oern (inferences, ranked)
1. Make "customer unreachable" evidence-backed: log call attempts and a wait timer before enabling it (DoorDash pattern; SPX complaint).
2. Add lightweight POD: required recipient name plus auto-stamped time/GPS; optional photo; PIN/OTP only if SMS reliability in Yangon is confirmed.
3. Queue completion and exception writes offline with retry; the current "needs a connection to record" for exceptions is a risk in dense/low-signal areas (no source on competitors; engineering judgement).
4. Show COD as expected vs collected with required reason on mismatch, and design an end-of-shift cash reconciliation view (no precedent found; research further).
5. Keep distance-conditional "arrived"; if adding slide-to-confirm, keep a button alternative per DESIGN.md.
6. Decide push-offer vs board model; if offers are added, no-penalty decline with escalation after repeated ignores.
