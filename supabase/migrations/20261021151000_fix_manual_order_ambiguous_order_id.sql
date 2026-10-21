create or replace function public.create_manual_delivery_order(
  p_sender_name text,
  p_sender_phone text,
  p_pickup_address text,
  p_receiver_name text,
  p_receiver_phone text,
  p_delivery_address text,
  p_items jsonb,
  p_cod_amount numeric default 0,
  p_notes text default null
)
returns table (
  id uuid,
  tracking_code text,
  status text,
  assigned_driver_id uuid,
  assigned_vehicle_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  v_order_id uuid;
  selected_driver_id uuid;
  selected_vehicle_id uuid;
  normalized_cod numeric := greatest(coalesce(p_cod_amount, 0), 0);
begin
  if actor_id is null or not (select private.is_manager()) then
    raise exception 'Only a signed-in manager can create manual deliveries'
      using errcode = '42501';
  end if;

  if nullif(trim(p_sender_name), '') is null
     or nullif(trim(p_sender_phone), '') is null
     or nullif(trim(p_pickup_address), '') is null
     or nullif(trim(p_receiver_name), '') is null
     or nullif(trim(p_receiver_phone), '') is null
     or nullif(trim(p_delivery_address), '') is null then
    raise exception 'Sender, receiver, phone, pickup, and delivery details are required'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Add at least one item to the order'
      using errcode = '22023';
  end if;

  insert into public.delivery_orders (
    customer_id, created_by, pickup_address, pickup_contact_name,
    pickup_contact_phone, delivery_address, recipient_name, recipient_phone,
    parcel_description, cod_amount, cod_status, notes, estimated_delivery_at
  )
  values (
    null, actor_id, trim(p_pickup_address), trim(p_sender_name),
    trim(p_sender_phone), trim(p_delivery_address), trim(p_receiver_name),
    trim(p_receiver_phone),
    (select string_agg(trim(item->>'description'), ', ')
     from jsonb_array_elements(p_items) as item),
    normalized_cod,
    case when normalized_cod > 0 then 'pending' else 'not_required' end,
    nullif(trim(p_notes), ''), now() + interval '2 hours'
  )
  returning delivery_orders.id into v_order_id;

  insert into public.delivery_order_items (order_id, description, quantity, unit_price)
  select
    v_order_id,
    trim(item->>'description'),
    greatest(coalesce((item->>'quantity')::integer, 1), 1),
    greatest(coalesce((item->>'unit_price')::numeric, 0), 0)
  from jsonb_array_elements(p_items) as item
  where nullif(trim(item->>'description'), '') is not null;

  if not exists (
    select 1
    from public.delivery_order_items as order_item
    where order_item.order_id = v_order_id
  ) then
    raise exception 'Each order needs an item description'
      using errcode = '22023';
  end if;

  select driver_profile.user_id into selected_driver_id
  from public.driver_profiles as driver_profile
  join public.profiles as profile on profile.id = driver_profile.user_id
  where profile.role = 'driver'
    and driver_profile.availability = 'available'
  order by (
    select count(*)
    from public.delivery_assignments as assignment
    join public.delivery_orders as active_order on active_order.id = assignment.order_id
    where assignment.driver_id = driver_profile.user_id
      and assignment.ended_at is null
      and active_order.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
  ), driver_profile.updated_at
  limit 1
  for update of driver_profile skip locked;

  select vehicle.id into selected_vehicle_id
  from public.vehicles as vehicle
  where vehicle.status = 'available'
  order by vehicle.updated_at
  limit 1
  for update skip locked;

  if selected_driver_id is not null then
    perform public.assign_delivery(v_order_id, selected_driver_id, selected_vehicle_id);
    perform public.ensure_delivery_route(v_order_id);
  end if;

  return query
  select delivery_order.id, delivery_order.tracking_code, delivery_order.status,
         selected_driver_id, selected_vehicle_id
  from public.delivery_orders as delivery_order
  where delivery_order.id = v_order_id;
end;
$$;

revoke all on function public.create_manual_delivery_order(
  text, text, text, text, text, text, jsonb, numeric, text
) from public, anon;
grant execute on function public.create_manual_delivery_order(
  text, text, text, text, text, text, jsonb, numeric, text
) to authenticated;
