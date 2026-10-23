# 🌱 Run This NOW - Realistic Data Seeding

The previous SQL failed because **profiles need auth users first**.

✅ **Fixed!** Here's the corrected approach.

---

## 🚀 Quick 2-Minute Setup (FIXED)

### Step 1: Go to Supabase Console
```
https://app.supabase.com/project/wmmvbfcnxivqouyfzelv/editor
```

### Step 2: Open SQL Editor
- Click **"SQL Editor"** in left sidebar
- Click **"+ New Query"**

### Step 3: Copy This SQL
```sql
-- Create Auth Users First
INSERT INTO auth.users (id, email, phone, created_at, updated_at, encrypted_password, raw_user_meta_data, raw_app_meta_data) 
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'aung.ko@example.com', '+95925123456', now() - interval '45 days', now() - interval '45 days', '', '{}', '{}'),
  ('550e8400-e29b-41d4-a716-446655440002', 'win.soe@example.com', '+95925234567', now() - interval '60 days', now() - interval '60 days', '', '{}', '{}'),
  ('550e8400-e29b-41d4-a716-446655440003', 'kyaw.zaw@example.com', '+95925345678', now() - interval '90 days', now() - interval '90 days', '', '{}', '{}'),
  ('550e8400-e29b-41d4-a716-446655440004', 'thein.myint@example.com', '+95926123456', now() - interval '30 days', now() - interval '30 days', '', '{}', '{}'),
  ('550e8400-e29b-41d4-a716-446655440005', 'lin.aye@example.com', '+95927234567', now() - interval '15 days', now() - interval '15 days', '', '{}', '{}')
ON CONFLICT (id) DO NOTHING;

-- Create Profiles
INSERT INTO public.profiles (id, full_name, phone, role, created_at, updated_at) 
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Aung Ko', '+95925123456', 'customer', now() - interval '45 days', now() - interval '45 days'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Win Soe', '+95925234567', 'driver', now() - interval '60 days', now() - interval '60 days'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Kyaw Zaw', '+95925345678', 'manager', now() - interval '90 days', now() - interval '90 days'),
  ('550e8400-e29b-41d4-a716-446655440004', 'Thein Myint', '+95926123456', 'customer', now() - interval '30 days', now() - interval '30 days'),
  ('550e8400-e29b-41d4-a716-446655440005', 'Lin Aye', '+95927234567', 'customer', now() - interval '15 days', now() - interval '15 days')
ON CONFLICT (id) DO NOTHING;

-- Create Delivery Orders
INSERT INTO public.delivery_orders (
  id, tracking_code, customer_id, created_by, status,
  pickup_address, pickup_latitude, pickup_longitude, pickup_contact_name, pickup_contact_phone,
  delivery_address, delivery_latitude, delivery_longitude, recipient_name, recipient_phone,
  parcel_description, parcel_weight_kg, cod_amount, cod_status,
  estimated_delivery_at, delivered_at, created_at, updated_at
) 
VALUES
  ('10000001-0001-0001-0001-000000000001', 'TRK2610001', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'delivered', '42 Pyay Road, Kamayut, Yangon', 16.8661, 96.1951, 'Aung Myint', '+95925111111', '12 Baho Road, Sanchaung, Yangon', 16.8596, 96.1761, 'Win Ko', '+95925222222', 'Electronics (phone charger)', 0.5, 0, 'not_required', now() - interval '23 hours', now() - interval '20 hours', now() - interval '24 hours', now() - interval '20 hours'),
  ('10000001-0001-0001-0001-000000000002', 'TRK2610002', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'in_transit', '99 Shwedagon Pagoda Road, Kyauktada, Yangon', 16.8674, 96.1945, 'Ko Soe', '+95925333333', '33 Strand Road, Dagon, Yangon', 16.8804, 96.1998, 'Thein Hlaing', '+95925444444', 'Document envelope', 0.2, 0, 'not_required', now() + interval '2 hours', NULL, now() - interval '4 hours', now() - interval '3 hours'),
  ('10000001-0001-0001-0001-000000000003', 'TRK2610003', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 'pending', 'U Wisara Road, Kamayut, Yangon', 16.8651, 96.1961, 'Maung Htin', '+95926111111', '108 Mahabandoola Road, Latha, Yangon', 16.8694, 96.1966, 'Kyaw Lin', '+95926222222', 'Small package', 2.0, 15000, 'pending', now() + interval '6 hours', NULL, now() - interval '45 minutes', now() - interval '45 minutes'),
  ('10000001-0001-0001-0001-000000000004', 'TRK2610004', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'picked_up', 'Kabar Aye Pagoda Road, Kamayut, Yangon', 16.8671, 96.1941, 'Aung Kyaw', '+95927111111', 'Bogalay Zay Street, Sanchaung, Yangon', 16.8586, 96.1751, 'Lin Soe', '+95927222222', 'Food delivery', 1.5, 8000, 'pending', now() + interval '1 hour', NULL, now() - interval '2 hours', now() - interval '1.5 hours'),
  ('10000001-0001-0001-0001-000000000005', 'TRK2610005', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'delivered', 'Inya Road, Kamayut, Yangon', 16.8681, 96.1931, 'Soe Win', '+95925555555', 'Myaing Street, Kyauktada, Yangon', 16.8664, 96.1955, 'Thaw Zaw', '+95925666666', 'Clothing item', 3.0, 0, 'not_required', now() - interval '2 days 18 hours', now() - interval '2 days 16 hours', now() - interval '3 days', now() - interval '2 days 16 hours')
ON CONFLICT (id) DO NOTHING;

-- Create Logistics
INSERT INTO public.delivery_order_logistics (
  order_id, origin_kind, parcel_size, size_source, fragile, weight_kg, weight_source,
  pickup_township_pcode, delivery_township_pcode, township_source,
  quoted_price_mmk, price_basis, price_is_estimate, quoted_at, created_at, updated_at
)
VALUES
  ('10000001-0001-0001-0001-000000000001', 'door', 'small', 'declared', false, 0.5, 'declared', 'R01', 'R02', 'declared', 3000, '{"base": 2000, "distance": 1000}'::jsonb, true, now() - interval '24 hours', now() - interval '24 hours', now() - interval '20 hours'),
  ('10000001-0001-0001-0001-000000000002', 'door', 'small', 'declared', false, 0.2, 'declared', 'R05', 'R03', 'declared', 3500, '{"base": 2000, "distance": 1500}'::jsonb, true, now() - interval '4 hours', now() - interval '4 hours', now() - interval '3 hours'),
  ('10000001-0001-0001-0001-000000000003', 'door', 'medium', 'declared', false, 2.0, 'declared', 'R01', 'R04', 'declared', 4500, '{"base": 2000, "distance": 2500}'::jsonb, true, now() - interval '45 minutes', now() - interval '45 minutes', now() - interval '45 minutes'),
  ('10000001-0001-0001-0001-000000000004', 'door', 'medium', 'declared', true, 1.5, 'declared', 'R01', 'R02', 'declared', 3800, '{"base": 2000, "distance": 1800}'::jsonb, true, now() - interval '2 hours', now() - interval '2 hours', now() - interval '1.5 hours'),
  ('10000001-0001-0001-0001-000000000005', 'door', 'medium', 'declared', false, 3.0, 'declared', 'R01', 'R05', 'declared', 3500, '{"base": 2000, "distance": 1500}'::jsonb, true, now() - interval '3 days', now() - interval '3 days', now() - interval '2 days 16 hours')
ON CONFLICT (order_id) DO NOTHING;
```

### Step 4: Run It
- Click **"Run"** button
- Wait for ✅ success

### Step 5: Verify (Optional)
```sql
SELECT count(*) as total_orders FROM public.delivery_orders WHERE tracking_code LIKE 'TRK261%';
-- Should show: 5
```

---

## ✅ What You Get

| Item | Count | Details |
|------|-------|---------|
| **Auth Users** | 5 | Test accounts |
| **Profiles** | 5 | 3 customers, 1 driver, 1 manager |
| **Orders** | 5 | Yangon addresses, mixed statuses |
| **Logistics** | 5 | Pricing, weights, townships |

---

## 📊 Order Details

```
✅ TRK2610001 - delivered (yesterday)
   From: 42 Pyay Road, Kamayut
   To: 12 Baho Road, Sanchaung
   No COD

✅ TRK2610002 - in_transit (right now)
   From: 99 Shwedagon Pagoda Road, Kyauktada
   To: 33 Strand Road, Dagon
   No COD

✅ TRK2610003 - pending
   From: U Wisara Road, Kamayut
   To: 108 Mahabandoola Road, Latha
   COD: MMK 15,000

✅ TRK2610004 - picked_up
   From: Kabar Aye Pagoda Road, Kamayut
   To: Bogalay Zay Street, Sanchaung
   COD: MMK 8,000

✅ TRK2610005 - delivered (3 days ago)
   From: Inya Road, Kamayut
   To: Myaing Street, Kyauktada
   No COD
```

---

## 🎯 Why This Works

✅ **Auth users created first** (fixes foreign key error)
✅ **Real Myanmar addresses** (not "123 Main St")
✅ **Real names** (Aung Ko, Win Soe, etc.)
✅ **Mixed statuses** (not all "pending")
✅ **Natural timestamps** (spread across 3 days)
✅ **Realistic pricing** (3000-4500 MMK)
✅ **COD on some orders** (realistic distribution)

---

## 🚨 If It Still Fails

### "duplicate key value" error
You already ran it. To re-seed:
```sql
DELETE FROM public.delivery_order_logistics;
DELETE FROM public.delivery_orders;
DELETE FROM public.profiles WHERE id::text LIKE '550e8400%';
DELETE FROM auth.users WHERE email LIKE '%.example.com';
```
Then run the seed again.

### "permission denied" error
You need admin access. Go to:
- Supabase Console (not API)
- Make sure you're in SQL Editor (not GraphQL)
- Check you're on the right project

### "column does not exist"
Run database migrations:
```bash
# In terminal
supabase db push
```

---

## ✨ Done!

Your data is seeded! 

Now go to http://localhost:3000/pickup and you should see real delivery orders with:
- ✅ Real Yangon addresses
- ✅ Myanmar names
- ✅ Mixed delivery statuses
- ✅ Realistic timestamps

🎉 No more faker patterns - looks like real production data!
