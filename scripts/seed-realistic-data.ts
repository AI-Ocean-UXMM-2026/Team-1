/**
 * Realistic Data Seeding Script
 * 
 * Generates natural-looking delivery data that:
 * - Uses real Yangon addresses and place names
 * - Mimics actual business hours and behavior patterns
 * - Includes realistic time spreads and variations
 * - Avoids obvious seeding patterns (sequential IDs, repeated data, etc.)
 * - Respects Myanmar phone number formats
 * - Uses actual service areas and townships
 */

// Extend ImportMeta type to include Node.js specific properties
declare global {
  interface ImportMeta {
    main?: boolean;
  }
}

import { createClient } from "@supabase/supabase-js";

// Real Yangon townships and their approximate centers
const YANGON_AREAS = [
  {
    name: "Kamayut",
    pcode: "R01",
    lat: 16.8661,
    lon: 96.1951,
    addresses: [
      "42 Pyay Road",
      "U Wisara Road",
      "Kabar Aye Pagoda Road",
      "Inya Road",
      "Shwedagon Pagoda Road",
    ],
  },
  {
    name: "Sanchaung",
    pcode: "R02",
    lat: 16.8596,
    lon: 96.1761,
    addresses: [
      "12 Baho Road",
      "Natmauk Road",
      "Thammasat Road",
      "Bogalay Zay Street",
      "Sein Pan Street",
    ],
  },
  {
    name: "Dagon",
    pcode: "R03",
    lat: 16.8804,
    lon: 96.1998,
    addresses: [
      "33 Strand Road",
      "Bogyoke Aung San Street",
      "Merchant Street",
      "27th Street",
      "28th Street",
    ],
  },
  {
    name: "Latha",
    pcode: "R04",
    lat: 16.8694,
    lon: 96.1966,
    addresses: [
      "108 Mahabandoola Road",
      "49th Street",
      "50th Street",
      "Sule Pagoda Road",
      "Anawrahta Road",
    ],
  },
  {
    name: "Kyauktada",
    pcode: "R05",
    lat: 16.8674,
    lon: 96.1945,
    addresses: [
      "99 Shwedagon Pagoda Road",
      "Theingyi Zay Street",
      "Myaing Street",
      "Kyaikto Street",
      "Dhamazaydi Road",
    ],
  },
];

// Real names from Myanmar (first names + common surnames)
const FIRST_NAMES = [
  "Aung",
  "Maung",
  "Win",
  "Zaw",
  "Kyaw",
  "Aye",
  "Tun",
  "Lin",
  "Soe",
  "Thaung",
  "Ko",
  "Pyi",
  "Thein",
  "Htin",
  "Tin",
  "Myo",
  "Pyae",
  "Phyo",
  "Wai",
  "Than",
];

const LAST_NAMES = [
  "Soe",
  "Win",
  "Ko",
  "Myint",
  "Tun",
  "Htay",
  "Aung",
  "Aye",
  "Kyaw",
  "Zaw",
  "Thein",
  "Kyi",
  "Lwin",
  "Nyunt",
  "Hlaing",
];

// Business types and realistic parcel descriptions
const PARCEL_TYPES = [
  "Document envelope",
  "Small package",
  "Electronics (phone charger)",
  "Clothing item",
  "Food delivery",
  "Book shipment",
  "Gift box",
  "Office supplies",
  "Spare parts",
  "Medical supplies",
];

// Generate realistic Myanmar phone number
function generatePhoneNumber(): string {
  const prefixes = ["09", "95"];
  const carriers = [
    "25", // Telenor (leading)
    "77", // Telenor
    "78", // Telenor
    "79", // Telenor
    "26", // MPT
    "27", // Ooredoo
    "40", // Mytel
    "41", // Mytel
    "42", // Mytel
  ];
  const carrier = carriers[Math.floor(Math.random() * carriers.length)];
  const number = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  return `+95${carrier}${number}`;
}

// Generate realistic Myanmar name
function generateName(): string {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
}

// Random element from array
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Random integer in range
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate realistic coordinate offset (within 2-5km)
function offsetCoordinate(
  lat: number,
  lon: number,
  maxKm: number = 3
): [number, number] {
  const KM_TO_DEGREES = 1 / 111; // Approximate
  const offset = maxKm * KM_TO_DEGREES;
  return [
    lat + (Math.random() - 0.5) * offset,
    lon + (Math.random() - 0.5) * offset,
  ];
}

// Generate realistic time in business hours
function generateBusinessHourTime(date: Date): Date {
  const hour = randomInt(8, 17); // 8am - 5pm
  const minute = randomInt(0, 59);
  const newDate = new Date(date);
  newDate.setHours(hour, minute, 0);
  return newDate;
}

// Generate random status based on realistic distribution
function generateOrderStatus(): string {
  const rand = Math.random();
  if (rand < 0.3) return "pending"; // 30% still pending
  if (rand < 0.5) return "assigned"; // 20% assigned
  if (rand < 0.65) return "accepted"; // 15% accepted
  if (rand < 0.75) return "picked_up"; // 10% picked up
  if (rand < 0.85) return "in_transit"; // 10% in transit
  if (rand < 0.97) return "delivered"; // 12% delivered
  return "failed"; // 3% failed
}

// Main seeding function
async function seedRealisticData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("🌱 Starting realistic data seeding...\n");

  try {
    // 1. Create realistic profiles
    console.log("📝 Creating profiles...");
    const customerProfile = {
      id: crypto.randomUUID(),
      full_name: generateName(),
      phone: generatePhoneNumber(),
      role: "customer",
      created_at: new Date(Date.now() - randomInt(7, 90) * 24 * 60 * 60 * 1000),
    };

    const driverProfile = {
      id: crypto.randomUUID(),
      full_name: generateName(),
      phone: generatePhoneNumber(),
      role: "driver",
      created_at: new Date(Date.now() - randomInt(30, 180) * 24 * 60 * 60 * 1000),
    };

    const managerProfile = {
      id: crypto.randomUUID(),
      full_name: generateName(),
      phone: generatePhoneNumber(),
      role: "manager",
      created_at: new Date(Date.now() - randomInt(60, 365) * 24 * 60 * 60 * 1000),
    };

    // Insert profiles (note: in real scenario, would use auth.users first)
    // For now, we'll skip auth integration and focus on the order data

    // 2. Create realistic delivery orders
    console.log("📦 Creating delivery orders...");

    const orders = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 15; i++) {
      // Create orders spread over last 30 days
      let orderDate = new Date(today);
      orderDate.setDate(orderDate.getDate() - randomInt(0, 30));
      orderDate = generateBusinessHourTime(orderDate);

      const pickupArea = randomElement(YANGON_AREAS);
      const deliveryArea = randomElement(
        YANGON_AREAS.filter((a) => a.name !== pickupArea.name)
      );

      const [pickupLat, pickupLon] = offsetCoordinate(
        pickupArea.lat,
        pickupArea.lon
      );
      const [deliveryLat, deliveryLon] = offsetCoordinate(
        deliveryArea.lat,
        deliveryArea.lon
      );

      const status = generateOrderStatus();
      const codAmount = Math.random() > 0.7 ? randomInt(5000, 50000) : 0;

      orders.push({
        id: crypto.randomUUID(),
        tracking_code: `TRK${Date.now()}${i}`.substring(0, 20),
        customer_id: customerProfile.id,
        created_by: managerProfile.id,
        status,
        pickup_address: `${randomElement(pickupArea.addresses)}, ${pickupArea.name}, Yangon`,
        pickup_latitude: pickupLat,
        pickup_longitude: pickupLon,
        pickup_contact_name: generateName(),
        pickup_contact_phone: generatePhoneNumber(),
        delivery_address: `${randomElement(deliveryArea.addresses)}, ${deliveryArea.name}, Yangon`,
        delivery_latitude: deliveryLat,
        delivery_longitude: deliveryLon,
        recipient_name: generateName(),
        recipient_phone: generatePhoneNumber(),
        parcel_description: randomElement(PARCEL_TYPES),
        parcel_weight_kg: randomInt(0.5, 5),
        cod_amount: codAmount,
        cod_status: codAmount > 0 ? "pending" : "not_required",
        estimated_delivery_at: new Date(
          orderDate.getTime() + randomInt(30, 180) * 60 * 1000
        ),
        delivered_at:
          status === "delivered"
            ? new Date(
                orderDate.getTime() + randomInt(60, 240) * 60 * 1000
              )
            : null,
        created_at: orderDate,
        updated_at: orderDate,
      });
    }

    // 3. Create delivery logistics records
    console.log("🗺️  Creating delivery logistics...");

    const logistics = orders.map((order) => {
      const pickupArea = YANGON_AREAS.find(
        (a) => order.pickup_address.includes(a.name)
      );
      const deliveryArea = YANGON_AREAS.find(
        (a) => order.delivery_address.includes(a.name)
      );

      return {
        order_id: order.id,
        origin_kind: "door",
        parcel_size: randomElement(["small", "medium", "large"]),
        size_source: "declared",
        fragile: Math.random() > 0.85, // 15% fragile
        weight_kg: order.parcel_weight_kg,
        weight_source: "declared",
        pickup_township_pcode: pickupArea?.pcode,
        delivery_township_pcode: deliveryArea?.pcode,
        township_source: "declared",
        quoted_price_mmk: randomInt(2000, 8000),
        price_basis: { base: 2000, distance: randomInt(0, 5000) },
        price_is_estimate: true,
        quoted_at: order.created_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
      };
    });

    // 4. Insert data
    console.log("\n💾 Inserting data into database...");

    // Insert orders
    const { error: ordersError } = await supabase
      .from("delivery_orders")
      .insert(orders);
    if (ordersError) throw new Error(`Orders insert: ${ordersError.message}`);
    console.log(`✅ Inserted ${orders.length} delivery orders`);

    // Insert logistics
    const { error: logisticsError } = await supabase
      .from("delivery_order_logistics")
      .insert(logistics);
    if (logisticsError) throw new Error(`Logistics insert: ${logisticsError.message}`);
    console.log(`✅ Inserted ${logistics.length} logistics records`);

    console.log("\n✨ Seeding complete!");
    console.log(`\n📊 Summary:`);
    console.log(`  • ${orders.length} delivery orders`);
    console.log(`  • ${logistics.length} logistics records`);
    console.log(`  • Realistic Myanmar addresses and names`);
    console.log(`  • Natural distribution across time`);
    console.log(`  • Varied order statuses and COD amounts`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  seedRealisticData();
}

export { seedRealisticData };
