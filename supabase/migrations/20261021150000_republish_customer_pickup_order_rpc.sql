-- Re-publish the customer pickup RPC for projects where the original migration
-- was not applied. This is idempotent and does not change existing RLS policies.

create or replace function public.create_customer_pickup_order(
  p_pickup_address text,
  p_pickup_latitude numeric,
  p_pickup_longitude numeric,
  p_pickup_contact_phone text,
  p_delivery_address text,
  p_delivery_latitude numeric,
  p_delivery_longitude numeric,
  p_recipient_name text,
  p_recipient_phone text,
  p_parcel_description text,
  p_cod_amount numeric
)
returns table (id uuid, tracking_code text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  new_order_id uuid;
  new_tracking_code text;
  new_created_at timestamptz;
begin
  if actor_id is null then
    raise exception 'Sign in as a customer before requesting a pickup' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where profiles.id = actor_id and profiles.role = 'customer'
  ) then
    raise exception 'Only customer accounts can request a pickup' using errcode = '42501';
  end if;

  if nullif(trim(p_pickup_address), '') is null
     or nullif(trim(p_delivery_address), '') is null
     or nullif(trim(p_recipient_name), '') is null
     or nullif(trim(p_recipient_phone), '') is null
     or nullif(trim(p_parcel_description), '') is null then
    raise exception 'Pickup, destination, recipient, phone, and parcel details are required'
      using errcode = '22023';
  end if;

  with inserted_order as (
    insert into public.delivery_orders (
    customer_id, created_by, pickup_address, pickup_latitude, pickup_longitude,
    pickup_contact_name, pickup_contact_phone, delivery_address,
    delivery_latitude, delivery_longitude, recipient_name, recipient_phone,
    parcel_description, cod_amount, cod_status, estimated_delivery_at
  )
    values (
    actor_id, actor_id, trim(p_pickup_address), p_pickup_latitude, p_pickup_longitude,
    (select full_name from public.profiles where profiles.id = actor_id),
    nullif(trim(p_pickup_contact_phone), ''), trim(p_delivery_address),
    p_delivery_latitude, p_delivery_longitude, trim(p_recipient_name),
    trim(p_recipient_phone), trim(p_parcel_description),
    greatest(coalesce(p_cod_amount, 0), 0),
    case when greatest(coalesce(p_cod_amount, 0), 0) > 0 then 'pending' else 'not_required' end,
    now() + interval '2 hours'
  )
    returning delivery_orders.id, delivery_orders.tracking_code, delivery_orders.created_at
  )
  select inserted_order.id, inserted_order.tracking_code, inserted_order.created_at
    into new_order_id, new_tracking_code, new_created_at
  from inserted_order;

  id := new_order_id;
  tracking_code := new_tracking_code;
  created_at := new_created_at;
  return next;
end;
$$;

revoke all on function public.create_customer_pickup_order(
  text, numeric, numeric, text, text, numeric, numeric, text, text, text, numeric
) from public, anon;

grant execute on function public.create_customer_pickup_order(
  text, numeric, numeric, text, text, numeric, numeric, text, text, text, numeric
) to authenticated;
