-- Derive a job's area label from where its parcels go. Township names come
-- from service_areas when the order has a township code; otherwise the last
-- comma-separated part of the delivery address ("No. 77, Lay Daunt Kan Road,
-- Tamwe" gives "Tamwe"). A job spanning several areas reads "Tamwe +1".

create or replace function private.refresh_job_area_labels(p_batch_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with parts as (
    select
      queue.job_id,
      coalesce(
        area.name_en,
        nullif(btrim(regexp_replace(delivery_order.delivery_address, '^.*,', '')), '')
      ) as area_name
    from public.delivery_queue as queue
    join public.delivery_jobs as job on job.id = queue.job_id
    join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
    left join public.delivery_order_logistics as logistics on logistics.order_id = queue.order_id
    left join public.service_areas as area on area.pcode = logistics.delivery_township_pcode
    where job.batch_id = p_batch_id
  ),
  counted as (
    select job_id, area_name, count(*) as n
    from parts
    where area_name is not null
    group by job_id, area_name
  ),
  labelled as (
    select
      job_id,
      (array_agg(area_name order by n desc, area_name))[1] as top_area,
      count(*) as areas
    from counted
    group by job_id
  )
  update public.delivery_jobs as job
  set area_label = labelled.top_area
    || case when labelled.areas > 1 then ' +' || (labelled.areas - 1) else '' end
  from labelled
  where job.id = labelled.job_id;
$$;

revoke all on function private.refresh_job_area_labels(uuid) from public, anon, authenticated;

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
      coalesce(
        area.name_en,
        nullif(btrim(regexp_replace(delivery_order.delivery_address, '^.*,', '')), '')
      ) as area_name,
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
        null,
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

  perform private.refresh_job_area_labels(v_batch_id);

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

-- Label the jobs that already exist.
select private.refresh_job_area_labels(id) from public.job_batches;
