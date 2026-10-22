---
name: Oern
description: Door-to-door delivery for Yangon. Calm navy structure, one orange action, blue for anything live.
colors:
  signal-orange: "#f97316"
  kiln-orange: "#c2410c"
  kiln-orange-pressed: "#9a3412"
  orange-wash: "#fff7ed"
  dispatch-navy: "#172b4d"
  canvas: "#f8fafc"
  surface: "#ffffff"
  surface-subtle: "#f1f5f9"
  hairline: "#e2e8f0"
  control-slate: "#64748b"
  text-secondary-subtle: "#475569"
  live-blue: "#2563eb"
  live-blue-text: "#1d4ed8"
  live-blue-wash: "#dbeafe"
  live-blue-border: "#bfdbfe"
  delivered-green: "#16a34a"
  delivered-green-text: "#166534"
  delivered-green-wash: "#dcfce7"
  caution-amber: "#d97706"
  caution-amber-text: "#92400e"
  caution-amber-wash: "#fef3c7"
  caution-amber-border: "#fde68a"
  failed-red: "#dc2626"
  failed-red-text: "#b91c1c"
  failed-red-wash: "#fee2e2"
  failed-red-border: "#fca5a5"
typography:
  display:
    fontFamily: "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "33px"
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 750
    lineHeight: "26px"
  title:
    fontFamily: "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "22px"
  body:
    fontFamily: "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  body-large:
    fontFamily: "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22.5px"
  input:
    fontFamily: "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
  button:
    fontFamily: "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  label:
    fontFamily: "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  figure:
    fontFamily: "Inter, Noto Sans Myanmar, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: "20px"
    fontFeature: "tnum"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.kiln-orange}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "0 24px"
  button-primary-pressed:
    backgroundColor: "{colors.kiln-orange-pressed}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.dispatch-navy}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "0 24px"
  button-dark:
    backgroundColor: "{colors.dispatch-navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "52px"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.dispatch-navy}"
    rounded: "{rounded.pill}"
    size: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.dispatch-navy}"
    typography: "{typography.input}"
    rounded: "{rounded.md}"
    height: "52px"
    padding: "12px 14px"
  status-chip-live:
    backgroundColor: "{colors.live-blue-wash}"
    textColor: "{colors.live-blue-text}"
    rounded: "{rounded.pill}"
    height: "28px"
  status-chip-delivered:
    backgroundColor: "{colors.delivered-green-wash}"
    textColor: "{colors.delivered-green-text}"
    rounded: "{rounded.pill}"
    height: "28px"
  status-chip-caution:
    backgroundColor: "{colors.caution-amber-wash}"
    textColor: "{colors.caution-amber-text}"
    rounded: "{rounded.pill}"
    height: "28px"
  status-chip-failed:
    backgroundColor: "{colors.failed-red-wash}"
    textColor: "{colors.failed-red-text}"
    rounded: "{rounded.pill}"
    height: "28px"
  status-chip-neutral:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary-subtle}"
    rounded: "{rounded.pill}"
    height: "28px"
  list-row:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.dispatch-navy}"
    rounded: "{rounded.lg}"
    height: "64px"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.dispatch-navy}"
    rounded: "{rounded.lg}"
    padding: "20px"
  sidebar-item-active:
    backgroundColor: "{colors.live-blue-wash}"
    textColor: "{colors.live-blue-text}"
    rounded: "{rounded.md}"
    height: "44px"
---

# Design System: Oern

## Overview

**Creative North Star: "The Dispatch Board"**

Oern looks like a well-run dispatch board. Every surface answers the question its user is asking right now: where is my parcel, what is my next stop, what needs a rider. The structure is navy and quiet, so state can speak. A single orange marks the one action that moves a delivery forward. Blue appears only where something is live or in motion: a route, a rider dot, an "On the way" chip. Green, amber and red are reserved for outcomes. Nothing is ornamental, and the map exists to support a decision, not as wallpaper.

Three roles share one token set but not one layout. Customers and riders get a phone-first shell: edge-to-edge on phones and centered at 480px above that, with 16px gutters, 48px targets, safe-area-aware bottom actions and labeled bottom tabs. Managers get the same language at desktop density: a white sidebar, a canvas work area, and white panels divided by hairlines instead of shadows. The app is light only: there is no dark theme, and the device's dark-mode setting does not change its colors.

The brand's warmth sits at the edges. The cheetah mascot and dashed route art appear on welcome, auth, loading and empty states. Illustrated icons (`public/icons`) appear on customer shortcuts and profile rows. Neither appears inside working surfaces, where state and figures take priority.

**Key Characteristics:**
- Navy structure, one orange action per screen, blue only for live things.
- Delivery state and COD payment state are always two separate signals.
- Flat surfaces separated by hairlines and tonal steps; shadows only on things that float over a map.
- Pill-shaped primary actions (56px) on phone flows; 12px-radius controls inside dense workspaces.
- Inter for Latin text, self-hosted Noto Sans Myanmar for Burmese, and tabular numerals for every time, count and amount.
- Mascot and illustration at the edges of a flow, never inside a working surface.

## Colors

The palette is cool and slate-based, with navy for structure, one warm orange for action, and a strict four-color semantic set for delivery state.

### Primary
- **Kiln Orange** (`kiln-orange`): the light-theme action color. Primary buttons, the "Track" lookup button, link text such as "Create an account", and the destination pin. White text on it passes AA.
- **Kiln Orange, Pressed** (`kiln-orange-pressed`): the pressed and hover state of Kiln Orange, and nothing else.
- **Signal Orange** (`signal-orange`): the brand mark itself. Used for the logo tile, the mascot's accents, the period in "oern." and decorative route art. Never put white small text on it.
- **Orange Wash** (`orange-wash`): the tint behind brand-flavored notices and the selected pickup option.

### Secondary
- **Dispatch Navy** (`dispatch-navy`): all primary text and headings, the driver marker, the navy button, the selected segment in a segmented control, completed timeline steps, and avatar fills. It carries the system's authority.

### Tertiary
- **Live Blue** (`live-blue`): the active route line, the rider dot, live-sharing indicators, input focus, and the active manager sidebar item (on **Live Blue Wash**, `live-blue-wash`, with **Live Blue Text**, `live-blue-text`). Blue always means "happening now".

### Semantic
- **Delivered Green** (`delivered-green`, text `delivered-green-text`, wash `delivered-green-wash`): delivered, COD collected, completed stops.
- **Caution Amber** (`caution-amber`, text `caution-amber-text`, wash `caution-amber-wash`, border `caution-amber-border`): assigned but not yet moving, delayed, COD due.
- **Failed Red** (`failed-red`, text `failed-red-text`, wash `failed-red-wash`, border `failed-red-border`): failed, cancelled, missed, blocked road, invalid fields.

Status tone mapping as shipped: pending is neutral; assigned and accepted are amber; picked up and in transit are blue; delivered is green; failed and cancelled are red.

### Neutral
- **Canvas** (`canvas`): the app background on every role. It is also the `theme-color`.
- **Surface** (`surface`): cards, sheets, inputs, the manager sidebar and top bar.
- **Surface Subtle** (`surface-subtle`): list rows on the customer home, grouped panels, and disabled field fills.
- **Hairline** (`hairline`): dividers and decorative card edges only.
- **Control Slate** (`control-slate`): input and secondary-button outlines, placeholders, and supporting text on white.
- **Slate Text** (`text-secondary-subtle`): supporting text on Surface Subtle, MUI `text.secondary`, and neutral chip text.
- **Focus ring:** a 3px Live Blue (`live-blue`) outline on buttons, links and fields, with a 2px offset. It shows keyboard focus only.

### Named Rules
**The One Orange Rule.** Each screen has at most one Kiln Orange fill. Secondary actions are outlined navy, and tertiary actions are underlined text. If two things are orange, one of them is wrong.

**The Blue Means Live Rule.** Live Blue is reserved for motion and live data: routes, rider position, sharing state and in-transit status. Never use it as a generic accent or for links.

**The Orange Is Not a Status Rule.** Orange never encodes delivery state. States use only the four semantic families plus neutral.

**The Subtle Text Rule.** Supporting text on Surface Subtle uses `#586579` (5.40:1 on `#f1f5f9`), because Control Slate `#64748b` gives only 4.34:1. Control Slate stays for borders, icons and text on white.

**The Decorative Grey Rule.** `#94a3b8` and Hairline are never used for text, placeholders, inactive icons or control boundaries. Use Control Slate for those.

## Typography

**Body Font:** Inter, self-hosted at weights 400, 500, 600 and 700 (`src/app/fonts`, exposed as `--font-inter`).
**Burmese Font:** Noto Sans Myanmar, self-hosted at weights 400, 600 and 700 (`--font-myanmar`), placed directly after Inter in every stack.
**Fallback:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`.

**Character:** A single neutral sans-serif carries the whole system. Hierarchy comes from weight and size, not from a second family. Headings use heavy weights (700–750) and slightly negative tracking. Labels stay sentence case so mixed Burmese and English reads naturally.

### Hierarchy
- **Display** (700, 30px/33px, −0.03em): auth and welcome headings ("Welcome back"), and manager page titles at desktop sizes.
- **Headline** (750, 20px/26px): app-bar greetings and section headings ("Today's deliveries").
- **Title** (700, 16px/22px): card titles, the stop name in the rider sheet, and sheet titles.
- **Body** (400, 14px/20px): the default size, set on `body`.
- **Body Large** (400, 15px/22.5px): lead paragraphs under a Display heading.
- **Input** (400, 16px/22px): every text input, at 16px so mobile browsers don't zoom on focus.
- **Button** (600, 16px/24px): primary and secondary buttons. Dense workspace buttons use 15px/20px.
- **Label** (500, 12px/16px): floating field labels, metadata, timestamps and footnotes. 12px is the floor for meaningful text.
- **Figure** (650, 14px, `tabular-nums`): ETAs, MMK amounts, counts and tracking codes. Manager KPIs scale the same treatment up to 28–32px at weight 700.

### Named Rules
**The Tabular Figures Rule.** Every time, amount, count and tracking code is set with `font-variant-numeric: tabular-nums`, so columns and live-updating ETAs don't shift.

**The Burmese Line Rule.** Burmese text uses a line-height of 1.6 (for example 14px/24px body, 12px/20px labels). Tag Burmese text with `lang="my"` or the `.lang-my` class so the rule applies. Latin line-heights clip stacked Burmese diacritics. Never give Burmese text a fixed-height container that is tighter than that line-height.

**The Burmese Fallback Rule.** Every font stack places `var(--font-myanmar)` directly after Inter. Never ship a stack without it, and never depend on a remote font for essential text.

**The Sentence Case Rule.** Labels, buttons and headings use sentence case. Uppercase is reserved for the small tracked section labels in the manager sidebar ("WORKSPACE").

## Layout

**Phone shell (customer, rider, seller and support on phones).** The base frame is 390×844. Layouts are tested at 320, 360, 390 and 430px. The shell is edge-to-edge below 480px and becomes a centered 480px column above that. Gutters are 16px. Bottom tab bars and bottom actions sit inside `env(safe-area-inset-bottom)`. The primary action is anchored to the bottom of the viewport on step flows (sign in, pickup steps, rider stop sheet), where the thumb is.

**Manager workspace.** A fixed white sidebar sits on the left (about 248px), with the logo, a "WORKSPACE" label, nav items with count badges, and an org switcher at the foot. To its right is a 72px top bar with update time, refresh and the account. The work area sits on Canvas with about 32px of padding. Content is a two-column grid: the primary column holds the KPI strip, live map and recent-deliveries table, and a narrower right rail (about 300px) holds the "Needs attention" and fleet summaries. On phones the sidebar becomes a fixed bottom nav.

**Rhythm.** Spacing follows a 4px-based scale (`--space-1` to `--space-8`: 4, 8, 12, 16, 20, 24 and 32px). Gaps between cards are 12–16px, card padding is 16–20px, and major sections are separated by 24px. List rows are separated by 8px.

**Targets.** `--target-min` is 48px. Every interactive control is at least 48×48. Primary phone actions are 52–56px tall. Adjacent targets are at least 8px apart.

### Named Rules
**The Thumb Zone Rule.** On phone flows, the action that advances the task lives in the bottom third of the screen. A primary action at the top of the screen is a layout bug.

**The Map Earns Its Space Rule.** Maps are full-bleed only when the user is navigating (rider) or following a live parcel (customer track). Anywhere else they are a bounded panel with a text or list alternative next to them.

## Elevation & Depth

Oern is flat by default. Depth comes from tonal steps (Canvas → Surface → Surface Subtle) and 1px Hairline edges, not from shadows. Shadows appear on one category of object: things that float over a map or slide over content.

### Shadow Vocabulary
- **Float** (`--rf-shadow-float`: `0 6px 18px -6px rgb(23 43 77 / 0.28), 0 2px 4px rgb(23 43 77 / 0.08)`): map controls, the turn card, and chips floating over the rider map.
- **Sheet** (`--rf-shadow-sheet`: `0 -10px 30px -12px rgb(23 43 77 / 0.3)`): bottom sheets rising over the map.
- **Whisper** (`0 1px 2px rgb(23 43 77 / 0.08)`): circular back buttons sitting on illustrated auth backgrounds.

Shadows are tinted with Dispatch Navy, never pure black.

### Named Rules
**The Float-Only Shadow Rule.** A shadow means "this sits above a map or above other content". Cards, list rows and panels resting on Canvas never get one.

## Shapes

Gently curved corners on a fixed scale: `--radius-sm` (8px) for small tags and inner icon tiles, `--radius-md` (12px) for inputs, workspace buttons and compact cards, `--radius-lg` (16px) for cards, list rows and manager panels, and `--radius-xl` (20px) for sheet tops and large hero panels. Pills (999px) are used for primary phone buttons, chips, segmented controls, tab indicators and circular icon buttons. Avatars and map dots are perfect circles.

Corner values outside 8, 12, 16, 20 and 999 (or 50%) are drift. Snap them to the nearest step.

Map markers combine shape and color. The rider is a navy arrow with a 2px white casing. The destination is an orange teardrop pin. The origin is a hollow slate circle. Completed stops are green checks. Multi-stop routes carry numbers.

## Components

### Buttons
Confident and unmissable on phones; compact and quiet in workspaces.
- **Shape:** full pill (999px) on phone flows and in MUI `Button`; 12px in dense manager and rider workspace rows.
- **Primary:** Kiln Orange fill, white 16px/600 text, 56px tall on phone flows (`.auth-screen-submit`, rider "I've arrived") and at least 48px everywhere. Pressed state is Kiln Orange Pressed. No elevation.
- **Secondary:** Surface fill with a 1px Control Slate outline and navy text, same height and shape as the primary it accompanies.
- **Navy:** Dispatch Navy fill with white text. Used for a strong non-brand action in workspaces.
- **Tertiary:** underlined navy text links ("Report a problem", "View delivery details") stacked under the primary. Each is a 48px target.
- **Focus:** 3px Live Blue outline with a 2px offset, shared by native and MUI controls. MUI focus ripples are disabled, so the ring is the only focus signal.
- **Disabled:** 55% opacity and `cursor: not-allowed`. Never color alone.

### Chips
- **Status chip:** a 28px pill with a semantic wash fill and the matching `-text` color (neutral uses a white fill with a Hairline border). Labels are short ("On the way", "Delivered"). Every status chip carries a 16px leading icon in the current text color, so meaning never rests on color alone.
- **COD chip:** always a separate chip next to the status chip, with a payments or coin icon and "COD · MMK 68,000" in amber. It never merges with delivery state.
- **Filter or parcel chip:** an outlined 1px Control Slate pill. When selected it becomes a Dispatch Navy fill with white text.

### Cards and list rows
- **List row (customer):** a Surface Subtle fill with 16px corners and no border, at least 64px tall. A 64px tabular time column on the left, the tracking code (700) and address (12px, one line) on the right, and chips below. A missed row switches to a Failed Red wash with a 1px red edge.
- **Shortcut tile:** a white tile with 16px corners, a 1px Hairline border, a 40px illustrated icon above a 15px/600 label, and a minimum height of 112px, laid out in a three-up grid.
- **Manager panel:** a white panel with 16px corners, a 1px Hairline border, 20px padding and no shadow. A 16px/700 title leads, with a muted count on the right. KPI cells are separated by vertical hairlines.

### Inputs and fields
- **Style:** a 52px minimum height, Surface fill, 1px Control Slate border, 12px corners, 16px text and 12px/14px padding. Labels stay visible: either a 14px/600 label above the field (`.field-label`, `.rf-field`) or the MUI floating label in 12px/500.
- **Focus:** a 3px Live Blue outline and a Live Blue border (MUI: a 2px Live Blue notched outline). The caret is Kiln Orange.
- **Error:** set through `aria-invalid="true"`, which gives a 2px Failed Red boundary plus a plain-language helper below the field.
- **Disabled:** a Surface Subtle fill with Control Slate text.
- **Single source:** native fields are styled in `src/app/form-fields.css` and MUI fields in `mui-provider.tsx`. Both follow this spec.

### Navigation
- **Phone bottom tabs:** four labeled destinations (customer: Home, Orders, Pickup, Profile). The selected tab gets an Orange Wash pill behind a Kiln Orange icon, with a navy label. Tabs hide on focused steps, which carry a back control instead.
- **Manager sidebar:** 15px/500 items with 20px line icons. The active item gets a Live Blue Wash pill with Live Blue Text in 600 weight. Neutral count badges are right-aligned.
- **Back control:** a 48px circular icon button with a navy arrow. It sits on a white 85% fill wherever it overlaps illustrated backgrounds.

### Rider stop sheet (signature)
A bottom sheet with 20px top corners and the Sheet shadow, rising over a full-bleed map. It opens with a grab handle, then shows a Kiln Orange eyebrow ("Stop 1 of 1 · Deliver parcel"), a 22–24px/700 recipient name, the address, then a 28px tabular Live Blue ETA with a confidence label and distance. A row of parcel and COD chips follows, then one full-width pill primary action, then two underlined tertiary links. A white turn card with the Float shadow sits at the top of the map, carrying a navy direction tile and a Live Blue "Directions" action.

### Mascot moments
The cheetah (`cheetah-run`) and the dashed blue-and-orange route art belong to welcome, sign in and sign up, loading, and empty states. They animate once on entry and respect `prefers-reduced-motion`. They never appear on a working list, form or map.

### Motion
State changes run at 120–240ms on `--rf-ease` (`cubic-bezier(0.16, 1, 0.3, 1)`). Sheets travel at 400ms. Live pulses are optional and are never the only status cue. Every keyframe animation has a `prefers-reduced-motion: reduce` fallback.

## Do's and Don'ts

### Do:
- **Do** reference tokens (`var(--color-*)`, `var(--radius-*)`, `var(--space-*)`) instead of repeating their hex or pixel values.
- **Do** pair every status color with a text label, and add an icon to every status chip. Status must survive color-vision deficiency.
- **Do** show COD as its own chip or panel, in MMK, beside the delivery status and never inside it.
- **Do** show the last-updated time and a stale-GPS state on every live map. Never invent a location or an ETA.
- **Do** let addresses, townships and landmarks wrap. Never truncate the only copy of an address.
- **Do** give every key screen loading, empty, error and permission-denied states, and keep cached data visible but labeled stale.
- **Do** confirm destructive actions and irreversible COD transitions in a dialog with an explicit label.

### Don't:
- **Don't** put two Kiln Orange fills on one screen, or use orange for any delivery status.
- **Don't** use Live Blue for links, decoration or non-live emphasis.
- **Don't** add shadows to cards or panels that rest on Canvas. Shadows are for floating map UI and sheets.
- **Don't** use corner radii outside 8, 12, 16, 20 or pill.
- **Don't** set meaningful text below 12px, or use `#94a3b8` or Hairline for text and control borders.
- **Don't** put white small text on Signal Orange (`#f97316`).
- **Don't** reintroduce the legacy forest-green and cream palette (`#275c49`, `#32443b`, `#fdf8e8`, `#d5aa4d`), which survives only in dead selectors.
- **Don't** make a swipe the only way to complete a critical action. Every swipe has a visible button alternative.
- **Don't** place the mascot or illustrations inside a working surface (lists, forms, maps, tables).

## Appendix: Customer app structure

The customer app is a mobile-first shell. Signed-in screens carry no logo.

- **Bottom tabs:** Home, Orders, Pickup, Profile. The tab bar shows on the four tab roots and hides on focused steps: order details, pickup steps 2–3, map selection and notifications. Every hidden-tab screen has a Back control that stays inside Oern.
- **Home:** a three-up shortcut grid (Request pickup, Track parcel, Help & support). If any deliveries are finished, a "Delivery history" row follows. Then "Today's deliveries": one row per active parcel with its ETA, tracking code, address, status chip and a COD chip when cash is due. Finished parcels never appear here.
- **Orders:** an Active / History segmented control. Search is scoped to the selected tab. History adds an outcome filter (Delivered, Failed, Cancelled) and is sorted by the latest terminal status event, falling back to the order's creation time. The tab, search and outcome live in the URL (`/orders?tab=history&q=…&outcome=failed`), so Back from a delivery restores them.
- **Track:** a tracking-code lookup (paste and scan) with the customer's own parcels as chips. A tracked parcel shows the map and a bottom summary (status, ETA, freshness, call and help). Route, progress timeline, parcel notes and COD sit behind labeled expandable sections. Stale GPS, missing location, delay and failure each get their own explanation and recovery action.
- **Pickup:** three steps: Addresses (`/pickup`), Parcel and contacts (`/pickup/details`), and Review and request (`/pickup/review`). The map screens read and write the same stored draft, so addresses, pins and contacts survive navigation, sign-in and failed requests. Each step has one primary action. The app describes the requested time as a request and never promises a time the data doesn't hold. Success shows the tracking code and a "View order" action.
- **Notifications:** one compact chronological list, newest first, with unread markers.
- **Help:** attached to the selected parcel. When no parcel is selected, an order picker comes first.
- **Profile:** a navy initials avatar, name and phone, then grouped rows (Delivery history, Notifications with an unread badge, Help and support) using the app's illustrations. Sign out is a separate centered button that asks for confirmation and reports failure. No control appears without working behavior behind it.
- **Sign-in and sign-up** return the customer to the task they started (`?next=`, same-origin paths only).
