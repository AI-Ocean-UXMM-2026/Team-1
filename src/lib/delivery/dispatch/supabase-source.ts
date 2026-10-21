import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { FloodReport, GeoJsonLike } from "./flood.ts";
import { DEFAULT_HAZARD_WEIGHTS, FloodField } from "./flood.ts";
import type { PlanDataSource, SaveOutcome } from "./handler.ts";
import type { DepotRow, OrderRow, TruckRow } from "./inputs.ts";
import { fetchLiveFloodConditions } from "./open-meteo.ts";
import type { SavePayload } from "./plan.ts";

/*
 * Reads and writes for the planner, all through the signed-in manager's own
 * Supabase client, so row-level security still applies. Never uses a service
 * role key.
 */

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function createSupabaseSource(
  supabase: SupabaseClient<Database>,
): PlanDataSource {
  return {
    async loadDepot(id) {
      const { data, error } = await supabase
        .from("depots")
        .select("id, code, latitude, longitude, location_status, is_active")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`depots: ${error.message}`);
      return (data as DepotRow | null) ?? null;
    },

    async loadTrucks(ids) {
      let query = supabase
        .from("vehicles")
        .select(
          "id, registration_number, vehicle_type, status, capacity_kg, energy_source, fuel_level_percent, battery_level_percent, range_km_at_full, reserve_percent, vehicle_dispatch_profiles(depot_id, default_driver_id, capacity_m3, cost_per_km_mmk, fixed_cost_mmk, cost_source)",
        )
        .eq("vehicle_type", "truck");
      if (ids?.length) query = query.in("id", ids);
      const { data, error } = await query;
      if (error) throw new Error(`vehicles: ${error.message}`);
      return (data ?? []).map((row) => {
        const { vehicle_dispatch_profiles, ...vehicle } = row as typeof row & {
          vehicle_dispatch_profiles: unknown;
        };
        return {
          ...vehicle,
          profile: one(
            vehicle_dispatch_profiles as
              | TruckRow["profile"]
              | TruckRow["profile"][],
          ),
        } as TruckRow;
      });
    },

    async loadOrders(ids, limit) {
      let query = supabase
        .from("delivery_orders")
        .select(
          "id, status, pickup_address, pickup_latitude, pickup_longitude, delivery_address, delivery_latitude, delivery_longitude, parcel_weight_kg, cod_amount, updated_at, delivery_order_logistics(origin_kind, parcel_size, weight_kg, weight_source, volume_m3, volume_source, pickup_window_start, pickup_window_end, window_source, delivery_deadline_at, deadline_hard, pickup_township_pcode, delivery_township_pcode, updated_at)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (ids?.length) query = query.in("id", ids);
      const { data, error } = await query;
      if (error) throw new Error(`delivery_orders: ${error.message}`);
      const rows = data ?? [];
      if (rows.length === 0) return [];
      // A pending order should have no open assignment; skip any that does.
      const { data: open, error: assignError } = await supabase
        .from("delivery_assignments")
        .select("order_id")
        .in(
          "order_id",
          rows.map((row) => row.id),
        )
        .is("ended_at", null);
      if (assignError)
        throw new Error(`delivery_assignments: ${assignError.message}`);
      const assigned = new Set((open ?? []).map((row) => row.order_id));
      return rows
        .filter((row) => !assigned.has(row.id))
        .map((row) => {
          const { delivery_order_logistics, ...order } = row as typeof row & {
            delivery_order_logistics: unknown;
          };
          return {
            ...order,
            logistics: one(
              delivery_order_logistics as
                | OrderRow["logistics"]
                | OrderRow["logistics"][],
            ),
          } as OrderRow;
        });
    },

    async loadFlood() {
      const { data, error } = await supabase
        .from("geo_hazard_layers")
        .select("id, geojson, hazard_classes")
        .eq("kind", "flood")
        .eq("status", "active")
        .maybeSingle();
      if (error) throw new Error(`geo_hazard_layers: ${error.message}`);
      if (!data) return { field: null, layerId: null };
      const weights: Record<string, number> = { ...DEFAULT_HAZARD_WEIGHTS };
      if (Array.isArray(data.hazard_classes))
        for (const entry of data.hazard_classes as {
          class?: unknown;
          weight?: unknown;
        }[])
          if (entry && entry.class != null && typeof entry.weight === "number")
            weights[String(entry.class)] = entry.weight;
      return {
        field: new FloodField(data.geojson as GeoJsonLike, weights),
        layerId: data.id,
      };
    },

    async loadReports(now) {
      const { data, error } = await supabase
        .from("road_reports")
        .select("latitude, longitude, severity")
        .eq("status", "verified")
        .in("category", ["flooding", "closure"])
        .gt("expires_at", now.toISOString());
      if (error) throw new Error(`road_reports: ${error.message}`);
      return (data ?? []).map((row) => ({
        lat: row.latitude,
        lng: row.longitude,
        severity: row.severity,
      })) as FloodReport[];
    },

    async loadLiveFlood(coords) {
      return fetchLiveFloodConditions(coords);
    },

    async save(
      payload: SavePayload,
      clientKey,
      replaceDraft,
    ): Promise<SaveOutcome> {
      const { data, error } = await supabase.rpc("save_dispatch_run", {
        p_payload:
          payload as unknown as Database["public"]["Functions"]["save_dispatch_run"]["Args"]["p_payload"],
        p_client_key: clientKey,
        p_replace_draft: replaceDraft,
      });
      if (error) throw new Error(`save_dispatch_run: ${error.message}`);
      return data as unknown as SaveOutcome;
    },
  };
}
