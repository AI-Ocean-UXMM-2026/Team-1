-- Rider requests for help while on a route: a fuel or charging stop, or an
-- issue operations must act on (breakdown, accident, damaged parcel, unsafe
-- area). Riders raise them from the navigation screen; managers acknowledge
-- and resolve them from dispatch. Road conditions stay in road_reports and
-- failed deliveries stay in delivery_outcome_reports.

create table public.rider_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles (user_id) on delete cascade,
  order_id uuid references public.delivery_orders (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  kind text not null check (kind in ('energy', 'issue')),
  category text not null check (
    category in (
      'refuel', 'recharge',
      'vehicle_problem', 'accident', 'parcel_damaged', 'unsafe_area', 'other'
    )
  ),
  note text check (note is null or char_length(note) <= 500),
  energy_level_percent smallint
    check (energy_level_percent is null or energy_level_percent between 0 and 100),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  handled_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint rider_assistance_requests_category_matches_kind check (
    (kind = 'energy' and category in ('refuel', 'recharge'))
    or (kind = 'issue' and category not in ('refuel', 'recharge'))
  ),
  constraint rider_assistance_requests_other_has_note check (
    category <> 'other' or char_length(trim(coalesce(note, ''))) >= 3
  ),
  constraint rider_assistance_requests_location_pair check (
    (latitude is null) = (longitude is null)
  )
);

create index rider_assistance_requests_driver_idx
  on public.rider_assistance_requests (driver_id, created_at desc);
-- Dispatch reads what is still waiting on someone.
create index rider_assistance_requests_unresolved_idx
  on public.rider_assistance_requests (created_at desc)
  where status <> 'resolved';
create index rider_assistance_requests_order_idx
  on public.rider_assistance_requests (order_id)
  where order_id is not null;
create index rider_assistance_requests_vehicle_idx
  on public.rider_assistance_requests (vehicle_id)
  where vehicle_id is not null;
create index rider_assistance_requests_handled_by_idx
  on public.rider_assistance_requests (handled_by)
  where handled_by is not null;

alter table public.rider_assistance_requests enable row level security;

create policy rider_assistance_requests_read_access
  on public.rider_assistance_requests for select to authenticated
  using (
    (select private.is_manager())
    or (select private.is_support())
    or driver_id = (select auth.uid())
  );

-- Riders raise requests only as themselves, only about their own deliveries,
-- and always as new, unhandled requests.
create policy rider_assistance_requests_driver_insert
  on public.rider_assistance_requests for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and status = 'open'
    and handled_by is null
    and acknowledged_at is null
    and resolved_at is null
    and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'driver'
    )
    and (order_id is null or (select private.is_assigned_driver(order_id)))
  );

create policy rider_assistance_requests_manager_update
  on public.rider_assistance_requests for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create or replace function private.handle_rider_assistance_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if old.status = 'resolved' then
      raise exception 'A resolved rider request cannot be reopened';
    end if;
    if new.status = 'open' then
      raise exception 'A handled rider request cannot return to open';
    end if;
    new.handled_by := (select auth.uid());
    if new.status = 'acknowledged' then
      new.acknowledged_at := now();
    elsif new.status = 'resolved' then
      new.acknowledged_at := coalesce(old.acknowledged_at, now());
      new.resolved_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger handle_rider_assistance_request
  before update on public.rider_assistance_requests
  for each row execute function private.handle_rider_assistance_request();

revoke all on public.rider_assistance_requests from public, anon;
grant select, insert, update on public.rider_assistance_requests to authenticated;

-- Dispatch sees new requests without refreshing.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'rider_assistance_requests'
    )
  then
    alter publication supabase_realtime add table public.rider_assistance_requests;
  end if;
end;
$$;
