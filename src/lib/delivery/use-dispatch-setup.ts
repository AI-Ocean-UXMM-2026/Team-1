"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type SetupDepot = {
  id: string;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  location_status: "unverified" | "verified";
  coordinate_source: string | null;
};

export type SetupTruck = {
  id: string;
  registration_number: string;
  status: string;
  capacity_kg: number | null;
  default_driver_id: string | null;
  depot_id: string | null;
};

export type SetupDriver = { id: string; name: string; availability: string };

export type DispatchSetup = {
  status: "loading" | "signed_out" | "not_manager" | "ready" | "error";
  error: string | null;
  depots: SetupDepot[];
  trucks: SetupTruck[];
  drivers: SetupDriver[];
  pendingOrders: number | null;
};

const EMPTY: DispatchSetup = {
  status: "loading",
  error: null,
  depots: [],
  trucks: [],
  drivers: [],
  pendingOrders: null,
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/** Everything the setup step needs, read as the signed-in manager (RLS applies). */
export function useDispatchSetup(enabled: boolean) {
  const [setup, setSetup] = useState<DispatchSetup>(EMPTY);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) {
        if (alive.current) setSetup({ ...EMPTY, status: "signed_out" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.role !== "manager") {
        if (alive.current) setSetup({ ...EMPTY, status: "not_manager" });
        return;
      }
      const [depots, trucks, drivers, pending] = await Promise.all([
        supabase
          .from("depots")
          .select(
            "id, code, name, latitude, longitude, location_status, coordinate_source",
          )
          .eq("is_active", true)
          .order("code"),
        supabase
          .from("vehicles")
          .select(
            "id, registration_number, status, capacity_kg, vehicle_dispatch_profiles(depot_id, default_driver_id)",
          )
          .eq("vehicle_type", "truck")
          .order("registration_number"),
        supabase
          .from("driver_profiles")
          .select("user_id, availability, profiles(full_name)")
          .order("user_id"),
        supabase
          .from("delivery_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      const failure = depots.error ?? trucks.error ?? drivers.error;
      if (failure) {
        if (alive.current) {
          setSetup({ ...EMPTY, status: "error", error: failure.message });
        }
        return;
      }

      if (!alive.current) return;
      setSetup({
        status: "ready",
        error: null,
        depots: (depots.data ?? []) as SetupDepot[],
        trucks: (trucks.data ?? []).map((row) => {
          const profileRow = firstRelation(
            row.vehicle_dispatch_profiles as
              | { depot_id: string | null; default_driver_id: string | null }
              | { depot_id: string | null; default_driver_id: string | null }[]
              | null,
          );
          return {
            id: row.id,
            registration_number: row.registration_number,
            status: row.status,
            capacity_kg: row.capacity_kg,
            default_driver_id: profileRow?.default_driver_id ?? null,
            depot_id: profileRow?.depot_id ?? null,
          };
        }),
        drivers: (drivers.data ?? []).map((row) => ({
          id: row.user_id,
          name:
            firstRelation(
              row.profiles as
                | { full_name: string | null }
                | { full_name: string | null }[]
                | null,
            )?.full_name || "Driver",
          availability: row.availability,
        })),
        pendingOrders: pending.count ?? null,
      });
    } catch (cause) {
      if (alive.current)
        setSetup({
          ...EMPTY,
          status: "error",
          error:
            cause instanceof Error
              ? cause.message
              : "Could not load dispatch data.",
        });
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (enabled) void load();
    return () => {
      alive.current = false;
    };
  }, [enabled, load]);

  return { setup, reload: load };
}
