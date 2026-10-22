-- Jobs are created from orders automatically.
--
-- Every new pending order is queued the moment it is inserted and slotted into
-- the job board by delivery proximity, with no manager step:
--   * it joins the nearest open job when it is within LINK_KM of one of that
--     job's orders and within SPAN_KM of its centre, and the job still has room
--     (parcel count and weight caps);
--   * otherwise it opens a new job of its own, which later orders then grow.
-- Orders without coordinates fall back to their township centroid, then join an
-- open job that already delivers to the same named area.
-- Claimed and in-progress jobs are never touched. The full re-cluster
-- (build_job_batch) is unchanged and still tidies the open board on demand.

-- Recomputes a job's totals from the orders currently queued in it.
create or replace function private.refresh_job_totals(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.delivery_jobs as job
  set order_count = totals.orders,
      total_weight_kg = totals.kg,
      cod_total = totals.cod,
      center_latitude = totals.lat,
      center_longitude = totals.lng,
      reproduce_count = totals.reproduce,
      priority = case totals.rank
        when 1 then 'urgent' when 2 then 'high' when 4 then 'low' else 'normal' end,
      metadata = job.metadata || jsonb_build_object('updated_by_automation_at', now())
  from (
    select
      count(*)::integer as orders,
      sum(coalesce(logistics.weight_kg, delivery_order.parcel_weight_kg, 2)) as kg,
      sum(coalesce(delivery_order.cod_amount, 0)) as cod,
      round(avg(coalesce(delivery_order.delivery_latitude, area.centroid_lat)), 6) as lat,
      round(avg(coalesce(delivery_order.delivery_longitude, area.centroid_lng)), 6) as lng,
      max(greatest(queue.reproduce_count, delivery_order.reproduce_count)) as reproduce,
      min(case delivery_order.priority
        when 'urgent' then 1 when 'high' then 2 when 'low' then 4 else 3 end) as rank
    from public.delivery_queue as queue
    join public.delivery_orders as delivery_order on delivery_order.id = queue.order_id
    left join public.delivery_order_logistics as logistics on logistics.order_id = queue.order_id
    left join public.service_areas as area on area.pcode = logistics.delivery_township_pcode
    where queue.job_id = p_job_id
  ) as totals
  where job.id = p_job_id and totals.orders > 0;
$$;

revoke all on function private.refresh_job_totals(uuid) from public, anon, authenticated;

-- Queues one pending order and places it in the nearest suitable open job.
create or replace function private.auto_place_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_km constant numeric := 2.5;
  span_km constant numeric := 6;
  max_orders constant integer := 8;
  max_kg constant numeric := 150;
  delivery_order public.delivery_orders;
  v_lat numeric;
  v_lng numeric;
  v_area_key text;
  v_weight numeric;
  v_job_id uuid;
  v_batch_id uuid;
begin
  select * into delivery_order from public.delivery_orders where id = p_order_id;
  if not found or delivery_order.status <> 'pending' then
    return null;
  end if;

  -- Serialises with build_job_batch and other placements.
  perform pg_advisory_xact_lock(hashtext('oern.job_batch'));

  insert into public.delivery_queue (order_id, queued_by, auto_accepted, last_calculated_at)
  values (p_order_id, delivery_order.created_by, true, now())
  on conflict (order_id) do nothing;

  if exists (
    select 1 from public.delivery_queue where order_id = p_order_id and job_id is not null
  ) then
    return null;
  end if;

  select
    coalesce(delivery_order.delivery_latitude, area.centroid_lat),
    coalesce(delivery_order.delivery_longitude, area.centroid_lng),
    lower(coalesce(
      area.name_en,
      nullif(btrim(regexp_replace(delivery_order.delivery_address, '^.*,', '')), ''),
      'unlocated')),
    coalesce(logistics.weight_kg, delivery_order.parcel_weight_kg, 2)
  into v_lat, v_lng, v_area_key, v_weight
  from (select 1) as one
  left join public.delivery_order_logistics as logistics on logistics.order_id = p_order_id
  left join public.service_areas as area on area.pcode = logistics.delivery_township_pcode;

  with members as (
    select
      queue.job_id,
      coalesce(member_order.delivery_latitude, member_area.centroid_lat) as lat,
      coalesce(member_order.delivery_longitude, member_area.centroid_lng) as lng,
      lower(coalesce(
        member_area.name_en,
        nullif(btrim(regexp_replace(member_order.delivery_address, '^.*,', '')), ''),
        'unlocated')) as area_key
    from public.delivery_queue as queue
    join public.delivery_jobs as open_job on open_job.id = queue.job_id and open_job.status = 'open'
    join public.delivery_orders as member_order on member_order.id = queue.order_id
    left join public.delivery_order_logistics as member_logistics
      on member_logistics.order_id = queue.order_id
    left join public.service_areas as member_area
      on member_area.pcode = member_logistics.delivery_township_pcode
  )
  select job.id into v_job_id
  from public.delivery_jobs as job
  where job.status = 'open'
    and job.order_count < max_orders
    and job.total_weight_kg + v_weight <= max_kg
    and case
      when v_lat is not null then
        job.center_latitude is not null
        and private.haversine_km(job.center_latitude, job.center_longitude, v_lat, v_lng) <= span_km
        and exists (
          select 1 from members
          where members.job_id = job.id
            and members.lat is not null
            and private.haversine_km(members.lat, members.lng, v_lat, v_lng) <= link_km)
      else exists (
        select 1 from members
        where members.job_id = job.id and members.lat is null and members.area_key = v_area_key)
    end
  order by
    case when v_lat is not null
      then private.haversine_km(job.center_latitude, job.center_longitude, v_lat, v_lng)
      else 0 end,
    job.created_at
  limit 1;

  if v_job_id is null then
    insert into public.job_batches (trigger, created_by, job_count, order_count)
    values ('automation', delivery_order.created_by, 1, 1)
    returning id into v_batch_id;

    insert into public.delivery_jobs (batch_id, label, order_count)
    values (v_batch_id,
      to_char(now() at time zone 'Asia/Yangon', 'DD Mon HH24:MI') || ' · Job ' ||
        (select count(*) + 1 from public.delivery_jobs where status = 'open'),
      1)
    returning id into v_job_id;
  else
    select batch_id into v_batch_id from public.delivery_jobs where id = v_job_id;
  end if;

  update public.delivery_queue
  set job_id = v_job_id, last_calculated_at = now()
  where order_id = p_order_id;

  perform private.refresh_job_totals(v_job_id);
  perform private.refresh_job_area_labels(v_batch_id);

  return v_job_id;
end;
$$;

revoke all on function private.auto_place_order(uuid) from public, anon, authenticated;

-- Order creation must never fail because of job automation.
create or replace function private.auto_place_order_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.auto_place_order(new.id);
  exception when others then
    raise warning 'automatic job placement failed for %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function private.auto_place_order_trigger() from public, anon, authenticated;

-- Named to sort after seed_order_logistics_after_insert so the delivery township
-- is already known when the order is placed.
create trigger zz_auto_place_order_after_insert
  after insert on public.delivery_orders
  for each row when (new.status = 'pending')
  execute function private.auto_place_order_trigger();

-- Orders that were already waiting get placed too.
select private.auto_place_order(delivery_order.id)
from public.delivery_orders as delivery_order
where delivery_order.status = 'pending'
  and not exists (
    select 1 from public.delivery_queue as queue
    where queue.order_id = delivery_order.id and queue.job_id is not null);
