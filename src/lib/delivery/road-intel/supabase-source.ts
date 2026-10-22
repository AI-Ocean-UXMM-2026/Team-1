import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { RoadIntelSource } from "./handler.ts";
import type { RoadCategory, RoadSeverity } from "./types.ts";

/** Reads and writes the engine's data as the signed-in manager, under RLS. */
export function createRoadIntelSource(
  supabase: SupabaseClient<Database>,
): RoadIntelSource {
  return {
    async activeNotes(now) {
      const since = new Date(now.getTime() - 12 * 3_600_000).toISOString();
      const [reports, decisions] = await Promise.all([
        supabase
          .from("road_reports")
          .select(
            "id, driver_id, category, severity, description, latitude, longitude, status, reported_at, expires_at",
          )
          .gt("expires_at", now.toISOString())
          .gte("reported_at", since)
          .neq("status", "rejected")
          .order("reported_at", { ascending: false })
          .limit(200),
        supabase
          .from("road_report_decisions")
          .select("report_id")
          .gt("expires_at", now.toISOString()),
      ]);
      if (reports.error) throw new Error(reports.error.message);
      if (decisions.error) throw new Error(decisions.error.message);
      const decided = new Set(
        (decisions.data ?? []).map((row) => row.report_id),
      );
      return (reports.data ?? []).map((row) => ({
        id: row.id,
        driverId: row.driver_id,
        category: row.category as RoadCategory,
        severity: row.severity as RoadSeverity,
        description: row.description,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        reportedAt: row.reported_at,
        expiresAt: row.expires_at,
        status: row.status as "pending" | "verified" | "rejected",
        hasDecision: decided.has(row.id),
      }));
    },
    async speedCells() {
      const { data, error } = await supabase.rpc("recent_road_speed_cells", {
        window_minutes: 30,
      });
      // Telemetry is evidence, not a requirement
      if (error) return [];
      return (data ?? []).map((row) => ({
        latitude: Number(row.cell_latitude),
        longitude: Number(row.cell_longitude),
        samples: row.samples,
        drivers: row.drivers,
        medianSpeedKmh: Number(row.median_speed_kmh),
      }));
    },
    async saveDecisions(decisions) {
      if (!decisions.length) return;
      const { error } = await supabase.from("road_report_decisions").upsert(
        decisions.map((decision) => ({
          report_id: decision.reportId,
          action: decision.action,
          category: decision.category,
          severity: decision.severity,
          confidence: decision.confidence,
          delay_minutes: decision.delayMinutes,
          radius_meters: decision.radiusMeters,
          expires_at: decision.expiresAt,
          rationale: decision.rationale,
          evidence: decision.evidence as never,
          source: decision.source,
          model: decision.model,
        })),
        { onConflict: "report_id" },
      );
      if (error) throw new Error(error.message);
    },
  };
}
