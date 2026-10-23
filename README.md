# Oern — Door-to-Door Delivery Platform

Real-time, door-to-door delivery logistics that connects customers, drivers/riders, managers, sellers, and support staff in one workflow. Customers see where their parcel is from driver handoff through delivery; managers and drivers keep every order moving through a clear shared workflow.

- **Live demo (app):** https://oern.vercel.app
- **Demo video:** `remotion-demo/` (90s hackathon cut) · storyboard in `remotion-demo/STORYBOARD.md`
- **Repository:** https://github.com/wintkhantlin/Oern

## Problem

Current delivery operations lack transparency end to end: customers get no visibility after handoff, drivers plan routes manually, managers reconcile cash and fleet by hand, and sellers/support have no unified view of local vs. provider shipments. The result is missed ETAs, lost COD, idle fleet, and support tickets with no context.

## Solution

Oern is a single platform with five role workspaces (Customer, Driver/Rider, Manager, Seller, Support) sharing Supabase Auth and delivery data, with row-level security per role. Tracking begins the moment a rider receives a parcel and continues until delivery closes. Dispatch recommends riders and vehicles using availability, workload, proximity, and parcel capacity; ETA is recalculated from route progress, vehicle speed, and manager-verified road reports.

## Key Features

**Customer** — request a pickup in 3 steps, follow own orders on a map with live location, status history, ETA and COD details, browse Active/History orders, receive status and pre-arrival notifications.

**Driver/Rider** — view assigned tasks, accept and start deliveries, confirm parcel pickup, share GPS for every collected parcel, open navigation (Google Maps), plan multi-stop routes, record COD, complete or report failed deliveries.

**Manager** — create orders with optional map pins, assign riders and vehicles, manage rider availability, filter deliveries, monitor active riders on a map, manage fleet energy readiness, maintenance and delivery costs.

**Seller** — submit delivery requests, register commerce channels, import external orders, monitor a unified order queue.

**Support** — search delivery history, investigate local/provider context, assign cases, record resolutions; AI-powered complaint classification (Jev via OpenRouter) with pattern-based fallback.

**Operations** — fuel/battery-aware routing estimates from saved pins + vehicle range/reserve; multi-provider commerce integration (registration + manual import); COD and mobile wallet settlement (KBZPay, WavePay, AYA Pay, CB Pay); manager-verified road knowledge.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, MUI
- **Backend/Data:** Supabase (PostgreSQL + RLS + Realtime WebSockets), Supabase SSR
- **Maps/GIS:** Mapbox GL v3 with OpenStreetMap fallback, Mapbox Matrix API
- **Optimization/AI:** Adaptive Large Neighborhood Search (ALNS) multi-truck VRP solver, Jev complaint classifier via OpenRouter
- **Tooling:** Bun 1.4, Biome, Playwright, Vitest/Node test runner
- **Demo video:** Remotion (90s cut)

## Architecture

```
src/
  app/            # Next.js routes: /, /rider, /manager, /seller, /support, /api/*
  components/     # Role workspaces and shared UI
  lib/            # Delivery logic, routing, classification, Supabase clients
supabase/
  migrations/     # Versioned schema (profiles, orders, fleet, routes, COD, ...)
  tests/          # Transactional SQL workflow checks
docs/             # Architecture, schema, API, operations, testing
remotion-demo/    # Hackathon demo video
```

Role redirects and data access are enforced by Supabase RLS; workspaces load live Supabase data only (no browser demo substitution).

## Getting Started

```bash
bun install
cp .env.example .env.local   # fill in your values
bun run dev
```

Open http://localhost:3000. Available checks:

```bash
bun run lint
bun run test
bun run typecheck
bun run build
```

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token        # optional, OSM fallback without it
MAPBOX_SERVER_TOKEN=your_mapbox_server_token             # optional, for /api/dispatch/plan
OPENROUTER_API_KEY=sk-or-v1-...                         # optional, enables AI complaint classification
```

## Testing

- Unit/regression: `bun run test` (Node built-in runner, TS stripping; Node 22.18+)
- E2E: `bun run test:e2e` (Playwright; Supabase mocked via `e2e/support/supabase-mock.ts`)
- SQL workflows: `supabase/tests/delivery_workflows.sql` (runs in a transaction, rolls back fixtures)
- Typecheck: `bun run typecheck` / `bun run typecheck:e2e`

## Documentation

Full docs indexed in [docs/README.md](docs/README.md): architecture, database schema & RLS, API reference, operations manual, COD/payments, delivery lifecycle, testing. App feature catalog in [PROJECT_APP.md](PROJECT_APP.md).

## DEMO

- https://oern-app.vercel.app/

```
(Rider)
Email: rider.testing@oern.example
Password: password

(Manager)
Email: manager.testing@oern.example
Password: password

(Normal User)
Email: wintkhantlin@gmail.com
Password: password
```
