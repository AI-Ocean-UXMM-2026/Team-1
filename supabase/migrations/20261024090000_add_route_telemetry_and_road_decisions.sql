-- Driver route telemetry (speed + heading on existing GPS pings), anonymised
-- road speed cells for routing, and the road-intelligence engine's decisions
-- about each driver-submitted road note.

alter table public.delivery_locations
  add column speed_mps numeric(6, 2),
  add column heading_degrees numeric(5, 2),
  add constraint delivery_locations_speed_range
    check (speed_mps is null or speed_mps between 0 and 70),
  add constraint delivery_locations_heading_range
    check (heading_degrees is null or heading_degrees between 0 and 360);

create index delivery_locations_recorded_idx
  on public.delivery_locations (recorded_at desc)
  where speed_mps is not null;

-- Observed speed per ~110 m grid cell over a recent window. Returns no driver
-- identity, only aggregates, and only to riders and managers who route with it.
create or replace function public.recent_road_speed_cells(window_minutes integer default 30)
returns table (
  cell_latitude numeric,
  cell_longitude numeric,
  samples integer,
  drivers integer,
  median_speed_kmh numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    (select private.is_manager())
    or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'driver'
    )
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    round(location.latitude / 0.001) * 0.001,
    round(location.longitude / 0.001) * 0.001,
    count(*)::integer,
    count(distinct location.driver_id)::integer,
    round((percentile_cont(0.5) within group (order by location.speed_mps) * 3.6)::numeric, 1)
  from public.delivery_locations as location
  where location.speed_mps is not null
    and location.recorded_at > now() - make_interval(mins => least(greatest(window_minutes, 5), 180))
    and (location.accuracy_meters is null or location.accuracy_meters <= 50)
  group by 1, 2
  having count(*) >= 3;
end;
$$;

revoke all on function public.recent_road_speed_cells(integer) from public, anon;
grant execute on function public.recent_road_speed_cells(integer) to authenticated;

create table public.road_report_decisions (
  report_id uuid primary key references public.road_reports (id) on delete cascade,
  action text not null check (action in ('avoid', 'delay', 'monitor', 'ignore')),
  category text not null
    check (category in ('congestion', 'closure', 'roadwork', 'flooding', 'hazard')),
  severity text not null check (severity in ('low', 'medium', 'high', 'blocked')),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  delay_minutes numeric(5, 1) not null default 0 check (delay_minutes between 0 and 120),
  radius_meters integer not null default 150 check (radius_meters between 30 and 2000),
  expires_at timestamptz not null,
  rationale text not null check (char_length(rationale) <= 600),
  evidence jsonb not null default '{}'::jsonb,
  source text not null check (source in ('agent', 'heuristic')),
  model text,
  created_at timestamptz not null default now()
);

create index road_report_decisions_active_idx
  on public.road_report_decisions (expires_at);

alter table public.road_report_decisions enable row level security;

create policy road_report_decisions_read_access on public.road_report_decisions
  for select
  to authenticated
  using (
    (select private.is_manager())
    or (
      expires_at > now()
      and exists (
        select 1 from public.profiles as profile
        where profile.id = (select auth.uid()) and profile.role = 'driver'
      )
    )
  );

create policy road_report_decisions_manager_write on public.road_report_decisions
  for all
  to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));
