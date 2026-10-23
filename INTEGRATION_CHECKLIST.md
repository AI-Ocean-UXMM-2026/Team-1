# MMQR Payment Integration Checklist

## Integration Map: `/pickup/*` Flow

```
/pickup/
├── page.tsx (route step)
│   └─→ PickupRequestPage step="route"
│       └─→ Map interface for pickup location
│
├── details/page.tsx (details step)
│   └─→ PickupRequestPage step="details"
│       └─→ Parcel & contact information
│
├── payment/page.tsx (payment step) ⭐ YOUR INTEGRATION POINT
│   └─→ PickupRequestPage step="payment"
│       └─→ ✨ ADD NEW COMPONENTS HERE
│           ├─→ PickupAddressSummary (NEW)
│           ├─→ PaymentMethodPicker (existing)
│           └─→ MMQRPaymentFlow (NEW - conditional)
│
└── review/page.tsx (review step)
    └─→ PickupRequestPage step="review"
        └─→ Final review & submit
```

---

## Step-by-Step Integration

### Step 1: Verify File Locations ✅

Check all new files exist:

```bash
# Components
ls -l src/components/delivery/mmqr-payment-flow.tsx
ls -l src/components/delivery/pickup-address-summary.tsx
ls -l src/components/delivery/payment-page-layout.tsx

# Utilities
ls -l src/lib/delivery/mmqr-sdk.ts

# Documentation inside component folder
ls -l src/components/delivery/MMQR_PAYMENT_README.md
```

**Expected**: All files present and readable ✅

---

### Step 2: Verify Build Status ✅

```bash
# Run TypeScript check
npm run typecheck

# Run build
npm run build
```

**Expected Output**:
```
✓ Compiled successfully in X.Xs
✓ Running TypeScript ...
```

**Acceptable Errors**: Pre-existing vitest issues (not related to new components)

---

### Step 3: Review Existing Payment Page

Current structure at `src/app/pickup/payment/page.tsx`:

```tsx
import { PickupRequestPage } from "@/components/delivery/pickup-request";

export default function PickupPaymentPage() {
  return <PickupRequestPage step="payment" />;
}
```

This calls the main `PickupRequestPage` component with `step="payment"`.

---

### Step 4: Locate Integration Point

Open `src/components/delivery/pickup-request.tsx` and find the payment step section (around line 500-700).

**Look for**:
- `if (step === "payment")` or similar
- Payment method picker usage
- Fee breakdown display
- "Continue" or "Next" button

---

### Step 5: Add New Components (Minimal Integration)

At the payment step in `pickup-request.tsx`, add:

#### 5a. Import the new components

```tsx
// Add to imports at top of file
import { PickupAddressSummary } from "@/components/delivery/pickup-address-summary";
import { MMQRPaymentFlow } from "@/components/delivery/mmqr-payment-flow";
```

#### 5b. Add state for MMQR flow

```tsx
// Add to component state (around line 100-200)
const [showingMMQRPayment, setShowingMMQRPayment] = useState(false);
```

#### 5c. Display address summary at payment step

**Find**: Where payment method picker is shown (around line 550)

**Add before** the payment method picker:

```tsx
{step === "payment" && (
  <PickupAddressSummary
    pickupAddress={
      draft.pickup.location?.name
        ? {
            text: draft.pickup.location.name,
            point: draft.pickup.location.point,
          }
        : null
    }
    deliveryAddress={
      draft.delivery.location?.name
        ? {
            text: draft.delivery.location.name,
            point: draft.delivery.location.point,
          }
        : null
    }
    onEdit={() => router.push("/pickup")}
    showEdit={!showingMMQRPayment}
  />
)}
```

#### 5d. Add MMQR flow (conditional display)

**Find**: Where the "Continue" or "Next" button is for payment step (around line 600)

**Add above the button**:

```tsx
{step === "payment" && showingMMQRPayment && isPrepaid(paymentMethod) && estimate && (
  <MMQRPaymentFlow
    amount={estimate.total}
    reference={`PKP-${Date.now()}`}
    merchantId="oern-merchant"
    merchantName="Oern"
    onConfirmed={async () => {
      // Create the order and proceed to review
      await handleOrderCreation();
      router.push("/pickup/review");
    }}
    onCancel={() => {
      setShowingMMQRPayment(false);
    }}
  />
)}
```

#### 5e. Update button handler

**Find**: The click handler for the payment "Continue/Next/Pay" button

**Replace with**:

```tsx
const handlePaymentStep = () => {
  if (isPrepaid(paymentMethod) && !showingMMQRPayment) {
    // For prepaid methods, show MMQR flow instead of continuing
    setShowingMMQRPayment(true);
  } else {
    // For COD or after MMQR confirmation, continue to review
    handleNextStep();
  }
};
```

**Update button**:

```tsx
<Button
  onClick={handlePaymentStep}
  disabled={!estimate || isLoading}
>
  {showingMMQRPayment
    ? "Cancel Payment"
    : isPrepaid(paymentMethod)
    ? `Pay ${currency.format(estimate?.total || 0)} Now`
    : "Continue to Review"}
</Button>
```

---

### Step 6: Test the Integration

#### 6a. Local Testing

```bash
# Start development server
npm run dev

# Navigate to http://localhost:3000/pickup
```

#### 6b. Test Flow

1. **Fill in pickup address**
   - Enter "123 Main Street"
   - Select from suggestions
   - See map pin placed

2. **Continue to delivery address**
   - Enter "456 Commerce Road"
   - Select from suggestions
   - See map pin placed

3. **Go to payment page**
   - Navigate to `/pickup/payment`
   - Should see:
     - ✅ Address summary with addresses
     - ✅ Fee breakdown
     - ✅ Payment method picker
     - ✅ MMQR option selected by default

4. **Test MMQR flow**
   - Click "Pay {amount} Now"
   - Should see:
     - ✅ QR code appears
     - ✅ Countdown timer starts (2:00)
     - ✅ Save QR button works
     - ✅ Cancel button returns to payment selection

5. **Test timer expiration**
   - Wait 2 minutes (or mock the timer)
   - Should see:
     - ✅ Loading state appears
     - ✅ Spinner shows
     - ✅ After ~30s, success state

6. **Test COD path**
   - Select "Cash on Delivery"
   - Click "Continue to Review"
   - Should proceed to review page

---

### Step 7: Mobile Testing

```bash
# Test on mobile device or use Chrome DevTools
# Viewport: 390px width (common mobile)

# Check:
- [ ] Address summary is readable
- [ ] Buttons are 56px tall
- [ ] QR code is centered
- [ ] Timer is visible
- [ ] Save QR button works
- [ ] No horizontal scroll
- [ ] Sticky buttons stay at bottom
```

---

### Step 8: Cross-Browser Testing

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] iPhone Safari
- [ ] Chrome Mobile

---

## Full Integration Path (Advanced)

If you want to completely replace the payment section with the new `PaymentPageLayout`:

### Alternative Step 5: Use Full Layout

Instead of step 5a-5e above, use the complete layout:

```tsx
import { PaymentPageLayout } from "@/components/delivery/payment-page-layout";

// In payment step rendering:
{step === "payment" && (
  <PaymentPageLayout
    pickupAddress={
      draft.pickup.location?.name
        ? {
            text: draft.pickup.location.name,
            point: draft.pickup.location.point,
          }
        : null
    }
    deliveryAddress={
      draft.delivery.location?.name
        ? {
            text: draft.delivery.location.name,
            point: draft.delivery.location.point,
          }
        : null
    }
    feeEstimate={estimate}
    paymentMethod={paymentMethod}
    onPaymentMethodChange={setPaymentMethod}
    onEditAddresses={() => router.push("/pickup")}
    onViewMap={() => setShowingMap(true)}
    onPaymentSuccess={async () => {
      await handleOrderCreation();
      router.push("/pickup/review");
    }}
    onBack={() => router.back()}
    isLoading={isLoading}
    title="Payment"
  />
)}
```

This replaces the entire payment section with a single component.

---

## Data Flow Reference

### What State Needs to Come From PickupRequestPage

```tsx
// Address data
draft.pickup.location = {
  name: string;        // "123 Main Street, Yangon"
  point: MapPoint;     // { latitude: 16.8409, longitude: 96.1735 }
};

draft.delivery.location = {
  name: string;        // "456 Commerce Road, Yangon"
  point: MapPoint;     // { latitude: 16.8600, longitude: 96.1900 }
};

// Fee data
estimate = {
  lines: Array<{id: string, label: string, amount: number}>;
  total: number;
  distanceKm: number;
};

// Payment data
paymentMethod: "mmqr" | "ctzpay" | "cod";
```

### What New Components Provide

```tsx
// PickupAddressSummary provides:
onEdit: () => void;      // Navigate back to address selection
onOpenMap: () => void;   // Open map view

// MMQRPaymentFlow provides:
onConfirmed: () => void; // Payment successful - navigate away
onCancel: () => void;    // User cancelled - show payment methods again
```

---

## Type Definitions Check

Verify all types are available:

```tsx
// Should all resolve from existing types:
import type { PaymentMethod } from "@/lib/delivery/payment-methods";
import type { FeeEstimate } from "@/lib/delivery/delivery-fee";
import type { MapPoint } from "@/lib/delivery/map-projection";

// New types from mmqr-sdk:
import type { MMQRQRCode } from "@/lib/delivery/mmqr-sdk";
```

**Expected**: All types resolve without errors ✅

---

## Testing Scenarios

### Scenario 1: Complete MMQR Payment

```
1. Start at /pickup
2. Enter pickup address → map pin placed
3. Go to delivery
4. Enter delivery address → map pin placed
5. Click next to payment
6. See address summary ✓
7. See fee breakdown ✓
8. MMQR is selected by default ✓
9. Click "Pay Now" ✓
10. QR code appears ✓
11. See countdown (2:00) ✓
12. Wait for timeout → loading state ✓
13. Payment confirmed after 30s ✓
14. Navigate to review page ✓
```

### Scenario 2: Switch to COD

```
1. At /pickup/payment
2. See payment methods
3. Select "Cash on Delivery" ✓
4. Click "Continue to Review" ✓
5. Navigate to review page ✓
```

### Scenario 3: Save QR Code

```
1. In QR display state
2. Click "Save QR Code" ✓
3. File downloads to device ✓
4. Filename: mmqr-{reference}.png ✓
```

### Scenario 4: Cancel Payment

```
1. In QR display state
2. Click "Cancel & Go Back" ✓
3. Return to payment method selection ✓
4. Can select different method ✓
```

---

## Debugging Guide

### Issue: Components not found

**Solution**:
```bash
# Verify files exist
ls src/components/delivery/mmqr-payment-flow.tsx
ls src/lib/delivery/mmqr-sdk.ts

# Check import paths
grep -r "mmqr-payment-flow" src/
```

### Issue: TypeScript errors

**Solution**:
```bash
# Run type check
npm run typecheck

# Check specific file
npx tsc --noEmit src/components/delivery/mmqr-payment-flow.tsx
```

### Issue: Build fails

**Solution**:
```bash
# Clean and rebuild
rm -rf .next
npm run build

# Check for syntax errors
npm run lint
```

### Issue: QR code not displaying

**Solution**:
- Check browser console for errors
- Verify canvas API is available
- Check if `generateMMQRQRCode` completes
- Ensure browser allows canvas rendering

### Issue: Timer not counting down

**Solution**:
- Check if state is "qr-display"
- Verify useEffect dependencies
- Check browser console for timer errors
- Ensure interval is not being cleared prematurely

---

## Deployment Checklist

Before deploying to production:

- [ ] All components integrated
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Manual testing completed on all browsers
- [ ] Mobile responsiveness verified
- [ ] Accessibility audit passed
- [ ] No console errors
- [ ] Performance acceptable
- [ ] QR code generation works
- [ ] Payment flow completes successfully
- [ ] Address summary displays correctly
- [ ] Fee breakdown is accurate
- [ ] Buttons are clickable and styled
- [ ] Countdown timer works (2:00 → 0:00)
- [ ] Loading state appears after timeout
- [ ] Success confirmation shows
- [ ] Navigation to next step works

---

## Rollback Plan

If issues occur:

1. **Revert files**:
   ```bash
   git revert <commit-hash>
   ```

2. **Rebuild**:
   ```bash
   npm run build
   npm run dev
   ```

3. **Verify**:
   - Payment flow still works
   - Existing components intact
   - No breaking changes

---

## Success Criteria ✅

Integration is successful when:

- ✅ `/pickup/payment` loads without errors
- ✅ Address summary displays both addresses
- ✅ Fee breakdown shows correct total
- ✅ Payment methods are selectable
- ✅ MMQR flow starts when "Pay Now" clicked
- ✅ QR code displays
- ✅ Countdown timer works (2:00 → 0:00)
- ✅ Timer turns red when <30 seconds
- ✅ Loading state appears after timeout
- ✅ Success state appears after 1-30s
- ✅ Can save QR code
- ✅ Cancel button returns to payment methods
- ✅ COD path works without MMQR
- ✅ Mobile layout is responsive
- ✅ All buttons are accessible (56px+)

---

## Next Steps After Integration

1. ✅ Components integrated
2. ⬜ Real MMQR provider integration
3. ⬜ Supabase order creation
4. ⬜ Payment receipt generation
5. ⬜ Transaction history tracking
6. ⬜ Payment retry logic
7. ⬜ Biometric authentication

---

## Support During Integration

**Documentation**:
- `MMQR_PAYMENT_README.md` - Full API reference
- `PAYMENT_UI_IMPLEMENTATION.md` - Step-by-step guide
- `PAYMENT_COMPONENTS_VISUAL_GUIDE.md` - Visual specs
- `PAYMENT_FLOW_QUICKSTART.md` - Quick examples

**Code References**:
- `src/components/delivery/payment-picker.tsx` - Existing payment UI
- `src/lib/delivery/payment-methods.ts` - Payment types
- `src/components/delivery/pickup-request.tsx` - Main form component

---

## Quick Reference Commands

```bash
# View new files
ls -la src/components/delivery/mmqr-*.tsx
ls -la src/lib/delivery/mmqr-sdk.ts

# Check types
grep "type.*Payment\|interface.*Payment" src/lib/delivery/payment-methods.ts

# Find payment step in main component
grep -n "step === \"payment\"" src/components/delivery/pickup-request.tsx

# Run tests
npm run build
npm run typecheck

# Development
npm run dev
# Then visit: http://localhost:3000/pickup/payment
```

---

**Integration Complexity**: Low (Minimal) to Medium (Full)  
**Estimated Time**: 30-60 minutes (Minimal) to 2-4 hours (Full)  
**Breaking Changes**: None ✅  
**Backward Compatible**: Yes ✅

---

*Last Updated: October 23, 2026*  
*Status: Ready for Integration*
