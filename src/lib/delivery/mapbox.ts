import type { MapPoint } from "@/lib/delivery/map-projection";

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const hasMapbox = MAPBOX_TOKEN.length > 0;

/** Re-request the road route only after the origin has moved this far… */
export const ROUTE_MOVE_KM = 0.15;
/** …or once the cached route is this old, whichever comes first. */
export const ROUTE_MAX_AGE_MS = 60_000;

export type RoadRoute = {
  /** Longitude, latitude pairs along the road. */
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  /** The first manoeuvre from the origin, when Mapbox provides one. */
  firstStep: { instruction: string; distanceKm: number } | null;
};

export type DirectionsBody = {
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs?: {
      steps?: { distance: number; maneuver?: { instruction?: string } }[];
    }[];
  }[];
};

export type RouteRequest = {
  destinationKey: string;
  origin: MapPoint;
  at: number;
};

/** Oern's own Mapbox Studio style, used for every map. */
export const MAP_STYLE =
  "mapbox://styles/happer64bit/clnpqzscu00dj01qqhgrkhawy";

export function mapStyle() {
  return MAP_STYLE;
}

export function parseRoadRoute(body: DirectionsBody): RoadRoute | null {
  const route = body.routes?.[0];
  if (!route || route.geometry.coordinates.length < 2) return null;
  const step = route.legs?.[0]?.steps?.[0];
  return {
    coordinates: route.geometry.coordinates,
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    firstStep: step?.maneuver?.instruction
      ? {
          instruction: step.maneuver.instruction,
          distanceKm: step.distance / 1000,
        }
      : null,
  };
}

export function directionsUrl(points: MapPoint[]) {
  const path = points
    .map((point) => `${point.longitude},${point.latitude}`)
    .join(";");
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "true",
    access_token: MAPBOX_TOKEN,
  });
  return `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${path}?${params}`;
}

export async function fetchRoadRoute(points: MapPoint[], signal?: AbortSignal) {
  if (!hasMapbox || points.length < 2) return null;
  const response = await fetch(directionsUrl(points), { signal });
  if (!response.ok) return null;
  try {
    return parseRoadRoute((await response.json()) as DirectionsBody);
  } catch {
    return null;
  }
}

export function reverseGeocodeUrl(point: MapPoint) {
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    types: "address,place",
    limit: "1",
  });
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.longitude},${point.latitude}.json?${params}`;
}

type GeocodeBody = { features?: { place_name?: string }[] };

/** A human-readable place name for a picked point, or null if it can't be resolved. */
export async function reverseGeocode(point: MapPoint, signal?: AbortSignal) {
  if (!hasMapbox) return null;
  try {
    const response = await fetch(reverseGeocodeUrl(point), { signal });
    if (!response.ok) return null;
    const body = (await response.json()) as GeocodeBody;
    return body.features?.[0]?.place_name ?? null;
  } catch {
    return null;
  }
}

export function destinationKeyFor(points: MapPoint[]) {
  return points
    .map((point) => `${point.latitude},${point.longitude}`)
    .join(";");
}

/** `movedKm` is how far the origin is from the last request's origin. */
export function needsRouteRequest(
  last: Pick<RouteRequest, "destinationKey" | "at"> | null,
  destinationKey: string,
  movedKm: number,
  now: number,
) {
  return (
    !last ||
    last.destinationKey !== destinationKey ||
    movedKm > ROUTE_MOVE_KM ||
    now - last.at >= ROUTE_MAX_AGE_MS
  );
}

export function formatDriveMinutes(minutes: number | null) {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
