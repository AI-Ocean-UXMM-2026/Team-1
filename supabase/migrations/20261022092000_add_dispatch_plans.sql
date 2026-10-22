-- Multi-truck dispatch plans: storage, atomic commit onto the existing route
-- tables, and the guard that keeps drivers from editing planned values.
--
-- A plan (dispatch_runs) is a draft until a manager commits it. Commit creates
-- one delivery_routes row per truck with ordered pickup/delivery route_stops and
-- assigns every order through the existing public.assign_delivery, so vehicle
-- conflicts, previous-assignment handling and order status stay in one place.
-- Depot start and end are not stops (route_stops.order_id is NOT NULL); they are
-- the route's depot_id plus planned depart/return times.
--
-- Plan tables have a manager read policy only. Every write goes through the
-- security-definer functions below, which makes dispatch_run_edits append-only.
-- Editing RPCs (move, lock, re-optimise) arrive in a later migration.

-- ------------------------------------------------------------------- tables --

create table public.dispatch_runs (
  id uuid primary key default gen_random_uuid(),
  depot_id uuid not null references public.depots (id),
  service_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'committed', 'discarded', 'superseded', 'cancelled')),
  revision integer not null default 1 check (revision >= 1),
  parent_run_id uuid references public.dispatch_runs (id),
  client_key uuid not null unique,
  commit_key uuid unique,
  engine_version text not null,
  params jsonb not null default '{}'::jsonb,
  seed bigint,
  iterations integer check (iterations is null or iterations >= 0),
  stop_reason text check (stop_reason in ('converged', 'iterations', 'deadline')),
  runtime_ms integer check (runtime_ms is null or runtime_ms >= 0),
  data_quality text not null check (data_quality in ('road_matrix', 'road_calibrated', 'straight_line')),
  data_quality_detail jsonb not null default '{}'::jsonb,
  score_total numeric(14, 2),
  score_breakdown jsonb not null default '{}'::jsonb,
  -- Synthetic fixtures must never be stored; the constraint makes that a rule.
  synthetic boolean not null default false check (synthetic = false),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  committed_by uuid references public.profiles (id),
  discarded_at timestamptz,
  discarded_by uuid references public.profiles (id),
  discard_reason text,
  constraint dispatch_runs_committed_has_key
    check (status <> 'committed' or (commit_key is not null and committed_at is not null))
);

create unique index dispatch_runs_one_draft_idx
  on public.dispatch_runs (depot_id, service_date) where status = 'draft';
create index dispatch_runs_service_date_idx on public.dispatch_runs (service_date desc, status);

create table public.dispatch_run_routes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.dispatch_runs (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id),
  driver_id uuid references public.driver_profiles (user_id),
  display_order integer not null default 0,
  planned_depart_at timestamptz not null,
  planned_return_at timestamptz not null,
  p90_return_at timestamptz,
  distance_km numeric(9, 2) not null default 0 check (distance_km >= 0),
  travel_min numeric(8, 1) not null default 0,
  service_min numeric(8, 1) not null default 0,
  wait_min numeric(8, 1) not null default 0,
  peak_kg numeric(9, 2) not null default 0 check (peak_kg >= 0),
  peak_m3 numeric(9, 4) not null default 0 check (peak_m3 >= 0),
  cap_kg_used numeric(9, 2),
  cap_m3_used numeric(9, 4),
  usable_range_km numeric(9, 2),
  energy_status text check (energy_status in ('enough', 'tight', 'short', 'unknown')),
  score_time numeric(10, 2) not null default 0,
  score_uncertainty numeric(10, 2) not null default 0,
  score_cost numeric(10, 2) not null default 0,
  score_flood numeric(10, 2) not null default 0,
  score_late numeric(10, 2) not null default 0,
  score_cohesion numeric(10, 2) not null default 0,
  score_total numeric(10, 2) not null default 0,
  flags text[] not null default '{}',
  explanation jsonb not null default '{}'::jsonb,
  locked boolean not null default false,
  committed_route_id uuid references public.delivery_routes (id) on delete set null,
  unique (run_id, vehicle_id),
  constraint dispatch_run_routes_times_ordered check (planned_return_at >= planned_depart_at)
);

create table public.dispatch_run_stops (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.dispatch_runs (id) on delete cascade,
  run_route_id uuid not null references public.dispatch_run_routes (id) on delete cascade,
  order_id uuid not null references public.delivery_orders (id),
  stop_type text not null check (stop_type in ('pickup', 'delivery')),
  seq integer not null check (seq > 0),
  address text not null,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  window_start_at timestamptz,
  window_end_at timestamptz,
  planned_arrival_at timestamptz not null,
  planned_departure_at timestamptz,
  p90_arrival_at timestamptz,
  slack_min numeric(8, 1),
  leg_min numeric(8, 1),
  leg_km numeric(8, 2),
  leg_flood_km numeric(8, 2) check (leg_flood_km is null or leg_flood_km >= 0),
  load_after_kg numeric(9, 2),
  load_after_m3 numeric(9, 4),
  township_pcode text,
  locked boolean not null default false,
  manual boolean not null default false,
  reasons jsonb not null default '[]'::jsonb,
  alternatives jsonb not null default '[]'::jsonb,
  committed_stop_id uuid references public.route_stops (id) on delete set null,
  unique (run_route_id, seq),
  unique (run_id, order_id, stop_type)
);

create index dispatch_run_stops_route_idx on public.dispatch_run_stops (run_route_id, seq);
create index dispatch_run_stops_order_idx on public.dispatch_run_stops (order_id);

create table public.dispatch_run_orders (
  run_id uuid not null references public.dispatch_runs (id) on delete cascade,
  order_id uuid not null references public.delivery_orders (id),
  disposition text not null check (disposition in ('assigned', 'unassigned')),
  run_route_id uuid references public.dispatch_run_routes (id) on delete cascade,
  unassigned_reason text check (unassigned_reason in (
    'missing_coordinates', 'outside_service_area', 'window_passed', 'window_infeasible',
    'exceeds_capacity_single', 'exceeds_range', 'exceeds_shift', 'flood_blocked',
    'no_eligible_truck', 'capacity_exhausted', 'time_exhausted', 'manager_excluded',
    'stale_order', 'solver_budget'
  )),
  unassigned_detail jsonb not null default '{}'::jsonb,
  origin_kind text not null check (origin_kind in ('door', 'depot')),
  -- Snapshot used to detect an order that changed after the plan was made.
  order_updated_at timestamptz not null,
  logistics_updated_at timestamptz,
  weight_kg numeric(9, 2),
  weight_source text check (weight_source in ('declared', 'weighed', 'size_estimate', 'default_assumed')),
  volume_m3 numeric(9, 4),
  volume_source text check (volume_source in ('declared', 'measured', 'size_estimate', 'default_assumed')),
  window_start_at timestamptz,
  window_end_at timestamptz,
  window_source text check (window_source in ('declared', 'parsed_description', 'default_assumed')),
  deadline_at timestamptz,
  deadline_hard boolean not null default false,
  pickup_township_pcode text,
  delivery_township_pcode text,
  manual_override boolean not null default false,
  primary key (run_id, order_id),
  constraint dispatch_run_orders_assigned_has_route
    check (disposition <> 'assigned' or run_route_id is not null),
  constraint dispatch_run_orders_unassigned_has_reason
    check (disposition <> 'unassigned' or unassigned_reason is not null)
);

-- Raw road matrix for a draft. Mapbox's terms on storing results are unverified,
-- so these rows are deleted when the plan is committed or discarded.
create table public.dispatch_run_matrices (
  run_id uuid primary key references public.dispatch_runs (id) on delete cascade,
  nodes jsonb not null,
  duration_s integer[] not null,
  distance_m integer[] not null,
  source_mask smallint[],
  provider text not null,
  profile text not null,
  elements_billed integer not null default 0 check (elements_billed >= 0),
  created_at timestamptz not null default now()
);

create table public.dispatch_run_edits (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.dispatch_runs (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  edit_type text not null check (edit_type in (
    'create', 'move_order', 'reorder_stop', 'lock_stop', 'unlock_stop', 'assign_driver',
    'assign_vehicle', 'exclude_order', 'include_order', 'reoptimize_route', 'override_window',
    'commit', 'discard', 'reopen', 'cancel'
  )),
  reason text not null check (length(btrim(reason)) >= 3),
  previous jsonb,
  next jsonb,
  violations jsonb not null default '[]'::jsonb,
  order_id uuid references public.delivery_orders (id),
  run_route_id uuid references public.dispatch_run_routes (id) on delete set null,
  revision_before integer,
  revision_after integer,
  created_at timestamptz not null default now()
);

create index dispatch_run_edits_run_idx on public.dispatch_run_edits (run_id, id);

-- ------------------------------------------- columns on existing route tables --

alter table public.delivery_routes
  add column dispatch_run_id uuid references public.dispatch_runs (id) on delete set null,
  add column dispatch_run_route_id uuid references public.dispatch_run_routes (id) on delete set null,
  add column depot_id uuid references public.depots (id),
  add column service_date date,
  add column planned_depart_at timestamptz,
  add column planned_return_at timestamptz;

create index delivery_routes_dispatch_run_idx on public.delivery_routes (dispatch_run_id);
create index delivery_routes_driver_service_date_idx
  on public.delivery_routes (driver_id, service_date) where dispatch_run_id is not null;

alter table public.route_stops
  add column dispatch_run_stop_id uuid references public.dispatch_run_stops (id) on delete set null,
  add column planned_arrival_at timestamptz,
  add column planned_departure_at timestamptz,
  add column window_start_at timestamptz,
  add column window_end_at timestamptz,
  add column arrived_at timestamptz;

-- Drivers hold UPDATE on route_stops and are limited only by this guard, so
-- every new column must be listed here. Body copied from
-- 20261020042534_create_delivery_operations_schema.sql with the new columns
-- added; arrived_at is stamped by the database, never taken from the client.
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
    or new.created_at is distinct from old.created_at
    or new.dispatch_run_stop_id is distinct from old.dispatch_run_stop_id
    or new.planned_arrival_at is distinct from old.planned_arrival_at
    or new.planned_departure_at is distinct from old.planned_departure_at
    or new.window_start_at is distinct from old.window_start_at
    or new.window_end_at is distinct from old.window_end_at then
    raise exception 'Drivers can only update route stop status and completion time';
  end if;

  new.arrived_at := old.arrived_at;
  if new.status = 'arrived' and old.status is distinct from 'arrived' then
    new.arrived_at := now();
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$$;

revoke all on function private.guard_route_stop_update() from public, anon, authenticated;

-- A manager using the single-order assignment UI after a commit ends the plan
-- assignment; its still-pending stops on that route must not stay on the
-- driver's list.
create or replace function private.skip_stops_when_assignment_ends()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.ended_at is null and new.ended_at is not null and new.route_id is not null then
    update public.route_stops
    set status = 'skipped'
    where route_id = new.route_id
      and order_id = new.order_id
      and status = 'pending';
  end if;
  return null;
end;
$$;

revoke all on function private.skip_stops_when_assignment_ends() from public, anon, authenticated;

create trigger skip_stops_when_assignment_ends
  after update of ended_at on public.delivery_assignments
  for each row execute function private.skip_stops_when_assignment_ends();

-- --------------------------------------------------------------- RLS/grants --

alter table public.dispatch_runs enable row level security;
alter table public.dispatch_run_routes enable row level security;
alter table public.dispatch_run_stops enable row level security;
alter table public.dispatch_run_orders enable row level security;
alter table public.dispatch_run_matrices enable row level security;
alter table public.dispatch_run_edits enable row level security;

revoke all on table public.dispatch_runs, public.dispatch_run_routes, public.dispatch_run_stops,
  public.dispatch_run_orders, public.dispatch_run_matrices, public.dispatch_run_edits
  from public, anon;
grant select on table public.dispatch_runs, public.dispatch_run_routes, public.dispatch_run_stops,
  public.dispatch_run_orders, public.dispatch_run_matrices, public.dispatch_run_edits
  to authenticated;

create policy dispatch_runs_read_access on public.dispatch_runs
  for select to authenticated using ((select private.is_manager()));
create policy dispatch_run_routes_read_access on public.dispatch_run_routes
  for select to authenticated using ((select private.is_manager()));
create policy dispatch_run_stops_read_access on public.dispatch_run_stops
  for select to authenticated using ((select private.is_manager()));
create policy dispatch_run_orders_read_access on public.dispatch_run_orders
  for select to authenticated using ((select private.is_manager()));
create policy dispatch_run_matrices_read_access on public.dispatch_run_matrices
  for select to authenticated using ((select private.is_manager()));
create policy dispatch_run_edits_read_access on public.dispatch_run_edits
  for select to authenticated using ((select private.is_manager()));

do $$
begin
  alter publication supabase_realtime add table public.dispatch_runs;
exception
  when duplicate_object then null;
end;
$$;

-- ------------------------------------------------------------ save_dispatch_run --

/**
 * Stores a planned run as a draft. The payload is built by the planner (see
 * src/lib/delivery/dispatch); this function re-checks the invariants that
 * matter, because the browser and the route handler are not trusted:
 * one delivery stop per assigned order, a pickup before it for door orders,
 * no stops for unassigned orders, and load within the truck's capacity_kg.
 * Expected outcomes come back as jsonb; a malformed plan raises 22023.
 */
create or replace function public.save_dispatch_run(
  p_payload jsonb,
  p_client_key uuid,
  p_replace_draft boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  depot public.depots;
  existing public.dispatch_runs;
  new_run_id uuid;
  route_json jsonb;
  order_json jsonb;
  stop_json jsonb;
  new_route_id uuid;
  problem text;
begin
  if actor is null or not (select private.is_manager()) then
    raise exception 'Only managers can save dispatch plans' using errcode = '42501';
  end if;
  if p_client_key is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'A payload object and client key are required' using errcode = '22023';
  end if;

  select * into existing from public.dispatch_runs where client_key = p_client_key;
  if found then
    return jsonb_build_object('saved', true, 'duplicate', true,
      'run_id', existing.id, 'revision', existing.revision, 'status', existing.status);
  end if;

  select * into depot from public.depots where id = (p_payload ->> 'depot_id')::uuid;
  if not found or not depot.is_active then
    raise exception 'Depot not found' using errcode = 'P0002';
  end if;
  if depot.location_status <> 'verified' then
    return jsonb_build_object('saved', false, 'reason', 'depot_unverified');
  end if;

  select * into existing from public.dispatch_runs
  where depot_id = depot.id
    and service_date = (p_payload ->> 'service_date')::date
    and status = 'draft'
  for update;
  if found then
    if not p_replace_draft then
      return jsonb_build_object('saved', false, 'reason', 'draft_exists', 'run_id', existing.id);
    end if;
    update public.dispatch_runs
    set status = 'discarded', discarded_at = now(), discarded_by = actor,
        discard_reason = 'Replaced by a new plan'
    where id = existing.id;
    delete from public.dispatch_run_matrices where run_id = existing.id;
    insert into public.dispatch_run_edits (run_id, actor_id, edit_type, reason, revision_before)
    values (existing.id, actor, 'discard', 'Replaced by a new plan', existing.revision);
  end if;

  insert into public.dispatch_runs (
    depot_id, service_date, parent_run_id, client_key, engine_version, params, seed,
    iterations, stop_reason, runtime_ms, data_quality, data_quality_detail,
    score_total, score_breakdown, created_by
  )
  values (
    depot.id,
    (p_payload ->> 'service_date')::date,
    nullif(p_payload ->> 'parent_run_id', '')::uuid,
    p_client_key,
    coalesce(nullif(p_payload ->> 'engine_version', ''), 'unknown'),
    coalesce(p_payload -> 'params', '{}'::jsonb),
    (p_payload ->> 'seed')::bigint,
    (p_payload ->> 'iterations')::integer,
    p_payload ->> 'stop_reason',
    (p_payload ->> 'runtime_ms')::integer,
    p_payload ->> 'data_quality',
    coalesce(p_payload -> 'data_quality_detail', '{}'::jsonb),
    (p_payload ->> 'score_total')::numeric,
    coalesce(p_payload -> 'score_breakdown', '{}'::jsonb),
    actor
  )
  returning id into new_run_id;

  for route_json in select * from jsonb_array_elements(coalesce(p_payload -> 'routes', '[]'::jsonb))
  loop
    insert into public.dispatch_run_routes (
      run_id, vehicle_id, driver_id, display_order, planned_depart_at, planned_return_at,
      p90_return_at, distance_km, travel_min, service_min, wait_min, peak_kg, peak_m3,
      cap_kg_used, cap_m3_used, usable_range_km, energy_status,
      score_time, score_uncertainty, score_cost, score_flood, score_late, score_cohesion,
      score_total, flags, explanation
    )
    values (
      new_run_id,
      (route_json ->> 'vehicle_id')::uuid,
      nullif(route_json ->> 'driver_id', '')::uuid,
      coalesce((route_json ->> 'display_order')::integer, 0),
      (route_json ->> 'planned_depart_at')::timestamptz,
      (route_json ->> 'planned_return_at')::timestamptz,
      (route_json ->> 'p90_return_at')::timestamptz,
      coalesce((route_json ->> 'distance_km')::numeric, 0),
      coalesce((route_json ->> 'travel_min')::numeric, 0),
      coalesce((route_json ->> 'service_min')::numeric, 0),
      coalesce((route_json ->> 'wait_min')::numeric, 0),
      coalesce((route_json ->> 'peak_kg')::numeric, 0),
      coalesce((route_json ->> 'peak_m3')::numeric, 0),
      (route_json ->> 'cap_kg_used')::numeric,
      (route_json ->> 'cap_m3_used')::numeric,
      (route_json ->> 'usable_range_km')::numeric,
      route_json ->> 'energy_status',
      coalesce((route_json ->> 'score_time')::numeric, 0),
      coalesce((route_json ->> 'score_uncertainty')::numeric, 0),
      coalesce((route_json ->> 'score_cost')::numeric, 0),
      coalesce((route_json ->> 'score_flood')::numeric, 0),
      coalesce((route_json ->> 'score_late')::numeric, 0),
      coalesce((route_json ->> 'score_cohesion')::numeric, 0),
      coalesce((route_json ->> 'score_total')::numeric, 0),
      coalesce(
        (select array_agg(flag) from jsonb_array_elements_text(coalesce(route_json -> 'flags', '[]'::jsonb)) as flag),
        '{}'
      ),
      coalesce(route_json -> 'explanation', '{}'::jsonb)
    )
    returning id into new_route_id;

    for stop_json in select * from jsonb_array_elements(coalesce(route_json -> 'stops', '[]'::jsonb))
    loop
      insert into public.dispatch_run_stops (
        run_id, run_route_id, order_id, stop_type, seq, address, latitude, longitude,
        window_start_at, window_end_at, planned_arrival_at, planned_departure_at, p90_arrival_at,
        slack_min, leg_min, leg_km, leg_flood_km, load_after_kg, load_after_m3,
        township_pcode, reasons
      )
      values (
        new_run_id, new_route_id,
        (stop_json ->> 'order_id')::uuid,
        stop_json ->> 'stop_type',
        (stop_json ->> 'seq')::integer,
        stop_json ->> 'address',
        (stop_json ->> 'latitude')::numeric,
        (stop_json ->> 'longitude')::numeric,
        (stop_json ->> 'window_start_at')::timestamptz,
        (stop_json ->> 'window_end_at')::timestamptz,
        (stop_json ->> 'planned_arrival_at')::timestamptz,
        (stop_json ->> 'planned_departure_at')::timestamptz,
        (stop_json ->> 'p90_arrival_at')::timestamptz,
        (stop_json ->> 'slack_min')::numeric,
        (stop_json ->> 'leg_min')::numeric,
        (stop_json ->> 'leg_km')::numeric,
        (stop_json ->> 'leg_flood_km')::numeric,
        (stop_json ->> 'load_after_kg')::numeric,
        (stop_json ->> 'load_after_m3')::numeric,
        stop_json ->> 'township_pcode',
        coalesce(stop_json -> 'reasons', '[]'::jsonb)
      );
    end loop;
  end loop;

  for order_json in select * from jsonb_array_elements(coalesce(p_payload -> 'orders', '[]'::jsonb))
  loop
    insert into public.dispatch_run_orders (
      run_id, order_id, disposition, run_route_id, unassigned_reason, unassigned_detail,
      origin_kind, order_updated_at, logistics_updated_at,
      weight_kg, weight_source, volume_m3, volume_source,
      window_start_at, window_end_at, window_source, deadline_at, deadline_hard,
      pickup_township_pcode, delivery_township_pcode
    )
    values (
      new_run_id,
      (order_json ->> 'order_id')::uuid,
      order_json ->> 'disposition',
      (select route.id from public.dispatch_run_routes as route
        where route.run_id = new_run_id and route.vehicle_id = nullif(order_json ->> 'vehicle_id', '')::uuid),
      order_json ->> 'unassigned_reason',
      coalesce(order_json -> 'unassigned_detail', '{}'::jsonb),
      order_json ->> 'origin_kind',
      (order_json ->> 'order_updated_at')::timestamptz,
      (order_json ->> 'logistics_updated_at')::timestamptz,
      (order_json ->> 'weight_kg')::numeric,
      order_json ->> 'weight_source',
      (order_json ->> 'volume_m3')::numeric,
      order_json ->> 'volume_source',
      (order_json ->> 'window_start_at')::timestamptz,
      (order_json ->> 'window_end_at')::timestamptz,
      order_json ->> 'window_source',
      (order_json ->> 'deadline_at')::timestamptz,
      coalesce((order_json ->> 'deadline_hard')::boolean, false),
      order_json ->> 'pickup_township_pcode',
      order_json ->> 'delivery_township_pcode'
    );
  end loop;

  if p_payload -> 'matrix' is not null and jsonb_typeof(p_payload -> 'matrix') = 'object' then
    insert into public.dispatch_run_matrices (
      run_id, nodes, duration_s, distance_m, source_mask, provider, profile, elements_billed
    )
    values (
      new_run_id,
      p_payload -> 'matrix' -> 'nodes',
      (select array_agg(value::integer) from jsonb_array_elements_text(p_payload -> 'matrix' -> 'duration_s') as value),
      (select array_agg(value::integer) from jsonb_array_elements_text(p_payload -> 'matrix' -> 'distance_m') as value),
      (select array_agg(value::smallint) from jsonb_array_elements_text(coalesce(p_payload -> 'matrix' -> 'source_mask', '[]'::jsonb)) as value),
      coalesce(p_payload -> 'matrix' ->> 'provider', 'unknown'),
      coalesce(p_payload -> 'matrix' ->> 'profile', 'unknown'),
      coalesce((p_payload -> 'matrix' ->> 'elements_billed')::integer, 0)
    );
  end if;

  -- Re-check the plan against the rules the planner is supposed to guarantee.
  select case
    when exists (
      select 1 from public.dispatch_run_orders as plan_order
      where plan_order.run_id = new_run_id and plan_order.disposition = 'assigned'
        and (select count(*) from public.dispatch_run_stops as stop
             where stop.run_id = new_run_id and stop.order_id = plan_order.order_id
               and stop.stop_type = 'delivery' and stop.run_route_id = plan_order.run_route_id) <> 1
    ) then 'every assigned order needs exactly one delivery stop on its truck'
    when exists (
      select 1 from public.dispatch_run_orders as plan_order
      where plan_order.run_id = new_run_id and plan_order.disposition = 'assigned'
        and plan_order.origin_kind = 'door'
        and not exists (
          select 1 from public.dispatch_run_stops as pickup
          join public.dispatch_run_stops as drop_off
            on drop_off.run_id = pickup.run_id and drop_off.order_id = pickup.order_id
           and drop_off.stop_type = 'delivery' and drop_off.run_route_id = pickup.run_route_id
          where pickup.run_id = new_run_id and pickup.order_id = plan_order.order_id
            and pickup.stop_type = 'pickup' and pickup.seq < drop_off.seq
            and pickup.run_route_id = plan_order.run_route_id
        )
    ) then 'a door order needs a pickup stop before its delivery on the same truck'
    when exists (
      select 1 from public.dispatch_run_orders as plan_order
      where plan_order.run_id = new_run_id and plan_order.origin_kind = 'depot'
        and exists (select 1 from public.dispatch_run_stops as stop
                    where stop.run_id = new_run_id and stop.order_id = plan_order.order_id
                      and stop.stop_type = 'pickup')
    ) then 'a depot order cannot have a pickup stop'
    when exists (
      select 1 from public.dispatch_run_stops as stop
      where stop.run_id = new_run_id
        and not exists (select 1 from public.dispatch_run_orders as plan_order
                        where plan_order.run_id = new_run_id and plan_order.order_id = stop.order_id
                          and plan_order.disposition = 'assigned'
                          and plan_order.run_route_id = stop.run_route_id)
    ) then 'a stop belongs to an order that is not assigned to that truck'
    when exists (
      select 1 from public.dispatch_run_routes as route
      join public.vehicles as vehicle on vehicle.id = route.vehicle_id
      where route.run_id = new_run_id
        and (vehicle.capacity_kg is null or route.peak_kg > vehicle.capacity_kg)
    ) then 'a truck has no capacity_kg or its planned load exceeds it'
    else null
  end into problem;
  if problem is not null then
    raise exception 'Invalid dispatch plan: %', problem using errcode = '22023';
  end if;

  insert into public.dispatch_run_edits (run_id, actor_id, edit_type, reason, revision_after)
  values (new_run_id, actor, 'create', 'Plan created', 1);

  return jsonb_build_object('saved', true, 'duplicate', false,
    'run_id', new_run_id, 'revision', 1, 'status', 'draft');
end;
$$;

revoke all on function public.save_dispatch_run(jsonb, uuid, boolean) from public, anon;
grant execute on function public.save_dispatch_run(jsonb, uuid, boolean) to authenticated;

-- --------------------------------------------------------- commit_dispatch_run --

/**
 * Turns a draft into real routes, atomically. Idempotent on p_commit_key.
 * Only plans for today (Asia/Yangon) can be committed: assign_delivery marks
 * orders assigned immediately and the driver app does not filter by date.
 * p_on_stale = 'abort' (default) refuses when any order changed since planning;
 * 'skip' drops those orders, renumbers the stops and commits the rest (planned
 * times are then stale and should be refreshed).
 */
create or replace function public.commit_dispatch_run(
  p_run_id uuid,
  p_expected_revision integer,
  p_commit_key uuid,
  p_on_stale text default 'abort'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  run public.dispatch_runs;
  today date := (now() at time zone 'Asia/Yangon')::date;
  stale jsonb;
  blocked jsonb;
  route_row record;
  stop_row record;
  new_route_id uuid;
  committed_orders integer := 0;
  skipped_count integer := 0;
  summary jsonb;
begin
  if actor is null or not (select private.is_manager()) then
    raise exception 'Only managers can commit dispatch plans' using errcode = '42501';
  end if;
  if p_commit_key is null then
    raise exception 'A commit key is required' using errcode = '22023';
  end if;
  if p_on_stale not in ('abort', 'skip') then
    raise exception 'p_on_stale must be abort or skip' using errcode = '22023';
  end if;

  select * into run from public.dispatch_runs where id = p_run_id for update;
  if not found then
    raise exception 'Dispatch plan not found' using errcode = 'P0002';
  end if;

  if run.status = 'committed' then
    if run.commit_key = p_commit_key then
      return jsonb_build_object('committed', true, 'duplicate', true, 'run_id', run.id,
        'routes', (select coalesce(jsonb_agg(jsonb_build_object(
          'run_route_id', route.id, 'route_id', route.committed_route_id,
          'vehicle_id', route.vehicle_id, 'driver_id', route.driver_id) order by route.display_order), '[]'::jsonb)
          from public.dispatch_run_routes as route
          where route.run_id = run.id and route.committed_route_id is not null));
    end if;
    return jsonb_build_object('committed', false, 'reason', 'already_committed');
  end if;
  if run.status <> 'draft' then
    raise exception 'Only draft plans can be committed' using errcode = 'P0001';
  end if;
  if run.revision <> p_expected_revision then
    return jsonb_build_object('committed', false, 'reason', 'revision_conflict', 'revision', run.revision);
  end if;
  if run.service_date <> today then
    return jsonb_build_object('committed', false,
      'reason', case when run.service_date > today then 'future_date' else 'past_date' end,
      'service_date', run.service_date, 'today', today);
  end if;

  -- Lock in one global order (orders, drivers, vehicles) to avoid deadlocks
  -- with assign_delivery, which locks in the same order.
  perform 1 from public.delivery_orders as delivery_order
  where delivery_order.id in (
    select plan_order.order_id from public.dispatch_run_orders as plan_order
    where plan_order.run_id = run.id and plan_order.disposition = 'assigned')
  order by delivery_order.id for update;
  perform 1 from public.driver_profiles as driver
  where driver.user_id in (select route.driver_id from public.dispatch_run_routes as route where route.run_id = run.id)
  order by driver.user_id for update;
  perform 1 from public.vehicles as vehicle
  where vehicle.id in (select route.vehicle_id from public.dispatch_run_routes as route where route.run_id = run.id)
  order by vehicle.id for update;

  -- Trucks and drivers that cannot be skipped around.
  select coalesce(jsonb_agg(jsonb_build_object('vehicle_id', route.vehicle_id, 'problem', problem)), '[]'::jsonb)
  into blocked
  from (
    select route.vehicle_id,
      case
        when route.driver_id is null then 'missing_driver'
        when not exists (select 1 from public.driver_profiles as driver
                         where driver.user_id = route.driver_id and driver.availability <> 'off_duty') then 'driver_unavailable'
        when exists (select 1 from public.delivery_routes as other
                     where other.driver_id = route.driver_id and other.service_date = run.service_date
                       and other.dispatch_run_id is not null and other.status in ('planned', 'in_progress')) then 'driver_busy'
        when not exists (select 1 from public.vehicles as vehicle
                         where vehicle.id = route.vehicle_id and vehicle.status in ('available', 'in_use')) then 'vehicle_unavailable'
        when exists (select 1 from public.vehicles as vehicle
                     where vehicle.id = route.vehicle_id and (vehicle.capacity_kg is null or vehicle.capacity_kg < route.peak_kg)) then 'vehicle_capacity'
      end as problem
    from public.dispatch_run_routes as route
    where route.run_id = run.id
      and exists (select 1 from public.dispatch_run_stops as stop where stop.run_route_id = route.id)
  ) as route
  where problem is not null;
  if jsonb_array_length(blocked) > 0 then
    return jsonb_build_object('committed', false, 'reason', 'routes_blocked', 'routes', blocked);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('order_id', plan_order.order_id, 'change', change)), '[]'::jsonb)
  into stale
  from (
    select plan_order.order_id,
      case
        when delivery_order.id is null then 'order_missing'
        when delivery_order.status <> 'pending' then 'status_changed'
        when exists (select 1 from public.delivery_assignments as assignment
                     where assignment.order_id = plan_order.order_id and assignment.ended_at is null) then 'already_assigned'
        when delivery_order.updated_at is distinct from plan_order.order_updated_at then 'order_changed'
        when (select logistics.updated_at from public.delivery_order_logistics as logistics
              where logistics.order_id = plan_order.order_id) is distinct from plan_order.logistics_updated_at then 'logistics_changed'
      end as change
    from public.dispatch_run_orders as plan_order
    left join public.delivery_orders as delivery_order on delivery_order.id = plan_order.order_id
    where plan_order.run_id = run.id and plan_order.disposition = 'assigned'
  ) as plan_order
  where change is not null;

  if jsonb_array_length(stale) > 0 then
    if p_on_stale = 'abort' then
      return jsonb_build_object('committed', false, 'reason', 'stale', 'stale_orders', stale);
    end if;
    skipped_count := jsonb_array_length(stale);
    delete from public.dispatch_run_stops
    where run_id = run.id
      and order_id in (select (item ->> 'order_id')::uuid from jsonb_array_elements(stale) as item);
    update public.dispatch_run_orders
    set disposition = 'unassigned', run_route_id = null, unassigned_reason = 'stale_order'
    where run_id = run.id
      and order_id in (select (item ->> 'order_id')::uuid from jsonb_array_elements(stale) as item);
    -- Close the gaps in each truck's sequence.
    update public.dispatch_run_stops as stop
    set seq = renumbered.new_seq
    from (select id, row_number() over (partition by run_route_id order by seq) as new_seq
          from public.dispatch_run_stops where run_id = run.id) as renumbered
    where stop.id = renumbered.id and stop.seq <> renumbered.new_seq;
  end if;

  for route_row in
    select route.* from public.dispatch_run_routes as route
    where route.run_id = run.id
      and exists (select 1 from public.dispatch_run_stops as stop where stop.run_route_id = route.id)
    order by route.display_order, route.id
  loop
    insert into public.delivery_routes (
      driver_id, vehicle_id, status, planned_at, created_by,
      dispatch_run_id, dispatch_run_route_id, depot_id, service_date,
      planned_depart_at, planned_return_at
    )
    values (
      route_row.driver_id, route_row.vehicle_id, 'planned', route_row.planned_depart_at, actor,
      run.id, route_row.id, run.depot_id, run.service_date,
      route_row.planned_depart_at, route_row.planned_return_at
    )
    returning id into new_route_id;

    update public.dispatch_run_routes set committed_route_id = new_route_id where id = route_row.id;

    for stop_row in
      select distinct stop.order_id from public.dispatch_run_stops as stop
      where stop.run_route_id = route_row.id
      order by stop.order_id
    loop
      perform public.assign_delivery(stop_row.order_id, route_row.driver_id, route_row.vehicle_id);
      update public.delivery_assignments
      set route_id = new_route_id
      where order_id = stop_row.order_id and ended_at is null;
      committed_orders := committed_orders + 1;
    end loop;

    insert into public.route_stops (
      route_id, order_id, stop_type, sequence_number, address, latitude, longitude, status,
      dispatch_run_stop_id, planned_arrival_at, planned_departure_at, window_start_at, window_end_at
    )
    select new_route_id, stop.order_id, stop.stop_type, stop.seq, stop.address, stop.latitude, stop.longitude,
      'pending', stop.id, stop.planned_arrival_at, stop.planned_departure_at, stop.window_start_at, stop.window_end_at
    from public.dispatch_run_stops as stop
    where stop.run_route_id = route_row.id
    order by stop.seq;

    update public.dispatch_run_stops as stop
    set committed_stop_id = route_stop.id
    from public.route_stops as route_stop
    where route_stop.dispatch_run_stop_id = stop.id and stop.run_route_id = route_row.id;
  end loop;

  delete from public.dispatch_run_matrices where run_id = run.id;

  update public.dispatch_runs
  set status = 'committed', commit_key = p_commit_key, committed_at = now(), committed_by = actor,
      revision = revision + case when skipped_count > 0 then 1 else 0 end
  where id = run.id;

  insert into public.dispatch_run_edits (run_id, actor_id, edit_type, reason, revision_before, revision_after, next)
  values (run.id, actor, 'commit',
    case when skipped_count > 0 then 'Plan committed without ' || skipped_count || ' changed order(s)' else 'Plan committed' end,
    run.revision, run.revision + case when skipped_count > 0 then 1 else 0 end,
    jsonb_build_object('orders', committed_orders, 'skipped', stale));

  select jsonb_build_object('committed', true, 'duplicate', false, 'run_id', run.id,
    'orders', committed_orders, 'partial', skipped_count > 0, 'skipped', stale,
    'routes', coalesce(jsonb_agg(jsonb_build_object(
      'run_route_id', route.id, 'route_id', route.committed_route_id,
      'vehicle_id', route.vehicle_id, 'driver_id', route.driver_id) order by route.display_order), '[]'::jsonb))
  into summary
  from public.dispatch_run_routes as route
  where route.run_id = run.id and route.committed_route_id is not null;
  return summary;
end;
$$;

revoke all on function public.commit_dispatch_run(uuid, integer, uuid, text) from public, anon;
grant execute on function public.commit_dispatch_run(uuid, integer, uuid, text) to authenticated;

-- -------------------------------------------------------- discard_dispatch_run --

create or replace function public.discard_dispatch_run(p_run_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  run public.dispatch_runs;
begin
  if actor is null or not (select private.is_manager()) then
    raise exception 'Only managers can discard dispatch plans' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  select * into run from public.dispatch_runs where id = p_run_id for update;
  if not found then
    raise exception 'Dispatch plan not found' using errcode = 'P0002';
  end if;
  if run.status <> 'draft' then
    return jsonb_build_object('discarded', false, 'reason', 'not_draft', 'status', run.status);
  end if;

  update public.dispatch_runs
  set status = 'discarded', discarded_at = now(), discarded_by = actor, discard_reason = btrim(p_reason)
  where id = run.id;
  delete from public.dispatch_run_matrices where run_id = run.id;
  insert into public.dispatch_run_edits (run_id, actor_id, edit_type, reason, revision_before)
  values (run.id, actor, 'discard', btrim(p_reason), run.revision);
  return jsonb_build_object('discarded', true, 'run_id', run.id);
end;
$$;

revoke all on function public.discard_dispatch_run(uuid, text) from public, anon;
grant execute on function public.discard_dispatch_run(uuid, text) to authenticated;
