# Database testing guide

This guide verifies that every Supabase table, policy, trigger, and Realtime channel behaves according to the delivery workflow in [PROJECT_FLOW.md](PROJECT_FLOW.md). It complements the application checks in [TESTING.md](TESTING.md).

Run every step against a **test or preview Supabase project**, never production. Steps 1 and 2 are safe to repeat: step 1 is read-only and step 2 rolls back all of its fixtures.

## Where to run SQL

Use either option:

- **Supabase dashboard → SQL Editor.** Paste the script and run it. The editor shows only the last result set, which is what each step below is designed to return.
- **psql.** Not installed on this machine yet. Install the PostgreSQL client, copy the connection string from **Project Settings → Database**, and run:

  ```bash
  psql "$TEST_DATABASE_URL" --set ON_ERROR_STOP=1 --file supabase/tests/delivery_workflows.sql
  ```

## Step 1 · Schema health check (read-only)

Confirms that all nine migrations were applied and nothing is missing. Run each query and compare it with the expected result.

### 1a. Migrations applied

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Expected: 9 rows, `20261020042534` through `20261021000000`. If the table does not exist, the migrations were applied by hand. Rely on 1b–1f instead.

### 1b. All 18 tables exist with row-level security on

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
```

Expected: these 18 tables, every one with `rls_enabled = true` and at least one policy.

| Area | Tables |
| --- | --- |
| Accounts | `profiles`, `driver_profiles` |
| Fleet | `vehicles`, `vehicle_maintenance_records` |
| Orders | `delivery_orders`, `delivery_assignments`, `delivery_status_events`, `delivery_notifications`, `delivery_outcome_reports` |
| Routing and tracking | `delivery_routes`, `route_stops`, `delivery_locations`, `road_reports` |
| Payments and costs | `cod_payments`, `delivery_cost_entries` |
| Sellers and support | `commerce_integrations`, `external_shipments`, `support_cases` |

A table with `rls_enabled = false` is a data leak. A table with RLS on but `policies = 0` is unusable from the app. Both are failures.

### 1c. Realtime publication

```sql
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by 1;
```

Expected 9 tables: `delivery_assignments`, `delivery_locations`, `delivery_orders`, `delivery_routes`, `delivery_status_events`, `external_shipments`, `road_reports`, `route_stops`, `support_cases`. A missing table means its screen only updates after a reload.

### 1d. Workflow functions and view

```sql
select n.nspname || '.' || p.proname as function_name
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname in ('assign_delivery', 'ensure_delivery_route', 'review_road_report'))
   or (n.nspname = 'private' and p.proname in (
     'is_manager', 'is_seller', 'is_support', 'owns_order', 'is_assigned_driver',
     'handle_new_auth_user', 'refresh_delivery_prediction'))
order by 1;

select count(*) as latest_location_view from information_schema.views
where table_schema = 'public' and table_name = 'latest_delivery_locations';
```

Expected: 10 functions and `latest_location_view = 1`.

### 1e. Triggers that enforce the workflow

```sql
select event_object_table as table_name, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
order by 1, 2;
```

Expected: triggers on `delivery_orders` (status guard and status-event recording), `cod_payments` (validation and payment status), `vehicles` (update guards), `route_stops`, `delivery_locations` and `road_reports` (ETA refresh), plus `touch_*_updated_at` triggers on the four seller, support, and maintenance tables. Also confirm the signup trigger on `auth.users`:

```sql
select trigger_name from information_schema.triggers
where event_object_schema = 'auth' and event_object_table = 'users';
```

### 1f. Roles allowed on profiles

```sql
select pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.profiles'::regclass and contype = 'c';
```

Expected: the role check allows `customer`, `manager`, `driver`, `seller`, and `support`.

## Step 2 · Automated core workflow test (43 checks)

Run all of [supabase/tests/delivery_workflows.sql](../supabase/tests/delivery_workflows.sql) in the SQL Editor or with psql. It creates temporary users and orders, impersonates each role through its JWT, and rolls everything back.

**Pass:** one row with `checks_passed = 43` and the list of check names.
**Fail:** an error such as `Workflow assertion failed: <check name>`. The name says which rule is broken. Nothing is saved because the transaction never commits.

It covers this lifecycle:

| Workflow stage | What is proven |
| --- | --- |
| Sign-up | New accounts default to `customer`, and the phone from sign-up metadata is kept |
| Order creation | Managers can create orders |
| Assignment | `assign_delivery` is atomic and idempotent, rejects off-duty riders, and cannot be called by riders |
| Rider pickup | Riders cannot send GPS or collect COD before pickup, and statuses cannot move backwards |
| Live tracking | Customers see only their own rider's latest point, never another customer's |
| ETA and road knowledge | GPS updates and manager-verified road reports change the prediction |
| COD | A wrong amount is rejected, and a correct amount updates the payment status |
| Completion | GPS writes stop and customer location access ends, but the final status and full history remain visible |

## Step 3 · Seller, support, and fleet tables (manual)

The automated script does not touch `commerce_integrations`, `external_shipments`, `support_cases`, `vehicle_maintenance_records`, `delivery_cost_entries`, `delivery_routes`, `route_stops`, or `delivery_notifications`. Verify them through the app with real test accounts (see *Test accounts* in [TESTING.md](TESTING.md)). Use one browser profile per role.

The table below lists who the policies allow to do what. "Own" means `seller_id`, `customer_id`, or `requester_id` equals the signed-in user.

| Table | Customer | Seller | Support | Manager | Driver |
| --- | --- | --- | --- | --- | --- |
| `commerce_integrations` | — | read and write own | — | read and write all | — |
| `external_shipments` | read own, add own tracking code, delete own | read and write own, import | read all | read and write all | — |
| `support_cases` | read own, open case on own order | read own, open case on own order | read and update all | read and update all | — |
| `vehicle_maintenance_records` | — | — | — | full access | — |
| `delivery_cost_entries` | — | — | — | full access | — |
| `delivery_orders` | read own | create for self, read own | read all | create and read all | read assigned |

For each row, test both directions: an allowed action succeeds and is visible after a reload, and a forbidden one returns no rows or a permission error.

1. **Seller** at `/seller`: register a channel and import a shipment. Then sign in as a **second seller** and confirm the first seller's channel and shipment are not visible.
2. **Customer** at `/`: add an external tracking code and open a support case on an own order. Confirm another customer cannot see either.
3. **Support** at `/support`: confirm the case and shipment appear live without reloading (Realtime), assign the case, and resolve it. Confirm the customer sees the new status.
4. **Manager** at `/manager/insights`: add a maintenance record and a cost entry. Sign in as a **driver** or **customer** and confirm that neither appears anywhere.
5. **Cost entry rule:** a cost entry with neither an order nor a vehicle must be rejected by the `delivery_cost_entries_has_subject` constraint.

After each step you can confirm the stored row in the SQL Editor. The editor runs as an admin and bypasses RLS, so use it to check data, not access:

```sql
select status, assigned_to, resolved_at, updated_at from public.support_cases order by created_at desc limit 5;
select provider_name, tracking_code, seller_id, customer_id, status from public.external_shipments order by created_at desc limit 5;
```

## Step 4 · End-to-end delivery trace

Run one real delivery through the app (customer → manager → rider → completion, as in [TESTING.md](TESTING.md#manual-workflow-checklist)). Then inspect what the database recorded for that order:

```sql
-- Replace with the order id from the manager screen
\set order_id '00000000-0000-0000-0000-000000000000'

select status, payment_status, delivered_at from public.delivery_orders where id = :'order_id';
select status, created_at from public.delivery_status_events where order_id = :'order_id' order by created_at;
select driver_id, vehicle_id, status from public.delivery_assignments where order_id = :'order_id';
select count(*) as gps_points, max(recorded_at) as last_point from public.delivery_locations where order_id = :'order_id';
select amount, status from public.cod_payments where order_id = :'order_id';
```

`\set` works only in psql. In the SQL Editor, paste the id in place of `:'order_id'`.

Expected:
- the status history reads `pending → assigned → accepted → picked_up → in_transit → delivered` with no gaps or reversals
- GPS points exist only after `picked_up`, and none arrive after `delivered`
- the COD amount matches the order, and `payment_status` reflects collection

## Step 5 · Realtime check

With the customer, manager, and rider open side by side, change something in each and confirm the other screens update **without reloading**:

| Action | Should update live on |
| --- | --- |
| Manager assigns a rider | Rider task list and customer status |
| Rider confirms pickup, then moves | Customer map and manager map |
| Rider submits a road report | Manager review list |
| Customer opens a support case | Support queue |
| Seller imports a shipment | Seller queue and support search |

If an update appears only after a reload, the table is probably missing from the publication (step 1c).

## Results checklist

- [ ] 1a–1f match the expected results
- [ ] Step 2 returns `checks_passed = 43`
- [ ] Every allowed and forbidden action in the step 3 table behaves as listed
- [ ] The step 4 trace shows a clean status history, GPS only within pickup→delivery, and correct COD
- [ ] Every step 5 update arrives live

## Known gap

Step 3 is manual. Adding a second rollback script, `supabase/tests/operations_workflows.sql`, that uses the same fixture pattern as `delivery_workflows.sql` for the seller, support, and fleet tables would let the whole database be verified automatically.
