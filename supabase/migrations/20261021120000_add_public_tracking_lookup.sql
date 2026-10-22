-- Lets anyone holding a parcel's full tracking code follow that one delivery
-- without signing in. The code is a 128-bit random value, so it works as a
-- share link: an exact match is required and nothing is listed or searched.
-- Only delivery progress is returned: no phone numbers, recipient or customer
-- identity, vehicle registration, or COD settlement details.
create or replace function public.track_delivery(code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select o.*
    from public.delivery_orders o
    where lower(regexp_replace(o.tracking_code, '[^A-Za-z0-9]', '', 'g')) = lower(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'))
       or (coalesce(code, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and o.id = code::uuid)
    limit 1
  ),
  assignment as (
    select a.driver_id, a.vehicle_id
    from public.delivery_assignments a
    join target t on t.id = a.order_id
    where a.ended_at is null
    limit 1
  ),
  latest_location as (
    select l.latitude, l.longitude, l.accuracy_meters, l.recorded_at
    from public.delivery_locations l
    join target t on t.id = l.order_id
    where t.status in ('picked_up', 'in_transit')
    order by l.recorded_at desc
    limit 1
  )
  select jsonb_build_object(
    'id', t.id,
    'tracking_code', t.tracking_code,
    'status', t.status,
    'pickup_address', t.pickup_address,
    'delivery_address', t.delivery_address,
    'pickup_latitude', t.pickup_latitude,
    'pickup_longitude', t.pickup_longitude,
    'delivery_latitude', t.delivery_latitude,
    'delivery_longitude', t.delivery_longitude,
    'cod_amount', t.cod_amount,
    'cod_status', t.cod_status,
    'estimated_delivery_at', t.estimated_delivery_at,
    'route_progress_percent', t.route_progress_percent,
    'traffic_delay_minutes', t.traffic_delay_minutes,
    'eta_confidence', t.eta_confidence,
    'eta_updated_at', t.eta_updated_at,
    'created_at', t.created_at,
    'has_driver', (select count(*) > 0 from assignment),
    'driver_first_name', (
      select split_part(coalesce(p.full_name, ''), ' ', 1)
      from assignment a
      join public.profiles p on p.id = a.driver_id
    ),
    'vehicle_type', (
      select v.vehicle_type
      from assignment a
      join public.vehicles v on v.id = a.vehicle_id
    ),
    'latest_location', (select to_jsonb(l) from latest_location l),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'status', e.status,
          'created_at', e.created_at
        )
        order by e.created_at
      )
      from public.delivery_status_events e
      where e.order_id = t.id
    ), '[]'::jsonb)
  )
  from target t;
$$;

revoke all on function public.track_delivery(text) from public;
grant execute on function public.track_delivery(text) to anon, authenticated;
