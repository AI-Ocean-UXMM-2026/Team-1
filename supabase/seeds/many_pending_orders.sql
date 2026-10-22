-- 24 pending orders spread over Yangon townships, to watch confirm + clustering.
-- Tracking codes use the DYN-SEED- prefix, so seeds/cleanup_dev_data.sql removes them.
begin;

with actors as (
  select
    (select id from public.profiles where role = 'customer' order by created_at, id limit 1) as customer_id
),
areas(n, area, lat, lng) as (
  values
    (1, 'Sanchaung', 16.8020, 96.1270), (2, 'Bahan', 16.8160, 96.1540),
    (3, 'Tamwe', 16.8060, 96.1760), (4, 'Insein', 16.8950, 96.0950),
    (5, 'Hlaing', 16.8450, 96.1230), (6, 'Thingangyun', 16.8300, 96.1950),
    (7, 'Dagon Seikkan', 16.8700, 96.2800), (8, 'Mingaladon', 16.9300, 96.1350),
    (9, 'South Okkalapa', 16.8450, 96.1950), (10, 'Kamayut', 16.8300, 96.1350),
    (11, 'Pabedan', 16.7790, 96.1560), (12, 'Hlaing Tharyar', 16.8700, 96.0400)
),
rows as (
  select a.n, a.area, a.lat, a.lng, v.k
  from areas a cross join generate_series(1, 2) as v(k)
)
insert into public.delivery_orders (
  customer_id, created_by, status, tracking_code,
  pickup_address, pickup_latitude, pickup_longitude, pickup_contact_name, pickup_contact_phone,
  delivery_address, delivery_latitude, delivery_longitude, recipient_name, recipient_phone,
  parcel_description, parcel_weight_kg, cod_amount, cod_status
)
select
  actors.customer_id, actors.customer_id, 'pending',
  'DYN-SEED-B' || lpad(((rows.n - 1) * 2 + rows.k)::text, 3, '0'),
  'No. ' || (10 + rows.n) || ', Pyay Road, Kamayut', 16.8460, 96.1300, 'Mya Mart', '+95 9 400 000 006',
  'No. ' || (rows.n * 7 + rows.k) || ', ' || rows.area || ' main road, ' || rows.area,
  rows.lat + (rows.k - 1.5) * 0.004, rows.lng + (rows.k - 1.5) * 0.004,
  'Customer ' || rows.area || ' ' || rows.k, '+95 9 400 100 ' || lpad(rows.n::text, 3, '0'),
  'Test parcel ' || rows.n || '-' || rows.k,
  round((0.5 + (rows.n % 5) * 1.5)::numeric, 1),
  case when rows.k = 2 then 5000 * rows.n else 0 end,
  case when rows.k = 2 then 'pending' else 'not_required' end
from rows cross join actors
where actors.customer_id is not null;

commit;
