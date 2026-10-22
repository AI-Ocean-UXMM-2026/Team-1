import type { LiveFloodConditions } from "@/lib/delivery/dispatch/open-meteo";
import type { RoadReport } from "@/lib/delivery/types";

export type FloodHazardClass = 1 | 2 | 3;

export type FloodZone = {
  id: string;
  name: string;
  hazardClass: FloodHazardClass;
  severity: "moderate" | "high" | "severe";
  description: string;
  waterDepthEstimateCm: number;
  flowRisk: "standing" | "flowing" | "torrential";
  /** Polygon ring formatted as [longitude, latitude][] */
  coordinates: [number, number][];
  center: { latitude: number; longitude: number };
  advisory: string;
};

export type RouteFloodRisk = {
  hasFloodRisk: boolean;
  intersectedZones: FloodZone[];
  nearbyFloodReports: RoadReport[];
  totalExposureKm: number;
  suggestedSlowdownPercent: number;
  warningMessage: string | null;
};

export type GeoJsonLike = {
  features?: {
    properties?: Record<string, unknown> | null;
    geometry?: { type?: string; coordinates?: unknown } | null;
  }[];
};

/**
 * Historical and monsoon flood-prone corridors across Yangon.
 * Coordinates are formatted as [longitude, latitude] to match GeoJSON / Mapbox conventions.
 */
export const YANGON_FLOOD_ZONES: FloodZone[] = [
  {
    id: "flood-zone-thingangyun",
    name: "Thingangyun Canal Corridor",
    hazardClass: 2,
    severity: "high",
    description: "Low-lying creek overflow zone connecting Pazundaung and Thingangyun basin.",
    waterDepthEstimateCm: 35,
    flowRisk: "flowing",
    coordinates: [
      [96.182, 16.804],
      [96.204, 16.808],
      [96.208, 16.824],
      [96.186, 16.828],
      [96.176, 16.816],
      [96.182, 16.804],
    ],
    center: { latitude: 16.816, longitude: 96.192 },
    advisory: "Water over road during monsoon downpours. High clearance or alternative arterial recommended.",
  },
  {
    id: "flood-zone-hlaing-bayintnaung",
    name: "Hlaing River Lowlands & Bayintnaung",
    hazardClass: 3,
    severity: "severe",
    description: "Tidal riverfront drainage basin with frequent monsoon backflow and deep waterlogging.",
    waterDepthEstimateCm: 55,
    flowRisk: "torrential",
    coordinates: [
      [96.08, 16.862],
      [96.102, 16.866],
      [96.106, 16.896],
      [96.085, 16.904],
      [96.072, 16.878],
      [96.08, 16.862],
    ],
    center: { latitude: 16.882, longitude: 96.091 },
    advisory: "Severe flooding risk. Avoid light vehicles and e-bikes when river discharge exceeds 40 m³/s.",
  },
  {
    id: "flood-zone-pazundaung-tamwe",
    name: "Pazundaung Creek Basin (Tamwe)",
    hazardClass: 2,
    severity: "high",
    description: "Runoff gathering basin along lower arterial junctions and Kyaikkasan corridor.",
    waterDepthEstimateCm: 30,
    flowRisk: "standing",
    coordinates: [
      [96.162, 16.786],
      [96.182, 16.79],
      [96.186, 16.812],
      [96.168, 16.818],
      [96.156, 16.802],
      [96.162, 16.786],
    ],
    center: { latitude: 16.802, longitude: 96.172 },
    advisory: "Water accumulation on road shoulders. Add 10-15 minute transit buffer.",
  },
  {
    id: "flood-zone-inya-kamayut",
    name: "Inya Spillway & Kamayut Drainage",
    hazardClass: 1,
    severity: "moderate",
    description: "Flash runoff corridor near Inya Lake lower drainage and Pyay Road feeder lanes.",
    waterDepthEstimateCm: 18,
    flowRisk: "standing",
    coordinates: [
      [96.12, 16.82],
      [96.142, 16.824],
      [96.138, 16.844],
      [96.118, 16.84],
      [96.112, 16.828],
      [96.12, 16.82],
    ],
    center: { latitude: 16.831, longitude: 96.129 },
    advisory: "Service lane ponding. Passable with reduced speed; watch for stalled traffic.",
  },
  {
    id: "flood-zone-botahtaung-strand",
    name: "Downtown Strand Riverfront",
    hazardClass: 1,
    severity: "moderate",
    description: "Quay basin exposed to tidal surges and heavy rain drainage bottlenecks.",
    waterDepthEstimateCm: 20,
    flowRisk: "standing",
    coordinates: [
      [96.146, 16.76],
      [96.178, 16.764],
      [96.174, 16.778],
      [96.144, 16.774],
      [96.146, 16.76],
    ],
    center: { latitude: 16.769, longitude: 96.162 },
    advisory: "Tidal water accumulation at peak high tide. Low vehicle caution advised.",
  },
];

/**
 * Returns active flood hazard zones, incorporating any custom GeoJSON features
 * or falling back to the curated Yangon flood corridors.
 */
export function getYangonFloodZones(customGeoJson?: GeoJsonLike | null): FloodZone[] {
  if (!customGeoJson?.features?.length) {
    return YANGON_FLOOD_ZONES;
  }

  const customZones: FloodZone[] = [];
  let index = 1;

  for (const feature of customGeoJson.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    const hazardClassRaw = Number(
      feature.properties?.hazard_class ?? feature.properties?.hazard ?? 2,
    );
    const hazardClass: FloodHazardClass =
      hazardClassRaw === 3 ? 3 : hazardClassRaw === 1 ? 1 : 2;

    const polygons: number[][][] =
      geometry.type === "Polygon"
        ? (geometry.coordinates as number[][][])
        : geometry.type === "MultiPolygon"
          ? ((geometry.coordinates as number[][][][])[0] ?? [])
          : [];

    for (const polygon of polygons) {
      if (!polygon?.length) continue;
      const ring = polygon.map(([lng, lat]) => [Number(lng), Number(lat)] as [number, number]);
      const lats = ring.map(([, lat]) => lat);
      const lngs = ring.map(([lng]) => lng);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

      customZones.push({
        id: `custom-flood-zone-${index++}`,
        name: String(feature.properties?.name ?? `Monitored Flood Area ${index}`),
        hazardClass,
        severity: hazardClass === 3 ? "severe" : hazardClass === 2 ? "high" : "moderate",
        description: String(
          feature.properties?.description ?? "Mapped hydrological hazard zone from active layer.",
        ),
        waterDepthEstimateCm: hazardClass === 3 ? 50 : hazardClass === 2 ? 30 : 15,
        flowRisk: hazardClass === 3 ? "torrential" : "standing",
        coordinates: ring,
        center: { latitude: centerLat, longitude: centerLng },
        advisory: String(
          feature.properties?.advisory ??
            "Active flood hazard. Monitor weather conditions and bypass if water rises.",
        ),
      });
    }
  }

  return customZones.length > 0 ? customZones : YANGON_FLOOD_ZONES;
}

/**
 * Ray-casting algorithm to test whether point (lat, lng) is inside a polygon ring [lng, lat][].
 */
export function pointInPolygon(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Great-circle distance between two points on Earth in kilometers.
 */
export function haversineDistanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Generates an approximated circle polygon ring in [lng, lat][] coordinates.
 */
export function generateCirclePolygon(
  center: { latitude: number; longitude: number },
  radiusKm: number,
  points = 32,
): [number, number][] {
  const coords: [number, number][] = [];
  const kmPerDegLat = 111.32;
  const kmPerDegLng = kmPerDegLat * Math.cos((center.latitude * Math.PI) / 180);

  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const dLat = (radiusKm * Math.sin(angle)) / kmPerDegLat;
    const dLng = (radiusKm * Math.cos(angle)) / kmPerDegLng;
    coords.push([center.longitude + dLng, center.latitude + dLat]);
  }
  return coords;
}

/**
 * Computes the pixel radius for SVG/Canvas rendering based on Web Mercator scale.
 */
export function calculateRadiusPixels(
  radiusMeters: number,
  latitude: number,
  zoom: number,
): number {
  const latitudeRadians = (Math.max(Math.min(latitude, 85.0511), -85.0511) * Math.PI) / 180;
  const metersPerPixel = (156543.03392 * Math.cos(latitudeRadians)) / 2 ** zoom;
  return Math.max(8, radiusMeters / Math.max(0.1, metersPerPixel));
}

/**
 * Checks a route's exposure to flood hazard zones and verified/pending flood reports.
 * `coordinates` can be formatted as [lng, lat] pairs.
 */
export function checkRouteFloodExposure(
  coordinates: [number, number][],
  zones: FloodZone[],
  roadReports: RoadReport[] = [],
  reportRadiusKm = 0.4,
): RouteFloodRisk {
  if (!coordinates || coordinates.length < 2) {
    return {
      hasFloodRisk: false,
      intersectedZones: [],
      nearbyFloodReports: [],
      totalExposureKm: 0,
      suggestedSlowdownPercent: 0,
      warningMessage: null,
    };
  }

  const activeFloodReports = roadReports.filter(
    (r) => r.status !== "rejected" && (r.category === "flooding" || r.severity === "blocked"),
  );

  const matchedZones = new Set<FloodZone>();
  const matchedReports = new Set<RoadReport>();
  let exposedKm = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lng1, lat1] = coordinates[i];
    const [lng2, lat2] = coordinates[i + 1];
    const p1 = { latitude: lat1, longitude: lng1 };
    const p2 = { latitude: lat2, longitude: lng2 };
    const legLength = haversineDistanceKm(p1, p2);

    // Sample along leg (at least 2 points)
    const samples = Math.max(2, Math.ceil(legLength / 0.15));
    let legIsFlooded = false;

    for (let s = 0; s <= samples; s++) {
      const frac = s / samples;
      const sLat = lat1 + (lat2 - lat1) * frac;
      const sLng = lng1 + (lng2 - lng1) * frac;
      const samplePoint = { latitude: sLat, longitude: sLng };

      for (const zone of zones) {
        if (pointInPolygon(sLat, sLng, zone.coordinates)) {
          matchedZones.add(zone);
          legIsFlooded = true;
        }
      }

      for (const report of activeFloodReports) {
        if (haversineDistanceKm(samplePoint, report) <= reportRadiusKm) {
          matchedReports.add(report);
          legIsFlooded = true;
        }
      }
    }

    if (legIsFlooded) {
      exposedKm += legLength;
    }
  }

  const intersectedZones = Array.from(matchedZones);
  const nearbyFloodReports = Array.from(matchedReports);
  const hasFloodRisk = intersectedZones.length > 0 || nearbyFloodReports.length > 0;

  // Determine suggested slowdown
  let suggestedSlowdownPercent = 0;
  if (hasFloodRisk) {
    const hasSevere =
      intersectedZones.some((z) => z.hazardClass === 3) ||
      nearbyFloodReports.some((r) => r.severity === "blocked");
    const hasHigh =
      intersectedZones.some((z) => z.hazardClass === 2) ||
      nearbyFloodReports.some((r) => r.severity === "high");

    if (hasSevere) {
      suggestedSlowdownPercent = 60;
    } else if (hasHigh) {
      suggestedSlowdownPercent = 35;
    } else {
      suggestedSlowdownPercent = 15;
    }
  }

  let warningMessage: string | null = null;
  if (hasFloodRisk) {
    const zoneNames = intersectedZones.map((z) => z.name).join(", ");
    if (intersectedZones.length > 0 && nearbyFloodReports.length > 0) {
      warningMessage = `Route passes ${zoneNames} with ${nearbyFloodReports.length} active flood ${nearbyFloodReports.length === 1 ? "report" : "reports"}`;
    } else if (intersectedZones.length > 0) {
      warningMessage = `Route passes flood hazard corridor: ${zoneNames}`;
    } else {
      warningMessage = `${nearbyFloodReports.length} water hazard ${nearbyFloodReports.length === 1 ? "report" : "reports"} along route`;
    }
  }

  return {
    hasFloodRisk,
    intersectedZones,
    nearbyFloodReports,
    totalExposureKm: Math.round(exposedKm * 10) / 10,
    suggestedSlowdownPercent,
    warningMessage,
  };
}
