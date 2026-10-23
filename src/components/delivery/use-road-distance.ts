"use client";

import { useEffect, useState } from "react";

import type { MapPoint } from "@/lib/delivery/map-projection";
import { fetchRoadRoute, hasMapbox } from "@/lib/delivery/mapbox";

const keyOf = (a: MapPoint, b: MapPoint) =>
  `${a.latitude.toFixed(5)},${a.longitude.toFixed(5)};${b.latitude.toFixed(5)},${b.longitude.toFixed(5)}`;

/**
 * Distances already looked up. Each pickup step is its own page, so without
 * this the price would drop back to the straight-line guess on every step.
 */
const known = new Map<string, number>();
const STORAGE_PREFIX = "oern.road-km.";

function remembered(key: string): number | null {
  const cached = known.get(key);
  if (cached !== undefined) return cached;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    const km = stored === null ? NaN : Number(stored);
    if (Number.isFinite(km)) {
      known.set(key, km);
      return km;
    }
  } catch {
    // Storage can be blocked; the lookup then simply repeats.
  }
  return null;
}

function remember(key: string, km: number) {
  known.set(key, km);
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, String(km));
  } catch {
    // Not stored; the in-memory copy still serves this page.
  }
}

/**
 * Driving distance between two pins from Mapbox, or null until it is known or
 * when there is no road route. The fee falls back to a straight-line estimate
 * meanwhile, so a slow or failed lookup never blocks the price.
 */
export function useRoadDistance(
  from: MapPoint | null,
  to: MapPoint | null,
): number | null {
  const key = from && to ? keyOf(from, to) : null;
  const [fetched, setFetched] = useState<{ key: string; km: number } | null>(
    null,
  );

  useEffect(() => {
    if (!from || !to || !key || !hasMapbox || remembered(key) !== null) return;
    const controller = new AbortController();
    // Typing and dragging pins fires quickly; only the settled pair is routed.
    const timer = window.setTimeout(() => {
      void fetchRoadRoute([from, to], undefined, controller.signal)
        .then((route) => {
          if (!route || !Number.isFinite(route.distanceKm)) return;
          remember(key, route.distanceKm);
          setFetched({ key, km: route.distanceKm });
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [from, to, key]);

  if (!key) return null;
  if (fetched?.key === key) return fetched.km;
  // Read in render so a page that remounts shows the known price at once.
  return typeof window === "undefined" ? null : remembered(key);
}
