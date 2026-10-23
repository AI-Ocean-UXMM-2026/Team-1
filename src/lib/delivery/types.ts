import type { AttachedDecision } from "./road-intel/types.ts";
export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled";

export type DeliveryLocation = {
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
};

export type DeliveryOrder = {
  id: string;
  tracking_code: string;
  customer_id: string | null;
  customer_name: string;
  status: DeliveryStatus;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  /** Who to meet at the pickup address (door pickups). */
  pickup_contact_name?: string | null;
  pickup_contact_phone?: string | null;
  parcel_description: string | null;
  parcel_weight_kg: number | null;
  /** Not stored yet; see orderPaymentMethod. Absent means cash on delivery. */
  payment_method?: "mmqr" | "ctzpay" | "cod" | null;
  /** The fee quoted at request time; rewards apply to it. Absent on older orders. */
  delivery_fee?: number | null;
  /** Coupon and points discount already taken off, in MMK. */
  discount_amount?: number;
  /** Paid in the app and returned because the order was cancelled, in MMK. */
  refunded_amount?: number;
  cod_amount: number;
  cod_status: "not_required" | "pending" | "collected" | "settled";
  estimated_delivery_at: string | null;
  route_progress_percent: number | null;
  traffic_delay_minutes: number;
  eta_confidence: "low" | "medium" | "high" | null;
  eta_updated_at: string | null;
  created_at: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_id: string | null;
  vehicle_label: string | null;
  route_id?: string | null;
  latest_location: DeliveryLocation | null;
};

export type ProfileOption = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

export type DriverOption = ProfileOption & {
  availability: "available" | "on_delivery" | "off_duty";
};

export type VehicleOption = {
  id: string;
  registration_number: string;
  vehicle_type: string;
  status: string;
  energy_source: "fuel" | "electric" | "hybrid";
  fuel_level_percent: number | null;
  battery_level_percent: number | null;
  range_km_at_full: number | null;
  reserve_percent: number;
  odometer_km: number;
  service_due_at_km: number | null;
  capacity_kg: number | null;
};

export type RoadReport = {
  id: string;
  driver_id: string;
  driver_name: string;
  order_id: string | null;
  category: "congestion" | "closure" | "roadwork" | "flooding" | "hazard";
  severity: "low" | "medium" | "high" | "blocked";
  description: string;
  latitude: number;
  longitude: number;
  status: "pending" | "verified" | "rejected";
  reported_at: string;
  expires_at: string;
  /** The road-intelligence engine's verdict on this note, once analysed. */
  decision?: AttachedDecision | null;
};

export type RiderRequestKind = "energy" | "issue";

export type RiderRequestCategory =
  | "refuel"
  | "recharge"
  | "vehicle_problem"
  | "accident"
  | "parcel_damaged"
  | "unsafe_area"
  | "other";

/** A rider asking operations for a fuel or charging stop, or help with an issue. */
export type RiderRequest = {
  id: string;
  driver_id: string;
  driver_name: string;
  order_id: string | null;
  vehicle_id: string | null;
  kind: RiderRequestKind;
  category: RiderRequestCategory;
  note: string | null;
  energy_level_percent: number | null;
  latitude: number | null;
  longitude: number | null;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

export type AssignmentRecommendation = {
  driverId: string;
  vehicleId: string | null;
  score: number;
  distanceToPickupKm: number | null;
  activeDeliveries: number;
  reasons: string[];
};

export type StatusEvent = {
  id: number;
  order_id: string;
  status: DeliveryStatus;
  note: string | null;
  created_at: string;
};

export type DeliveryRoute = {
  id: string;
  created_by: string;
  driver_id: string;
  vehicle_id: string | null;
  status: string;
  planned_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Set when the route was committed from a dispatch plan. */
  dispatch_run_id?: string | null;
  depot_id?: string | null;
  service_date?: string | null;
  planned_depart_at?: string | null;
  planned_return_at?: string | null;
};

export type RouteStop = {
  id: string;
  route_id: string;
  order_id: string;
  stop_type: "pickup" | "delivery";
  sequence_number: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  /** Present on stops that came from a committed dispatch plan. */
  dispatch_run_stop_id?: string | null;
  planned_arrival_at?: string | null;
  planned_departure_at?: string | null;
  window_start_at?: string | null;
  window_end_at?: string | null;
  arrived_at?: string | null;
};

export type WorkspaceData = {
  orders: DeliveryOrder[];
  customers: ProfileOption[];
  drivers: DriverOption[];
  vehicles: VehicleOption[];
  statusEvents: StatusEvent[];
  roadReports: RoadReport[];
  riderRequests: RiderRequest[];
  routes: DeliveryRoute[];
  routeStops: RouteStop[];
};

export type WorkspaceProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "customer" | "manager" | "driver" | "seller" | "support";
};

export const ACTIVE_STATUSES: DeliveryStatus[] = [
  "assigned",
  "accepted",
  "picked_up",
  "in_transit",
];

export const TRACKABLE_STATUSES: DeliveryStatus[] = ["picked_up", "in_transit"];

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Waiting for assignment",
  assigned: "Rider assigned",
  accepted: "Rider accepted",
  picked_up: "Parcel collected",
  in_transit: "On the way",
  delivered: "Delivered",
  failed: "Delivery issue",
  cancelled: "Cancelled",
};

export const STATUS_STEPS: DeliveryStatus[] = [
  "assigned",
  "accepted",
  "picked_up",
  "in_transit",
  "delivered",
];
