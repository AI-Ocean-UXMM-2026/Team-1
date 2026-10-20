# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Managers** coordinate delivery orders, drivers, vehicles, and active operations from a centralized workspace.
- **Drivers and riders** use the app on the move to manage assigned parcels, update delivery progress, and share location after pickup.
- **Customers** sign in to follow their own parcel's status, live location, ETA, and cash-on-delivery details.

## Product Purpose

Coordinate door-to-door deliveries across customers, managers, and drivers. Success means customers can see where their parcel is from driver handoff through delivery, while managers and drivers can keep each order moving through a clear shared workflow.

## Positioning

Customer-visible live parcel tracking begins when a driver or rider receives the parcel and continues through delivery completion.

## Operating Context

Managers handle multiple active orders and fleet availability. Drivers and riders need a concise mobile-friendly task view that works during a delivery shift. Customers need a simple way to find their own orders and understand the latest delivery status.

## Capabilities and Constraints

- The existing Supabase schema covers profiles, orders, assignments, routes, vehicles, live locations, COD, status events, and notifications.
- Customer tracking requires sign-in and is limited to the customer's own orders under the current row-level security policies.
- Driver location sharing must start after parcel pickup, use browser location permission, and stop when the delivery closes.
- Manager and driver roles are provisioned through a trusted administrative process; public signups default to customer.
- Sample records used to preview empty interfaces must be labeled as demo data and must not be written to Supabase.
- Customer, rider, and management interfaces are available at `/`, `/rider`, and `/manager`, with role redirects and data access enforced by Supabase row-level security.
- Rider GPS sharing updates all collected assigned parcels while the app stays open; customer and manager maps receive Realtime location and status updates. Browser permission is required and background tracking is not guaranteed.
- Manager dispatch includes order creation, optional map pins, atomic assignment, and rider availability controls. Rider workflows include acceptance, pickup, navigation, COD recording, completion, and delivery issue reporting.
- ETA uses the order's saved estimate. Automated route optimization, predictive ETA, and push/SMS notifications remain planned capabilities.

## Evidence on Hand

- The product workflow and P0/P1/P2 roadmap are documented in `README.md`.
- Supabase schema and RLS policies are in `supabase/migrations/`.
- No approved brand identity, customer testimonials, operational benchmarks, or production imagery are present in the repository.

## Product Principles

- Put customer visibility from pickup through arrival at the center of the product.
- Show each role the information and actions needed for its part of the delivery.
- Keep customer, manager, and driver access bounded by authenticated account roles and order ownership.
- Clearly distinguish preview data from records stored in Supabase.
