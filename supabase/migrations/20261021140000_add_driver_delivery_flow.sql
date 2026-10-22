-- Driver delivery flow: one atomic, retry-safe write per parcel outcome, and a
-- per-day route session so a driver can start, pause, resume and close a route.
--
-- Before this migration a completed delivery took three separate writes (COD
-- payment, order status, outcome report). A dropped connection between them left
-- a delivered parcel without its recipient or cash record, and a network retry
-- could submit the same handover twice.

-- ---------------------------------------------------------------- outcomes

alter table public.delivery_outcome_reports
  add column request_id uuid,
  add column parcel_verified boolean not null default false,
  add column next_action text not null default 'none'
    check (next_action in ('none', 'retry_later', 'reschedule', 'return_to_depot'));

-- One client request produces at most one outcome, however often it is retried.
create unique index delivery_outcome_reports_request_idx
  on public.delivery_outcome_reports (request_id)
  where request_id is not null;

alter table public.delivery_outcome_reports
  drop constraint if exists delivery_outcome_reports_failure_reason_check;
alter table public.delivery_outcome_reports
  add constraint delivery_outcome_reports_failure_reason_check check (
    failure_reason is null
    or failure_reason in (
      'recipient_unavailable', 'incorrect_address', 'recipient_refused',
      'recipient_unreachable', 'cannot_access', 'parcel_damaged',
      'parcel_missing', 'cod_not_paid', 'other'
    )
  );

-- A delivered parcel must have been checked against the manifest.
alter table public.delivery_outcome_reports
  add constraint delivery_outcome_reports_delivered_is_verified check (
    outcome <> 'delivered' or request_id is null or parcel_verified
  );

/**
 * Records one parcel's delivery outcome in a single transaction: COD payment
 * (when the full amount was received), the order status, and the outcome
 * report. Calling it again with the same request id returns the first result
 * instead of writing twice.
 */
create or replace function public.complete_delivery(
  target_order_id uuid,
  client_request_id uuid,
  delivery_outcome text,
  parcel_checked boolean default false,
  received_by text default null,
  reason text default null,
  follow_up text default 'none',
  delivery_note text default null,
  cod_received numeric default null,
  cod_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.delivery_outcome_reports%rowtype;
  delivery public.delivery_orders%rowtype;
  driver uuid := (select auth.uid());
  cod_open boolean;
begin
  if driver is null then
    raise exception 'Sign in to record a delivery' using errcode = '42501';
  end if;
  if client_request_id is null then
    raise exception 'A request id is required' using errcode = '22023';
  end if;

  select * into existing
  from public.delivery_outcome_reports
  where request_id = client_request_id;
  if found then
    select * into delivery from public.delivery_orders where id = existing.order_id;
    return jsonb_build_object(
      'order_id', existing.order_id,
      'status', delivery.status,
      'cod_status', delivery.cod_status,
      'duplicate', true
    );
  end if;

  select * into delivery
  from public.delivery_orders
  where id = target_order_id
  for update;
  if not found or not (select private.is_assigned_driver(target_order_id)) then
    raise exception 'This parcel is not assigned to you' using errcode = '42501';
  end if;
  if delivery.status in ('delivered', 'failed', 'cancelled') then
    raise exception 'This parcel already has an outcome: %', delivery.status
      using errcode = 'P0001';
  end if;
  if delivery.status not in ('picked_up', 'in_transit') then
    raise exception 'Load this parcel before recording a delivery outcome'
      using errcode = 'P0001';
  end if;
  if delivery_outcome not in ('delivered', 'failed') then
    raise exception 'Unknown outcome %', delivery_outcome using errcode = '22023';
  end if;

  cod_open := delivery.cod_amount > 0 and delivery.cod_status = 'pending';

  if delivery_outcome = 'delivered' then
    if not coalesce(parcel_checked, false) then
      raise exception 'Check the parcel against the manifest before handing it over'
        using errcode = 'P0001';
    end if;
    if char_length(trim(coalesce(received_by, ''))) = 0 then
      raise exception 'Record who received the parcel' using errcode = 'P0001';
    end if;
    if cod_open and cod_received is null then
      raise exception 'Record the cash received for this COD parcel'
        using errcode = 'P0001';
    end if;
    if cod_open and cod_received <> delivery.cod_amount
      and char_length(trim(coalesce(cod_reason, ''))) < 3 then
      raise exception 'Explain why the cash differs from the COD amount'
        using errcode = 'P0001';
    end if;
  else
    if reason is null then
      raise exception 'Choose why the parcel was not delivered' using errcode = 'P0001';
    end if;
    if reason = 'other' and char_length(trim(coalesce(delivery_note, ''))) < 3 then
      raise exception 'Describe what happened' using errcode = 'P0001';
    end if;
  end if;

  if delivery.status = 'picked_up' then
    update public.delivery_orders set status = 'in_transit' where id = delivery.id;
  end if;

  if delivery_outcome = 'delivered' and cod_open and cod_received = delivery.cod_amount then
    insert into public.cod_payments (order_id, collected_by, amount, payment_method, status)
    values (delivery.id, driver, delivery.cod_amount, 'cash', 'collected');
  end if;

  update public.delivery_orders set status = delivery_outcome where id = delivery.id;

  insert into public.delivery_outcome_reports (
    order_id, driver_id, outcome, recipient_name, failure_reason, note,
    cod_expected, cod_collected, cod_discrepancy_reason,
    request_id, parcel_verified, next_action
  )
  values (
    delivery.id, driver, delivery_outcome,
    case when delivery_outcome = 'delivered' then nullif(trim(received_by), '') end,
    case when delivery_outcome = 'failed' then reason end,
    nullif(trim(coalesce(delivery_note, '')), ''),
    delivery.cod_amount,
    case when cod_open and delivery_outcome = 'delivered' then cod_received end,
    case
      when cod_open and delivery_outcome = 'delivered' and cod_received <> delivery.cod_amount
        then trim(cod_reason)
    end,
    client_request_id,
    coalesce(parcel_checked, false),
    case when delivery_outcome = 'failed' then coalesce(follow_up, 'none') else 'none' end
  );

  select * into delivery from public.delivery_orders where id = target_order_id;
  return jsonb_build_object(
    'order_id', delivery.id,
    'status', delivery.status,
    'cod_status', delivery.cod_status,
    'duplicate', false
  );
end;
$$;

revoke all on function public.complete_delivery(uuid, uuid, text, boolean, text, text, text, text, numeric, text)
  from public, anon;
grant execute on function public.complete_delivery(uuid, uuid, text, boolean, text, text, text, text, numeric, text)
  to authenticated;

-- ---------------------------------------------------------- route sessions

-- One row per driver per Yangon day. Parcel statuses say what is loaded and
-- delivered; this says whether the driver is working the route right now.
create table public.driver_route_sessions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles (user_id) on delete cascade,
  route_date date not null default ((now() at time zone 'Asia/Yangon')::date),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'paused', 'closed')),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  pause_reason text check (pause_reason is null or char_length(pause_reason) <= 120),
  closed_at timestamptz,
  cod_declared numeric(12, 2) check (cod_declared is null or cod_declared >= 0),
  updated_at timestamptz not null default now(),
  constraint driver_route_sessions_one_per_day unique (driver_id, route_date),
  constraint driver_route_sessions_paused_has_time check (
    status <> 'paused' or paused_at is not null
  ),
  constraint driver_route_sessions_closed_has_time check (
    status <> 'closed' or closed_at is not null
  )
);

alter table public.driver_route_sessions enable row level security;

create policy driver_route_sessions_read_access
  on public.driver_route_sessions for select to authenticated
  using (
    driver_id = (select auth.uid())
    or (select private.is_manager())
    or (select private.is_support())
  );

-- Writes go through set_driver_route_state so transitions stay valid.
grant select on public.driver_route_sessions to authenticated;

/**
 * Moves today's route session to the next state: start, pause, resume or
 * close. Closing needs every loaded parcel to have an outcome.
 */
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

do $$
begin
  alter publication supabase_realtime add table public.driver_route_sessions;
exception
  when duplicate_object then null;
end;
$$;
