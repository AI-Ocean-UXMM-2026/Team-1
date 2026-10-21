-- Run as the trusted SQL runner in the Oern project. All fixtures are rolled back.
-- The assertions themselves run as authenticated with each fixture user's JWT sub.
begin;

create temporary table workflow_fixture_ids (
  name text primary key,
  id uuid not null default gen_random_uuid()
) on commit drop;
insert into workflow_fixture_ids (name)
values ('manager'), ('driver'), ('off_duty_driver'), ('customer'), ('other_customer'),
  ('vehicle'), ('other_vehicle'), ('order'), ('other_order'), ('pickup_order'), ('packed_order'), ('road_report');
grant select on workflow_fixture_ids to authenticated;

create temporary table workflow_checks (name text primary key) on commit drop;
grant select, insert on workflow_checks to authenticated;

create function pg_temp.fixture_id(fixture_name text)
returns uuid language sql stable security invoker
as $$ select id from pg_temp.workflow_fixture_ids where name = fixture_name $$;

create function pg_temp.as_user(fixture_name text)
returns void language plpgsql security invoker
as $$
begin
  perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(fixture_name)::text, true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', pg_temp.fixture_id(fixture_name), 'role', 'authenticated'
  )::text, true);
end;
$$;

create function pg_temp.assert_check(check_name text, actual boolean)
returns void language plpgsql security invoker
as $$
begin
  if actual is distinct from true then
    raise exception 'Workflow assertion failed: %', check_name;
  end if;
  insert into pg_temp.workflow_checks (name) values (check_name);
end;
$$;

create function pg_temp.expect_error(check_name text, statement text, message_pattern text)
returns void language plpgsql security invoker
as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlerrm !~* message_pattern then
      raise exception 'Workflow assertion % received unexpected error: %', check_name, sqlerrm;
    end if;
    insert into pg_temp.workflow_checks (name) values (check_name);
    return;
  end;
  raise exception 'Workflow assertion failed: % unexpectedly succeeded', check_name;
end;
$$;

-- These auth fixtures never send email or create a session and cannot persist.
insert into auth.users (id, email, raw_user_meta_data)
select id, 'oern-workflow-test-' || id::text || '@example.invalid',
  jsonb_build_object('full_name', 'Workflow fixture ' || name, 'phone', '+959000000000')
from workflow_fixture_ids
where name in ('manager', 'driver', 'off_duty_driver', 'customer', 'other_customer');
update public.profiles set role = 'manager' where id = pg_temp.fixture_id('manager');
update public.profiles set role = 'driver'
where id in (pg_temp.fixture_id('driver'), pg_temp.fixture_id('off_duty_driver'));
insert into public.driver_profiles (user_id, availability)
values (pg_temp.fixture_id('driver'), 'available'), (pg_temp.fixture_id('off_duty_driver'), 'off_duty');

set local role authenticated;
select pg_temp.as_user('manager');

select pg_temp.assert_check('metadata phone is retained on customer signup', (
  select phone = '+959000000000' from public.profiles where id = pg_temp.fixture_id('customer')
));
select pg_temp.assert_check('public signup keeps the customer role', (
  select role = 'customer' from public.profiles where id = pg_temp.fixture_id('customer')
));

insert into public.vehicles (id, registration_number, vehicle_type)
values (pg_temp.fixture_id('vehicle'), 'WORKFLOW-' || pg_temp.fixture_id('vehicle')::text, 'motorcycle'),
  (pg_temp.fixture_id('other_vehicle'), 'WORKFLOW-' || pg_temp.fixture_id('other_vehicle')::text, 'car');
insert into public.delivery_orders (
  id, customer_id, created_by, pickup_address, delivery_address,
  pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
  recipient_name, cod_amount, cod_status
)
values (
  pg_temp.fixture_id('order'), pg_temp.fixture_id('customer'), pg_temp.fixture_id('manager'),
  'Workflow pickup', 'Workflow destination', 16.7797, 96.1434, 16.8178, 96.1566,
  'Fixture customer', 12000, 'pending'
), (
  pg_temp.fixture_id('other_order'), pg_temp.fixture_id('other_customer'), pg_temp.fixture_id('manager'),
  'Private pickup', 'Private destination', 16.7800, 96.1440, 16.8200, 96.1570,
  'Other fixture customer', 0, 'not_required'
);
select pg_temp.assert_check('manager can create delivery orders', (
  select count(*) = 2 from public.delivery_orders
  where id in (pg_temp.fixture_id('order'), pg_temp.fixture_id('other_order')) and status = 'pending'
));
select pg_temp.as_user('customer');
select pg_temp.assert_check('customer pickup RPC creates an owned pending order', (
  select result.id is not null and result.tracking_code is not null
  from public.create_customer_pickup_order(
    'Customer pickup address', 16.7800, 96.1440, '+959111111111',
    'Customer destination', 16.8200, 96.1570, 'Pickup recipient',
    '+959222222222', 'Customer parcel', 15000
  ) as result
));
select pg_temp.assert_check('customer pickup order is owned and pending', (
  select customer_id = pg_temp.fixture_id('customer')
    and created_by = pg_temp.fixture_id('customer')
    and status = 'pending'
    and cod_status = 'pending'
  from public.delivery_orders
  where id = (
    select id from public.delivery_orders
    where customer_id = pg_temp.fixture_id('customer')
      and created_by = pg_temp.fixture_id('customer')
    order by created_at desc limit 1
  )
));
select pg_temp.as_user('manager');
select pg_temp.assert_check('manager can see customer pickup orders', (
  select count(*) = 1
  from public.delivery_orders
  where customer_id = pg_temp.fixture_id('customer')
    and created_by = pg_temp.fixture_id('customer')
    and status = 'pending'
));
select pg_temp.assert_check('manager atomic assignment returns an assignment',
  public.assign_delivery(pg_temp.fixture_id('order'), pg_temp.fixture_id('driver'), pg_temp.fixture_id('vehicle')) is not null
);
select pg_temp.assert_check('atomic assignment sets order status and assigned_by', (
  select count(*) = 1
  from public.delivery_orders as delivery_order
  join public.delivery_assignments as assignment on assignment.order_id = delivery_order.id
  where delivery_order.id = pg_temp.fixture_id('order') and delivery_order.status = 'assigned'
    and assignment.driver_id = pg_temp.fixture_id('driver')
    and assignment.vehicle_id = pg_temp.fixture_id('vehicle')
    and assignment.assigned_by = pg_temp.fixture_id('manager') and assignment.ended_at is null
));
select pg_temp.assert_check('identical assignment is idempotent',
  public.assign_delivery(pg_temp.fixture_id('order'), pg_temp.fixture_id('driver'), pg_temp.fixture_id('vehicle')) = (
    select id from public.delivery_assignments where order_id = pg_temp.fixture_id('order') and ended_at is null
  )
);
select pg_temp.expect_error('off-duty reassignment is rejected', format(
  'select public.assign_delivery(%L, %L, %L)', pg_temp.fixture_id('order'),
  pg_temp.fixture_id('off_duty_driver'), pg_temp.fixture_id('vehicle')
), 'off duty');
select pg_temp.assert_check('rejected reassignment preserves the original active assignment', (
  select count(*) = 1 and bool_and(driver_id = pg_temp.fixture_id('driver') and ended_at is null)
  from public.delivery_assignments where order_id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('manager can assign a second customer order',
  public.assign_delivery(pg_temp.fixture_id('other_order'), pg_temp.fixture_id('driver'), null) is not null
);

select pg_temp.as_user('driver');
select pg_temp.assert_check('driver can read the assigned vehicle through corrected RLS', (
  select count(*) = 1 from public.vehicles where id = pg_temp.fixture_id('vehicle')
));
select pg_temp.assert_check('driver cannot read another vehicle', (
  select count(*) = 0 from public.vehicles where id = pg_temp.fixture_id('other_vehicle')
));
select pg_temp.expect_error('driver cannot invoke manager assignment', format(
  'select public.assign_delivery(%L, %L, null)', pg_temp.fixture_id('order'), pg_temp.fixture_id('driver')
), 'Only a signed-in manager');
select pg_temp.expect_error('driver cannot publish GPS before pickup', format(
  'insert into public.delivery_locations (order_id,driver_id,latitude,longitude) values (%L,%L,16.79,96.15)',
  pg_temp.fixture_id('order'), pg_temp.fixture_id('driver')
), 'row-level security');
select pg_temp.expect_error('driver cannot collect COD before pickup', format(
  'insert into public.cod_payments (order_id,collected_by,amount,payment_method) values (%L,%L,12000,''cash'')',
  pg_temp.fixture_id('order'), pg_temp.fixture_id('driver')
), 'pending amount for an active delivery');
update public.delivery_orders set status = 'accepted'
where id in (pg_temp.fixture_id('order'), pg_temp.fixture_id('other_order'));
select pg_temp.assert_check('driver can accept assigned deliveries', (
  select count(*) = 2 from public.delivery_orders
  where id in (pg_temp.fixture_id('order'), pg_temp.fixture_id('other_order')) and status = 'accepted'
));
update public.delivery_orders set status = 'picked_up'
where id in (pg_temp.fixture_id('order'), pg_temp.fixture_id('other_order'));
select pg_temp.assert_check('driver can confirm parcel pickup', (
  select count(*) = 2 from public.delivery_orders
  where id in (pg_temp.fixture_id('order'), pg_temp.fixture_id('other_order')) and status = 'picked_up'
));

-- The view must discard pre-assignment points even if their insertion is trusted.
reset role;
insert into public.delivery_assignments (order_id, driver_id, assigned_by, assigned_at, ended_at)
values (pg_temp.fixture_id('order'), pg_temp.fixture_id('off_duty_driver'), pg_temp.fixture_id('manager'),
  now() - interval '2 days', now() - interval '1 day');
insert into public.delivery_locations (order_id, driver_id, latitude, longitude, recorded_at)
values (pg_temp.fixture_id('order'), pg_temp.fixture_id('driver'), 10, 10, now() - interval '1 day'),
  (pg_temp.fixture_id('order'), pg_temp.fixture_id('off_duty_driver'), 11, 11, now() + interval '2 seconds');
set local role authenticated;
select pg_temp.as_user('driver');
select pg_temp.assert_check('latest point view excludes earlier and ended rider assignment points', (
  select count(*) = 0 from public.latest_delivery_locations where order_id = pg_temp.fixture_id('order')
));
insert into public.delivery_locations (order_id, driver_id, latitude, longitude, recorded_at)
values (pg_temp.fixture_id('order'), pg_temp.fixture_id('driver'), 16.7900, 96.1500, now()),
  (pg_temp.fixture_id('order'), pg_temp.fixture_id('driver'), 16.8000, 96.1510, now() + interval '1 second'),
  (pg_temp.fixture_id('other_order'), pg_temp.fixture_id('driver'), 16.8100, 96.1520, now());
select pg_temp.assert_check('driver can publish GPS after pickup', (
  select count(*) = 2 from public.latest_delivery_locations
  where order_id in (pg_temp.fixture_id('order'), pg_temp.fixture_id('other_order'))
));
select pg_temp.assert_check('location updates produce a route-aware ETA', (
  select estimated_delivery_at is not null
    and route_progress_percent is not null
    and eta_confidence = 'high'
    and eta_updated_at is not null
  from public.delivery_orders where id = pg_temp.fixture_id('order')
));
insert into public.road_reports (
  id, driver_id, order_id, category, severity, description, latitude, longitude
)
values (
  pg_temp.fixture_id('road_report'), pg_temp.fixture_id('driver'), pg_temp.fixture_id('order'),
  'congestion', 'high', 'Heavy traffic near the destination', 16.8170, 96.1560
);
select pg_temp.assert_check('driver can submit pending road knowledge for an assigned order', (
  select status = 'pending' and reviewed_by is null
  from public.road_reports where id = pg_temp.fixture_id('road_report')
));

select pg_temp.as_user('customer');
select pg_temp.assert_check('own customer sees live raw location rows', (
  select count(*) = 4 from public.delivery_locations where order_id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('own customer sees exactly the latest current-assignment point', (
  select count(*) = 1 and bool_and(latitude = 16.8000 and longitude = 96.1510)
  from public.latest_delivery_locations where order_id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('customer cannot see another customer order', (
  select count(*) = 0 from public.delivery_orders where id = pg_temp.fixture_id('other_order')
));
select pg_temp.assert_check('invoker view cannot expose another customer location', (
  select count(*) = 0 from public.latest_delivery_locations where order_id = pg_temp.fixture_id('other_order')
));
select pg_temp.assert_check('customer cannot read rider road reports', (
  select count(*) = 0 from public.road_reports where id = pg_temp.fixture_id('road_report')
));
select pg_temp.as_user('other_customer');
select pg_temp.assert_check('other customer sees no first-customer raw GPS', (
  select count(*) = 0 from public.delivery_locations where order_id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('other customer sees no first-customer latest GPS', (
  select count(*) = 0 from public.latest_delivery_locations where order_id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('other customer sees their own latest GPS only', (
  select count(*) = 1 and bool_and(order_id = pg_temp.fixture_id('other_order'))
  from public.latest_delivery_locations
));

select pg_temp.as_user('driver');
select pg_temp.expect_error('incorrect COD amount is rejected', format(
  'insert into public.cod_payments (order_id,collected_by,amount,payment_method) values (%L,%L,1,''cash'')',
  pg_temp.fixture_id('order'), pg_temp.fixture_id('driver')
), 'pending amount for an active delivery');
insert into public.cod_payments (order_id, collected_by, amount, payment_method)
values (pg_temp.fixture_id('order'), pg_temp.fixture_id('driver'), 12000, 'cash');
select pg_temp.assert_check('valid COD collection updates order payment status', (
  select cod_status = 'collected' from public.delivery_orders where id = pg_temp.fixture_id('order')
));
select pg_temp.expect_error('driver cannot regress delivery status after pickup', format(
  'update public.delivery_orders set status = ''assigned'' where id = %L', pg_temp.fixture_id('order')
), 'Invalid delivery status transition');

select pg_temp.as_user('manager');
select pg_temp.expect_error('manager assignment RPC cannot reset a picked-up parcel', format(
  'select public.assign_delivery(%L,%L,%L)', pg_temp.fixture_id('order'),
  pg_temp.fixture_id('driver'), pg_temp.fixture_id('vehicle')
), 'before pickup or after a failed delivery');
select pg_temp.assert_check('post-pickup reassignment preserves parcel and assignment state', (
  select delivery_order.status = 'picked_up' and assignment.driver_id = pg_temp.fixture_id('driver')
  from public.delivery_orders as delivery_order
  join public.delivery_assignments as assignment on assignment.order_id = delivery_order.id and assignment.ended_at is null
  where delivery_order.id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('manager latest-location view includes both customer deliveries', (
  select count(*) = 2 from public.latest_delivery_locations
  where order_id in (pg_temp.fixture_id('order'), pg_temp.fixture_id('other_order'))
));
select pg_temp.assert_check('manager can verify submitted road knowledge',
  public.review_road_report(pg_temp.fixture_id('road_report'), 'verified') = pg_temp.fixture_id('road_report')
);
select pg_temp.assert_check('verified road knowledge affects the delivery prediction', (
  select traffic_delay_minutes = 14 and eta_updated_at is not null
  from public.delivery_orders where id = pg_temp.fixture_id('order')
));

select pg_temp.as_user('driver');
update public.delivery_orders set status = 'in_transit' where id = pg_temp.fixture_id('order');
update public.delivery_orders set status = 'delivered' where id = pg_temp.fixture_id('order');
select pg_temp.assert_check('driver can complete delivery and delivered_at is recorded', (
  select status = 'delivered' and delivered_at is not null from public.delivery_orders where id = pg_temp.fixture_id('order')
));
select pg_temp.expect_error('GPS writes stop after delivery completion', format(
  'insert into public.delivery_locations (order_id,driver_id,latitude,longitude) values (%L,%L,16.81,96.16)',
  pg_temp.fixture_id('order'), pg_temp.fixture_id('driver')
), 'row-level security');

select pg_temp.as_user('customer');
select pg_temp.assert_check('customer retains final delivery and COD status', (
  select status = 'delivered' and cod_status = 'collected'
  from public.delivery_orders where id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('raw customer location access ends at delivery completion', (
  select count(*) = 0 from public.delivery_locations where order_id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('invoker view customer location access ends at delivery completion', (
  select count(*) = 0 from public.latest_delivery_locations where order_id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('customer can read complete delivery status history', (
  select array_agg(status order by id) = array['pending','assigned','accepted','picked_up','in_transit','delivered']::text[]
  from public.delivery_status_events where order_id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('customer cannot read another delivery status history', (
  select count(*) = 0 from public.delivery_status_events where order_id = pg_temp.fixture_id('other_order')
));

-- ---------------------------------------------------------------------------
-- Dispatch reference data and order logistics (multi-truck planning, M1)
-- ---------------------------------------------------------------------------

-- Parser vectors (trusted role). Keep identical to tests/dispatch-parcel-description.test.mjs.
reset role;
select pg_temp.assert_check('parser: medium size, afternoon today', (
  select parsed.parcel_size = 'medium' and not parsed.fragile
    and parsed.window_label = 'Afternoon'
    and parsed.window_start = '2026-10-21T05:30:00Z'::timestamptz
    and parsed.window_end = '2026-10-21T10:30:00Z'::timestamptz
  from private.parse_parcel_description(
    'Electronics, medium size · Pickup today, afternoon', '2026-10-21T04:00:00Z'::timestamptz
  ) as parsed
));
select pg_temp.assert_check('parser: fragile large tomorrow morning', (
  select parsed.parcel_size = 'large' and parsed.fragile
    and parsed.window_label = 'Morning'
    and parsed.window_start = '2026-10-22T01:30:00Z'::timestamptz
    and parsed.window_end = '2026-10-22T05:30:00Z'::timestamptz
  from private.parse_parcel_description(
    'Other, large size, fragile · glass shelf · Pickup tomorrow, morning · Note: gate code 12',
    '2026-10-21T04:00:00Z'::timestamptz
  ) as parsed
));
select pg_temp.assert_check('parser: day is relative to Asia/Yangon, not UTC', (
  select parsed.parcel_size = 'small' and parsed.window_label = 'Evening'
    and parsed.window_start = '2026-10-22T10:30:00Z'::timestamptz
    and parsed.window_end = '2026-10-22T13:30:00Z'::timestamptz
  from private.parse_parcel_description(
    'Food, small size · Pickup today, evening', '2026-10-21T23:00:00Z'::timestamptz
  ) as parsed
));
select pg_temp.assert_check('parser: free text yields nothing', (
  select parsed.parcel_size is null and not parsed.fragile and parsed.window_start is null
  from private.parse_parcel_description('two boxes of tea', '2026-10-21T04:00:00Z'::timestamptz) as parsed
));

select pg_temp.assert_check('the Mingalardone depot ships unverified with no coordinates', (
  select location_status = 'unverified' and latitude is null and longitude is null
  from public.depots where code = 'MGD'
));
set local role authenticated;

select pg_temp.as_user('manager');
select pg_temp.assert_check('orders get a logistics row from the insert trigger', (
  select count(*) = 1 from public.delivery_order_logistics where order_id = pg_temp.fixture_id('order')
));
select pg_temp.assert_check('a plain description leaves size, window and weight unset', (
  select parcel_size is null and pickup_window_start is null and weight_kg is null
    and origin_kind = 'door'
  from public.delivery_order_logistics where order_id = pg_temp.fixture_id('order')
));

-- Inserted directly (not through create_customer_pickup_order) so these checks
-- do not depend on that RPC; the trigger sees the same packed description.
select pg_temp.as_user('manager');
insert into public.delivery_orders (
  id, customer_id, created_by, pickup_address, delivery_address,
  pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
  recipient_name, parcel_description
)
values (
  pg_temp.fixture_id('packed_order'), pg_temp.fixture_id('customer'), pg_temp.fixture_id('manager'),
  'Logistics pickup', 'Logistics destination', 16.7810, 96.1450, 16.8210, 96.1580,
  'Logistics recipient', 'Electronics, medium size, fragile · Pickup tomorrow, morning'
);
select pg_temp.assert_check('a packed pickup description is parsed into logistics', (
  select logistics.parcel_size = 'medium' and logistics.size_source = 'parsed_description'
    and logistics.fragile and logistics.window_label = 'Morning'
    and logistics.window_source = 'parsed_description'
    and logistics.pickup_window_start =
      ((((now() at time zone 'Asia/Yangon')::date + 1) + interval '8 hours') at time zone 'Asia/Yangon')
    and logistics.pickup_window_end =
      ((((now() at time zone 'Asia/Yangon')::date + 1) + interval '12 hours') at time zone 'Asia/Yangon')
  from public.delivery_order_logistics as logistics
  where logistics.order_id = pg_temp.fixture_id('packed_order')
));

select pg_temp.as_user('customer');
select pg_temp.assert_check('customer reads logistics for own packed order', (
  select count(*) = 1 from public.delivery_order_logistics
  where order_id = pg_temp.fixture_id('packed_order')
));
select pg_temp.assert_check('customer reads logistics for own orders only', (
  select count(*) >= 1 from public.delivery_order_logistics
  where order_id = pg_temp.fixture_id('order')
) and (
  select count(*) = 0 from public.delivery_order_logistics
  where order_id = pg_temp.fixture_id('other_order')
));
select pg_temp.expect_error('customer cannot update logistics', format(
  'update public.delivery_order_logistics set weight_kg = 1, weight_source = %L where order_id = %L',
  'declared', pg_temp.fixture_id('order')
), 'permission denied');
select pg_temp.expect_error('customer cannot insert logistics', format(
  'insert into public.delivery_order_logistics (order_id) values (%L)', pg_temp.fixture_id('other_order')
), 'permission denied');
select pg_temp.assert_check('customer cannot read depots', (select count(*) = 0 from public.depots));
select pg_temp.expect_error('customer cannot set a depot location',
  format('select public.set_depot_location(%L, 16.9, 96.1, %L)', (select id from public.depots where code = 'MGD'), 'test source'),
  'Only managers');

select pg_temp.as_user('driver');
select pg_temp.assert_check('driver can read depots', (select count(*) >= 1 from public.depots));
select pg_temp.expect_error('driver cannot update logistics', format(
  'update public.delivery_order_logistics set weight_kg = 1, weight_source = %L where order_id = %L',
  'declared', pg_temp.fixture_id('order')
), 'permission denied');
select pg_temp.assert_check('driver sees no dispatch profiles', (select count(*) = 0 from public.vehicle_dispatch_profiles));
select pg_temp.assert_check('driver sees no hazard layers', (select count(*) = 0 from public.geo_hazard_layers));
select pg_temp.expect_error('driver cannot write dispatch profiles', format(
  'insert into public.vehicle_dispatch_profiles (vehicle_id) values (%L)', pg_temp.fixture_id('vehicle')
), 'row-level security');
select pg_temp.expect_error('driver cannot change order logistics through the RPC', format(
  'select public.set_order_logistics(%L, %L::jsonb, %L)', pg_temp.fixture_id('order'), '{"weight_kg": 3}', 'driver attempt'
), 'Only managers');

select pg_temp.as_user('manager');
select pg_temp.expect_error('depot cannot be verified without coordinates', format(
  'update public.depots set location_status = %L where code = %L', 'verified', 'MGD'
), 'permission denied|depots_verified_has_location');
select pg_temp.expect_error('depot location rejects invalid latitude',
  format('select public.set_depot_location(%L, 95, 96.1, %L)', (select id from public.depots where code = 'MGD'), 'test source'),
  'valid');
select pg_temp.expect_error('depot location requires a source',
  format('select public.set_depot_location(%L, 16.9, 96.1, %L)', (select id from public.depots where code = 'MGD'), ''),
  'source is required');
-- Fixture coordinates only; this transaction is rolled back.
select pg_temp.assert_check('manager can verify the depot pin', (
  select location_status = 'verified' and latitude = 16.9 and longitude = 96.15
    and verified_by = pg_temp.fixture_id('manager') and verified_at is not null
  from public.set_depot_location(
    (select id from public.depots where code = 'MGD'), 16.9, 96.15, 'workflow test fixture', null
  )
));
insert into public.delivery_orders (
  id, customer_id, created_by, pickup_address, delivery_address,
  pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
  recipient_name, parcel_weight_kg
)
values (
  pg_temp.fixture_id('pickup_order'), pg_temp.fixture_id('customer'), pg_temp.fixture_id('manager'),
  'At the depot', 'Somewhere else', 16.9005, 96.1503, 16.8178, 96.1566, 'Depot recipient', 4.5
);
select pg_temp.assert_check('a pickup within 150 m of a verified depot is a depot order', (
  select origin_kind = 'depot' and depot_id = (select id from public.depots where code = 'MGD')
  from public.delivery_order_logistics where order_id = pg_temp.fixture_id('pickup_order')
));
select pg_temp.assert_check('a legacy parcel weight is kept as declared', (
  select weight_kg = 4.5 and weight_source = 'declared'
  from public.delivery_order_logistics where order_id = pg_temp.fixture_id('pickup_order')
));
select pg_temp.assert_check('manager can correct logistics with a reason, recorded as declared', (
  select weight_kg = 12.5 and weight_source = 'declared' and parcel_size = 'large'
    and size_source = 'declared' and deadline_hard
  from public.set_order_logistics(
    pg_temp.fixture_id('pickup_order'),
    '{"weight_kg": 12.5, "parcel_size": "large", "deadline_hard": true}'::jsonb,
    'weighed at the counter'
  )
));
select pg_temp.expect_error('logistics patch rejects unknown fields', format(
  'select public.set_order_logistics(%L, %L::jsonb, %L)', pg_temp.fixture_id('order'), '{"quoted_price_mmk": 1}', 'try price'
), 'Unknown logistics field');
select pg_temp.expect_error('logistics patch requires a reason', format(
  'select public.set_order_logistics(%L, %L::jsonb, %L)', pg_temp.fixture_id('order'), '{"weight_kg": 3}', ''
), 'reason is required');
select pg_temp.expect_error('logistics rejects a window that ends before it starts', format(
  'select public.set_order_logistics(%L, %L::jsonb, %L)', pg_temp.fixture_id('order'),
  '{"pickup_window_start": "2026-10-22T10:00:00Z", "pickup_window_end": "2026-10-22T09:00:00Z"}', 'bad window'
), 'logistics_window_ordered');

insert into public.vehicle_dispatch_profiles (vehicle_id, capacity_m3, cost_per_km_mmk)
values (pg_temp.fixture_id('vehicle'), 2.5, 1000);
select pg_temp.assert_check('manager can manage dispatch profiles; cost defaults to assumed', (
  select cost_source = 'assumed' and speed_factor = 1
  from public.vehicle_dispatch_profiles where vehicle_id = pg_temp.fixture_id('vehicle')
));

reset role;
insert into public.geo_hazard_layers (kind, name, status, source_name, geojson)
values ('flood', 'fixture layer', 'active', 'workflow test fixture', '{"type":"FeatureCollection","features":[]}'::jsonb);
select pg_temp.expect_error('only one flood layer can be active', $sql$
  insert into public.geo_hazard_layers (kind, name, status, source_name, geojson)
  values ('flood', 'second', 'active', 'workflow test fixture', '{"type":"FeatureCollection","features":[]}'::jsonb)
$sql$, 'geo_hazard_layers_one_active_idx');
set local role authenticated;
select pg_temp.as_user('manager');
select pg_temp.assert_check('manager can read hazard layers', (select count(*) = 1 from public.geo_hazard_layers));
select pg_temp.as_user('customer');
select pg_temp.assert_check('customer cannot read hazard layers', (select count(*) = 0 from public.geo_hazard_layers));

-- ---------------------------------------------------------------------------
-- Dispatch plans: save, commit, discard (multi-truck planning, M2)
-- ---------------------------------------------------------------------------
reset role;
create temporary table plan_ids (name text primary key, id uuid) on commit drop;
grant select, insert on plan_ids to authenticated;

create function pg_temp.new_order(p_label text)
returns uuid language plpgsql security invoker
as $$
declare new_id uuid := gen_random_uuid();
begin
  insert into public.delivery_orders (
    id, customer_id, created_by, pickup_address, delivery_address,
    pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, recipient_name
  )
  values (
    new_id, pg_temp.fixture_id('customer'), pg_temp.fixture_id('manager'),
    'Plan pickup ' || p_label, 'Plan drop ' || p_label, 16.91, 96.15, 16.92, 96.16, 'Recipient ' || p_label
  );
  return new_id;
end;
$$;

create function pg_temp.plan_id(p_name text)
returns uuid language sql stable security invoker
as $$ select id from pg_temp.plan_ids where name = p_name $$;

create function pg_temp.today()
returns date language sql stable security invoker
as $$ select (now() at time zone 'Asia/Yangon')::date $$;

create function pg_temp.run_by_key(p_key text)
returns uuid language sql stable security invoker
as $$ select id from public.dispatch_runs where client_key = p_key::uuid $$;

-- Two assigned orders on one truck (a door order: pickup then delivery, and a
-- depot order: delivery only) plus one order left unassigned with a reason.
create function pg_temp.sample_plan(
  p_date date, p_driver uuid, p_peak numeric default 20, p_depot uuid default null
)
returns jsonb language sql stable security invoker
as $$
  select jsonb_build_object(
    'depot_id', coalesce(p_depot, (select id from public.depots where code = 'MGD')),
    'service_date', p_date, 'engine_version', 'workflow-test', 'seed', 1, 'iterations', 10,
    'stop_reason', 'converged', 'data_quality', 'straight_line', 'score_total', 123.4,
    'routes', jsonb_build_array(jsonb_build_object(
      'vehicle_id', pg_temp.fixture_id('vehicle'), 'driver_id', p_driver, 'display_order', 0,
      'planned_depart_at', now(), 'planned_return_at', now() + interval '3 hours',
      'peak_kg', p_peak, 'distance_km', 12.5, 'score_total', 100,
      'stops', jsonb_build_array(
        jsonb_build_object('order_id', pg_temp.plan_id('door'), 'stop_type', 'pickup', 'seq', 1,
          'address', 'Plan pickup door', 'latitude', 16.91, 'longitude', 96.15,
          'planned_arrival_at', now() + interval '30 minutes',
          'window_start_at', now(), 'window_end_at', now() + interval '4 hours'),
        jsonb_build_object('order_id', pg_temp.plan_id('door'), 'stop_type', 'delivery', 'seq', 2,
          'address', 'Plan drop door', 'latitude', 16.92, 'longitude', 96.16,
          'planned_arrival_at', now() + interval '60 minutes'),
        jsonb_build_object('order_id', pg_temp.plan_id('depot'), 'stop_type', 'delivery', 'seq', 3,
          'address', 'Plan drop depot', 'latitude', 16.93, 'longitude', 96.17,
          'planned_arrival_at', now() + interval '90 minutes')
      )
    )),
    'orders', jsonb_build_array(
      jsonb_build_object('order_id', pg_temp.plan_id('door'), 'disposition', 'assigned',
        'vehicle_id', pg_temp.fixture_id('vehicle'), 'origin_kind', 'door',
        'order_updated_at', (select updated_at from public.delivery_orders where id = pg_temp.plan_id('door')),
        'logistics_updated_at', (select updated_at from public.delivery_order_logistics where order_id = pg_temp.plan_id('door'))),
      jsonb_build_object('order_id', pg_temp.plan_id('depot'), 'disposition', 'assigned',
        'vehicle_id', pg_temp.fixture_id('vehicle'), 'origin_kind', 'depot',
        'order_updated_at', (select updated_at from public.delivery_orders where id = pg_temp.plan_id('depot')),
        'logistics_updated_at', (select updated_at from public.delivery_order_logistics where order_id = pg_temp.plan_id('depot'))),
      jsonb_build_object('order_id', pg_temp.plan_id('big'), 'disposition', 'unassigned',
        'unassigned_reason', 'exceeds_capacity_single', 'origin_kind', 'door',
        'unassigned_detail', jsonb_build_object('weight_kg', 5000),
        'order_updated_at', (select updated_at from public.delivery_orders where id = pg_temp.plan_id('big')),
        'logistics_updated_at', (select updated_at from public.delivery_order_logistics where order_id = pg_temp.plan_id('big')))
    ),
    'matrix', jsonb_build_object('nodes', '[]'::jsonb, 'duration_s', '[0,60,60,0]'::jsonb,
      'distance_m', '[0,500,500,0]'::jsonb, 'provider', 'test', 'profile', 'driving', 'elements_billed', 4)
  )
$$;

-- Trusted setup: a capacity for the fixture truck, an available driver, an unverified second depot.
update public.vehicles set capacity_kg = 100, status = 'available' where id = pg_temp.fixture_id('vehicle');
update public.driver_profiles set availability = 'available' where user_id = pg_temp.fixture_id('driver');
insert into public.depots (code, name) values ('T2', 'Unverified test depot');
set local role authenticated;
select pg_temp.as_user('manager');

insert into plan_ids (name, id) values
  ('door', pg_temp.new_order('door')), ('depot', pg_temp.new_order('depot')),
  ('big', pg_temp.new_order('big')), ('stale', pg_temp.new_order('stale'));

-- ---- save_dispatch_run
create temporary table plan_results (name text primary key, result jsonb);
grant select, insert on plan_results to authenticated;
insert into plan_results (name, result)
select 'save1', public.save_dispatch_run(pg_temp.sample_plan(pg_temp.today(), pg_temp.fixture_id('driver')), '00000000-0000-4000-8000-000000000001');
select pg_temp.assert_check('save stores a draft at revision 1', (
  select (result ->> 'saved')::boolean and result ->> 'status' = 'draft' and (result ->> 'revision')::int = 1
  from plan_results where name = 'save1'
));
select pg_temp.assert_check('save stores routes, stops, orders and the matrix', (
  select (select count(*) from public.dispatch_run_routes where run_id = r.id) = 1
    and (select count(*) from public.dispatch_run_stops where run_id = r.id) = 3
    and (select count(*) from public.dispatch_run_orders where run_id = r.id) = 3
    and (select count(*) from public.dispatch_run_matrices where run_id = r.id) = 1
    and (select unassigned_reason from public.dispatch_run_orders where run_id = r.id and order_id = pg_temp.plan_id('big')) = 'exceeds_capacity_single'
  from public.dispatch_runs r where r.id = pg_temp.run_by_key('00000000-0000-4000-8000-000000000001')
));
select pg_temp.assert_check('saving the same client key again is idempotent', (
  select (result ->> 'duplicate')::boolean and (result ->> 'saved')::boolean
  from (select public.save_dispatch_run(pg_temp.sample_plan(pg_temp.today(), pg_temp.fixture_id('driver')), '00000000-0000-4000-8000-000000000001') as result) as again
));
select pg_temp.assert_check('a second draft for the same depot and day is refused', (
  select not (result ->> 'saved')::boolean and result ->> 'reason' = 'draft_exists'
  from (select public.save_dispatch_run(pg_temp.sample_plan(pg_temp.today(), pg_temp.fixture_id('driver')), '00000000-0000-4000-8000-000000000002') as result) as second
));
select pg_temp.assert_check('an unverified depot cannot be planned against', (
  select not (result ->> 'saved')::boolean and result ->> 'reason' = 'depot_unverified'
  from (select public.save_dispatch_run(
    pg_temp.sample_plan(pg_temp.today(), pg_temp.fixture_id('driver'), 20, (select id from public.depots where code = 'T2')),
    '00000000-0000-4000-8000-000000000003') as result) as unverified
));
select pg_temp.expect_error('a door order without a pickup stop is rejected', format(
  'select public.save_dispatch_run(%L::jsonb, %L, true)',
  jsonb_set(pg_temp.sample_plan(pg_temp.today(), pg_temp.fixture_id('driver')), '{routes,0,stops}',
    (pg_temp.sample_plan(pg_temp.today(), pg_temp.fixture_id('driver')) -> 'routes' -> 0 -> 'stops') - 0)::text,
  '00000000-0000-4000-8000-000000000004'
), 'Invalid dispatch plan');
select pg_temp.expect_error('a planned load above the truck capacity is rejected', format(
  'select public.save_dispatch_run(%L::jsonb, %L, true)',
  pg_temp.sample_plan(pg_temp.today(), pg_temp.fixture_id('driver'), 500)::text,
  '00000000-0000-4000-8000-000000000005'
), 'planned load exceeds');
select pg_temp.assert_check('failed saves leave the original draft in place', (
  select count(*) = 1 from public.dispatch_runs where status = 'draft' and client_key = '00000000-0000-4000-8000-000000000001'
));
select pg_temp.assert_check('save wrote an audit row', (
  select count(*) = 1 from public.dispatch_run_edits
  where run_id = pg_temp.run_by_key('00000000-0000-4000-8000-000000000001') and edit_type = 'create'
));
select pg_temp.expect_error('plan audit rows cannot be edited',
  format('update public.dispatch_run_edits set reason = %L', 'tampered'), 'permission denied');
select pg_temp.expect_error('plan rows cannot be written directly',
  format('update public.dispatch_runs set status = %L', 'committed'), 'permission denied');

select pg_temp.as_user('customer');
select pg_temp.expect_error('customers cannot save plans', format(
  'select public.save_dispatch_run(%L::jsonb, %L)', '{}', '00000000-0000-4000-8000-000000000006'), 'Only managers');
select pg_temp.assert_check('customers see no plans', (select count(*) = 0 from public.dispatch_runs));
select pg_temp.as_user('driver');
select pg_temp.assert_check('drivers see no plans', (select count(*) = 0 from public.dispatch_run_stops));
select pg_temp.expect_error('drivers cannot commit plans', format(
  'select public.commit_dispatch_run(%L, 1, %L)',
  pg_temp.run_by_key('00000000-0000-4000-8000-000000000001'), '00000000-0000-4000-8000-0000000000a1'), 'Only managers');

-- ---- commit refusals leave everything untouched
select pg_temp.as_user('manager');
select pg_temp.assert_check('commit refuses a stale revision', (
  select not (result ->> 'committed')::boolean and result ->> 'reason' = 'revision_conflict'
  from (select public.commit_dispatch_run(
    pg_temp.run_by_key('00000000-0000-4000-8000-000000000001'), 99,
    '00000000-0000-4000-8000-0000000000a2') as result) as refused
));
insert into plan_results (name, result)
select 'nodriver', public.save_dispatch_run(pg_temp.sample_plan(pg_temp.today(), null), '00000000-0000-4000-8000-000000000007', true);
select pg_temp.assert_check('commit refuses a truck with no driver', (
  select not (result ->> 'committed')::boolean and result ->> 'reason' = 'routes_blocked'
    and result -> 'routes' -> 0 ->> 'problem' = 'missing_driver'
  from (select public.commit_dispatch_run(
    pg_temp.run_by_key('00000000-0000-4000-8000-000000000007'), 1,
    '00000000-0000-4000-8000-0000000000a3') as result) as refused
));
insert into plan_results (name, result)
select 'future', public.save_dispatch_run(pg_temp.sample_plan(pg_temp.today() + 1, pg_temp.fixture_id('driver')), '00000000-0000-4000-8000-000000000008', true);
select pg_temp.assert_check('commit refuses a plan for another day', (
  select not (result ->> 'committed')::boolean and result ->> 'reason' = 'future_date'
  from (select public.commit_dispatch_run(
    pg_temp.run_by_key('00000000-0000-4000-8000-000000000008'), 1,
    '00000000-0000-4000-8000-0000000000a4') as result) as refused
));
insert into plan_results (name, result)
select 'stale', public.save_dispatch_run(pg_temp.sample_plan(pg_temp.today(), pg_temp.fixture_id('driver')), '00000000-0000-4000-8000-000000000009', true);
update public.delivery_orders set status = 'cancelled' where id = pg_temp.plan_id('depot');
select pg_temp.assert_check('commit aborts when an order changed and names it', (
  select not (result ->> 'committed')::boolean and result ->> 'reason' = 'stale'
    and result -> 'stale_orders' -> 0 ->> 'order_id' = pg_temp.plan_id('depot')::text
    and result -> 'stale_orders' -> 0 ->> 'change' = 'status_changed'
  from (select public.commit_dispatch_run(
    pg_temp.run_by_key('00000000-0000-4000-8000-000000000009'), 1,
    '00000000-0000-4000-8000-0000000000a5') as result) as refused
));
select pg_temp.assert_check('an aborted commit writes nothing', (
  select count(*) = 0 from public.delivery_routes where dispatch_run_id is not null
) and (
  select count(*) = 0 from public.delivery_assignments where order_id = pg_temp.plan_id('door') and ended_at is null
) and (
  select status = 'pending' from public.delivery_orders where id = pg_temp.plan_id('door')
));

-- ---- commit with skip: the changed order drops out and the stops are renumbered
select pg_temp.assert_check('commit can skip changed orders and renumber the rest', (
  select (result ->> 'committed')::boolean and (result ->> 'partial')::boolean and (result ->> 'orders')::int = 1
  from (select public.commit_dispatch_run(
    pg_temp.run_by_key('00000000-0000-4000-8000-000000000009'), 1,
    '00000000-0000-4000-8000-0000000000a6', 'skip') as result) as skipped
));
select pg_temp.assert_check('skipped commit left gap-free sequences and the right stops', (
  select array_agg(sequence_number order by sequence_number) = array[1, 2]
    and array_agg(stop_type order by sequence_number) = array['pickup', 'delivery']
  from public.route_stops where route_id = (
    select id from public.delivery_routes where dispatch_run_id = pg_temp.run_by_key('00000000-0000-4000-8000-000000000009'))
));
select pg_temp.assert_check('skipped order is recorded as unassigned stale_order', (
  select disposition = 'unassigned' and unassigned_reason = 'stale_order'
  from public.dispatch_run_orders
  where run_id = pg_temp.run_by_key('00000000-0000-4000-8000-000000000009')
    and order_id = pg_temp.plan_id('depot')
));
select pg_temp.assert_check('commit made the door order assigned with a route-linked assignment', (
  select o.status = 'assigned' and a.route_id = r.id and r.status = 'planned' and r.service_date = pg_temp.today()
    and r.planned_return_at is not null and r.depot_id = (select id from public.depots where code = 'MGD')
  from public.delivery_orders o
  join public.delivery_assignments a on a.order_id = o.id and a.ended_at is null
  join public.delivery_routes r on r.id = a.route_id
  where o.id = pg_temp.plan_id('door')
));
select pg_temp.assert_check('commit purged the raw matrix and recorded the audit trail', (
  select (select count(*) from public.dispatch_run_matrices where run_id = r.id) = 0
    and (select count(*) from public.dispatch_run_edits where run_id = r.id and edit_type = 'commit') = 1
    and r.status = 'committed' and r.committed_by = pg_temp.fixture_id('manager')
  from public.dispatch_runs r where r.id = pg_temp.run_by_key('00000000-0000-4000-8000-000000000009')
));
select pg_temp.assert_check('committing again with the same key returns the stored result', (
  select (result ->> 'committed')::boolean and (result ->> 'duplicate')::boolean
    and jsonb_array_length(result -> 'routes') = 1
  from (select public.commit_dispatch_run(
    pg_temp.run_by_key('00000000-0000-4000-8000-000000000009'), 2,
    '00000000-0000-4000-8000-0000000000a6') as result) as again
));
select pg_temp.assert_check('committing with a different key reports already_committed', (
  select not (result ->> 'committed')::boolean and result ->> 'reason' = 'already_committed'
  from (select public.commit_dispatch_run(
    pg_temp.run_by_key('00000000-0000-4000-8000-000000000009'), 2,
    '00000000-0000-4000-8000-0000000000b0') as result) as other
));
select pg_temp.assert_check('a committed plan cannot be discarded', (
  select not (result ->> 'discarded')::boolean and result ->> 'reason' = 'not_draft'
  from (select public.discard_dispatch_run(
    pg_temp.run_by_key('00000000-0000-4000-8000-000000000009'), 'too late') as result) as refused
));

-- ---- driver view of the committed route and the stop guard
select pg_temp.as_user('driver');
select pg_temp.assert_check('the assigned driver reads the committed stops', (
  select count(*) = 2 from public.route_stops where dispatch_run_stop_id is not null
));
select pg_temp.expect_error('drivers cannot move a planned arrival', format(
  'update public.route_stops set planned_arrival_at = now() + interval %L where id = %L', '5 hours',
  (select id from public.route_stops where dispatch_run_stop_id is not null and sequence_number = 1)
), 'Drivers can only update route stop status');
select pg_temp.expect_error('drivers cannot rewrite the sequence of a planned stop', format(
  'update public.route_stops set sequence_number = 9 where id = %L',
  (select id from public.route_stops where dispatch_run_stop_id is not null and sequence_number = 1)
), 'Drivers can only update route stop status');
update public.route_stops set arrived_at = '2000-01-01T00:00:00Z'
where id = (select id from public.route_stops where dispatch_run_stop_id is not null and sequence_number = 1);
select pg_temp.assert_check('a client-supplied arrived_at is ignored', (
  select arrived_at is null from public.route_stops
  where dispatch_run_stop_id is not null and sequence_number = 1
));
update public.route_stops set status = 'arrived', arrived_at = '2000-01-01T00:00:00Z'
where id = (select id from public.route_stops where dispatch_run_stop_id is not null and sequence_number = 1);
select pg_temp.assert_check('arrived_at is stamped by the database on arrival', (
  select status = 'arrived' and arrived_at > now() - interval '1 minute'
  from public.route_stops where dispatch_run_stop_id is not null and sequence_number = 1
));

-- ---- single-order reassignment after commit skips the plan's pending stops
select pg_temp.as_user('manager');
update public.delivery_assignments set ended_at = now()
where order_id = pg_temp.plan_id('door') and ended_at is null;
select pg_temp.assert_check('ending a plan assignment skips that order''s pending stops', (
  select count(*) filter (where status = 'skipped') = 1 and count(*) filter (where status = 'arrived') = 1
  from public.route_stops where dispatch_run_stop_id is not null
));

-- ---- discard
insert into plan_results (name, result)
select 'discard', public.save_dispatch_run(pg_temp.sample_plan(pg_temp.today() + 2, pg_temp.fixture_id('driver')), '00000000-0000-4000-8000-00000000000a');
select pg_temp.expect_error('discard needs a reason', format(
  'select public.discard_dispatch_run(%L, %L)',
  pg_temp.run_by_key('00000000-0000-4000-8000-00000000000a'), ''), 'reason is required');
insert into plan_results (name, result)
select 'discarded', public.discard_dispatch_run(
  pg_temp.run_by_key('00000000-0000-4000-8000-00000000000a'), 'not needed');
select pg_temp.assert_check('a draft can be discarded and its matrix is purged', (
  select (result ->> 'discarded')::boolean from plan_results where name = 'discarded'
) and (
  select status = 'discarded' and discard_reason = 'not needed'
  from public.dispatch_runs where id = pg_temp.run_by_key('00000000-0000-4000-8000-00000000000a')
) and (
  select count(*) = 0 from public.dispatch_run_matrices
  where run_id = pg_temp.run_by_key('00000000-0000-4000-8000-00000000000a')
));
reset role;
select pg_temp.expect_error('synthetic plans can never be stored',
  'update public.dispatch_runs set synthetic = true', 'dispatch_runs_synthetic_check');
set local role authenticated;
select pg_temp.as_user('customer');

select count(*) as checks_passed, array_agg(name order by name) as verified_checks
from workflow_checks;
rollback;
