-- Automation Workflow for Auto Accepted Orders & Unclaimed Task Reproduction
--
-- If tasks/jobs are not taken by any driver, the automation calculation:
-- 1. Identifies and extracts those unclaimed tasks from stale/open jobs or
--    unaccepted driver assignments.
-- 2. Enriches the tasks with new data (escalates priority to 'high' or 'urgent',
--    increments reproduce_count, extends estimated delivery buffer, updates
--    geographic cluster center, stamps calculation metadata).
-- 3. Marks previous unclaimed jobs as 'superseded' to eliminate duplicates.
-- 4. Reproduces the tasks into fresh delivery_jobs on the board for drivers,
--    tagged with priority badges so available drivers can take them immediately.
-- 5. Enables auto-acceptance of pending orders into the delivery queue.

-- ------------------------------------------------------------- schema updates --

-- Allow 'superseded' status on delivery_jobs and update constraints
alter table public.delivery_jobs
  drop constraint if exists delivery_jobs_status_check;

alter table public.delivery_jobs
  add constraint delivery_jobs_status_check
  check (status in ('open', 'claimed', 'in_progress', 'completed', 'cancelled', 'superseded'));

alter table public.delivery_jobs
  drop constraint if exists delivery_jobs_claim_matches_status;

alter table public.delivery_jobs
  add constraint delivery_jobs_claim_matches_status
  check (
    (status = 'open' and claimed_by is null)
    or (status in ('claimed', 'in_progress', 'completed') and claimed_by is not null)
    or status in ('cancelled', 'superseded')
  );

-- Allow 'automation' and 'reproduce' triggers on job_batches
alter table public.job_batches
  drop constraint if exists job_batches_trigger_check;

alter table public.job_batches
  add constraint job_batches_trigger_check
  check (trigger in ('schedule', 'manual', 'automation', 'reproduce'));

-- Add reproduction tracking and priority columns to delivery_jobs
alter table public.delivery_jobs
  add column if not exists reproduce_count integer not null default 0 check (reproduce_count >= 0),
  add column if not exists priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists reproduced_from_job_id uuid references public.delivery_jobs (id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists delivery_jobs_priority_idx
  on public.delivery_jobs (priority, status) where status = 'open';

create index if not exists delivery_jobs_reproduce_idx
  on public.delivery_jobs (reproduce_count desc) where reproduce_count > 0;

-- Add reproduction and auto-accept columns to delivery_queue
alter table public.delivery_queue
  add column if not exists auto_accepted boolean not null default false,
  add column if not exists reproduce_count integer not null default 0 check (reproduce_count >= 0),
  add column if not exists last_calculated_at timestamptz;

-- Add priority and reproduction count to delivery_orders
alter table public.delivery_orders
  add column if not exists priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists reproduce_count integer not null default 0 check (reproduce_count >= 0);

-- Update order guard to preserve priority and reproduce_count for drivers
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

  -- Revert intelligence columns to OLD values for non-managers
  new.route_progress_percent := old.route_progress_percent;
  new.traffic_delay_minutes := old.traffic_delay_minutes;
  new.eta_confidence := old.eta_confidence;
  new.eta_updated_at := old.eta_updated_at;
  new.priority := old.priority;
  new.reproduce_count := old.reproduce_count;

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

-- ---------------------------------------------------- auto-accept functions --

/**
 * Automatically accepts pending orders into the delivery queue.
 * If p_order_ids is null or empty, all pending unqueued orders are accepted.
 * Marks queue entries with auto_accepted = true.
 */
create or replace function public.auto_accept_orders(p_order_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  accepted_count integer := 0;
begin
  if actor is not null and not (select private.is_manager()) then
    raise exception 'Only managers or system automation can auto-accept orders'
      using errcode = '42501';
  end if;

  if actor is null then
    select id into actor from public.profiles where role = 'manager' order by created_at limit 1;
  end if;

  if p_order_ids is not null and cardinality(p_order_ids) > 0 then
    with inserted as (
      insert into public.delivery_queue (order_id, queued_by, auto_accepted, last_calculated_at)
      select delivery_order.id, coalesce(actor, delivery_order.created_by), true, now()
      from public.delivery_orders as delivery_order
      where delivery_order.id = any (p_order_ids)
        and delivery_order.status = 'pending'
      on conflict (order_id) do nothing
      returning 1
    )
    select count(*) into accepted_count from inserted;
  else
    with inserted as (
      insert into public.delivery_queue (order_id, queued_by, auto_accepted, last_calculated_at)
      select delivery_order.id, coalesce(actor, delivery_order.created_by), true, now()
      from public.delivery_orders as delivery_order
      where delivery_order.status = 'pending'
        and not exists (
          select 1 from public.delivery_queue as queue
          where queue.order_id = delivery_order.id
        )
      on conflict (order_id) do nothing
      returning 1
    )
    select count(*) into accepted_count from inserted;
  end if;

  return accepted_count;
end;
$$;

-- ----------------------------------------- unclaimed task reproduction engine --

/**
 * If tasks are not taken by any driver and automation calculation runs:
 * 1. Extracts tasks from unclaimed open jobs (and stagnant assigned orders).
 * 2. Enriches the extracted tasks with new data (priority escalation, reproduce count,
 *    buffer window extensions, recalculation timestamps).
 * 3. Marks old unclaimed jobs as 'superseded'.
 * 4. Reproduces the tasks into fresh delivery_jobs on the board for drivers.
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
  v_job_id uuid;
  job_no integer := 0;
  jobs_made integer := 0;
  tasks_extracted integer := 0;
  jobs_superseded integer := 0;
  stagnant_unassigned integer := 0;
  current_key text;
  current_count integer := 0;
  current_kg numeric := 0;
  max_reproduce_in_job integer := 0;
  max_priority_in_job text := 'normal';
  row_record record;
  unclaimed_job record;
begin
  if actor is not null and not (select private.is_manager()) then
    raise exception 'Only managers or system automation can reproduce tasks'
      using errcode = '42501';
  end if;

  if actor is null then
    select id into actor from public.profiles where role = 'manager' order by created_at limit 1;
  end if;

  perform pg_advisory_xact_lock(hashtext('oern.job_batch'));

  -- STEP 1: Release any stagnant assignments where driver has not accepted or taken
  -- the task within 15 minutes, or where the driver has gone off duty.
  with stagnant_assignments as (
    select assignment.id as assignment_id, assignment.order_id, assignment.route_id
    from public.delivery_assignments as assignment
    join public.delivery_orders as delivery_order on delivery_order.id = assignment.order_id
    join public.driver_profiles as driver on driver.user_id = assignment.driver_id
    where assignment.ended_at is null
      and delivery_order.status = 'assigned'
      and (
        assignment.assigned_at < now() - interval '15 minutes'
        or driver.availability = 'off_duty'
      )
  ),
  closed_assignments as (
    update public.delivery_assignments as a
    set ended_at = now()
    from stagnant_assignments as sa
    where a.id = sa.assignment_id
    returning sa.order_id, sa.route_id
  ),
  reverted_orders as (
    update public.delivery_orders as o
    set status = 'pending',
        priority = 'high',
        reproduce_count = o.reproduce_count + 1,
        estimated_delivery_at = greatest(coalesce(o.estimated_delivery_at, now()), now()) + interval '90 minutes',
        notes = coalesce(o.notes || ' · ', '') || 'Re-queued: driver unaccepted timeout'
    from closed_assignments as ca
    where o.id = ca.order_id
    returning o.id
  ),
  queued_stagnant as (
    insert into public.delivery_queue (order_id, queued_by, auto_accepted, reproduce_count, last_calculated_at)
    select ro.id, coalesce(actor, (select created_by from public.delivery_orders where id = ro.id)), true, 1, now()
    from reverted_orders as ro
    on conflict (order_id) do update
    set job_id = null,
        reproduce_count = public.delivery_queue.reproduce_count + 1,
        last_calculated_at = now()
    returning 1
  )
  select count(*) into stagnant_unassigned from queued_stagnant;

  -- Clean up empty planned routes from stagnant assignments
  delete from public.delivery_routes
  where status = 'planned'
    and id not in (select route_id from public.delivery_assignments where ended_at is null and route_id is not null)
    and id not in (select route_id from public.delivery_jobs where route_id is not null);

  -- STEP 2: Find all open jobs not taken by any driver (claimed_by is null)
  for unclaimed_job in
    select job.id, job.label, job.reproduce_count
    from public.delivery_jobs as job
    where job.status = 'open'
      and job.claimed_by is null
      and (p_max_age_interval is null or job.created_at <= now() - p_max_age_interval)
    order by job.created_at asc
    for update
  loop
    -- Extract tasks: unlink from this job in delivery_queue
    with extracted as (
      update public.delivery_queue
      set job_id = null,
          reproduce_count = reproduce_count + 1,
          last_calculated_at = now()
      where delivery_queue.job_id = unclaimed_job.id
      returning order_id, reproduce_count
    ),
    enriched_orders as (
      update public.delivery_orders as ord
      set reproduce_count = ord.reproduce_count + 1,
          priority = case when ord.reproduce_count + 1 >= 2 then 'urgent' else 'high' end,
          estimated_delivery_at = greatest(coalesce(ord.estimated_delivery_at, now()), now()) + interval '90 minutes',
          notes = coalesce(ord.notes || ' · ', '') || 'Auto-reproduced: unclaimed task retry'
      from extracted as ext
      where ord.id = ext.order_id
      returning ord.id
    )
    select count(*) + tasks_extracted into tasks_extracted from extracted;

    -- Mark previous unclaimed job as superseded so it leaves the board cleanly
    update public.delivery_jobs
    set status = 'superseded',
        metadata = jsonb_set(
          metadata,
          '{superseded_at}',
          to_jsonb(now())
        )
    where id = unclaimed_job.id;

    jobs_superseded := jobs_superseded + 1;
  end loop;

  -- Drop any queue rows whose order is no longer pending
  delete from public.delivery_queue as queue
  using public.delivery_orders as delivery_order
  where queue.order_id = delivery_order.id
    and queue.job_id is null
    and delivery_order.status <> 'pending';

  -- If there are no waiting extracted or queued orders, return early
  if not exists (select 1 from public.delivery_queue where job_id is null) then
    return jsonb_build_object(
      'reproduced_jobs', 0,
      'extracted_tasks', tasks_extracted,
      'stagnant_unassigned', stagnant_unassigned,
      'superseded_jobs', jobs_superseded,
      'batch_id', null,
      'message', 'No tasks waiting for reproduction.'
    );
  end if;

  -- STEP 3: Automation calculation - Reproduce tasks into fresh delivery_jobs on the board
  insert into public.job_batches (trigger, created_by)
  values ('reproduce', actor)
  returning id into v_batch_id;

  for row_record in
    select
      queue.order_id,
      queue.reproduce_count as queue_reproduce,
      delivery_order.priority as order_priority,
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
    order by
      case delivery_order.priority when 'urgent' then 1 when 'high' then 2 else 3 end,
      cluster_key,
      delivery_order.delivery_latitude,
      delivery_order.delivery_longitude,
      queue.queued_at
  loop
    if v_job_id is null
      or row_record.cluster_key is distinct from current_key
      or current_count >= p_max_orders
      or (current_count > 0 and current_kg + row_record.weight_kg > p_max_kg) then

      job_no := job_no + 1;
      current_key := row_record.cluster_key;
      current_count := 0;
      current_kg := 0;
      max_reproduce_in_job := row_record.queue_reproduce;
      max_priority_in_job := row_record.order_priority;

      insert into public.delivery_jobs (
        batch_id,
        label,
        area_label,
        order_count,
        status,
        reproduce_count,
        priority,
        metadata
      )
      values (
        v_batch_id,
        'Job ' || job_no,
        coalesce(row_record.area_name, case when row_record.cluster_key = 'unlocated' then 'Location to confirm' end),
        1,
        'open',
        max_reproduce_in_job,
        max_priority_in_job,
        jsonb_build_object(
          'reproduced_at', now(),
          'reproduce_reason', 'automation_calculation_unclaimed',
          'cycle', max_reproduce_in_job
        )
      )
      returning id into v_job_id;
      jobs_made := jobs_made + 1;
    else
      if row_record.queue_reproduce > max_reproduce_in_job then
        max_reproduce_in_job := row_record.queue_reproduce;
      end if;
      if row_record.order_priority = 'urgent' or (row_record.order_priority = 'high' and max_priority_in_job <> 'urgent') then
        max_priority_in_job := row_record.order_priority;
      end if;
    end if;

    update public.delivery_queue
    set job_id = v_job_id
    where order_id = row_record.order_id;

    update public.delivery_jobs as job
    set order_count = (select count(*) from public.delivery_queue where delivery_queue.job_id = job.id),
        total_weight_kg = job.total_weight_kg + row_record.weight_kg,
        cod_total = job.cod_total + row_record.cod_amount,
        reproduce_count = greatest(job.reproduce_count, max_reproduce_in_job),
        priority = case
          when job.priority = 'urgent' or max_priority_in_job = 'urgent' then 'urgent'
          when job.priority = 'high' or max_priority_in_job = 'high' then 'high'
          else 'normal'
        end,
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
  end loop;

  -- Polish job labels: show time, priority tag, and reproduction indicator
  update public.delivery_jobs as job
  set label = case
    when job.priority = 'urgent' then
      '⚡ Urgent · ' || to_char(created_at at time zone 'Asia/Yangon', 'DD Mon HH24:MI') || ' · ' || job.label
    when job.priority = 'high' or job.reproduce_count > 0 then
      '⚡ Priority (R' || job.reproduce_count || ') · ' || to_char(created_at at time zone 'Asia/Yangon', 'DD Mon HH24:MI') || ' · ' || job.label
    else
      to_char(created_at at time zone 'Asia/Yangon', 'DD Mon HH24:MI') || ' · ' || job.label
    end
  where job.batch_id = v_batch_id;

  update public.job_batches
  set job_count = jobs_made,
      order_count = (select count(*) from public.delivery_queue where job_id in (
        select id from public.delivery_jobs where batch_id = v_batch_id
      ))
  where id = v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'reproduced_jobs', jobs_made,
    'extracted_tasks', tasks_extracted,
    'stagnant_unassigned', stagnant_unassigned,
    'superseded_jobs', jobs_superseded,
    'message', format('Extracted %s tasks, superseded %s jobs, and reproduced %s jobs on the board.',
      tasks_extracted, jobs_superseded, jobs_made)
  );
end;
$$;

-- --------------------------------- composite auto-accept & reproduce workflow --

/**
 * End-to-end automated workflow:
 * 1. Auto-accepts all pending unqueued orders into the delivery queue.
 * 2. Checks for tasks not taken by any driver, extracts them, enriches them with new data,
 *    and reproduces them onto the board for drivers.
 * 3. Batches any remaining unbatched orders.
 */
create or replace function public.run_auto_accept_and_reproduce_workflow()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  auto_accepted integer := 0;
  reproduce_result jsonb;
  remaining_waiting integer := 0;
  additional_batch uuid;
  additional_job_count integer := 0;
begin
  if actor is not null and not (select private.is_manager()) then
    raise exception 'Only managers or system automation can run the workflow'
      using errcode = '42501';
  end if;

  -- 1. Auto-accept pending orders
  select public.auto_accept_orders(null) into auto_accepted;

  -- 2. Extract unclaimed tasks, enrich with new data, reproduce onto board
  select public.reproduce_unclaimed_tasks(interval '0 seconds') into reproduce_result;

  -- 3. If any newly auto-accepted orders remain unbatched, batch them now
  select count(*) into remaining_waiting
  from public.delivery_queue where job_id is null;

  if remaining_waiting > 0 then
    additional_batch := private.build_job_batch('automation', actor);
    select job_count into additional_job_count
    from public.job_batches where id = additional_batch;
  end if;

  return jsonb_build_object(
    'auto_accepted', auto_accepted,
    'extracted_tasks', coalesce((reproduce_result->>'extracted_tasks')::integer, 0),
    'superseded_jobs', coalesce((reproduce_result->>'superseded_jobs')::integer, 0),
    'reproduced_jobs', coalesce((reproduce_result->>'reproduced_jobs')::integer, 0),
    'additional_jobs', additional_job_count,
    'total_jobs_posted', coalesce((reproduce_result->>'reproduced_jobs')::integer, 0) + additional_job_count,
    'message', format('Auto-accepted %s orders, reproduced %s jobs, and posted %s total jobs to the board.',
      auto_accepted, coalesce((reproduce_result->>'reproduced_jobs')::integer, 0),
      coalesce((reproduce_result->>'reproduced_jobs')::integer, 0) + additional_job_count)
  );
end;
$$;

-- --------------------------------------------------------------- permissions --

revoke all on function public.auto_accept_orders(uuid[]) from public, anon;
revoke all on function public.reproduce_unclaimed_tasks(interval, integer, numeric) from public, anon;
revoke all on function public.run_auto_accept_and_reproduce_workflow() from public, anon;

grant execute on function public.auto_accept_orders(uuid[]) to authenticated;
grant execute on function public.reproduce_unclaimed_tasks(interval, integer, numeric) to authenticated;
grant execute on function public.run_auto_accept_and_reproduce_workflow() to authenticated;
