import type { MapPoint } from "@/lib/delivery/map-projection";
import {
  ALL_YANGON_INTERCEPTION_POINTS,
  type InterceptionPoint,
  YANGON_SIDE_STREET_BYPASSES,
} from "./data/yangon-interception-points.ts";
import type { TrafficSignal } from "./energy-routing.ts";
import { haversineKilometers } from "./intelligence.ts";
import {
  buildSpeedGrid,
  type SpeedGrid,
  telemetryDelayAlongPath,
} from "./road-intel/speed-cells.ts";
import type { SpeedCell } from "./road-intel/types.ts";
import { priceRoadReport, scoreCost, ZERO_COST } from "./routing-cost.ts";
import {
  distanceToPathKm,
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
  /** Reported hazards on the route serious enough to be worth driving around. */
  hazards?: RouteHazard[];
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

export type RouteHazard = {
  id: string;
  latitude: number;
  longitude: number;
  /** How far the hazard reaches from its point. */
  radiusMeters: number;
  /** Short wording for the "avoided" banner. */
  label: string;
};

export type RoadRouteOptions = {
  roadReports?: RoadReport[];
  trafficLights?: readonly InterceptionPoint[];
  trafficSignals?: readonly TrafficSignal[];
  /** Recent rider-measured speeds; slow cells on a route add delay. */
  speedCells?: readonly SpeedCell[];
  now?: number;
};

const speedGrids = new WeakMap<readonly SpeedCell[], SpeedGrid>();
function speedGridFor(cells: readonly SpeedCell[]) {
  let grid = speedGrids.get(cells);
  if (!grid) {
    grid = buildSpeedGrid(cells);
    speedGrids.set(cells, grid);
  }
  return grid;
}

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
  telemetryDelayMin: number;
  totalDelayMin: number;
  junctionsEncountered: string[];
  isBlocked: boolean;
  hazards: RouteHazard[];
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

  // Match active road reports (congestion, closure, roadwork, hazards). A
  // report the road-intelligence engine has judged is priced by that
  // judgement instead of by the rider's raw category and severity.
  const nowMs = options?.now ?? Date.now();
  const hazards: RouteHazard[] = [];
  for (const report of reports) {
    const price = priceRoadReport(report, nowMs);
    if (!price) continue;
    if (distanceToPathKm(coordinates, report) > price.reachKm) continue;
    if (price.serious) {
      hazards.push({
        id: report.id,
        latitude: report.latitude,
        longitude: report.longitude,
        radiusMeters: Math.round(price.reachKm * 1000),
        label: `reported ${report.category}`,
      });
    }
    if (price.blocked) {
      isBlocked = true;
      reportDelayMin += 999;
    } else {
      reportDelayMin += price.delayMin;
    }
  }

  // Where riders have lately been crawling, the route will crawl too
  const telemetry = options?.speedCells?.length
    ? telemetryDelayAlongPath(speedGridFor(options.speedCells), coordinates)
    : { delayMin: 0, slowCells: 0 };
  reportDelayMin += telemetry.delayMin;

  return {
    signalDelayMin: signalDelayMinTotal,
    signalCount: hits.length,
    reportDelayMin,
    telemetryDelayMin: telemetry.delayMin,
    totalDelayMin: signalDelayMinTotal + reportDelayMin,
    junctionsEncountered: junctions,
    isBlocked,
    hazards,
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
  return scoreCost({
    ...ZERO_COST,
    durationSeconds: evaluation.effectiveDurationMin * 60,
    riskPenaltySeconds:
      evaluation.delays.signalCount * SIGNAL_AVERSION_MIN * 60,
  });
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
    route.hazards = delays.hazards;
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
      rankCost(a) - rankCost(b) || a.route.distanceKm - b.route.distanceKm,
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
              haversineKilometers({ latitude: lat, longitude: lng }, bp) <=
              0.05,
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

async function fetchWithBypass(
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
      return (
        signalsAlongPath(
          signalIndexFor([targetJunction], []),
          directRoute.coordinates,
          0.045,
        ).length > 0
      );
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

const DETOUR_MARGIN_M = 180;

/**
 * Two via-points either side of a hazard, far enough off the road that
 * Mapbox snaps them to a parallel street rather than back onto the hazard.
 */
export function detourWaypoints(
  coordinates: readonly (readonly [number, number])[],
  hazard: Pick<RouteHazard, "latitude" | "longitude" | "radiusMeters">,
): [MapPoint, MapPoint] | null {
  if (coordinates.length < 2) return null;
  let nearest = 0;
  let nearestSq = Number.POSITIVE_INFINITY;
  coordinates.forEach(([lng, lat], index) => {
    const sq = (lng - hazard.longitude) ** 2 + (lat - hazard.latitude) ** 2;
    if (sq < nearestSq) {
      nearestSq = sq;
      nearest = index;
    }
  });
  const before = coordinates[Math.max(0, nearest - 1)];
  const after = coordinates[Math.min(coordinates.length - 1, nearest + 1)];
  const kmPerDegLng = 111.32 * Math.cos((hazard.latitude * Math.PI) / 180);
  const dx = (after[0] - before[0]) * kmPerDegLng;
  const dy = (after[1] - before[1]) * 111.32;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  // Unit normal to the direction of travel
  const nx = -dy / length;
  const ny = dx / length;
  const offsetKm = (hazard.radiusMeters + DETOUR_MARGIN_M) / 1000;
  const at = (sign: number): MapPoint => ({
    latitude: hazard.latitude + (sign * ny * offsetKm) / 111.32,
    longitude: hazard.longitude + (sign * nx * offsetKm) / kmPerDegLng,
  });
  return [at(1), at(-1)];
}

/**
 * When the chosen route still runs through a hazard the engine says to avoid,
 * try a detour on each side of it and keep whichever costs least overall,
 * provided it beats driving through.
 */
async function withHazardDetour(
  points: MapPoint[],
  route: RoadRoute | null,
  options?: RoadRouteOptions,
  signal?: AbortSignal,
): Promise<RoadRoute | null> {
  const hazard = route?.hazards?.[0];
  if (!route || !hazard || points.length !== 2) return route;
  const via = detourWaypoints(route.coordinates, hazard);
  if (!via) return route;

  const probes = await Promise.all(
    via.map(async (waypoint) => {
      const body = await fetchDirections(
        directionsUrl([points[0], waypoint, points[1]], false),
        signal,
      );
      return body ? parseRoadRoute(body, options) : null;
    }),
  );
  let best: RoadRoute | null = null;
  for (const probe of probes) {
    if (!probe || probe.hazards?.some((item) => item.id === hazard.id))
      continue;
    if (!best || routeCost(probe) < routeCost(best)) best = probe;
  }
  if (!best || routeCost(best) >= routeCost(route)) return route;

  best.bypassInfo = {
    bypassRoad: "detour",
    bypassedJunction: hazard.label,
    timeSavedMin: Math.max(
      0.3,
      Math.round((effectiveMin(route) - effectiveMin(best)) * 10) / 10,
    ),
  };
  return best;
}

async function fetchRoadRouteChunk(
  points: MapPoint[],
  options?: RoadRouteOptions,
  signal?: AbortSignal,
): Promise<RoadRoute | null> {
  const route = await fetchWithBypass(points, options, signal);
  return withHazardDetour(points, route, options, signal);
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

/** Most specific first. Peripheral townships often have no street address, so they fall back to a neighbourhood or township. */
const PLACE_RANK = ["address", "poi", "neighborhood", "locality", "place"];

/** The country is redundant in a delivery address, so it is dropped from the label. */
const COUNTRY_SUFFIX = /,\s*Myanmar(\s*\(Burma\))?$/i;

/** How many features to ask for per place level. Mapbox rejects `limit` alongside more than one `types` value. */
export const REVERSE_GEOCODE_LIMIT = 5;

export function reverseGeocodeUrl(point: MapPoint, type: string) {
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    types: type,
    limit: String(REVERSE_GEOCODE_LIMIT),
  });
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.longitude},${point.latitude}.json?${params}`;
}

type GeocodeFeature = {
  place_name?: string;
  place_type?: string[];
  relevance?: number;
};

type GeocodeBody = { features?: GeocodeFeature[] };

/** Round-robin so equal-rank features keep Mapbox's relevance order instead of one type's block. */
function interleave(groups: GeocodeFeature[][]) {
  const merged: GeocodeFeature[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let i = 0; i < longest; i += 1) {
    for (const group of groups) {
      const feature = group[i];
      if (feature) merged.push(feature);
    }
  }
  return merged;
}

function placeRank(feature: GeocodeFeature) {
  const ranks = (feature.place_type ?? [])
    .map((type) => PLACE_RANK.indexOf(type))
    .filter((rank) => rank >= 0);
  return ranks.length ? Math.min(...ranks) : PLACE_RANK.length;
}

/**
 * The most specific named feature as a label, keeping Mapbox's relevance order
 * between features of equal rank.
 */
export function pickPlaceLabel(features: GeocodeFeature[]) {
  let best: GeocodeFeature | null = null;
  for (const feature of features) {
    if (!feature.place_name) continue;
    if (!best || placeRank(feature) < placeRank(best)) best = feature;
  }
  const label = best?.place_name?.replace(COUNTRY_SUFFIX, "").trim();
  return label || null;
}

/**
 * A human-readable place name for a picked point, or null if it can't be resolved.
 * One request per place level, because Mapbox only accepts `limit` with a single
 * `types` value; the results are merged back into relevance order.
 */
export async function reverseGeocode(point: MapPoint, signal?: AbortSignal) {
  if (!hasMapbox) return null;
  try {
    const groups = await Promise.all(
      PLACE_RANK.map(async (type) => {
        const response = await fetch(reverseGeocodeUrl(point, type), {
          signal,
        });
        if (!response.ok) return [];
        const body = (await response.json()) as GeocodeBody;
        return body.features ?? [];
      }),
    );
    return pickPlaceLabel(interleave(groups));
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
