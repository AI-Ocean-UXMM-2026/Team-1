-- Oern persistent development seed.
-- Run only against a development or preview Supabase project.
-- Auth users are intentionally not created here. Their profiles must already
-- exist and be assigned trusted roles by an administrator.

begin;

create temporary table oern_seed_accounts (
  manager_id uuid,
  customer_one_id uuid,
  customer_two_id uuid,
  driver_one_id uuid,
  driver_two_id uuid
) on commit drop;

insert into oern_seed_accounts
select
  (select id from public.profiles where role = 'manager' order by created_at, id limit 1),
  (select id from public.profiles where role = 'customer' order by created_at, id limit 1),
  (select id from public.profiles where role = 'customer' order by created_at, id offset 1 limit 1),
  (select p.id
   from public.profiles p
   join public.driver_profiles dp on dp.user_id = p.id
   where p.role = 'driver'
   order by p.created_at, p.id
   limit 1),
  coalesce(
    (select p.id
     from public.profiles p
     join public.driver_profiles dp on dp.user_id = p.id
     where p.role = 'driver'
     order by p.created_at, p.id
     offset 1 limit 1),
    (select p.id
     from public.profiles p
     join public.driver_profiles dp on dp.user_id = p.id
     where p.role = 'driver'
     order by p.created_at, p.id
     limit 1)
  );

do $$
declare
  account_count integer;
begin
  select count(*) into account_count
  from oern_seed_accounts
  where manager_id is not null
    and customer_one_id is not null
    and customer_two_id is not null
    and driver_one_id is not null
    and driver_two_id is not null;

  if account_count <> 1 then
    raise exception using
      message = 'Dynamic seed needs 1 manager, 2 customers, and at least 1 driver in public.profiles.',
      hint = 'Create the Auth users, confirm the signup trigger created profiles, assign manager/driver roles, then rerun this script.';
  end if;

  if not exists (
    select 1 from public.driver_profiles
    where user_id = (select driver_one_id from oern_seed_accounts)
  ) then
    raise exception using
      message = 'Dynamic seed needs at least one matching driver_profiles row.',
      hint = 'Insert driver_profiles rows for the driver Auth users, then rerun this script.';
  end if;
end $$;

create temporary table oern_seed_existing_routes (route_id uuid primary key) on commit drop;
insert into oern_seed_existing_routes
select distinct route_id
from public.delivery_assignments
where order_id in (select id from public.delivery_orders where tracking_code like 'DYN-SEED-%')
  and route_id is not null;

-- Delete only records owned by this seed. The stable tracking prefix and
-- registration prefix make reruns safe without touching unrelated data.
delete from public.delivery_notifications
where order_id in (
  select id from public.delivery_orders where tracking_code like 'DYN-SEED-%'
);
delete from public.road_reports
where order_id in (
  select id from public.delivery_orders where tracking_code like 'DYN-SEED-%'
);
delete from public.delivery_locations
where order_id in (
  select id from public.delivery_orders where tracking_code like 'DYN-SEED-%'
);
delete from public.cod_payments
where order_id in (
  select id from public.delivery_orders where tracking_code like 'DYN-SEED-%'
);
delete from public.route_stops
where order_id in (
  select id from public.delivery_orders where tracking_code like 'DYN-SEED-%'
);
delete from public.delivery_assignments
where order_id in (
  select id from public.delivery_orders where tracking_code like 'DYN-SEED-%'
);
delete from public.delivery_routes
where id in (select route_id from oern_seed_existing_routes);
delete from public.delivery_orders
where tracking_code like 'DYN-SEED-%';
delete from public.vehicles
where registration_number like 'DYN-SEED-%';

insert into public.vehicles (
  id, vehicle_type, registration_number, make, model, capacity_kg, status,
  fuel_level_percent, battery_level_percent
)
values
  (gen_random_uuid(), 'e_bike', 'DYN-SEED-E-BIKE', 'Seed Mobility', 'E1', 12, 'in_use', null, 78),
  (gen_random_uuid(), 'motorcycle', 'DYN-SEED-MOTO', 'Seed Motors', 'M1', 18, 'available', 64, null)
on conflict (registration_number) do update set
  status = excluded.status,
  fuel_level_percent = excluded.fuel_level_percent,
  battery_level_percent = excluded.battery_level_percent,
  updated_at = now();

create temporary table oern_seed_orders (
  tracking_code text primary key,
  order_id uuid not null,
  customer_id uuid not null
) on commit drop;

insert into public.delivery_orders (
  tracking_code, customer_id, created_by, pickup_address,
  pickup_latitude, pickup_longitude, delivery_address,
  delivery_latitude, delivery_longitude, recipient_name,
  recipient_phone, parcel_description, parcel_weight_kg,
  cod_amount, cod_status, estimated_delivery_at
)
select
  seed.tracking_code,
  seed.customer_id,
  accounts.manager_id,
  seed.pickup_address,
  seed.pickup_latitude,
  seed.pickup_longitude,
  seed.delivery_address,
  seed.delivery_latitude,
  seed.delivery_longitude,
  customer.full_name,
  customer.phone,
  seed.parcel_description,
  seed.parcel_weight_kg,
  seed.cod_amount,
  case when seed.cod_amount > 0 then 'pending' else 'not_required' end,
  now() + seed.eta_offset
from (
  values
    ('DYN-SEED-001', (select customer_one_id from oern_seed_accounts), 'Lanmadaw pickup', 16.779700::numeric, 96.143400::numeric, 'Bahan delivery', 16.817800::numeric, 96.156600::numeric, 'Documents', 0.4::numeric, 0::numeric, interval '2 hours'),
    ('DYN-SEED-002', (select customer_two_id from oern_seed_accounts), 'Sanchaung pickup', 16.805400::numeric, 96.132800::numeric, 'Kamayut delivery', 16.824600::numeric, 96.134800::numeric, 'Clothing', 1.8::numeric, 68000::numeric, interval '90 minutes'),
    ('DYN-SEED-003', (select customer_one_id from oern_seed_accounts), 'Botahtaung pickup', 16.769000::numeric, 96.174400::numeric, 'Tamwe delivery', 16.799000::numeric, 96.183600::numeric, 'Home goods', 3.2::numeric, 125000::numeric, interval '70 minutes'),
    ('DYN-SEED-004', (select customer_two_id from oern_seed_accounts), 'Ahlone pickup', 16.791600::numeric, 96.131300::numeric, 'Kyauktada delivery', 16.774700::numeric, 96.158100::numeric, 'Printed materials', 1.1::numeric, 32000::numeric, interval '35 minutes'),
    ('DYN-SEED-005', (select customer_one_id from oern_seed_accounts), 'Hlaing pickup', 16.842000::numeric, 96.121000::numeric, 'Mayangone delivery', 16.866000::numeric, 96.108000::numeric, 'Household parcel', 2.0::numeric, 45000::numeric, interval '25 minutes')
) as seed(tracking_code, customer_id, pickup_address, pickup_latitude, pickup_longitude, delivery_address, delivery_latitude, delivery_longitude, parcel_description, parcel_weight_kg, cod_amount, eta_offset)
join oern_seed_accounts accounts on true
join public.profiles customer on customer.id = seed.customer_id
returning tracking_code, id, customer_id
;

insert into oern_seed_orders
select tracking_code, id, customer_id
from public.delivery_orders
where tracking_code like 'DYN-SEED-%';

insert into public.delivery_routes (driver_id, vehicle_id, status, planned_at, created_by)
values (
  (select driver_one_id from oern_seed_accounts),
  (select id from public.vehicles where registration_number = 'DYN-SEED-E-BIKE'),
  'in_progress', now() - interval '20 minutes',
  (select manager_id from oern_seed_accounts)
);

create temporary table oern_seed_route as
select id as route_id
from public.delivery_routes
where created_by = (select manager_id from oern_seed_accounts)
  and driver_id = (select driver_one_id from oern_seed_accounts)
  and vehicle_id = (select id from public.vehicles where registration_number = 'DYN-SEED-E-BIKE')
order by created_at desc
limit 1;

insert into public.delivery_assignments (order_id, driver_id, vehicle_id, route_id, assigned_by, assigned_at, ended_at)
values
  ((select order_id from oern_seed_orders where tracking_code = 'DYN-SEED-002'), (select driver_two_id from oern_seed_accounts), (select id from public.vehicles where registration_number = 'DYN-SEED-MOTO'), null, (select manager_id from oern_seed_accounts), now() - interval '30 minutes', null),
  ((select order_id from oern_seed_orders where tracking_code = 'DYN-SEED-003'), (select driver_one_id from oern_seed_accounts), (select id from public.vehicles where registration_number = 'DYN-SEED-E-BIKE'), (select route_id from oern_seed_route), (select manager_id from oern_seed_accounts), now() - interval '45 minutes', null),
  ((select order_id from oern_seed_orders where tracking_code = 'DYN-SEED-004'), (select driver_one_id from oern_seed_accounts), (select id from public.vehicles where registration_number = 'DYN-SEED-E-BIKE'), (select route_id from oern_seed_route), (select manager_id from oern_seed_accounts), now() - interval '2 hours', null),
  ((select order_id from oern_seed_orders where tracking_code = 'DYN-SEED-005'), (select driver_two_id from oern_seed_accounts), (select id from public.vehicles where registration_number = 'DYN-SEED-MOTO'), null, (select manager_id from oern_seed_accounts), now() - interval '3 hours', now() - interval '1 hour');

insert into public.route_stops (route_id, order_id, stop_type, sequence_number, address, latitude, longitude, status)
select route_id, order_id, stop_type, sequence_number, address, latitude, longitude, status
from oern_seed_route,
  lateral (
    select id as order_id, 'pickup'::text as stop_type, 1 as sequence_number, pickup_address as address, pickup_latitude as latitude, pickup_longitude as longitude, 'completed'::text as status
    from public.delivery_orders where tracking_code = 'DYN-SEED-003'
    union all
    select id as order_id, 'delivery'::text, 2, delivery_address, delivery_latitude, delivery_longitude, 'pending'::text
    from public.delivery_orders where tracking_code = 'DYN-SEED-003'
  ) stops;

-- Advance records through the lifecycle so database triggers create realistic
-- status history without hard-coded event IDs.
update public.delivery_orders set status = 'assigned' where tracking_code in ('DYN-SEED-002', 'DYN-SEED-003', 'DYN-SEED-004', 'DYN-SEED-005');
update public.delivery_orders set status = 'accepted' where tracking_code in ('DYN-SEED-003', 'DYN-SEED-004', 'DYN-SEED-005');
update public.delivery_orders set status = 'picked_up' where tracking_code in ('DYN-SEED-004', 'DYN-SEED-005');
update public.delivery_orders set status = 'in_transit', route_progress_percent = 62, eta_confidence = 'high', eta_updated_at = now(), traffic_delay_minutes = 4 where tracking_code = 'DYN-SEED-004';
update public.delivery_orders set status = 'in_transit', route_progress_percent = 46, eta_confidence = 'medium', eta_updated_at = now(), traffic_delay_minutes = 0 where tracking_code = 'DYN-SEED-005';
update public.delivery_orders set status = 'delivered', route_progress_percent = 100, eta_confidence = 'high', eta_updated_at = now(), delivered_at = now() - interval '1 hour' where tracking_code = 'DYN-SEED-005';

insert into public.delivery_locations (order_id, driver_id, latitude, longitude, accuracy_meters, recorded_at)
values
  ((select order_id from oern_seed_orders where tracking_code = 'DYN-SEED-004'), (select driver_one_id from oern_seed_accounts), 16.800800, 96.149700, 14, now() - interval '2 minutes'),
  ((select order_id from oern_seed_orders where tracking_code = 'DYN-SEED-004'), (select driver_one_id from oern_seed_accounts), 16.805400, 96.151100, 12, now() - interval '1 minute');

insert into public.cod_payments (order_id, amount, payment_method, status, collected_by, collected_at, settled_at)
values (
  (select order_id from oern_seed_orders where tracking_code = 'DYN-SEED-005'),
  45000, 'cash', 'collected',
  (select driver_two_id from oern_seed_accounts), now() - interval '1 hour', null
);

insert into public.road_reports (driver_id, order_id, category, severity, description, latitude, longitude, status, reported_at, expires_at, reviewed_by, reviewed_at)
values (
  (select driver_one_id from oern_seed_accounts),
  (select order_id from oern_seed_orders where tracking_code = 'DYN-SEED-004'),
  'congestion', 'medium', 'Traffic is slow near the Inya Road junction.',
  16.811400, 96.154200, 'verified', now() - interval '10 minutes', now() + interval '5 hours',
  (select manager_id from oern_seed_accounts), now() - interval '8 minutes'
);

insert into public.delivery_notifications (order_id, recipient_id, notification_type, message, status)
select order_id, customer_id, 'status_update', 'Your seeded delivery is now on the way.', 'queued'
from oern_seed_orders
where tracking_code = 'DYN-SEED-004';

commit;
