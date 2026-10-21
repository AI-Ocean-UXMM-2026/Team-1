import {
  YANGON_FUEL_STATIONS,
  YANGON_TRAFFIC_SIGNALS,
} from "./energy-routing.ts";

export type OsmFuelStation = {
  id: string;
  name: string;
  brand: string;
  latitude: number;
  longitude: number;
  township?: string;
  road?: string;
  fuels?: {
    diesel?: boolean;
    octane92?: boolean;
    octane95?: boolean;
    cng?: boolean;
  };
  openingHours?: string;
  source: "osm_overpass" | "osm_api" | "curated_cache";
};

export type OsmTrafficSignal = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  crossing?: boolean;
  direction?: string;
  source: "osm_overpass" | "osm_api" | "curated_cache";
};

export type OsmBbox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** Default bounding box covering the greater Yangon metropolitan area. */
export const YANGON_METRO_BBOX: OsmBbox = {
  south: 16.7,
  west: 96.0,
  north: 17.05,
  east: 96.3,
};

/** Primary and mirror Overpass API endpoints. */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
] as const;

/**
 * Builds an Overpass QL query targeting fuel stations and traffic signals
 * within a bounding box.
 */
export function buildOverpassQuery(
  bbox: OsmBbox = YANGON_METRO_BBOX,
  timeoutSeconds = 25,
): string {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:${timeoutSeconds}];
(
  node["amenity"="fuel"](${south},${west},${north},${east});
  way["amenity"="fuel"](${south},${west},${north},${east});
  node["highway"="traffic_signals"](${south},${west},${north},${east});
);
out body center;`;
}

/** Parses Overpass API JSON response elements into typed objects. */
export function parseOverpassJson(data: {
  elements?: Array<Record<string, unknown>>;
}): {
  fuelStations: OsmFuelStation[];
  trafficSignals: OsmTrafficSignal[];
} {
  const fuelStations: OsmFuelStation[] = [];
  const trafficSignals: OsmTrafficSignal[] = [];

  for (const el of data.elements ?? []) {
    const tags = (el.tags ?? {}) as Record<string, string>;
    const lat = Number(el.lat ?? (el.center as Record<string, unknown>)?.lat);
    const lon = Number(el.lon ?? (el.center as Record<string, unknown>)?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    if (tags.amenity === "fuel") {
      const brand = tags.brand ?? tags.operator ?? tags.name ?? "Independent";
      const name = tags.name ?? tags["name:en"] ?? `${brand} Station`;
      fuelStations.push({
        id: `osm-${el.id}`,
        name,
        brand,
        latitude: lat,
        longitude: lon,
        township: tags["addr:city"] ?? tags["addr:district"],
        road: tags["addr:street"],
        fuels: {
          diesel: tags["fuel:diesel"] === "yes",
          octane92:
            tags["fuel:octane_92"] === "yes" ||
            tags["fuel:octane_91"] === "yes",
          octane95: tags["fuel:octane_95"] === "yes",
          cng: tags["fuel:cng"] === "yes",
        },
        openingHours: tags.opening_hours,
        source: "osm_overpass",
      });
    }

    if (tags.highway === "traffic_signals") {
      const name =
        tags.name ??
        tags.description ??
        (tags["addr:street"]
          ? `${tags["addr:street"]} Signal`
          : `Signal #${el.id}`);
      trafficSignals.push({
        id: `osm-${el.id}`,
        name,
        latitude: lat,
        longitude: lon,
        crossing: tags.crossing === "traffic_signals",
        direction: tags["traffic_signals:direction"],
        source: "osm_overpass",
      });
    }
  }

  return { fuelStations, trafficSignals };
}

/**
 * Fetches fuel stations and traffic signals from Overpass API.
 * Automatically tries available endpoints and falls back to curated cache
 * when public servers are at capacity (e.g. 502/504 or network timeout).
 */
export async function fetchOsmYangonData(
  options: {
    bbox?: OsmBbox;
    timeoutMs?: number;
    endpoints?: readonly string[];
  } = {},
): Promise<{
  fuelStations: OsmFuelStation[];
  trafficSignals: OsmTrafficSignal[];
  endpointUsed: string | null;
  fromCache: boolean;
}> {
  const bbox = options.bbox ?? YANGON_METRO_BBOX;
  const timeoutMs = options.timeoutMs ?? 10000;
  const endpoints = options.endpoints ?? OVERPASS_ENDPOINTS;
  const query = buildOverpassQuery(bbox);

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent":
            "OernDeliveryApp/1.0 (contact@oern.delivery; https://oern.delivery)",
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) continue;

      const json = await res.json();
      const parsed = parseOverpassJson(json);

      if (parsed.fuelStations.length > 0 || parsed.trafficSignals.length > 0) {
        return {
          ...parsed,
          endpointUsed: endpoint,
          fromCache: false,
        };
      }
    } catch {
      // Continue to next mirror on timeout or connection error
    }
  }

  // Fallback to verified local Yangon dataset if Overpass servers are overloaded
  return {
    fuelStations: YANGON_FUEL_STATIONS.map((s, index) => ({
      id: `cache-${index + 1}`,
      name: s.name,
      brand: s.brand,
      latitude: s.latitude,
      longitude: s.longitude,
      township: s.township,
      road: s.road,
      source: "curated_cache",
    })),
    trafficSignals: YANGON_TRAFFIC_SIGNALS.map((s, index) => ({
      id: `cache-${index + 1}`,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      source: "curated_cache",
    })),
    endpointUsed: null,
    fromCache: true,
  };
}
