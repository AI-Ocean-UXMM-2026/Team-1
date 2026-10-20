# Door-to-Door Delivery Platform

A delivery operations platform connecting customers, managers, and drivers/riders in one workflow. Its defining capability is giving customers visibility into their parcel's journey: once a driver or rider receives the parcel, the customer can follow its live location and delivery status until it arrives.

## Interfaces

- **Centralized management:** Managers create and manage orders, addresses, parcels, and cash-on-delivery (COD) amounts; manage drivers and vehicles; assign deliveries; and monitor active, completed, and failed deliveries.
- **Driver/rider:** Drivers and riders view assigned tasks, accept and start deliveries, navigate to destinations, plan multi-stop routes, update delivery status, and record collected COD payments.
- **Customer:** Customers view their order status and COD details, receive status and pre-arrival notifications, and track the driver's/rider's location and estimated time of arrival (ETA) while the parcel is in transit.

## Current application

The three interfaces share Supabase Auth and delivery data, with separate URLs:

| Interface | URL | Available workflow |
| --- | --- | --- |
| Customer | `/` | Sign in or create a customer account; follow own orders on a map with location updates, status history, ETA, and COD details. |
| Driver/rider | `/rider` | Accept assigned tasks, confirm parcel pickup, share GPS for every collected parcel, open navigation, record COD, and complete or report a failed delivery. |
| Centralized management | `/manager` | Create orders with optional map pins, assign registered riders and vehicles, manage rider availability, filter deliveries, and monitor active riders on a map. |

The default interface is the customer app. Next.js Proxy redirects signed-in team accounts to the workspace matching their profile role; Supabase row-level security controls which records each account can read or change. Managers and riders use accounts provisioned through a trusted administrative process. A rider needs both a `driver` profile role and a `driver_profiles` record before assignment.

Signed-out visitors and accounts with no orders see clearly labeled sample deliveries. Changes to sample tasks and assignments remain in browser memory and disappear on reload. A signed-in manager can create the first real order using a real customer account; the creation form identifies whether it will save a real or sample delivery. Samples are never inserted into Supabase.

## Customer tracking flow

1. The order is created and assigned to a driver or rider.
2. Location sharing for the customer-facing delivery view begins when the driver or rider receives the parcel.
3. The customer can follow the driver's/rider's live location, delivery status, and ETA while the parcel is in transit.
4. Tracking ends when the delivery is marked delivered or otherwise closed, with the final status available to the customer.

Rider pickup confirmation enables browser GPS sharing after location permission is granted. One GPS watch updates every collected parcel assigned to that rider, even when another task is selected. Customer and management maps subscribe to Supabase Realtime; reconnection and periodic refresh reconcile missed updates and new assignments. Tracking stops for an order when it is delivered, failed, or cancelled. Stale points are identified as last-known locations.

GPS sharing requires the rider app to remain open. Browser tracking does not provide reliable background operation when the phone locks or the app closes. ETA currently uses the order's saved estimate; predictive ETA, automatic street routing, push/SMS notifications, and native background tracking remain future work. Map lines show parcel positions and destinations; navigation opens Google Maps.

## Product capabilities

- **Orders and fleet:** Manage delivery orders, addresses, parcels, COD, drivers, vehicles, availability, and delivery assignments.
- **Delivery operations:** Monitor delivery progress, plan routes across multiple stops, and manage delivered or failed outcomes.
- **Customer visibility:** Show delivery status, live location during transit, ETA, COD amount and payment status, and timely notifications.
- **Intelligence and automation:** Progress toward assignment recommendations, route optimization, predictive ETA, exception alerts, and fuel- or battery-aware planning.

## Development roadmap

Priorities describe the intended delivery sequence; they do not indicate that the features are already implemented.

### P0 · Core launch workflows

Order and fleet management, manual delivery assignment with basic recommendations, driver task handling and navigation, multi-stop route planning, delivery status and COD recording, customer tracking after parcel pickup with ETA and notifications, and manager monitoring.

### P1 · Intelligence and automation

Automated assignment and route recommendations, validated driver-submitted local road knowledge, fuel and battery assistance, predictive ETA, delayed-delivery detection and alerts, operational analytics, and seller order and COD views.

### P2 · Advanced optimization and integrations

Learned route preferences, fuel and delivery cost analysis, vehicle maintenance history, COD reconciliation, customer support tools, e-commerce integrations, and multi-provider customer tracking.

## Development

This project uses Next.js 16, React 19, TypeScript, and Bun. Install dependencies and start the development server with:

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app. Available checks and production commands are:

```bash
bun run lint
bun run test
bun run build
bun run start
```

The regression tests use Node's built-in test runner with TypeScript stripping (Node 22.18 or later). They cover multi-parcel GPS sharing, lifecycle cleanup, location freshness, and workspace Realtime updates. SQL workflow checks in `supabase/tests/delivery_workflows.sql` run inside a transaction and roll back their fixture records.

## Supabase

The app connects to Supabase through browser and server clients. Copy the following variables into the root `.env.local` file and use the project-specific values from the Supabase dashboard:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

The core delivery schema is versioned in `supabase/migrations/`. It includes profile roles, orders, fleet, routes and stops, assignment, COD, status history, notifications, and delivery locations. Customer location access is limited to their own orders after pickup and while the delivery is active. Manager and driver roles must be assigned through a trusted administrative process; signups default to the customer role.
