# /pickup/payment Integration Guide

## URL Route Map

```
http://localhost:3000/pickup/              ← Route step (location picker)
http://localhost:3000/pickup/details       ← Details step (parcel info)
http://localhost:3000/pickup/payment       ← Payment step ⭐ INTEGRATION POINT
http://localhost:3000/pickup/review        ← Review step (final)
http://localhost:3000/pickup/map           ← Shared map (full screen)
```

---

## Current /pickup/payment Structure

### File: `src/app/pickup/payment/page.tsx`
```tsx
import type { Metadata } from "next";
import { PickupRequestPage } from "@/components/delivery/pickup-request";

export const metadata: Metadata = {
  title: "Pickup payment — Oern",
  description: "See the delivery fee and choose who pays and how.",
};

export default function PickupPaymentPage() {
  return <PickupRequestPage step="payment" />;
}
```

**Current Flow**:
1. User navigates to `/pickup/payment`
2. Page renders `PickupRequestPage` with `step="payment"`
3. `PickupRequestPage` displays payment options
4. User selects payment method and continues

---

## Integration Points

### Where to Add New Components

**File**: `src/components/delivery/pickup-request.tsx`

**Location**: Payment step rendering section (around lines 500-700)

#### Current Payment Step Code (Existing)
```tsx
// Around line 550-600
{step === "payment" && (
  <Box sx={{ /* styling */ }}>
    {/* Current payment UI */}
    <PaymentMethodPicker
      name="payment-method"
      value={paymentMethod}
      onChange={setPaymentMethod}
    />
    <FeeBreakdown
      estimate={estimate}
      method={paymentMethod}
    />
    {/* Current buttons */}
  </Box>
)}
```

#### Where to Insert New Components

```tsx
{step === "payment" && (
  <Box sx={{ /* styling */ }}>
    
    {/* ✨ NEW: Add address summary at top */}
    <PickupAddressSummary
      pickupAddress={...}
      deliveryAddress={...}
      onEdit={() => router.push("/pickup")}
    />
    
    {/* Existing: Fee breakdown */}
    <FeeBreakdown estimate={estimate} method={paymentMethod} />
    
    {/* Existing: Payment method picker */}
    <PaymentMethodPicker
      name="payment-method"
      value={paymentMethod}
      onChange={setPaymentMethod}
    />
    
    {/* ✨ NEW: Conditional MMQR flow */}
    {showingMMQRPayment && isPrepaid(paymentMethod) && estimate && (
      <MMQRPaymentFlow
        amount={estimate.total}
        reference={`PKP-${Date.now()}`}
        merchantId="oern-merchant"
        onConfirmed={handlePaymentConfirmed}
        onCancel={() => setShowingMMQRPayment(false)}
      />
    )}
    
    {/* Existing: Action buttons - MODIFY */}
    <Button onClick={handlePaymentContinue}>
      {showingMMQRPayment ? "Cancel" : "Pay Now"}
    </Button>
  </Box>
)}
```

---

## Step-by-Step Integration Code

### Step 1: Add Imports

**File**: `src/components/delivery/pickup-request.tsx` (top of file)

```tsx
// Add these imports to existing imports
import { PickupAddressSummary } from "@/components/delivery/pickup-address-summary";
import { MMQRPaymentFlow } from "@/components/delivery/mmqr-payment-flow";
```

---

### Step 2: Add State

**File**: `src/components/delivery/pickup-request.tsx` (around line 150-200)

**Find**: Where other `useState` hooks are defined

**Add**:
```tsx
// MMQR payment flow state
const [showingMMQRPayment, setShowingMMQRPayment] = useState(false);
```

---

### Step 3: Add Address Summary Component

**File**: `src/components/delivery/pickup-request.tsx` (payment step rendering)

**Find**: Around line 550, where payment method picker is rendered

**Add before** `<PaymentMethodPicker>`:

```tsx
{step === "payment" && (
  <>
    {/* ✨ NEW: Address Summary */}
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
      onOpenMap={() => router.push("/pickup/map")}
      showEdit={!showingMMQRPayment}
    />

    {/* Rest of existing payment UI */}
    {/* ... existing PaymentMethodPicker, FeeBreakdown, etc ... */}
  </>
)}
```

---

### Step 4: Add MMQR Flow Component

**File**: `src/components/delivery/pickup-request.tsx`

**Find**: Around line 600-650, where action buttons are rendered

**Add before** the "Continue" button:

```tsx
{step === "payment" && showingMMQRPayment && isPrepaid(paymentMethod) && estimate && (
  <MMQRPaymentFlow
    amount={estimate.total}
    reference={`PKP-${Date.now()}`}
    merchantId="oern-merchant"
    merchantName="Oern"
    onConfirmed={async () => {
      // Handle order creation
      try {
        const result = await createCustomerPickupOrder({
          // ... existing order data
        });
        // Navigate to review or track
        router.push(`/pickup/review?order=${result.data.id}`);
      } catch (error) {
        console.error("Order creation failed:", error);
        setShowingMMQRPayment(false);
      }
    }}
    onCancel={() => {
      // Return to payment method selection
      setShowingMMQRPayment(false);
    }}
  />
)}
```

---

### Step 5: Modify Button Handler

**File**: `src/components/delivery/pickup-request.tsx`

**Find**: The button click handler for payment step (search for `handleNextStep` or similar)

**Replace with**:

```tsx
const handlePaymentContinue = () => {
  // For prepaid methods, show MMQR payment flow
  if (isPrepaid(paymentMethod) && !showingMMQRPayment && estimate) {
    setShowingMMQRPayment(true);
  } else {
    // For COD or after MMQR confirmation, continue
    handleNextStep(); // Use existing next step handler
  }
};
```

---

### Step 6: Update Button Text

**File**: `src/components/delivery/pickup-request.tsx`

**Find**: The "Continue" button for payment step

**Replace**:
```tsx
<Button
  onClick={handlePaymentContinue}
  disabled={!estimate || isLoading || !pickupAddressValid || !deliveryAddressValid}
>
  {showingMMQRPayment
    ? "Cancel Payment"
    : isPrepaid(paymentMethod)
      ? `Pay ${currency.format(estimate?.total || 0)} Now`
      : "Continue to Review"}
</Button>
```

---

## Data Sources

All data comes from existing `PickupRequestPage` state:

```tsx
// Address data
draft.pickup.location = {
  name: string;              // "123 Main Street, Yangon"
  point: { latitude, longitude }; // Coordinates
};

draft.delivery.location = {
  name: string;              // "456 Commerce Road, Yangon"
  point: { latitude, longitude }; // Coordinates
};

// Fee data (already calculated)
estimate = {
  lines: FeeEstimate["lines"];
  total: number;
  distanceKm: number;
};

// Payment selection
paymentMethod: "mmqr" | "ctzpay" | "cod";
```

---

## Variable Names Reference

Use these existing variables in your integration:

```tsx
// From PickupRequestPage component
const router = useRouter();           // Navigation
const [draft, setDraft] = useState();  // Form data
const [estimate, setEstimate] = useState(); // Fee estimate
const [paymentMethod, setPaymentMethod] = useState(); // Selected payment
const [isLoading, setIsLoading] = useState(); // Loading state

// Existing imported utilities
isPrepaid(paymentMethod)  // Check if prepaid method
createCustomerPickupOrder() // Create order in DB
currency.format(amount)   // Format money

// Navigation
router.push(path)         // Go to URL
router.back()            // Go back
```

---

## Quick Copy-Paste Template

Here's the complete code block to add to payment step:

```tsx
{step === "payment" && (
  <Stack spacing={3}>
    
    {/* 1. Address Summary */}
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
      onOpenMap={() => router.push("/pickup/map")}
      showEdit={!showingMMQRPayment}
    />
    
    {/* 2. Existing Fee Breakdown */}
    <FeeBreakdown
      estimate={estimate}
      method={paymentMethod}
    />
    
    {/* 3. Existing Payment Method Picker */}
    <PaymentMethodPicker
      name="payment-method"
      value={paymentMethod}
      onChange={setPaymentMethod}
    />
    
    {/* 4. Conditional MMQR Flow */}
    {showingMMQRPayment && isPrepaid(paymentMethod) && estimate && (
      <MMQRPaymentFlow
        amount={estimate.total}
        reference={`PKP-${Date.now()}`}
        merchantId="oern-merchant"
        merchantName="Oern"
        onConfirmed={async () => {
          try {
            const { data: order } = await createCustomerPickupOrder({
              sender_phone: draft.sender.phone,
              sender_name: draft.sender.name,
              receiver_phone: draft.receiver.phone,
              receiver_name: draft.receiver.name,
              receiver_address: draft.delivery.location?.name,
              pickup_address: draft.pickup.location?.name,
              parcel_description: draft.parcel.description,
              notes: draft.notes,
              payment_method: paymentMethod,
            });
            router.push(`/pickup/review?order=${order.id}`);
          } catch (error) {
            console.error("Order creation failed:", error);
            setShowingMMQRPayment(false);
          }
        }}
        onCancel={() => setShowingMMQRPayment(false)}
      />
    )}
    
    {/* 5. Action Buttons */}
    <Button
      onClick={() => {
        if (isPrepaid(paymentMethod) && !showingMMQRPayment && estimate) {
          setShowingMMQRPayment(true);
        } else {
          handleNextStep();
        }
      }}
      disabled={!estimate || isLoading}
    >
      {showingMMQRPayment
        ? "Cancel Payment"
        : isPrepaid(paymentMethod)
          ? `Pay ${currency.format(estimate?.total || 0)} Now`
          : "Continue to Review"}
    </Button>
    
  </Stack>
)}
```

---

## Testing Checklist

After integration, test these flows:

### ✅ Address Display
```
1. Navigate to /pickup/payment
2. Should see addresses displayed
3. Edit button should go back to /pickup
4. View map button should open map
```

### ✅ Payment Method Selection
```
1. Should see 3 payment options
2. Can select MMQR
3. Can select CTZPay
4. Can select Cash on Delivery
```

### ✅ MMQR Payment Flow
```
1. Select MMQR
2. Click "Pay Now" button
3. Should see QR code display
4. Timer should count down from 2:00
5. Can save QR code
6. After 2 min: loading state appears
7. After 30s more: success state
8. Success navigates to review page
```

### ✅ COD Path
```
1. Select "Cash on Delivery"
2. Click "Continue to Review"
3. Should navigate to /pickup/review
```

### ✅ Mobile
```
1. Test on 390px width viewport
2. All components should be readable
3. Buttons should be 56px tall
4. No horizontal scroll
5. QR code should be centered
```

---

## Common Issues & Solutions

### Issue: "Cannot find module"
**Solution**: Verify import path is correct
```tsx
// Correct
import { MMQRPaymentFlow } from "@/components/delivery/mmqr-payment-flow";

// Wrong
import { MMQRPaymentFlow } from "./mmqr-payment-flow";
```

### Issue: Undefined state variable
**Solution**: Add state at top of component
```tsx
const [showingMMQRPayment, setShowingMMQRPayment] = useState(false);
```

### Issue: QR code not showing
**Solution**: Check if estimate exists and is not loading
```tsx
{estimate && !isLoading && showingMMQRPayment && (
  <MMQRPaymentFlow {...} />
)}
```

### Issue: Button doesn't navigate
**Solution**: Verify router is imported
```tsx
import { useRouter } from "next/navigation";
const router = useRouter();
```

### Issue: Types not found
**Solution**: Import types correctly
```tsx
import { isPrepaid } from "@/lib/delivery/payment-methods";
import type { PaymentMethod } from "@/lib/delivery/payment-methods";
```

---

## File Modification Summary

| File | Changes | Complexity |
|------|---------|------------|
| `src/app/pickup/payment/page.tsx` | None - No changes needed | ✅ None |
| `src/components/delivery/pickup-request.tsx` | Add imports, state, components | ⚠️ Medium |

**Total lines to add**: ~100 lines (spread across file)

---

## Before/After Comparison

### Before Integration
```
/pickup/payment
└── Payment method picker
    └── Fee breakdown
    └── Action buttons
```

### After Integration
```
/pickup/payment
├── Address summary ✨ NEW
├── Fee breakdown
├── Payment method picker
├── MMQR flow (conditional) ✨ NEW
└── Action buttons (modified)
```

---

## Deployment Steps

```bash
# 1. Make changes to pickup-request.tsx
vim src/components/delivery/pickup-request.tsx

# 2. Verify TypeScript
npm run typecheck

# 3. Build
npm run build

# 4. Test locally
npm run dev
# Visit: http://localhost:3000/pickup/payment

# 5. Commit
git add -A
git commit -m "feat: add MMQR payment flow to /pickup/payment"

# 6. Push (to device-2 branch)
git push origin codex/device-2-operations-integrations
```

---

## Success Indicators ✅

Integration is successful when:

- ✅ Page loads without errors at `/pickup/payment`
- ✅ Address summary displays
- ✅ Payment methods are selectable
- ✅ MMQR button shows QR code
- ✅ QR code countdown works (2:00)
- ✅ Loading state appears after timeout
- ✅ Success state appears
- ✅ Navigation works to review page
- ✅ Mobile layout is responsive
- ✅ No console errors

---

## Resources

| Resource | Purpose | Link |
|----------|---------|------|
| API Reference | Component props | `src/components/delivery/MMQR_PAYMENT_README.md` |
| Implementation | Step-by-step | `PAYMENT_UI_IMPLEMENTATION.md` |
| Visual Guide | Design specs | `PAYMENT_COMPONENTS_VISUAL_GUIDE.md` |
| Quick Start | Examples | `PAYMENT_FLOW_QUICKSTART.md` |
| This file | Integration | `PICKUP_PAYMENT_INTEGRATION.md` |

---

**Integration Location**: `src/components/delivery/pickup-request.tsx`  
**Payment Step**: Around line 500-700 (search for `step === "payment"`)  
**Complexity**: Medium (100 lines of code)  
**Time**: 30-60 minutes  
**Testing**: Required before deployment  

Ready to integrate? Start with adding imports, then state, then components!
