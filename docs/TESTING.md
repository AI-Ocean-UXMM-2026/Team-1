# Test the application

This guide explains how to verify the Oern delivery platform locally and against a Supabase test project.

## Prerequisites

- Bun 1.4 or later
- Node.js 22.18 or later for the TypeScript test runner
- A Supabase project with the migrations in `supabase/migrations/` applied
- Browser location permission for live rider Global Positioning System (GPS) tracking tests

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Never place a Supabase service-role key in a browser environment variable.

## Install and run

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Signed-out users see labeled demo data, so the main interfaces can be reviewed without changing Supabase records.

## Automated checks

Run the complete local verification sequence before opening a pull request:

```bash
bun run lint
bun x tsc --noEmit
bun run test
bun run build
```

What each command verifies:

| Command | Coverage |
| --- | --- |
| `bun run lint` | Biome formatting, import ordering, accessibility rules, and code-quality rules |
| `bun x tsc --noEmit` | TypeScript types without producing build files |
| `bun run test` | Assignment intelligence, access routing, GPS lifecycle, location freshness, and Realtime refresh behavior |
| `bun run build` | Production compilation, route generation, environment use, and server/client boundaries |

The test suite uses Node's built-in test runner. A successful run currently covers:

- rider and vehicle recommendation scoring
- vehicle capacity filtering
- customer and team URL access
- multi-parcel GPS sharing
- GPS cleanup after logout, unmount, completion, or failure
- live workspace refresh for assignments, statuses, locations, and road reports
- stale and duplicated Realtime event handling

## Database workflow checks

`supabase/tests/delivery_workflows.sql` verifies row-level security and database workflows. It creates temporary fixtures inside a transaction and rolls everything back.

Run it only against a local, preview, or explicitly approved test database:

```bash
psql "$TEST_DATABASE_URL" \
  --set ON_ERROR_STOP=1 \
  --file supabase/tests/delivery_workflows.sql
```

A successful result returns a `checks_passed` count and a list of verified checks. The script covers:

- customer isolation between orders and locations
- atomic manager assignment and reassignment rules
- rider status transitions, GPS publishing, and COD collection
- vehicle visibility through row-level security
- road-report submission and manager review
- predictive ETA updates from route progress and verified road knowledge
- location access ending after delivery completion

If the script stops before `rollback`, discard the test database or remove its fixtures before reusing it.

## Test accounts

Public sign-up creates a customer profile. Team roles must be assigned through a trusted administrative process.

For a test project, create accounts through Supabase Auth and then update their profile roles in the SQL editor:

```sql
update public.profiles set role = 'manager' where id = '<manager-user-id>';
update public.profiles set role = 'driver' where id = '<driver-user-id>';
update public.profiles set role = 'seller' where id = '<seller-user-id>';
update public.profiles set role = 'support' where id = '<support-user-id>';

insert into public.driver_profiles (user_id, availability)
values ('<driver-user-id>', 'available');
```

Use different browser profiles or private windows when testing multiple roles at the same time.

## Manual workflow checklist

### Customer and manager

1. Sign in as a customer at `/`.
2. Sign in as a manager at `/manager` in another browser profile.
3. Create an order for the customer with pickup and destination map pins.
4. Confirm the order appears for the customer without exposing another customer's orders.
5. Review the recommended rider and vehicle, then save the assignment.

### Rider tracking and ETA

1. Sign in as the assigned rider at `/rider`.
2. Accept the task and confirm parcel pickup.
3. Allow browser location access when prompted.
4. Keep the rider tab open and confirm the customer and manager maps receive location updates.
5. Confirm route progress, ETA confidence, and energy readiness appear.
6. Update the current fuel or battery percentage.
7. Record COD when required and complete the delivery.
8. Confirm location sharing stops and the customer retains the final status.

### Road knowledge

1. Submit a road condition from the rider interface.
2. Review it from the manager interface.
3. Verify or reject the report.
4. For a verified report near an active route, confirm the ETA and traffic-delay display updates.

### Fleet operations

1. Open `/manager/insights` as a manager.
2. Configure vehicle energy source, range, reserve, and odometer values.
3. Add a maintenance record and delivery cost.
4. Confirm the readiness, service, and cost summaries update.

### Seller, provider, and support

1. Open `/seller` as a seller and submit a local delivery request.
2. Register a commerce channel and manually import an external shipment.
3. Sign in as the matching customer and add an external provider tracking code.
4. Create a support request from the customer interface.
5. Open `/support`, search for the shipment or order, assign the case, and resolve it.

Provider connections currently store channel details and support manual shipment imports. Live provider APIs and webhooks require provider-specific adapters.

## Realtime troubleshooting

- Confirm the rider has picked up the parcel; customer GPS access starts at pickup.
- Keep the rider browser open. Browser tracking is not reliable after the phone locks or the tab closes.
- Confirm location permission is allowed and the page is served from HTTPS or localhost.
- Check that the signed-in rider owns the active assignment.
- Confirm Supabase Realtime includes the required delivery, status, road-report, support, and external-shipment tables.
- Reload once to distinguish a Realtime subscription issue from a database policy issue.

## Pull request evidence

Include these results in the pull request description:

- lint, TypeScript, test, and production build results
- database workflow assertion count when schema or policies change
- migration names applied to the test project
- manual flows exercised and the roles used
- known limitations or external configuration still required
