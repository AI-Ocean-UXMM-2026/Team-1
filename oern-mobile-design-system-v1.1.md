# Oern Mobile Design System
**Version:** 1.0  
**Scope:** Mobile-only experiences for Customer, Driver, and Delivery Operator  
**Color foundation:** Oern Final Color System v1.2  
**Status:** Proposed design system informed by mobile UX desk research; validate with users before production.

## 1. Purpose and design direction

Oern is a delivery platform for Myanmar, initially focused on Yangon. It needs to make three connected jobs feel simple:

- Customers need confidence: what is happening, where the driver is, when the parcel may arrive, and how much COD is due.
- Drivers need execution clarity: what to deliver next, where to go, what to collect, and how to prove completion.
- Delivery operators need control: what is unassigned, which drivers and vehicles are available, which deliveries are at risk, and whether COD has been reconciled.

**Design direction:** Fast, clear, reliable, delivery-first. Use calm neutral surfaces, strong navy hierarchy, orange for brand and primary actions, blue for live tracking, and explicit semantic states. The three role experiences share one token and component system but have distinct information architecture and task flows.

### Principles

1. **One primary job per screen.** Make the most likely next action obvious.
2. **Status before decoration.** Show state, ETA, amount, or next stop before secondary metrics.
3. **Maps are functional, not ornamental.** Give maps enough space to support a route decision; use a compact preview when the user mainly needs status.
4. **Use color, label, and icon together.** Never communicate delivery or payment state through color alone.
5. **Design for real operating conditions.** Support one-handed use, sunlight, night shifts, variable connectivity, and long local addresses.
6. **Reduce uncertainty, not just taps.** Explain stale GPS, delayed delivery, failed delivery, and COD mismatches in plain language.
7. **Share patterns, not screens.** Common components look and behave consistently, while customer, driver, and operator flows remain role-specific.
8. **Progressive disclosure.** Keep the first view focused; put history, advanced filters, and secondary settings one level deeper.

## 2. Research basis and confidence

This is a desk-research synthesis, not a claim that every screen in every app has been exhaustively audited. Mobbin search results were used to identify representative mobile screen and flow references across parcel tracking, delivery execution, order management, and dispatch. Official platform and accessibility guidance informs navigation and target sizing. Recommendations for Oern are product design decisions derived from the user's project scope, the existing color system, and those references; they are not claims about proprietary internal designs.

### Representative Mobbin references

| Area | Reference | Research focus |
|---|---|---|
| Customer tracking | [Shopee — Tracking driver location](https://mobbin.com/flows/7ef69bab-a64c-4b7b-bce0-877d0ac70163), 3 screens | Tracking journey and driver-location entry point |
| Customer delivery details | [Klarna — Tracking a delivery](https://mobbin.com/flows/55b055d1-bd89-4071-b021-15788b7eb4ed), 9 screens | Delivery tracking and related details |
| Package tracking | [PayPal — Track a package](https://mobbin.com/flows/fb233d86-7d8d-4a95-bc0f-04ebbd1c9f38), 3 screens | Package lookup and tracking journey |
| Parcel details | [InPost UK — Parcel info](https://mobbin.com/flows/614f75e0-9b66-4ef3-822c-18c75e51e144), 3 screens | Parcel information |
| Driver execution | [DoorDash Dasher — Completing an order](https://mobbin.com/flows/ec82d267-a98a-4124-bb3b-3de97f76132a), 14 screens | Task progression and order completion |
| Driver execution | [Grab Driver — Completing a job](https://mobbin.com/flows/d28b1cfa-d25b-413e-ab85-d7e6d2acb39e), 14 screens | Driver job lifecycle |
| Proof of delivery | [Instacart — Proof of delivery](https://mobbin.com/flows/4585a752-6c5f-4c21-b9df-6776c05fdcb9), 3 screens | Completion evidence flow |
| Courier task | [Shopee — Deliver packages](https://mobbin.com/flows/c83b6d74-157e-4f2e-bd05-21da0c4ee90a), 4 screens | Package delivery sequence |
| Order creation | [Grab — Creating a delivery order](https://mobbin.com/flows/3484fed9-4d50-42b9-b887-e587a170fab2), 9 screens | Delivery creation workflow |
| Delivery form | [Grab — Creating a delivery form](https://mobbin.com/flows/e07479c3-7c98-4d0e-920f-f00726eedc1f), 8 screens | Form structure and order entry |
| Order management | [Shopify — Filtering orders](https://mobbin.com/flows/2b417ba9-496e-4be7-8f00-1ee6dee3bb3e), 5 screens | Filtering and order list interactions |
| Order management | [talabat — Orders](https://mobbin.com/flows/b4889bcf-e732-4109-8464-a5fbfe456203), 7 screens | Order management journey |

### Platform and accessibility references

- [Apple Human Interface Guidelines — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars/) — top-level navigation should remain understandable, labeled, and easy to switch between.
- [Android Developers — Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns) — navigation should match compact mobile use and platform conventions.
- [Material 3 for Compose](https://developer.android.com/develop/ui/compose/designsystems/material3) — reusable components and platform design-system patterns.
- [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) — contrast, focus, and target-size requirements.
- [Nielsen Norman Group — Mobile UX study guide](https://www.nngroup.com/articles/mobile-ux-study-guide/) — mobile navigation and information architecture considerations.

### Synthesis for Oern

- Customers should be able to resume a trackable delivery directly from Home or Orders.
- Driver workflows should be task-oriented and state-driven, with a single prominent next action.
- Operator workflows should favor scannable lists, search, filters, assignment decisions, and exception handling over dense charts.
- COD is a payment state separate from delivery status. A parcel can be delivered while money is still outstanding or awaiting reconciliation.
- The route map must communicate driver, destination, origin, completed stops, and alerts using shape, label, and color.
- The mobile operator app should be designed for phones, not a desktop dashboard compressed into a narrow viewport.

## 3. Product architecture

### Three role experiences, one design language

| Role | Primary outcome | Primary navigation | Main information priority |
|---|---|---|---|
| Customer | Understand and trust a delivery | Home · Track · Orders · Profile | Active order, ETA, driver, COD, progress |
| Driver | Complete the next stop safely and accurately | Route · Deliveries · Earnings · Profile | Next stop, navigation, delivery action, COD |
| Delivery Operator | Keep orders assigned and exceptions under control | Overview · Orders · Drivers · More | Unassigned/at-risk orders, availability, fleet, COD |

Use role-based access so users only see relevant actions and data. A customer must not see driver earnings or other customers' addresses. A driver must not see unrelated customer records. An operator sees only the fleet and delivery data permitted by their organization and role.

### Shared mobile shell

- Safe-area-aware status and navigation regions.
- Consistent top bar, screen title, back behavior, spacing, and surfaces.
- Four primary navigation destinations per role by default.
- Labeled navigation icons; do not rely on icon-only navigation.
- One primary action per screen where possible.
- Full-screen map or guided task mode only when it supports the active task.
- Bottom sheets for focused choices, such as driver assignment, stop actions, and filters.
- Use native back behavior and preserve scroll/filter state when users return.

## 4. Information architecture

### Customer

- **Home:** active delivery, tracking shortcut, recent orders, notifications.
- **Track:** live map, ETA, driver details, delivery timeline, sharing controls.
- **Orders:** active and past deliveries, search by order ID, status filters.
- **Order detail:** destination, carrier, timeline, COD status, delivery proof when appropriate.
- **Help:** delivery issue categories, contact options, order context.
- **Profile:** saved addresses, notification preferences, privacy and account settings.

### Driver

- **Route:** route overview, stop sequence, remaining distance/time, route alerts.
- **Deliveries:** assigned, completed, failed, and rescheduled tasks.
- **Stop detail:** address, customer contact, access instructions, parcel summary, COD due.
- **Proof of delivery:** delivery confirmation, photo/signature/recipient confirmation according to policy.
- **Earnings / COD:** earnings where applicable, COD collected, cash reconciliation, discrepancies.
- **Vehicle / Profile:** vehicle type, fuel/battery, shift status, app settings, support.

### Delivery Operator

- **Overview:** active deliveries, unassigned orders, available drivers, delayed orders, COD to reconcile.
- **Orders:** searchable/filterable order queue, order detail, assignment state, event history.
- **Assign:** candidate drivers and vehicles, capacity, workload, proximity, route fit, manual override.
- **Drivers:** online status, workload, last location update, current route, availability.
- **Fleet:** truck, bike, e-bike; capacity, fuel/battery, service availability.
- **Exceptions:** delayed, failed, unreachable, address issue, low battery/fuel, COD discrepancy.
- **Reports / More:** delivery analytics, COD reconciliation, settings, permissions.

## 5. Design tokens

The existing **Oern Final Color System v1.2** is the canonical color contract. Do not change its color values independently inside customer, driver, and operator screens.

### 6.1 Core colors

| Token | Hex | Use |
|---|---|---|
| `brand.orange` | `#F97316` | Brand identity and decorative accents; use navy text on orange |
| `brand.orange-action` | `#C2410C` | Light-theme primary action with white text |
| `brand.orange-action-hover` | `#9A3412` | Pressed/strong action state |
| `brand.navy` | `#172B4D` | Main text, headings, structure |
| `surface.canvas` | `#F8FAFC` | App background |
| `surface.primary` | `#FFFFFF` | Cards, sheets, input backgrounds |
| `surface.subtle` | `#F1F5F9` | Grouped/secondary panels |
| `border.default` | `#E2E8F0` | Decorative edges and dividers only |
| `border.control` | `#64748B` | Inputs, secondary button outlines |
| `text.primary` | `#172B4D` | Primary text |
| `text.secondary` | `#64748B` | Supporting text on white/canvas |
| `text.secondary-subtle` | `#475569` | Supporting text on subtle surface |
| `text.placeholder` | `#64748B` | Input placeholders |
| `text.inverse` | `#FFFFFF` | Text on navy and accessible dark-orange action |

### 6.2 Semantic colors

| Meaning | Graphic token | Text token | Tinted background / foreground |
|---|---|---|---|
| Success / delivered | `#16A34A` | `#166534` | `#DCFCE7` / `#166534` |
| Warning / delayed / COD due | `#D97706` | `#92400E` | `#FEF3C7` / `#92400E` |
| Error / failed / cancelled | `#DC2626` | `#B91C1C` | `#FEE2E2` / `#991B1B` |
| Info / live / in transit | `#2563EB` | `#1D4ED8` | `#DBEAFE` / `#1D4ED8` |
| Neutral / pending | `#64748B` | `#475569` | `#F1F5F9` / `#475569` |

Rules:
- Orange is not a delivery-status color.
- Use semantic text tokens for small text; bright semantic colors are primarily for graphics.
- `#94A3B8` and `#E2E8F0` are decorative only, not small text, placeholders, inactive icons, or critical control boundaries.
- Use a coin icon and a visible “COD” label for every COD state.

### 6.3 Map tokens

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `map.route.active` | `#2563EB` | `#60A5FA` | Active/planned route |
| `map.route.casing` | `#FFFFFF` | `#0F172A` | Route separation outline |
| `map.driver` | `#172B4D` | `#F8FAFC` | Driver/vehicle marker |
| `map.driver.casing` | `#FFFFFF` | `#0F172A` | 2 px marker casing |
| `map.destination` | `#C2410C` | `#FB923C` | Destination pin |
| `map.origin` | `#64748B` | `#94A3B8` | Origin/hollow circle |
| `map.completed` | `#16A34A` | `#4ADE80` | Completed stop/check |
| `map.alert` | `#DC2626` | `#F87171` | Blockage/failed stop |
| `map.road-label` | `#475569` | `#CBD5E1` | Road labels |
| `map.surface` | `#F1F5F9` | `#1E293B` | Low-emphasis map surface |

Map markers always use a shape plus icon/label, not color alone. Multi-stop routes use numbers to communicate order.

### 6.4 Dark theme

| Token | Value |
|---|---|
| `background` | `#0F172A` |
| `surface` | `#1E293B` |
| `surface.subtle` | `#273449` |
| `border.default` | `#334155` |
| `border.control` | `#8294AD` |
| `text.primary` | `#F8FAFC` |
| `text.secondary` | `#CBD5E1` |
| `text.placeholder` | `#94A3B8` |
| `text.link` | `#FB923C` |
| `brand.orange-action` | `#F97316` with `#0F172A` text |
| `map.route.active` | `#60A5FA` |
| `map.destination` | `#FB923C` |

Use dark theme especially for driver/night use, while respecting OS and user preference. Do not simply invert the light palette.

## 6. Typography

Use **Inter** where bundled. For Myanmar content, support **Noto Sans Myanmar** or the native system font with Myanmar glyph coverage. Fall back to SF Pro on iOS and Roboto on Android. Do not depend on a remote font for essential interface text.

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| Display | 28 / 34 px | 700 | Primary ETA or KPI |
| H1 | 24 / 30 px | 700 | Screen title |
| H2 | 20 / 26 px | 650–700 | Major card/section heading |
| H3 | 16 / 22 px | 600 | Card title |
| Body | 14 / 20 px | 400 | Main content |
| Body strong | 14 / 20 px | 600 | IDs, values, key labels |
| Button | 15 / 20 px | 600 | Button label |
| Caption | 12 / 16 px | 500 | Metadata and timestamps |
| KPI | 24 / 30 px | 700 | Counts and amounts |

Typography rules:
- Use sentence case for labels and headings.
- Keep meaningful text at 12 px or larger.
- Use tabular numerals for monetary values and counts when available.
- Allow multi-line addresses; do not truncate the only copy of an address or landmark.
- Keep Burmese and English mixed text readable without forcing all labels into all caps.

## 7. Spacing, sizing, shape, elevation

### Spacing scale

| Token | Value | Use |
|---|---:|---|
| `space.1` | 4 px | Icon/text micro-gap |
| `space.2` | 8 px | Compact gaps and control separation |
| `space.3` | 12 px | Compact card padding |
| `space.4` | 16 px | Standard screen/card padding |
| `space.5` | 20 px | Section separation |
| `space.6` | 24 px | Major sections |
| `space.8` | 32 px | Large separation |

### Shape

| Token | Value | Use |
|---|---:|---|
| `radius.sm` | 8 px | Small controls, small badges |
| `radius.md` | 12 px | Inputs and compact cards |
| `radius.lg` | 16 px | Main cards and sheets |
| `radius.xl` | 20 px | Hero cards and large sheets |
| `radius.pill` | 999 px | Chips and badges |

### Mobile layout rules

- Base design frame: 390 × 844 px.
- Test widths: 320, 360, 390, and 430 px.
- Horizontal screen padding: 16 px; 20 px where a major hero section needs breathing room.
- Main card gaps: 12–16 px.
- Critical action targets: at least 48 × 48 px; primary actions 52–56 px high.
- Adjacent targets: at least 8 px apart.
- Bottom navigation: four items by default, labeled and safe-area aware.
- Driver screens: portrait-first, with primary action reachable near the lower half of the screen.
- Avoid horizontally dense metric grids and tiny map controls.
- Do not create tablet/desktop layouts in this mobile-only system.

### Elevation

- Cards: thin decorative border and little or no shadow.
- Floating map controls and sheets: soft shadow plus visible surface boundary.
- Avoid stacked shadows and excessive glass effects.
- Dark theme hierarchy should rely on surface differences, not black shadows.

## 8. Component library

### 9.1 Buttons

| Variant | Appearance | Use |
|---|---|---|
| Primary | Light: `#C2410C` + white text; dark: `#F97316` + navy text | Main action |
| Secondary | Surface fill + `border.control` outline | Contact, cancel, alternate action |
| Tertiary | Transparent with accessible action text | Low-emphasis inline action |
| Destructive | Red semantic treatment with explicit label | Cancel, fail, remove |
| Icon button | Visible boundary or contrast, accessible label | Map, notification, close |

Required states: default, pressed, loading, disabled, success, error. Keep the label stable during loading where possible. Never use color alone to indicate disabled or destructive state.

### 9.2 Status badge

Every badge includes a short label and a distinct icon.

| State | Treatment | Icon cue | Label |
|---|---|---|---|
| Pending | Neutral tinted | Clock | Pending |
| Assigned | White/transparent with blue outline | Clipboard-check | Assigned |
| In transit | Blue tinted | Truck | In transit |
| Approaching | Solid blue with white text | Map pin/arrow | Arriving |
| Delivered | Green tinted | Check-circle | Delivered |
| Delayed | Amber tinted | Hourglass | Delayed |
| Failed | Red tinted | X-octagon | Failed |
| Cancelled | Red tinted | Slash-circle | Cancelled |
| COD collected | Green tinted | Coin + check | COD collected |
| COD due | Amber tinted | Coin + clock | COD due |

Do not merge delivery state and payment state into a single badge. An order can be delivered while COD remains unreconciled.

### 9.3 Delivery card

Recommended information order:
1. Order ID and status.
2. ETA or next action.
3. Map preview if it helps.
4. Driver/vehicle details.
5. COD state and amount.
6. One primary CTA and optional secondary action.

Use a list rather than large cards when operators must compare many orders quickly. Cards are best for a small number of prioritized items or browse-oriented content.

### 9.4 Map and live-tracking surface

- Customer map preview: approximately 150–190 px high; expand on tracking detail.
- Driver route map: approximately 180–260 px when route context is needed.
- Operator map: emphasize fleet/exception context, but preserve a list alternative.
- Use a white casing around the light-theme route and driver marker.
- Keep map controls on an opaque surface with visible boundaries.
- Show last-updated time and GPS stale state.
- Provide a list or textual route summary for people who cannot use the map.
- Never invent location or ETA when the service is unavailable.

### 9.5 COD panel

- Visually separate payment from delivery progress.
- Show `COD due`, `COD collected`, `COD handed over`, `COD reconciled`, or `COD discrepancy`.
- Display amount and currency clearly; use MMK for Myanmar monetary values.
- Driver records expected and collected amount separately.
- Operator reconciliation shows amount expected, amount received, status, and discrepancy reason.
- Keep a confirmation step before irreversible cash-state transitions.

### 9.6 Form controls

- Input height: 52 px minimum.
- Light border: `#64748B`; dark border: `#8294AD`.
- Placeholder: `#64748B` light / `#94A3B8` dark.
- Error state: 2 px red boundary, error icon, and plain-language helper.
- Labels stay visible after the user types; do not rely on placeholder-only labels.
- Use appropriate keyboard types for phone numbers, search, amount, and verification codes.
- Validate after input or submit in a predictable way; preserve valid entries on error.

### 9.7 Search and filter

- Put search near the top of the Orders screen.
- Use status chips for the most common filters; put rare filters in a sheet.
- Show active filters and provide “Clear all.”
- Preserve search and filter state when opening and returning from an order.
- Provide loading, no results, and retry states.
- For large operator queues, use compact rows with fixed positions for ID, status, assigned driver, and ETA.

### 9.8 Timeline and event history

- Each event includes an icon, status text, timestamp, and optional detail.
- Completed events use a completed state; current event is emphasized; future events remain neutral.
- Do not imply a future step has happened.
- Keep event timestamps consistent with the user's local timezone.
- For failed or delayed events, explain the reason and next action.

### 9.9 Bottom navigation

- Four destinations per role by default.
- Use a consistent icon family and labels.
- Selected state uses both color and a visual shape/background cue.
- Navigation items navigate; they should not perform destructive or contextual actions.
- Preserve scroll state where it supports task resumption.
- Keep high-frequency destinations visible instead of hiding them in a hamburger menu.

### 9.10 Bottom sheets and dialogs

Use a bottom sheet for contextual, non-destructive choices: assignment candidate list, filter selection, stop actions, or a COD summary. Use a dialog for a consequential confirmation or a short focused alert. Include a clear title, short explanation, and explicit actions. Do not stack multiple sheets.

### 9.11 Notifications and alerts

- Separate informational, warning, and blocking messages.
- State what happened, what it means, and what the user can do.
- Avoid alarming copy for normal delays.
- Show a persistent banner for stale GPS/offline state when it affects task correctness.
- Push notifications should deep-link to the relevant order or task.

### 9.12 Loading, empty, and error states

Every key screen needs:
- Loading/skeleton state.
- Empty state with next action.
- Error state with retry or recovery.
- Offline/stale-data state when applicable.
- Permission-denied state for location/camera/notifications.
- Success confirmation for assignment, delivery completion, and COD actions.

Do not leave a blank map or spinner indefinitely. Keep cached order details visible when safe and label them as stale.

## 9. Role-specific screen specification

### Customer app screens

| Screen | Primary content | Main action | Key states |
|---|---|---|---|
| Home | Active delivery, search, recent orders | Track delivery | No active orders, loading |
| Track detail | Map, ETA, driver, timeline, COD | Contact / share | Live, stale GPS, delayed |
| Orders | Active/past list, search, filters | Open order | Empty, no results |
| Order detail | Status history, destination, payment | Track / get help | Delivered, failed |
| Help | Issue categories, order context | Submit issue/contact | Submitted, unavailable |
| Profile | Address, notification, privacy settings | Save preference | Validation, success |

### Driver app screens

| Screen | Primary content | Main action | Key states |
|---|---|---|---|
| Route | Stop count, map, next stop | Start/continue route | Offline, no assigned route |
| Stop detail | Address, customer, parcel, COD | Navigate / arrived | Address issue |
| Proof of delivery | Recipient confirmation, photo/signature as required | Confirm delivery | Camera denied, retry |
| COD collection | Expected amount, collected amount, method | Confirm collection | Mismatch, cash not collected |
| Delivery result | Outcome, proof, next stop | Continue route | Delivered, failed, reschedule |
| Earnings/COD | Collected, outstanding, handover status | Reconcile/submit | Discrepancy |
| Vehicle/profile | Vehicle, battery/fuel, shift | Update readiness | Low battery/fuel |

### Operator app screens

| Screen | Primary content | Main action | Key states |
|---|---|---|---|
| Overview | Unassigned, active, delayed, COD summary | Review exceptions | Loading, no alerts |
| Orders | Search/filter list, status, ETA, assignment | Open/assign | No results, bulk state |
| Order detail | Address, constraints, history, COD | Assign/reassign | Invalid order, conflict |
| Assignment sheet | Driver/vehicle candidates and fit factors | Confirm assignment | No candidates |
| Drivers | Availability, workload, last location | Open driver | Offline/stale location |
| Fleet | Truck/bike/e-bike, capacity, fuel/battery | Update readiness | Service unavailable |
| Exceptions | Delay/failure/COD issue and owner | Resolve/escalate | Reopened, unresolved |
| COD reconciliation | Expected, collected, handed over, discrepancy | Reconcile | Matched, mismatch |

## 10. State models and product rules

### Delivery lifecycle

Suggested lifecycle:
`Pending → Assigned → In transit → Arriving → Delivered`

Exception states may include:
`Delayed`, `Failed`, `Cancelled`, and `Rescheduled`.

Rules:
- State transitions must be event-driven and auditable.
- A state should not jump to Delivered solely because GPS is near the destination.
- Arriving is a distinct state and uses a solid blue badge.
- Failed and Cancelled are distinct outcomes, even though both use a red semantic family.
- Reassignment records the previous and new driver, timestamp, and actor.

### Payment lifecycle

Suggested lifecycle:
`COD due → COD collected → COD handed over → COD reconciled`

Exception:
`COD discrepancy`

Rules:
- Delivery and payment states are separate dimensions.
- Amount due and amount collected are separate values.
- A collection confirmation is an explicit driver action.
- A discrepancy needs a reason and a permitted resolution path.
- Reconciliation should be auditable and restricted by role.

### Assignment recommendation

AI-assisted assignment should explain the main factors: workload, vehicle fit, route distance, delivery window, fuel/battery readiness, and available local knowledge. Show a recommendation with confidence/limitations rather than presenting it as guaranteed optimal. Operators can override with a reason. Never make an opaque AI score the only decision input.

## 11. Motion and interaction

- Use short transitions (roughly 150–220 ms) for state changes.
- Respect reduced-motion settings.
- A live/arriving pulse is optional and never the only status cue.
- Use skeletons for stable layout while content loads; avoid excessive shimmer.
- Avoid swipe-only critical actions; provide a visible button alternative.
- Confirm destructive actions and high-impact COD transitions.
- Do not encourage app interaction while driving; the driver should interact when safely stopped.
- Make map pan/zoom controls large enough and avoid gesture conflicts with bottom sheets.

## 12. Localization and Myanmar-specific details

- Support Burmese and English labels without hard-coded widths.
- Use a Myanmar-capable font such as Noto Sans Myanmar or a platform fallback with tested glyph coverage.
- Do not truncate township, ward, street, building, or landmark information needed for delivery.
- Provide structured address fields plus a free-form landmark/access note.
- Use `MMK` consistently for currency in the interface; choose local number formatting with product stakeholders.
- Keep phone numbers tap-to-call where allowed.
- Use local timezone consistently for delivery events.
- Design location permission prompts with a clear explanation of why live tracking is needed.
- Do not assume every customer uses a map pin accurately; allow textual directions and landmarks.
- Provide low-bandwidth and offline fallbacks for driver workflows.

## 13. Privacy, trust, and safety

- Customer tracking links should expire or have a defined access window.
- Share only the minimum location and recipient details needed for the delivery.
- Clearly show when live location is being shared and when the share link expires.
- Limit driver access to assigned deliveries and only the recipient data required for that task.
- Restrict operator access by organization and role.
- Avoid exposing full addresses, phone numbers, or payment data in push notification previews by default.
- Log assignment, delivery-state, proof-of-delivery, and COD changes.
- Do not fabricate live location, ETA, successful payment, or proof-of-delivery evidence.
- Provide recovery paths for a failed delivery without blaming the customer or driver.

## 14. Design token implementation

Use semantic token names in design files and code. Generate light/dark themes from one source of truth.

```css
:root {
  --color-brand-orange: #F97316;
  --color-brand-orange-action: #C2410C;
  --color-brand-orange-action-hover: #9A3412;
  --color-brand-navy: #172B4D;

  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #F1F5F9;
  --color-border: #E2E8F0;
  --color-border-control: #64748B;

  --color-text-primary: #172B4D;
  --color-text-secondary: #64748B;
  --color-text-secondary-subtle: #475569;
  --color-text-inverse: #FFFFFF;

  --color-success: #16A34A;
  --color-success-text: #166534;
  --color-warning: #D97706;
  --color-warning-text: #92400E;
  --color-error: #DC2626;
  --color-error-text: #B91C1C;
  --color-info: #2563EB;
  --color-info-text: #1D4ED8;

  --color-map-route: #2563EB;
  --color-map-route-casing: #FFFFFF;
  --color-map-driver: #172B4D;
  --color-map-driver-casing: #FFFFFF;
  --color-map-destination: #C2410C;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --target-min: 48px;
}

:root[data-theme="dark"] {
  --color-background: #0F172A;
  --color-surface: #1E293B;
  --color-surface-subtle: #273449;
  --color-border: #334155;
  --color-border-control: #8294AD;
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #CBD5E1;
  --color-text-secondary-subtle: #CBD5E1;
  --color-text-inverse: #0F172A;
  --color-brand-orange-action: #F97316;
  --color-brand-orange-action-hover: #FB923C;
  --color-map-route: #60A5FA;
  --color-map-route-casing: #0F172A;
  --color-map-driver: #F8FAFC;
  --color-map-driver-casing: #0F172A;
  --color-map-destination: #FB923C;
}
```

This snippet is a starting subset; the existing Oern Color System v1.2 contains the complete contrast-checked semantic and badge mappings.

## 15. Quality and acceptance checklist

### Visual consistency
- [ ] Customer, driver, and operator use the same semantic tokens.
- [ ] One primary action is visually dominant per screen.
- [ ] Status badges use correct icon, label, and fill/border treatment.
- [ ] COD state is visually separate from delivery state.
- [ ] Inputs and secondary buttons use `border.control`, not decorative borders.
- [ ] Cards, sheets, navigation, and typography follow the shared spacing scale.

### Accessibility
- [ ] Normal text contrast is at least 4.5:1; large text at least 3:1.
- [ ] Non-text UI elements have at least 3:1 contrast against adjacent colors.
- [ ] `#F97316` is not paired with white small text.
- [ ] Important touch controls are at least 48 × 48 px; adjacent controls are separated by at least 8 px.
- [ ] Focus, pressed, disabled, loading, error, and success states are defined.
- [ ] Screen-reader labels exist for icon-only controls.
- [ ] Status meaning remains clear in color-vision deficiency simulations.

### Flow completeness
- [ ] Customer can find an order and understand current state, ETA limitations, driver, and COD.
- [ ] Driver can complete a stop, capture required proof, record COD, and continue the route.
- [ ] Failed delivery, address issue, stale GPS, low battery/fuel, and offline states are designed.
- [ ] Operator can assign/reassign, see exceptions, and reconcile COD.
- [ ] Every key action gives feedback and preserves valid input on error.
- [ ] State transitions are auditable and cannot be triggered by ambiguous visual cues alone.

### Real-world validation
- [ ] Test at 320, 360, 390, and 430 px widths.
- [ ] Test on real phones in bright outdoor light and at night.
- [ ] Test with long Burmese addresses and mixed Burmese/English text.
- [ ] Test weak connectivity, GPS loss, camera/location permission denial, and interrupted proof capture.
- [ ] Validate route/driver/destination markers over realistic map tiles.
- [ ] Conduct usability sessions with at least one customer, one driver, and one operator before locking the system.

## 16. Recommended implementation order

1. **Foundations:** semantic tokens, typography, spacing, surfaces, icon rules, light/dark themes.
2. **Core components:** buttons, badges, order rows/cards, inputs, timeline, COD panel, map markers, bottom navigation, sheets.
3. **Role-specific visual patterns:** apply the shared system consistently across customer, driver, and operator interfaces.
4. **Validation:** accessibility, localization, visual consistency, and field testing.

## 17. Final design recommendation

Keep Oern's established orange/navy/blue identity. Modernize through stronger hierarchy, fewer competing actions, role-specific flows, clear operational states, and reusable components—not through decoration alone. Build a single semantic design system with three mobile task experiences, and validate the most consequential flows (tracking, delivery completion, assignment, and COD) with real users before production.

