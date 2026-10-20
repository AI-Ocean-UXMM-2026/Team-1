# Door-to-Door Delivery Platform

A delivery operations platform connecting customers, managers, drivers/riders, sellers, and support teams in one workflow. Its defining capability is giving customers visibility into their parcel's journey: once a driver or rider receives the parcel, the customer can follow its live location and delivery status until it arrives.

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
| Fleet insights | `/manager/insights` | Review route energy readiness, update vehicle range and reserve settings, schedule maintenance, and analyze delivery costs. |
| Seller | `/seller` | Submit delivery requests, register commerce channels, import external orders, and monitor a unified order queue. |
| Customer support | `/support` | Search delivery history, investigate provider context, assign cases, and record resolutions. |

The default interface is the customer app. Next.js Proxy redirects signed-in team accounts to the workspace matching their profile role; Supabase row-level security controls which records each account can read or change. Managers, riders, sellers, and support staff use accounts provisioned through a trusted administrative process. A rider needs both a `driver` profile role and a `driver_profiles` record before assignment.

Signed-out visitors and accounts with no orders see clearly labeled sample deliveries. Changes to sample tasks and assignments remain in browser memory and disappear on reload. A signed-in manager can create the first real order using a real customer account; the creation form identifies whether it will save a real or sample delivery. Samples are never inserted into Supabase.

## Customer tracking flow

1. The order is created and assigned to a driver or rider.
2. Location sharing for the customer-facing delivery view begins when the driver or rider receives the parcel.
3. The customer can follow the driver's/rider's live location, delivery status, and ETA while the parcel is in transit.
4. Tracking ends when the delivery is marked delivered or otherwise closed, with the final status available to the customer.

Rider pickup confirmation enables browser GPS sharing after location permission is granted. One GPS watch updates every collected parcel assigned to that rider, even when another task is selected. Customer and management maps subscribe to Supabase Realtime; reconnection and periodic refresh reconcile missed updates and new assignments. Tracking stops for an order when it is delivered, failed, or cancelled. Stale points are identified as last-known locations.

GPS sharing requires the rider app to remain open. Browser tracking does not provide reliable background operation when the phone locks or the app closes. ETA is recalculated from route progress, the assigned vehicle's expected speed, and verified rider road reports. It is an operational estimate rather than live traffic-provider routing. Automatic street routing, push/SMS notifications, and native background tracking remain future work. Map lines show parcel positions and destinations; navigation opens Google Maps.

## Product capabilities

- **Orders and fleet:** Manage delivery orders, addresses, parcels, COD, drivers, vehicles, availability, and delivery assignments.
- **Delivery operations:** Monitor delivery progress, plan routes across multiple stops, and manage delivered or failed outcomes.
- **Customer visibility:** Show delivery status, live location during transit, ETA, COD amount and payment status, and timely notifications.
- **Energy-aware operations:** Estimate route distance from saved pins, compare it with vehicle range and reserve settings, and flag deliveries that need charging or refueling attention.
- **Seller and support operations:** Accept seller delivery requests and external order imports, monitor provider shipments, and manage customer support cases.
- **Fleet and cost analytics:** Record maintenance history, due service, fuel, charging, toll, labor, and other delivery costs.
- **Integrations:** Register commerce or logistics providers and combine local and external shipments in customer, seller, and support views.
- **Intelligence and automation:** Explainable rider and vehicle recommendations, route-progress ETA predictions, and manager-verified road knowledge, with automatic street routing and exception alerts still to come.

## Development roadmap

Priorities describe the delivery sequence. Device 2 operational workflows are present in the current application; the intelligence work assigned to Device 1 is integrated separately before the combined release.

### P0 · Core launch workflows

Order and fleet management, manual delivery assignment with basic recommendations, driver task handling and navigation, multi-stop route planning, delivery status and COD recording, customer tracking after parcel pickup with ETA and notifications, and manager monitoring.

### P1 · Intelligence and automation

Explainable assignment recommendations, validated driver-submitted local road knowledge, predictive ETA, fuel and battery route readiness, and seller order views are available in the current application. Automated assignment, automatic street routing, delayed-delivery alerts, and deeper operational analytics remain planned.

### P2 · Advanced optimization and integrations

Learned route preferences, delivery cost analysis, vehicle maintenance history, COD reconciliation, customer support tools, e-commerce channel registration, external order imports, and multi-provider customer tracking.

## Device 2 implementation notes

- Fuel and battery readiness uses the rider's latest shared location, pickup and destination pins, and each vehicle's configured full range and reserve percentage. It provides an operational estimate and does not yet use traffic, elevation, charging availability, or turn-by-turn routing.
- Commerce and logistics connections currently support provider registration and manual external-order imports. Live provider API credentials, webhooks, catalog sync, and automatic fulfillment updates require provider-specific adapters.
- Seller and support roles must be assigned through the same trusted administrative process used for manager and driver accounts.
- Vehicle maintenance and delivery costs are recorded in Supabase and summarized in the manager insights view. The analytics reflect entered records rather than accounting-system reconciliation.

## Documentation

- [Project and product flow](docs/PROJECT_FLOW.md) explains role workspaces, the delivery lifecycle, live tracking, intelligence, integrations, architecture, and the contribution flow.
- [Testing guide](docs/TESTING.md) covers setup, automated checks, database assertions, test accounts, manual role-by-role verification, and Realtime troubleshooting.

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

The regression tests use Node's built-in test runner with TypeScript stripping (Node 22.18 or later). They cover assignment recommendations, multi-parcel GPS sharing, lifecycle cleanup, location freshness, and workspace Realtime updates. SQL workflow checks in `supabase/tests/delivery_workflows.sql` run inside a transaction and roll back their fixture records.

## Supabase

The app connects to Supabase through browser and server clients. Copy the following variables into the root `.env.local` file and use the project-specific values from the Supabase dashboard:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

The delivery schema is versioned in `supabase/migrations/`. It includes profile roles, orders, fleet, routes and stops, assignment, COD, status history, notifications, delivery locations, vehicle maintenance, delivery costs, support cases, commerce integrations, and external shipments. Customer location access is limited to their own orders after pickup and while the delivery is active. Team roles must be assigned through a trusted administrative process; signups default to the customer role.
