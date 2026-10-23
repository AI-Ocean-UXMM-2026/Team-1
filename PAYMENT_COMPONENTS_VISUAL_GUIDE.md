# Payment Components - Visual & Integration Guide

## Component Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     /pickup/payment                              │
│              (Enhanced with New Components)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              PaymentPageLayout (Full Container)                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Header with Back Button & Title                 │  │
│  │              "Payment"                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │    PickupAddressSummary (Read-Only Addresses)           │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │                                                    │ │  │
│  │  │  🟠 PICKUP              ┌──────┐                │ │  │
│  │  │     123 Main Street     │ Edit │                │ │  │
│  │  │                                                  │ │  │
│  │  │           ↓                                      │ │  │
│  │  │                                                  │ │  │
│  │  │  🔵 DELIVERY            ┌──────────┐           │ │  │
│  │  │     456 Commerce Road   │ View Map │           │ │  │
│  │  │                                                  │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Fee Breakdown (Line Items)                      │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ Delivery fee                        4,000 MMK      │ │  │
│  │  │ Loyalty discount                   −500 MMK       │ │  │
│  │  │ ─────────────────────────────────────────────────  │ │  │
│  │  │ Total fee                           3,500 MMK      │ │  │
│  │  │                                                    │ │  │
│  │  │ Distance: 5.2 km                                  │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │    PaymentMethodPicker (Existing Component)             │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │ ◉ MMQR                                            │ │  │
│  │  │   Scan with any bank or wallet app               │ │  │
│  │  │ ○ CTZPay                                          │ │  │
│  │  │   CTZPay is part of MMQR                         │ │  │
│  │  │ ○ Cash on Delivery                               │ │  │
│  │  │   The rider collects cash                        │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │     [Conditional] MMQRPaymentFlow (QR Payment)         │  │
│  │              (Only when MMQR selected)                 │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │                                                    │ │  │
│  │  │  State 1: Ready → State 2: Generating            │ │  │
│  │  │     ┌──────────────┐                             │ │  │
│  │  │     │ Start Payment │  → Loading spinner         │ │  │
│  │  │     └──────────────┘                             │ │  │
│  │  │                                                  │ │  │
│  │  │  State 3: QR Display (2-min countdown)          │ │  │
│  │  │  ┌────────────────────────────────────────────┐ │ │  │
│  │  │  │  Scan with your bank or wallet app       │ │ │  │
│  │  │  │                                           │ │ │  │
│  │  │  │  ╔═══════════════════════════╗          │ │ │  │
│  │  │  │  ║                           ║          │ │ │  │
│  │  │  │  ║     ▓▓▓▓▓▓▓▓▓▓▓▓        ║          │ │ │  │
│  │  │  │  ║     ▓  QR  ▓  ▓        ║  300x300 │ │ │  │
│  │  │  │  ║     ▓▓▓▓▓▓▓▓▓▓▓▓        ║          │ │ │  │
│  │  │  │  ║                           ║          │ │ │  │
│  │  │  │  ╚═══════════════════════════╝          │ │ │  │
│  │  │  │                                           │ │ │  │
│  │  │  │  Reference: PKP-123456                    │ │ │  │
│  │  │  │                                           │ │ │  │
│  │  │  │  ┌─────────────────────────────────────┐ │ │ │  │
│  │  │  │  │  Timer: 2:00 → 0:00                │ │ │ │  │
│  │  │  │  │  (Red when <30 seconds)            │ │ │ │  │
│  │  │  │  └─────────────────────────────────────┘ │ │ │  │
│  │  │  │                                           │ │ │  │
│  │  │  │  ┌─────────────────────────────────────┐ │ │ │  │
│  │  │  │  │     Save QR Code                    │ │ │ │  │
│  │  │  │  └─────────────────────────────────────┘ │ │ │  │
│  │  │  │  ┌─────────────────────────────────────┐ │ │ │  │
│  │  │  │  │  Cancel & Go Back                   │ │ │ │  │
│  │  │  │  └─────────────────────────────────────┘ │ │ │  │
│  │  │  └────────────────────────────────────────────┘ │ │  │
│  │  │                                                  │ │  │
│  │  │  State 4: Loading (After 2-min timeout)       │ │  │
│  │  │  ┌────────────────────────────────────────────┐ │ │  │
│  │  │  │  ⟳ Confirming payment...                │ │ │  │
│  │  │  │  Please wait while we confirm your     │ │ │  │
│  │  │  │  payment                                │ │ │  │
│  │  │  └────────────────────────────────────────────┘ │ │  │
│  │  │                                                  │ │  │
│  │  │  State 5: Confirmed (1-30 seconds)            │ │  │
│  │  │  ┌────────────────────────────────────────────┐ │ │  │
│  │  │  │             ✓                              │ │ │  │
│  │  │  │                                            │ │ │  │
│  │  │  │  Payment confirmed!                       │ │ │  │
│  │  │  │  3,500 MMK has been received              │ │ │  │
│  │  │  │                                            │ │ │  │
│  │  │  │  Reference: PKP-123456                    │ │ │  │
│  │  │  └────────────────────────────────────────────┘ │ │  │
│  │  │                                                  │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Sticky Action Buttons (56px height)             │  │
│  │  ┌─ Full width on mobile, centered on desktop ────────┐ │  │
│  │  │                                                     │ │  │
│  │  │  [  Pay 3,500 MMK Now  ]  (Orange - Primary)      │ │  │
│  │  │  [  Pass to Receiver   ]  (Outline - Secondary)   │ │  │
│  │  │                                                     │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component State Transitions

```
MMQRPaymentFlow State Machine:

          ┌──────────┐
          │  Ready   │ ← Initial state
          └─────┬────┘
                │ Click "Start Payment"
                ↓
          ┌──────────────┐
          │  Generating  │ ← Loading spinner (~300ms)
          └─────┬────────┘
                │ QR generated
                ↓
          ┌──────────────┐
          │ QR-Display   │ ← 2-minute countdown
          │              │   Can save QR
          │  2:00 → 0:00 │   User scans with phone
          └─────┬────────┘
                │ Timeout or user scans
                ↓
          ┌──────────────┐
          │   Loading    │ ← Waiting for payment confirmation
          │   ⟳  ...     │   1-30 seconds (mocked)
          └─────┬────────┘
                │ Payment confirmed
                ↓
          ┌──────────────┐
          │ Confirmed    │ ← Success state ✓
          │   Payment OK │   Ready to proceed
          └──────────────┘
                │
                └─→ Navigate to next step
                    or call onConfirmed callback
```

## Mobile vs Desktop Layout

### Mobile (390px - 599px)
```
┌──────────────────────┐
│ ← Payment            │
└──────────────────────┘
┌──────────────────────┐
│ ADDRESSES            │
│ ┌────────────────┐   │
│ │ 🟠 Pickup      │   │
│ │ 123 Main       │   │
│ │ [Edit]         │   │
│ └────────────────┘   │
│ ┌────────────────┐   │
│ │ 🔵 Delivery    │   │
│ │ 456 Commerce   │   │
│ │ [View Map]     │   │
│ └────────────────┘   │
└──────────────────────┘
   ↓ (Scroll)
┌──────────────────────┐
│ FEES                 │
│ Delivery: 4,000      │
│ Discount: -500       │
│ Total:   3,500       │
└──────────────────────┘
   ↓ (Scroll)
┌──────────────────────┐
│ PAYMENT METHOD       │
│ ◉ MMQR               │
│ ○ CTZPay             │
│ ○ Cash               │
└──────────────────────┘
   ↓ (Scroll)
┌──────────────────────┐
│ [Pay 3,500 Now     ] │
│ [Pass to Receiver   ]│
└──────────────────────┘
```

### Desktop (900px+)
```
┌──────────────────────────────────────────────────────┐
│ ← Payment                                             │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ ┌─────────────────┐      ┌────────────────────────┐  │
│ │ ADDRESSES       │      │ FEES                   │  │
│ │ 🟠 Pickup       │      │ Delivery: 4,000        │  │
│ │ 123 Main        │      │ Discount: -500         │  │
│ │ 🔵 Delivery     │      │ Total:    3,500        │  │
│ │ 456 Commerce    │      │                        │  │
│ │                 │      │ Distance: 5.2 km       │  │
│ │ [Edit] [Map]    │      │                        │  │
│ └─────────────────┘      └────────────────────────┘  │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ PAYMENT METHOD                                        │
│ ◉ MMQR        ○ CTZPay        ○ Cash on Delivery    │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ [Pay 3,500 MMK Now]    [Pass to Receiver]            │
└──────────────────────────────────────────────────────┘
```

## Color Scheme

```
Primary Elements:
  Button (Primary):      #c2410c (Kiln Orange) ← Pay Now
  Button (Secondary):    #ffffff (White) ← Pass to Receiver
  Button (Hover):        #9a3412 (Darker Orange)

Text:
  Primary:               #172b4d (Dispatch Navy) ← Headings
  Secondary:             #64748b (Control Slate) ← Descriptions
  Accent:                #f97316 (Signal Orange) ← Important

Backgrounds:
  Page:                  #f8fafc (Canvas - Light Gray)
  Cards:                 #ffffff (Surface - White)
  Hover:                 #f1f5f9 (Subtle - Very Light Gray)

Status Colors:
  Success (Confirmed):   #16a34a (Delivered Green) ✓
  Info (Loading):        #2563eb (Live Blue) ⟳
  Warning (Timer <30s):  #dc2626 (Failed Red) ⏱️
  Error:                 #dc2626 (Failed Red) ✗

Address Icons:
  Pickup:                #f97316 (Orange) - Warm start
  Delivery:              #2563eb (Blue) - Cool end
```

## Typography Hierarchy

```
Page Title:        "Payment"                  h6 (20px, 750 weight)
Section Title:     "Addresses", "Fees"        subtitle1 (16px, 700)
Body Text:         Descriptions, Labels       body1 (14px, 400)
Small Text:        "Reference", "Distance"    caption (12px, 500)

Button Text:       "Pay Now", "Edit"          button (16px, 600)
```

## Button Specifications

```
Primary Button (Pay Now):
  ├─ Background:   #c2410c (Kiln Orange)
  ├─ Text Color:   #ffffff (White)
  ├─ Height:       56px
  ├─ Border Radius: 999px (Pill shape)
  ├─ Font Weight:  600
  ├─ Width:        Full on mobile, auto on desktop
  └─ Hover State:  #9a3412 (Darker)

Secondary Button (Pass to Receiver):
  ├─ Background:   #ffffff (White)
  ├─ Border:       1px #cbd5e1 (Hairline)
  ├─ Text Color:   #172b4d (Navy)
  ├─ Height:       56px
  ├─ Border Radius: 8px
  ├─ Font Weight:  600
  └─ Hover State:  #f1f5f9 (Subtle bg)

Edit Button (Small):
  ├─ Background:   Transparent
  ├─ Text Color:   #2563eb (Blue)
  ├─ Font Size:    14px
  ├─ Height:       Auto
  └─ Hover State:  #dbeafe (Light blue bg)

Address Box:
  ├─ Background:   #f8fafc (Canvas)
  ├─ Border:       1px #e2e8f0
  ├─ Border Radius: 8px
  ├─ Padding:      16px
  ├─ Icon Size:    36px
  └─ Icon Radius:  50% (Circle)
```

## Spacing & Layout Grid

```
Component Spacing:
  xs: 4px   - Micro spacing
  sm: 8px   - Small spacing
  md: 12px  - Medium spacing (section dividers)
  lg: 16px  - Large spacing (default padding)
  xl: 24px  - Extra large spacing (section separation)

Container Max-Width: 800px
Mobile Padding:      16px
Desktop Padding:     24px

Card Padding:        24px
Card Gap:            12px
Button Height:       56px
Icon Size:           36px (address), 48px (main)
```

## Interaction Patterns

### Gesture Interactions (Mobile)
```
Tap:
  ├─ Buttons:         Instant feedback (ripple)
  ├─ Edit:            Navigate to /pickup
  ├─ View Map:        Navigate to map view
  └─ Save QR:         Download QR image

Scroll:
  ├─ Vertical:        Smooth scroll
  ├─ Sticky Header:   Stays visible at top
  ├─ Sticky Buttons:  Stay visible at bottom
  └─ Content:         Centered with max-width

Long Press:
  └─ Future:          Copy reference code option
```

### Keyboard Interactions (Desktop)
```
Tab:
  ├─ Navigates:       Through buttons & interactive elements
  ├─ Focus Ring:      2px outline around focused element
  └─ Order:           Top-to-bottom, left-to-right

Enter/Space:
  ├─ Buttons:         Activate button action
  └─ Radio:           Select payment method

Escape:
  └─ Future:          Close any modals
```

## Animation & Transitions

```
Fade In:
  ├─ Duration:  200ms
  └─ Easing:    ease-in-out

Slide Down:
  ├─ Duration:  300ms
  ├─ Direction: Top to bottom
  └─ Used for:  Address boxes, fee breakdown

Color Transition:
  ├─ Duration:  300ms
  ├─ Property:  background-color
  └─ Used for:  Timer (yellow → red)

Countdown:
  ├─ Duration:  Linear 120 seconds
  ├─ Update:    Every 1 second
  └─ Display:   MM:SS format

Loading Spinner:
  ├─ Duration:  Continuous rotation
  ├─ Speed:     ~1 rotation/second
  └─ Color:     Blue (#2563eb)
```

## Accessibility Features

```
ARIA Labels:
  ├─ Form fields:   aria-label / aria-describedby
  ├─ Buttons:       Clear, descriptive text
  ├─ Status:        aria-live="polite" for timer
  └─ Errors:        aria-invalid, aria-describedby

Keyboard Navigation:
  ├─ All interactive:  Tab-reachable
  ├─ Focus visible:   2px outline
  ├─ Logical order:   Top-to-bottom
  └─ Focus trap:      None (open navigation)

Color Contrast:
  ├─ Text/Background: ≥4.5:1 ratio (WCAG AA)
  ├─ Icon/Background: ≥3:1 ratio
  └─ No color alone:  Text + icon for status

Screen Reader:
  ├─ Semantic HTML:   Proper headings, lists
  ├─ Button roles:    Correct button elements
  ├─ Form labels:     Associated with inputs
  └─ Live regions:    Timer updates announced
```

## Integration Checklist

Before deployment:

- [ ] Components compile without errors
- [ ] TypeScript types all correct
- [ ] Mobile responsiveness tested (320px+)
- [ ] Desktop layout verified (900px+)
- [ ] Colors match DESIGN.md spec
- [ ] Typography sizes correct
- [ ] Button sizes 56px (touch-friendly)
- [ ] Keyboard navigation works
- [ ] Screen reader announces updates
- [ ] Animation smooth (60fps)
- [ ] QR code generates
- [ ] Timer counts down correctly
- [ ] State transitions smooth
- [ ] Payment confirmation works
- [ ] No console errors
- [ ] Performance acceptable
- [ ] All documentation reviewed

## Quick Reference

### Import Statements
```tsx
import { PaymentPageLayout } from "@/components/delivery/payment-page-layout";
import { MMQRPaymentFlow } from "@/components/delivery/mmqr-payment-flow";
import { PickupAddressSummary } from "@/components/delivery/pickup-address-summary";
import { generateMMQRQRCode } from "@/lib/delivery/mmqr-sdk";
```

### Type Imports
```tsx
import type { PaymentMethod } from "@/lib/delivery/payment-methods";
import type { FeeEstimate } from "@/lib/delivery/delivery-fee";
import type { MapPoint } from "@/lib/delivery/map-projection";
```

### Common Props
```tsx
// Address object
{ text: string; point?: MapPoint }

// Fee estimate
{ lines: Array<{id: string, label: string, amount: number}>, total: number, distanceKm: number }

// Payment method
"mmqr" | "ctzpay" | "cod"
```

---

**Last Updated**: October 23, 2026  
**Version**: 1.0 (Production Ready)  
**Compatibility**: Next.js 16.4.2, React 19.3.0, MUI 9.5.0
