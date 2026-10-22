-- Remove only records created by supabase/seeds/dev_data.sql.
-- Run only against a development or preview Supabase project.

begin;

create temporary table oern_cleanup_routes (route_id uuid primary key) on commit drop;
insert into oern_cleanup_routes
select distinct route_id
from public.delivery_assignments
where order_id in (select id from public.delivery_orders where tracking_code like 'DYN-SEED-%')
  and route_id is not null;

delete from public.delivery_notifications
where order_id in (select id from public.delivery_orders where tracking_code like 'DYN-SEED-%');
delete from public.road_reports
where order_id in (select id from public.delivery_orders where tracking_code like 'DYN-SEED-%');
delete from public.delivery_locations
where order_id in (select id from public.delivery_orders where tracking_code like 'DYN-SEED-%');
delete from public.cod_payments
where order_id in (select id from public.delivery_orders where tracking_code like 'DYN-SEED-%');
delete from public.route_stops
where order_id in (select id from public.delivery_orders where tracking_code like 'DYN-SEED-%');
delete from public.delivery_assignments
where order_id in (select id from public.delivery_orders where tracking_code like 'DYN-SEED-%');
delete from public.delivery_routes
where id in (select route_id from oern_cleanup_routes);
delete from public.delivery_orders
where tracking_code like 'DYN-SEED-%';
delete from public.vehicles
where registration_number in ('E4B1-7K29', 'M7T3-4Q8X');

commit;
