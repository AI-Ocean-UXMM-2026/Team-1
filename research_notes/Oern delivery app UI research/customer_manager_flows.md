# Customer and Manager (Dispatcher) UI Flows for Parcel Delivery, Compared with Oern

Scope note: about 15 tool calls. Many vendor pages (Grab, Uber, DoorDash, Shopee, FedEx, Amazon, Bringg, Circuit, Routific, Lalamove Business) were not reachable or returned no UI detail, so those are listed under Gaps. Baymard and NN/g detailed guidelines are paywalled; only public summaries were read. Confidence tags: [H] primary/official, [M] secondary or partial, [L] weak or inferred.

Oern baseline (read from repo, [H]): DESIGN.md Appendix, Layout and Components; PRODUCT.md. Key facts: customer bottom tabs Home/Orders/Pickup/Profile; Track = code lookup + map + bottom summary (status, ETA, freshness, call, help) with route/timeline/notes/COD behind expandable sections; 3-step pickup (Addresses, Parcel and contacts, Review) with a persisted draft; COD is always a separate amber chip; Help is attached to a selected parcel; notifications are one chronological list; tracking requires sign-in and own-order RLS; push/SMS is a planned capability; manager overview has KPI strip, live map, recent deliveries, and a right rail "Needs attention" and fleet summary; sidebar becomes bottom nav on phones; dispatch recommends riders by availability, workload, proximity, vehicle status, capacity.

## (a) Customer parcel tracking: information hierarchy, stale GPS, delay, failure, contact, share

### Takeaway
Research and vendor docs agree on a text-first hierarchy: expected delivery date/ETA and current status first, then a stage/progress bar, then detailed event history, with the map as a live-phase supplement. Oern's current Track layout (map plus bottom summary) matches the live-phase pattern; its gaps are share-link, sign-in-gated tracking, and delay/failure recovery copy.

### Cited Findings
- Baymard lists six key tracking elements: expected delivery date (most sought), status progress bar (stages shown even before shipment), carrier name, linked tracking number, detailed shipping history incl. sub-events/current location, and package contents summary. [H] — [Baymard: integrate tracking info](https://baymard.com/research-articles/integrate-tracking-info)
- Only 33% of tested sites provided all six; 25% failed to reliably show an expected delivery date; order tracking was the top self-service feature for 50% of respondents. [H] — same source
- Baymard recommends showing the expected date prominently (banner above the progress bar), a window that refreshes as delivery nears ("Out for Delivery"), delivered date/time directly under status, and a note when carrier tracking is not yet available. [H] — same source
- Baymard found "Delivery on or before" wording made a user think a delivered package was still in transit; wording must reflect current state. [H] — same source
- Baymard advises keeping tracking inside the site/account instead of redirecting to third-party carrier pages (disorientation, seen as glitch); if a redirect is needed, link back to the order and keep the header. [H] — same source
- Baymard's 2024 benchmark covers 20 sites against 27 guidelines; detail is paywalled. [M, summary only] — [Baymard 2024 benchmark](https://baymard.com/research-articles/2024-benchmark-order-tracking-and-returns)
- A UX Collective piece (via search snippet, page itself returned 403) credits NN/g for three essentials in a tracker: latest update, time remaining, and any problems in transit; it criticizes a 12-stage tracker as overloaded and lacking the final destination. NN/g primary source not found. [L-M] — [UX Collective](https://uxdesign.cc/the-perfect-delivery-tracker-is-about-saying-less-and-showing-more-68a12d9c4c82)
- Lalamove: after driver match the app shows ETA on the map, switching to the drop-off ETA after pickup; estimates described as approximate (traffic/weather); status stages from matching through completed; in-app chat with driver and driver phone number in Order Details; a share button sends tracking details (status, ETA) to a recipient; Help Center live chat only inside the app. [M, third-party blog] — [EasyParcel on Lalamove tracking](https://blog.easyparcel.com/my/lalamove-tracking/)
- Uber Eats: courier name and photo appear and location is trackable once en route. [L, third-party] — [Metrobi](https://metrobi.com/package-tracker/uber-eats-delivery-tracking)
- Costco Business Delivery shows an estimated arrival time only on delivery day and warns it may change. [M] — [Costco](https://www.costcobusinessdelivery.com/trackorder.html)
- parcelLab documents a "Scheduled" status showing estimated date, predicted timeframe, and a caption explaining the prediction. [M, vendor docs] — [parcelLab docs](https://docs.parcellab.com/docs/engage/order-status-page/components)
- GrabExpress offers live tracking (MY, SG, PH) with photo proof of delivery; tracking screen shows driver location and ETA (SG guide). [M] — [Grab Express MY](https://www.grab.com/my/express/), [Moneymax](https://www.moneymax.ph/personal-finance/blog/grab-express-delivery-guide)
- Royal Mail failed-delivery recovery: five redelivery options (home, alternative local address, Post Office, Shop/Parcel Locker, collect from delivery office), parcels held 18 calendar days, a card left and automatic redelivery next working day since May 2023. [H] — [Royal Mail redelivery](https://royalmail.com/redelivery)

### Inferences
- Order for Oern's tracking screen: (1) status word + ETA window with freshness, (2) compact stage bar (Picked up, On the way, Arriving, Delivered) rather than a long event list, (3) map, (4) detail history collapsed. Oern already places detail behind sections; consider making the ETA the largest element, not the map. [inference from Baymard + UX Collective]
- A delayed state should state the reason class and a revised window, and failure should present choices (retry tomorrow, change address, pick up, contact support) modeled on Royal Mail's option list. Oern has explanations plus a recovery action; verify there is more than one option. [inference]
- Tracking needs sign-in in Oern (PRODUCT.md). Recipients who are not account holders cannot follow a parcel; Lalamove-style share link is a documented competitor behavior. A scoped, expiring, read-only tracking link would need RLS design (token-based). [inference]
- Stale GPS handling (Oern: "last updated" plus stale state) is stricter than anything I could verify in competitors; keep it. [inference; competitor behavior unverified]

### Gaps
- Actual Grab, Foodpanda, Uber, DoorDash, Shopee, DHL, FedEx, InPost, Amazon tracking screen hierarchy and stale-GPS behavior not verified (no official pages retrieved). Mobbin/Page Flows collections are available via tools but were not queried.
- NN/g primary article on order status not located.

## (b) Pickup/booking request flow and address entry

### Takeaway
Booking apps converge on: addresses first, then service/vehicle or parcel type, then add-ons/notes, payment, a price shown before confirmation, and a final review. Oern's 3-step flow with a persisted draft is within norms; the open risks are price quote visibility, address entry for weak-address markets, and validation timing.

### Cited Findings
- Lalamove ordering order: pickup and drop-off, now or scheduled, vehicle type and add-ons, driver notes, payment method, review and place; price shown before placing, built from base fare by vehicle, distance, services; may change with traffic/demand/tolls/surcharges and if order details change. [M] — [Lalamove UAE guide](https://www.lalamove.com/en-ae/blog/how-to-place-order-lalamove-uae), [Lalamove KSA guide](https://www.lalamove.com/en-sa/blog/how-to-place-your-first-order-on-the-lalamove-app-easy-and-hands-on-tutorial)
- Pickup location cannot be changed after placement (Malaysia reseller claim). [L] — [EasyParcel](https://blog.easyparcel.com/my/send-faster-send-demand/)
- GrabExpress: enter pickup and drop-off, choose delivery type; motorcycle icon in app. [M] — [Grab Express MY](https://www.grab.com/my/express/)
- Baymard: fully automatic address lookup is the most effective/efficient way to reduce address-entry burden (55% of sites lack it, March 2023); 9% of manually entered addresses had typos; ZIP autodetection is a fallback (28% of mobile sites lack both). [H, summary] — [Baymard automatic address lookup](https://baymard.com/research-articles/automatic-address-lookup), [Baymard ZIP autodetection](https://baymard.com/research-articles/zip-code-auto-detection)
- Baymard inline validation: 31% of sites have none; validate on blur or when the value reaches expected length, not on first keystroke; clear errors on each keystroke once fixed; show positive validation (check marks). [H] — [Baymard inline validation](https://baymard.com/blog/inline-form-validation)
- Baymard says phone fields need an explanation of why they are required; 39% of sites lack one. [M, snippet] — same search snippet via [Baymard checkout form best practices](https://baymard.com/blog/checkout-form-best-practices)
- Baymard has a keynote titled "Checkout Optimization: From 16 Form Fields to 8 Fields"; recommendation details not retrieved. [L] — [Baymard checkout form fields](https://baymard.com/blog/checkout-form-fields)
- web.dev documents `autocomplete` attributes for address forms. [H] — [web.dev address form codelab](https://web.dev/articles/codelab-address-form-best-practices)

### Inferences
- Zip/postal autodetect does not apply to Yangon (weak postal use). Analogue: pick township from a short list first, then ward/street/landmark free text, then pin refinement. Unverified against a Yangon-specific study. [inference]
- Show an estimated price on step 1 or 2 as a range and a firm total on Review with a "may change if details change" line, matching Lalamove's quote pattern; Oern's DESIGN.md says it never promises unheld times, so apply the same honesty to price. [inference]
- Keep fields minimal on step 2: size category via pictorial choices instead of weight/dimensions; contacts prefilled from profile; saved addresses chips on step 1. [inference]
- Use blur-timed inline validation on phone numbers (Myanmar formats) and COD amount. [inference from Baymard]

### Gaps
- Exact step counts and field orders for Grab, Foodpanda, Uber, DoorDash, Shopee, DHL not verified. No sourced Yangon/Myanmar address-entry research found (township/ward conventions, landmark use). No source found on draft-persistence patterns in competitors.

## (c) COD from the customer perspective; notifications; help/issue reporting

### Takeaway
Competitor documentation retrieved handles COD as a payment-method choice and a note, not a rich confirm screen. Oern's separate COD chip plus review confirmation is stronger than documented norms; notifications and help coverage were thinly sourced.

### Cited Findings
- Lalamove: choose "Cash" payment before placing; for recipient-pays, add a remark telling the driver the amount will be collected at drop-off. [M] — [Lalamove FAQ PH](https://www.lalamove.com/en-ph/faq), [EasyParcel Lalamove COD](https://blog.easyparcel.com/my/?p=75869)
- GrabExpress PH: a COD field where the sender enters an estimated amount. Details cut off. [L] — [Grab Express PH](https://grab.com/ph/express)
- Track-POD marketing lists COD alongside partial delivery and rejection reasons in driver app. [M] — [rfp.wiki Track-POD](https://www.rfp.wiki/vendors/track-pod)
- Lalamove help: live chat available only in-app. [M] — [EasyParcel](https://blog.easyparcel.com/my/lalamove-tracking/)
- McDonald's advises identifying which delivery partner handles an order on the Track Order screen before getting help, i.e. help should route to the party that holds the order. [L-M] — [McDonald's FAQ](https://www.mcdonalds.com/us/en-us/faq/my-order-is-taking-longer-than-expected.html)
- Baymard: show a note when tracking info is unavailable (applies to missing-data notices). [H] — [Baymard](https://baymard.com/research-articles/integrate-tracking-info)

### Inferences
- COD review should itemize: amount the recipient pays (parcel value), delivery fee, and who pays the fee, with a single total the rider will collect; and a confirmation of the amount before sending. Not found in sources; derived from Oern's separate-signal rule. [inference]
- Because push/SMS is planned but not shipped (PRODUCT.md), the in-app list is the only notification channel; unread markers and a link from each item to the parcel are the minimum. SMS fallback matters in a market where users may not keep the app open. [inference]
- Help attached to the parcel mirrors the McDonald's/Lalamove pattern; offer issue categories (late, wrong address, rider unreachable, COD dispute, damaged). [inference]

### Gaps
- No official source found on notification cadence/content for Grab, Foodpanda, Uber, DoorDash, Shopee, Amazon, DHL. No customer-side COD confirmation UX source (Shopee COD, Lazada, Daraz) retrieved.

## (d) Manager/dispatcher workflow

### Takeaway
Dispatch tools show a map plus a task/driver sidebar with colour-coded status, unassigned work pinned at the top, delay flags derived from deadlines and ETAs, and per-driver COD reports with expected vs collected vs handed-over. Oern's overview and "Needs attention" rail align; assignment reasons and COD handover reconciliation are the areas to verify.

### Cited Findings
- Onfleet: unassigned tasks appear in the top section of the sidebar and as grey map pins; assigned purple, in-transit blue, succeeded green, failed red. [H] — [Onfleet task status](https://support.onfleet.com/hc/en-us/articles/20509786766228-Task-Status)
- Onfleet drivers: idle green, in-transit blue; off-duty drivers not tracked on map; offline shown with slashed-cloud icon. [H] — [Onfleet driver status](https://support.onfleet.com/hc/en-us/articles/10228905705876-Driver-Status)
- Onfleet delay rule: a task is delayed when unassigned/assigned and now is after Complete Before, or ETA would arrive after it; gold dot on task and driver, with estimated delay minutes. [H] — same Onfleet task-status page
- Onfleet Command Center (Scale/Enterprise) has quick stats incl. delayed and failed task counts and a sortable routes table. [H] — [Onfleet Command Center](https://support.onfleet.com/hc/en-us/articles/35183133144980-Command-Center)
- Onfleet auto-assign: select unassigned tasks in sidebar, right-click, auto-assign; criteria closest driver or shortest route; only active drivers (idle or in-transit) considered; per-driver task cap makes a driver ineligible; team restriction setting. [H via search summary; page fetch 403] — [Onfleet auto-assignment](https://support.onfleet.com/hc/en-us/articles/360023669852-Auto-Assignment)
- Onfleet webhook "Task Delayed" with a configurable threshold, usable for Slack alerts. [M] — [Onfleet task status/integrations listing](https://support.onfleet.com/hc/en-us/articles/20509786766228-Task-Status)
- Detrack: COD Search under Jobs filters by date and vehicle/driver; shows expected total per driver per day, amount driver collected, amount admin received from driver, and shortage/excess at both steps. [M, from search summary; tutorial page 404 on direct fetch] — [Detrack COD search](https://detrack.com/tutorials/how-to-use-the-cod-search/)
- Detrack: exception context can be tied to photos, notes, location evidence; paid plans retain data up to 5 years. [L-M, third-party] — [rfp.wiki Detrack](https://www.rfp.wiki/vendors/detrack)
- Track-POD: single dashboard, reject-reason catalog, partial delivery; exception automation lighter than enterprise TMS (third-party rating). [L-M] — [rfp.wiki Track-POD](https://www.rfp.wiki/vendors/track-pod)
- Shipox-style flow: filter "collected" tab by driver, mark cash as handed to cashier once received. [L, different vendor] — [Shipox](https://shipox.com/blog/the-benefits-of-cod-reconciliation-in-delivery-management/)

### Inferences
- Oern should state why a rider is recommended (e.g. "1.2 km away, 2 active stops, van has capacity") and why others are excluded (at cap, off duty), mirroring Onfleet's documented eligibility rules; it is unverified whether any tool shows ranked reasons in the UI. [inference]
- Use one delay definition shared across customer and manager screens (deadline or predicted ETA past promised window), as in Onfleet. [inference]
- COD reconciliation view: per rider per day, expected vs collected vs handed over with shortage/excess, matching Detrack's two-stage model. [inference]
- Phone vs desktop: no source found describing dispatcher mobile behavior; Oern's bottom-nav conversion is a design choice, and on phone the priority should be Needs attention, unassigned queue and assign action, not the full map. [inference]

### Gaps
- Routific, Circuit, Bringg, Tookan, Lalamove Business: no UI documentation retrieved. Dispatcher phone vs desktop behavior not sourced. No source found for how tools handle a task with no eligible driver.

## Flow antipatterns (documented vs inferred)

### Takeaway
Documented antipatterns centre on tracking: third-party redirects, missing delivery date, ambiguous status copy, missing-data silence, and overloaded event lists.

### Cited Findings
- Redirecting to carrier sites disorients users and reads as a glitch. [H] — [Baymard](https://baymard.com/research-articles/integrate-tracking-info)
- Vague or time-misleading status ("Delivery on or before", "Completed") causes wrong beliefs. [H/M] — Baymard above; [UX Planet](https://uxplanet.org/this-kind-of-ui-will-make-you-panic-c747b6b08d45) (member-only, snippet)
- Overloaded 12-stage trackers without the final destination. [L-M] — [UX Collective](https://uxdesign.cc/the-perfect-delivery-tracker-is-about-saying-less-and-showing-more-68a12d9c4c82)
- No inline validation / errors only after submit forces rework. [H] — [Baymard](https://baymard.com/blog/inline-form-validation)
- Manual address entry without lookup causes typos (9%). [H] — [Baymard](https://baymard.com/research-articles/automatic-address-lookup)

### Inferences
- Oern risks: sign-in-gated tracking (no research source here on forced sign-up, so this is unverified as an antipattern), map-first without text ETA on small screens, and promising a pickup time. DESIGN.md already guards against the last.

### Gaps
- No retrieved source specifically documents forced sign-up before tracking, hidden primary action, or map-only information as antipatterns.

## Priority recommendations vs Oern (summary)
1. Track: lead with ETA window + status word + freshness; stage bar; collapse history. [Baymard]
2. Add a share-tracking link (read-only, expiring) for recipients; needs RLS/token design. [Lalamove]
3. Failure/delay: offer concrete recovery options (retry, change address, pick up, contact). [Royal Mail]
4. Pickup: show price estimate before Review; blur-timed validation; township-first address entry with landmark field and saved-address chips. [Lalamove, Baymard]
5. COD: itemize amount, fee, who pays, total to collect, confirm on review.
6. Manager: show recommendation reasons and exclusions; shared delay definition; COD reconciliation expected vs collected vs handed over. [Onfleet, Detrack]
