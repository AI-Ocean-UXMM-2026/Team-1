-- Local/dev seed data for the Oern delivery platform.
--
-- Not applied automatically by this session — run it yourself with
-- `supabase db reset` (local Docker stack) or `psql "$DATABASE_URL" -f
-- supabase/seed.sql` against a dev database. Never run this against a
-- production project: it inserts auth.users rows with a shared demo
-- password and is meant for local development and screenshots only.
--
-- Every demo account uses the password: oern-demo-pass-123
--
-- auth.users is seeded directly (the standard way to seed Supabase Auth
-- locally); the on_auth_user_created_create_delivery_profile trigger then
-- creates the matching public.profiles row automatically, so this file
-- only updates role/phone afterwards instead of inserting into profiles.

begin;

-- ---------------------------------------------------------------- users --

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'manager@oern.app', crypt('oern-demo-pass-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Thandar Oo"}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'aung.rider@oern.app', crypt('oern-demo-pass-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Aung Kyaw"}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'su.rider@oern.app', crypt('oern-demo-pass-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Su Mon"}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'khin.customer@oern.app', crypt('oern-demo-pass-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Khin Zarchi"}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'ko.customer@oern.app', crypt('oern-demo-pass-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ko Thura"}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'shop.seller@oern.app', crypt('oern-demo-pass-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mya Mart"}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'care.support@oern.app', crypt('oern-demo-pass-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nilar Win"}', now(), now(), '', '')
on conflict (id) do nothing;

-- The trigger above only sets full_name + phone with role defaulting to
-- 'customer'; set the real role (and a phone number) for everyone else.
update public.profiles set role = 'manager', phone = '+95 9 400 000 001' where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set role = 'driver', phone = '+95 9 400 000 002' where id = '10000000-0000-0000-0000-000000000002';
update public.profiles set role = 'driver', phone = '+95 9 400 000 003' where id = '10000000-0000-0000-0000-000000000003';
update public.profiles set phone = '+95 9 400 000 004' where id = '10000000-0000-0000-0000-000000000004';
update public.profiles set phone = '+95 9 400 000 005' where id = '10000000-0000-0000-0000-000000000005';
update public.profiles set role = 'seller', phone = '+95 9 400 000 006' where id = '10000000-0000-0000-0000-000000000006';
update public.profiles set role = 'support', phone = '+95 9 400 000 007' where id = '10000000-0000-0000-0000-000000000007';

insert into public.driver_profiles (user_id, availability) values
  ('10000000-0000-0000-0000-000000000002', 'on_delivery'),
  ('10000000-0000-0000-0000-000000000003', 'available')
on conflict (user_id) do nothing;

-- ------------------------------------------------------------- vehicles --

insert into public.vehicles (
  id, vehicle_type, registration_number, make, model, capacity_kg, status,
  energy_source, fuel_level_percent, battery_level_percent,
  range_km_at_full, reserve_percent, odometer_km
) values
  ('20000000-0000-0000-0000-000000000001', 'motorcycle', 'YGN-1A-4821', 'Honda', 'Wave 110', 25, 'in_use', 'fuel', 62, null, 180, 15, 8420),
  ('20000000-0000-0000-0000-000000000002', 'e_bike', 'YGN-1B-7790', 'Yadea', 'G5', 18, 'available', 'electric', null, 81, 70, 15, 2140)
on conflict (id) do nothing;

-- --------------------------------------------------------------- routes --

insert into public.delivery_routes (id, driver_id, vehicle_id, status, planned_at, started_at, created_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'in_progress', now() - interval '2 hours', now() - interval '90 minutes', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'planned', now() + interval '1 hour', null, '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- orders --
-- A spread of statuses so every screen (customer, rider, manager) has
-- something to show: one pending, one assigned, one on the active route
-- picked up, one delivered with COD settled, one failed.

insert into public.delivery_orders (
  id, customer_id, created_by, status,
  pickup_address, pickup_latitude, pickup_longitude, pickup_contact_name, pickup_contact_phone,
  delivery_address, delivery_latitude, delivery_longitude, recipient_name, recipient_phone,
  parcel_description, parcel_weight_kg, cod_amount, cod_status,
  estimated_delivery_at, delivered_at, route_progress_percent, traffic_delay_minutes, eta_confidence
) values
  (
    '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000006', 'pending',
    'No. 12, Pyay Road, Kamayut', 16.8460, 96.1300, 'Mya Mart', '+95 9 400 000 006',
    'No. 88, Inya Road, Bahan', 16.8160, 96.1540, 'Khin Zarchi', '+95 9 400 000 004',
    'Phone case + screen protector', 0.3, 0, 'not_required',
    null, null, null, 0, null
  ),
  (
    '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006', 'assigned',
    'No. 5, Thiri Mingalar St, Insein', 16.9020, 96.0810, 'Mya Mart', '+95 9 400 000 006',
    'No. 40, U Wisara Road, Sanchaung', 16.8020, 96.1270, 'Ko Thura', '+95 9 400 000 005',
    'Shoes, size 42', 1.1, 25000, 'pending',
    now() + interval '2 hours', null, null, 0, 'medium'
  ),
  (
    '40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'in_transit',
    'No. 70, Bogyoke Aung San Road, Pabedan', 16.7730, 96.1570, 'Thandar Oo', '+95 9 400 000 001',
    'No. 21, Shwegondaing Road, Bahan', 16.8130, 96.1580, 'Khin Zarchi', '+95 9 400 000 004',
    'Birthday cake, keep upright', 2.0, 0, 'not_required',
    now() + interval '35 minutes', null, 62, 8, 'high'
  ),
  (
    '40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'delivered',
    'No. 3, Strand Road, Botahtaung', 16.7730, 96.1700, 'Thandar Oo', '+95 9 400 000 001',
    'No. 66, Kyaikkasan Road, Tamwe', 16.8060, 96.1760, 'Ko Thura', '+95 9 400 000 005',
    'Groceries box', 4.5, 18500, 'settled',
    now() - interval '3 hours', now() - interval '3 hours', 100, 0, 'high'
  ),
  (
    '40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000006', 'failed',
    'No. 9, Anawrahta Road, Lanmadaw', 16.7780, 96.1420, 'Mya Mart', '+95 9 400 000 006',
    'No. 15, Shukhinthar Road, North Okkalapa', 16.8710, 96.1960, 'Khin Zarchi', '+95 9 400 000 004',
    'Documents, signature required', 0.1, 0, 'not_required',
    now() - interval '1 hour', null, 100, 0, 'high'
  )
on conflict (id) do nothing;

-- ----------------------------------------------------------- assignments --
-- Order 3 is on the active route; orders 2 and 5 are assigned without an
-- active route (not yet started / already closed).

insert into public.delivery_assignments (id, order_id, driver_id, vehicle_id, route_id, assigned_by, assigned_at, ended_at) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '90 minutes', null),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', now() - interval '20 minutes', null),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', null, '10000000-0000-0000-0000-000000000001', now() - interval '4 hours', now() - interval '1 hour')
on conflict (id) do nothing;

-- ------------------------------------------------------------ route stops --

insert into public.route_stops (id, route_id, order_id, stop_type, sequence_number, address, latitude, longitude, status, completed_at) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'pickup', 1, 'No. 70, Bogyoke Aung San Road, Pabedan', 16.7730, 96.1570, 'completed', now() - interval '80 minutes'),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'delivery', 2, 'No. 21, Shwegondaing Road, Bahan', 16.8130, 96.1580, 'pending', null),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'pickup', 1, 'No. 5, Thiri Mingalar St, Insein', 16.9020, 96.0810, 'pending', null),
  ('60000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'delivery', 2, 'No. 40, U Wisara Road, Sanchaung', 16.8020, 96.1270, 'pending', null)
on conflict (id) do nothing;

-- ----------------------------------------------------------- status log --

insert into public.delivery_status_events (order_id, status, changed_by, note) values
  ('40000000-0000-0000-0000-000000000002', 'pending', '10000000-0000-0000-0000-000000000006', null),
  ('40000000-0000-0000-0000-000000000002', 'assigned', '10000000-0000-0000-0000-000000000001', 'Assigned to Su Mon on the Insein loop'),
  ('40000000-0000-0000-0000-000000000003', 'pending', '10000000-0000-0000-0000-000000000001', null),
  ('40000000-0000-0000-0000-000000000003', 'assigned', '10000000-0000-0000-0000-000000000001', null),
  ('40000000-0000-0000-0000-000000000003', 'accepted', '10000000-0000-0000-0000-000000000002', null),
  ('40000000-0000-0000-0000-000000000003', 'picked_up', '10000000-0000-0000-0000-000000000002', null),
  ('40000000-0000-0000-0000-000000000003', 'in_transit', '10000000-0000-0000-0000-000000000002', null),
  ('40000000-0000-0000-0000-000000000004', 'delivered', '10000000-0000-0000-0000-000000000002', 'Left with building security, signature on file'),
  ('40000000-0000-0000-0000-000000000005', 'failed', '10000000-0000-0000-0000-000000000002', 'Recipient unreachable after two attempts');

-- --------------------------------------------------------------- payments --

insert into public.cod_payments (order_id, amount, payment_method, status, collected_by, collected_at, settled_at) values
  ('40000000-0000-0000-0000-000000000004', 18500, 'cash', 'settled', '10000000-0000-0000-0000-000000000002', now() - interval '3 hours', now() - interval '2 hours')
on conflict (order_id) do nothing;

-- ----------------------------------------------------------- road report --

insert into public.road_reports (driver_id, order_id, category, severity, description, latitude, longitude, status, reviewed_by, reviewed_at) values
  ('10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', 'congestion', 'medium', 'Heavy traffic on Shwegondaing Road near the junction, add ~10 min', 16.8100, 96.1560, 'verified', '10000000-0000-0000-0000-000000000001', now() - interval '30 minutes');

commit;
