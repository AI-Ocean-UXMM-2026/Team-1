import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "@/lib/delivery/map-projection";
import {
  destinationKeyFor,
  fetchRoadRoute,
  hasMapbox,
  needsRouteRequest,
  type RoadRoute,
  type RouteRequest,
} from "@/lib/delivery/mapbox";
import { distanceKm } from "@/lib/delivery/rider-route";

/**
 * Road route from `origin` through `destinations`. Returns null while loading,
 * when Mapbox is not configured, or when no road route exists; callers then
 * keep their straight-line fallback. GPS jitter does not re-request the route
 * until the origin has moved far enough or the cached route has aged out.
 */
export function useRoadRoute(
  origin: MapPoint | null,
  destinations: MapPoint[],
) {
  const latitude = origin?.latitude;
  const longitude = origin?.longitude;
  const destinationKey = destinationKeyFor(destinations);
  const [result, setResult] = useState<{
    destinationKey: string;
    route: RoadRoute | null;
  } | null>(null);
  const last = useRef<RouteRequest | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (!hasMapbox || latitude == null || longitude == null || !destinationKey)
      return;
    const from = { latitude, longitude };
    const now = Date.now();
    const movedKm = last.current
      ? distanceKm(last.current.origin, from)
      : Number.POSITIVE_INFINITY;
    if (!needsRouteRequest(last.current, destinationKey, movedKm, now)) return;

    last.current = { destinationKey, origin: from, at: now };
    const id = ++sequence.current;
    const points = [from, ...destinations];
    const settle = (route: RoadRoute | null) => {
      if (id === sequence.current) setResult({ destinationKey, route });
    };
    fetchRoadRoute(points).then(settle, () => settle(null));
  }, [latitude, longitude, destinationKey, destinations]);

  return result?.destinationKey === destinationKey ? result.route : null;
}
