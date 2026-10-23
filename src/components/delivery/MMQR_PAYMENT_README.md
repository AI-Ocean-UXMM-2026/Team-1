# MMQR Payment Flow Components

Complete payment UI system for Oern's pickup flow, featuring MMQR QR code payment integration with Grab-inspired design using Oern's design system.

## Components

### 1. `MMQRPaymentFlow`

Main payment flow component that handles QR code generation, display, countdown timer, and payment confirmation.

#### Features
- **QR Code Generation**: Mock MMQR SDK integration
- **2-Minute Countdown**: Automatic transition to loading state after timeout
- **QR Save**: Download QR code as PNG image
- **Payment Confirmation**: Simulated payment status polling
- **State Management**: Ready → Generating → QR Display → Loading → Confirmed

#### Usage

```tsx
import { MMQRPaymentFlow } from "@/components/delivery/mmqr-payment-flow";

export function PaymentExample() {
  return (
    <MMQRPaymentFlow
      amount={5000}
      reference="PKP-123456"
      merchantId="oern-merchant"
      merchantName="Oern"
      onConfirmed={() => console.log("Payment confirmed!")}
      onCancel={() => console.log("Payment cancelled")}
    />
  );
}
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `amount` | `number` | Amount to charge in MMK |
| `reference` | `string` | Payment reference code (tracking code) |
| `merchantId` | `string` | Merchant identifier |
| `merchantName` | `string` | Optional merchant name (default: "Oern") |
| `onConfirmed` | `() => void` | Callback when payment is confirmed |
| `onCancel` | `() => void` | Callback when user cancels |

### 2. `PickupAddressSummary`

Displays pickup and delivery addresses in a compact, read-only format without requiring map interaction.

#### Features
- **Address Display**: Shows pickup and delivery locations with icons
- **Edit Button**: Navigate back to address selection
- **Map Launcher**: Optional button to view addresses on map
- **Empty State**: Helpful message when no addresses are set
- **Mobile Responsive**: Stacks vertically on mobile

#### Usage

```tsx
import { PickupAddressSummary } from "@/components/delivery/pickup-address-summary";

export function AddressSummaryExample() {
  return (
    <PickupAddressSummary
      pickupAddress={{
        text: "123 Main Street, Yangon",
        point: { latitude: 16.8409, longitude: 96.1735 }
      }}
      deliveryAddress={{
        text: "456 Commerce Road, Yangon",
        point: { latitude: 16.8600, longitude: 96.1900 }
      }}
      onEdit={() => console.log("Edit addresses")}
      onOpenMap={() => console.log("View map")}
      showEdit={true}
    />
  );
}
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `pickupAddress` | `Address \| null` | Pickup location |
| `deliveryAddress` | `Address \| null` | Delivery location |
| `onEdit` | `() => void` | Handler for edit button |
| `onOpenMap` | `() => void` | Handler for map view button |
| `isLoading` | `boolean` | Show loading state |
| `showEdit` | `boolean` | Show edit button (default: true) |

### 3. `PaymentPageLayout`

Complete payment page layout combining address summary, fee breakdown, and payment method selection.

#### Features
- **Address Summary**: Non-editable address display
- **Fee Breakdown**: Line-item fee display with total
- **Payment Method Selection**: MMQR, CTZPay, or COD
- **Sticky Action Buttons**: Always visible payment and cancel buttons
- **MMQR Flow Integration**: Seamless transition to QR payment
- **Responsive Design**: Mobile-first with desktop optimization

#### Usage

```tsx
import { PaymentPageLayout } from "@/components/delivery/payment-page-layout";

export function PaymentPageExample() {
  const [method, setMethod] = useState<PaymentMethod>("mmqr");

  return (
    <PaymentPageLayout
      pickupAddress={{
        text: "123 Main Street",
        point: { latitude: 16.8409, longitude: 96.1735 }
      }}
      deliveryAddress={{
        text: "456 Commerce Road",
        point: { latitude: 16.8600, longitude: 96.1900 }
      }}
      feeEstimate={{
        lines: [
          { id: "base", label: "Delivery fee", amount: 4000 },
          { id: "discount", label: "Loyalty discount", amount: -500 }
        ],
        total: 3500,
        distanceKm: 5.2
      }}
      paymentMethod={method}
      onPaymentMethodChange={setMethod}
      onEditAddresses={() => navigate("/pickup")}
      onViewMap={() => openMap()}
      onPaymentSuccess={() => navigate("/pickup/review")}
      onBack={() => navigate(-1)}
    />
  );
}
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `pickupAddress` | `Address \| null` | Pickup location |
| `deliveryAddress` | `Address \| null` | Delivery location |
| `feeEstimate` | `FeeEstimate \| null` | Delivery fee breakdown |
| `paymentMethod` | `PaymentMethod` | Selected payment method |
| `onPaymentMethodChange` | `(method) => void` | Handler for method change |
| `onEditAddresses` | `() => void` | Handler for edit addresses |
| `onViewMap` | `() => void` | Handler for view map |
| `onPaymentSuccess` | `() => void` | Called on successful payment |
| `onBack` | `() => void` | Handler for back/cancel |
| `isLoading` | `boolean` | Show loading state |
| `merchantId` | `string` | Merchant ID for MMQR (default: "oern-merchant") |
| `merchantName` | `string` | Merchant name for MMQR (default: "Oern") |
| `title` | `string` | Page title (default: "Payment") |

## Integration with Existing Components

These new components work seamlessly with existing Oern payment components:

- **`PaymentMethodPicker`**: Used within `PaymentPageLayout` for method selection
- **`FeeBreakdown`**: Referenced for fee display patterns
- **`AddressField`**: Used in earlier pickup flow steps
- **`payment-methods.ts`**: Type definitions and utilities

## Design System

All components follow Oern's design system from `DESIGN.md`:

### Colors
- **Primary Action**: `#c2410c` (kiln-orange)
- **Primary Pressed**: `#9a3412` (kiln-orange-pressed)
- **Accent**: `#f97316` (signal-orange)
- **Text Primary**: `#172b4d` (dispatch-navy)
- **Text Secondary**: `#64748b` (control-slate)
- **Background**: `#f8fafc` (canvas)
- **Surface**: `#ffffff` (surface)
- **Blue (Live)**: `#2563eb` (live-blue)
- **Green (Success)**: `#16a34a` (delivered-green)
- **Red (Error)**: `#dc2626` (failed-red)

### Typography
- **Headline**: 20px, fontWeight 750
- **Title**: 16px, fontWeight 700
- **Body**: 14px, fontWeight 400
- **Button**: 16px, fontWeight 600

### Spacing & Borders
- **Button Height**: 56px
- **Border Radius (Buttons)**: 999px (pill shape)
- **Border Radius (Cards)**: 12px
- **Spacing Units**: 4px, 8px, 12px, 16px, 24px

## MMQR SDK (`mmqr-sdk.ts`)

Mock implementation of MMQR payment services for development and testing.

### Key Functions

#### `generateMMQRQRCode(request)`
Generates a mock QR code for payment.

```ts
const qr = await generateMMQRQRCode({
  merchantId: "oern-merchant",
  amount: 5000,
  reference: "PKP-123456",
  merchantName: "Oern"
});
// Returns: { dataUrl, qrText, request }
```

#### `downloadQRCode(qrCode, filename?)`
Downloads QR code as PNG image.

```ts
downloadQRCode(qrCode, "payment-qr.png");
```

#### `confirmMMQRPayment(reference, timeoutMs?)`
Simulates payment confirmation polling (2-minute default timeout).

```ts
const confirmed = await confirmMMQRPayment("PKP-123456");
```

## Mobile UX

All components are optimized for mobile-first experience:

- **Sticky Headers**: Navigation stays visible during scroll
- **Full-Width Buttons**: 56px height for easy touch
- **Responsive Layout**: Adapts to phone screens (390px+)
- **Touch-Friendly**: Adequate tap targets (48px minimum)
- **Scrollable Content**: Centered max-width (800px) with mobile padding

## State Flow Diagram

```
┌─────────────────────────────────────────────────┐
│  PaymentPageLayout (Main Container)             │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ PickupAddressSummary (Read-only)           │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ Fee Breakdown Display                       │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ [Show MMQR Flow OR Payment Method Picker]  │ │
│  │                                             │ │
│  │ If !showMMQRFlow:                          │ │
│  │ ├─ PaymentMethodPicker                     │ │
│  │ └─ Action Buttons                          │ │
│  │                                             │ │
│  │ If showMMQRFlow:                           │ │
│  │ └─ MMQRPaymentFlow                         │ │
│  │    ├─ Ready State                          │ │
│  │    ├─ QR Display (2-min countdown)         │ │
│  │    ├─ Loading State                        │ │
│  │    └─ Confirmed State                      │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Testing

### Manual Testing Checklist
- [ ] QR code displays correctly
- [ ] Countdown timer counts down for 2 minutes
- [ ] Save QR button downloads image
- [ ] Loading state appears after timeout
- [ ] Payment confirmation works
- [ ] Cancel button returns to payment method selection
- [ ] Mobile layout stacks properly
- [ ] Address summary shows correctly
- [ ] Fee breakdown displays all line items

### Component Integration
- [ ] Works with existing `PaymentMethodPicker`
- [ ] Integrates with `PickupRequestPage`
- [ ] Uses existing type definitions
- [ ] Follows Oern design system

## Future Enhancements

1. **Real MMQR Integration**: Connect to actual MMQR provider API
2. **Payment Retry Logic**: Allow retry on failed payments
3. **Multi-Currency**: Support other currencies
4. **Transaction History**: Save payment records to Supabase
5. **Receipt Generation**: Email/SMS receipt after payment
6. **Biometric Authentication**: Fingerprint/face ID for mobile

## Files

### New Files Created
- `/src/lib/delivery/mmqr-sdk.ts` - Mock MMQR SDK
- `/src/components/delivery/mmqr-payment-flow.tsx` - QR payment flow
- `/src/components/delivery/pickup-address-summary.tsx` - Address display
- `/src/components/delivery/payment-page-layout.tsx` - Full payment page

### Modified Files
- None (all new components, backward compatible)

### Related Files
- `/src/components/delivery/payment-picker.tsx` - Payment method selection
- `/src/lib/delivery/payment-methods.ts` - Type definitions
- `/src/components/delivery/pickup-request.tsx` - Main pickup flow

## Support

For questions or issues, refer to:
- `DESIGN.md` - Design system documentation
- `PRODUCT.md` - Product requirements
- `/src/lib/delivery/payment-methods.ts` - Payment types and utilities
