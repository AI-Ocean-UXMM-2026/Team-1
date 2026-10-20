-- Device 1 delivery intelligence: explainable assignment recommendations,
-- route-progress ETA predictions, and moderated rider road knowledge.

alter table public.delivery_orders
  add column route_progress_percent numeric(5, 2),
  add column traffic_delay_minutes integer not null default 0,
  add column eta_confidence text,
  add column eta_updated_at timestamptz,
  add constraint delivery_orders_route_progress_range
    check (route_progress_percent is null or route_progress_percent between 0 and 100),
  add constraint delivery_orders_traffic_delay_nonnegative
    check (traffic_delay_minutes between 0 and 180),
  add constraint delivery_orders_eta_confidence_valid
    check (eta_confidence is null or eta_confidence in ('low', 'medium', 'high'));

create table public.road_reports (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles (user_id) on delete cascade,
  order_id uuid references public.delivery_orders (id) on delete set null,
  category text not null
    check (category in ('congestion', 'closure', 'roadwork', 'flooding', 'hazard')),
  severity text not null
    check (severity in ('low', 'medium', 'high', 'blocked')),
  description text not null
    check (char_length(trim(description)) between 3 and 240),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  reported_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours'),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint road_reports_expiry_after_report check (expires_at > reported_at),
  constraint road_reports_review_state check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('verified', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create index road_reports_driver_reported_idx
  on public.road_reports (driver_id, reported_at desc);
create index road_reports_order_active_idx
  on public.road_reports (order_id, status, expires_at)
  where order_id is not null;
create index road_reports_verified_active_idx
  on public.road_reports (expires_at, severity)
  where status = 'verified';

alter table public.road_reports enable row level security;

create policy road_reports_read_access on public.road_reports
  for select
  to authenticated
  using (
    (select private.is_manager())
    or driver_id = (select auth.uid())
    or (
      status = 'verified'
      and expires_at > now()
      and exists (
        select 1 from public.profiles as profile
        where profile.id = (select auth.uid()) and profile.role = 'driver'
      )
    )
  );

create policy road_reports_driver_insert on public.road_reports
  for insert
  to authenticated
  with check (
    driver_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.role = 'driver'
    )
    and (order_id is null or (select private.is_assigned_driver(order_id)))
  );

create policy road_reports_manager_update on public.road_reports
  for update
  to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

revoke all on public.road_reports from public, anon;
grant select, insert, update on public.road_reports to authenticated;

create or replace function private.haversine_km(
  latitude_a numeric,
  longitude_a numeric,
  latitude_b numeric,
  longitude_b numeric
)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select 6371 * 2 * asin(
    sqrt(
      power(sin(radians((latitude_b - latitude_a)::double precision) / 2), 2)
      + cos(radians(latitude_a::double precision))
      * cos(radians(latitude_b::double precision))
      * power(sin(radians((longitude_b - longitude_a)::double precision) / 2), 2)
    )
  );
$$;

create or replace function private.refresh_delivery_prediction(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.delivery_orders%rowtype;
  latest_point public.delivery_locations%rowtype;
  assigned_vehicle_type text;
  origin_latitude numeric;
  origin_longitude numeric;
  total_distance_km numeric;
  remaining_distance_km numeric;
  average_speed_kmh numeric;
  delay_minutes integer;
  progress_percent numeric;
  prediction_confidence text;
  predicted_at timestamptz := now();
begin
  select * into target_order
  from public.delivery_orders
  where id = target_order_id;

  if not found then
    return;
  end if;

  if target_order.status in ('delivered', 'failed', 'cancelled') then
    update public.delivery_orders
    set route_progress_percent = case when status = 'delivered' then 100 else route_progress_percent end,
        eta_updated_at = predicted_at,
        eta_confidence = case when status = 'delivered' then 'high' else eta_confidence end
    where id = target_order_id;
    return;
  end if;

  select location.* into latest_point
  from public.delivery_locations as location
  where location.order_id = target_order_id
  order by location.recorded_at desc, location.id desc
  limit 1;

  select vehicle.vehicle_type into assigned_vehicle_type
  from public.delivery_assignments as assignment
  left join public.vehicles as vehicle on vehicle.id = assignment.vehicle_id
  where assignment.order_id = target_order_id
    and assignment.ended_at is null
  order by assignment.assigned_at desc
  limit 1;

  origin_latitude := coalesce(latest_point.latitude, target_order.pickup_latitude);
  origin_longitude := coalesce(latest_point.longitude, target_order.pickup_longitude);

  if origin_latitude is null or origin_longitude is null
    or target_order.delivery_latitude is null or target_order.delivery_longitude is null then
    update public.delivery_orders
    set eta_confidence = 'low',
        eta_updated_at = predicted_at
    where id = target_order_id;
    return;
  end if;

  remaining_distance_km := private.haversine_km(
    origin_latitude,
    origin_longitude,
    target_order.delivery_latitude,
    target_order.delivery_longitude
  );
  total_distance_km := case
    when target_order.pickup_latitude is not null and target_order.pickup_longitude is not null
      then private.haversine_km(
        target_order.pickup_latitude,
        target_order.pickup_longitude,
        target_order.delivery_latitude,
        target_order.delivery_longitude
      )
    else null
  end;
  average_speed_kmh := case assigned_vehicle_type
    when 'e_bike' then 18
    when 'motorcycle' then 24
    when 'car' then 20
    when 'truck' then 16
    else 18
  end;

  select least(
    45,
    coalesce(sum(case report.severity
      when 'low' then 3
      when 'medium' then 7
      when 'high' then 14
      when 'blocked' then 25
      else 0
    end), 0)
  )::integer into delay_minutes
  from public.road_reports as report
  where report.status = 'verified'
    and report.expires_at > predicted_at
    and (
      report.order_id = target_order_id
      or private.haversine_km(
        report.latitude,
        report.longitude,
        target_order.delivery_latitude,
        target_order.delivery_longitude
      ) <= 3
    );

  progress_percent := case
    when latest_point.id is null or total_distance_km is null or total_distance_km < 0.05 then null
    else greatest(0, least(99, round((1 - remaining_distance_km / total_distance_km) * 100, 2)))
  end;
  prediction_confidence := case
    when latest_point.id is not null and latest_point.recorded_at >= predicted_at - interval '10 minutes' then 'high'
    when latest_point.id is not null then 'medium'
    else 'low'
  end;

  update public.delivery_orders
  set estimated_delivery_at = predicted_at
      + make_interval(mins => greatest(3, ceil(remaining_distance_km / average_speed_kmh * 60)::integer + delay_minutes)),
      route_progress_percent = progress_percent,
      traffic_delay_minutes = delay_minutes,
      eta_confidence = prediction_confidence,
      eta_updated_at = predicted_at
  where id = target_order_id;
end;
$$;

create or replace function private.refresh_prediction_from_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_delivery_prediction(new.order_id);
  return new;
end;
$$;

create trigger refresh_prediction_after_location
  after insert on public.delivery_locations
  for each row execute function private.refresh_prediction_from_location();

create or replace function private.review_road_report()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status not in ('verified', 'rejected') then
      raise exception 'A reviewed road report must be verified or rejected';
    end if;
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger review_road_report
  before update on public.road_reports
  for each row execute function private.review_road_report();

create or replace function private.refresh_prediction_from_road_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_id is not null then
    perform private.refresh_delivery_prediction(new.order_id);
  end if;
  return new;
end;
$$;

create trigger refresh_prediction_after_road_report
  after insert or update of status, severity, expires_at on public.road_reports
  for each row execute function private.refresh_prediction_from_road_report();

create or replace function public.review_road_report(
  target_report_id uuid,
  decision text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reviewed_id uuid;
begin
  if not (select private.is_manager()) then
    raise exception 'Only a manager can review road reports' using errcode = '42501';
  end if;
  if decision not in ('verified', 'rejected') then
    raise exception 'Road report decision must be verified or rejected';
  end if;

  update public.road_reports
  set status = decision
  where id = target_report_id
    and status = 'pending'
  returning id into reviewed_id;

  if reviewed_id is null then
    raise exception 'Road report is missing or already reviewed';
  end if;
  return reviewed_id;
end;
$$;

revoke all on function private.haversine_km(numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function private.refresh_delivery_prediction(uuid) from public, anon, authenticated;
revoke all on function private.refresh_prediction_from_location() from public, anon, authenticated;
revoke all on function private.review_road_report() from public, anon, authenticated;
revoke all on function private.refresh_prediction_from_road_report() from public, anon, authenticated;
revoke all on function public.review_road_report(uuid, text) from public, anon;
grant execute on function public.review_road_report(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'road_reports'
    ) then
    alter publication supabase_realtime add table public.road_reports;
  end if;
end;
$$;

do $$
declare
  active_order_id uuid;
begin
  for active_order_id in
    select id from public.delivery_orders
    where status in ('assigned', 'accepted', 'picked_up', 'in_transit')
  loop
    perform private.refresh_delivery_prediction(active_order_id);
  end loop;
end;
$$;
