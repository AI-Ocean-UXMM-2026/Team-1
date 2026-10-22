-- Drivers can keep taking jobs after ending the shift. Ending the shift is a
-- cash hand-in, not a lock: claim_delivery_job no longer refuses a closed day,
-- and starting a route again reopens today's session.

CREATE OR REPLACE FUNCTION public.claim_delivery_job(p_job_id uuid, p_vehicle_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  driver uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Yangon')::date;
  driver_availability text;
  job public.delivery_jobs%rowtype;
  vehicle public.vehicles%rowtype;
  new_route_id uuid;
  seq integer := 0;
  kg numeric := 0;
  kept integer := 0;
  member record;
begin
  if driver is null then
    raise exception 'Sign in as a driver to take a job' using errcode = '42501';
  end if;

  select availability into driver_availability
  from public.driver_profiles where user_id = driver for update;
  if not found then
    raise exception 'Only drivers can take jobs' using errcode = '42501';
  end if;
  if driver_availability = 'off_duty' then
    raise exception 'Go on duty before taking a job' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.delivery_jobs
    where claimed_by = driver and status in ('claimed', 'in_progress')
  ) then
    raise exception 'Finish your current job before taking another' using errcode = 'P0001';
  end if;


  select * into job from public.delivery_jobs where id = p_job_id for update;
  if not found then
    raise exception 'This job no longer exists' using errcode = 'P0002';
  end if;
  if job.status <> 'open' then
    raise exception 'Another driver already took this job' using errcode = 'P0001';
  end if;

  if p_vehicle_id is not null then
    select * into vehicle from public.vehicles where id = p_vehicle_id for update;
    if not found or vehicle.status not in ('available', 'in_use') then
      raise exception 'Choose an available vehicle' using errcode = 'P0001';
    end if;
    if exists (
      select 1
      from public.delivery_assignments as assignment
      join public.delivery_orders as delivery_order on delivery_order.id = assignment.order_id
      where assignment.vehicle_id = p_vehicle_id
        and assignment.ended_at is null
        and assignment.driver_id <> driver
        and delivery_order.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
    ) then
      raise exception 'This vehicle is assigned to another driver' using errcode = 'P0001';
    end if;
    if vehicle.capacity_kg is not null and job.total_weight_kg > vehicle.capacity_kg then
      raise exception 'This job weighs % kg, more than the % kg this vehicle carries',
        job.total_weight_kg, vehicle.capacity_kg using errcode = 'P0001';
    end if;
  end if;

  insert into public.delivery_routes (created_by, driver_id, vehicle_id, status)
  values (driver, driver, p_vehicle_id, 'planned')
  returning id into new_route_id;

  -- Pickups first, then deliveries, west-to-east within a township cluster.
  for member in
    select queue.order_id, delivery_order.status as order_status
    from public.delivery_queue as queue
    join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
    where queue.job_id = job.id
    order by delivery_order.delivery_longitude nulls last, delivery_order.delivery_latitude nulls last
    for update of delivery_order
  loop
    if member.order_status <> 'pending' then
      delete from public.delivery_queue where order_id = member.order_id;
      continue;
    end if;
    kept := kept + 1;
  end loop;

  if kept = 0 then
    update public.delivery_jobs set status = 'cancelled' where id = job.id;
    delete from public.delivery_routes where id = new_route_id;
    return null;
  end if;

  for member in
    select queue.order_id, delivery_order.*
    from public.delivery_queue as queue
    join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
    where queue.job_id = job.id
    order by delivery_order.pickup_longitude nulls last, delivery_order.pickup_latitude nulls last
  loop
    seq := seq + 1;
    insert into public.route_stops (
      route_id, order_id, stop_type, sequence_number, address, latitude, longitude
    )
    values (new_route_id, member.order_id, 'pickup', seq, member.pickup_address,
      member.pickup_latitude, member.pickup_longitude);
  end loop;

  for member in
    select queue.order_id, delivery_order.*
    from public.delivery_queue as queue
    join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
    where queue.job_id = job.id
    order by delivery_order.delivery_longitude nulls last, delivery_order.delivery_latitude nulls last
  loop
    seq := seq + 1;
    insert into public.route_stops (
      route_id, order_id, stop_type, sequence_number, address, latitude, longitude
    )
    values (new_route_id, member.order_id, 'delivery', seq, member.delivery_address,
      member.delivery_latitude, member.delivery_longitude);

    kg := kg + coalesce(member.parcel_weight_kg, 0);
    insert into public.delivery_assignments (order_id, driver_id, vehicle_id, route_id, assigned_by)
    values (member.order_id, driver, p_vehicle_id, new_route_id, driver);
    update public.delivery_orders set status = 'assigned' where id = member.order_id;
  end loop;

  update public.delivery_jobs
  set status = 'claimed', claimed_by = driver, claimed_at = now(),
      vehicle_id = p_vehicle_id, route_id = new_route_id, order_count = kept
  where id = job.id;

  return job.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_driver_route_state(next_state text, reason text DEFAULT NULL::text, declared_cod numeric DEFAULT NULL::numeric)
 RETURNS driver_route_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  driver uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Yangon')::date;
  session public.driver_route_sessions%rowtype;
begin
  if driver is null or not exists (
    select 1 from public.driver_profiles where user_id = driver
  ) then
    raise exception 'Only a signed-in driver can change a route' using errcode = '42501';
  end if;

  select * into session
  from public.driver_route_sessions
  where driver_id = driver and route_date = today
  for update;

  if next_state = 'in_progress' then
    if not found then
      insert into public.driver_route_sessions (driver_id, route_date)
      values (driver, today)
      returning * into session;
      return session;
    end if;
    -- A driver who ended the shift can take on more work: starting again
    -- reopens today's session. Ending the shift only hands in cash.
    update public.driver_route_sessions
    set status = 'in_progress', paused_at = null, pause_reason = null,
      closed_at = null, cod_declared = null, updated_at = now()
    where id = session.id
    returning * into session;
    return session;
  end if;

  if not found then
    raise exception 'Start the route first' using errcode = 'P0001';
  end if;

  if next_state = 'paused' then
    if session.status <> 'in_progress' then
      raise exception 'Only a route in progress can be paused' using errcode = 'P0001';
    end if;
    update public.driver_route_sessions
    set status = 'paused', paused_at = now(),
      pause_reason = nullif(trim(coalesce(reason, '')), ''), updated_at = now()
    where id = session.id
    returning * into session;
    return session;
  end if;

  if next_state = 'closed' then
    if exists (
      select 1 from public.delivery_assignments as assignment
      join public.delivery_orders as delivery on delivery.id = assignment.order_id
      where assignment.driver_id = driver
        and assignment.ended_at is null
        and delivery.status in ('picked_up', 'in_transit')
    ) then
      raise exception 'Every loaded parcel needs an outcome before closing the route'
        using errcode = 'P0001';
    end if;
    if declared_cod is null or declared_cod < 0 then
      raise exception 'Enter the cash you are handing in' using errcode = '22023';
    end if;
    update public.driver_route_sessions
    set status = 'closed', closed_at = now(), cod_declared = declared_cod, updated_at = now()
    where id = session.id
    returning * into session;
    return session;
  end if;

  raise exception 'Unknown route state %', next_state using errcode = '22023';
end;
$function$;
