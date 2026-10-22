import type { RouteSession } from "@/lib/delivery/driver-route";
import type {
  DeliveryOrder,
  DeliveryStatus,
  RouteStop,
  VehicleOption,
  WorkspaceData,
} from "@/lib/delivery/types";

/*
 * Development-only preview of the driver flow. Nothing here touches Supabase:
 * it builds a labelled sample route for truck YGN-07 and applies the same
 * status rules the database enforces, so every route state and failure path
 * can be exercised without a driver account. Enabled with ?preview=<scenario>
 * outside production builds.
 */

export const PREVIEW_DRIVER_ID = "preview-driver";

export const PREVIEW_SCENARIOS = [
  "empty",
  "assigned",
  "loading",
  "ready",
  "active",
  "paused",
  "complete",
] as const;

export type PreviewScenario = (typeof PREVIEW_SCENARIOS)[number];

export function isPreviewScenario(value: string | null): value is PreviewScenario {
  return PREVIEW_SCENARIOS.includes(value as PreviewScenario);
}

const VEHICLE: VehicleOption = {
  id: "preview-truck",
  registration_number: "YGN-07",
  vehicle_type: "light_truck",
  status: "in_use",
  energy_source: "fuel",
  fuel_level_percent: 62,
  battery_level_percent: null,
  range_km_at_full: 420,
  reserve_percent: 10,
  odometer_km: 81_240,
  service_due_at_km: 85_000,
  capacity_kg: 1500,
};

/** Depot in Hlaing Tharyar; the truck starts here. */
export const PREVIEW_DEPOT = { latitude: 16.8571, longitude: 96.1219 };

type StopSeed = {
  recipient: string;
  phone: string | null;
  address: string;
  latitude: number;
  longitude: number;
  parcels: { description: string; kg: number; cod: number }[];
};

// 12 stops, 20 parcels, 7 of them COD.
const STOPS: StopSeed[] = [
  {
    recipient: "Daw Khin Myo",
    phone: "+95 9 420 111 201",
    address: "No. 14, Insein Road, Hlaing",
    latitude: 16.8475,
    longitude: 96.1286,
    parcels: [{ description: "Phone accessories", kg: 0.6, cod: 18_500 }],
  },
  {
    recipient: "U Aung Win",
    phone: "+95 9 420 111 202",
    address: "Building 7, Yadanar Housing, Kamayut",
    latitude: 16.8321,
    longitude: 96.1312,
    parcels: [{ description: "Documents", kg: 0.3, cod: 0 }],
  },
  {
    recipient: "Ma Thida Soe",
    phone: "+95 9 420 111 203",
    address: "No. 102, Pyay Road, 8 Mile, Mayangone",
    latitude: 16.8612,
    longitude: 96.1489,
    parcels: [
      { description: "Rice cooker", kg: 3.4, cod: 45_000 },
      { description: "Kitchen set", kg: 2.1, cod: 0 },
      { description: "Cushions", kg: 1.2, cod: 0 },
    ],
  },
  {
    recipient: "Ko Zaw Lin",
    phone: null,
    address: "Shop 12, Junction Square, Kamayut",
    latitude: 16.8193,
    longitude: 96.1295,
    parcels: [{ description: "Shoes", kg: 1.1, cod: 32_000 }],
  },
  {
    recipient: "Daw Nwe Ni",
    phone: "+95 9 420 111 205",
    address: "No. 3, Inya Myaing Road, Bahan",
    latitude: 16.8178,
    longitude: 96.1566,
    parcels: [
      { description: "Clothing", kg: 0.8, cod: 0 },
      { description: "Clothing", kg: 0.7, cod: 0 },
    ],
  },
  {
    recipient: "U Myint Thein",
    phone: "+95 9 420 111 206",
    address: "No. 48, Dhammazedi Road, Bahan",
    latitude: 16.8088,
    longitude: 96.1517,
    parcels: [
      { description: "Printer ink", kg: 0.9, cod: 27_000 },
      { description: "Paper ream", kg: 2.5, cod: 0 },
    ],
  },
  {
    recipient: "Ma Ei Phyu",
    phone: "+95 9 420 111 207",
    address: "Room 5B, Golden Valley, Bahan",
    latitude: 16.8015,
    longitude: 96.1488,
    parcels: [{ description: "Cosmetics", kg: 0.5, cod: 0 }],
  },
  {
    recipient: "Ko Htet Aung",
    phone: "+95 9 420 111 208",
    address: "No. 220, Anawrahta Road, Lanmadaw",
    latitude: 16.7797,
    longitude: 96.1434,
    parcels: [
      { description: "Laptop bag", kg: 1.3, cod: 52_000 },
      { description: "Mouse and keyboard", kg: 0.9, cod: 0 },
    ],
  },
  {
    recipient: "Daw San San",
    phone: "+95 9 420 111 209",
    address: "No. 9, 19th Street, Latha",
    latitude: 16.7752,
    longitude: 96.1527,
    parcels: [
      { description: "Fabric", kg: 2.0, cod: 0 },
      { description: "Sewing thread", kg: 0.4, cod: 0 },
    ],
  },
  {
    recipient: "U Kyaw Soe",
    phone: "+95 9 420 111 210",
    address: "No. 61, Bogyoke Aung San Road, Pabedan",
    latitude: 16.7784,
    longitude: 96.1588,
    parcels: [{ description: "Watch", kg: 0.2, cod: 64_000 }],
  },
  {
    recipient: "Ma Su Hlaing",
    phone: "+95 9 420 111 211",
    address: "No. 4, Kyaikkasan Road, Tamwe",
    latitude: 16.8004,
    longitude: 96.1765,
    parcels: [
      { description: "Books", kg: 2.6, cod: 0 },
      { description: "Stationery", kg: 0.8, cod: 0 },
    ],
  },
  {
    recipient: "Ko Nay Min",
    phone: "+95 9 420 111 212",
    address: "No. 77, Thanthumar Road, Thingangyun",
    latitude: 16.8235,
    longitude: 96.1934,
    parcels: [
      { description: "Bluetooth speaker", kg: 0.7, cod: 21_000 },
      { description: "Phone case", kg: 0.2, cod: 0 },
    ],
  },
];

const base = Date.parse("2026-10-21T01:30:00Z");
const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString();

function makeOrders(status: DeliveryStatus): DeliveryOrder[] {
  const orders: DeliveryOrder[] = [];
  let serial = 0;
  STOPS.forEach((stop, stopIndex) => {
    stop.parcels.forEach((parcel) => {
      serial += 1;
      orders.push({
        id: `preview-${String(serial).padStart(2, "0")}`,
        tracking_code: `YGN-${4800 + serial}`,
        customer_id: `preview-customer-${stopIndex}`,
        customer_name: stop.recipient,
        status,
        pickup_address: "Oern depot, Hlaing Tharyar",
        delivery_address: stop.address,
        pickup_latitude: PREVIEW_DEPOT.latitude,
        pickup_longitude: PREVIEW_DEPOT.longitude,
        delivery_latitude: stop.latitude,
        delivery_longitude: stop.longitude,
        recipient_name: stop.recipient,
        recipient_phone: stop.phone,
        parcel_description: parcel.description,
        parcel_weight_kg: parcel.kg,
        cod_amount: parcel.cod,
        cod_status: parcel.cod > 0 ? "pending" : "not_required",
        estimated_delivery_at: at(60 + stopIndex * 22),
        route_progress_percent: null,
        traffic_delay_minutes: 0,
        eta_confidence: "medium",
        eta_updated_at: at(0),
        created_at: at(-60 + serial),
        driver_id: PREVIEW_DRIVER_ID,
        driver_name: "Preview driver",
        driver_phone: null,
        vehicle_id: VEHICLE.id,
        vehicle_label: "YGN-07 · Light truck",
        route_id: "preview-route",
        latest_location: null,
      });
    });
  });
  return orders;
}

function routeStopsFor(orders: DeliveryOrder[]): RouteStop[] {
  return orders.map((order, index) => ({
    id: `stop-${order.id}`,
    route_id: "preview-route",
    order_id: order.id,
    stop_type: "delivery",
    sequence_number: index + 1,
    address: order.delivery_address,
    latitude: order.delivery_latitude,
    longitude: order.delivery_longitude,
    status: "pending",
    completed_at: null,
    created_at: order.created_at,
  }));
}

export type PreviewState = {
  data: WorkspaceData;
  session: RouteSession | null;
};

export function previewState(
  scenario: PreviewScenario,
  now: number,
): PreviewState {
  const empty: WorkspaceData = {
    orders: [],
    customers: [],
    drivers: [],
    vehicles: [VEHICLE],
    statusEvents: [],
    roadReports: [],
    riderRequests: [],
    routes: [],
    routeStops: [],
  };
  if (scenario === "empty") return { data: empty, session: null };

  const initial: DeliveryStatus =
    scenario === "assigned"
      ? "assigned"
      : scenario === "loading"
        ? "accepted"
        : scenario === "ready"
          ? "picked_up"
          : "in_transit";
  const orders = makeOrders(initial);
  const closedAt = new Date(now - 30 * 60_000).toISOString();
  const statusEvents: WorkspaceData["statusEvents"] = [];
  const close = (order: DeliveryOrder, status: "delivered" | "failed") => {
    order.status = status;
    if (status === "delivered" && order.cod_amount > 0)
      order.cod_status = "collected";
    statusEvents.push({
      id: statusEvents.length + 1,
      order_id: order.id,
      status,
      note: null,
      created_at: closedAt,
    });
  };
  if (scenario === "active" || scenario === "paused") {
    close(orders[0], "delivered");
    close(orders[1], "delivered");
  }
  if (scenario === "complete") {
    orders.forEach((order, index) => {
      close(order, index === 4 ? "failed" : "delivered");
    });
  }
  const started = new Date(now - 90 * 60_000).toISOString();
  return {
    data: {
      ...empty,
      orders,
      statusEvents,
      routeStops: routeStopsFor(orders),
      roadReports: [
        {
          id: "preview-road-1",
          driver_id: "someone-else",
          driver_name: "Another driver",
          order_id: null,
          category: "flooding",
          severity: "high",
          description: "Water over the road near Hledan junction",
          latitude: 16.8231,
          longitude: 96.1318,
          status: "verified",
          reported_at: new Date(now - 20 * 60_000).toISOString(),
          expires_at: new Date(now + 3 * 60 * 60_000).toISOString(),
        },
      ],
    },
    session:
      scenario === "active" || scenario === "complete"
        ? { status: "in_progress", started_at: started, paused_at: null, closed_at: null, cod_declared: null }
        : scenario === "paused"
          ? { status: "paused", started_at: started, paused_at: closedAt, closed_at: null, cod_declared: null }
          : null,
  };
}

/** Dispatcher adds one new stop with one parcel, assigned but not loaded. */
export function previewAddStop(data: WorkspaceData, now: number): WorkspaceData {
  const serial = data.orders.length + 1;
  const order: DeliveryOrder = {
    ...makeOrders("assigned")[0],
    id: `preview-added-${serial}`,
    tracking_code: `YGN-${4900 + serial}`,
    customer_id: "preview-customer-added",
    customer_name: "Daw Mya Mya",
    recipient_name: "Daw Mya Mya",
    recipient_phone: "+95 9 420 111 299",
    delivery_address: "No. 15, Parami Road, Mayangone",
    delivery_latitude: 16.8442,
    delivery_longitude: 96.1601,
    parcel_description: "Medicine box",
    parcel_weight_kg: 0.4,
    cod_amount: 12_000,
    cod_status: "pending",
    estimated_delivery_at: new Date(now + 4 * 60 * 60_000).toISOString(),
    created_at: new Date(now).toISOString(),
  };
  return {
    ...data,
    orders: [...data.orders, order],
    routeStops: [...data.routeStops, ...routeStopsFor([order]).map((stop) => ({ ...stop, sequence_number: 999 }))],
  };
}

/** Dispatcher swaps the next two open stops. */
export function previewReorder(data: WorkspaceData): WorkspaceData {
  const open = data.orders.filter(
    (order) => order.status === "in_transit" || order.status === "picked_up",
  );
  const firstPlace = open[0]?.delivery_address;
  const secondPlace = open.find(
    (order) => order.delivery_address !== firstPlace,
  )?.delivery_address;
  if (!firstPlace || !secondPlace) return data;
  const first = new Set(
    open.filter((order) => order.delivery_address === firstPlace).map((o) => o.id),
  );
  const second = new Set(
    open.filter((order) => order.delivery_address === secondPlace).map((o) => o.id),
  );
  const firstSeq = Math.min(
    ...data.routeStops.filter((stop) => first.has(stop.order_id)).map((s) => s.sequence_number),
  );
  const secondSeq = Math.min(
    ...data.routeStops.filter((stop) => second.has(stop.order_id)).map((s) => s.sequence_number),
  );
  return {
    ...data,
    routeStops: data.routeStops.map((stop) =>
      first.has(stop.order_id)
        ? { ...stop, sequence_number: secondSeq + 0.5 }
        : second.has(stop.order_id)
          ? { ...stop, sequence_number: firstSeq - 0.5 }
          : stop,
    ),
  };
}

/** The status moves a driver may make, mirroring guard_delivery_order_update. */
const ALLOWED: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  assigned: ["accepted", "failed", "cancelled"],
  accepted: ["picked_up", "failed", "cancelled"],
  picked_up: ["in_transit", "failed"],
  in_transit: ["delivered", "failed"],
};

export function previewSetStatus(
  data: WorkspaceData,
  orderId: string,
  status: DeliveryStatus,
): WorkspaceData {
  const order = data.orders.find((item) => item.id === orderId);
  if (!order) throw new Error("This parcel is not assigned to you");
  if (!ALLOWED[order.status]?.includes(status))
    throw new Error(`Invalid delivery status transition: ${order.status} to ${status}`);
  return {
    ...data,
    orders: data.orders.map((item) =>
      item.id === orderId ? { ...item, status } : item,
    ),
    statusEvents: [
      ...data.statusEvents,
      {
        id: data.statusEvents.length + 1,
        order_id: orderId,
        status,
        note: null,
        created_at: new Date().toISOString(),
      },
    ],
  };
}
