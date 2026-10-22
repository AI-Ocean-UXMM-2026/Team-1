# Oern UI/UX research, audit and improvement plan

**Date:** 2026-10-21 · **Branch:** `claude/beautiful-clarke-epzs43` · **Status:** Plan approved; implementation in progress. See [Implementation status](#implementation-status) for what is done and what is still open.

This plan is based on four sources:

1. A file-by-file code trace of every route and component, with `file:line` evidence.
2. Live screenshots of every route at 360×640 and 390×844, captured with Playwright against `bun run dev`.
3. Mobbin MCP research, citing only screens that were returned and inspected.
4. `DESIGN.md` and `PRODUCT.md`, which this plan treats as the approved contract.

Each finding is labelled with its evidence type: **[code]**, **[screenshot]**, **[Mobbin]**, **[DESIGN.md]**, or **[hypothesis]**.

---

## Implementation status

Every fixed item has a regression test that fails without the fix (checked by reverting the fix). Commands: `bun run test` (unit), `bun run test:e2e` (Playwright at 360, 390, 430 and 768px), `bun run build`.

| Status | Findings |
|---|---|
| **Done** | C-01 dialog above app chrome · C-02 ETA freshness row readable · C-03 / O-01 manager fits phones with bottom nav · C-05 rider keeps last good route on refresh failure (stale banner) · C-06 outcome step 1 dead end · H-01 Track follows `?order=`/`?code=` · H-02 addresses wrap · H-03 Help sends a support case with the order · H-04 late ETA · H-05 failed/cancelled timeline · H-06 COD amount size · H-07 Orders search, dates, all cards · H-08 slide-to-confirm via screen reader/keyboard · H-09 report a problem before arrival · H-10 sharing-health chip · H-11 shift-tool errors · H-13 rider dark theme · H-14 (partial) self-hosted Burmese + Latin fonts, Burmese line height · O-02 COD reconciliation view · O-03 (partial) all riders + reassign confirmation · O-04 dispatch order · O-05 sign-in gates · O-08 support notes · M-01 customer 48px targets · M-02 no invented progress · M-03/M-04 rider targets and 12px text · M-15 (rider only) tokens · D-01 (partial) 62 duplicate CSS rules removed · D-07 (partial) manifest, icons, theme colour |
| **Changed from the plan** | **C-04 sample data was not restored.** Commit 5d5aa38 removed it on purpose, so README/PRODUCT.md were corrected instead and browser tests use a synthetic Supabase mock. |
| **Customer redesign (done)** | Four-tab shell (Home, Orders, Pickup, Profile) on a 480px canvas · Orders Active/History with URL state and terminal-event sort · Home leads with the next active parcel · Track map-first with expandable sections and distinct stale/late/failed states · Help order picker · one chronological notifications timeline (M-06 for the customer side; read state is still per device) · Profile with initials, grouped rows and a confirmed sign-out · three-step pickup with a persisted draft, inline validation and a stored pickup window · sign-in and sign-up return to the original task · in-app Back (M-13) · reduced-motion and 200% text checks · axe on every customer screen. Customer baselines regenerated. |
| **Open** | C-05 reload while offline still shows an empty route (needs a device cache with a sign-out wipe) · H-12 proof-of-delivery photo (needs a Storage bucket + migration) · H-14 full Burmese translation (no i18n layer yet) · O-03 create-order form and override reason · O-06 query windowing/debounce · O-07 map marker diffing, keyboard markers, compact-map scroll trap · O-09…O-13 smaller ops items · M-05 map controls vs sheet · M-08 rider sheets onto `ModalPanel` · M-09 map `role="img"` · M-10 COD input validation copy · M-11 atomic outcome RPC · M-12 customer offline banner · M-14 single status badge · M-16/M-17 · stop list taps and On-shift toggle · D-02 hex literals outside the rider (about 380) · D-03 type tokens · D-04 dark theme for customer/ops · D-05 · D-06 breakpoints · service worker / offline shell |

---

## 0. Method and research limitations

| Item | What was done | Limitation |
|---|---|---|
| Code inventory | Read every `src/app/**/page.tsx`, every `src/components/delivery/*`, the relevant `src/lib/delivery/*`, the CSS layers and the migrations | None |
| Live UI | Ran 16 routes × 2 viewports through Playwright and recorded `scrollWidth` to detect horizontal overflow | There was no Supabase project. **Every screenshot shows the signed-out state**, so I could not capture data, loading or error states and assessed those from code. The labelled demo data that README and PRODUCT.md describe is dead code (see C-04), so a signed-out preview shows no sample data. |
| Mobbin | 20 targeted screen and flow searches (iOS and web) | I could not retrieve the four flow links supplied in the brief by ID (Grab Driver d28b1cfa, Dasher ec82d267, Grubhub acebf565, Klarna 55b055d1). The MCP only searches, and a Klarna search returned 0 results. Driver-app coverage on Mobbin is thin: only **Grab Driver – Route Details** and **DoorDash Dasher – Current dash** came back. I cite those links but describe only what I could see. |
| Usability testing | None with real users | Every recommendation is a design hypothesis until it is validated on real devices with riders in Yangon (DESIGN.md §15). |

---

## 1. Interface inventory

**Status key:** ✅ implemented · 🟡 partial · ⚪ stub or redirect · ⛔ planned only (in DESIGN.md or README, not in code)

### 1.1 Roles and access

| Role (`profiles.role`) | Home route | Gate |
|---|---|---|
| customer (default on signup) | `/home` (via `/` → `/welcome`) | No route guard. Signed-out users see empty states, and RLS limits data to the customer's own orders. |
| driver | `/rider` → `/rider/route` | `src/proxy.ts` plus `access.ts` `workspaceRedirect`. Signed-out users see a sign-in gate. |
| manager | `/manager` → `/manager/home` | Same mechanism. Signed-out users see a sign-in card. |
| seller | `/seller` | Same mechanism. Signed-out users see **enabled-looking forms** with disabled submit buttons. |
| support | `/support` | Same mechanism. |
| admin | — | ⛔ No admin role exists. Team roles are provisioned "through a trusted administrative process" (README). Role-access tests therefore cover the 5 real roles. |

`/` always calls `redirect("/welcome")` (`src/app/page.tsx:4`), so signed-in customers also land on the marketing Welcome screen. **[code]**

### 1.2 Customer

| Screen / surface | Route / component | Purpose | States present | Status |
|---|---|---|---|---|
| Welcome | `/welcome` · `welcome-screen.tsx` | Brand intro, Get started, Sign in | Static | ✅ (no h1) |
| Home | `/home` · `customer-home.tsx:916-1047` | Next-parcel hero, track field, 3 quick actions, Arriving today | Signed-out prompt, empty, skeleton, list | ✅ |
| Track | `/track` · `customer-app.tsx:386-651` | Map, ETA, route card, timeline, rider card, COD | Lookup miss, empty, stale GPS | 🟡 (defects C-02, H-01, H-04, H-05) |
| Orders | `/orders` · `customer-app.tsx:653-712` | Filter chips and order cards | Empty group | 🟡 (no search, no dates, only 3 cards before "See all") |
| Multi-provider block | `customer-provider-tracking.tsx` | Add external tracking; contact support | Empty | 🟡 (no loading or error UI) |
| Profile | `/profile` · `customer-app.tsx:714-767` | Name, Sign in/out, links | Guest | ⚪ (no addresses, preferences or edit; DESIGN §4) |
| Notifications sheet | `customer-home.tsx:1169-1347` | Derived status feed | Empty, unread toggle | 🟡 (one item per order, built on the client; read state in localStorage) |
| Help sheet | `customer-home.tsx:1364-1468` | FAQs, call rider | — | 🟡 ("In-app issue reports aren't available yet", even though the support-case API exists) |
| Scan sheet | `customer-home.tsx:1496-1655` | Scan QR code or barcode | Camera off, blocked, unsupported | ✅ (no retry) |
| COD sheet | `customer-home.tsx:1659-1740` | COD total and per-order breakdown | Empty | ✅ |
| Auth dialog | `auth-dialog.tsx` · `modal-panel.tsx` | Email and password sign-in and sign-up | Busy, error, confirm email | ✅ (no reset or show-password; z-index bug C-01) |
| Order detail page | — | — | — | ⛔ (DESIGN §9) |
| Saved addresses | — | — | — | ⛔ |
| Ratings / proof view | — | — | — | ⛔ |

### 1.3 Driver / rider

All rider URLs other than `/rider/route` are redirect stubs (`src/app/rider/{deliveries,cod,profile}/page.tsx`). The rider app is a single state machine: `Screen = overview | start | navigate | outcome | result | complete` (`rider-app.tsx:56-62`).

| Screen | Evidence | States | Status |
|---|---|---|---|
| Sign-in gate | `rider-app.tsx:718-737` | Unauthenticated | ✅ [screenshot] |
| Overview / today's stops | `:1898-2053` | Offline banner, error and retry, "No deliveries assigned", phases | 🟡 (rows can't be tapped; no reorder or skip) |
| Start sheet | `:2055-2142` | GPS waiting/live/denied, online, energy readiness | ✅ (accepts **all** orders at once; no per-task decline) |
| Full-screen navigation | `:1521-1887`, `rider-flow.css:761-937` | No pin, GPS denied, at target, road step, stale | ✅ (full-screen, no persistent bottom nav, which meets the brief) |
| Pickup confirm | `:1837-1848` | Busy | ✅ (one tap starts customer location sharing; no failure path) |
| Outcome (3 steps) | `:1131-1518` | COD due/collected/mismatch, failure reasons, slide-to-confirm | 🟡 (dead end C-06; slide-only H-08) |
| Result and next stop | `:917-1017` | Success, failed, "details not saved" | ✅ |
| Route complete | `:1020-1128` | Totals, outstanding COD | 🟡 ("Finish route" only returns to the overview) |
| Shift tools sheet ("Help") | `:775-914` | Energy level, road report, sign out | 🟡 (no help content; errors are hidden behind the scrim) |
| Proof of delivery | — | — | ⛔ (typed "Received by" name only) |
| Deliveries history / Earnings and COD / Vehicle and profile | — | — | ⛔ (DESIGN §3 and §4 ask for 4 tabs) |

### 1.4 Operations (manager, seller, support)

| Screen | Route | Status |
|---|---|---|
| Manager overview | `/manager/home` · `manager-app.tsx` | ✅ (desktop shell **only**; see C-03) |
| Manager track | `/manager/track` | ✅ (desktop only) |
| Manager orders and assignment | `/manager/order` | ✅ (desktop only) |
| Manager team | `/manager/profile` (labelled "Team") | ✅ (route name and label don't match) |
| Fleet insights | `/manager/insights` · `fleet-insights-app.tsx` | ✅ (single long stacked page) |
| Seller | `/seller` · `seller-app.tsx` | 🟡 (four stacked forms on one page under a 4-tab nav; forms look active when signed out) |
| Support | `/support` · `support-app.tsx` | ✅ |
| Exceptions queue, COD reconciliation, Drivers list | — | ⛔ (DESIGN §9) |

There are no drawers or sheets in the ops screens. The only modal is `AuthDialog`. Roles in the DB check constraint: `customer, manager, driver, seller, support` (migration `20261020064047…sql:4-6`). There is **no admin role**, and no UI to provision roles.

---

## 2. Mobbin research: patterns to adopt, adapt or reject

Each entry links to the canonical Mobbin URL of a screen that was returned and inspected.

### 2.1 Customer: active-delivery tracking

| Reference | What the screen does | Verdict for Oern |
|---|---|---|
| [DoorDash – Dasher heading to customer](https://mobbin.com/screens/b2543cf1-7f95-4718-92d6-74af14de04d5) | Map takes the top ~55%. A bottom sheet holds a large status headline ("Heading to Alex Smith"), an ETA line, a 4-icon segmented progress bar, a one-sentence explanation, then a courier row with Call and Message. Close and Help float on the map. | **Adopt** the structure: headline, ETA, icon progress, explanation, contact. Our Track page scatters this across an ETA panel, a route card, a timeline and a rider card. **Reject** the cross-sell blocks below. |
| [DoorDash – Dasher waiting for order](https://mobbin.com/screens/2c2b008d-75ff-443e-b155-ddd33ed2151f) and [Order complete](https://mobbin.com/screens/77190cd4-e576-422b-bf21-d7aa3d59c826) | The same sheet keeps its layout through every state: only the headline, ETA wording and progress fill change. The completed state turns the ETA into "Arrived at 2:40 AM". | **Adopt:** one sheet for every lifecycle state, with past-tense wording when complete. This fixes H-04, where an overdue ETA reads "Arriving now". |
| [Grab – Arriving by, on time](https://mobbin.com/screens/e488eb81-4d0f-44a1-acc7-0c08c82af941) | "Arriving by 8:21 PM" plus an **"On time"** label in green, with a branded progress track. | **Adopt** an explicit punctuality label: On time, Running late, ETA updating. This replaces our invented 18/32/56/72% progress bar (M-02). |
| [Grab – Drop-off sheet](https://mobbin.com/screens/214b2b5a-db3d-4ce6-a771-b3299a1767ce) | The sheet shows "Arriving by 11:49 AM · 2.73 km to go · 10 mins" and a full destination row. | **Adopt** distance-to-go next to the ETA. Show the **full** address and never truncate it (H-02). |
| [DoorDash – live-activity banner](https://mobbin.com/screens/8210b47b-9372-4add-9e71-b87192a8c239) | A lock-screen summary: status, arrival window and progress. | **Adapt** for a PWA as the notification payload content once Web Push exists. Out of scope for now. |

### 2.2 Customer: timeline, history, notifications, COD, addresses

| Reference | Observation | Verdict |
|---|---|---|
| [Shopee – To Receive timeline](https://mobbin.com/screens/16424e24-00a4-46ca-a5b7-c4653be987ca) | Estimated delivery date at the top; a vertical timeline with timestamps and the newest event highlighted; a **"Track Driver Location"** button pinned at the bottom. Shopee serves the same SEA market. | **Adopt** a timestamped vertical event history from `status_events`, newest first, with a pinned primary action. |
| [Bolt Food – courier timeline](https://mobbin.com/screens/9509b853-f44c-425e-81c0-c6e96efffe2c) | Large "Arriving" headline, then checked steps with times. | **Adopt** past steps with a check icon plus time. |
| [Shop – Delivery progress sheet](https://mobbin.com/screens/16ce2d9c-a707-494b-b47d-39e484ecbd42) | The full history opens in a bottom sheet over the summary. | **Adopt** a summary on Track with "See full history" in a sheet (progressive disclosure, DESIGN principle 8). |
| [Walmart – Arrives today by 10pm](https://mobbin.com/screens/da5c3b1c-2ff5-424f-ab22-dd8009a58e7f) | Order card with a 4-step labelled stepper, then "Need to make a change?", address and payment. | **Adopt** for the missing **Order detail** screen. |
| [talabat – Past orders](https://mobbin.com/screens/6e603b20-b68a-4906-8bbe-715b7adfaf87), [foodpanda – Get help with orders](https://mobbin.com/screens/46f514ca-9c26-4135-b350-9a2f920895e4) | Upcoming/Past tabs; cards with title, **date and time**, and a status pill. foodpanda starts help from an order list. | **Adopt** Active/Past segmentation with dates on every card (H-07). Start Help by picking an order, so support cases carry order context (H-03). |
| [Woolworths – Notifications](https://mobbin.com/screens/937e843d-b326-4d1d-bfbf-db18338418a4) | Grouped "New" and "This week", an unread dot, the event title, one line of detail, "View order details", and a relative time. | **Adopt** this inbox layout. Our sheet derives a single item per order, so it is not a history (M-06). |
| [Swiggy – Pay on delivery](https://mobbin.com/screens/f86a10a9-f735-4f36-b512-a94783288e79) | A COD row with a cash icon, the label "Cash/Pay on Delivery", an explanation, and the amount in the button. | **Adopt** an explicit "COD" label plus icon plus amount at KPI size. Today Track shows the amount at 11px (H-06). |
| [Grab – Saved places](https://mobbin.com/screens/be0307fb-b217-4aaa-9b58-5eec6c6145b1), [Blinkit – My addresses](https://mobbin.com/screens/62f7f7e1-0ee4-44d4-b23b-a30a93230148) | A labelled address list with "Add new address" first. | **Adapt** for Profile → Addresses **only if** the backend stores customer addresses. Today addresses live on orders, so this is ⛔ and needs a schema decision. |
| [InPost – empty parcel list](https://mobbin.com/screens/ac891ba3-ce04-4a68-8935-52c7b0d8df17) | Empty state with an illustration, one sentence and a single floating "+ Track a parcel" CTA. Receiving/Sending tabs. | **Adopt** one primary CTA per empty state. Our signed-out Track and Orders empty states have no sign-in CTA (M-07). |

### 2.3 Driver

| Reference | Observation | Verdict |
|---|---|---|
| [DoorDash Dasher – Current dash](https://mobbin.com/screens/5859ffb5-02a0-45ee-9065-2ea87eaf43fa) | A map with the route on top, then a **task list of legs**: "Pick up for … by 3:31 PM" tagged **Current task**, and "Deliver to … by 3:53 PM". Each row is tappable with a chevron. A "Pause orders after delivery" toggle sits below. | **Adopt:** tappable stop rows with a deadline and a "Current" tag on our overview (rows aren't interactive today). **Adapt** the pause toggle as a real **On shift** toggle wired to `setDriverAvailability` (the pill is static text today). |
| [Grab Driver – Route details](https://mobbin.com/screens/ca866942-38fe-469f-94d9-f0541d458c02) | "2/2 stops to go" with a segmented progress bar; numbered, colour-coded legs ("1. Pick Up" green, "2. Drop Off" red) with the full multi-line address; **Free call · Chat · Cancel** as a 3-up action row under the active leg. | **Adopt** numbered legs, a stops-to-go counter, untruncated addresses, and a contact row. **Adapt** "Cancel" as **"Report a problem"** available on both pickup and drop-off legs (H-09). |
| [Postmates – delivery photo capture](https://mobbin.com/screens/f8699ca8-c93f-41a4-be64-2fbab733c758), [Careem – proof shown to customer](https://mobbin.com/screens/5136806d-065d-41b1-9c30-87c53725afda) | A full-screen camera with one instruction line ("Take a photo for delivery address") and a large shutter. The customer later sees the photo with "dropped off at home". | **Adopt** proof-of-delivery photo capture with `<input type=file accept=image/* capture=environment>`, which works in a PWA, and show it on the customer's completed order. Needs a Storage bucket and a migration (decision Q2). |
| [Bump – report reason sheet](https://mobbin.com/screens/e19d9a2b-a391-404c-8c71-86a20d3ad7c9), [Vivino – reason sheet](https://mobbin.com/screens/e275369a-ae11-49bd-a774-c6bdcbbebfe4) | A bottom sheet with one sentence of context, then full-width tappable reason rows with chevrons. One tap advances. | **Adopt** for failure reasons. It also fixes C-06: tapping a row always advances, unlike a radio's `onChange`. |
| Grab rider screens above | Contact actions are round 48px icon buttons. | **Adopt** a 48px minimum for every rider control (M-03 lists 28–32px targets). |

**Rejected for drivers:** the ads, promos and cross-sell cards that fill Grab and DoorDash customer sheets, and swipe-only confirmation. Our slide-to-confirm keeps its gesture but must also get a button alternative (H-08, DESIGN §11).

### 2.4 Operations

| Reference | Observation | Verdict |
|---|---|---|
| [Shopify – Orders with filters](https://mobbin.com/screens/4df3cf78-bc17-4632-8ad8-fb9d69bd90b2), [filter chips](https://mobbin.com/screens/9a5dbafc-fc4a-4bfb-9ae4-98b1a61ed95d), [sort and columns](https://mobbin.com/screens/909c6cdb-f0a1-4183-ab1c-b64f3f2c9aa2) | A KPI strip above a dense table; composable filter chips such as "Payment status is Paid"; tinted status pills with a dot (colour plus label); sort menu. | **Adopt** removable filter chips and paired dot-and-label pills for the desktop orders list. **Adapt** for phones as a card list: DESIGN.md §2 says the operator app must not be "a desktop dashboard compressed into a narrow viewport". |
| [Shopify – Live view](https://mobbin.com/screens/dfca7e4b-461b-49bc-9377-92575543a585), [Felt – fleet map](https://mobbin.com/screens/58a17ddb-ae85-48cf-96d8-aa8c632517d7) | A metric column beside a large map; tapping a vehicle opens an inline popover with ID, zone and a status pill. | **Adopt** on the desktop track view: tap a rider pin to get a popover with status, last update age and the current order. |
| [Uber Eats web – Almost here](https://mobbin.com/screens/fbbc20da-52f8-4211-b0ea-a0bedf3fd0f6) | On desktop, the status card floats over a full-bleed map. | Useful for a future desktop customer view. Not a priority. |

### 2.5 Cross-cutting

| Reference | Observation | Verdict |
|---|---|---|
| [GoPay – OTP via SMS](https://mobbin.com/screens/8990362a-86e1-4f52-917e-262e7d48094a), [Wonder – Enter your code](https://mobbin.com/screens/93fc8ebd-cb9a-4cae-b6de-2577c3b3f1b9) | Phone-first sign-in with a numeric keypad, a resend timer and an alternative method. | **Hypothesis:** phone OTP suits Myanmar customers better than email and password. Supabase supports phone auth but needs an SMS provider (decision Q4). Not a UI-only change. |
| [GoPay – offline card](https://mobbin.com/screens/95483b32-a4d7-4025-b6e7-64220245eff5), [Qantas – offline with toast](https://mobbin.com/screens/18f77caf-19d5-4199-98b4-a36f34096d23) | Explains the state and offers **Retry** while keeping navigation. Qantas also shows a toast when a refresh fails. | **Adopt** a non-blocking offline banner plus Retry for customers (M-12), and **keep cached data visible** for riders (C-05). |

---

## 3. Prioritized audit findings

IDs are stable so they can be used in commit messages and tests. Unless noted otherwise, **Validation** means a Playwright test or check described in §6.

### 3.1 Critical

| ID | Screen | Evidence | User impact | Correction | Validation |
|---|---|---|---|---|---|
| C-01 | Customer auth dialog | `.dialog-backdrop{z-index:50}` (globals.css:2704) sits under the MUI AppBar and BottomNavigation (`zIndex.appBar` = 1100, customer-app.tsx:119). It is not portalled. **[code]** | The bottom of the sign-up sheet, including the submit button, sits under the nav. The nav stays clickable behind an `aria-modal` dialog. | Portal `ModalPanel` to `document.body` with z-index above `theme.zIndex.modal` (1300). | Open `/home?signin=1` at 360×640 and switch to sign-up. Assert the submit button's `elementFromPoint` is the button itself, and that clicking the nav is blocked. |
| C-02 | Track: ETA freshness row | `.tracking-freshness-row` is still styled for the old dark panel: 8px `#aec5b8`, `strong` 9px `#fff` (globals.css:1121-1134). The panel is now white. **[code]** | The "Updated N min ago" stale-GPS cue (DESIGN §9.4) and the next-action text can't be read: white on white, about 1.9:1 contrast. | Restyle with tokens: 12px or larger, `--color-text-secondary-subtle`, and a `--color-surface-subtle` meter track. | axe colour-contrast rule on `/track` with a fixture order, plus a visual snapshot. |
| C-03 | Manager (all tabs) on phones | At 360px, `scrollWidth` is 1024–1216px on `/manager/home`, `/order`, `/track` and `/profile`. The screenshot shows a desktop sidebar shell scaled down. **[screenshot]** DESIGN §2 and §7 call for a phone-first operator app. **[DESIGN.md]** | A manager on a phone gets horizontal scrolling and tiny text, and can't dispatch on the move. | Decide the operator target (Q1). If phone-first: add a ≤768px layout with bottom nav (Overview · Orders · Drivers · More), card lists instead of tables, and the assignment as a bottom sheet. Keep the desktop shell at ≥1024px. | Assert `scrollWidth === clientWidth` at 360, 390 and 430 for every `/manager/*` route. |
| C-04 | Signed-out preview for every role | `useWorkspace` never sets `isDemo: true`, and `demo-data.ts` is imported nowhere (`use-workspace.ts:46-80`). **[code]** README and PRODUCT.md promise "clearly labeled sample deliveries". | First-time visitors and reviewers see empty screens. The product's core value (live tracking) can't be shown, and QA can't exercise data states without a Supabase project. | Either restore the labelled demo workspace for signed-out sessions (never written to Supabase), or update README and PRODUCT.md. Recommendation: restore it, because it also unlocks deterministic visual tests. | E2E: signed out, `/track` shows a "Sample delivery" chip and a map, and a network assertion shows no POST/PATCH to Supabase. |
| C-05 | Rider navigation and outcome | `run()` always calls `workspace.refresh(true)` (rider-app.tsx:528). When the load fails, `setData(emptyWorkspace())` runs (use-workspace.ts:75-85). **[code]** | One failed write on a weak connection replaces the active stop with "No deliveries assigned". The rider loses the address, COD amount and recipient mid-delivery. | Keep the last good data on refresh failure and set `isStale`. Cache the route per driver in localStorage and show a "Showing saved route" banner. Skip the refresh while offline. | Playwright with `context.setOffline(true)` and route-abort on `/rest/v1/*`: tap "Parcel collected" and assert the stop card stays visible with a stale banner. |
| C-06 | Rider outcome, step 1 | Step 1 advances only through the radio's `onChange` (rider-app.tsx:1190-1214). Going back or reloading restores the same checked value, so tapping it fires nothing. **[code]** | The rider can get stuck on the most important screen of the shift. | Use tappable reason rows that always advance (Bump/Vivino pattern), or add a Continue button when a choice exists. | E2E: pick Delivered, go back, tap Delivered again, and expect step 2. Repeat after a reload. |

### 3.2 High

| ID | Screen | Evidence | Impact | Correction |
|---|---|---|---|---|
| H-01 | Track | Scanning, or tapping a notification or COD item while already on `/track`, pushes `/track?code=…` but `urlHandled.current` blocks re-processing (customer-app.tsx:226-235). **[code]** | The tap closes the sheet and nothing changes. | React to `useSearchParams()` changes, or select directly when already on Track. |
| H-02 | Track and Orders addresses | `white-space:nowrap; text-overflow:ellipsis` on `.route-address-row strong`, `.delivery-order-card > strong` and `.map-underbar span` (globals.css:1042, 1184, 1419). **[code]** | Long Myanmar addresses lose the township or landmark, and the only copy is cut off (DESIGN §6). | Wrap text (`white-space:normal`), as already done for `.task-route-point`. |
| H-03 | Help sheet vs support | Help says "In-app issue reports aren't available yet" (customer-home.tsx:1463), yet the Orders page has a working support form without order context (customer-provider-tracking.tsx:58-73). **[code]** | Customers are told they can't report a problem the system can accept. Support cases arrive without an order. | Help → pick order (foodpanda pattern) → issue category → `createSupportCase` with `order_id`. Remove the form from Orders. |
| H-04 | Track and Orders ETA | `timeUntil` clamps with `Math.max(0, …)` and returns "Arriving now" for late parcels (format.ts:27-33). Home says "Running late". **[code]** | A late parcel is shown as arriving, contradicting Home. | One shared `etaState()` helper that returns on-time, late, unknown or arrived. |
| H-05 | Track timeline for failed or cancelled orders | `STATUS_STEPS` has no terminal exception step, so `activeIndex = -1` and every step reads "Up next" (types.ts:173; customer-app.tsx:552-588). **[code]** | A failed delivery looks as if it will still happen. | Add a terminal exception step with the reason from `status_events` and a next action (Get help or Reschedule). |
| H-06 | Track COD | `.cod-card strong{font-size:11px}` (globals.css:1345). Labels differ between Home ("Due on arrival") and Track ("COD due"). **[code]** | The amount the customer must prepare is the smallest text on the screen. | Shared `CodPanel` with a KPI-size amount, a coin icon and a "COD" label (Swiggy pattern). |
| H-07 | Orders | No search, only 3 cards until "See all", no dates, and the estimated time is shown even for delivered orders (customer-app.tsx:684-703). **[code]** | History is not usable for finding an older parcel. | Active and Past tabs, date and time on every card, search by tracking ID, and a link to the new Order detail screen. |
| H-08 | Rider slide-to-confirm | No `onClick`; only a drag of 82% or more, or a keyboard key, confirms (rider-app.tsx:2252-2290). **[code]** | TalkBack and VoiceOver users can't complete a delivery, and gloved riders struggle. This breaks DESIGN §11. | Keep the slide and add a "Confirm" button that opens a confirm dialog. |
| H-09 | Rider pickup and pre-arrival | The only way to report a problem is after "I've arrived" at the drop-off (rider-app.tsx:1837-1859). **[code]** | The rider can't report a closed merchant or a missing parcel, and has to fake arrival to report a failure. | Add "Report a problem" on every leg, opening the reason sheet. |
| H-10 | Rider location sharing health | `onError: () => setSharing(null)` (rider-app.tsx:357). The "Sharing" chip never checks age. **[code]** | Customer live tracking, the core of the product, fails silently. | Show a warning chip "Customers can't see your location" when an error is recorded or the last share is more than 60s old. |
| H-11 | Rider shift tools sheet | Errors render behind the scrim and `menuNote` is never cleared (rider-app.tsx:775-914). **[code]** | Road reports or energy updates fail invisibly. | Show errors inside the sheet, clear the note on open, and validate energy as 0–100 inline. |
| H-12 | Rider proof of delivery | No photo, signature or OTP anywhere. Only a typed name (rider-app.tsx:1229-1255). **[code]** DESIGN §9 requires it. | COD and delivery disputes can't be resolved. | Photo capture step (Postmates pattern), with camera-denied and retry states. Needs Storage and a migration (Q2). |
| H-13 | Rider dark theme | Dark tokens are scoped to `.rider-app`, but the live component uses `.rf-app` (globals.css:5360; rider-flow.css:3). The Mapbox map does switch to dark. **[code]** | At night the rider sees a dark map under bright white panels. | Scope dark tokens to `:root` under `prefers-color-scheme: dark` and remove the M-15 hard-coded colours. |
| H-14 | Myanmar localization | `<html lang="en">` hard-coded (layout.tsx:21). No Burmese strings, no i18n layer, and Noto Sans Myanmar is named in the font stack but never loaded. `en-US` formatters (format.ts). **[code]** | The primary market can't use the product in its language. Burmese glyphs depend on the device. | Self-host Noto Sans Myanmar with `next/font/local`; add a small typed dictionary (`en`, `my`) for the customer and rider apps first; set `lang` per locale; use `my-MM` number formatting with MMK. Scope decision Q3. |

### 3.3 Medium

| ID | Area | Evidence | Correction |
|---|---|---|---|
| M-01 | Customer touch targets | 36–40px targets: top-bar Sign in, Track submit, See all, switcher and recent-code chips, COD chip, filters. "Try again" is 10px text (customer-home.tsx:220, 786, 885, 968, 1021; globals.css:706). | `min-height: 48px` through a shared token. |
| M-02 | Home and Track progress bar | Falls back to invented 18/32/56/72% values (customer-home.ts:68-75), duplicated inline (customer-app.tsx:500-516). | Show the bar only when `route_progress_percent` is set; otherwise show a punctuality label (Grab pattern). |
| M-03 | Rider touch targets | `.rf-link` 32px, sheet handle 28px, summary 32px (rider-flow.css:147, 430, 1407). | 48px minimum. |
| M-04 | Text under 12px | Rider quick-action and step labels 11px (rider-flow.css:1013, 1714); customer `.loading-screen` and `.empty-state p` 11px; map labels 8px (globals.css:915, 1487, 2923). | Caption token of 12px minimum. |
| M-05 | Rider map controls | The zoom stack (top +196px, 176px tall) overlaps the open sheet on a 360×640 viewport (rider-flow.css:1588-1623, 925-937). | Anchor controls to a `--sheet-h` CSS variable. |
| M-06 | Customer notifications | One derived item per order, read state per device, and opening from Profile never marks items read (customer-home.ts:216-319; customer-app.tsx:254, 740). | Build from `notifications` and `status_events` rows; group by New / Earlier (Woolworths pattern). |
| M-07 | Empty-state dead ends | Signed-out Track and Orders have no sign-in CTA. `lookupMiss` is never cleared. The "Today's deliveries" quick action anchors to a section that may not render. **[screenshot + code]** | One primary CTA per empty state (InPost pattern). |
| M-08 | Focus and modals | The rider start and menu sheets don't use `ModalPanel`, so there is no focus trap and no Escape on start (rider-app.tsx:776, 2056). | Reuse `ModalPanel` once it is portalled (C-01). |
| M-09 | Map buttons inside `role="img"` | rider-nav-map.tsx:204; mapbox-rider-nav-map.tsx:203. | Put the role on the canvas only. |
| M-10 | COD entry validation | Continue is silently disabled; the placeholder shows the recipient's name; `type=number` accepts decimals and `e`; the amount is prefilled with the expected value (rider-app.tsx:1234-1308). | Inline helper and error text, integer MMK input (`inputmode=numeric`), and an empty field labelled "Count the cash, then enter the amount". |
| M-11 | Outcome writes not atomic | 4 separate client calls (rider-app.tsx:598-627), so detail failures can't be retried. | A single RPC in a new migration, or a queued retry from the stored draft. |
| M-12 | Customer offline state | Only the rider listens for `offline`. | Shared `useOnline()` hook and a non-blocking banner. |
| M-13 | Native back | Rider and customer sheets are React state, so Android back leaves the app mid-flow (rider-app.tsx:188). | Push a history entry when a sheet or step opens and close it on `popstate`. |
| M-14 | Two status badge systems | MUI `StatusChip` (amber for assigned, no icon) vs CSS `StatusBadge` (blue, with icon) (customer-home.tsx:103; common.tsx:35). | One `StatusBadge` (see §4). |
| M-15 | Hard-coded colours | Dozens of hex literals in rider-flow.css; the MUI palette duplicates the tokens as literals (mui-provider.tsx:10-52). | Read the MUI palette from the CSS tokens, then grep-gate hex values in a test. |
| M-16 | Welcome at 360×640 | The tagline ends 4px above "Get started"; the team link text is 12px with inline links. **[screenshot]** | Reduce the mascot height on short viewports with `@media (max-height:680px)`, and make the team link a 48px row. |
| M-17 | Seller signed-out | 4 full forms render enabled-looking under a sign-in header. **[screenshot]** | Show a sign-in card like the manager workspace; split the forms across the existing 4 tabs. |

### 3.4 Operations and design-system findings

#### Operations

| ID | Severity | Screen | Evidence | Correction |
|---|---|---|---|---|
| O-01 | Critical | Manager on phones (root cause of C-03) | `.manager-app{min-width:1024px}` and `.manager-sidebar{display:flex}` (globals.css:5462-5487) load after the 600px media query that hides the sidebar (globals.css:3456), so the later rule wins. There is no `MobileNav` in manager-app.tsx. | Move the desktop block into `@media (min-width:1024px)` and add a mobile nav. |
| O-02 | Critical | Overview → "COD to settle" | Links to `/manager/insights` (manager-app.tsx:610-614), which has no COD content. DESIGN §9 requires COD reconciliation. | Build a COD reconciliation view (expected, collected, handed over, discrepancy) and point the link at it. |
| O-03 | High | Orders and assignment | Only the top 3 recommendations can be assigned (intelligence.ts:155). No manual override or override reason (DESIGN §10). **No order-creation UI in the manager app**, although PRODUCT.md:39 claims it (`createDelivery` is only called from seller-app.tsx:147). | Add an "All riders" picker with a reason field, and a create-order sheet. |
| O-04 | High | Orders default selection | `prioritiseOrders` ranks in-transit first and pending last (format.ts:70-81), so the default selection is usually an order that can't be assigned. | Order by needs rider, then at risk, oldest first. Default to the "Needs rider" filter when that group is non-empty. |
| O-05 | High | Signed-out ops routes | The proxy skips redirects for anonymous users (proxy.ts:8). Only `/manager/home` gates; Team shows "Manager access" while signed out (manager-app.tsx:930-935). Seller, support and insights show disabled forms. **[screenshot]** | Redirect anonymous visitors to a shared sign-in gate. |
| O-06 | High | Data loading and performance | 30s polling plus a full reload on every Realtime event: 10 unpaginated queries (load-workspace.ts:91-120). The ops hook runs 9 queries for every role, with no debounce (use-operations-workspace.ts:89-101). The proxy makes a DB call on every navigation. | Window or paginate the queries, apply Realtime row diffs, and debounce. |
| O-07 | High | Maps | All markers are rebuilt on every refresh (mapbox-location-map.tsx:172-217). Markers are click-only `div`s. There are no zoom or recenter controls, and auto-fit is lost after one drag. The compact Overview map traps page scroll. | Key markers by ID and update them with `setLngLat`; make them `<button>` markers; add NavigationControl and Recenter; make the compact map non-interactive. |
| O-08 | High | Support | Resolution notes are not reset when switching cases (support-app.tsx:58, 104-109), so a note can be saved to the wrong case. | Key the detail panel by case ID. |
| O-09 | Medium | Misleading controls | Sidebar footer menu does nothing. Profile nav items are anchors to empty divs (fleet-insights-app.tsx:543; support-app.tsx:361). "Mark moving" shows on shipments already in transit. Support search filters cases only, despite its copy. | Wire each one or remove it. |
| O-10 | Medium | Empty states and notices | No empty state for the seller queue, insights maintenance and cost lists, or support history and providers. Success and error use the same `operations-notice` style. | Shared `EmptyState` and a toned `Notice`. |
| O-11 | Medium | Metrics | "At risk" accumulates all-time failures; cost per order falls back to the total cost; "Priority cases" includes resolved cases. | Window or filter the counts, and show "—" when there is no denominator. |
| O-12 | Medium | Insights shell | Separate shell with a full-reload `<a href="/manager">` and a phone bottom nav on desktop. | Render insights as a view inside `ManagerApp`. |
| O-13 | Low | Semantics | Order filter pseudo-tabs have no tabpanel or arrow keys and are 40px tall. Icon misuse: history icon for refresh, coin icon (reserved for COD) for Fleet insights. "1 riders visible". | Use segmented buttons, correct the icons, and pluralize. |

#### Design system

| ID | Severity | Evidence | Correction |
|---|---|---|---|
| D-01 | High | Three stacked CSS layers: legacy "forest/sage", then the DESIGN.md override, then Device 2/manager. 449 of 1132 selectors are defined more than once (`.manager-content` 10 times). **428 of the 1207 lines in `globals-late.css` duplicate globals.css verbatim**; the file exists only to win the cascade through load order (layout.tsx:3). About 174KB of global CSS loads on every route. | Remove the verbatim duplicates first, then move to `@layer base, components, surfaces`, then split CSS per surface. Gate every step with visual snapshots. |
| D-02 | High | About 381 hex literals outside `:root` in globals.css. `body{background:#e2e8f0}` uses the border colour as the canvas (globals.css:3578). | Replace them with tokens and add a test that fails on new hex literals outside `:root`. |
| D-03 | High | About 103 surviving 9–11px declarations; about 30 font sizes with no type tokens; ops h1 is 48px against the 24px DESIGN H1. | Type tokens and a 12px floor. |
| D-04 | Medium | Dark mode exists only for the dead `.rider-app` selector. Mapbox follows the OS dark setting, so ops users get a dark map in a light UI. | One `:root` dark theme, and the map follows the app theme. |
| D-05 | Medium | Two component systems: MUI in customer screens, hand-rolled `.button` in ops and rider screens. Three icon families. Status icons differ from DESIGN §9.2 (Accepted and Delivered share a check). | Align the status icon map first. Pick one system per surface, not a rewrite. |
| D-06 | Medium | Ad-hoc breakpoints: 359, 600, 640, 760, 820, 1100 and 1500px, plus an 880px container query. | Named breakpoints: `sm` 600, `md` 768, `lg` 1024, `xl` 1440. |
| D-07 | Low | No PWA manifest, `themeColor`, apple-touch icon or service worker. Fonts are not loaded (no `next/font`). | `app/manifest.ts`, `themeColor`, and self-hosted Inter and Noto Sans Myanmar. Offline shell for the rider later. |
| D-08 | Low | DESIGN.md section numbering is inconsistent: §5 contains 6.x and §8 contains 9.x. | Renumber when DESIGN.md is next updated, and record the operator-target decision (Q1). |

### 3.5 Low

- Dead CSS: legacy `.rider-*` block (globals.css:1502-2071); duplicate COD and profile blocks (globals.css:5885-6160 vs globals-late.css:194-470); `.eta-panel` defined 5 times; three dead `.customer-app .mobile-bottom-nav` blocks.
- Duplicated helpers: `currency` (customer-home.ts and format.ts), `statusTone` (format.ts and common.tsx), and the map toolbar (OSM and Mapbox).
- Two icon systems (MUI icons and `icons.tsx`) and two modal systems (`ModalPanel` and `SwipeableDrawer`).
- The rider call action uses the user icon and message uses the share icon (customer-app.tsx:615; rider-app.tsx:1727).
- All-caps labels ("MULTI-PROVIDER TRACKING", "PICKUP") go against DESIGN §6.
- Sign out has no confirmation mid-route, and customer sign out lands on Welcome.
- `/orders` runs two parallel workspace fetches.
- The Mapbox attribution is covered by the rider sheet (a Mapbox ToS requirement).

---

## 4. Design-system plan

Keep the Oern Final Color System v1.2 values unchanged. The work is consolidation, not a redesign.

1. **A single token source.** Keep `:root` in `globals.css` as the canonical CSS custom properties. Generate the MUI theme from them with `cssVariables: true` and `var(--color-*)`, so there is no second copy of the palette (M-15). Add the missing `--color-*-border` tokens and a `--target-min: 48px` token.
2. **Dark theme** scoped to `:root` under `prefers-color-scheme: dark` (with a `data-theme` override), using DESIGN §6.4 values. The rider is the first consumer (H-13).
3. **Type scale tokens** (`--text-caption` 12/16 … `--text-display` 28/34) with a 12px floor. Tabular numbers for amounts.
4. **Shared components.** Each replaces two or three existing variants:
   - `StatusBadge`: icon, label and tone from a single `statusTone()`.
   - `CodPanel`: coin icon, "COD" label, KPI amount, payment state.
   - `EtaHeadline`: on-time, late, unknown and arrived states.
   - `EventTimeline`: vertical, timestamped, with a terminal exception step.
   - `BottomSheet`: `ModalPanel` portalled, with focus trap, Escape, scrim click and history-backed close.
   - `EmptyState` / `ErrorState` / `OfflineBanner`: one CTA, with Retry.
   - `ReasonList`: tappable rows that always advance.
   - `MapControls`: 48px buttons anchored to `--sheet-h`.
5. **CSS consolidation.** Delete the dead blocks listed in §3.5 in small, separately reviewed commits, verified by before/after visual snapshots. Do not do one large rewrite.
6. **Localization layer.** A typed dictionary with no new dependency; `next/font/local` for Noto Sans Myanmar; `Intl` formatters set to `my-MM`/`en-MM` with the `Asia/Yangon` timezone.

---

## 5. Implementation plan (incremental, after approval)

Each step is a small reviewable commit on this branch. No migration is edited; any schema change is a new migration.

| Step | Scope | Findings closed | Needs decision |
|---|---|---|---|
| 1 | Test harness: add `@playwright/test` (dev only), a demo-data fixture mode, viewport projects (360/390/430/768 plus 1440 for ops), and an axe-core check | Enables validation | Q5 (dev dependencies) |
| 2 | Restore the labelled demo workspace for signed-out sessions | C-04 | — |
| 3 | Critical customer fixes: portal the dialog, freshness-row contrast, Track URL reactivity | C-01, C-02, H-01 | — |
| 4 | Critical rider fixes: keep last good data offline, outcome step dead end, slide-to-confirm button | C-05, C-06, H-08 | — |
| 5 | Shared components: StatusBadge, CodPanel, EtaHeadline, EventTimeline; apply to Home, Track and Orders | H-02, H-04, H-05, H-06, M-02, M-14 | — |
| 6 | Track page restructure into a map plus a single status sheet (DoorDash/Grab pattern); full history in a sheet (Shop pattern) | Hierarchy | Review screenshots first |
| 7 | Orders: Active/Past tabs, dates, search, Order detail screen | H-07 | — |
| 8 | Help → order-context support case; notifications inbox from real rows | H-03, M-06 | — |
| 9 | Rider: tappable stop list with "Current" tag, On-shift toggle, Report a problem on every leg, sharing-health chip, sheet errors | H-09, H-10, H-11 | — |
| 10 | Touch targets, 12px floor, focus traps, native back, offline banner | M-01, M-03 … M-13 | — |
| 11 | Dark theme tokens; MUI theme generated from the CSS variables | H-13, M-15 | — |
| 12 | Manager phone layout (bottom nav, card lists, assignment sheet); dispatch ordering; signed-out gate; support notes fix | C-03, O-01, O-04, O-05, O-08 | **Q1** |
| 12b | COD reconciliation view; manual assignment with reason; create-order sheet | O-02, O-03 | — |
| 12c | Map marker diffing and controls; query windowing and debounce | O-06, O-07 | — |
| 13 | Proof-of-delivery photo | H-12 | **Q2** (Storage plus migration) |
| 14 | Myanmar localization (customer and rider first) | H-14 | **Q3** |
| 15 | CSS consolidation: remove the globals-late duplicates, `@layer`, tokens for hex values and type, named breakpoints | D-01 … D-06, §3.5 | — |
| 16 | PWA manifest, theme colour, self-hosted fonts | D-07 | — |

Out of scope unless approved: phone OTP auth (Q4), Web Push, saved-address schema, ratings.

---

## 6. Test and validation plan

The repository has Node unit tests (`tests/*.test.mjs`), Biome, `tsc`, and SQL workflow checks. It has no browser tests.

- **Unit tests** (existing runner): `etaState`, `statusTone`, COD formatting in MMK, progress gating, rider route sequencing with offline cache, and the reason-step reducer.
- **E2E (Playwright, demo fixtures, no real Supabase writes)**:
  - Customer: sign-in dialog, Track by ID, scan from Track, timeline for a failed order, Orders search, Help → support case.
  - Rider: start → pickup → navigate → arrive → COD mismatch → confirm by button → next stop → finish; offline mid-route; GPS denied (`context.grantPermissions([])`); reload during outcome; double-tap on pickup.
  - Manager: create, assign and reassign.
  - Role access: each role visiting each workspace is redirected per `workspaceRedirect`.
- **Visual regression**: `toHaveScreenshot` for every route × {360×640, 390×844, 430×932, 768×1024}, plus 1440×900 for ops; dialogs, empty, loading, error and offline states; a long-Burmese-address fixture.
- **Accessibility**: `@axe-core/playwright` on every snapshot state; keyboard-only rider outcome; focus-trap assertions; a test that fails on any target under 48px in rider screens.
- **Layout guard**: assert `scrollWidth <= clientWidth` on every mobile route. This would have caught C-03.
- **Manual (real devices)**: TalkBack and VoiceOver on the rider outcome, a sunlight check, gloves, iOS keyboard over the auth sheet, and a background or locked-phone GPS test.

---

### 6.1 Scenario matrix (what the E2E suite must cover)

| Scenario | Customer | Rider | Manager | Seller / Support | Current behavior (from code) |
|---|---|---|---|---|---|
| First visit, signed out | ✓ | ✓ | ✓ | ✓ | Empty screens with no sample data (C-04). Ops forms look active (O-05). |
| Wrong credentials / expired session | ✓ | ✓ | ✓ | ✓ | Auth dialog shows an error. Session expiry is untested. |
| Wrong role visits another workspace | ✓ | ✓ | ✓ | ✓ | Proxy redirect is implemented, and a unit test exists. |
| No orders / no assigned tasks | ✓ | ✓ | ✓ | ✓ | Empty states exist but lack a CTA (M-07, O-10). |
| Missing ETA / missing pin / no GPS fix | ✓ | ✓ | ✓ | — | ETA shows "Being arranged"; rider gets a no-pin fallback that references a landmark field that doesn't exist. |
| Offline mid-task | ✓ | ✓ | ✓ | — | **Rider route is wiped (C-05).** Customer has no banner (M-12). |
| GPS denied / stale | ✓ (stale) | ✓ | ✓ | — | Rider handles denial. Customer stale cue is invisible (C-02). Silent share failure (H-10). |
| Server error on status update | — | ✓ | ✓ | ✓ | Error banner. Rider data wiped (C-05). Ops notices look like successes (O-10). |
| Failed delivery / customer unavailable / wrong address | ✓ | ✓ | ✓ | ✓ | Rider can report only after arrival (H-09). Customer timeline is wrong (H-05). |
| COD discrepancy | ✓ | ✓ | ✓ | — | Rider mismatch path exists (M-10). No ops reconciliation (O-02). |
| Low battery or fuel | — | ✓ | ✓ | — | Readiness check covers the current leg only. No in-navigation warning. |
| Multiple deliveries / reassignment mid-route | ✓ | ✓ | ✓ | — | One order at a time. Reassignment changes the current stop with no notice. |
| Duplicate taps / concurrent edits | — | ✓ | ✓ | ✓ | Rider `busy` guard exists. Assignment is atomic in SQL. |
| Long Burmese address, large font, 360×640 | ✓ | ✓ | ✓ | ✓ | Addresses truncate (H-02). No Burmese font is loaded (H-14). |
| Keyboard over inputs | ✓ | ✓ | ✓ | ✓ | No `visualViewport` handling. Needs a real-device check. |
| Refresh during active task | ✓ | ✓ | ✓ | ✓ | Rider restores the phase and draft, but the outcome step resets (C-06). |

All tests use synthetic fixtures (C-04 demo mode, or a local Supabase). Never real payments, real customers or production data.

## 7. Decisions needed before implementation

| # | Question | Recommendation |
|---|---|---|
| Q1 | Is the manager workspace phone-first (DESIGN.md says so) or desktop-first with a usable phone fallback? | A responsive phone layout under 768px, keeping the desktop shell. |
| Q2 | Proof of delivery: photo, recipient OTP, or both? Requires a Supabase Storage bucket, RLS and a new migration. | Photo first, with OTP later for high-value COD. |
| Q3 | Localization scope: Burmese for customer and rider only, or every workspace? | Customer and rider first. |
| Q4 | Switch customer auth to phone OTP? | Defer. Needs an SMS provider and cost approval. |
| Q5 | OK to add dev-only dependencies `@playwright/test` and `@axe-core/playwright`? | Yes. Dev only; nothing ships to users. |
| Q6 | Restore labelled demo data for signed-out visitors (C-04), or update the docs to match current behavior? | Restore it. |

---

## Appendix: screenshots (signed-out state, captured 2026-10-21)

Captured with Playwright against `bun run dev` with no Supabase project.

| File | What it shows |
|---|---|
| `screenshots/s_welcome.png` | 360×640. The tagline nearly touches the primary CTA (M-16). |
| `screenshots/m_home.png` | 390×844. Customer home, signed out. |
| `screenshots/m_track.png` | 390×844. Track empty state with no sign-in CTA (M-07). |
| `screenshots/m_orders.png` | 390×844. Two empty states, plus a support form outside Help (H-03). |
| `screenshots/m_rider_route.png` | 390×844. Rider sign-in gate. |
| `screenshots/s_manager_home.png` | 360 viewport rendering a 1024px canvas (C-03 / O-01). |
| `screenshots/s_seller.png` | 360×640. Four stacked forms visible while signed out (M-17 / O-05). |
