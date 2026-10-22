-- Proximity clustering for the job board, and one-swipe job start.
--
-- Automation flow (every batch: confirm, manual, schedule, automation, reproduce):
--   1. Open jobs nobody has taken are unpacked: their orders go back to the
--      waiting queue and the old jobs are marked superseded.
--   2. Every waiting order is clustered by where it is delivered. A job grows
--      from a seed order by repeatedly taking the unbatched order closest to
--      its centre, as long as that order is within LINK_KM of some order
--      already in the job and within SPAN_KM of the seed. Caps on parcels and
--      weight still apply. Orders near each other end up in the same job even
--      when they were confirmed hours apart; far-away towns never mix.
--   3. Orders without coordinates fall back to their township centroid, and
--      then to the area named at the end of the delivery address.
--
-- Drivers start a job with start_delivery_job: it claims the job, orders the
-- delivery stops nearest-first from the driver's current position, loads the
-- parcels and starts the route session, so the app opens straight into turn
-- by turn navigation.

-- ------------------------------------------------------------- clustering --

/**
 * Re-clusters every unclaimed order (waiting in the queue or sitting in an
 * open job) into fresh open jobs by delivery proximity. Returns the batch id.
 */
create or replace function private.build_job_batch(
  p_trigger text,
  p_actor uuid,
  p_max_orders integer default 8,
  p_max_kg numeric default 150
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_km constant numeric := 2.5;
  span_km constant numeric := 6;
  v_batch_id uuid;
  v_job_id uuid;
  job_no integer := 0;
  seed record;
  next_order uuid;
  next_weight numeric;
  v_count integer;
  v_kg numeric;
  v_center_lat numeric;
  v_center_lng numeric;
begin
  perform pg_advisory_xact_lock(hashtext('oern.job_batch'));

  insert into public.job_batches (trigger, created_by)
  values (p_trigger, p_actor)
  returning id into v_batch_id;

  -- 1. Unpack open jobs back into the queue.
  update public.delivery_queue as queue
  set job_id = null, last_calculated_at = now()
  from public.delivery_jobs as job
  where queue.job_id = job.id and job.status = 'open';

  update public.delivery_jobs
  set status = 'superseded',
      metadata = metadata || jsonb_build_object(
        'superseded_at', now(), 'superseded_by_batch', v_batch_id)
  where status = 'open';

  delete from public.delivery_queue as queue
  using public.delivery_orders as delivery_order
  where queue.order_id = delivery_order.id
    and queue.job_id is null
    and delivery_order.status <> 'pending';

  -- 2. Pool of orders to cluster.
  if to_regclass('pg_temp.job_cluster_pool') is not null then
    drop table pg_temp.job_cluster_pool;
  end if;
  create temp table job_cluster_pool (
    order_id uuid primary key,
    lat numeric,
    lng numeric,
    area_key text,
    weight_kg numeric not null,
    cod numeric not null,
    priority_rank integer not null,
    reproduce integer not null,
    queued_at timestamptz not null,
    job_id uuid
  ) on commit drop;

  insert into pg_temp.job_cluster_pool
    (order_id, lat, lng, area_key, weight_kg, cod, priority_rank, reproduce, queued_at)
  select
    queue.order_id,
    coalesce(delivery_order.delivery_latitude, area.centroid_lat),
    coalesce(delivery_order.delivery_longitude, area.centroid_lng),
    lower(coalesce(
      area.name_en,
      nullif(btrim(regexp_replace(delivery_order.delivery_address, '^.*,', '')), ''),
      'unlocated'
    )),
    coalesce(logistics.weight_kg, delivery_order.parcel_weight_kg, 2),
    coalesce(delivery_order.cod_amount, 0),
    case delivery_order.priority
      when 'urgent' then 1 when 'high' then 2 when 'low' then 4 else 3 end,
    greatest(queue.reproduce_count, delivery_order.reproduce_count),
    queue.queued_at
  from public.delivery_queue as queue
  join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
  left join public.delivery_order_logistics as logistics on logistics.order_id = queue.order_id
  left join public.service_areas as area on area.pcode = logistics.delivery_township_pcode
  where queue.job_id is null and delivery_order.status = 'pending';

  -- 3. Grow one job at a time from the most urgent, longest-waiting order.
  loop
    select * into seed
    from pg_temp.job_cluster_pool
    where job_id is null
    order by priority_rank, queued_at, order_id
    limit 1;
    exit when not found;

    job_no := job_no + 1;
    insert into public.delivery_jobs (batch_id, label, order_count)
    values (v_batch_id, 'Job ' || job_no, 1)
    returning id into v_job_id;

    update pg_temp.job_cluster_pool set job_id = v_job_id where order_id = seed.order_id;
    v_count := 1;
    v_kg := seed.weight_kg;
    v_center_lat := seed.lat;
    v_center_lng := seed.lng;

    while v_count < p_max_orders loop
      if seed.lat is not null then
        select pool.order_id, pool.weight_kg into next_order, next_weight
        from pg_temp.job_cluster_pool as pool
        where pool.job_id is null
          and pool.lat is not null
          and v_kg + pool.weight_kg <= p_max_kg
          and private.haversine_km(seed.lat, seed.lng, pool.lat, pool.lng) <= span_km
          and exists (
            select 1 from pg_temp.job_cluster_pool as member
            where member.job_id = v_job_id
              and private.haversine_km(member.lat, member.lng, pool.lat, pool.lng) <= link_km
          )
        order by private.haversine_km(v_center_lat, v_center_lng, pool.lat, pool.lng),
          pool.priority_rank, pool.queued_at
        limit 1;
      else
        select pool.order_id, pool.weight_kg into next_order, next_weight
        from pg_temp.job_cluster_pool as pool
        where pool.job_id is null
          and pool.lat is null
          and pool.area_key = seed.area_key
          and v_kg + pool.weight_kg <= p_max_kg
        order by pool.priority_rank, pool.queued_at
        limit 1;
      end if;
      exit when not found;

      update pg_temp.job_cluster_pool set job_id = v_job_id where order_id = next_order;
      v_count := v_count + 1;
      v_kg := v_kg + next_weight;
      if seed.lat is not null then
        select avg(lat), avg(lng) into v_center_lat, v_center_lng
        from pg_temp.job_cluster_pool where job_id = v_job_id;
      end if;
    end loop;
  end loop;

  -- 4. Write the clusters back and total each job.
  update public.delivery_queue as queue
  set job_id = pool.job_id, last_calculated_at = now()
  from pg_temp.job_cluster_pool as pool
  where queue.order_id = pool.order_id;

  update public.delivery_jobs as job
  set order_count = totals.orders,
      total_weight_kg = totals.kg,
      cod_total = totals.cod,
      center_latitude = totals.lat,
      center_longitude = totals.lng,
      reproduce_count = totals.reproduce,
      priority = case totals.rank
        when 1 then 'urgent' when 2 then 'high' when 4 then 'low' else 'normal' end,
      metadata = job.metadata || jsonb_build_object(
        'clustered_at', now(),
        'spread_km', totals.spread_km,
        'trigger', p_trigger)
  from (
    select
      pool.job_id,
      count(*)::integer as orders,
      sum(pool.weight_kg) as kg,
      sum(pool.cod) as cod,
      round(avg(pool.lat), 6) as lat,
      round(avg(pool.lng), 6) as lng,
      max(pool.reproduce) as reproduce,
      min(pool.priority_rank) as rank,
      round(coalesce(max(private.haversine_km(centre.lat, centre.lng, pool.lat, pool.lng)), 0), 2)
        as spread_km
    from pg_temp.job_cluster_pool as pool
    join (
      select job_id, avg(lat) as lat, avg(lng) as lng
      from pg_temp.job_cluster_pool group by job_id
    ) as centre on centre.job_id = pool.job_id
    group by pool.job_id
  ) as totals
  where job.id = totals.job_id;

  perform private.refresh_job_area_labels(v_batch_id);

  update public.delivery_jobs
  set label = to_char(created_at at time zone 'Asia/Yangon', 'DD Mon HH24:MI') || ' · ' || label
  where batch_id = v_batch_id;

  update public.job_batches
  set job_count = job_no,
      order_count = (select count(*) from pg_temp.job_cluster_pool)
  where id = v_batch_id;

  drop table pg_temp.job_cluster_pool;
  return v_batch_id;
end;
$$;

revoke all on function private.build_job_batch(text, uuid, integer, numeric)
  from public, anon, authenticated;

-- ------------------------------------------------ unclaimed job escalation --

/**
 * Releases assignments a driver never acted on, escalates the priority of
 * orders that sat in an open job longer than p_max_age_interval, then
 * re-clusters everything unclaimed by proximity.
 */
create or replace function public.reproduce_unclaimed_tasks(
  p_max_age_interval interval default interval '0 seconds',
  p_max_orders integer default 8,
  p_max_kg numeric default 150
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  v_batch_id uuid;
  stagnant_unassigned integer := 0;
  tasks_extracted integer := 0;
  jobs_superseded integer := 0;
  jobs_made integer := 0;
begin
  if actor is not null and not (select private.is_manager()) then
    raise exception 'Only managers or system automation can reproduce tasks'
      using errcode = '42501';
  end if;
  if actor is null then
    select id into actor from public.profiles where role = 'manager' order by created_at limit 1;
  end if;

  perform pg_advisory_xact_lock(hashtext('oern.job_batch'));

  -- Assignments the driver did not accept within 15 minutes, or whose driver
  -- went off duty, go back to the queue.
  with stagnant as (
    select assignment.id, assignment.order_id
    from public.delivery_assignments as assignment
    join public.delivery_orders as delivery_order on delivery_order.id = assignment.order_id
    join public.driver_profiles as driver on driver.user_id = assignment.driver_id
    where assignment.ended_at is null
      and delivery_order.status = 'assigned'
      and (assignment.assigned_at < now() - interval '15 minutes'
        or driver.availability = 'off_duty')
  ),
  closed as (
    update public.delivery_assignments as assignment
    set ended_at = now()
    from stagnant
    where assignment.id = stagnant.id
    returning stagnant.order_id
  ),
  reverted as (
    update public.delivery_orders as delivery_order
    set status = 'pending',
        priority = 'high',
        reproduce_count = delivery_order.reproduce_count + 1,
        estimated_delivery_at = greatest(coalesce(delivery_order.estimated_delivery_at, now()), now())
          + interval '90 minutes',
        notes = coalesce(delivery_order.notes || ' · ', '') || 'Re-queued: driver did not accept'
    from closed
    where delivery_order.id = closed.order_id
    returning delivery_order.id, delivery_order.created_by
  ),
  queued as (
    insert into public.delivery_queue (order_id, queued_by, auto_accepted, reproduce_count, last_calculated_at)
    select reverted.id, coalesce(actor, reverted.created_by), true, 1, now()
    from reverted
    on conflict (order_id) do update
    set job_id = null,
        reproduce_count = public.delivery_queue.reproduce_count + 1,
        last_calculated_at = now()
    returning 1
  )
  select count(*) into stagnant_unassigned from queued;

  delete from public.delivery_routes
  where status = 'planned'
    and id not in (select route_id from public.delivery_assignments
      where ended_at is null and route_id is not null)
    and id not in (select route_id from public.delivery_jobs where route_id is not null);

  -- Orders nobody took in time get a higher priority.
  with stale as (
    select queue.order_id
    from public.delivery_queue as queue
    join public.delivery_jobs as job on job.id = queue.job_id
    where job.status = 'open'
      and job.created_at <= now() - coalesce(p_max_age_interval, interval '0 seconds')
  ),
  bumped_queue as (
    update public.delivery_queue as queue
    set reproduce_count = queue.reproduce_count + 1
    from stale
    where queue.order_id = stale.order_id
    returning queue.order_id
  ),
  bumped as (
    update public.delivery_orders as delivery_order
    set reproduce_count = delivery_order.reproduce_count + 1,
        priority = case when delivery_order.reproduce_count + 1 >= 2 then 'urgent' else 'high' end,
        estimated_delivery_at = greatest(coalesce(delivery_order.estimated_delivery_at, now()), now())
          + interval '90 minutes',
        notes = coalesce(delivery_order.notes || ' · ', '') || 'Auto-reproduced: unclaimed task retry'
    from bumped_queue
    where delivery_order.id = bumped_queue.order_id
    returning 1
  )
  select count(*) into tasks_extracted from bumped;

  if not exists (select 1 from public.delivery_jobs where status = 'open')
    and not exists (select 1 from public.delivery_queue where job_id is null) then
    return jsonb_build_object(
      'batch_id', null, 'reproduced_jobs', 0, 'extracted_tasks', 0,
      'stagnant_unassigned', stagnant_unassigned, 'superseded_jobs', 0,
      'message', 'No tasks waiting for reproduction.');
  end if;

  v_batch_id := private.build_job_batch('reproduce', actor, p_max_orders, p_max_kg);
  select job_count into jobs_made from public.job_batches where id = v_batch_id;
  select count(*) into jobs_superseded from public.delivery_jobs
  where metadata ->> 'superseded_by_batch' = v_batch_id::text;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'reproduced_jobs', jobs_made,
    'extracted_tasks', tasks_extracted,
    'stagnant_unassigned', stagnant_unassigned,
    'superseded_jobs', jobs_superseded,
    'message', format('Escalated %s orders, regrouped %s jobs into %s jobs by distance.',
      tasks_extracted, jobs_superseded, jobs_made));
end;
$$;

-- ------------------------------------------------------- automation workflow --

/**
 * Accepts every pending order, then re-clusters all unclaimed orders (new ones
 * and those in old open jobs) into jobs by delivery proximity.
 */
create or replace function public.run_auto_accept_and_reproduce_workflow()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  accepted integer := 0;
  v_batch_id uuid;
  batch_row public.job_batches;
  jobs_superseded integer := 0;
  orders_regrouped integer := 0;
begin
  if actor is not null and not (select private.is_manager()) then
    raise exception 'Only managers or system automation can run the workflow'
      using errcode = '42501';
  end if;

  accepted := public.auto_accept_orders(null);

  if not exists (select 1 from public.delivery_jobs where status = 'open')
    and not exists (select 1 from public.delivery_queue where job_id is null) then
    return jsonb_build_object(
      'auto_accepted', accepted, 'extracted_tasks', 0, 'superseded_jobs', 0,
      'reproduced_jobs', 0, 'additional_jobs', 0, 'total_jobs_posted', 0,
      'message', 'Nothing is waiting for a driver.');
  end if;

  v_batch_id := private.build_job_batch('automation', actor);
  select * into batch_row from public.job_batches where id = v_batch_id;
  select count(*), coalesce(sum(order_count), 0)
  into jobs_superseded, orders_regrouped
  from public.delivery_jobs
  where metadata ->> 'superseded_by_batch' = v_batch_id::text;

  return jsonb_build_object(
    'auto_accepted', accepted,
    'extracted_tasks', orders_regrouped,
    'superseded_jobs', jobs_superseded,
    'reproduced_jobs', 0,
    'additional_jobs', batch_row.job_count,
    'total_jobs_posted', batch_row.job_count,
    'message', format('Accepted %s orders. Grouped %s orders into %s jobs by distance.',
      accepted, batch_row.order_count, batch_row.job_count));
end;
$$;

-- -------------------------------------------------------------- starting a job --

/**
 * One swipe on the driver board: take the job, order its delivery stops
 * nearest-first from where the driver is now, load the parcels and start the
 * route. Returns the job id, or null when every parcel had gone elsewhere.
 */
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
  today date := (now() at time zone 'Asia/Yangon')::date;
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

  -- Pickups are handed over with the job; deliveries go nearest-first.
  update public.route_stops
  set sequence_number = sequence_number + 100000
  where route_id = v_route_id;

  for next_stop in
    select id from public.route_stops
    where route_id = v_route_id and stop_type = 'pickup'
    order by sequence_number
  loop
    seq := seq + 1;
    update public.route_stops
    set sequence_number = seq, status = 'completed', completed_at = now()
    where id = next_stop.id;
  end loop;

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

  -- Each step is its own update so the status history reads in order.
  update public.delivery_orders set status = 'accepted'
  where status = 'assigned'
    and id in (select order_id from public.delivery_queue where job_id = claimed);
  update public.delivery_orders set status = 'picked_up'
  where status = 'accepted'
    and id in (select order_id from public.delivery_queue where job_id = claimed);
  update public.delivery_orders set status = 'in_transit'
  where status = 'picked_up'
    and id in (select order_id from public.delivery_queue where job_id = claimed);

  insert into public.driver_route_sessions (driver_id, route_date)
  values (driver, today)
  on conflict (driver_id, route_date) do update
  set status = 'in_progress', paused_at = null, pause_reason = null, updated_at = now()
  where public.driver_route_sessions.status <> 'closed';

  update public.delivery_jobs
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = claimed and status = 'claimed';

  update public.delivery_routes
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where id = v_route_id and status = 'planned';

  return claimed;
end;
$$;

revoke all on function public.start_delivery_job(uuid, uuid, numeric, numeric) from public, anon;
grant execute on function public.start_delivery_job(uuid, uuid, numeric, numeric) to authenticated;
