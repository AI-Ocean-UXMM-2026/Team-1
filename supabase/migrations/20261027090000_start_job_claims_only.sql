-- Taking a job from the board claims it and orders its stops nearest-first from
-- the driver's position. It no longer does the route's own steps: parcels stay
-- where they are until the driver acknowledges, loads and starts the route, and
-- the route session is opened only by set_driver_route_state. Pickups are no
-- longer marked completed or moved along without the pickup checks, and a closed
-- day is no longer reopened as a side effect of taking a job.

create or replace function public.start_delivery_job(
  p_job_id uuid,
  p_vehicle_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  driver uuid := (select auth.uid());
  job_status text;
  claimed uuid;
  v_route_id uuid;
  seq integer := 0;
  cur_lat numeric := p_latitude;
  cur_lng numeric := p_longitude;
  next_stop record;
begin
  if driver is null then
    raise exception 'Sign in as a driver to take a job' using errcode = '42501';
  end if;

  select status into job_status from public.delivery_jobs where id = p_job_id;
  if job_status = 'superseded' then
    raise exception 'Dispatch regrouped this job with nearby orders. Pick it again from the board.'
      using errcode = 'P0001';
  end if;

  claimed := public.claim_delivery_job(p_job_id, p_vehicle_id);
  if claimed is null then
    return null;
  end if;

  select route_id into v_route_id from public.delivery_jobs where id = claimed;

  -- Park every stop past the pickups, then number the pickups in order again.
  update public.route_stops
  set sequence_number = sequence_number + 100000
  where route_id = v_route_id;

  for next_stop in
    select id from public.route_stops
    where route_id = v_route_id and stop_type = 'pickup'
    order by sequence_number
  loop
    seq := seq + 1;
    update public.route_stops set sequence_number = seq where id = next_stop.id;
  end loop;

  -- Deliveries follow, nearest-first from where the driver is now.
  loop
    select id, latitude, longitude into next_stop
    from public.route_stops
    where route_id = v_route_id and stop_type = 'delivery' and sequence_number > 100000
    order by
      (latitude is null),
      case when cur_lat is null or latitude is null then 0
        else private.haversine_km(cur_lat, cur_lng, latitude, longitude) end,
      sequence_number
    limit 1;
    exit when not found;
    seq := seq + 1;
    update public.route_stops set sequence_number = seq where id = next_stop.id;
    if next_stop.latitude is not null then
      cur_lat := next_stop.latitude;
      cur_lng := next_stop.longitude;
    end if;
  end loop;

  return claimed;
end;
$$;

revoke all on function public.start_delivery_job(uuid, uuid, numeric, numeric) from public, anon;
grant execute on function public.start_delivery_job(uuid, uuid, numeric, numeric) to authenticated;
