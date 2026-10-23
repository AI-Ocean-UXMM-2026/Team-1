-- Coupons and points can be applied from Track after an order exists, so the
-- order has to remember its delivery fee: the discount applies to the fee, not
-- to goods money. Rewards may also be applied until the parcel is picked up,
-- not only while it is unassigned.

alter table public.delivery_orders
  add column if not exists delivery_fee numeric
    check (delivery_fee is null or delivery_fee >= 0);

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
  return new;
end;
$$;
revoke all on function private.guard_order_reward_columns() from public, anon, authenticated;

-- The customer who just created an order records the fee it was quoted.
create or replace function public.record_order_fee(p_order_id uuid, p_fee numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  update public.delivery_orders
  set delivery_fee = least(greatest(coalesce(p_fee, 0), 0), delivery_orders.cod_amount)
  where id = p_order_id
    and customer_id = actor_id
    and delivery_fee is null
    and status in ('pending', 'assigned', 'accepted');
end;
$$;
revoke all on function public.record_order_fee(uuid, numeric) from public, anon;
grant execute on function public.record_order_fee(uuid, numeric) to authenticated;

create or replace function public.redeem_order_rewards(
  p_order_id uuid,
  p_fee numeric,
  p_coupon_code text default null,
  p_points integer default 0
)
returns table (discount numeric, cod_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  o public.delivery_orders;
  fee numeric;
  coupon_discount numeric := 0;
  coupon_uuid uuid;
  points_used integer := 0;
  points_discount numeric := 0;
  balance integer;
  total_discount numeric;
begin
  if actor_id is null then
    raise exception 'Sign in to use rewards' using errcode = '42501';
  end if;

  select * into o from public.delivery_orders where id = p_order_id for update;
  if not found or o.customer_id is distinct from actor_id then
    raise exception 'Order not found' using errcode = '42501';
  end if;
  if o.status not in ('pending', 'assigned', 'accepted') or o.discount_amount > 0 then
    raise exception 'Rewards can only be applied once, before pickup' using errcode = '22023';
  end if;

  -- The recorded fee wins; the caller's figure is only a fallback, and neither
  -- can exceed what the order asks the customer to pay.
  fee := least(
    greatest(coalesce(o.delivery_fee, p_fee, 0), 0),
    o.cod_amount
  );

  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select v.coupon_id, v.discount
    into coupon_uuid, coupon_discount
    from public.validate_coupon(p_coupon_code, fee) v;
    if coupon_uuid is null then
      raise exception 'Coupon cannot be used on this order' using errcode = '22023';
    end if;
  end if;

  if coalesce(p_points, 0) > 0 then
    select coalesce(sum(delta), 0) into balance
    from public.loyalty_ledger where customer_id = actor_id;
    points_used := least(p_points, balance, floor((fee - coupon_discount) * 0.5 / 10)::integer);
    points_discount := points_used * 10;
  end if;

  total_discount := coupon_discount + points_discount;
  if total_discount <= 0 then
    return query select 0::numeric, o.cod_amount;
    return;
  end if;

  if coupon_uuid is not null then
    insert into public.coupon_redemptions (coupon_id, customer_id, order_id, amount)
    values (coupon_uuid, actor_id, o.id, coupon_discount);
  end if;
  if points_used > 0 then
    insert into public.loyalty_ledger (customer_id, order_id, delta, reason)
    values (actor_id, o.id, -points_used, 'redeemed');
  end if;

  update public.delivery_orders
  set cod_amount = greatest(delivery_orders.cod_amount - total_discount, 0),
      cod_status = case
        when greatest(delivery_orders.cod_amount - total_discount, 0) > 0 then delivery_orders.cod_status
        else 'not_required'
      end,
      discount_amount = total_discount,
      coupon_id = coupon_uuid,
      points_redeemed = points_used
  where id = o.id
  returning delivery_orders.cod_amount into cod_amount;

  return query select total_discount, cod_amount;
end;
$$;
