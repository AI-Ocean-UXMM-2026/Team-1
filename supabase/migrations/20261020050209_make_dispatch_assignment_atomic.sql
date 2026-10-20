-- Keep dispatch changes in a single transaction and preserve pickup tracking.
create or replace function public.assign_delivery(
  target_order_id uuid,
  target_driver_id uuid,
  target_vehicle_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_status text;
  rider_availability text;
  vehicle_status text;
  assignment_id uuid;
  previous_assignment public.delivery_assignments%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_manager()) then
    raise exception 'Only a signed-in manager can assign deliveries'
      using errcode = '42501';
  end if;

  -- Serializes concurrent dispatch attempts and races with rider status updates.
  select delivery_order.status into order_status
  from public.delivery_orders as delivery_order
  where delivery_order.id = target_order_id
  for update;

  if not found then
    raise exception 'This delivery no longer exists or is unavailable'
      using errcode = 'P0002';
  end if;
  if order_status not in ('pending', 'assigned', 'accepted', 'failed') then
    raise exception 'Assignments can only change before pickup or after a failed delivery';
  end if;

  select driver_profile.availability into rider_availability
  from public.driver_profiles as driver_profile
  join public.profiles as profile on profile.id = driver_profile.user_id
  where driver_profile.user_id = target_driver_id and profile.role = 'driver'
  for update of driver_profile;
  if not found then
    raise exception 'Choose a registered rider with a driver profile';
  end if;
  if rider_availability = 'off_duty' then
    raise exception 'This rider is off duty. Choose an available rider';
  end if;

  if target_vehicle_id is not null then
    select vehicle.status into vehicle_status
    from public.vehicles as vehicle
    where vehicle.id = target_vehicle_id
    for update;
    if not found then
      raise exception 'This vehicle is no longer available';
    end if;
    if vehicle_status not in ('available', 'in_use') then
      raise exception 'Choose an available vehicle';
    end if;
    if exists (
      select 1
      from public.delivery_assignments as assignment
      join public.delivery_orders as delivery_order on delivery_order.id = assignment.order_id
      where assignment.vehicle_id = target_vehicle_id
        and assignment.ended_at is null
        and assignment.order_id <> target_order_id
        and assignment.driver_id <> target_driver_id
        and delivery_order.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
    ) then
      raise exception 'This vehicle is assigned to another rider';
    end if;
    if vehicle_status = 'in_use' and not exists (
      select 1
      from public.delivery_assignments as assignment
      join public.delivery_orders as delivery_order on delivery_order.id = assignment.order_id
      where assignment.vehicle_id = target_vehicle_id
        and assignment.driver_id = target_driver_id
        and assignment.ended_at is null
        and delivery_order.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
    ) then
      raise exception 'This vehicle is already in use';
    end if;
  end if;

  select assignment.* into previous_assignment
  from public.delivery_assignments as assignment
  where assignment.order_id = target_order_id and assignment.ended_at is null;

  if previous_assignment.id is not null
    and previous_assignment.driver_id = target_driver_id
    and previous_assignment.vehicle_id is not distinct from target_vehicle_id
    and order_status in ('assigned', 'accepted') then
    return previous_assignment.id;
  end if;

  update public.delivery_assignments
  set ended_at = now()
  where order_id = target_order_id and ended_at is null;

  insert into public.delivery_assignments (order_id, driver_id, vehicle_id, assigned_by)
  values (target_order_id, target_driver_id, target_vehicle_id, (select auth.uid()))
  returning id into assignment_id;

  update public.delivery_orders set status = 'assigned' where id = target_order_id;
  return assignment_id;
end;
$$;

revoke all on function public.assign_delivery(uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_delivery(uuid, uuid, uuid) to authenticated;

-- One current point per parcel; source table RLS continues to govern the view.
-- Points from an earlier rider assignment must not appear after a new handoff.
create view public.latest_delivery_locations
with (security_invoker = true)
as
select distinct on (location.order_id)
  location.id,
  location.order_id,
  location.driver_id,
  location.latitude,
  location.longitude,
  location.accuracy_meters,
  location.recorded_at
from public.delivery_locations as location
where exists (
  select 1 from public.delivery_assignments as assignment
  where assignment.order_id = location.order_id
    and assignment.driver_id = location.driver_id
    and assignment.ended_at is null
    and location.recorded_at >= assignment.assigned_at
)
order by location.order_id, location.recorded_at desc, location.id desc;

revoke all on public.latest_delivery_locations from public, anon;
grant select on public.latest_delivery_locations to authenticated;

-- Email signups pass their contact number in metadata rather than auth.users.phone.
-- Profile role still uses its customer default and is never read from user metadata.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, nullif(new.raw_user_meta_data ->> 'phone', ''))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Qualify the outer vehicle: an unqualified id binds to assignment.id inside EXISTS.
alter policy vehicles_read_access on public.vehicles
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_assignments as assignment
      where assignment.vehicle_id = vehicles.id
        and assignment.driver_id = (select auth.uid())
        and assignment.ended_at is null
    )
  );
alter policy vehicles_update_access on public.vehicles
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_assignments as assignment
      where assignment.vehicle_id = vehicles.id
        and assignment.driver_id = (select auth.uid())
        and assignment.ended_at is null
    )
  )
  with check (
    (select private.is_manager())
    or exists (
      select 1 from public.delivery_assignments as assignment
      where assignment.vehicle_id = vehicles.id
        and assignment.driver_id = (select auth.uid())
        and assignment.ended_at is null
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'delivery_assignments'
    ) then
    alter publication supabase_realtime add table public.delivery_assignments;
  end if;
end;
$$;
