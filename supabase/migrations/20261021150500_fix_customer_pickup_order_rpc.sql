-- Fixes create_customer_pickup_order, which fails for every customer on a database
-- built from these migrations. Two defects, both reproducible on a fresh
-- Postgres 17 by running supabase/tests/delivery_workflows.sql:
--
-- 1. The public wrapper is SECURITY INVOKER, but EXECUTE on the private
--    function it calls was revoked from authenticated, so the call fails with
--    "permission denied for function create_customer_pickup_order".
-- 2. The unqualified `id` in the pickup-contact-name subselect is ambiguous
--    with the function's `id` output column ("column reference id is
--    ambiguous").
--
-- The body is otherwise unchanged. The function is SECURITY DEFINER and checks
-- auth.uid() and the customer role itself, and the private schema is already
-- usable by authenticated, so granting EXECUTE does not widen access: anonymous
-- callers still cannot reach it, and non-customers are rejected inside.

create or replace function private.create_customer_pickup_order(
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
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception 'Sign in as a customer before requesting a pickup'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = actor_id and profiles.role = 'customer'
  ) then
    raise exception 'Only customer accounts can request a pickup'
      using errcode = '42501';
  end if;

  if nullif(trim(p_pickup_address), '') is null
     or nullif(trim(p_delivery_address), '') is null
     or nullif(trim(p_recipient_name), '') is null
     or nullif(trim(p_recipient_phone), '') is null
     or nullif(trim(p_parcel_description), '') is null then
    raise exception 'Pickup, destination, recipient, phone, and parcel details are required'
      using errcode = '22023';
  end if;

  return query
  insert into public.delivery_orders (
    customer_id,
    created_by,
    pickup_address,
    pickup_latitude,
    pickup_longitude,
    pickup_contact_name,
    pickup_contact_phone,
    delivery_address,
    delivery_latitude,
    delivery_longitude,
    recipient_name,
    recipient_phone,
    parcel_description,
    cod_amount,
    cod_status,
    estimated_delivery_at
  )
  values (
    actor_id,
    actor_id,
    trim(p_pickup_address),
    p_pickup_latitude,
    p_pickup_longitude,
    (select full_name from public.profiles where profiles.id = actor_id),
    nullif(trim(p_pickup_contact_phone), ''),
    trim(p_delivery_address),
    p_delivery_latitude,
    p_delivery_longitude,
    trim(p_recipient_name),
    trim(p_recipient_phone),
    trim(p_parcel_description),
    greatest(coalesce(p_cod_amount, 0), 0),
    case when greatest(coalesce(p_cod_amount, 0), 0) > 0 then 'pending' else 'not_required' end,
    now() + interval '2 hours'
  )
  returning delivery_orders.id, delivery_orders.tracking_code, delivery_orders.created_at;
end;
$$;

revoke all on function private.create_customer_pickup_order(
  text, numeric, numeric, text, text, numeric, numeric, text, text, text, numeric
) from public, anon;
grant execute on function private.create_customer_pickup_order(
  text, numeric, numeric, text, text, numeric, numeric, text, text, text, numeric
) to authenticated;
