# Door-to-Door Delivery Platform

A delivery operations platform connecting customers, managers, and drivers/riders in one workflow. Its defining capability is giving customers visibility into their parcel's journey: once a driver or rider receives the parcel, the customer can follow its live location and delivery status until it arrives.

## Interfaces

- **Centralized management:** Managers create and manage orders, addresses, parcels, and cash-on-delivery (COD) amounts; manage drivers and vehicles; assign deliveries; and monitor active, completed, and failed deliveries.
- **Driver/rider:** Drivers and riders view assigned tasks, accept and start deliveries, navigate to destinations, plan multi-stop routes, update delivery status, and record collected COD payments.
- **Customer:** Customers view their order status and COD details, receive status and pre-arrival notifications, and track the driver's/rider's location and estimated time of arrival (ETA) while the parcel is in transit.

## Customer tracking flow

1. The order is created and assigned to a driver or rider.
2. Location sharing for the customer-facing delivery view begins when the driver or rider receives the parcel.
3. The customer can follow the driver's/rider's live location, delivery status, and ETA while the parcel is in transit.
4. Tracking ends when the delivery is marked delivered or otherwise closed, with the final status available to the customer.

Live location tracking is a product goal. The current application is a Next.js starter and does not yet implement GPS collection, location sharing, or delivery workflows.

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
bun run build
bun run start
```

## Supabase

The app connects to Supabase through browser and server clients. Copy the following variables into the root `.env.local` file and use the project-specific values from the Supabase dashboard:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

The core delivery schema is versioned in `supabase/migrations/`. It includes profile roles, orders, fleet, routes and stops, assignment, COD, status history, notifications, and delivery locations. Customer location access is limited to their own orders after pickup and while the delivery is active. Manager and driver roles must be assigned through a trusted administrative process; signups default to the customer role.
