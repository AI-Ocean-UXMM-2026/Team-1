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
  /**
   * Posted speed limit in km/h for each road segment (coordinate i to i+1),
   * null where Mapbox has none. Empty when the route carries no annotations.
   */
  speedLimitsKmh: (number | null)[];
  /** The first manoeuvre from the origin, when Mapbox provides one. */
  firstStep: {
    instruction: string;
    distanceKm: number;
    maneuverType?: string;
    maneuverModifier?: string;
  } | null;
};

export type DirectionsBody = {
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs?: {
      annotation?: {
        maxspeed?: {
          speed?: number;
          unit?: "km/h" | "mph";
          unknown?: boolean;
          none?: boolean;
        }[];
      };
      steps?: {
        distance: number;
        maneuver?: {
          instruction?: string;
          type?: string;
          modifier?: string;
        };
      }[];
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

function parseSpeedLimits(
  maxspeed: NonNullable<
    NonNullable<
      NonNullable<DirectionsBody["routes"]>[number]["legs"]
    >[number]["annotation"]
  >["maxspeed"],
): (number | null)[] {
  return (maxspeed ?? []).map((item) =>
    item.speed == null || item.unknown || item.none
      ? null
      : Math.round(item.unit === "mph" ? item.speed * 1.609344 : item.speed),
  );
}

/**
 * The posted limit (km/h) on the stretch of road nearest to `point`, or null
 * when the route has no limit data there. Limits are indexed by segment, so
 * the nearest route coordinate stands in for the segment that starts at it.
 */
export function speedLimitAt(
  route: Pick<RoadRoute, "coordinates" | "speedLimitsKmh">,
  point: MapPoint,
): number | null {
  if (!route.speedLimitsKmh.length) return null;
  const cosLat = Math.cos((point.latitude * Math.PI) / 180);
  let best = -1;
  let bestSq = Number.POSITIVE_INFINITY;
  const last = Math.min(route.coordinates.length, route.speedLimitsKmh.length);
  for (let index = 0; index < last; index++) {
    const [longitude, latitude] = route.coordinates[index];
    const dx = (longitude - point.longitude) * cosLat;
    const dy = latitude - point.latitude;
    const sq = dx * dx + dy * dy;
    if (sq < bestSq) {
      bestSq = sq;
      best = index;
    }
  }
  return best < 0 ? null : (route.speedLimitsKmh[best] ?? null);
}

export function parseRoadRoute(body: DirectionsBody): RoadRoute | null {
  const route = body.routes?.[0];
  if (!route || route.geometry.coordinates.length < 2) return null;
  const speedLimitsKmh = parseSpeedLimits(
    route.legs?.[0]?.annotation?.maxspeed,
  );
  const step = route.legs?.[0]?.steps?.[0];
  const maneuver = step?.maneuver;
  if (!maneuver?.instruction) {
    return {
      coordinates: route.geometry.coordinates,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      speedLimitsKmh,
      firstStep: null,
    };
  }
  const firstStep: {
    instruction: string;
    distanceKm: number;
    maneuverType?: string;
    maneuverModifier?: string;
  } = {
    instruction: maneuver.instruction,
    distanceKm: (step?.distance ?? 0) / 1000,
  };
  if (maneuver.type) firstStep.maneuverType = maneuver.type;
  if (maneuver.modifier) firstStep.maneuverModifier = maneuver.modifier;

  return {
    coordinates: route.geometry.coordinates,
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    speedLimitsKmh,
    firstStep,
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
    annotations: "maxspeed",
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

export type PlaceSuggestion = {
  id: string;
  name: string;
  detail: string;
  point: MapPoint;
};

type SearchBody = {
  features?: {
    id: string;
    text?: string;
    place_name?: string;
    center?: [number, number];
  }[];
};

/**
 * Address and place suggestions for typed text, biased toward `near` and kept
 * inside Myanmar. Returns an empty list when Mapbox is off or the lookup fails.
 */
export async function searchPlaces(
  query: string,
  near: MapPoint | null,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const text = query.trim();
  if (!hasMapbox || text.length < 3) return [];
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    country: "mm",
    autocomplete: "true",
    types: "address,poi,neighborhood,locality,place",
    limit: "5",
  });
  if (near) params.set("proximity", `${near.longitude},${near.latitude}`);
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?${params}`,
      { signal },
    );
    if (!response.ok) return [];
    const body = (await response.json()) as SearchBody;
    return (body.features ?? []).flatMap((feature) => {
      if (!feature.center || !feature.place_name) return [];
      const name = feature.text ?? feature.place_name;
      const detail = feature.place_name.startsWith(name)
        ? feature.place_name.slice(name.length).replace(/^,\s*/, "")
        : feature.place_name;
      return [
        {
          id: feature.id,
          name,
          detail,
          point: { longitude: feature.center[0], latitude: feature.center[1] },
        },
      ];
    });
  } catch {
    return [];
  }
}
