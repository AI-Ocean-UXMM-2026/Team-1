-- Money paid in the app is returned when the order is not going to happen:
--
-- * cancelling an order refunds what was paid in the app (sandbox: the refund
--   is recorded on the order and the customer is told; no money moves);
-- * a paid order that no rider confirms within a grace period is cancelled
--   by cancel_unconfirmed_paid_orders(), which pg_cron runs every few minutes
--   when the extension is available.
--
-- Failed deliveries are not refunded automatically: the parcel was collected.
-- Points spent on a cancelled order are already returned by an earlier trigger.

alter table public.delivery_orders
  add column if not exists refunded_amount numeric not null default 0
    check (refunded_amount >= 0),
  add column if not exists refunded_at timestamptz;

-- Drivers must not touch refund columns either.
create or replace function private.guard_order_reward_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select private.is_manager()) or current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.discount_amount := old.discount_amount;
  new.coupon_id := old.coupon_id;
  new.points_redeemed := old.points_redeemed;
  new.delivery_fee := old.delivery_fee;
  new.refunded_amount := old.refunded_amount;
  new.refunded_at := old.refunded_at;
  return new;
end;
$$;
revoke all on function private.guard_order_reward_columns() from public, anon, authenticated;

create or replace function private.refund_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid numeric;
  found_match text[];
begin
  found_match := regexp_match(
    coalesce(new.parcel_description, ''),
    'payment: prepaid (?:mmqr|ctzpay) (\d+) MMK',
    'i'
  );
  paid := coalesce(found_match[1]::numeric, 0);
  if paid <= 0 or new.refunded_amount > 0 then
    return new;
  end if;

  new.refunded_amount := paid;
  new.refunded_at := now();
  new.parcel_description :=
    concat_ws(' · ', nullif(new.parcel_description, ''), 'Refunded MMK ' || paid::bigint);

  if new.customer_id is not null then
    insert into public.delivery_notifications (order_id, recipient_id, notification_type, message)
    values (
      new.id,
      new.customer_id,
      'status_update',
      'Your order ' || new.tracking_code || ' was cancelled. MMK ' || paid::bigint || ' is being refunded to the account you paid from.'
    );
  end if;
  return new;
end;
$$;
revoke all on function private.refund_cancelled_order() from public, anon, authenticated;

create trigger refund_cancelled_order
  before update of status on public.delivery_orders
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function private.refund_cancelled_order();

-- Cancels paid orders no rider has taken. "Pickup tomorrow" orders are given
-- a day more, so a scheduled pickup is not cancelled for being early.
create or replace function public.cancel_unconfirmed_paid_orders(p_minutes integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancelled integer;
begin
  if current_user in ('authenticated', 'anon') and not (select private.is_manager()) then
    raise exception 'Only managers can run this' using errcode = '42501';
  end if;

  with stale as (
    update public.delivery_orders o
    set status = 'cancelled'
    where o.status in ('pending', 'assigned')
      and o.parcel_description ~* 'payment: prepaid (mmqr|ctzpay) \d+ MMK'
      and o.created_at < now() - make_interval(
        mins => greatest(p_minutes, 1)
          + case when o.parcel_description ~* 'pickup tomorrow' then 24 * 60 else 0 end
      )
    returning o.id
  )
  select count(*) into cancelled from stale;
  return cancelled;
end;
$$;
revoke all on function public.cancel_unconfirmed_paid_orders(integer) from public, anon;
grant execute on function public.cancel_unconfirmed_paid_orders(integer) to authenticated;

-- Run it every five minutes where pg_cron exists; skip quietly elsewhere.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'cancel-unconfirmed-paid-orders',
      '*/5 * * * *',
      'select public.cancel_unconfirmed_paid_orders(60)'
    );
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end;
$$;
