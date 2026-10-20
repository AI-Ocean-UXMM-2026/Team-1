import type { DeliveryActionClient } from "@/lib/delivery/actions";

export async function createCommerceIntegration(
  supabase: DeliveryActionClient,
  input: {
    sellerId: string;
    providerName: string;
    storeName: string;
    providerType: "ecommerce" | "marketplace" | "carrier";
    externalAccountId?: string;
  },
) {
  const { error } = await supabase.from("commerce_integrations").insert({
    seller_id: input.sellerId,
    provider_name: input.providerName.trim(),
    store_name: input.storeName.trim(),
    provider_type: input.providerType,
    external_account_id: input.externalAccountId?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function importExternalShipment(
  supabase: DeliveryActionClient,
  input: {
    sellerId: string;
    integrationId?: string;
    providerName: string;
    trackingCode: string;
    externalOrderReference?: string;
    originLabel?: string;
    destinationLabel?: string;
    trackingUrl?: string;
  },
) {
  const { error } = await supabase.from("external_shipments").insert({
    seller_id: input.sellerId,
    integration_id: input.integrationId || null,
    provider_name: input.providerName.trim(),
    tracking_code: input.trackingCode.trim(),
    external_order_reference: input.externalOrderReference?.trim() || null,
    origin_label: input.originLabel?.trim() || null,
    destination_label: input.destinationLabel?.trim() || null,
    tracking_url: input.trackingUrl?.trim() || null,
    latest_event_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function addCustomerShipment(
  supabase: DeliveryActionClient,
  input: {
    customerId: string;
    providerName: string;
    trackingCode: string;
    trackingUrl?: string;
  },
) {
  const { error } = await supabase.from("external_shipments").insert({
    customer_id: input.customerId,
    provider_name: input.providerName.trim(),
    tracking_code: input.trackingCode.trim(),
    tracking_url: input.trackingUrl?.trim() || null,
    latest_event_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function updateExternalShipmentStatus(
  supabase: DeliveryActionClient,
  shipmentId: string,
  status:
    | "pending"
    | "accepted"
    | "picked_up"
    | "in_transit"
    | "delivered"
    | "failed"
    | "cancelled",
) {
  const { error } = await supabase
    .from("external_shipments")
    .update({ status, latest_event_at: new Date().toISOString() })
    .eq("id", shipmentId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function createSupportCase(
  supabase: DeliveryActionClient,
  input: {
    requesterId: string;
    orderId?: string;
    subject: string;
    description: string;
    priority: "low" | "normal" | "high" | "urgent";
  },
) {
  const { error } = await supabase.from("support_cases").insert({
    requester_id: input.requesterId,
    order_id: input.orderId || null,
    subject: input.subject.trim(),
    description: input.description.trim(),
    priority: input.priority,
  });
  if (error) throw new Error(error.message);
}

export async function updateSupportCase(
  supabase: DeliveryActionClient,
  input: {
    caseId: string;
    supportId: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    resolutionNotes?: string;
  },
) {
  const resolved = input.status === "resolved" || input.status === "closed";
  const { error } = await supabase
    .from("support_cases")
    .update({
      assigned_to: input.supportId,
      status: input.status,
      resolution_notes: input.resolutionNotes?.trim() || null,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", input.caseId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function createMaintenanceRecord(
  supabase: DeliveryActionClient,
  input: {
    managerId: string;
    vehicleId: string;
    maintenanceType: string;
    scheduledFor?: string;
    odometerKm?: number;
    costAmount?: number;
    notes?: string;
  },
) {
  const { error } = await supabase.from("vehicle_maintenance_records").insert({
    vehicle_id: input.vehicleId,
    maintenance_type: input.maintenanceType.trim(),
    scheduled_for: input.scheduledFor || null,
    odometer_km: input.odometerKm ?? null,
    cost_amount: input.costAmount ?? 0,
    notes: input.notes?.trim() || null,
    created_by: input.managerId,
  });
  if (error) throw new Error(error.message);
}

export async function createDeliveryCost(
  supabase: DeliveryActionClient,
  input: {
    managerId: string;
    orderId?: string;
    vehicleId?: string;
    category: "fuel" | "charging" | "toll" | "maintenance" | "labor" | "other";
    amount: number;
    notes?: string;
  },
) {
  if (!input.orderId && !input.vehicleId)
    throw new Error("Choose a delivery or vehicle for this cost.");
  const { error } = await supabase.from("delivery_cost_entries").insert({
    order_id: input.orderId || null,
    vehicle_id: input.vehicleId || null,
    category: input.category,
    amount: input.amount,
    notes: input.notes?.trim() || null,
    created_by: input.managerId,
  });
  if (error) throw new Error(error.message);
}

export async function configureVehicleReadiness(
  supabase: DeliveryActionClient,
  input: {
    vehicleId: string;
    energySource: "fuel" | "electric" | "hybrid";
    fuelLevel?: number | null;
    batteryLevel?: number | null;
    rangeKmAtFull: number;
    reservePercent: number;
    odometerKm: number;
    serviceDueAtKm?: number | null;
  },
) {
  const { error } = await supabase
    .from("vehicles")
    .update({
      energy_source: input.energySource,
      fuel_level_percent: input.fuelLevel ?? null,
      battery_level_percent: input.batteryLevel ?? null,
      range_km_at_full: input.rangeKmAtFull,
      reserve_percent: input.reservePercent,
      odometer_km: input.odometerKm,
      service_due_at_km: input.serviceDueAtKm ?? null,
    })
    .eq("id", input.vehicleId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}
