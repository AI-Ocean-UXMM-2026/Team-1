-- Persist one route and its two stops for every active delivery assignment.
create or replace function public.ensure_delivery_route(target_order_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  active_assignment public.delivery_assignments%rowtype;
  ensure_route_id uuid;
  delivery public.delivery_orders%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_manager()) then
    raise exception 'Only a signed-in manager can create delivery routes'
      using errcode = '42501';
  end if;

  select * into delivery
  from public.delivery_orders
  where id = target_order_id;

  if not found then
    raise exception 'This delivery no longer exists'
      using errcode = 'P0002';
  end if;

  select * into active_assignment
  from public.delivery_assignments
  where order_id = target_order_id and ended_at is null
  order by assigned_at desc
  limit 1;

  if not found then
    raise exception 'Assign a rider before creating a route'
      using errcode = 'P0002';
  end if;

  if active_assignment.route_id is not null then
    return active_assignment.route_id;
  end if;

  insert into public.delivery_routes (created_by, driver_id, vehicle_id, status)
  values ((select auth.uid()), active_assignment.driver_id, active_assignment.vehicle_id, 'planned')
  returning id into ensure_route_id;

  insert into public.route_stops (
    route_id, order_id, stop_type, sequence_number, address, latitude, longitude
  )
  values
    (ensure_route_id, delivery.id, 'pickup', 1, delivery.pickup_address,
      delivery.pickup_latitude, delivery.pickup_longitude),
    (ensure_route_id, delivery.id, 'delivery', 2, delivery.delivery_address,
      delivery.delivery_latitude, delivery.delivery_longitude);

  update public.delivery_assignments as assignment
  set route_id = ensure_route_id
  where id = active_assignment.id;

  return ensure_route_id;
end;
$$;

revoke all on function public.ensure_delivery_route(uuid) from public, anon;
grant execute on function public.ensure_delivery_route(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.delivery_routes;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.route_stops;
exception
  when duplicate_object then null;
end;
$$;
