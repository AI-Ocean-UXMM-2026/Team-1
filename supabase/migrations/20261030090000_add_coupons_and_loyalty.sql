-- Coupons (manager-created, discount the delivery fee) and loyalty points
-- (earned when an order is delivered, spent against the fee).
--
-- Redemption is a separate SECURITY DEFINER function applied to an order the
-- customer just created, so the order-creation functions keep their
-- signatures. The discount is bounded by the order's own cod_amount, because
-- the server does not store the fee separately.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) between 3 and 24),
  kind text not null check (kind in ('percent', 'fixed', 'free_delivery')),
  value numeric not null default 0 check (value >= 0),
  min_fee numeric not null default 0 check (min_fee >= 0),
  max_discount numeric check (max_discount is null or max_discount > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value between 1 and 100),
  check (kind <> 'fixed' or value > 0),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null unique references public.delivery_orders (id) on delete cascade,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);
create index coupon_redemptions_customer_idx on public.coupon_redemptions (customer_id, coupon_id);

create table public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.delivery_orders (id) on delete set null,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('delivered', 'redeemed', 'adjustment', 'reversal')),
  created_at timestamptz not null default now()
);
create index loyalty_ledger_customer_idx on public.loyalty_ledger (customer_id, created_at desc);
-- One earn and one redemption per order, so retries cannot double count.
create unique index loyalty_ledger_order_reason_idx
  on public.loyalty_ledger (order_id, reason)
  where order_id is not null and reason in ('delivered', 'redeemed');

alter table public.delivery_orders
  add column if not exists discount_amount numeric not null default 0 check (discount_amount >= 0),
  add column if not exists coupon_id uuid references public.coupons (id) on delete set null,
  add column if not exists points_redeemed integer not null default 0 check (points_redeemed >= 0);

create view public.loyalty_balances
with (security_invoker = true) as
select customer_id, greatest(sum(delta), 0)::integer as balance
from public.loyalty_ledger
group by customer_id;

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.loyalty_ledger enable row level security;

create policy coupons_manager_all on public.coupons
  for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

-- Customers see only coupons they could use today.
create policy coupons_customer_read on public.coupons
  for select to authenticated
  using (active and (ends_at is null or ends_at > now()));

create policy coupon_redemptions_read on public.coupon_redemptions
  for select to authenticated
  using ((select private.is_manager()) or customer_id = (select auth.uid()));

create policy loyalty_ledger_read on public.loyalty_ledger
  for select to authenticated
  using ((select private.is_manager()) or customer_id = (select auth.uid()));

create policy loyalty_ledger_manager_adjust on public.loyalty_ledger
  for insert to authenticated
  with check ((select private.is_manager()) and reason = 'adjustment');

grant select on public.coupons, public.coupon_redemptions, public.loyalty_ledger,
  public.loyalty_balances to authenticated;
grant insert, update, delete on public.coupons to authenticated;
grant insert on public.loyalty_ledger to authenticated;

-- Drivers must not change reward columns on orders they are assigned to.
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
  return new;
end;
$$;
revoke all on function private.guard_order_reward_columns() from public, anon, authenticated;

create trigger guard_order_reward_columns
  before update on public.delivery_orders
  for each row execute function private.guard_order_reward_columns();

-- Preview what a code would take off a fee, without redeeming it.
create or replace function public.validate_coupon(p_code text, p_fee numeric)
returns table (coupon_id uuid, discount numeric, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  c public.coupons;
  used_total integer;
  used_by_customer integer;
  amount numeric;
begin
  if actor_id is null then
    raise exception 'Sign in to use a coupon' using errcode = '42501';
  end if;

  select * into c from public.coupons where code = upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  if not found then
    return query select null::uuid, 0::numeric, 'We could not find that coupon.'::text;
    return;
  end if;
  if not c.active then
    return query select null::uuid, 0::numeric, 'This coupon is turned off.'::text; return;
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    return query select null::uuid, 0::numeric, 'This coupon is not active yet.'::text; return;
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    return query select null::uuid, 0::numeric, 'This coupon has expired.'::text; return;
  end if;

  select count(*) into used_total from public.coupon_redemptions where coupon_redemptions.coupon_id = c.id;
  if c.max_redemptions is not null and used_total >= c.max_redemptions then
    return query select null::uuid, 0::numeric, 'This coupon has been fully used.'::text; return;
  end if;
  select count(*) into used_by_customer
  from public.coupon_redemptions
  where coupon_redemptions.coupon_id = c.id and coupon_redemptions.customer_id = actor_id;
  if c.per_customer_limit is not null and used_by_customer >= c.per_customer_limit then
    return query select null::uuid, 0::numeric, 'You have already used this coupon.'::text; return;
  end if;
  if p_fee < c.min_fee then
    return query select null::uuid, 0::numeric, 'The delivery fee is below this coupon''s minimum.'::text; return;
  end if;

  amount := case c.kind
    when 'free_delivery' then p_fee
    when 'percent' then floor(p_fee * c.value / 100)
    else c.value
  end;
  if c.max_discount is not null then amount := least(amount, c.max_discount); end if;
  amount := greatest(0, least(amount, p_fee));
  if amount = 0 then
    return query select null::uuid, 0::numeric, 'This coupon gives no discount on this order.'::text; return;
  end if;
  return query select c.id, amount, null::text;
end;
$$;

-- Apply a coupon and/or points to an order the caller just created.
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
  if o.status not in ('pending', 'assigned') or o.discount_amount > 0 then
    raise exception 'Rewards can only be applied once, before pickup' using errcode = '22023';
  end if;

  -- The fee can never exceed what the order asks the customer to pay.
  fee := least(greatest(coalesce(p_fee, 0), 0), o.cod_amount);

  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select v.coupon_id, v.discount, v.reason
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

-- Earn points when an order is delivered; take them back if it is reversed.
create or replace function private.settle_order_loyalty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  earned integer;
  fee_paid numeric;
begin
  if new.customer_id is null then
    return new;
  end if;

  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    -- Points follow the cod_amount already net of discounts, in 1,000 MMK steps.
    fee_paid := new.cod_amount;
    earned := floor(fee_paid / 1000)::integer;
    if earned > 0 then
      insert into public.loyalty_ledger (customer_id, order_id, delta, reason)
      values (new.customer_id, new.id, earned, 'delivered')
      on conflict do nothing;
    end if;
  elsif new.status in ('failed', 'cancelled') and old.status is distinct from new.status then
    if new.points_redeemed > 0 then
      insert into public.loyalty_ledger (customer_id, order_id, delta, reason)
      values (new.customer_id, new.id, new.points_redeemed, 'reversal');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.settle_order_loyalty() from public, anon, authenticated;

create trigger settle_order_loyalty
  after update of status on public.delivery_orders
  for each row execute function private.settle_order_loyalty();

revoke all on function public.validate_coupon(text, numeric) from public, anon;
revoke all on function public.redeem_order_rewards(uuid, numeric, text, integer) from public, anon;
grant execute on function public.validate_coupon(text, numeric) to authenticated;
grant execute on function public.redeem_order_rewards(uuid, numeric, text, integer) to authenticated;
