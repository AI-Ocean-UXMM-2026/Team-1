import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoadReport } from "../types.ts";
import type { SpeedCell } from "./types.ts";

const SPEED_REFRESH_MS = 90_000;

/**
 * Recent rider-measured speeds around the city, refreshed while `enabled`.
 * Empty when the table, function or session is not available, because
 * telemetry only ever refines a route.
 */
export function useRoadSpeedCells(enabled: boolean): SpeedCell[] {
  const [cells, setCells] = useState<SpeedCell[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      const { data, error } = await createClient().rpc(
        "recent_road_speed_cells",
        { window_minutes: 30 },
      );
      if (!active || error) return;
      setCells(
        (data ?? []).map((row) => ({
          latitude: Number(row.cell_latitude),
          longitude: Number(row.cell_longitude),
          samples: row.samples,
          drivers: row.drivers,
          medianSpeedKmh: Number(row.median_speed_kmh),
        })),
      );
    };
    void load();
    const timer = setInterval(() => void load(), SPEED_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled]);
  return cells;
}

/**
 * Sends new rider notes to the analysis engine while a manager has the
 * workspace open, then reloads so the verdicts reach routing and the review
 * list. Each set of notes is tried once per page load, so a failing model
 * cannot turn into a request loop.
 */
export function useRoadNoteAnalysis(
  enabled: boolean,
  reports: readonly RoadReport[],
  refresh: () => Promise<unknown>,
) {
  const tried = useRef(new Set<string>());
  const waiting = reports
    .filter(
      (report) =>
        report.status !== "rejected" &&
        !report.decision &&
        Date.parse(report.expires_at) > Date.now(),
    )
    .map((report) => report.id)
    .sort();
  const key = waiting.join(",");

  useEffect(() => {
    if (!enabled || !key || tried.current.has(key)) return;
    tried.current.add(key);
    const controller = new AbortController();
    fetch("/api/road-intel/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? refresh() : undefined))
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled, key, refresh]);
}
