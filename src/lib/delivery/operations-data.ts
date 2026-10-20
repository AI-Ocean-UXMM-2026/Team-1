import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  OperationsData,
  OperationsProfile,
} from "@/lib/delivery/operations-types";
import type { Database } from "@/lib/supabase/database.types";

export const emptyOperationsData = (): OperationsData => ({
  integrations: [],
  externalShipments: [],
  supportCases: [],
  maintenanceRecords: [],
  costEntries: [],
  orders: [],
  vehicles: [],
  assignments: [],
  profiles: [],
});

export function demoOperationsData(): OperationsData {
  const now = new Date();
  const today = now.toISOString();
  const nextWeek = new Date(now.getTime() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return {
    integrations: [
      {
        id: "demo-integration-shop",
        seller_id: "demo-seller",
        provider_name: "Shopify",
        provider_type: "ecommerce",
        store_name: "Yangon Everyday Store",
        sync_mode: "manual",
        status: "active",
        external_account_id: "store-mm-014",
        last_synced_at: today,
        created_at: today,
        updated_at: today,
      },
    ],
    externalShipments: [
      {
        id: "demo-external-1",
        integration_id: "demo-integration-shop",
        seller_id: "demo-seller",
        customer_id: null,
        local_order_id: null,
        provider_name: "Shopify",
        external_order_reference: "#1048",
        tracking_code: "SHP-MM-1048",
        status: "in_transit",
        tracking_url: null,
        origin_label: "Bahan fulfillment point",
        destination_label: "Kamayut, Yangon",
        estimated_delivery_at: new Date(
          now.getTime() + 2 * 3_600_000,
        ).toISOString(),
        latest_event_at: today,
        metadata: {},
        created_at: today,
        updated_at: today,
      },
      {
        id: "demo-external-2",
        integration_id: null,
        seller_id: null,
        customer_id: "demo-customer",
        local_order_id: null,
        provider_name: "Other carrier",
        external_order_reference: "MP-7781",
        tracking_code: "MP-7781-YGN",
        status: "accepted",
        tracking_url: null,
        origin_label: "Mandalay hub",
        destination_label: "Sanchaung, Yangon",
        estimated_delivery_at: new Date(
          now.getTime() + 30 * 3_600_000,
        ).toISOString(),
        latest_event_at: today,
        metadata: {},
        created_at: today,
        updated_at: today,
      },
    ],
    supportCases: [
      {
        id: "demo-case-1",
        order_id: null,
        requester_id: "demo-customer",
        assigned_to: "demo-support",
        subject: "Recipient asked to change the landmark",
        description: "Confirm the updated landmark before the rider arrives.",
        priority: "high",
        status: "in_progress",
        resolution_notes: null,
        resolved_at: null,
        created_at: today,
        updated_at: today,
      },
    ],
    maintenanceRecords: [
      {
        id: "demo-maintenance-1",
        vehicle_id: "demo-vehicle-1",
        maintenance_type: "Brake and tire inspection",
        status: "scheduled",
        scheduled_for: nextWeek,
        completed_at: null,
        odometer_km: 8430,
        cost_amount: 0,
        notes: "Complete before the next long route.",
        created_by: "demo-manager",
        created_at: today,
        updated_at: today,
      },
    ],
    costEntries: [
      {
        id: "demo-cost-1",
        order_id: null,
        vehicle_id: "demo-vehicle-1",
        category: "charging",
        amount: 4800,
        incurred_at: today,
        notes: "Morning depot charge",
        created_by: "demo-manager",
        created_at: today,
      },
    ],
    orders: [],
    vehicles: [],
    assignments: [],
    profiles: [],
  };
}

export async function loadOperationsData(
  supabase: SupabaseClient<Database>,
  requestedRole: OperationsProfile["role"],
  userId: string,
) {
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profileRow) throw new Error("Your account profile is missing.");

  const profile = profileRow as OperationsProfile;
  if (profile.role !== requestedRole) {
    return { profile, data: emptyOperationsData(), isDemo: false };
  }

  const [
    integrations,
    externalShipments,
    supportCases,
    maintenanceRecords,
    costEntries,
    orders,
    vehicles,
    assignments,
    profiles,
  ] = await Promise.all([
    supabase
      .from("commerce_integrations")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("external_shipments")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("support_cases")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("vehicle_maintenance_records")
      .select("*")
      .order("scheduled_for", { ascending: true }),
    supabase
      .from("delivery_cost_entries")
      .select("*")
      .order("incurred_at", { ascending: false }),
    supabase
      .from("delivery_orders")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicles")
      .select("*")
      .order("registration_number", { ascending: true }),
    supabase.from("delivery_assignments").select("*").is("ended_at", null),
    supabase.from("profiles").select("id, full_name, phone, role"),
  ]);
  const firstError =
    integrations.error ??
    externalShipments.error ??
    supportCases.error ??
    maintenanceRecords.error ??
    costEntries.error ??
    orders.error ??
    vehicles.error ??
    assignments.error ??
    profiles.error;
  if (firstError) throw firstError;

  const data: OperationsData = {
    integrations: integrations.data ?? [],
    externalShipments: externalShipments.data ?? [],
    supportCases: supportCases.data ?? [],
    maintenanceRecords: maintenanceRecords.data ?? [],
    costEntries: costEntries.data ?? [],
    orders: orders.data ?? [],
    vehicles: vehicles.data ?? [],
    assignments: assignments.data ?? [],
    profiles: (profiles.data ?? []) as OperationsProfile[],
  };
  return {
    profile,
    data,
    isDemo: false,
  };
}
