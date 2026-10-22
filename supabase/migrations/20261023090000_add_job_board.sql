-- Order queue, scheduled job batches and the driver job board.
--
-- Flow: a manager accepts pending orders into delivery_queue. Every 9 hours a
-- batch groups the queued orders into delivery_jobs (by delivery area, capped
-- by parcel count and weight). Drivers see open jobs on a board and claim one;
-- claiming creates the same delivery_routes / route_stops / delivery_assignments
-- rows a manager assignment creates, so tracking, COD and the rider route view
-- keep working unchanged. A job starts when its driver starts the route.
--
-- Drivers do not get read access to queue rows or orders before claiming. The
-- board shows only the aggregates stored on delivery_jobs.

-- ------------------------------------------------------------------- tables --

create table public.job_batches (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('schedule', 'manual')),
  created_by uuid references public.profiles (id),
  job_count integer not null default 0 check (job_count >= 0),
  order_count integer not null default 0 check (order_count >= 0),
  created_at timestamptz not null default now()
);

create index job_batches_schedule_idx
  on public.job_batches (created_at desc) where trigger = 'schedule';

create table public.delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.job_batches (id) on delete cascade,
  label text not null,
  status text not null default 'open'
    check (status in ('open', 'claimed', 'in_progress', 'completed', 'cancelled')),
  area_label text,
  order_count integer not null check (order_count > 0),
  total_weight_kg numeric(9, 2) not null default 0 check (total_weight_kg >= 0),
  cod_total numeric(12, 2) not null default 0 check (cod_total >= 0),
  center_latitude numeric(9, 6),
  center_longitude numeric(9, 6),
  claimed_by uuid references public.driver_profiles (user_id),
  claimed_at timestamptz,
  vehicle_id uuid references public.vehicles (id),
  route_id uuid references public.delivery_routes (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint delivery_jobs_claim_matches_status check (
    (status = 'open' and claimed_by is null)
    or (status in ('claimed', 'in_progress', 'completed') and claimed_by is not null)
    or status = 'cancelled'
  )
);

create index delivery_jobs_status_idx on public.delivery_jobs (status, created_at desc);
create index delivery_jobs_driver_idx on public.delivery_jobs (claimed_by, status)
  where claimed_by is not null;
create index delivery_jobs_batch_idx on public.delivery_jobs (batch_id);
-- A driver holds at most one unfinished job; the claim function also checks.
create unique index delivery_jobs_one_active_per_driver_idx
  on public.delivery_jobs (claimed_by) where status in ('claimed', 'in_progress');

create table public.delivery_queue (
  order_id uuid primary key references public.delivery_orders (id) on delete cascade,
  queued_by uuid not null references public.profiles (id),
  queued_at timestamptz not null default now(),
  job_id uuid references public.delivery_jobs (id) on delete set null
);

create index delivery_queue_waiting_idx on public.delivery_queue (queued_at) where job_id is null;
create index delivery_queue_job_idx on public.delivery_queue (job_id) where job_id is not null;

-- --------------------------------------------------------------- RLS/grants --

alter table public.job_batches enable row level security;
alter table public.delivery_jobs enable row level security;
alter table public.delivery_queue enable row level security;

revoke all on table public.job_batches, public.delivery_jobs, public.delivery_queue
  from public, anon;
grant select on table public.job_batches, public.delivery_jobs, public.delivery_queue
  to authenticated;

create policy job_batches_manager_read on public.job_batches
  for select to authenticated using ((select private.is_manager()));

create policy delivery_queue_manager_read on public.delivery_queue
  for select to authenticated using ((select private.is_manager()));

create policy delivery_jobs_manager_read on public.delivery_jobs
  for select to authenticated using ((select private.is_manager()));

create policy delivery_jobs_driver_read on public.delivery_jobs
  for select to authenticated
  using (
    exists (select 1 from public.driver_profiles as driver where driver.user_id = (select auth.uid()))
    and (status = 'open' or claimed_by = (select auth.uid()))
  );

do $$
begin
  alter publication supabase_realtime add table public.delivery_jobs;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.delivery_queue;
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------- queue management --

/**
 * Accepts pending orders into the queue. Orders that are not pending or are
 * already queued are skipped. Returns how many were accepted.
 */
create or replace function public.queue_orders(p_order_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  accepted integer;
begin
  if actor is null or not (select private.is_manager()) then
    raise exception 'Only managers can accept orders' using errcode = '42501';
  end if;
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    return 0;
  end if;

  with inserted as (
    insert into public.delivery_queue (order_id, queued_by)
    select delivery_order.id, actor
    from public.delivery_orders as delivery_order
    where delivery_order.id = any (p_order_ids)
      and delivery_order.status = 'pending'
    on conflict (order_id) do nothing
    returning 1
  )
  select count(*) into accepted from inserted;
  return accepted;
end;
$$;

/** Takes orders back out of the queue while they are still waiting for a batch. */
create or replace function public.unqueue_orders(p_order_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if (select auth.uid()) is null or not (select private.is_manager()) then
    raise exception 'Only managers can change the queue' using errcode = '42501';
  end if;
  with deleted as (
    delete from public.delivery_queue
    where order_id = any (p_order_ids) and job_id is null
    returning 1
  )
  select count(*) into removed from deleted;
  return removed;
end;
$$;

-- --------------------------------------------------------------- job batching --

/**
 * Groups waiting queue rows into open jobs. Orders are clustered by delivery
 * township (or a ~5 km grid cell when the township is unknown), then split so
 * a job never exceeds p_max_orders parcels or p_max_kg of declared weight. A
 * single parcel heavier than p_max_kg still gets its own job.
 * Queue rows whose order is no longer pending are dropped first.
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
  v_batch_id uuid;
  v_job_id uuid;
  job_no integer := 0;
  jobs_made integer := 0;
  orders_batched integer := 0;
  current_key text;
  current_count integer := 0;
  current_kg numeric := 0;
  row_record record;
begin
  perform pg_advisory_xact_lock(hashtext('oern.job_batch'));

  delete from public.delivery_queue as queue
  using public.delivery_orders as delivery_order
  where queue.order_id = delivery_order.id
    and queue.job_id is null
    and delivery_order.status <> 'pending';

  insert into public.job_batches (trigger, created_by)
  values (p_trigger, p_actor)
  returning id into v_batch_id;

  for row_record in
    select
      queue.order_id,
      coalesce(
        logistics.delivery_township_pcode,
        case when delivery_order.delivery_latitude is not null
          then 'g' || floor(delivery_order.delivery_latitude * 20)::int
            || ':' || floor(delivery_order.delivery_longitude * 20)::int
        end,
        'unlocated'
      ) as cluster_key,
      area.name_en as area_name,
      coalesce(logistics.weight_kg, delivery_order.parcel_weight_kg, 2) as weight_kg,
      delivery_order.cod_amount,
      delivery_order.delivery_latitude,
      delivery_order.delivery_longitude
    from public.delivery_queue as queue
    join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
    left join public.delivery_order_logistics as logistics on logistics.order_id = queue.order_id
    left join public.service_areas as area on area.pcode = logistics.delivery_township_pcode
    where queue.job_id is null and delivery_order.status = 'pending'
    order by 2, delivery_order.delivery_latitude, delivery_order.delivery_longitude, queue.queued_at
  loop
    if v_job_id is null
      or row_record.cluster_key is distinct from current_key
      or current_count >= p_max_orders
      or (current_count > 0 and current_kg + row_record.weight_kg > p_max_kg) then
      job_no := job_no + 1;
      current_key := row_record.cluster_key;
      current_count := 0;
      current_kg := 0;
      insert into public.delivery_jobs (batch_id, label, area_label, order_count)
      values (
        v_batch_id,
        'Job ' || job_no,
        coalesce(row_record.area_name, case when row_record.cluster_key = 'unlocated' then 'Location to confirm' end),
        1
      )
      returning id into v_job_id;
      jobs_made := jobs_made + 1;
    end if;

    update public.delivery_queue set job_id = v_job_id
    where order_id = row_record.order_id;

    update public.delivery_jobs as job
    set order_count = (select count(*) from public.delivery_queue where delivery_queue.job_id = job.id),
        total_weight_kg = job.total_weight_kg + row_record.weight_kg,
        cod_total = job.cod_total + row_record.cod_amount,
        center_latitude = (
          select avg(delivery_order.delivery_latitude)
          from public.delivery_queue as queue
          join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
          where queue.job_id = job.id
        ),
        center_longitude = (
          select avg(delivery_order.delivery_longitude)
          from public.delivery_queue as queue
          join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
          where queue.job_id = job.id
        )
    where job.id = v_job_id;

    current_count := current_count + 1;
    current_kg := current_kg + row_record.weight_kg;
    orders_batched := orders_batched + 1;
  end loop;

  -- Label jobs with the batch time so drivers can tell batches apart.
  update public.delivery_jobs
  set label = to_char(created_at at time zone 'Asia/Yangon', 'DD Mon HH24:MI') || ' · ' || label
  where delivery_jobs.batch_id = v_batch_id;

  update public.job_batches
  set job_count = jobs_made, order_count = orders_batched
  where id = v_batch_id;

  return v_batch_id;
end;
$$;

revoke all on function private.build_job_batch(text, uuid, integer, numeric)
  from public, anon, authenticated;

/** Manager button: batch what is waiting now. Does not reset the 9-hour schedule. */
create or replace function public.create_job_batch()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  new_batch uuid;
  result public.job_batches;
begin
  if actor is null or not (select private.is_manager()) then
    raise exception 'Only managers can create jobs' using errcode = '42501';
  end if;
  new_batch := private.build_job_batch('manual', actor);
  select * into result from public.job_batches where id = new_batch;
  return jsonb_build_object('batch_id', result.id, 'jobs', result.job_count, 'orders', result.order_count);
end;
$$;

/**
 * Called hourly by pg_cron. Runs a batch when the last scheduled one is at
 * least 9 hours old (5 minutes of slack so the hourly tick never skips a slot).
 * Empty batches are recorded too, which keeps the 9-hour rhythm steady.
 */
create or replace function private.run_scheduled_job_batch()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_run timestamptz;
begin
  select max(created_at) into last_run from public.job_batches where trigger = 'schedule';
  if last_run is not null and last_run > now() - interval '8 hours 55 minutes' then
    return null;
  end if;
  return private.build_job_batch('schedule', null);
end;
$$;

revoke all on function private.run_scheduled_job_batch() from public, anon, authenticated;

-- ------------------------------------------------------------ claiming a job --

/**
 * A driver takes an open job. Everything happens in one transaction: the job
 * row is locked so two drivers cannot take it, the driver must be free, and
 * each order gets an assignment plus pickup and delivery stops on one route.
 * Orders that stopped being pending since batching are dropped from the job.
 */
create or replace function public.claim_delivery_job(
  p_job_id uuid,
  p_vehicle_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
  if exists (
    select 1 from public.driver_route_sessions
    where driver_id = driver and route_date = today and status = 'closed'
  ) then
    raise exception 'You closed today''s route. Take the next job tomorrow' using errcode = 'P0001';
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
$$;

/**
 * Gives a claimed job back to the board before the route starts. Parcels return
 * to pending and the job reopens, so another driver can take it.
 */
create or replace function public.release_delivery_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  job public.delivery_jobs%rowtype;
begin
  if actor is null then
    raise exception 'Sign in to release a job' using errcode = '42501';
  end if;

  select * into job from public.delivery_jobs where id = p_job_id for update;
  if not found then
    raise exception 'This job no longer exists' using errcode = 'P0002';
  end if;
  if job.claimed_by is distinct from actor and not (select private.is_manager()) then
    raise exception 'Only the driver who took this job can release it' using errcode = '42501';
  end if;
  if job.status <> 'claimed' then
    raise exception 'A job can only be released before the route starts' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.delivery_queue as queue
    join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
    where queue.job_id = job.id and delivery_order.status not in ('assigned', 'accepted')
  ) then
    raise exception 'Parcels were already collected, so this job cannot be released'
      using errcode = 'P0001';
  end if;

  update public.delivery_assignments set ended_at = now()
  where route_id = job.route_id and ended_at is null;

  update public.delivery_orders set status = 'pending'
  where id in (select order_id from public.delivery_queue where job_id = job.id);

  delete from public.delivery_routes where id = job.route_id;

  update public.delivery_jobs
  set status = 'open', claimed_by = null, claimed_at = null, vehicle_id = null, route_id = null
  where id = job.id;
end;
$$;

revoke all on function public.queue_orders(uuid[]) from public, anon;
revoke all on function public.unqueue_orders(uuid[]) from public, anon;
revoke all on function public.create_job_batch() from public, anon;
revoke all on function public.claim_delivery_job(uuid, uuid) from public, anon;
revoke all on function public.release_delivery_job(uuid) from public, anon;
grant execute on function public.queue_orders(uuid[]) to authenticated;
grant execute on function public.unqueue_orders(uuid[]) to authenticated;
grant execute on function public.create_job_batch() to authenticated;
grant execute on function public.claim_delivery_job(uuid, uuid) to authenticated;
grant execute on function public.release_delivery_job(uuid) to authenticated;

-- ---------------------------------------------------- job lifecycle triggers --

-- The job starts when its driver starts the route session.
create or replace function private.start_job_with_route_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'in_progress' and (tg_op = 'INSERT' or old.status is distinct from 'in_progress') then
    update public.delivery_jobs
    set status = 'in_progress', started_at = coalesce(started_at, now())
    where claimed_by = new.driver_id and status = 'claimed';

    update public.delivery_routes
    set status = 'in_progress', started_at = coalesce(started_at, now())
    where driver_id = new.driver_id and status = 'planned'
      and id in (select route_id from public.delivery_jobs
        where claimed_by = new.driver_id and status = 'in_progress');
  end if;
  return null;
end;
$$;

revoke all on function private.start_job_with_route_session() from public, anon, authenticated;

create trigger start_job_with_route_session
  after insert or update of status on public.driver_route_sessions
  for each row execute function private.start_job_with_route_session();

-- The job completes once every parcel in it has an outcome.
create or replace function private.complete_job_when_parcels_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.delivery_jobs%rowtype;
begin
  select job.* into target
  from public.delivery_queue as queue
  join public.delivery_jobs as job on job.id = queue.job_id
  where queue.order_id = new.id and job.status in ('claimed', 'in_progress')
  for update of job;
  if not found then
    return null;
  end if;

  if not exists (
    select 1
    from public.delivery_queue as queue
    join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
    where queue.job_id = target.id
      and delivery_order.status not in ('delivered', 'failed', 'cancelled')
  ) then
    update public.delivery_jobs set status = 'completed', completed_at = now() where id = target.id;
    update public.delivery_routes set status = 'completed', completed_at = now()
    where id = target.route_id and status <> 'cancelled';
  end if;
  return null;
end;
$$;

revoke all on function private.complete_job_when_parcels_close() from public, anon, authenticated;

create trigger complete_job_when_parcels_close
  after update of status on public.delivery_orders
  for each row
  when (new.status in ('delivered', 'failed', 'cancelled'))
  execute function private.complete_job_when_parcels_close();

-- ------------------------------------------------------------------ schedule --

-- pg_cron is available on Supabase; skip quietly where it is not so that local
-- and test databases still migrate. The function itself enforces the 9 hours.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'oern-job-batch',
    '0 * * * *',
    'select private.run_scheduled_job_batch()'
  );
exception
  when others then
    raise notice 'pg_cron schedule not installed: %', sqlerrm;
end;
$$;
