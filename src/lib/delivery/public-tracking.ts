import type {
  DeliveryLocation,
  DeliveryOrder,
  DeliveryStatus,
  StatusEvent,
} from "@/lib/delivery/types";

const vehicleTypeLabels: Record<string, string> = {
  motorcycle: "Motorcycle",
  e_bike: "E-bike",
  car: "Car",
  truck: "Truck",
};

export type PublicTracking = {
  order: DeliveryOrder;
  events: StatusEvent[];
};

type TrackingPayload = {
  id: string;
  tracking_code: string;
  status: DeliveryStatus;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  cod_amount: number;
  cod_status: DeliveryOrder["cod_status"];
  estimated_delivery_at: string | null;
  route_progress_percent: number | null;
  traffic_delay_minutes: number;
  eta_confidence: DeliveryOrder["eta_confidence"];
  eta_updated_at: string | null;
  created_at: string;
  has_driver: boolean;
  driver_first_name: string | null;
  vehicle_type: string | null;
  latest_location: DeliveryLocation | null;
  events: { id: number; status: DeliveryStatus; created_at: string }[];
};

/**
 * Maps the `track_delivery` RPC result to the shapes the Track view renders.
 * The RPC omits private fields, so they are filled with empty values here.
 */
export function fromTrackingPayload(raw: unknown): PublicTracking | null {
  if (!raw || typeof raw !== "object" || !("id" in raw)) return null;
  const data = raw as TrackingPayload;
  const order: DeliveryOrder = {
    id: data.id,
    tracking_code: data.tracking_code,
    customer_id: "",
    customer_name: "Your delivery",
    status: data.status,
    pickup_address: data.pickup_address,
    delivery_address: data.delivery_address,
    pickup_latitude: data.pickup_latitude,
    pickup_longitude: data.pickup_longitude,
    delivery_latitude: data.delivery_latitude,
    delivery_longitude: data.delivery_longitude,
    recipient_name: null,
    recipient_phone: null,
    parcel_description: null,
    parcel_weight_kg: null,
    cod_amount: Number(data.cod_amount) || 0,
    cod_status: data.cod_status,
    estimated_delivery_at: data.estimated_delivery_at,
    route_progress_percent: data.route_progress_percent,
    traffic_delay_minutes: data.traffic_delay_minutes ?? 0,
    eta_confidence: data.eta_confidence,
    eta_updated_at: data.eta_updated_at,
    created_at: data.created_at,
    driver_id: null,
    driver_name: data.has_driver
      ? data.driver_first_name || "Your rider"
      : null,
    driver_phone: null,
    vehicle_id: null,
    vehicle_label: data.vehicle_type
      ? (vehicleTypeLabels[data.vehicle_type] ?? data.vehicle_type)
      : null,
    latest_location: data.latest_location,
  };
  const events: StatusEvent[] = (data.events ?? []).map((event) => ({
    id: event.id,
    order_id: data.id,
    status: event.status,
    note: null,
    created_at: event.created_at,
  }));
  return { order, events };
}
