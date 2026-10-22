-- Door pickups on a committed truck route.
--
-- A plan route (delivery_routes.dispatch_run_id set) can hold a `pickup` stop
-- before the matching `delivery` stop: the truck collects the parcel at the
-- customer's address. complete_pickup records that: it moves the order to
-- picked_up (customer tracking begins), completes the stop and optionally
-- records the weighed weight. It is SECURITY DEFINER because drivers may not
-- write parcel weight, logistics rows or other stops directly, so it checks
-- the caller itself. It is idempotent on client_request_id.
--
-- set_driver_route_state is replaced so a route cannot be closed while a
-- pickup is still pending.

create table public.pickup_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders (id) on delete cascade,
  driver_id uuid not null references public.driver_profiles (user_id),
  request_id uuid not null unique,
  outcome text not null check (outcome in ('collected', 'failed')),
  parcel_checked boolean not null default false,
  weighed_kg numeric(9, 2) check (weighed_kg > 0),
  declared_kg numeric(9, 2) check (declared_kg > 0),
  weight_variance_pct numeric(8, 1),
  failure_reason text check (failure_reason in (
    'customer_unavailable', 'parcel_not_ready', 'wrong_parcel', 'refused', 'oversize', 'other'
  )),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint pickup_reports_failed_has_reason
    check (outcome <> 'failed' or failure_reason is not null),
  constraint pickup_reports_collected_was_checked
    check (outcome <> 'collected' or parcel_checked)
);

create index pickup_reports_order_idx on public.pickup_reports (order_id, created_at desc);
create index pickup_reports_driver_idx on public.pickup_reports (driver_id, created_at desc);

alter table public.pickup_reports enable row level security;
revoke all on table public.pickup_reports from public, anon;
grant select on table public.pickup_reports to authenticated;

create policy pickup_reports_read_access on public.pickup_reports
  for select to authenticated
  using (
    driver_id = (select auth.uid())
    or (select private.is_manager())
    or (select private.is_support())
  );

/**
 * Records the outcome of a door pickup. Returns jsonb:
 * { order_id, status, duplicate, weight_kg, variance_pct, warnings[] }.
 * A warning is not an error: an overweight truck is reported, not blocked,
 * because the parcel is already in the driver's hands.
 */
create or replace function public.complete_pickup(
  target_order_id uuid,
  client_request_id uuid,
  pickup_outcome text,
  parcel_checked boolean default false,
  weighed_kg numeric default null,
  reason text default null,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  driver uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Yangon')::date;
  existing public.pickup_reports%rowtype;
  delivery public.delivery_orders%rowtype;
  pickup_stop public.route_stops%rowtype;
  declared numeric;
  variance numeric;
  started boolean;
  on_board numeric;
  capacity numeric;
  warnings jsonb := '[]'::jsonb;
begin
  if driver is null or not exists (select 1 from public.driver_profiles where user_id = driver) then
    raise exception 'Only a signed-in driver can record a pickup' using errcode = '42501';
  end if;
  if client_request_id is null then
    raise exception 'A request id is required' using errcode = '22023';
  end if;
  if pickup_outcome not in ('collected', 'failed') then
    raise exception 'Unknown outcome %', pickup_outcome using errcode = '22023';
  end if;

  select * into existing from public.pickup_reports where request_id = client_request_id;
  if found then
    if existing.driver_id <> driver then
      raise exception 'This request belongs to another driver' using errcode = '42501';
    end if;
    select * into delivery from public.delivery_orders where id = existing.order_id;
    return jsonb_build_object(
      'order_id', existing.order_id, 'status', delivery.status, 'duplicate', true,
      'weight_kg', existing.weighed_kg, 'variance_pct', existing.weight_variance_pct,
      'warnings', '[]'::jsonb
    );
  end if;

  select * into delivery from public.delivery_orders where id = target_order_id for update;
  if not found or not (select private.is_assigned_driver(target_order_id)) then
    raise exception 'This parcel is not assigned to you' using errcode = '42501';
  end if;
  if delivery.status in ('delivered', 'failed', 'cancelled') then
    raise exception 'This parcel already has an outcome: %', delivery.status using errcode = 'P0001';
  end if;
  if delivery.status in ('picked_up', 'in_transit') then
    raise exception 'This parcel is already collected' using errcode = 'P0001';
  end if;

  select stop.* into pickup_stop
  from public.route_stops as stop
  join public.delivery_routes as route on route.id = stop.route_id
  where stop.order_id = target_order_id
    and stop.stop_type = 'pickup'
    and stop.status in ('pending', 'arrived')
    and route.driver_id = driver
    and route.dispatch_run_id is not null
  order by stop.sequence_number
  limit 1
  for update of stop;
  if not found then
    raise exception 'This order has no pending pickup stop on your route' using errcode = 'P0001';
  end if;

  if pickup_outcome = 'collected' then
    if not coalesce(parcel_checked, false) then
      raise exception 'Check the parcel before taking it' using errcode = 'P0001';
    end if;
    if weighed_kg is not null and (weighed_kg <= 0 or weighed_kg > 100000) then
      raise exception 'Enter a weight above 0 kg' using errcode = '22023';
    end if;
  else
    if reason is null or reason not in (
      'customer_unavailable', 'parcel_not_ready', 'wrong_parcel', 'refused', 'oversize', 'other'
    ) then
      raise exception 'Choose why the parcel was not collected' using errcode = 'P0001';
    end if;
    if reason = 'other' and char_length(trim(coalesce(note, ''))) < 3 then
      raise exception 'Describe what happened' using errcode = 'P0001';
    end if;
  end if;

  if pickup_outcome = 'collected' then
    perform private.seed_order_logistics(delivery.id, null);
    select coalesce(logistics.weight_kg, delivery.parcel_weight_kg) into declared
    from public.delivery_order_logistics as logistics
    where logistics.order_id = delivery.id;
    if weighed_kg is not null then
      if declared is not null then
        variance := round(((weighed_kg - declared) / declared) * 100, 1);
      end if;
      update public.delivery_order_logistics
      set weight_kg = round(weighed_kg, 2), weight_source = 'weighed'
      where order_id = delivery.id;
      update public.delivery_orders set parcel_weight_kg = round(weighed_kg, 2) where id = delivery.id;
    end if;

    if delivery.status = 'assigned' then
      update public.delivery_orders set status = 'accepted' where id = delivery.id;
    end if;
    update public.delivery_orders set status = 'picked_up' where id = delivery.id;
    -- Mid-route pickups go straight out for delivery, as mid-route loading does.
    select exists (
      select 1 from public.driver_route_sessions as session
      where session.driver_id = driver and session.route_date = today and session.status = 'in_progress'
    ) into started;
    if started then
      update public.delivery_orders set status = 'in_transit' where id = delivery.id;
    end if;

    update public.route_stops
    set status = 'completed', completed_at = now(), arrived_at = coalesce(arrived_at, now())
    where id = pickup_stop.id;

    select coalesce(sum(coalesce(logistics.weight_kg, o.parcel_weight_kg)), 0) into on_board
    from public.delivery_assignments as assignment
    join public.delivery_orders as o on o.id = assignment.order_id
    left join public.delivery_order_logistics as logistics on logistics.order_id = o.id
    where assignment.driver_id = driver and assignment.ended_at is null
      and o.status in ('picked_up', 'in_transit');
    select vehicle.capacity_kg into capacity
    from public.delivery_assignments as assignment
    join public.vehicles as vehicle on vehicle.id = assignment.vehicle_id
    where assignment.order_id = delivery.id and assignment.ended_at is null;
    if capacity is not null and on_board > capacity then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'code', 'overweight', 'on_board_kg', on_board, 'capacity_kg', capacity));
    end if;
  else
    update public.delivery_orders set status = 'failed' where id = delivery.id;
    update public.route_stops
    set status = 'failed', completed_at = now(), arrived_at = coalesce(arrived_at, now())
    where id = pickup_stop.id;
    -- It never reached the truck, so it has nothing to deliver.
    update public.route_stops
    set status = 'skipped'
    where route_id = pickup_stop.route_id and order_id = delivery.id
      and stop_type = 'delivery' and status = 'pending';
  end if;

  insert into public.pickup_reports (
    order_id, driver_id, request_id, outcome, parcel_checked, weighed_kg, declared_kg,
    weight_variance_pct, failure_reason, note
  )
  values (
    delivery.id, driver, client_request_id, pickup_outcome, coalesce(parcel_checked, false),
    case when pickup_outcome = 'collected' then round(weighed_kg, 2) end,
    case when pickup_outcome = 'collected' and weighed_kg is not null then declared end,
    variance,
    case when pickup_outcome = 'failed' then reason end,
    nullif(trim(coalesce(note, '')), '')
  );

  select * into delivery from public.delivery_orders where id = target_order_id;
  return jsonb_build_object(
    'order_id', delivery.id, 'status', delivery.status, 'duplicate', false,
    'weight_kg', case when pickup_outcome = 'collected' then round(weighed_kg, 2) end,
    'variance_pct', variance, 'warnings', warnings
  );
end;
$$;

revoke all on function public.complete_pickup(uuid, uuid, text, boolean, numeric, text, text)
  from public, anon;
grant execute on function public.complete_pickup(uuid, uuid, text, boolean, numeric, text, text)
  to authenticated;

-- Same function as 20261021140000, plus one rule: a route cannot be closed
-- while a pickup on today's plan route is still pending.
create or replace function public.set_driver_route_state(
  next_state text,
  reason text default null,
  declared_cod numeric default null
)
returns public.driver_route_sessions
language plpgsql
security definer
set search_path = ''
as $$
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
    if session.status = 'closed' then
      raise exception 'Today''s route is already closed' using errcode = 'P0001';
    end if;
    update public.driver_route_sessions
    set status = 'in_progress', paused_at = null, pause_reason = null, updated_at = now()
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
    if exists (
      select 1 from public.route_stops as stop
      join public.delivery_routes as route on route.id = stop.route_id
      where route.driver_id = driver
        and route.dispatch_run_id is not null
        and route.service_date = today
        and stop.stop_type = 'pickup'
        and stop.status in ('pending', 'arrived')
    ) then
      raise exception 'Collect or report every pickup before closing the route'
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
$$;

revoke all on function public.set_driver_route_state(text, text, numeric) from public, anon;
grant execute on function public.set_driver_route_state(text, text, numeric) to authenticated;
