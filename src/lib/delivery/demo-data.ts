import type {
  DeliveryOrder,
  DriverOption,
  StatusEvent,
  VehicleOption,
  WorkspaceData,
} from "@/lib/delivery/types";

const now = Date.UTC(2026, 9, 20, 5);
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const fromNow = (minutes: number) =>
  new Date(now + minutes * 60_000).toISOString();

export const DEMO_ORDERS: DeliveryOrder[] = [
  {
    id: "demo-order-4812",
    tracking_code: "OR-4812",
    customer_id: "demo-customer-may",
    customer_name: "May Thazin",
    status: "in_transit",
    pickup_address: "Lanmadaw, Yangon",
    delivery_address: "Bahan, near Inya Road",
    pickup_latitude: 16.7797,
    pickup_longitude: 96.1434,
    delivery_latitude: 16.8178,
    delivery_longitude: 96.1566,
    recipient_name: "May Thazin",
    recipient_phone: "+95 9 421 555 018",
    parcel_description: "Documents · small envelope",
    parcel_weight_kg: 0.4,
    cod_amount: 68_000,
    cod_status: "pending",
    estimated_delivery_at: fromNow(18),
    created_at: ago(54),
    driver_id: "demo-driver-aung",
    driver_name: "Aung Kyaw",
    driver_phone: "+95 9 421 555 222",
    vehicle_id: "demo-vehicle-1",
    vehicle_label: "YGN 4J-2186 · E-bike",
    latest_location: {
      latitude: 16.8008,
      longitude: 96.1497,
      accuracy_meters: 12,
      recorded_at: ago(1),
    },
  },
  {
    id: "demo-order-4813",
    tracking_code: "OR-4813",
    customer_id: "demo-customer-thu",
    customer_name: "Thu Zar Win",
    status: "picked_up",
    pickup_address: "Sanchaung, Yangon",
    delivery_address: "Kamayut, Yangon",
    pickup_latitude: 16.8054,
    pickup_longitude: 96.1328,
    delivery_latitude: 16.8246,
    delivery_longitude: 96.1348,
    recipient_name: "Thu Zar Win",
    recipient_phone: "+95 9 421 555 019",
    parcel_description: "Clothing · medium parcel",
    parcel_weight_kg: 1.8,
    cod_amount: 0,
    cod_status: "not_required",
    estimated_delivery_at: fromNow(35),
    created_at: ago(38),
    driver_id: "demo-driver-nilar",
    driver_name: "Nilar Htet",
    driver_phone: "+95 9 421 555 223",
    vehicle_id: "demo-vehicle-2",
    vehicle_label: "YGN 8F-1042 · Motorcycle",
    latest_location: {
      latitude: 16.8101,
      longitude: 96.1339,
      accuracy_meters: 16,
      recorded_at: ago(3),
    },
  },
  {
    id: "demo-order-4814",
    tracking_code: "OR-4814",
    customer_id: "demo-customer-khant",
    customer_name: "Khant Lin",
    status: "assigned",
    pickup_address: "Botahtaung, Yangon",
    delivery_address: "Tamwe, Yangon",
    pickup_latitude: 16.769,
    pickup_longitude: 96.1744,
    delivery_latitude: 16.799,
    delivery_longitude: 96.1836,
    recipient_name: "Khant Lin",
    recipient_phone: "+95 9 421 555 020",
    parcel_description: "Home goods · 2 parcels",
    parcel_weight_kg: 3.2,
    cod_amount: 125_000,
    cod_status: "pending",
    estimated_delivery_at: fromNow(72),
    created_at: ago(21),
    driver_id: "demo-driver-aung",
    driver_name: "Aung Kyaw",
    driver_phone: "+95 9 421 555 222",
    vehicle_id: "demo-vehicle-1",
    vehicle_label: "YGN 4J-2186 · E-bike",
    latest_location: null,
  },
  {
    id: "demo-order-4809",
    tracking_code: "OR-4809",
    customer_id: "demo-customer-nay",
    customer_name: "Nay Chi",
    status: "delivered",
    pickup_address: "Ahlone, Yangon",
    delivery_address: "Kyauktada, Yangon",
    pickup_latitude: 16.7916,
    pickup_longitude: 96.1313,
    delivery_latitude: 16.7747,
    delivery_longitude: 96.1581,
    recipient_name: "Nay Chi",
    recipient_phone: "+95 9 421 555 021",
    parcel_description: "Printed materials",
    parcel_weight_kg: 1.1,
    cod_amount: 32_000,
    cod_status: "collected",
    estimated_delivery_at: ago(64),
    created_at: ago(138),
    driver_id: "demo-driver-nilar",
    driver_name: "Nilar Htet",
    driver_phone: "+95 9 421 555 223",
    vehicle_id: "demo-vehicle-2",
    vehicle_label: "YGN 8F-1042 · Motorcycle",
    latest_location: null,
  },
];

export const DEMO_DRIVERS: DriverOption[] = [
  {
    id: "demo-driver-aung",
    full_name: "Aung Kyaw",
    phone: "+95 9 421 555 222",
    availability: "on_delivery",
  },
  {
    id: "demo-driver-nilar",
    full_name: "Nilar Htet",
    phone: "+95 9 421 555 223",
    availability: "on_delivery",
  },
  {
    id: "demo-driver-min",
    full_name: "Min Thant",
    phone: "+95 9 421 555 224",
    availability: "available",
  },
];

export const DEMO_CUSTOMERS = [
  {
    id: "demo-customer-may",
    full_name: "May Thazin",
    phone: "+95 9 421 555 018",
  },
  {
    id: "demo-customer-thu",
    full_name: "Thu Zar Win",
    phone: "+95 9 421 555 019",
  },
  {
    id: "demo-customer-khant",
    full_name: "Khant Lin",
    phone: "+95 9 421 555 020",
  },
  { id: "demo-customer-nay", full_name: "Nay Chi", phone: "+95 9 421 555 021" },
];

export const DEMO_VEHICLES: VehicleOption[] = [
  {
    id: "demo-vehicle-1",
    registration_number: "YGN 4J-2186",
    vehicle_type: "e_bike",
    status: "available",
  },
  {
    id: "demo-vehicle-2",
    registration_number: "YGN 8F-1042",
    vehicle_type: "motorcycle",
    status: "in_use",
  },
  {
    id: "demo-vehicle-3",
    registration_number: "YGN 3K-7780",
    vehicle_type: "motorcycle",
    status: "available",
  },
];

export const DEMO_STATUS_EVENTS: StatusEvent[] = [
  {
    id: 1,
    order_id: "demo-order-4812",
    status: "assigned",
    note: null,
    created_at: ago(48),
  },
  {
    id: 2,
    order_id: "demo-order-4812",
    status: "accepted",
    note: null,
    created_at: ago(41),
  },
  {
    id: 3,
    order_id: "demo-order-4812",
    status: "picked_up",
    note: "Parcel received from sender",
    created_at: ago(31),
  },
  {
    id: 4,
    order_id: "demo-order-4812",
    status: "in_transit",
    note: "On the way to the recipient",
    created_at: ago(26),
  },
  {
    id: 5,
    order_id: "demo-order-4813",
    status: "assigned",
    note: null,
    created_at: ago(29),
  },
  {
    id: 6,
    order_id: "demo-order-4813",
    status: "accepted",
    note: null,
    created_at: ago(15),
  },
  {
    id: 7,
    order_id: "demo-order-4813",
    status: "picked_up",
    note: "Parcel received from sender",
    created_at: ago(7),
  },
  {
    id: 8,
    order_id: "demo-order-4809",
    status: "delivered",
    note: "Received by Nay Chi",
    created_at: ago(64),
  },
];

export const DEMO_WORKSPACE: WorkspaceData = {
  orders: DEMO_ORDERS,
  customers: DEMO_CUSTOMERS,
  drivers: DEMO_DRIVERS,
  vehicles: DEMO_VEHICLES,
  statusEvents: DEMO_STATUS_EVENTS,
};

export function cloneDemoWorkspace(currentTime = Date.now()): WorkspaceData {
  const data = structuredClone(DEMO_WORKSPACE);
  const offset = currentTime - now;
  const shift = (value: string) =>
    new Date(Date.parse(value) + offset).toISOString();
  data.orders = data.orders.map((order) => ({
    ...order,
    created_at: shift(order.created_at),
    estimated_delivery_at: order.estimated_delivery_at
      ? shift(order.estimated_delivery_at)
      : null,
    latest_location: order.latest_location
      ? {
          ...order.latest_location,
          recorded_at: shift(order.latest_location.recorded_at),
        }
      : null,
  }));
  data.statusEvents = data.statusEvents.map((event) => ({
    ...event,
    created_at: shift(event.created_at),
  }));
  return data;
}
