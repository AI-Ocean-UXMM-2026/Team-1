import type { MapPoint } from "@/lib/delivery/map-projection";
import {
  ALL_YANGON_INTERCEPTION_POINTS,
  type InterceptionPoint,
  YANGON_SIDE_STREET_BYPASSES,
} from "./data/yangon-interception-points.ts";
import {
  type TrafficSignal,
  YANGON_TRAFFIC_SIGNALS,
} from "./energy-routing.ts";
import { haversineKilometers } from "./intelligence.ts";
import type { RoadReport } from "./types.ts";

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
  /** Effective duration in minutes factoring in traffic delays, red lights, and road reports */
  effectiveDurationMin?: number;
  /** Side-street bypass details when an alternative bypass route was selected */
  bypassInfo?: {
    bypassRoad: string;
    bypassedJunction: string;
    timeSavedMin: number;
  } | null;
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

export type RoadRouteOptions = {
  roadReports?: RoadReport[];
  trafficLights?: readonly InterceptionPoint[];
  trafficSignals?: readonly TrafficSignal[];
  now?: number;
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

function parseSingleRoute(
  route: NonNullable<DirectionsBody["routes"]>[number],
): RoadRoute {
  const speedLimitsKmh = (route.legs ?? []).flatMap((leg) =>
    parseSpeedLimits(leg.annotation?.maxspeed),
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

/**
 * Evaluates traffic lights, cycle red-light delays, and active road reports
 * along route coordinates to compute realistic traversal delay.
 */
export function evaluateRouteTraffic(
  coordinates: [number, number][],
  options?: RoadRouteOptions,
): {
  signalDelayMin: number;
  reportDelayMin: number;
  totalDelayMin: number;
  junctionsEncountered: string[];
  isBlocked: boolean;
} {
  const lights = options?.trafficLights ?? ALL_YANGON_INTERCEPTION_POINTS;
  const signals = options?.trafficSignals ?? YANGON_TRAFFIC_SIGNALS;
  const reports = options?.roadReports ?? [];

  let signalDelayMin = 0;
  let reportDelayMin = 0;
  let isBlocked = false;
  const junctions: string[] = [];

  // Match traffic lights along route coordinates
  const matchedLightIds = new Set<string>();
  for (const tl of lights) {
    if (tl.type !== "traffic_light") continue;
    for (const [lng, lat] of coordinates) {
      if (haversineKilometers({ latitude: lat, longitude: lng }, tl) <= 0.045) {
        if (!matchedLightIds.has(tl.id)) {
          matchedLightIds.add(tl.id);
          const delay = Math.max(0.5, (tl.estimatedCycleSeconds * 0.55) / 60 + 0.2);
          signalDelayMin += delay;
          junctions.push(tl.name);
        }
        break;
      }
    }
  }

  // Match arterial signals along route coordinates
  const matchedSigNames = new Set<string>();
  for (const sig of signals) {
    for (const [lng, lat] of coordinates) {
      if (haversineKilometers({ latitude: lat, longitude: lng }, sig) <= 0.045) {
        if (!matchedSigNames.has(sig.name)) {
          matchedSigNames.add(sig.name);
          const delay = Math.max(0.5, (sig.estimatedCycleSeconds * 0.55) / 60 + 0.2);
          signalDelayMin += delay;
          junctions.push(sig.name);
        }
        break;
      }
    }
  }

  // Match active road reports (congestion, closure, roadwork, hazards)
  for (const report of reports) {
    if (report.status === "rejected") continue;
    for (const [lng, lat] of coordinates) {
      if (haversineKilometers({ latitude: lat, longitude: lng }, report) <= 0.055) {
        if (report.category === "closure") {
          isBlocked = true;
          reportDelayMin += 999;
        } else if (report.category === "congestion") {
          reportDelayMin +=
            report.severity === "high" ? 4.5 : report.severity === "medium" ? 2.5 : 1.5;
        } else {
          reportDelayMin += report.severity === "high" ? 3.5 : 2.0;
        }
        break;
      }
    }
  }

  return {
    signalDelayMin,
    reportDelayMin,
    totalDelayMin: signalDelayMin + reportDelayMin,
    junctionsEncountered: junctions,
    isBlocked,
  };
}

export function parseRoadRoute(
  body: DirectionsBody,
  options?: RoadRouteOptions,
): RoadRoute | null {
  const routes = body.routes;
  if (!routes || routes.length === 0) return null;
  const parsedRoutes = routes
    .map((r) => parseSingleRoute(r))
    .filter((r) => r.coordinates.length >= 2);
  if (!parsedRoutes.length) return null;

  if (parsedRoutes.length === 1) {
    const single = parsedRoutes[0];
    const delays = evaluateRouteTraffic(single.coordinates, options);
    single.effectiveDurationMin =
      Math.round((single.durationMin + delays.totalDelayMin) * 10) / 10;
    return single;
  }

  // Evaluate candidate routes
  const evaluations = parsedRoutes.map((route) => {
    const delays = evaluateRouteTraffic(route.coordinates, options);
    const effectiveDurationMin =
      Math.round((route.durationMin + delays.totalDelayMin) * 10) / 10;
    return {
      route,
      delays,
      effectiveDurationMin,
    };
  });

  // Sort by effective duration first, then distance
  evaluations.sort(
    (a, b) =>
      a.effectiveDurationMin - b.effectiveDurationMin ||
      a.route.distanceKm - b.route.distanceKm,
  );

  const winning = evaluations[0];
  const primary =
    evaluations.find((e) => parsedRoutes[0] === e.route) ?? evaluations[0];

  winning.route.effectiveDurationMin = winning.effectiveDurationMin;

  // If the winning route avoids bottlenecks that the default arterial route entered:
  if (
    winning !== primary ||
    (primary.delays.totalDelayMin > 0.4 &&
      winning.delays.totalDelayMin < primary.delays.totalDelayMin)
  ) {
    const timeSavedMin = Math.max(
      0.3,
      Math.round(
        (primary.effectiveDurationMin - winning.effectiveDurationMin) * 10,
      ) / 10,
    );

    // Detect if the winning route used a named bypass road like Sain Yadanar Road
    let bypassRoad = "side-street bypass";
    const winningIdx = parsedRoutes.indexOf(winning.route);
    const allSteps =
      routes[winningIdx]?.legs?.flatMap((l) => l.steps ?? []) ?? [];
    for (const step of allSteps) {
      const stepName =
        (step.maneuver?.instruction ?? "") +
        " " +
        ((step as { name?: string }).name ?? "");
      if (
        stepName.toLowerCase().includes("sain yadanar") ||
        stepName.includes("စိန်ရတနာ")
      ) {
        bypassRoad = "Sain Yadanar Rd";
        break;
      }
    }
    if (bypassRoad === "side-street bypass") {
      for (const bp of YANGON_SIDE_STREET_BYPASSES) {
        if (
          winning.route.coordinates.some(
            ([lng, lat]) =>
              haversineKilometers({ latitude: lat, longitude: lng }, bp) <= 0.05,
          )
        ) {
          bypassRoad = bp.road ?? bp.name;
          break;
        }
      }
    }

    const bypassedJunction =
      primary.delays.junctionsEncountered[0] ?? "congested traffic junction";

    winning.route.bypassInfo = {
      bypassRoad,
      bypassedJunction,
      timeSavedMin,
    };
  }

  return winning.route;
}

export function directionsUrl(points: MapPoint[], alternatives = true) {
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
  if (alternatives && points.length === 2) {
    params.set("alternatives", "true");
  }
  return `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${path}?${params}`;
}

async function fetchRoadRouteChunk(
  points: MapPoint[],
  options?: RoadRouteOptions,
  signal?: AbortSignal,
): Promise<RoadRoute | null> {
  if (points.length < 2) return null;
  const response = await fetch(directionsUrl(points, true), { signal });
  if (!response.ok) return null;
  try {
    const directRoute = parseRoadRoute(
      (await response.json()) as DirectionsBody,
      options,
    );

    // If only 1 route was returned or direct route didn't use a bypass,
    // but the direct route intersects a junction that has a known bypass waypoint:
    if (
      directRoute &&
      points.length === 2 &&
      !directRoute.bypassInfo &&
      hasMapbox
    ) {
      const junctionBypass = YANGON_SIDE_STREET_BYPASSES.find((bp) => {
        if (!bp.bypassesPointId) return false;
        const targetJunction = ALL_YANGON_INTERCEPTION_POINTS.find(
          (p) => p.id === bp.bypassesPointId,
        );
        if (!targetJunction) return false;
        return directRoute.coordinates.some(
          ([lng, lat]) =>
            haversineKilometers(
              { latitude: lat, longitude: lng },
              targetJunction,
            ) <= 0.045,
        );
      });

      if (junctionBypass) {
        try {
          const bypassPoints = [points[0], junctionBypass, points[1]];
          const bypassResp = await fetch(directionsUrl(bypassPoints, false), {
            signal,
          });
          if (bypassResp.ok) {
            const bypassRoute = parseRoadRoute(
              (await bypassResp.json()) as DirectionsBody,
              options,
            );
            if (
              bypassRoute &&
              (bypassRoute.effectiveDurationMin ?? bypassRoute.durationMin) <
                (directRoute.effectiveDurationMin ?? directRoute.durationMin)
            ) {
              const saved = Math.max(
                0.3,
                Math.round(
                  ((directRoute.effectiveDurationMin ??
                    directRoute.durationMin) -
                    (bypassRoute.effectiveDurationMin ??
                      bypassRoute.durationMin)) *
                    10,
                ) / 10,
              );
              bypassRoute.bypassInfo = {
                bypassRoad: junctionBypass.road ?? "Sain Yadanar Rd",
                bypassedJunction: "traffic junction",
                timeSavedMin: saved,
              };
              return bypassRoute;
            }
          }
        } catch {
          // Keep directRoute if bypass query fails
        }
      }
    }

    return directRoute;
  } catch {
    return null;
  }
}

export async function fetchRoadRoute(
  points: MapPoint[],
  options?: RoadRouteOptions,
  signal?: AbortSignal,
): Promise<RoadRoute | null> {
  if (!hasMapbox || points.length < 2) return null;
  if (points.length <= 25) {
    return fetchRoadRouteChunk(points, options, signal);
  }

  // Mapbox directions allows at most 25 coordinates per request.
  // Chunk with 1 overlapping point between consecutive chunks.
  const chunks: MapPoint[][] = [];
  let index = 0;
  while (index < points.length - 1) {
    const nextIndex = Math.min(index + 25, points.length);
    chunks.push(points.slice(index, nextIndex));
    index = nextIndex - 1;
  }

  const results = await Promise.all(
    chunks.map((chunk) => fetchRoadRouteChunk(chunk, options, signal)),
  );
  if (results.some((r) => r == null)) return null;

  const valid = results as RoadRoute[];
  const allCoordinates: [number, number][] = [];
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  const allSpeedLimits: (number | null)[] = [];

  for (let i = 0; i < valid.length; i++) {
    const chunkRoute = valid[i];
    if (i === 0) {
      allCoordinates.push(...chunkRoute.coordinates);
    } else {
      allCoordinates.push(...chunkRoute.coordinates.slice(1));
    }
    totalDistanceKm += chunkRoute.distanceKm;
    totalDurationMin += chunkRoute.durationMin;
    allSpeedLimits.push(...chunkRoute.speedLimitsKmh);
  }

  return {
    coordinates: allCoordinates,
    distanceKm: totalDistanceKm,
    durationMin: totalDurationMin,
    speedLimitsKmh: allSpeedLimits,
    firstStep: valid[0]?.firstStep ?? null,
  };
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
