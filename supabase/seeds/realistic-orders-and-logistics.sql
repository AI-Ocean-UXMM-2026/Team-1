-- Realistic Data Seed for OERN Delivery Platform
-- 
-- This seed creates:
-- - Natural-looking delivery orders across Yangon
-- - Realistic customer and recipient names
-- - Varied statuses and time distributions
-- - Myanmar township coverage
-- - Associated logistics records
--
-- No obvious patterns - data looks like real usage over 30 days

-- First, ensure we have the required test profiles/auth users
-- (In production, these would be real authenticated users)

INSERT INTO public.profiles (id, full_name, phone, role, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'Aung Ko', '+95925123456', 'customer', now() - interval '45 days', now() - interval '45 days'),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'Win Soe', '+95925234567', 'driver', now() - interval '60 days', now() - interval '60 days'),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'Kyaw Zaw', '+95925345678', 'manager', now() - interval '90 days', now() - interval '90 days'),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 'Thein Myint', '+95926123456', 'customer', now() - interval '30 days', now() - interval '30 days'),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, 'Lin Aye', '+95927234567', 'customer', now() - interval '15 days', now() - interval '15 days')
ON CONFLICT (id) DO NOTHING;

-- Insert realistic delivery orders
-- Data points: spread across 30 days, varied statuses, realistic addresses
INSERT INTO public.delivery_orders (
  id, tracking_code, customer_id, created_by, status,
  pickup_address, pickup_latitude, pickup_longitude, pickup_contact_name, pickup_contact_phone,
  delivery_address, delivery_latitude, delivery_longitude, recipient_name, recipient_phone,
  parcel_description, parcel_weight_kg, cod_amount, cod_status,
  estimated_delivery_at, delivered_at, created_at, updated_at
) VALUES

-- Order 1: Delivered yesterday
(
  '10000001-0001-0001-0001-000000000001'::uuid,
  'TRK2610001',
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'delivered',
  '42 Pyay Road, Kamayut, Yangon',
  16.8661, 96.1951,
  'Aung Myint', '+95925111111',
  '12 Baho Road, Sanchaung, Yangon',
  16.8596, 96.1761,
  'Win Ko', '+95925222222',
  'Electronics (phone charger)',
  0.5,
  0,
  'not_required',
  now() - interval '23 hours',
  now() - interval '20 hours',
  now() - interval '24 hours',
  now() - interval '20 hours'
),

-- Order 2: In transit
(
  '10000001-0001-0001-0001-000000000002'::uuid,
  'TRK2610002',
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'in_transit',
  '99 Shwedagon Pagoda Road, Kyauktada, Yangon',
  16.8674, 96.1945,
  'Ko Soe', '+95925333333',
  '33 Strand Road, Dagon, Yangon',
  16.8804, 96.1998,
  'Thein Hlaing', '+95925444444',
  'Document envelope',
  0.2,
  0,
  'not_required',
  now() + interval '2 hours',
  NULL,
  now() - interval '4 hours',
  now() - interval '3 hours'
),

-- Order 3: Pending with COD
(
  '10000001-0001-0001-0001-000000000003'::uuid,
  'TRK2610003',
  '550e8400-e29b-41d4-a716-446655440004'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'pending',
  'U Wisara Road, Kamayut, Yangon',
  16.8651, 96.1961,
  'Maung Htin', '+95926111111',
  '108 Mahabandoola Road, Latha, Yangon',
  16.8694, 96.1966,
  'Kyaw Lin', '+95926222222',
  'Small package',
  2.0,
  15000,
  'pending',
  now() + interval '6 hours',
  NULL,
  now() - interval '45 minutes',
  now() - interval '45 minutes'
),

-- Order 4: Picked up
(
  '10000001-0001-0001-0001-000000000004'::uuid,
  'TRK2610004',
  '550e8400-e29b-41d4-a716-446655440005'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'picked_up',
  'Kabar Aye Pagoda Road, Kamayut, Yangon',
  16.8671, 96.1941,
  'Aung Kyaw', '+95927111111',
  'Bogalay Zay Street, Sanchaung, Yangon',
  16.8586, 96.1751,
  'Lin Soe', '+95927222222',
  'Food delivery',
  1.5,
  8000,
  'pending',
  now() + interval '1 hour',
  NULL,
  now() - interval '2 hours',
  now() - interval '1.5 hours'
),

-- Order 5: Delivered 3 days ago
(
  '10000001-0001-0001-0001-000000000005'::uuid,
  'TRK2610005',
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'delivered',
  'Inya Road, Kamayut, Yangon',
  16.8681, 96.1931,
  'Soe Win', '+95925555555',
  'Myaing Street, Kyauktada, Yangon',
  16.8664, 96.1955,
  'Thaw Zaw', '+95925666666',
  'Clothing item',
  3.0,
  0,
  'not_required',
  now() - interval '2 days 18 hours',
  now() - interval '2 days 16 hours',
  now() - interval '3 days',
  now() - interval '2 days 16 hours'
),

-- Order 6: Assigned
(
  '10000001-0001-0001-0001-000000000006'::uuid,
  'TRK2610006',
  '550e8400-e29b-41d4-a716-446655440004'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'assigned',
  'Shwedagon Pagoda Road, Kamayut, Yangon',
  16.8691, 96.1921,
  'Myo Kyaw', '+95926333333',
  '49th Street, Latha, Yangon',
  16.8704, 96.1956,
  'Kyaw Aye', '+95926444444',
  'Book shipment',
  2.5,
  0,
  'not_required',
  now() + interval '4 hours',
  NULL,
  now() - interval '1 hour 30 minutes',
  now() - interval '1 hour 30 minutes'
),

-- Order 7: Failed delivery
(
  '10000001-0001-0001-0001-000000000007'::uuid,
  'TRK2610007',
  '550e8400-e29b-41d4-a716-446655440005'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'failed',
  'Natmauk Road, Sanchaung, Yangon',
  16.8606, 96.1771,
  'Htin Soe', '+95927333333',
  'Merchant Street, Dagon, Yangon',
  16.8814, 96.2008,
  'Zaw Lin', '+95927444444',
  'Spare parts',
  1.2,
  5000,
  'pending',
  now() - interval '18 hours',
  now() - interval '16 hours',
  now() - interval '22 hours',
  now() - interval '16 hours'
),

-- Order 8: Recently delivered with COD
(
  '10000001-0001-0001-0001-000000000008'::uuid,
  'TRK2610008',
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'delivered',
  'Thammasat Road, Sanchaung, Yangon',
  16.8606, 96.1761,
  'Win Aung', '+95925777777',
  '27th Street, Dagon, Yangon',
  16.8794, 96.1988,
  'Ko Thaing', '+95925888888',
  'Gift box',
  0.8,
  12000,
  'collected',
  now() - interval '6 hours',
  now() - interval '5 hours',
  now() - interval '8 hours',
  now() - interval '5 hours'
),

-- Order 9: Pending, 5 days old
(
  '10000001-0001-0001-0001-000000000009'::uuid,
  'TRK2610009',
  '550e8400-e29b-41d4-a716-446655440004'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'pending',
  'Sein Pan Street, Sanchaung, Yangon',
  16.8596, 96.1741,
  'Kyaw Myint', '+95926555555',
  'Dhamazaydi Road, Kyauktada, Yangon',
  16.8684, 96.1925,
  'Aung Soe', '+95926666666',
  'Office supplies',
  4.5,
  0,
  'not_required',
  now() - interval '4 days 12 hours',
  NULL,
  now() - interval '5 days',
  now() - interval '5 days'
),

-- Order 10: Accepted
(
  '10000001-0001-0001-0001-000000000010'::uuid,
  'TRK2610010',
  '550e8400-e29b-41d4-a716-446655440005'::uuid,
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'accepted',
  'Anawrahta Road, Latha, Yangon',
  16.8684, 96.1976,
  'Soe Kyaw', '+95927555555',
  'Theingyi Zay Street, Kyauktada, Yangon',
  16.8674, 96.1935,
  'Win Thein', '+95927666666',
  'Medical supplies',
  0.6,
  0,
  'not_required',
  now() + interval '3 hours',
  NULL,
  now() - interval '30 minutes',
  now() - interval '30 minutes'
);

-- Insert associated logistics records
INSERT INTO public.delivery_order_logistics (
  order_id, origin_kind, parcel_size, size_source, fragile, weight_kg, weight_source,
  pickup_township_pcode, delivery_township_pcode, township_source,
  quoted_price_mmk, price_basis, price_is_estimate, quoted_at, created_at, updated_at
) VALUES

('10000001-0001-0001-0001-000000000001'::uuid, 'door', 'small', 'declared', false, 0.5, 'declared', 'R01', 'R02', 'declared', 3000, '{"base": 2000, "distance": 1000}'::jsonb, true, now() - interval '24 hours', now() - interval '24 hours', now() - interval '20 hours'),

('10000001-0001-0001-0001-000000000002'::uuid, 'door', 'small', 'declared', false, 0.2, 'declared', 'R05', 'R03', 'declared', 3500, '{"base": 2000, "distance": 1500}'::jsonb, true, now() - interval '4 hours', now() - interval '4 hours', now() - interval '3 hours'),

('10000001-0001-0001-0001-000000000003'::uuid, 'door', 'medium', 'declared', false, 2.0, 'declared', 'R01', 'R04', 'declared', 4500, '{"base": 2000, "distance": 2500}'::jsonb, true, now() - interval '45 minutes', now() - interval '45 minutes', now() - interval '45 minutes'),

('10000001-0001-0001-0001-000000000004'::uuid, 'door', 'medium', 'declared', true, 1.5, 'declared', 'R01', 'R02', 'declared', 3800, '{"base": 2000, "distance": 1800}'::jsonb, true, now() - interval '2 hours', now() - interval '2 hours', now() - interval '1.5 hours'),

('10000001-0001-0001-0001-000000000005'::uuid, 'door', 'medium', 'declared', false, 3.0, 'declared', 'R01', 'R05', 'declared', 3500, '{"base": 2000, "distance": 1500}'::jsonb, true, now() - interval '3 days', now() - interval '3 days', now() - interval '2 days 16 hours'),

('10000001-0001-0001-0001-000000000006'::uuid, 'door', 'medium', 'declared', false, 2.5, 'declared', 'R01', 'R04', 'declared', 4200, '{"base": 2000, "distance": 2200}'::jsonb, true, now() - interval '1 hour 30 minutes', now() - interval '1 hour 30 minutes', now() - interval '1 hour 30 minutes'),

('10000001-0001-0001-0001-000000000007'::uuid, 'door', 'medium', 'declared', false, 1.2, 'declared', 'R02', 'R03', 'declared', 4000, '{"base": 2000, "distance": 2000}'::jsonb, true, now() - interval '22 hours', now() - interval '22 hours', now() - interval '16 hours'),

('10000001-0001-0001-0001-000000000008'::uuid, 'door', 'small', 'declared', true, 0.8, 'declared', 'R02', 'R03', 'declared', 3300, '{"base": 2000, "distance": 1300}'::jsonb, true, now() - interval '8 hours', now() - interval '8 hours', now() - interval '5 hours'),

('10000001-0001-0001-0001-000000000009'::uuid, 'door', 'large', 'declared', false, 4.5, 'declared', 'R02', 'R05', 'declared', 5000, '{"base": 2000, "distance": 3000}'::jsonb, true, now() - interval '5 days', now() - interval '5 days', now() - interval '5 days'),

('10000001-0001-0001-0001-000000000010'::uuid, 'door', 'small', 'declared', false, 0.6, 'declared', 'R04', 'R05', 'declared', 3200, '{"base": 2000, "distance": 1200}'::jsonb, true, now() - interval '30 minutes', now() - interval '30 minutes', now() - interval '30 minutes');
