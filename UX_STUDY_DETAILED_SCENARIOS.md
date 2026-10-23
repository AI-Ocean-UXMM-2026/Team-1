# UX Study: Detailed User Scenario Walkthroughs
## OERN Pickup Flow (http://localhost:3000/pickup/*)

---

## Scenario 1: First-Time Pickup User - "Jordan" (Confused First-Timer)

### Goal
Request a delivery for the first time without prior knowledge of the system.

### Entry Point
- **Where**: Customer home screen (/) or direct navigation to /pickup
- **Trigger**: Taps "Request a pickup" shortcut OR bottom tab "Pickup"

### Walk-Through

#### Step 1: Route - "Pickup and delivery"
**Jordan's Mental Model**: "I need to tell the app where to pick up and drop off"

**What they see**:
- Header: "Step 1 of 4 — Pickup and delivery"
- Two autocomplete fields stacked
- Two buttons per field: "Use my location" and "[kind] on map"
- Fee estimate card below (likely says "Pick a suggestion, use your location or choose a spot on the map...")

**Potential Friction Points**:
1. **Unclear label scope**: Is "Pickup address" the place to pick UP FROM, or where to PICK UP FOR?
   - *Implied intent*: "Pick this parcel up from HERE"
   - *Risk*: First-timers reverse the fields
   - *Fix*: Contextual tooltip or explicit "from" phrasing

2. **GPS permission gate**: "Use my location" requires permission
   - If denied, button doesn't re-enable or explain why
   - *Risk*: User thinks button is broken
   - *Expected*: Permission denied → show permission denied state + help

3. **Autocomplete UX**:
   - Does menu appear on focus or on first character?
   - Are suggestions Myanmar addresses or just any text?
   - *Risk*: If no menu appears, user thinks it's broken
   - *Expected*: Empty state → user starts typing → suggestions appear

4. **Map picker navigation**: "Pickup on map" → what screen appears?
   - Is it /pickup/map or /pickup/map/pickup (symmetric with /pickup/map/delivery)?
   - Can user search on the map, or only tap?
   - *Risk*: If they can't search, finding an address on a map is tedious
   - *Expected*: Map with search + zoom/pan + tap to set

5. **Fee estimate card**:
   - Shows placeholder text until BOTH addresses are set
   - *Risk*: User thinks form is broken if fee doesn't appear
   - *Expected*: Show progress ("1 of 2 addresses set")

**Jordan's Action**:
- Taps pickup field
- Types "42 Pyay Road" → autocomplete shows 3-5 suggestions
- Selects first one (success)
- Delivery field → types "Baho" → selects suggestion
- Fee estimate appears: "MMK 5,000"
- Reads fee, nods, taps "Next: parcel and contacts"

**Outcome**: ✓ Success (expected behavior matches)

---

#### Step 2: Details - "Parcel and contacts"
**Jordan's Mental Model**: "Tell the app what I'm sending and when to pick it up"

**What they see**:
- Header: "Step 2 of 4 — Parcel and contacts"
- Dropdown: "Parcel kind" (Documents, Clothing, Food, Electronics, Other)
- Toggle group: Size (Small / Medium / Large)
- Text field: "Description" with character count (0/300)
- Date selector: "Today" vs "Tomorrow"
- Time picker: 3 buttons (Morning, Afternoon, Evening)
- Phone field: "Sender phone"
- Name field: "Sender name"
- Red inline errors if any field is invalid

**Potential Friction Points**:

1. **Parcel kind dropdown**:
   - Shows 5 options: Documents, Clothing, Food, Electronics, Other
   - *Issue*: 5 options = exceeds working memory threshold (Miller's law: ≤4)
   - *Risk*: User might pick "Other" just to avoid deciding
   - *Expected*: Group options (Documents & Small Items | Fashion | Food & Drink | Tech | Other)
   - *Real risk*: If user picks "Food" but it's not hot food, there's no sub-category

2. **Food preset UX** (if food is selected):
   - Code shows `foodPresets`: 7 specific options (Hot Soup, Tea Shop, Shan Noodles, etc.)
   - *Question*: Are these shown as radio buttons or do they replace the kind field?
   - *Risk*: If they're additional options, the form gets more complex
   - *Expected*: Cleaner UX if "Kind: Food" → sub-step → choose preset

3. **Description field** (optional?):
   - Max 300 chars is fine
   - *Question*: Is this field required or optional?
   - *Risk*: If required, "What do I write?" for generic items
   - *Expected*: Hint text ("E.g., 'Box of documents', 'Clothing item', 'Food order'")

4. **Size toggle**:
   - Small / Medium / Large with hints ("Fits a bag", "Fits a box", "Bulky")
   - *Concern*: Hints are helpful but vague for first-timers
   - *Risk*: User picks wrong size → fee recalculation → confusion
   - *Expected*: Success if fees don't change much between sizes

5. **Date/Time picker**:
   - "Today" or "Tomorrow" (binary choice, not a date picker)
   - Time: 3 buttons (Morning 8am–12pm, Afternoon 12–5pm, Evening 5–8pm)
   - *Concern*: Limited windows; what if user needs 6pm pickup?
   - *Risk*: User selects "Evening" but needs something specific
   - *Expected*: Design intent is simplicity; user can adjust at /track later

6. **Sender contact**:
   - Phone field: is this pre-filled with logged-in user's phone?
   - Name field: is this pre-filled with user's name?
   - *Risk*: If not, user has to re-type info they already gave the app
   - *Expected*: Fields autofilled from profile → user can edit

**Jordan's Action**:
- Parcel kind: Selects "Food" (for lunch delivery)
- Size: Selects "Small" (fits a bag)
- Description: Leaves blank or types "Lunch order"
- Date: Selects "Today"
- Time: Selects "Morning" (wants 8–12pm)
- Sender phone: Pre-filled with "09123456789" ✓
- Sender name: Pre-filled with "Jordan" ✓
- Taps "Next: delivery fee"

**Outcome**: ✓ Success (expected)

---

#### Step 3: Payment - "Delivery fee"
**Jordan's Mental Model**: "How much will this cost and how will I pay?"

**What they see**:
- Header: "Step 3 of 4 — Delivery fee"
- Fee breakdown card:
  - Base fee: MMK 2,000
  - Distance charge: MMK 3,000 (for ~3 km)
  - Subtotal: MMK 5,000
  - (No coupon applied yet)
  - **Total: MMK 5,000** (large, bold, tabular numerals)
  
- "Who pays?" Toggle:
  - Sender (selected by default)
  - Recipient
  
- "When?" Radio group (3 options):
  - [ ] Before pickup (pay now, locked to card, Stripe, etc.)
  - [ ] After delivery (pay later from Track, same methods)
  - [x] Cash on delivery (rider collects at destination)
  
- Coupon input: "Have a coupon code?"
  - Text field + "Apply" button
  
- Rewards (if user has balance):
  - Checkbox: "Use X points to reduce fee by MMK Y"

**Potential Friction Points**:

1. **Payer toggle**:
   - Two options: Sender vs Recipient
   - *Concern*: What if the recipient is unknown? Can I send to "any phone number"?
   - *Risk*: User might skip this and assume recipient is the person they're sending to
   - *Expected*: Design clarifies recipient role (in /pickup/details or here)

2. **Payment method selection**:
   - "Before pickup" implies Stripe card payment
   - "After delivery" implies Stripe card payment
   - "Cash on delivery" is self-explanatory
   - *Concern*: Are payment methods stored? Or does user enter card every time?
   - *Risk*: If no saved cards, user friction is high
   - *Expected*: Saved cards OR wallet balance OR COD

3. **COD as separate state**:
   - Per DESIGN.md: "COD chip: always a separate chip next to the status chip"
   - *Question*: On the fee card, is COD shown separately from "Payment method"?
   - *Expected*: Fee displays normally; COD is a separate badge/state
   - *Real risk*: If COD is not visually distinct, user might miss it

4. **Coupon code input**:
   - User types code (e.g., "WELCOME50")
   - Taps "Apply"
   - What happens if code is invalid?
     - *Option A*: Error message inline ("Code not found")
     - *Option B*: Silently fails (bad UX)
     - *Option C*: Shows loading spinner, then error
   - *Risk*: Unclear if code was accepted
   - *Expected*: Clear success/error feedback

5. **Points redemption**:
   - If user has 500 points worth MMK 1,000
   - Checkbox to use points
   - Fee drops to MMK 4,000 (if coupon not applied)
   - *Question*: Can user combine coupon + points?
   - *Risk*: If not allowed, it should be clear WHY
   - *Expected*: Points visible, toggle easy to understand

**Jordan's Action**:
- Sees fee breakdown (MMK 5,000 total)
- Payer: Keeps "Sender" selected
- Payment: Selects "Cash on delivery" (easier than card details)
- Coupon: Has no code, skips
- Points: Doesn't have any balance, skips
- Taps "Review & request"

**Outcome**: ✓ Success (expected)

---

#### Step 4: Review - "Review and request"
**Jordan's Mental Model**: "Double-check everything before I send this"

**What they see**:
- Header: "Step 4 of 4 — Review and request"
- Summary sections (each collapsible?):
  - **Pickup**: 42 Pyay Road, Kamayut | [Edit]
  - **Delivery**: 12 Baho Road, Sanchaung | [Edit]
  - **Parcel**: Food, Small | [Edit]
  - **Pickup window**: Today, 8am–12pm | [Edit]
  - **Sender**: Jordan, 09123456789 | [Edit]
  - **Cost**: MMK 5,000 (Pay cash at delivery) | [Edit]
  
- Primary action: "Send pickup request" (orange pill, 56px)
- Error handling: If form submission fails, show error message + "Retry" button

**Potential Friction Points**:

1. **Edit links**:
   - Tapping "[Edit]" next to Pickup takes user to /pickup (step 1)
   - User makes a change, taps "Next" → returns to step 4
   - *Concern*: State is preserved in draft (localStorage), so this works ✓
   - *Expected*: Seamless edit flow

2. **Recipient name/phone missing**:
   - Is this required?
   - *Risk*: If user didn't enter it on step 2, they can't edit it from review
   - *Expected*: [Edit] link takes them back to step 2 where they can add it

3. **Sending state**:
   - User taps "Send pickup request"
   - Button becomes disabled/loading ("Sending…")
   - API call: POST /api/orders or similar
   - *Risk*: If request takes 5+ seconds, user might tap multiple times
   - *Expected*: Button disabled during submission, then success/error shown

4. **Success state**:
   - After successful submission, what does user see?
   - *Option A*: Confirmation page with tracking code ("Your order: OERN-20261023-00123")
   - *Option B*: Banner overlay ("Order submitted! View details →")
   - *Option C*: Redirect to /orders (list view)
   - *Risk*: If no clear confirmation, user might re-submit
   - *Expected*: Clear tracking code visible for sharing/saving

5. **Error recovery**:
   - If submission fails (network, validation, etc.)
   - *Expected*: Error message + "Try again" button
   - User taps "Try again" → resubmits
   - *Risk*: If API was slow and first request succeeded silently, duplicate order created
   - *Expected*: Idempotent API (same request key prevents duplicates)

**Jordan's Action**:
- Reviews all details ✓
- Taps "Send pickup request"
- Sees loading spinner
- After 2 seconds: Success page shows "Your pickup request has been sent! Tracking: OERN-20261023-00123"
- Taps "View order" or notices bottom nav shows updated order count

**Outcome**: ✓ Success (expected)

---

## Scenario 2: Power User - "Alex" (Impatient Expert)

### Goal
Request a similar pickup to one done yesterday, in under 1 minute.

### Walk-Through

**Expected Ideal**:
- Visit /pickup
- See previous addresses autofilled
- Previous parcel category/size remembered
- Tap "Use previous request as template"
- Quick edit of just the time window
- Tap "Send"
- Done

**Actual Current**:
- Step 1: Pickup address field is empty ❌
  - *Why*: Draft might be cleared after submission
  - *Alex's reaction*: "Ugh, I have to type this again?"
  - *Workaround*: Browser autofill (manual entry or address bar history)
  
- Step 1: Delivery address also empty ❌
- Step 1: Alex types "42" in pickup field
  - Autocomplete suggestions appear
  - Alex arrow-keys down, presses Enter
  - Pickup address filled ✓
  
- Step 1: Similar for delivery address ✓

- Step 2: All fields empty ❌
  - Kind, Size, Time, Sender — all need re-entry
  - *Alex's reaction*: "This should remember from last time"
  
- *Question*: Is there a "Recent orders" view showing previous requests?
  - If yes, user could duplicate from /orders
  - If no, user has to re-enter everything

**Alex's Frustration Points**:
- No duplicate/template feature
- No pre-fill from last order
- No bulk-entry (paste addresses at once)
- No keyboard shortcuts (e.g., "D" to duplicate)
- Required form inputs that don't change often

**Recommended Quick Wins**:
1. ✓ Remember previous addresses in draft (in localStorage)
2. ✓ Remember previous parcel kind/size
3. ✓ Add "Duplicate this order" button on /orders detail view
4. ✓ Add keyboard shortcut to skip confirmation ("Ctrl+Enter" to submit)
5. ✓ Show recent addresses as chips at top of step 1

---

## Scenario 3: Mobile User on the Go - "Casey" (Distracted Mobile)

### Goal
Request a pickup while commuting by motorcycle, one-handed, with frequent interruptions.

### Context
- Device: Mobile phone, 390px wide
- Position: Holding phone in left hand
- Thumb zone: Bottom ~150px of screen reachable easily
- Attention: 30-second windows between messages/notifications

### Walk-Through

#### Step 1 Issues

**Bottom action placement**:
- Primary button "Next: parcel and contacts" is fixed at bottom ✓
- On step 1, it sits ABOVE the tab bar (good for thumb zone) ✓
- *Question*: If keyboard appears, does button move up or stay fixed?
  - *Risk*: Keyboard covers button, user has to swipe to dismiss keyboard first
  - *Expected*: Button stays above keyboard, content scrolls

**Address field input**:
- User taps pickup address field → keyboard appears
- Keyboard takes up bottom 50% of screen
- Fee card is now hidden
- *Risk*: User can't see if their addresses are filled until they dismiss keyboard
- *Expected*: Autocomplete suggestions appear above keyboard

**Autocomplete touch targets**:
- Suggestion list items: are they ≥44×44?
- *Risk*: Tiny tappable area causes mis-taps
- *Expected*: Each suggestion is a comfortable 56px height

#### Step 2 Issues

**Dropdown for parcel kind**:
- On mobile, MUI Autocomplete/Select opens as a menu
- *Question*: Does it open as an overlay modal or as a native picker?
- *Risk*: If overlay, it covers other content and might be hard to dismiss
- *Expected*: Native picker on iOS (UIPickerViewController), overlay on Android

**Date picker**:
- "Today" or "Tomorrow" buttons (easy, ≥48px) ✓
- Time: 3 buttons (Morning/Afternoon/Evening, ≥48px) ✓
- *Good*: No date/time picker modal needed, everything is tap-able

#### Step 3 Issues

**Toggle buttons**:
- "Who pays?" toggle: Sender | Recipient
- Tap size: ≥44×44? (likely yes, MUI toggle buttons are usually 48px)
- *Risk*: If gap between toggles is <8px, accidental taps on wrong one
- *Expected*: 8px minimum gap

**Radio buttons**:
- "When to pay?" has 3 radio options
- On mobile, radio circles are tiny
- *Risk*: User taps the label text, not the radio circle, and it doesn't register
- *Expected*: Entire row is tappable (label + radio circle)

**Coupon input + button**:
- Text field + "Apply" button side-by-side
- *Question*: On 390px phone, is there room for both?
- *Risk*: If stacked vertically, it's not a deal-breaker, but less convenient
- *Expected*: Input takes up ~70%, button ~30% (or full-width input with button below)

#### Step 4 Issues

**Review summary**:
- Edit links scattered through the summary
- User accidentally taps an edit link and navigates away
- System preserves draft (localStorage) ✓
- User goes back to step 4 (how? back button or explicit return?)
- *Expected*: Back button works, user returns to step 4

**Network interruption**:
- User completes review and taps "Send pickup request"
- Network drops (switching from WiFi to cellular)
- Request hangs for 30 seconds
- User gives up, navigates away
- Later: Did the request send? Or is it still pending?
- *Expected*: Clear loading state + timeout message + "Retry" button
- *Risk*: If no timeout, user waits forever

### Casey's Experience Summary

**Best moments**:
- ✓ Bottom-pinned actions easy to tap while holding
- ✓ No excessive modals or complex interactions
- ✓ Draft preserved through app switching

**Worst moments**:
- ❌ Keyboard covers fee preview on step 1
- ❌ Dropdown menu might be hard to dismiss on mobile
- ❌ Coupon input might not fit well on 390px
- ❌ No timeout feedback if network is slow

---

## Scenario 4: Accessibility User - "Sam" (Keyboard + Screen Reader)

### Goal
Complete the pickup request using only keyboard navigation and VoiceOver (iOS) or NVDA (Windows).

### Assistive Tech Setup
- Input method: Keyboard only (no mouse)
- Screen reader: VoiceOver (iOS Safari) or NVDA (Windows)
- Zoom: 100% (default)

### Walk-Through

#### Step 1: Route

**Expected ARIA**:
```html
<label for="pickup-address">Pickup address</label>
<input id="pickup-address" type="text" aria-label="Pickup address" />
```

**Keyboard navigation**:
- User presses Tab → Focus moves to pickup address field
- Screen reader announces: "Pickup address, text field"
- User types address
- Autocomplete menu appears
  - *Question*: Does screen reader announce the menu?
  - *Expected*: "Suggestions menu, 5 items. Use arrow keys to navigate."
- User presses Down arrow → Screen reader announces first suggestion
- User presses Enter → Suggestion inserted, focus returns to field

**Potential Issues**:
1. **Autocomplete menu not announced**:
   - *Risk*: Screen reader user doesn't know menu appeared
   - *Expected*: `aria-expanded="true"` on input + `role="listbox"` on menu

2. **"Use my location" button**:
   - Button text is clear ("Use my location")
   - *Good*: Not icon-only
   - *Question*: On long press, does browser read long-press tooltip?
   - *Risk*: If no aria-label, user knows button exists but not its function
   - *Expected*: Button well-labeled

3. **"Pickup on map" button**:
   - Navigates to /pickup/map
   - *Issue*: For keyboard/screen-reader user, map interaction is hard
   - *Expected*: Alternative input method (search field on the map)

4. **Fee estimate section**:
   - `<section aria-label="Delivery fee estimate">`
   - Screen reader announces section, user can navigate into it
   - *Question*: Can user tab through the fee breakdown, or is it read-only?
   - *Expected*: Read-only, announced on load

#### Step 2: Details

**Dropdown (Parcel kind)**:
- *Question*: Is this a native `<select>` or a custom MUI Autocomplete?
- If `<select>`:
  - ✓ Keyboard works (Down/Up to navigate, Enter to select)
  - ✓ Screen reader announces options
  
- If MUI Autocomplete:
  - *Risk*: Custom behavior might not work well with screen readers
  - *Expected*: `aria-haspopup="listbox"`, `aria-expanded`, `role="combobox"`

**Toggle buttons (Size)**:
- "Small" / "Medium" / "Large" toggle group
- *Question*: How is selection announced?
  - *Expected*: "Small, toggle button, selected" (if VoiceOver)
  - *Risk*: If no aria-pressed, screen reader doesn't announce selection
  - *Expected*: `aria-pressed="true/false"` on each button

**Date/Time buttons**:
- "Today" or "Tomorrow"
- "Morning" / "Afternoon" / "Evening"
- *Question*: Are these toggle buttons or radio buttons?
- *Expected*: Clear selection state announced

**Phone & Name fields**:
- Standard text inputs ✓
- *Good*: Likely have labels
- *Question*: Is autofill from profile obvious?
- *Expected*: Field is autofilled, user can edit

#### Step 3: Payment

**Toggle (Who pays)**:
- "Sender" / "Recipient"
- *Question*: How is selection announced?
- *Expected*: "Sender, toggle button, selected"

**Radio buttons (When)**:
- 3 options: Before pickup, After delivery, Cash on delivery
- *Question*: Are these native `<input type="radio">` or custom?
- If native:
  - ✓ Space bar to select
  - ✓ Arrow keys to navigate
  - ✓ Screen reader announces selected option
  
- If custom:
  - *Risk*: Keyboard + screen reader behavior unpredictable
  - *Expected*: `role="radio"`, `aria-checked`, `tabindex`

**Coupon input + button**:
- Text field (easy)
- Button labeled "Apply" (good)
- *Question*: After user taps/presses Apply, is the result announced?
- *Expected*: If coupon is valid, screen reader announces "Coupon applied, fee now MMK 4,000"
- *Risk*: If silently applies, user doesn't know if it worked

**Rewards checkbox** (if applicable):
- `<input type="checkbox">`
- Label: "Use X points to reduce fee by MMK Y"
- *Expected*: Keyboard navigation + screen reader announces state

#### Step 4: Review

**Edit links**:
- Text links ("Edit" or "[Edit]") scattered through the summary
- *Question*: Are they announced as links?
- *Expected*: Screen reader says "link, edit" for each

**Primary button**:
- "Send pickup request"
- *Question*: During submission, is loading state announced?
- *Expected*: Button becomes disabled, screen reader announces "Sending, button disabled"
- After success: "Your pickup request has been sent. Tracking code: OERN-20261023-00123"
- *Expected*: Success message announced automatically

### Sam's Experience Summary

**Best moments**:
- ✓ All text inputs have labels
- ✓ Primary action clearly labeled
- ✓ Form validates and shows errors inline
- ✓ Draft preserved through navigation

**Worst moments**:
- ❌ Autocomplete menu might not be announced by screen reader
- ❌ Custom toggle/radio buttons might not work with keyboard
- ❌ Map picker is not keyboard-accessible (no alternative)
- ❌ Coupon application might not give feedback
- ❌ Loading state during submission might not be announced

---

## Scenario 5: Stress Tester - "Riley" (Finds Edge Cases)

### Goal
Break the pickup flow and document what goes wrong.

### Test Cases

#### Case 1: Very Long Address
- **Input**: "42 Pyay Road, Kamayut Township, Yangon Region, Myanmar, Southeast Asia, Planet Earth"
- **Expected**:
  - Address field accepts max 300 chars (per code)
  - Autocomplete doesn't break
  - Fee estimate still calculates
  - Review shows full address
  - On mobile, address doesn't overflow
  
- **Risk**: 
  - Truncated address might be confusing ("42 Pyay Road, Kamayut Township, Yangon Region,...")
  - Fee calculation might fail if address is too long for Mapbox geocoding

#### Case 2: Special Characters
- **Input**: "42 Pyay Road, Kamayut (Yangon) — Near the market"
- **Expected**:
  - Field accepts parentheses, dashes, emojis, etc.
  - Autocomplete handles it
  - API doesn't reject it
  
- **Risk**:
  - Some characters might break JSON parsing
  - Emojis might not render on other platforms

#### Case 3: Burmese Text
- **Input**: "၄၂ ပြည်ရိုးဆိုင်ရာလမ်း, ကမ္ယေားဝါဒ"
- **Expected**:
  - Field accepts Burmese
  - Font renders correctly (Noto Sans Myanmar)
  - Autocomplete suggests Burmese addresses
  - API stores it correctly
  
- **Risk**:
  - If Noto Sans Myanmar isn't loaded, characters might show as boxes
  - RTL text mixing with LTR might cause layout issues

#### Case 4: Zero-Distance Delivery
- **Input**: Pickup = Delivery = same address (42 Pyay Road)
- **Expected**:
  - Geocoding returns same point twice
  - Distance = 0 km
  - Fee = base fee only (MMK 2,000?)
  - Review shows "[Pickup] Same location as delivery?"
  
- **Risk**:
  - API might reject zero-distance
  - Fee calculation might break
  - User might be confused ("Why am I requesting a pickup at the delivery location?")

#### Case 5: Refresh Mid-Flow
- **Action**: Fill step 1, tap "Next", then press F5 while on step 2
- **Expected**:
  - Browser refreshes
  - Draft is restored from localStorage
  - Page shows step 2 with filled values
  - User can continue
  
- **Risk**:
  - If localStorage is cleared, draft is lost
  - If session expires, user gets redirect to sign-in
  - On sign-in return, draft might not be restored

#### Case 6: Multiple Tabs
- **Action**: Open /pickup in tab A, fill step 1 and tab to step 2. Then open /pickup in tab B (fresh form).
- **Expected**:
  - Tab A has its draft (step 2)
  - Tab B has a fresh form (step 1, empty)
  - If user completes in tab A and submits, order is created
  - If user then tries to submit in tab B (which still has the old draft), what happens?
  
- **Risk**:
  - Duplicate orders created
  - localStorage conflict (both tabs writing)
  - Tab B doesn't know tab A submitted

#### Case 7: Unverified Phone Number
- **Scenario**: Sender's phone number is not verified (if that's a thing)
- **Expected**:
  - User can still submit request
  - System might warn ("Your phone isn't verified, rider can't reach you")
  
- **Risk**:
  - Order silently fails because phone isn't verified
  - User doesn't see error until checking /orders

#### Case 8: Invalid COD Amount
- **Input**: Recipient phone is in the field, but COD amount is negative or > 10,000,000 MMK
- **Expected**:
  - Field validates (min/max)
  - Error shown inline ("COD must be 0–10,000,000 MMK")
  - User can't submit until valid
  
- **Risk**:
  - No validation (user submits with COD="-1000", order is rejected by API)
  - Silent failure (order accepted but COD amount is wrong)

#### Case 9: Coupon + Points Interaction
- **Scenario**: User applies "WELCOME50" (50% off) AND tries to use loyalty points
- **Expected**:
  - One of them is rejected with explanation
  - Or both are combined (unlikely per business rules)
  
- **Risk**:
  - Silently combines them (unfair discount)
  - Silently rejects one without telling user
  - UX shows both applied, but API rejects one, user gets charged more

#### Case 10: Network Failure During Submission
- **Action**: On step 4, user taps "Send pickup request". Network times out (no response after 30 seconds).
- **Expected**:
  - Button shows loading spinner
  - After timeout (e.g., 15 seconds), shows error: "Network timeout. [Retry]"
  - User can tap Retry
  - If request succeeded server-side, retry detects duplicate (idempotent)
  
- **Risk**:
  - No timeout (button spins forever)
  - Multiple submits (user taps button multiple times, creates duplicate orders)
  - No indication of what went wrong

### Riley's Summary

**Most critical issues**:
1. Multiple tab handling (duplicate orders)
2. Network timeout handling (unclear state)
3. Coupon + Points combination (fairness)
4. Refresh mid-flow (draft loss)
5. Zero-distance validation (edge case)

**Minor issues**:
1. Very long address truncation
2. Special character handling
3. Burmese text rendering fallback
4. COD amount validation range

---

## Scenario 6: Accessibility + Mobile (Sam + Casey)

### Goal
Complete a pickup request on mobile using only keyboard and screen reader, one-handed, with interruptions.

### Combined Challenges

1. **Keyboard navigation on mobile**:
   - iOS: VoiceOver + hardware keyboard (external)
   - Android: NVDA + on-screen keyboard
   - *Issue*: On-screen keyboard covers bottom actions
   - *Expected*: Primary button floats above keyboard

2. **Single-handed operation**:
   - User can't use both hands to interact with keyboard + screen
   - Must use external keyboard or one-hand thumb typing
   - *Expected*: Tab key to navigate, Enter/Space to activate

3. **Touch targets + Focus visibility**:
   - Blue focus ring must be visible even when keyboard is active
   - Touch targets ≥48px so accidental taps don't miss
   - *Expected*: Both satisfied

4. **Screen reader + keyboard combo**:
   - VoiceOver announces "Next, parcel and contacts, button"
   - User presses Space to activate (not Enter, which might trigger form submission in some cases)
   - *Expected*: Both Space and Enter work

5. **Interruption + state recovery**:
   - User is on step 2, receives a call
   - App minimizes, user takes call
   - 5 minutes later, user returns to app
   - Screen is still showing step 2 (app still in memory) ✓
   - User continues where they left off ✓
   - *Expected*: Draft in localStorage means user can refresh and still recover

### Likely Issues in Current Implementation

1. **Map picker not accessible**:
   - If user chooses "Pickup on map", the map interface is not keyboard/screen-reader friendly
   - *Expected*: Alternative: search-on-map or "enter address manually" option

2. **Dropdown for parcel kind**:
   - If it's a custom MUI Autocomplete, keyboard navigation might not work well
   - *Expected*: Test thoroughly with external keyboard

3. **Date/time buttons**:
   - Buttons are likely keyboard-navigable (Tab to focus, Space/Enter to select)
   - *Good*: No complex gestures required
   - *Expected*: No issues here

4. **Loading state feedback**:
   - When submitting, button shows loading spinner
   - For screen reader user: Does it announce "Sending"?
   - *Expected*: aria-busy="true" or aria-label="Sending pickup request"

---

## Summary: Cross-Scenario Patterns

### Recurring Strength Patterns
1. **Bottom-pinned primary actions** (good for mobile thumb zone)
2. **Draft persistence** (survives refresh, navigation, sign-out)
3. **Real-time fee estimates** (keeps users informed)
4. **Step-by-step progression** (clear mental model)
5. **Inline validation** (immediate feedback)

### Recurring Problem Patterns
1. **No pre-fill from previous requests** (Alex's frustration)
2. **Map picker not accessible** (Sam's blocker)
3. **Keyboard covers actions** (Casey's friction)
4. **Timeout not handled** (Riley's network edge case)
5. **Coupon + Points interaction unclear** (Riley's edge case)
6. **Multi-tab state conflict** (Riley's duplicate order risk)

### Key Recommendations

| Issue | Severity | Fix |
|-------|----------|-----|
| No duplicate/template feature | P2 | Add "Use as template" on /orders detail |
| Map picker not keyboard-accessible | P1 | Add search field on map, or alternative address input |
| Keyboard covers bottom action on mobile | P2 | Sticky positioning above soft keyboard |
| Network timeout has no feedback | P1 | 15-second timeout + "Retry" button |
| Multiple tabs create duplicate orders | P1 | Add request deduplication (idempotent keys) |
| Coupon + Points interaction unclear | P2 | Show UI that only one discount applies |
| Focus ring might not be visible on overlays | P1 | Ensure 3px blue outline on all interactive elements |
| Parcel kind dropdown at working memory threshold | P2 | Reduce to 4 options or group categories |

---

*This scenario document is a detailed walkthrough of real user interactions with the pickup flow, identifying the highest-impact UX improvements.*
