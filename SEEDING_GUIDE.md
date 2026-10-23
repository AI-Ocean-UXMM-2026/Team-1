# Realistic Data Seeding Guide

Generate natural-looking delivery data without obvious faker patterns.

---

## 🎯 What Gets Seeded

✅ **10 realistic delivery orders** across 30 days  
✅ **5 Myanmar customer profiles** with real names & phone formats  
✅ **Real Yangon township data** (Kamayut, Sanchaung, Dagon, Latha, Kyauktada)  
✅ **Varied order statuses**: pending, assigned, picked_up, in_transit, delivered, failed  
✅ **Realistic time spreads**: orders at business hours, varied delivery times  
✅ **Natural COD distribution**: ~40% of orders have COD amounts  
✅ **Associated logistics records** with pricing and weight data  

---

## 🚀 Quick Start

### Option 1: SQL Seed (Easiest - No TypeScript Setup)

1. **Open Supabase Studio**:
   ```
   https://app.supabase.com/project/[your-project-id]/editor
   ```

2. **Copy the SQL from**:
   ```
   supabase/seeds/realistic-orders-and-logistics.sql
   ```

3. **Paste into SQL Editor** and click "Run"

Done! Your data is seeded.

### Option 2: TypeScript Script (For CI/CD)

```bash
# Install dependencies (if not already done)
npm install ts-node typescript @types/node

# Run the seed script
npx ts-node scripts/seed-realistic-data.ts
```

**Requires environment variables**:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

---

## 📊 Data Features

### Realistic Addresses
Data uses **actual Yangon street names and townships**:
- Pyay Road, Kamayut
- Baho Road, Sanchaung
- Strand Road, Dagon
- Mahabandoola Road, Latha
- Shwedagon Pagoda Road, Kyauktada

### Natural Names
Generated from **real Myanmar name patterns**:
- First names: Aung, Win, Ko, Kyaw, Soe, etc.
- Last names: Ko, Myint, Zaw, Tun, Hlaing, etc.
- Result: "Aung Ko", "Win Soe", "Kyaw Zaw" (realistic)

### Myanmar Phone Numbers
Proper format: `+95[carrier][number]`
- Carriers: Telenor (25, 77-79), MPT (26), Ooredoo (27), Mytel (40-42)
- Example: `+95925123456` (valid Myanmar number)

### Time Distribution
- **Orders spread over 30 days** (not all today)
- **Business hours only** (8am-5pm) for creation times
- **Realistic delivery windows** (30-240 minutes after order)
- **Varied status lifetimes** (some pending for days, some delivered within hours)

### Varied Statuses
```
pending      (30%) - Orders waiting for assignment
assigned     (20%) - Driver assigned but not yet accepted
accepted     (15%) - Driver accepted, not yet picked up
picked_up    (10%) - Package picked up, in transit
in_transit   (10%) - On the way to delivery
delivered    (12%) - Successfully completed
failed       (3%)  - Delivery failed/rejected
```

### Natural COD Distribution
- ~40% of orders include COD amounts
- Amounts: 5,000 - 15,000 MMK (realistic range)
- Proper status tracking: `pending` → `collected` → `settled`

### Geographic Spreading
- Coordinates offset 2-5km from township centers
- Creates realistic pickup/delivery distance variations
- Prices adjust based on distance (base 2,000 + variable distance fee)

---

## 🔍 What You'll See

After seeding, when you visit http://localhost:3000/pickup:

```
Pickup Flow Shows:
1. Real addresses (not faker patterns like "123 Main St")
2. Real names (Myanmar naming conventions)
3. Realistic phone numbers (+95 country code)
4. Orders at natural times (not all at midnight)
5. Varied delivery statuses (not all "pending")
6. Cash on delivery amounts for some orders
7. Geographic variety across Yangon townships
```

---

## 🛠️ Customizing the Seed

### Add More Orders

In `realistic-orders-and-logistics.sql`, simply duplicate an INSERT block and modify:
```sql
INSERT INTO public.delivery_orders (...) VALUES (
  '10000001-0001-0001-0001-000000000011'::uuid,  -- Change UUID
  'TRK2610011',                                   -- Change tracking code
  ...
);
```

### Change Township Coverage

Edit `YANGON_AREAS` in TypeScript version:
```ts
const YANGON_AREAS = [
  { name: "Insein", pcode: "R06", lat: 16.8..., lon: 96.1... },
  // Add more townships
];
```

### Adjust Date Range

Change the offset in SQL:
```sql
now() - interval '5 days'  -- Change to different days ago
```

### Add Different Parcel Types

Add to `PARCEL_TYPES` array:
```ts
const PARCEL_TYPES = [
  "Document envelope",
  "Small package",
  "Custom item",  // Add here
];
```

---

## ✅ Verification

### Check Data Was Inserted

Open Supabase Studio and run:
```sql
SELECT COUNT(*) as order_count FROM public.delivery_orders;
SELECT COUNT(*) as logistics_count FROM public.delivery_order_logistics;
```

Expected: 10 orders, 10 logistics records

### View Sample Data

```sql
SELECT 
  tracking_code, 
  pickup_address, 
  delivery_address, 
  status, 
  cod_amount,
  created_at 
FROM public.delivery_orders 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Locations Map

If you have a map view in your app, you should see:
- Orders spread across 5 Yangon townships
- Varied pickup/delivery distances
- Natural geographic clusters

---

## 🚨 Troubleshooting

### Foreign Key Errors

If you get FK errors, ensure profiles exist first:
```sql
-- Check if profiles exist
SELECT * FROM public.profiles LIMIT 1;

-- If empty, create them (already in the seed script)
INSERT INTO public.profiles (id, full_name, phone, role, created_at) VALUES ...
```

### Duplicate Tracking Codes

If re-seeding and hitting unique constraint errors:
```sql
-- Clear existing data (WARNING: deletes all)
DELETE FROM public.delivery_order_logistics;
DELETE FROM public.delivery_orders;

-- Then re-run the seed
```

### Missing Service Areas

Ensure service_areas table is populated:
```sql
SELECT * FROM public.service_areas WHERE pcode IN ('R01', 'R02', 'R03', 'R04', 'R05');
```

If empty, they'll be referenced correctly but may need manual entry based on your service_areas setup.

---

## 🎨 Why This Approach?

### ❌ Avoid Obvious Faker Patterns
- Random first name + random last name → looks fake
- "123 Main Street" addresses → unrealistic
- All timestamps at midnight → suspicious
- Sequential IDs → obviously seeded

### ✅ Instead, Use Real Data Principles
- Real Myanmar naming conventions
- Actual Yangon street names
- Business-hour timestamps
- Geographic clusters
- Time-based variations
- Mixed statuses and outcomes

### Result
**Data looks like real production usage over the past month**

---

## 📝 Notes

- **UUIDs are fixed** in SQL seed (same every run) - good for reproducibility
- **Timestamps are relative** (`now() - interval`) - always current even if you reseed later
- **No auth.users integration** in this basic version - assumes profiles exist
- **Can be extended** with vehicles, drivers, assignments, routes

---

## 🔗 Next Steps

1. ✅ Seed the data using SQL or TypeScript
2. ✅ Verify in Supabase Studio
3. ✅ Test your app with real-looking data
4. ✅ Build features knowing you have varied statuses to work with
5. ✅ Use this same approach for production data validation

---

**Happy seeding!** 🌱
