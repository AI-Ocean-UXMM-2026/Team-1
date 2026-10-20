import type { Tables } from "@/lib/supabase/database.types";

export type CommerceIntegration = Tables<"commerce_integrations">;
export type ExternalShipment = Tables<"external_shipments">;
export type SupportCase = Tables<"support_cases">;
export type MaintenanceRecord = Tables<"vehicle_maintenance_records">;
export type DeliveryCostEntry = Tables<"delivery_cost_entries">;
export type OperationsOrder = Tables<"delivery_orders">;
export type OperationsVehicle = Tables<"vehicles">;
export type OperationsAssignment = Tables<"delivery_assignments">;

export type OperationsProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "customer" | "manager" | "driver" | "seller" | "support";
};

export type OperationsData = {
  integrations: CommerceIntegration[];
  externalShipments: ExternalShipment[];
  supportCases: SupportCase[];
  maintenanceRecords: MaintenanceRecord[];
  costEntries: DeliveryCostEntry[];
  orders: OperationsOrder[];
  vehicles: OperationsVehicle[];
  assignments: OperationsAssignment[];
  profiles: OperationsProfile[];
};
