# UX Study: OERN Pickup Flow (http://localhost:3000/pickup/*)

## Executive Summary

This study evaluates the customer-facing pickup request flow across all 4 steps:
1. **Route** (`/pickup`) - Pickup and delivery address entry
2. **Details** (`/pickup/details`) - Parcel information and pickup time
3. **Payment** (`/pickup/payment`) - Delivery fee and payment method selection
4. **Review** (`/pickup/review`) - Final confirmation and order submission

**Study Date**: October 23, 2026  
**Platform**: Web (mobile-first, 390×844 frame)  
**Design System**: OERN (Navy + Orange + Blue for live)

---

## User Scenarios Tested

### Scenario 1: First-Time Pickup Requestor (Jordan - Confused First-Timer)
- **Goal**: Request a door-to-door pickup for the first time
- **Entry Point**: Customer home screen → Tap "Request pickup"
- **Expected Path**: 
  - Manually enter or search pickup address
  - Enter delivery destination
  - View fee estimate in real-time
  - Select parcel category and size
  - Choose pickup window (today, tomorrow, etc.)
  - Add sender contact details
  - Review total cost and payment method
  - Submit order with confirmation
- **Pain Points**: Jargon, unclear next steps, missing validation feedback, form complexity

### Scenario 2: Power User / Repeat Customer (Alex - Impatient Power User)
- **Goal**: Quickly re-request similar pickups with minimal friction
- **Expected Features**: 
  - Autofill previous addresses
  - Recent contacts/favorites
  - One-click pickup options
  - Keyboard shortcuts
- **Pain Points**: Forced tutorials, required confirmations, slow animations, redundant steps

### Scenario 3: Mobile-First User on the Go (Casey - Distracted Mobile User)
- **Goal**: Request a pickup while commuting/interrupted
- **Context**: One-handed phone use, limited attention, susceptible to interruptions
- **Expected**: 
  - Bottom-anchored primary actions
  - State persistence through app switches
  - Fast load times
  - Minimal typing
- **Pain Points**: Top-anchored buttons, lost progress on interruption, heavy assets, 44×44 targets

### Scenario 4: Accessibility-Dependent User (Sam - Screen Reader User)
- **Goal**: Complete pickup request using keyboard and screen reader
- **Expectations**:
  - Full keyboard navigation
  - Meaningful ARIA labels
  - Announce state changes
  - Adequate color contrast
- **Pain Points**: Icon-only navigation, missing labels, focus management, color-dependent UI

### Scenario 5: Stress Tester / Edge Case Finder (Riley - Methodical Tester)
- **Goal**: Explore edge cases and error conditions
- **Test Cases**:
  - Very long address strings
  - Special characters and emojis
  - Unicode (Burmese text)
  - Submit with empty optional fields
  - Navigation back/forward
  - Refresh mid-flow
  - Multi-tab simultaneous requests
- **Pain Points**: Unhandled errors, lost data, broken state recovery

### Scenario 6: Accessibility + Mobile (Sam + Casey)
- **Goal**: Use pickup flow on mobile with screen reader
- **Specific Needs**: Bottom tabs, thumb zone actions, clear link announcements
- **Pain Points**: Unreachable buttons, swipe-only actions, tapping errors

---

## Current Flow Analysis

### Flow Structure
```
┌─────────────────────────────┐
│ Step 1: Route (Addresses)    │ ← Starts at /pickup
│ ┌───────────────────────────┐│
│ │ Pickup address search      ││
│ │ [Use my location] [on map] ││
│ │ Delivery address search    ││
│ │ [Use my location] [on map] ││
│ │ Fee estimate (locked)      ││
│ │ ┌─────────────────────────┐││
│ │ │ [Next: parcel & contacts]│││ ← Bottom-pinned action
│ │ └─────────────────────────┘││
│ └───────────────────────────┘│
└──────────────┬────────────────┘
               ↓
┌─────────────────────────────┐
│ Step 2: Details              │ ← /pickup/details
│ ┌───────────────────────────┐│
│ │ Parcel kind (dropdown)     ││
│ │ Size (toggle group)        ││
│ │ Weight / custom (if needed)││
│ │ Description                ││
│ │ Pickup window (date/time)  ││
│ │ Sender contact             ││
│ │ ┌─────────────────────────┐││
│ │ │[Next: delivery fee]     │││ ← Bottom-pinned
│ │ └─────────────────────────┘││
│ └───────────────────────────┘│
└──────────────┬────────────────┘
               ↓
┌─────────────────────────────┐
│ Step 3: Payment              │ ← /pickup/payment
│ ┌───────────────────────────┐│
│ │ Fee breakdown (card)       ││
│ │ Who pays? (toggle)         ││
│ │ When? (radio buttons)      ││
│ │ Coupon / rewards           ││
│ │ ┌─────────────────────────┐││
│ │ │[Review & request]       │││ ← Bottom-pinned
│ │ └─────────────────────────┘││
│ └───────────────────────────┘│
└──────────────┬────────────────┘
               ↓
┌─────────────────────────────┐
│ Step 4: Review               │ ← /pickup/review
│ ┌───────────────────────────┐│
│ │ Pickup address            ││
│ │ Delivery address          ││
│ │ Parcel description        ││
│ │ Pickup window (confirm)   ││
│ │ Total MMK + payment method││
│ │ ┌─────────────────────────┐││
│ │ │[Send pickup request]    │││ ← Bottom-pinned
│ │ └─────────────────────────┘││
│ │ [Edit any step as links]   ││
│ └───────────────────────────┘│
└─────────────┬────────────────┘
              ↓
        Order Confirmed!
    (Shows tracking code)
```

### State Management
- Draft stored in localStorage (persists across navigation, sign-in, page refresh)
- Each step validates independently before allowing forward navigation
- Back button available on all steps (except step 1 when entering the flow)
- Addresses and fees are cached/memoized to prevent re-calculation

---

## UI Component Inventory

### Address Fields (Steps 1)
- **Autocomplete with map integration**
  - Search by text (supports Burmese + English)
  - "Use my location" button (requires GPS permission)
  - "Pick on map" button (navigates to map picker)
  - Address preview below input
  - Error states for geocoding failures

### Parcel Options (Step 2)
- **Kind selector**: Dropdown (Food, Electronics, Fashion, Documents, Other)
- **Size selector**: Toggle group (XS, S, M, L, XL)
- **Weight field**: Number input (only for XL parcels)
- **Description**: Text area (max 300 chars)
- **Pickup window**: Date + Time selectors
- **Sender contact**: Phone + Name fields

### Fee Display (Steps 1 & 3)
- **Locked card on Step 1**: Shows estimate only when both addresses set
- **Detailed card on Step 3**: 
  - Distance in km
  - Base fee + distance charge
  - Coupon applied (if any)
  - Total in MMK (tabular numerals)

### Payment Options (Step 3)
- **Who pays?**: 2-segment toggle (Sender / Recipient)
- **When?**: 3 radio options
  - Before pickup
  - After delivery
  - Cash on delivery (COD)
- **Coupon input**: Text field with validate button
- **Rewards**: If user has balance, show discount option

### Navigation
- **Bottom tabs** on home/orders/profile screens (hidden on pickup steps)
- **Back control** (48×48 navy arrow) on all focused steps
- **Tab bar hides** when keyboard is open or on payment/review steps
- **Progress indicator** in header (Step X of 4)

---

## Design System Compliance Checklist

### Color Usage
- [ ] Navy structure throughout
- [ ] Single orange action per screen ("Next" buttons)
- [ ] Blue only for live things (none in pickup - appropriate)
- [ ] Semantic colors for status (not applicable in request flow)
- [ ] Error states use red (#dc2626)

### Typography
- **Display**: None (not needed in pickup)
- **Headline** (20px/750): Step title ("Pickup and delivery")
- **Title** (16px/700): Field labels and card titles
- **Body** (14px/400): Default text
- **Button** (16px/600): Primary and secondary actions
- **Label** (12px/500): Helper text, hints, metadata
- **Figure** (14px/650, tabular-nums): MMK amounts, distances

### Spacing & Layout
- **Gutters**: 16px on phone, centered at 480px+ ✓
- **Card padding**: 16-20px ✓
- **Gap between sections**: 16-24px
- **Bottom action safe area**: Fixed above keyboard, inside safe-area-inset-bottom ✓

### Components
- **Primary buttons**: 56px pill, Kiln Orange, white text ✓
- **Secondary buttons**: Navy outline, full width ✓
- **Input fields**: 52px min height, 12px radius, 16px text ✓
- **Toggle group**: Navy fill when selected ✓
- **Chips**: 28px pill, semantic fills ✓
- **Focus ring**: 3px blue outline, 2px offset ✓

---

## Key Findings (Preliminary - Pending Detector)

### Strengths Observed
1. **Clear step-by-step progression** with visual indicators
2. **Smart address autocomplete** with map + location fallbacks
3. **Real-time fee calculation** keeps users informed
4. **Draft persistence** enables interrupted workflows
5. **Accessible form structure** with labels and error messaging

### Potential Issues
1. **Cognitive Load**: 4 full-screen forms may overwhelm first-timers
2. **Mobile responsiveness**: Verify 48px touch targets across all buttons
3. **Error recovery**: What happens if geocoding fails silently?
4. **COD vs. payment state**: Is this clearly separated per design rules?
5. **Keyboard handling**: Do text fields trigger unwanted keyboard on mobile?
6. **State persistence**: What if user bookmarks step 2 and returns?
7. **Parcel category UX**: Is "Dropdown" the right pattern for 5 options? (Working memory: ≤4)
8. **Burmese text support**: Noto Sans Myanmar fallback verified?

### Nielsen Heuristics Initial Assessment
(Pending detailed Assessment A from subagent)
- **Visibility**: Draft saved, fee shown, progress indicated ✓
- **Match real world**: Myanmar-centric (Yangon, MMK, Burmese fonts) ✓
- **User control**: Back buttons, edit links on review ✓
- **Consistency**: All steps follow same layout shell
- **Error prevention**: Validation before next, but unclear what's required
- **Recognition**: Autocomplete and map help, but dropdown hierarchy unclear
- **Efficiency**: No shortcuts, bulk actions not applicable
- **Aesthetic**: Clean, minimal, follows navy + orange rule
- **Error recovery**: ?
- **Help**: No contextual help visible; might need tooltips

---

## Accessibility Review (Preliminary)

### WCAG 2.1 AA Compliance Risks
- [ ] **Focus visible**: Must verify blue ring appears on all controls
- [ ] **Color contrast**: Navy on white, white on orange (5.97:1 ✓)
- [ ] **Form labels**: All inputs have associated labels
- [ ] **Error messages**: Inline, near source
- [ ] **Skip links**: None visible; may not be needed on mobile form
- [ ] **Keyboard navigation**: Tab order, Enter/Escape handling
- [ ] **Screen reader**: ARIA labels on custom components
- [ ] **Touch targets**: 48px minimum (check dropdown, toggles, buttons)

### Specific Concerns
- Icon buttons ("Use my location", "Pick on map") must have text labels or aria-label
- Toggle group selections must announce state change
- Autocomplete suggestions must be keyboard-accessible
- Date/time pickers: native vs. custom implementation?
- Text area character count feedback for screen readers

---

## Performance Considerations

### Load Time
- Maps library (Mapbox?) loaded on demand?
- Geocoding calls debounced?
- Images: Are there any? Check orange wash backgrounds, illustrations

### Mobile
- Viewport: 390×844, safe-area-inset handled
- Keyboard: Does it push content up or overlay?
- Bottom action: Fixed positioning correct?
- Scroll: Smooth, no jank on re-layout

### State
- LocalStorage size: How large is the draft JSON?
- Sync across tabs: If user opens /pickup in two tabs, what happens?
- Session timeout: If JWT expires mid-flow, is draft saved?

---

## Questions for Further Testing

1. **Empty state on step 1**: User sees form but no examples. Does autocomplete menu appear before typing?
2. **Map picker UX**: Can user search for address on the map screen, or just tap?
3. **Parcel categories**: Is "Other" clear enough? Does it branch to custom description?
4. **Time slots**: Are available windows shown for the chosen date, or is it free-form entry?
5. **COD flow**: If user selects COD on step 3, does the review show a clear "will pay at delivery" state?
6. **Form validation**: Are all fields required? What's the minimum viable request?
7. **Success state**: After submitting, does app show tracking code, or just a success banner?
8. **Back from success**: Can user edit the order, or start a new one?
9. **Network failure**: If submit fails, is draft preserved? Can user retry?
10. **Unverified phone**: Does app verify sender phone before allowing request?

---

## Recommendations (To Be Refined)

### High Priority (P0-P1)
- [ ] Verify all touch targets are ≥48×48
- [ ] Confirm blue focus rings visible on all interactive elements
- [ ] Test date/time picker on real mobile devices
- [ ] Validate Burmese text rendering on different fonts
- [ ] Check map integration latency and error states

### Medium Priority (P2)
- [ ] Reduce parcel kind options or move to secondary menu (working memory)
- [ ] Add contextual help ("Why do we need this?") for optional fields
- [ ] Consider progressive disclosure for advanced options
- [ ] Test keyboard-only navigation end-to-end
- [ ] Verify draft recovery after app crash/refresh

### Low Priority (P3)
- [ ] Add animations on step transitions
- [ ] Celebrate successful submission (micro-interaction)
- [ ] Consider voice input for address fields
- [ ] Optimize images/assets for slow networks

---

## Awaiting Detailed Assessment

**Assessment A (Design Review)** from subagent b1cd864d-b536:
- Detailed heuristic scores (1-10)
- Persona-specific red flags
- Emotional journey analysis
- Cognitive load detailed checklist

**Assessment B (Detector + Browser)** from subagent 6ce08a5d-48db:
- CLI detector findings with file:line locations
- Browser overlay violations
- Console warnings
- False positives identified

---

## Test Environment

**App URL**: http://localhost:3000/pickup  
**View**: Mobile (390×844) Chrome/Safari  
**Device**: Desktop browser (DevTools mobile emulation)  
**Test Account**: Customer role (authenticated)  
**Sample Data**: 
- Pickup: 42 Pyay Road, Kamayut
- Delivery: 12 Baho Road, Sanchaung
- Parcel: Food, Medium
- Time: Today, 8 am

---

*This study is a working document. Final heuristic scores and detector findings will be added once Assessment A and B complete.*
