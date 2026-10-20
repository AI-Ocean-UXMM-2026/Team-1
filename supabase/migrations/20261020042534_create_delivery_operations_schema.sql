-- Core schema for the door-to-door delivery platform.
-- Roles are provisioned by a trusted manager/admin process.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'manager', 'driver')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  availability text not null default 'off_duty'
    check (availability in ('available', 'on_delivery', 'off_duty')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_type text not null check (vehicle_type in ('motorcycle', 'e_bike', 'car', 'truck')),
  registration_number text not null unique,
  make text,
  model text,
  capacity_kg numeric(9, 2) check (capacity_kg is null or capacity_kg > 0),
  status text not null default 'available'
    check (status in ('available', 'in_use', 'maintenance', 'inactive')),
  fuel_level_percent numeric(5, 2)
    check (fuel_level_percent is null or fuel_level_percent between 0 and 100),
  battery_level_percent numeric(5, 2)
    check (battery_level_percent is null or battery_level_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_routes (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles (user_id),
  vehicle_id uuid references public.vehicles (id),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  planned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique default lower(replace(gen_random_uuid()::text, '-', '')),
  customer_id uuid not null references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled')),
  pickup_address text not null,
  pickup_latitude numeric(9, 6) check (pickup_latitude is null or pickup_latitude between -90 and 90),
  pickup_longitude numeric(9, 6) check (pickup_longitude is null or pickup_longitude between -180 and 180),
  pickup_contact_name text,
  pickup_contact_phone text,
  delivery_address text not null,
  delivery_latitude numeric(9, 6) check (delivery_latitude is null or delivery_latitude between -90 and 90),
  delivery_longitude numeric(9, 6) check (delivery_longitude is null or delivery_longitude between -180 and 180),
  recipient_name text,
  recipient_phone text,
  parcel_description text,
  parcel_weight_kg numeric(9, 2) check (parcel_weight_kg is null or parcel_weight_kg > 0),
  cod_amount numeric(12, 2) not null default 0 check (cod_amount >= 0),
  cod_status text not null default 'not_required'
    check (cod_status in ('not_required', 'pending', 'collected', 'settled')),
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_orders_cod_status_matches_amount check (
    (cod_amount = 0 and cod_status = 'not_required')
    or (cod_amount > 0 and cod_status <> 'not_required')
  )
);

create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders (id) on delete cascade,
  driver_id uuid not null references public.driver_profiles (user_id),
  vehicle_id uuid references public.vehicles (id),
  route_id uuid references public.delivery_routes (id) on delete set null,
  assigned_by uuid not null references public.profiles (id),
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.delivery_routes (id) on delete cascade,
  order_id uuid not null references public.delivery_orders (id) on delete cascade,
  stop_type text not null check (stop_type in ('pickup', 'delivery')),
  sequence_number integer not null check (sequence_number > 0),
  address text not null,
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  status text not null default 'pending'
    check (status in ('pending', 'arrived', 'completed', 'failed', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (route_id, sequence_number)
);

create table public.delivery_locations (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.delivery_orders (id) on delete cascade,
  driver_id uuid not null references public.driver_profiles (user_id),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  accuracy_meters numeric(8, 2) check (accuracy_meters is null or accuracy_meters >= 0),
  recorded_at timestamptz not null default now()
);

create table public.cod_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.delivery_orders (id),
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'bank_transfer', 'other')),
  status text not null default 'collected' check (status in ('collected', 'settled')),
  collected_by uuid not null references public.driver_profiles (user_id),
  collected_at timestamptz not null default now(),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.delivery_status_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.delivery_orders (id) on delete cascade,
  status text not null check (status in ('pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled')),
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.delivery_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null check (notification_type in ('status_update', 'pre_arrival', 'exception')),
  channel text not null default 'in_app' check (channel in ('in_app', 'push', 'sms', 'email')),
  message text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index delivery_orders_customer_created_idx on public.delivery_orders (customer_id, created_at desc);
create index delivery_orders_status_created_idx on public.delivery_orders (status, created_at desc);
create index delivery_assignments_driver_active_idx on public.delivery_assignments (driver_id, assigned_at desc) where ended_at is null;
create unique index delivery_assignments_one_active_order_idx on public.delivery_assignments (order_id) where ended_at is null;
create index delivery_assignments_vehicle_active_idx on public.delivery_assignments (vehicle_id) where ended_at is null;
create index delivery_assignments_route_idx on public.delivery_assignments (route_id);
create index delivery_routes_driver_planned_idx on public.delivery_routes (driver_id, planned_at desc);
create index route_stops_order_idx on public.route_stops (order_id);
create index delivery_locations_order_recorded_idx on public.delivery_locations (order_id, recorded_at desc);
create index delivery_locations_driver_recorded_idx on public.delivery_locations (driver_id, recorded_at desc);
create index delivery_status_events_order_created_idx on public.delivery_status_events (order_id, created_at desc);
create index delivery_notifications_recipient_status_idx on public.delivery_notifications (recipient_id, status, scheduled_at);

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'manager'
  );
$$;

create or replace function private.owns_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.delivery_orders as delivery_order
    where delivery_order.id = target_order_id
      and delivery_order.customer_id = (select auth.uid())
  );
$$;

create or replace function private.is_assigned_driver(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.delivery_assignments as assignment
    where assignment.order_id = target_order_id
      and assignment.driver_id = (select auth.uid())
      and assignment.ended_at is null
  );
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_create_delivery_profile
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.guard_delivery_order_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();

  -- Trusted server and manager writes may edit all order fields.
  if (select private.is_manager()) or current_user not in ('authenticated', 'anon') then
    if new.status = 'delivered' and old.status is distinct from 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
    end if;
    return new;
  end if;

  if (select auth.uid()) is null or not (select private.is_assigned_driver(old.id)) then
    raise exception 'Only the assigned driver or a manager can update this order';
  end if;

  if new.id is distinct from old.id
    or new.tracking_code is distinct from old.tracking_code
    or new.customer_id is distinct from old.customer_id
    or new.created_by is distinct from old.created_by
    or new.pickup_address is distinct from old.pickup_address
    or new.pickup_latitude is distinct from old.pickup_latitude
    or new.pickup_longitude is distinct from old.pickup_longitude
    or new.pickup_contact_name is distinct from old.pickup_contact_name
    or new.pickup_contact_phone is distinct from old.pickup_contact_phone
    or new.delivery_address is distinct from old.delivery_address
    or new.delivery_latitude is distinct from old.delivery_latitude
    or new.delivery_longitude is distinct from old.delivery_longitude
    or new.recipient_name is distinct from old.recipient_name
    or new.recipient_phone is distinct from old.recipient_phone
    or new.parcel_description is distinct from old.parcel_description
    or new.parcel_weight_kg is distinct from old.parcel_weight_kg
    or new.cod_amount is distinct from old.cod_amount
    or new.cod_status is distinct from old.cod_status
    or new.estimated_delivery_at is distinct from old.estimated_delivery_at
    or new.delivered_at is distinct from old.delivered_at
    or new.created_at is distinct from old.created_at then
    raise exception 'Drivers can only update delivery status';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'assigned' and new.status in ('accepted', 'failed', 'cancelled'))
    or (old.status = 'accepted' and new.status in ('picked_up', 'failed', 'cancelled'))
    or (old.status = 'picked_up' and new.status in ('in_transit', 'failed'))
    or (old.status = 'in_transit' and new.status in ('delivered', 'failed'))
  ) then
    raise exception 'Invalid delivery status transition: % to %', old.status, new.status;
  end if;

  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

create trigger guard_delivery_order_update
  before update on public.delivery_orders
  for each row execute function private.guard_delivery_order_update();

create or replace function private.record_delivery_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.delivery_status_events (order_id, status, changed_by)
    values (new.id, new.status, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger record_delivery_status_event
  after insert or update of status on public.delivery_orders
  for each row execute function private.record_delivery_status_event();

create or replace function private.apply_cod_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.delivery_orders set cod_status = new.status where id = new.order_id;
  return new;
end;
$$;

create trigger apply_cod_payment_status
  after insert or update of status on public.cod_payments
  for each row execute function private.apply_cod_payment_status();

create or replace function private.guard_vehicle_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  if (select private.is_manager()) or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if not exists (
    select 1 from public.delivery_assignments as assignment
    where assignment.vehicle_id = old.id
      and assignment.driver_id = (select auth.uid())
      and assignment.ended_at is null
  ) then
    raise exception 'Only a manager or assigned driver can update this vehicle';
  end if;

  if new.id is distinct from old.id
    or new.vehicle_type is distinct from old.vehicle_type
    or new.registration_number is distinct from old.registration_number
    or new.make is distinct from old.make
    or new.model is distinct from old.model
    or new.capacity_kg is distinct from old.capacity_kg
    or new.status is distinct from old.status
    or new.created_at is distinct from old.created_at then
    raise exception 'Drivers can only update fuel or battery levels';
  end if;
  return new;
end;
$$;

create trigger guard_vehicle_update
  before update on public.vehicles
  for each row execute function private.guard_vehicle_update();

create or replace function private.guard_route_stop_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select private.is_manager()) or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if not exists (
    select 1 from public.delivery_routes as route
    where route.id = old.route_id and route.driver_id = (select auth.uid())
  ) then
    raise exception 'Only the assigned driver or a manager can update this route stop';
  end if;

  if new.id is distinct from old.id
    or new.route_id is distinct from old.route_id
    or new.order_id is distinct from old.order_id
    or new.stop_type is distinct from old.stop_type
    or new.sequence_number is distinct from old.sequence_number
    or new.address is distinct from old.address
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or new.created_at is distinct from old.created_at then
    raise exception 'Drivers can only update route stop status and completion time';
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$$;

create trigger guard_route_stop_update
  before update on public.route_stops
  for each row execute function private.guard_route_stop_update();

create or replace function private.validate_cod_payment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.delivery_orders as delivery_order
    where delivery_order.id = new.order_id
      and delivery_order.cod_amount = new.amount
      and delivery_order.cod_status = 'pending'
      and delivery_order.status in ('picked_up', 'in_transit')
  ) then
    raise exception 'COD payment must match the pending amount for an active delivery';
  end if;
  return new;
end;
$$;

create trigger validate_cod_payment
  before insert on public.cod_payments
  for each row execute function private.validate_cod_payment();

revoke all on function private.is_manager() from public, anon;
revoke all on function private.owns_order(uuid) from public, anon;
revoke all on function private.is_assigned_driver(uuid) from public, anon;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.guard_delivery_order_update() from public, anon, authenticated;
revoke all on function private.record_delivery_status_event() from public, anon, authenticated;
revoke all on function private.apply_cod_payment_status() from public, anon, authenticated;
revoke all on function private.guard_vehicle_update() from public, anon, authenticated;
revoke all on function private.guard_route_stop_update() from public, anon, authenticated;
revoke all on function private.validate_cod_payment() from public, anon, authenticated;
grant execute on function private.is_manager() to authenticated;
grant execute on function private.owns_order(uuid) to authenticated;
grant execute on function private.is_assigned_driver(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.delivery_routes enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.route_stops enable row level security;
alter table public.delivery_locations enable row level security;
alter table public.cod_payments enable row level security;
alter table public.delivery_status_events enable row level security;
alter table public.delivery_notifications enable row level security;

create policy profiles_select_self_or_manager
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_manager()));
create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy driver_profiles_manager_all
  on public.driver_profiles for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy driver_profiles_driver_read_self
  on public.driver_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy driver_profiles_driver_update_self
  on public.driver_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy vehicles_manager_all
  on public.vehicles for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy vehicles_assigned_driver_read
  on public.vehicles for select to authenticated
  using (exists (
    select 1 from public.delivery_assignments as assignment
    where assignment.vehicle_id = id
      and assignment.driver_id = (select auth.uid())
      and assignment.ended_at is null
  ));
create policy vehicles_assigned_driver_update
  on public.vehicles for update to authenticated
  using (exists (
    select 1 from public.delivery_assignments as assignment
    where assignment.vehicle_id = id
      and assignment.driver_id = (select auth.uid())
      and assignment.ended_at is null
  ))
  with check (exists (
    select 1 from public.delivery_assignments as assignment
    where assignment.vehicle_id = id
      and assignment.driver_id = (select auth.uid())
      and assignment.ended_at is null
  ));

create policy delivery_routes_manager_all
  on public.delivery_routes for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy delivery_routes_driver_read
  on public.delivery_routes for select to authenticated
  using (driver_id = (select auth.uid()));

create policy delivery_orders_manager_all
  on public.delivery_orders for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy delivery_orders_customer_read
  on public.delivery_orders for select to authenticated
  using (customer_id = (select auth.uid()));
create policy delivery_orders_assigned_driver_read
  on public.delivery_orders for select to authenticated
  using ((select private.is_assigned_driver(id)));
create policy delivery_orders_manager_insert
  on public.delivery_orders for insert to authenticated
  with check (
    (select private.is_manager())
    and created_by = (select auth.uid())
  );
create policy delivery_orders_assigned_driver_update
  on public.delivery_orders for update to authenticated
  using ((select private.is_assigned_driver(id)))
  with check ((select private.is_assigned_driver(id)));

create policy delivery_assignments_manager_all
  on public.delivery_assignments for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy delivery_assignments_driver_read
  on public.delivery_assignments for select to authenticated
  using (driver_id = (select auth.uid()));
create policy delivery_assignments_customer_read
  on public.delivery_assignments for select to authenticated
  using ((select private.owns_order(order_id)));

create policy route_stops_manager_all
  on public.route_stops for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy route_stops_driver_read
  on public.route_stops for select to authenticated
  using (exists (
    select 1 from public.delivery_routes as route
    where route.id = route_id and route.driver_id = (select auth.uid())
  ));
create policy route_stops_driver_update
  on public.route_stops for update to authenticated
  using (exists (
    select 1 from public.delivery_routes as route
    where route.id = route_id and route.driver_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.delivery_routes as route
    where route.id = route_id and route.driver_id = (select auth.uid())
  ));

create policy delivery_locations_manager_read
  on public.delivery_locations for select to authenticated
  using ((select private.is_manager()));
create policy delivery_locations_driver_read
  on public.delivery_locations for select to authenticated
  using (driver_id = (select auth.uid()));
create policy delivery_locations_customer_live_read
  on public.delivery_locations for select to authenticated
  using (
    (select private.owns_order(order_id))
    and exists (
      select 1 from public.delivery_orders as delivery_order
      where delivery_order.id = order_id
        and delivery_order.status in ('picked_up', 'in_transit')
    )
  );
create policy delivery_locations_assigned_driver_insert
  on public.delivery_locations for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and (select private.is_assigned_driver(order_id))
    and exists (
      select 1 from public.delivery_orders as delivery_order
      where delivery_order.id = order_id
        and delivery_order.status in ('picked_up', 'in_transit')
    )
  );

create policy cod_payments_manager_all
  on public.cod_payments for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy cod_payments_customer_read
  on public.cod_payments for select to authenticated
  using ((select private.owns_order(order_id)));
create policy cod_payments_assigned_driver_read
  on public.cod_payments for select to authenticated
  using ((select private.is_assigned_driver(order_id)));
create policy cod_payments_assigned_driver_insert
  on public.cod_payments for insert to authenticated
  with check (
    collected_by = (select auth.uid())
    and (select private.is_assigned_driver(order_id))
  );

create policy delivery_status_events_manager_read
  on public.delivery_status_events for select to authenticated
  using ((select private.is_manager()));
create policy delivery_status_events_customer_read
  on public.delivery_status_events for select to authenticated
  using ((select private.owns_order(order_id)));
create policy delivery_status_events_driver_read
  on public.delivery_status_events for select to authenticated
  using ((select private.is_assigned_driver(order_id)));

create policy delivery_notifications_manager_all
  on public.delivery_notifications for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy delivery_notifications_customer_read
  on public.delivery_notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and (select private.owns_order(order_id)));

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, insert, update (availability), delete
  on public.driver_profiles to authenticated;
grant select, insert, update, delete
  on public.vehicles, public.delivery_routes, public.delivery_orders,
     public.delivery_assignments, public.route_stops to authenticated;
grant select, insert on public.delivery_locations to authenticated;
grant select, insert, update on public.cod_payments to authenticated;
grant select on public.delivery_status_events to authenticated;
grant select, insert, update, delete on public.delivery_notifications to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'delivery_locations'
    ) then
    alter publication supabase_realtime add table public.delivery_locations;
  end if;
end;
$$;
