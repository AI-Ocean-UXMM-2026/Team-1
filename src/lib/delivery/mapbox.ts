import type { MapPoint } from "@/lib/delivery/map-projection";
import {
  ALL_YANGON_INTERCEPTION_POINTS,
  type InterceptionPoint,
  YANGON_SIDE_STREET_BYPASSES,
} from "./data/yangon-interception-points.ts";
import type { TrafficSignal } from "./energy-routing.ts";
import { haversineKilometers } from "./intelligence.ts";
import {
  signalDelayMin,
  signalIndexFor,
  signalsAlongPath,
} from "./signal-index.ts";
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
  /** Signalised junctions the route passes through. */
  signalCount?: number;
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
  signalCount: number;
  reportDelayMin: number;
  totalDelayMin: number;
  junctionsEncountered: string[];
  isBlocked: boolean;
} {
  const reports = options?.roadReports ?? [];

  let signalDelayMinTotal = 0;
  let reportDelayMin = 0;
  let isBlocked = false;
  const junctions: string[] = [];

  // Every light and arterial signal the path passes, in driving order
  const hits = signalsAlongPath(
    signalIndexFor(options?.trafficLights, options?.trafficSignals),
    coordinates,
  );
  for (const hit of hits) {
    signalDelayMinTotal += signalDelayMin(hit.node.estimatedCycleSeconds);
    junctions.push(hit.node.name);
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
    signalDelayMin: signalDelayMinTotal,
    signalCount: hits.length,
    reportDelayMin,
    totalDelayMin: signalDelayMinTotal + reportDelayMin,
    junctionsEncountered: junctions,
    isBlocked,
  };
}

/**
 * Soft cost, in minutes, of each signalised junction when ranking candidate
 * routes. Stopping also burns fuel and rider patience, so between two routes
 * of similar time the one with fewer lights wins. It only ranks; it is never
 * added to the ETA shown to the rider.
 */
export const SIGNAL_AVERSION_MIN = 0.2;

function rankCost(evaluation: {
  effectiveDurationMin: number;
  delays: { signalCount: number };
}) {
  return (
    evaluation.effectiveDurationMin +
    evaluation.delays.signalCount * SIGNAL_AVERSION_MIN
  );
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

  // Evaluate candidate routes
  const evaluations = parsedRoutes.map((route) => {
    const delays = evaluateRouteTraffic(route.coordinates, options);
    const effectiveDurationMin =
      Math.round((route.durationMin + delays.totalDelayMin) * 10) / 10;
    route.signalCount = delays.signalCount;
    return {
      route,
      delays,
      effectiveDurationMin,
    };
  });

  if (evaluations.length === 1) {
    evaluations[0].route.effectiveDurationMin =
      evaluations[0].effectiveDurationMin;
    return evaluations[0].route;
  }

  const primary = evaluations[0];

  // Fastest once red lights and reports are priced in; fewer lights, then
  // shorter distance, break ties
  evaluations.sort(
    (a, b) =>
      rankCost(a) - rankCost(b) ||
      a.route.distanceKm - b.route.distanceKm,
  );

  const winning = evaluations[0];
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
      primary.delays.junctionsEncountered.find(
        (name) => !winning.delays.junctionsEncountered.includes(name),
      ) ??
      primary.delays.junctionsEncountered[0] ??
      "congested traffic junction";

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

/** Directions responses stay valid this long; the road network barely changes. */
const DIRECTIONS_TTL_MS = 45_000;
const DIRECTIONS_CACHE_MAX = 40;
const directionsCache = new Map<
  string,
  { at: number; body: Promise<DirectionsBody | null> }
>();

/**
 * One Directions request per URL at a time, reused for a short while. Several
 * map components ask for the same leg, and the bypass probe repeats the
 * direct request's coordinates, so this saves round trips on every tick.
 * An aborted caller resolves null without cancelling the shared request.
 */
function fetchDirections(
  url: string,
  signal?: AbortSignal,
): Promise<DirectionsBody | null> {
  if (signal?.aborted) return Promise.resolve(null);
  const now = Date.now();
  let entry = directionsCache.get(url);
  if (!entry || now - entry.at >= DIRECTIONS_TTL_MS) {
    const body: Promise<DirectionsBody | null> = fetch(url)
      .then((response) =>
        response.ok ? (response.json() as Promise<DirectionsBody>) : null,
      )
      .catch(() => null);
    entry = { at: now, body };
    directionsCache.set(url, entry);
    void body.then((value) => {
      if (value == null && directionsCache.get(url) === entry)
        directionsCache.delete(url);
    });
    if (directionsCache.size > DIRECTIONS_CACHE_MAX) {
      const oldest = directionsCache.keys().next().value;
      if (oldest !== undefined) directionsCache.delete(oldest);
    }
  }
  const { body } = entry;
  if (!signal) return body;
  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(null), { once: true });
    void body.then(resolve);
  });
}

const effectiveMin = (route: RoadRoute) =>
  route.effectiveDurationMin ?? route.durationMin;

const routeCost = (route: RoadRoute) =>
  effectiveMin(route) + (route.signalCount ?? 0) * SIGNAL_AVERSION_MIN;

async function fetchRoadRouteChunk(
  points: MapPoint[],
  options?: RoadRouteOptions,
  signal?: AbortSignal,
): Promise<RoadRoute | null> {
  if (points.length < 2) return null;
  const body = await fetchDirections(directionsUrl(points, true), signal);
  if (!body) return null;
  try {
    const directRoute = parseRoadRoute(body, options);

    // The direct route may still run through a light that has a known
    // side-street bypass. Probe every such bypass at once and keep the
    // quickest, instead of trying them one after another.
    if (!directRoute || points.length !== 2 || !hasMapbox) return directRoute;

    const bypasses = YANGON_SIDE_STREET_BYPASSES.filter((bp) => {
      if (!bp.bypassesPointId) return false;
      const targetJunction = ALL_YANGON_INTERCEPTION_POINTS.find(
        (p) => p.id === bp.bypassesPointId,
      );
      if (!targetJunction) return false;
      return signalsAlongPath(
        signalIndexFor([targetJunction], []),
        directRoute.coordinates,
        0.045,
      ).length > 0;
    });
    if (!bypasses.length) return directRoute;

    const probed = await Promise.all(
      bypasses.map(async (bypass) => {
        const probeBody = await fetchDirections(
          directionsUrl([points[0], bypass, points[1]], false),
          signal,
        );
        const route = probeBody ? parseRoadRoute(probeBody, options) : null;
        return route ? { bypass, route } : null;
      }),
    );

    let best: { bypass: (typeof bypasses)[number]; route: RoadRoute } | null =
      null;
    for (const candidate of probed) {
      if (!candidate) continue;
      if (!best || routeCost(candidate.route) < routeCost(best.route))
        best = candidate;
    }
    if (!best) return directRoute;

    // Only a cut in total cost beats the direct route, matching the ranking
    // used between Mapbox's own alternatives
    if (routeCost(best.route) >= routeCost(directRoute)) return directRoute;
    const saved = Math.max(
      0.3,
      Math.round((effectiveMin(directRoute) - effectiveMin(best.route)) * 10) /
        10,
    );
    best.route.bypassInfo = {
      bypassRoad: best.bypass.road ?? "Sain Yadanar Rd",
      bypassedJunction: "traffic junction",
      timeSavedMin: saved,
    };
    return best.route;
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
  let totalEffectiveMin = 0;
  let totalSignals = 0;
  let timeSavedMin = 0;
  let bypassInfo: RoadRoute["bypassInfo"] = null;
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
    totalEffectiveMin += effectiveMin(chunkRoute);
    totalSignals += chunkRoute.signalCount ?? 0;
    allSpeedLimits.push(...chunkRoute.speedLimitsKmh);
    if (chunkRoute.bypassInfo) {
      timeSavedMin += chunkRoute.bypassInfo.timeSavedMin;
      bypassInfo ??= chunkRoute.bypassInfo;
    }
  }

  return {
    coordinates: allCoordinates,
    distanceKm: totalDistanceKm,
    durationMin: totalDurationMin,
    effectiveDurationMin: Math.round(totalEffectiveMin * 10) / 10,
    signalCount: totalSignals,
    bypassInfo: bypassInfo
      ? { ...bypassInfo, timeSavedMin: Math.round(timeSavedMin * 10) / 10 }
      : null,
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
