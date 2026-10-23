-- Managers can apply a coupon to a manual order. Manual orders are often for
-- guests, so a redemption may have no customer; the per-customer limit cannot
-- be enforced for those, but the overall redemption limit still is.

alter table public.coupon_redemptions
  alter column customer_id drop not null;

create or replace function public.redeem_manual_order_coupon(
  p_order_id uuid,
  p_fee numeric,
  p_coupon_code text
)
returns table (discount numeric, cod_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.delivery_orders;
  fee numeric;
  coupon_uuid uuid;
  coupon_discount numeric := 0;
  reason_text text;
begin
  if not (select private.is_manager()) then
    raise exception 'Only managers can apply a coupon to a manual order'
      using errcode = '42501';
  end if;

  select * into o from public.delivery_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = '22023';
  end if;
  if o.status not in ('pending', 'assigned') or o.discount_amount > 0 then
    raise exception 'A coupon can only be applied once, before pickup'
      using errcode = '22023';
  end if;

  -- Only the cash still due can be discounted.
  fee := least(greatest(coalesce(p_fee, 0), 0), o.cod_amount);

  select v.coupon_id, v.discount, v.reason
  into coupon_uuid, coupon_discount, reason_text
  from public.validate_coupon(p_coupon_code, fee) v;
  if coupon_uuid is null then
    raise exception '%', coalesce(reason_text, 'Coupon cannot be used on this order')
      using errcode = '22023';
  end if;

  insert into public.coupon_redemptions (coupon_id, customer_id, order_id, amount)
  values (coupon_uuid, o.customer_id, o.id, coupon_discount);

  update public.delivery_orders
  set cod_amount = greatest(delivery_orders.cod_amount - coupon_discount, 0),
      cod_status = case
        when greatest(delivery_orders.cod_amount - coupon_discount, 0) > 0
          then delivery_orders.cod_status
        else 'not_required'
      end,
      discount_amount = coupon_discount,
      coupon_id = coupon_uuid
  where id = o.id
  returning delivery_orders.cod_amount into cod_amount;

  return query select coupon_discount, cod_amount;
end;
$$;

revoke all on function public.redeem_manual_order_coupon(uuid, numeric, text) from public, anon;
grant execute on function public.redeem_manual_order_coupon(uuid, numeric, text) to authenticated;
