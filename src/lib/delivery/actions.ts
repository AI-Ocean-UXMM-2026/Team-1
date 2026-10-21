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

export type ManualOrderItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export async function createManualDeliveryOrder(
  supabase: DeliveryActionClient,
  input: {
    senderName: string;
    senderPhone: string;
    pickupAddress: string;
    receiverName: string;
    receiverPhone: string;
    deliveryAddress: string;
    items: ManualOrderItem[];
    codAmount: number;
    notes?: string;
  },
) {
  const items = input.items
    .map((item) => ({
      description: item.description.trim(),
      quantity: Math.max(1, Math.floor(item.quantity)),
      unit_price: Math.max(0, item.unitPrice),
    }))
    .filter((item) => item.description.length > 0);
  if (!items.length) throw new Error("Add at least one item to the order.");

  const { data, error } = await supabase
    .rpc("create_manual_delivery_order", {
      p_sender_name: input.senderName.trim(),
      p_sender_phone: input.senderPhone.trim(),
      p_pickup_address: input.pickupAddress.trim(),
      p_receiver_name: input.receiverName.trim(),
      p_receiver_phone: input.receiverPhone.trim(),
      p_delivery_address: input.deliveryAddress.trim(),
      p_items: items,
      p_cod_amount: Math.max(0, input.codAmount),
      p_notes: input.notes?.trim() || null,
    })
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createCustomerPickupOrder(
  supabase: DeliveryActionClient,
  input: {
    pickupAddress: string;
    pickupLatitude?: number | null;
    pickupLongitude?: number | null;
    pickupContactPhone?: string;
    deliveryAddress: string;
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
    recipientName: string;
    recipientPhone: string;
    parcelDescription: string;
    codAmount: number;
  },
) {
  validateMapPin("pickup", input.pickupLatitude, input.pickupLongitude);
  validateMapPin("drop-off", input.deliveryLatitude, input.deliveryLongitude);
  const { data, error } = await supabase
    .rpc("create_customer_pickup_order", {
      p_pickup_address: input.pickupAddress,
      p_pickup_latitude: input.pickupLatitude ?? null,
      p_pickup_longitude: input.pickupLongitude ?? null,
      p_pickup_contact_phone: input.pickupContactPhone?.trim() || null,
      p_delivery_address: input.deliveryAddress,
      p_delivery_latitude: input.deliveryLatitude ?? null,
      p_delivery_longitude: input.deliveryLongitude ?? null,
      p_recipient_name: input.recipientName,
      p_recipient_phone: input.recipientPhone,
      p_parcel_description: input.parcelDescription,
      p_cod_amount: input.codAmount,
    })
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

/* ------------------------------------------------- driver delivery flow */

/** PostgREST reports a function or table that the database doesn't have yet. */
function isMissingSchema(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42883" ||
    /(could not find the function|does not exist|schema cache)/i.test(
      error.message,
    )
  );
}

export type DeliveryOutcomeInput = {
  orderId: string;
  driverId: string;
  /** Stays the same across retries, so a resend never records a second outcome. */
  requestId: string;
  outcome: "delivered" | "failed";
  parcelVerified: boolean;
  receivedBy: string | null;
  failureReason: string | null;
  nextAction: "none" | "retry_later" | "reschedule" | "return_to_depot";
  note: string | null;
  codExpected: number;
  /** Cash received for this parcel; null when no COD is open. */
  codReceived: number | null;
  codReason: string | null;
};

export type DeliveryOutcomeResult = {
  status: string;
  codStatus: string;
  duplicate: boolean;
};

/**
 * Records one parcel's outcome. Uses the atomic, idempotent database function
 * when it exists; before that migration is applied, falls back to the older
 * separate writes after checking the parcel has not already been closed.
 */
export async function completeDelivery(
  supabase: DeliveryActionClient,
  input: DeliveryOutcomeInput,
): Promise<DeliveryOutcomeResult> {
  const { data, error } = await supabase.rpc("complete_delivery", {
    target_order_id: input.orderId,
    client_request_id: input.requestId,
    delivery_outcome: input.outcome,
    parcel_checked: input.parcelVerified,
    received_by: input.receivedBy,
    reason: input.failureReason,
    follow_up: input.nextAction,
    delivery_note: input.note,
    cod_received: input.codReceived,
    cod_reason: input.codReason,
  });
  if (!error) {
    const result = data as {
      status: string;
      cod_status: string;
      duplicate: boolean;
    };
    return {
      status: result.status,
      codStatus: result.cod_status,
      duplicate: result.duplicate,
    };
  }
  if (!isMissingSchema(error)) throw new Error(error.message);
  return completeDeliveryLegacy(supabase, input);
}

async function completeDeliveryLegacy(
  supabase: DeliveryActionClient,
  input: DeliveryOutcomeInput,
): Promise<DeliveryOutcomeResult> {
  const { data: order, error: readError } = await supabase
    .from("delivery_orders")
    .select("status, cod_status, cod_amount")
    .eq("id", input.orderId)
    .single();
  if (readError) throw new Error(readError.message);
  // A retry after a dropped response: the first attempt already went through.
  if (order.status === "delivered" || order.status === "failed")
    return {
      status: order.status,
      codStatus: order.cod_status,
      duplicate: true,
    };
  if (order.status === "picked_up")
    await setOrderStatus(supabase, input.orderId, "in_transit");
  if (
    input.outcome === "delivered" &&
    order.cod_status === "pending" &&
    input.codReceived === order.cod_amount
  )
    await collectCod(supabase, {
      orderId: input.orderId,
      driverId: input.driverId,
      amount: order.cod_amount,
    });
  await setOrderStatus(supabase, input.orderId, input.outcome);
  await recordDeliveryOutcome(supabase, {
    orderId: input.orderId,
    driverId: input.driverId,
    outcome: input.outcome,
    recipientName: input.receivedBy,
    failureReason: legacyReason(input.failureReason),
    note: [
      input.note,
      input.failureReason && legacyReason(input.failureReason) === "other"
        ? `Reason: ${input.failureReason}`
        : null,
      input.nextAction !== "none" ? `Next: ${input.nextAction}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    codExpected: input.codExpected,
    codCollected: input.codReceived,
    codDiscrepancyReason:
      input.codReceived != null && input.codReceived !== input.codExpected
        ? input.codReason
        : null,
  });
  return {
    status: input.outcome,
    codStatus: order.cod_status,
    duplicate: false,
  };
}

/** Reasons the pre-migration outcome table accepts; the rest go in the note. */
function legacyReason(reason: string | null): FailureReason | null {
  if (reason == null) return null;
  return (
    [
      "recipient_unavailable",
      "incorrect_address",
      "recipient_refused",
      "recipient_unreachable",
    ] as string[]
  ).includes(reason)
    ? (reason as FailureReason)
    : "other";
}

export type StoredRouteSession = {
  status: "in_progress" | "paused" | "closed";
  started_at: string;
  paused_at: string | null;
  closed_at: string | null;
  cod_declared: number | null;
};

/** Thrown when the route session table isn't in the database yet. */
export class RouteSessionUnavailable extends Error {}

export async function loadRouteSession(
  supabase: DeliveryActionClient,
  driverId: string,
  routeDate: string,
): Promise<StoredRouteSession | null> {
  const { data, error } = await supabase
    .from("driver_route_sessions")
    .select("status, started_at, paused_at, closed_at, cod_declared")
    .eq("driver_id", driverId)
    .eq("route_date", routeDate)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error))
      throw new RouteSessionUnavailable(error.message);
    throw new Error(error.message);
  }
  return data as StoredRouteSession | null;
}

export async function setRouteState(
  supabase: DeliveryActionClient,
  input: {
    state: "in_progress" | "paused" | "closed";
    reason?: string | null;
    declaredCod?: number | null;
  },
): Promise<StoredRouteSession> {
  const { data, error } = await supabase.rpc("set_driver_route_state", {
    next_state: input.state,
    reason: input.reason ?? null,
    declared_cod: input.declaredCod ?? null,
  });
  if (error) {
    if (isMissingSchema(error))
      throw new RouteSessionUnavailable(error.message);
    throw new Error(error.message);
  }
  return data as unknown as StoredRouteSession;
}

/** Marks the delivery stops for these parcels as arrived, where dispatch created them. */
export async function markStopArrived(
  supabase: DeliveryActionClient,
  orderIds: string[],
) {
  const { error } = await supabase
    .from("route_stops")
    .update({ status: "arrived" })
    .in("order_id", orderIds)
    .eq("stop_type", "delivery")
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}
