import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoadReport } from "@/lib/delivery/types";
import type { Database } from "@/lib/supabase/database.types";

export type DeliveryActionClient = SupabaseClient<Database>;

export function validateMapPin(
  label: string,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  if (latitude == null && longitude == null) return;
  if (latitude == null || longitude == null) {
    throw new Error(`Enter both latitude and longitude for the ${label} pin.`);
  }
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      `The ${label} pin needs a latitude from -90 to 90 and a longitude from -180 to 180.`,
    );
  }
}

export async function setOrderStatus(
  supabase: DeliveryActionClient,
  orderId: string,
  status: "accepted" | "picked_up" | "in_transit" | "delivered" | "failed",
) {
  const { error } = await supabase
    .from("delivery_orders")
    .update({ status })
    .eq("id", orderId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function sendDriverLocation(
  supabase: DeliveryActionClient,
  orderId: string,
  driverId: string,
  latitude: number,
  longitude: number,
  accuracy: number | null,
) {
  const { error } = await supabase.from("delivery_locations").insert({
    order_id: orderId,
    driver_id: driverId,
    latitude,
    longitude,
    accuracy_meters: accuracy,
  });
  if (error) throw error;
}

export async function collectCod(
  supabase: DeliveryActionClient,
  input: { orderId: string; driverId: string; amount: number },
) {
  const { error } = await supabase.from("cod_payments").insert({
    order_id: input.orderId,
    collected_by: input.driverId,
    amount: input.amount,
    payment_method: "cash",
    status: "collected",
  });
  if (error) throw error;
}

export async function createDelivery(
  supabase: DeliveryActionClient,
  input: {
    managerId: string;
    customerId: string;
    pickupAddress: string;
    deliveryAddress: string;
    recipientName: string;
    recipientPhone: string;
    parcelDescription: string;
    codAmount: number;
    pickupLatitude?: number | null;
    pickupLongitude?: number | null;
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
  },
) {
  validateMapPin("pickup", input.pickupLatitude, input.pickupLongitude);
  validateMapPin("drop-off", input.deliveryLatitude, input.deliveryLongitude);
  const estimatedAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("delivery_orders")
    .insert({
      customer_id: input.customerId,
      created_by: input.managerId,
      pickup_address: input.pickupAddress,
      pickup_latitude: input.pickupLatitude ?? null,
      pickup_longitude: input.pickupLongitude ?? null,
      delivery_address: input.deliveryAddress,
      delivery_latitude: input.deliveryLatitude ?? null,
      delivery_longitude: input.deliveryLongitude ?? null,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      parcel_description: input.parcelDescription,
      cod_amount: input.codAmount,
      cod_status: input.codAmount > 0 ? "pending" : "not_required",
      estimated_delivery_at: estimatedAt,
    })
    .select("id, tracking_code, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function assignDelivery(
  supabase: DeliveryActionClient,
  input: {
    orderId: string;
    driverId: string;
    vehicleId: string | null;
  },
) {
  const { data, error } = await supabase.rpc("assign_delivery", {
    target_order_id: input.orderId,
    target_driver_id: input.driverId,
    target_vehicle_id: input.vehicleId,
  });
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error("The assignment was not saved. Refresh and try again.");
  return data;
}

export async function setDriverAvailability(
  supabase: DeliveryActionClient,
  driverId: string,
  availability: "available" | "on_delivery" | "off_duty",
) {
  const { data, error } = await supabase
    .from("driver_profiles")
    .update({ availability })
    .eq("user_id", driverId)
    .select("user_id")
    .single();
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error(
      "The rider availability was not saved. Refresh and try again.",
    );
}

export async function submitRoadReport(
  supabase: DeliveryActionClient,
  input: {
    driverId: string;
    orderId: string | null;
    category: RoadReport["category"];
    severity: RoadReport["severity"];
    description: string;
    latitude: number;
    longitude: number;
  },
) {
  const description = input.description.trim();
  if (description.length < 3 || description.length > 240)
    throw new Error("Describe the road condition in 3 to 240 characters.");
  validateMapPin("road report", input.latitude, input.longitude);
  const { data, error } = await supabase
    .from("road_reports")
    .insert({
      driver_id: input.driverId,
      order_id: input.orderId,
      category: input.category,
      severity: input.severity,
      description,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function reviewRoadReport(
  supabase: DeliveryActionClient,
  reportId: string,
  decision: "verified" | "rejected",
) {
  const { data, error } = await supabase.rpc("review_road_report", {
    target_report_id: reportId,
    decision,
  });
  if (error) throw new Error(error.message);
  return data;
}
