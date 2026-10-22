import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RiderRequest,
  RiderRequestCategory,
  RoadReport,
} from "@/lib/delivery/types";
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  const { error: routeError } = await supabase.rpc("ensure_delivery_route", {
    target_order_id: input.orderId,
  });
  if (routeError) throw new Error(routeError.message);
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

export async function updateVehicleEnergy(
  supabase: DeliveryActionClient,
  input: {
    vehicleId: string;
    energySource: "fuel" | "electric" | "hybrid";
    levelPercent: number;
  },
) {
  if (
    !Number.isFinite(input.levelPercent) ||
    input.levelPercent < 0 ||
    input.levelPercent > 100
  ) {
    throw new Error("Enter an energy level from 0 to 100 percent.");
  }
  const update =
    input.energySource === "electric"
      ? { battery_level_percent: input.levelPercent }
      : input.energySource === "fuel"
        ? { fuel_level_percent: input.levelPercent }
        : {
            fuel_level_percent: input.levelPercent,
            battery_level_percent: input.levelPercent,
          };
  const { error } = await supabase
    .from("vehicles")
    .update(update)
    .eq("id", input.vehicleId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
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

/** A missing table reads as "not set up yet" rather than a raw database error. */
function riderRequestError(message: string) {
  return /rider_assistance_requests/.test(message) &&
    /(does not exist|schema cache)/.test(message)
    ? "Requests to operations aren’t set up yet. Call your dispatcher instead."
    : message;
}

export async function requestRiderAssistance(
  supabase: DeliveryActionClient,
  input: {
    driverId: string;
    orderId: string | null;
    vehicleId: string | null;
    category: RiderRequestCategory;
    note: string;
    energyLevelPercent: number | null;
    latitude: number | null;
    longitude: number | null;
  },
) {
  const note = input.note.trim();
  if (input.category === "other" && note.length < 3)
    throw new Error("Tell operations what happened in a few words.");
  if (note.length > 500) throw new Error("Keep the note under 500 characters.");
  validateMapPin("request", input.latitude, input.longitude);
  const kind =
    input.category === "refuel" || input.category === "recharge"
      ? "energy"
      : "issue";
  const { data, error } = await supabase
    .from("rider_assistance_requests")
    .insert({
      driver_id: input.driverId,
      order_id: input.orderId,
      vehicle_id: input.vehicleId,
      kind,
      category: input.category,
      note: note || null,
      energy_level_percent: input.energyLevelPercent,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    .select("id")
    .single();
  if (error) throw new Error(riderRequestError(error.message));
  return data.id;
}

export async function updateRiderRequestStatus(
  supabase: DeliveryActionClient,
  requestId: string,
  status: Exclude<RiderRequest["status"], "open">,
) {
  const { error } = await supabase
    .from("rider_assistance_requests")
    .update({ status })
    .eq("id", requestId);
  if (error) throw new Error(riderRequestError(error.message));
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

export type FailureReason =
  | "recipient_unavailable"
  | "incorrect_address"
  | "recipient_refused"
  | "recipient_unreachable"
  | "other";

export async function recordDeliveryOutcome(
  supabase: DeliveryActionClient,
  input: {
    orderId: string;
    driverId: string;
    outcome: "delivered" | "failed";
    recipientName: string | null;
    failureReason: FailureReason | null;
    note: string | null;
    codExpected: number;
    codCollected: number | null;
    codDiscrepancyReason: string | null;
  },
) {
  const { error } = await supabase.from("delivery_outcome_reports").insert({
    order_id: input.orderId,
    driver_id: input.driverId,
    outcome: input.outcome,
    recipient_name: input.recipientName?.trim() || null,
    failure_reason: input.failureReason,
    note: input.note?.trim() || null,
    cod_expected: input.codExpected,
    cod_collected: input.codCollected,
    cod_discrepancy_reason: input.codDiscrepancyReason?.trim() || null,
  });
  if (error) throw new Error(error.message);
}
