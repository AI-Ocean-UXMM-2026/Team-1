-- Reference data for multi-truck dispatch: depot, townships, flood-hazard
-- layers and per-truck planning attributes.
--
-- Nothing here is written by clients except vehicle_dispatch_profiles
-- (manager only). The depot ships unverified with no coordinates: the planner
-- must refuse to run until a manager confirms a pin with set_depot_location.

create or replace function private.is_driver()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'driver'
  );
$$;

revoke all on function private.is_driver() from public, anon;
grant execute on function private.is_driver() to authenticated;

-- ------------------------------------------------------------------ depots --

create table public.depots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  address text,
  township_pcode text,
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  location_status text not null default 'unverified'
    check (location_status in ('unverified', 'verified')),
  coordinate_source text,
  verification_note text,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  opens_at time not null default '08:00',
  closes_at time not null default '20:00',
  timezone text not null default 'Asia/Yangon',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint depots_coordinates_together
    check ((latitude is null) = (longitude is null)),
  constraint depots_verified_has_location
    check (
      location_status = 'unverified'
      or (latitude is not null and verified_at is not null and coordinate_source is not null)
    )
);

create trigger touch_depots_updated_at
  before update on public.depots
  for each row execute function private.touch_updated_at();

-- No coordinates on purpose: the real warehouse pin is confirmed by a manager.
insert into public.depots (code, name, address)
values ('MGD', 'Mingalardone', 'Mingaladon Township, Yangon');

-- ---------------------------------------------------------- service_areas --

create table public.service_areas (
  pcode text primary key check (length(btrim(pcode)) > 0),
  name_en text not null,
  name_my text,
  district text,
  centroid_lat numeric(9, 6) check (centroid_lat is null or centroid_lat between -90 and 90),
  centroid_lng numeric(9, 6) check (centroid_lng is null or centroid_lng between -180 and 180),
  boundary jsonb,
  source text not null,
  source_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_areas_centroid_together
    check ((centroid_lat is null) = (centroid_lng is null))
);

create trigger touch_service_areas_updated_at
  before update on public.service_areas
  for each row execute function private.touch_updated_at();

-- -------------------------------------------------------- geo_hazard_layers --

create table public.geo_hazard_layers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('flood')),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  source_name text not null,
  source_url text,
  license text,
  captured_on date,
  crs text not null default 'EPSG:4326',
  hazard_classes jsonb not null default '[]'::jsonb,
  geojson jsonb not null,
  bbox numeric[],
  feature_count integer check (feature_count is null or feature_count >= 0),
  simplify_tol_deg numeric,
  assumptions jsonb not null default '{}'::jsonb,
  loaded_at timestamptz not null default now()
);

create unique index geo_hazard_layers_one_active_idx
  on public.geo_hazard_layers (kind) where status = 'active';

-- ------------------------------------------------ vehicle_dispatch_profiles --

create table public.vehicle_dispatch_profiles (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  depot_id uuid references public.depots (id),
  default_driver_id uuid references public.driver_profiles (user_id) on delete set null,
  capacity_m3 numeric(8, 3) check (capacity_m3 is null or capacity_m3 > 0),
  cost_per_km_mmk numeric(10, 2) check (cost_per_km_mmk is null or cost_per_km_mmk >= 0),
  fixed_cost_mmk numeric(12, 2) check (fixed_cost_mmk is null or fixed_cost_mmk >= 0),
  speed_factor numeric(4, 2) not null default 1 check (speed_factor > 0),
  shift_start time,
  shift_end time,
  cost_source text not null default 'assumed' check (cost_source in ('assumed', 'measured')),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicle_dispatch_profiles_depot_idx on public.vehicle_dispatch_profiles (depot_id);

create trigger touch_vehicle_dispatch_profiles_updated_at
  before update on public.vehicle_dispatch_profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- RLS/grants --

alter table public.depots enable row level security;
alter table public.service_areas enable row level security;
alter table public.geo_hazard_layers enable row level security;
alter table public.vehicle_dispatch_profiles enable row level security;

revoke all on table public.depots, public.service_areas, public.geo_hazard_layers,
  public.vehicle_dispatch_profiles from public, anon;
grant select on table public.depots, public.service_areas, public.geo_hazard_layers
  to authenticated;
grant select, insert, update, delete on table public.vehicle_dispatch_profiles
  to authenticated;

create policy depots_read_access on public.depots
  for select to authenticated
  using (
    (select private.is_manager())
    or (select private.is_support())
    or (select private.is_driver())
  );

create policy service_areas_read_access on public.service_areas
  for select to authenticated
  using (
    (select private.is_manager())
    or (select private.is_support())
    or (select private.is_driver())
  );

create policy geo_hazard_layers_read_access on public.geo_hazard_layers
  for select to authenticated
  using ((select private.is_manager()));

create policy vehicle_dispatch_profiles_read_access on public.vehicle_dispatch_profiles
  for select to authenticated
  using ((select private.is_manager()) or (select private.is_support()));
create policy vehicle_dispatch_profiles_insert_manager on public.vehicle_dispatch_profiles
  for insert to authenticated
  with check ((select private.is_manager()));
create policy vehicle_dispatch_profiles_update_manager on public.vehicle_dispatch_profiles
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
create policy vehicle_dispatch_profiles_delete_manager on public.vehicle_dispatch_profiles
  for delete to authenticated
  using ((select private.is_manager()));

-- ------------------------------------------------------- set_depot_location --

/** Confirms the depot pin. Manager only; records who, when and from where. */
create or replace function public.set_depot_location(
  p_depot_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_source text,
  p_note text default null
)
returns public.depots
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.depots;
begin
  if not (select private.is_manager()) then
    raise exception 'Only managers can set a depot location' using errcode = '42501';
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Latitude and longitude are required and must be valid' using errcode = '22023';
  end if;
  if p_source is null or length(btrim(p_source)) < 3 then
    raise exception 'A coordinate source is required' using errcode = '22023';
  end if;

  update public.depots
  set latitude = round(p_latitude, 6),
      longitude = round(p_longitude, 6),
      location_status = 'verified',
      coordinate_source = btrim(p_source),
      verification_note = nullif(btrim(coalesce(p_note, '')), ''),
      verified_at = now(),
      verified_by = (select auth.uid())
  where id = p_depot_id
  returning * into result;

  if not found then
    raise exception 'Depot not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.set_depot_location(uuid, numeric, numeric, text, text)
  from public, anon;
grant execute on function public.set_depot_location(uuid, numeric, numeric, text, text)
  to authenticated;
