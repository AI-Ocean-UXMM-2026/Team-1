-- Device 2 operations: energy-aware routing, seller/support workspaces,
-- fleet maintenance, delivery costs, and external provider tracking.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('customer', 'manager', 'driver', 'seller', 'support'));

alter table public.vehicles
  add column energy_source text not null default 'fuel'
    check (energy_source in ('fuel', 'electric', 'hybrid')),
  add column range_km_at_full numeric(8, 2)
    check (range_km_at_full is null or range_km_at_full > 0),
  add column reserve_percent numeric(5, 2) not null default 15
    check (reserve_percent between 0 and 50),
  add column odometer_km numeric(12, 2) not null default 0
    check (odometer_km >= 0),
  add column service_due_at_km numeric(12, 2)
    check (service_due_at_km is null or service_due_at_km >= 0);

create table public.vehicle_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  maintenance_type text not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_for date,
  completed_at timestamptz,
  odometer_km numeric(12, 2) check (odometer_km is null or odometer_km >= 0),
  cost_amount numeric(12, 2) not null default 0 check (cost_amount >= 0),
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_cost_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.delivery_orders (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  category text not null
    check (category in ('fuel', 'charging', 'toll', 'maintenance', 'labor', 'other')),
  amount numeric(12, 2) not null check (amount > 0),
  incurred_at timestamptz not null default now(),
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint delivery_cost_entries_has_subject
    check (order_id is not null or vehicle_id is not null)
);

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.delivery_orders (id) on delete set null,
  requester_id uuid not null references public.profiles (id),
  assigned_to uuid references public.profiles (id) on delete set null,
  subject text not null,
  description text not null,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.commerce_integrations (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  provider_name text not null,
  store_name text not null,
  provider_type text not null default 'ecommerce'
    check (provider_type in ('ecommerce', 'marketplace', 'carrier')),
  sync_mode text not null default 'manual'
    check (sync_mode in ('manual', 'api', 'webhook')),
  status text not null default 'active'
    check (status in ('active', 'paused', 'error')),
  external_account_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, provider_name, store_name)
);

create table public.external_shipments (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.commerce_integrations (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete cascade,
  customer_id uuid references public.profiles (id) on delete cascade,
  local_order_id uuid references public.delivery_orders (id) on delete set null,
  provider_name text not null,
  external_order_reference text,
  tracking_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled')),
  tracking_url text,
  origin_label text,
  destination_label text,
  estimated_delivery_at timestamptz,
  latest_event_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_shipments_has_owner
    check (seller_id is not null or customer_id is not null),
  unique (provider_name, tracking_code, seller_id, customer_id)
);

create index vehicle_maintenance_vehicle_schedule_idx
  on public.vehicle_maintenance_records (vehicle_id, scheduled_for desc);
create index vehicle_maintenance_status_schedule_idx
  on public.vehicle_maintenance_records (status, scheduled_for);
create index vehicle_maintenance_created_by_idx
  on public.vehicle_maintenance_records (created_by);
create index delivery_cost_entries_order_incurred_idx
  on public.delivery_cost_entries (order_id, incurred_at desc);
create index delivery_cost_entries_vehicle_incurred_idx
  on public.delivery_cost_entries (vehicle_id, incurred_at desc);
create index delivery_cost_entries_created_by_idx
  on public.delivery_cost_entries (created_by);
create index support_cases_order_idx on public.support_cases (order_id);
create index support_cases_requester_created_idx
  on public.support_cases (requester_id, created_at desc);
create index support_cases_assigned_status_idx
  on public.support_cases (assigned_to, status, updated_at desc);
create index commerce_integrations_seller_idx
  on public.commerce_integrations (seller_id, created_at desc);
create index external_shipments_integration_idx
  on public.external_shipments (integration_id);
create index external_shipments_seller_created_idx
  on public.external_shipments (seller_id, created_at desc);
create index external_shipments_customer_created_idx
  on public.external_shipments (customer_id, created_at desc);
create index external_shipments_local_order_idx
  on public.external_shipments (local_order_id);

create or replace function private.is_support()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'support'
  );
$$;

create or replace function private.is_seller()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'seller'
  );
$$;

revoke all on function private.is_support() from public, anon;
revoke all on function private.is_seller() from public, anon;
grant execute on function private.is_support() to authenticated;
grant execute on function private.is_seller() to authenticated;

drop policy profiles_select_self_or_manager on public.profiles;
create policy profiles_select_role_access
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_manager())
    or (select private.is_support())
  );

alter table public.vehicle_maintenance_records enable row level security;
alter table public.delivery_cost_entries enable row level security;
alter table public.support_cases enable row level security;
alter table public.commerce_integrations enable row level security;
alter table public.external_shipments enable row level security;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

create trigger touch_vehicle_maintenance_updated_at
  before update on public.vehicle_maintenance_records
  for each row execute function private.touch_updated_at();
create trigger touch_support_cases_updated_at
  before update on public.support_cases
  for each row execute function private.touch_updated_at();
create trigger touch_commerce_integrations_updated_at
  before update on public.commerce_integrations
  for each row execute function private.touch_updated_at();
create trigger touch_external_shipments_updated_at
  before update on public.external_shipments
  for each row execute function private.touch_updated_at();

create or replace function private.guard_vehicle_readiness_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or (select private.is_manager()) then
    return new;
  end if;
  if new.energy_source is distinct from old.energy_source
    or new.range_km_at_full is distinct from old.range_km_at_full
    or new.reserve_percent is distinct from old.reserve_percent
    or new.odometer_km is distinct from old.odometer_km
    or new.service_due_at_km is distinct from old.service_due_at_km then
    raise exception 'Drivers can only update current fuel or battery levels';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_vehicle_readiness_update()
  from public, anon, authenticated;
create trigger guard_vehicle_readiness_update
  before update on public.vehicles
  for each row execute function private.guard_vehicle_readiness_update();

create policy vehicle_maintenance_manager_read
  on public.vehicle_maintenance_records for select to authenticated
  using ((select private.is_manager()));
create policy vehicle_maintenance_manager_insert
  on public.vehicle_maintenance_records for insert to authenticated
  with check ((select private.is_manager()) and created_by = (select auth.uid()));
create policy vehicle_maintenance_manager_update
  on public.vehicle_maintenance_records for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy vehicle_maintenance_manager_delete
  on public.vehicle_maintenance_records for delete to authenticated
  using ((select private.is_manager()));

create policy delivery_cost_entries_manager_read
  on public.delivery_cost_entries for select to authenticated
  using ((select private.is_manager()));
create policy delivery_cost_entries_manager_insert
  on public.delivery_cost_entries for insert to authenticated
  with check ((select private.is_manager()) and created_by = (select auth.uid()));
create policy delivery_cost_entries_manager_update
  on public.delivery_cost_entries for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy delivery_cost_entries_manager_delete
  on public.delivery_cost_entries for delete to authenticated
  using ((select private.is_manager()));

create policy support_cases_read_access
  on public.support_cases for select to authenticated
  using (
    (select private.is_manager())
    or (select private.is_support())
    or requester_id = (select auth.uid())
  );
create policy support_cases_insert_access
  on public.support_cases for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and (
      order_id is null
      or (select private.owns_order(order_id))
      or exists (
        select 1 from public.delivery_orders as delivery_order
        where delivery_order.id = order_id
          and delivery_order.created_by = (select auth.uid())
      )
    )
  );
create policy support_cases_update_support
  on public.support_cases for update to authenticated
  using ((select private.is_manager()) or (select private.is_support()))
  with check ((select private.is_manager()) or (select private.is_support()));

create policy commerce_integrations_read_access
  on public.commerce_integrations for select to authenticated
  using ((select private.is_manager()) or seller_id = (select auth.uid()));
create policy commerce_integrations_insert_seller
  on public.commerce_integrations for insert to authenticated
  with check ((select private.is_seller()) and seller_id = (select auth.uid()));
create policy commerce_integrations_update_access
  on public.commerce_integrations for update to authenticated
  using ((select private.is_manager()) or seller_id = (select auth.uid()))
  with check ((select private.is_manager()) or seller_id = (select auth.uid()));
create policy commerce_integrations_delete_access
  on public.commerce_integrations for delete to authenticated
  using ((select private.is_manager()) or seller_id = (select auth.uid()));

create policy external_shipments_read_access
  on public.external_shipments for select to authenticated
  using (
    (select private.is_manager())
    or (select private.is_support())
    or seller_id = (select auth.uid())
    or customer_id = (select auth.uid())
  );
create policy external_shipments_insert_access
  on public.external_shipments for insert to authenticated
  with check (
    (
      (select private.is_seller())
      and seller_id = (select auth.uid())
      and (
        integration_id is null
        or exists (
          select 1 from public.commerce_integrations as integration
          where integration.id = integration_id
            and integration.seller_id = (select auth.uid())
        )
      )
    )
    or (
      customer_id = (select auth.uid())
      and seller_id is null
      and integration_id is null
      and local_order_id is null
    )
  );
create policy external_shipments_update_access
  on public.external_shipments for update to authenticated
  using ((select private.is_manager()) or seller_id = (select auth.uid()))
  with check ((select private.is_manager()) or seller_id = (select auth.uid()));
create policy external_shipments_delete_access
  on public.external_shipments for delete to authenticated
  using (
    (select private.is_manager())
    or seller_id = (select auth.uid())
    or customer_id = (select auth.uid())
  );

drop policy delivery_orders_read_access on public.delivery_orders;
create policy delivery_orders_read_access on public.delivery_orders for select to authenticated
  using (
    (select private.is_manager())
    or (select private.is_support())
    or customer_id = (select auth.uid())
    or created_by = (select auth.uid())
    or (select private.is_assigned_driver(id))
  );

drop policy delivery_orders_insert_manager on public.delivery_orders;
create policy delivery_orders_insert_access on public.delivery_orders for insert to authenticated
  with check (
    ((select private.is_manager()) and created_by = (select auth.uid()))
    or (
      (select private.is_seller())
      and created_by = (select auth.uid())
      and customer_id = (select auth.uid())
    )
  );

drop policy delivery_assignments_read_access on public.delivery_assignments;
create policy delivery_assignments_read_access on public.delivery_assignments for select to authenticated
  using (
    (select private.is_manager())
    or (select private.is_support())
    or driver_id = (select auth.uid())
    or (select private.owns_order(order_id))
    or exists (
      select 1 from public.delivery_orders as delivery_order
      where delivery_order.id = order_id
        and delivery_order.created_by = (select auth.uid())
    )
  );

drop policy delivery_status_events_read_access on public.delivery_status_events;
create policy delivery_status_events_read_access on public.delivery_status_events for select to authenticated
  using (
    (select private.is_manager())
    or (select private.is_support())
    or (select private.owns_order(order_id))
    or (select private.is_assigned_driver(order_id))
    or exists (
      select 1 from public.delivery_orders as delivery_order
      where delivery_order.id = order_id
        and delivery_order.created_by = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.vehicle_maintenance_records to authenticated;
grant select, insert, update, delete on public.delivery_cost_entries to authenticated;
grant select, insert, update on public.support_cases to authenticated;
grant select, insert, update, delete on public.commerce_integrations to authenticated;
grant select, insert, update, delete on public.external_shipments to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_cases'
  ) then
    alter publication supabase_realtime add table public.support_cases;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'external_shipments'
  ) then
    alter publication supabase_realtime add table public.external_shipments;
  end if;
end $$;
