-- Manager-created guest orders with itemized contents and automatic dispatch.

alter table public.delivery_orders
  alter column customer_id drop not null,
  add column if not exists notes text;

alter table public.delivery_orders
  alter column tracking_code set default (
    'OERN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );

create table if not exists public.delivery_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.delivery_orders (id) on delete cascade,
  description text not null check (char_length(trim(description)) > 0),
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists delivery_order_items_order_idx
  on public.delivery_order_items (order_id, created_at);

alter table public.delivery_order_items enable row level security;

drop policy if exists delivery_order_items_read_access on public.delivery_order_items;
create policy delivery_order_items_read_access
  on public.delivery_order_items for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_orders as delivery_order
      where delivery_order.id = delivery_order_items.order_id
        and (
          delivery_order.customer_id = (select auth.uid())
          or (select private.is_assigned_driver(delivery_order.id))
        )
    )
  );

drop policy if exists delivery_order_items_insert_manager on public.delivery_order_items;
create policy delivery_order_items_insert_manager
  on public.delivery_order_items for insert to authenticated
  with check ((select private.is_manager()));

drop policy if exists delivery_order_items_update_manager on public.delivery_order_items;
create policy delivery_order_items_update_manager
  on public.delivery_order_items for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

drop policy if exists delivery_order_items_delete_manager on public.delivery_order_items;
create policy delivery_order_items_delete_manager
  on public.delivery_order_items for delete to authenticated
  using ((select private.is_manager()));

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
  order_id uuid;
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
    customer_id,
    created_by,
    pickup_address,
    pickup_contact_name,
    pickup_contact_phone,
    delivery_address,
    recipient_name,
    recipient_phone,
    parcel_description,
    cod_amount,
    cod_status,
    notes,
    estimated_delivery_at
  )
  values (
    null,
    actor_id,
    trim(p_pickup_address),
    trim(p_sender_name),
    trim(p_sender_phone),
    trim(p_delivery_address),
    trim(p_receiver_name),
    trim(p_receiver_phone),
    (select string_agg(trim(item->>'description'), ', ')
     from jsonb_array_elements(p_items) as item),
    normalized_cod,
    case when normalized_cod > 0 then 'pending' else 'not_required' end,
    nullif(trim(p_notes), ''),
    now() + interval '2 hours'
  )
  returning delivery_orders.id into order_id;

  insert into public.delivery_order_items (order_id, description, quantity, unit_price)
  select
    order_id,
    trim(item->>'description'),
    greatest(coalesce((item->>'quantity')::integer, 1), 1),
    greatest(coalesce((item->>'unit_price')::numeric, 0), 0)
  from jsonb_array_elements(p_items) as item
  where nullif(trim(item->>'description'), '') is not null;

  if not exists (
    select 1 from public.delivery_order_items where delivery_order_items.order_id = order_id
  ) then
    raise exception 'Each order needs an item description'
      using errcode = '22023';
  end if;

  -- Pick an available rider with the lightest active workload. Vehicle choice
  -- is kept separate so a rider can be assigned even when the fleet is empty.
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
    perform public.assign_delivery(order_id, selected_driver_id, selected_vehicle_id);
    perform public.ensure_delivery_route(order_id);
  end if;

  return query
  select delivery_order.id,
         delivery_order.tracking_code,
         delivery_order.status,
         selected_driver_id,
         selected_vehicle_id
  from public.delivery_orders as delivery_order
  where delivery_order.id = order_id;
end;
$$;

revoke all on function public.create_manual_delivery_order(
  text, text, text, text, text, text, jsonb, numeric, text
) from public, anon;
grant execute on function public.create_manual_delivery_order(
  text, text, text, text, text, text, jsonb, numeric, text
) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'delivery_order_items'
    ) then
    alter publication supabase_realtime add table public.delivery_order_items;
  end if;
end;
$$;
