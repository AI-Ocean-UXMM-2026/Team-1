import { haversineKm } from "./matrix.ts";
import type { LiveFloodConditions } from "./open-meteo.ts";
import type { Matrix, Point } from "./types.ts";

/*
 * Flood exposure for a leg. Two inputs: a static hazard layer (polygons, a map
 * of where flooding can happen, NOT live water levels) and verified, unexpired
 * road reports. The static layer only adds slowdown and a risk preference; only
 * a verified "blocked" report can forbid an arc.
 */

/** ASSUMED weights per hazard class; the layer row may override them. */
export const DEFAULT_HAZARD_WEIGHTS: Record<string, number> = {
  "1": 0.25,
  "2": 0.6,
  "3": 1,
};

export const REPORT_WEIGHT = {
  low: 0.25,
  medium: 0.5,
  high: 1,
  blocked: 1,
} as const;

export type FloodReport = {
  lat: number;
  lng: number;
  severity: keyof typeof REPORT_WEIGHT;
};

type Ring = [number, number][];
type Shape = {
  rings: Ring[];
  weight: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type GeoJsonLike = {
  features?: {
    properties?: Record<string, unknown> | null;
    geometry?: { type?: string; coordinates?: unknown } | null;
  }[];
};

const CELL = 0.01; // degrees, about 1.1 km
const SAMPLE_KM = 0.15;
const MAX_SAMPLES = 24;
const REPORT_RADIUS_KM = 0.4;
const BLOCK_RADIUS_KM = 0.25;

function inRing(lat: number, lng: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}

/** Point in polygon with holes: inside the outer ring and outside every hole. */
function inShape(lat: number, lng: number, shape: Shape) {
  if (
    lat < shape.minLat ||
    lat > shape.maxLat ||
    lng < shape.minLng ||
    lng > shape.maxLng
  )
    return false;
  const [outer, ...holes] = shape.rings;
  if (!inRing(lat, lng, outer)) return false;
  return !holes.some((hole) => inRing(lat, lng, hole));
}

export class FloodField {
  private shapes: Shape[] = [];
  private grid = new Map<string, number[]>();
  readonly featureCount: number;

  constructor(
    geojson: GeoJsonLike | null | undefined,
    weights: Record<string, number> = DEFAULT_HAZARD_WEIGHTS,
  ) {
    for (const feature of geojson?.features ?? []) {
      const geometry = feature.geometry;
      if (!geometry) continue;
      const hazard = String(
        feature.properties?.hazard_class ?? feature.properties?.hazard ?? "",
      );
      const weight = weights[hazard];
      if (weight == null || !(weight > 0)) continue;
      const polygons =
        geometry.type === "Polygon"
          ? [geometry.coordinates as number[][][]]
          : geometry.type === "MultiPolygon"
            ? (geometry.coordinates as number[][][][])
            : [];
      for (const polygon of polygons) {
        const rings = polygon.map((ring) =>
          ring.map(([lng, lat]) => [lng, lat] as [number, number]),
        );
        // Stored as [lng, lat]; the ring test above reads (x = lng, y = lat).
        const lats = rings[0].map((c) => c[1]);
        const lngs = rings[0].map((c) => c[0]);
        this.shapes.push({
          rings,
          weight,
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
          minLng: Math.min(...lngs),
          maxLng: Math.max(...lngs),
        });
      }
    }
    this.featureCount = this.shapes.length;
    this.shapes.forEach((shape, index) => {
      for (
        let x = Math.floor(shape.minLng / CELL);
        x <= Math.floor(shape.maxLng / CELL);
        x++
      )
        for (
          let y = Math.floor(shape.minLat / CELL);
          y <= Math.floor(shape.maxLat / CELL);
          y++
        ) {
          const key = `${x},${y}`;
          const cell = this.grid.get(key);
          if (cell) cell.push(index);
          else this.grid.set(key, [index]);
        }
    });
  }

  /** Highest hazard weight covering the point, 0 if none. */
  weightAt(lat: number, lng: number) {
    const cell = this.grid.get(
      `${Math.floor(lng / CELL)},${Math.floor(lat / CELL)}`,
    );
    let best = 0;
    for (const index of cell ?? []) {
      const shape = this.shapes[index];
      if (shape.weight > best && inShape(lat, lng, shape)) best = shape.weight;
    }
    return best;
  }
}

function reportWeightAt(lat: number, lng: number, reports: FloodReport[]) {
  let best = 0;
  const here = { lat, lng };
  for (const report of reports) {
    if (haversineKm(here, report) <= REPORT_RADIUS_KM)
      best = Math.max(best, REPORT_WEIGHT[report.severity]);
  }
  return best;
}

function blockedAt(lat: number, lng: number, reports: FloodReport[]) {
  const here = { lat, lng };
  return reports.some(
    (report) =>
      report.severity === "blocked" &&
      haversineKm(here, report) <= BLOCK_RADIUS_KM,
  );
}

/**
 * Exposure of the straight chord between two points: mean hazard weight over
 * evenly spaced samples (150 m apart, at most 24), and whether any sample is
 * near a blocked report. The chord can differ from the real road, so this is an
 * estimate.
 */
export function legExposure(
  a: Point,
  b: Point,
  field: FloodField | null,
  reports: FloodReport[],
) {
  const km = haversineKm(a, b);
  const count = Math.min(
    MAX_SAMPLES,
    Math.max(2, Math.ceil(km / SAMPLE_KM) + 1),
  );
  let sum = 0;
  let blocked = false;
  for (let i = 0; i < count; i++) {
    const f = i / (count - 1);
    const lat = a.lat + (b.lat - a.lat) * f;
    const lng = a.lng + (b.lng - a.lng) * f;
    const weight = Math.max(
      field?.weightAt(lat, lng) ?? 0,
      reportWeightAt(lat, lng, reports),
    );
    sum += weight;
    if (!blocked && blockedAt(lat, lng, reports)) blocked = true;
  }
  return { fraction: sum / count, blocked };
}

export type FloodStatus = "layer" | "reports_only" | "unknown";

export type FloodSummary = {
  status: FloodStatus;
  layerFeatures: number;
  reportsUsed: number;
  exposedArcs: number;
  blockedArcs: number;
  live?: LiveFloodConditions | null;
};

/** Returns a copy of the matrix with per-arc flood fraction and blocked flags. */
export function applyFlood(
  matrix: Matrix,
  points: Point[],
  field: FloodField | null,
  reports: FloodReport[],
  live?: LiveFloodConditions | null,
): { matrix: Matrix; summary: FloodSummary } {
  const hasLayer = field != null && field.featureCount > 0;
  const status: FloodStatus = hasLayer
    ? "layer"
    : reports.length > 0
      ? "reports_only"
      : "unknown";
  if (status === "unknown") {
    return {
      matrix,
      summary: {
        status,
        layerFeatures: 0,
        reportsUsed: 0,
        exposedArcs: 0,
        blockedArcs: 0,
        live: live ?? null,
      },
    };
  }
  const n = matrix.n;
  const frac = new Float64Array(n * n);
  const blocked = new Uint8Array(n * n);
  let exposed = 0;
  let blockedCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const leg = legExposure(
        points[i],
        points[j],
        hasLayer ? field : null,
        reports,
      );
      // The chord is the same both ways.
      frac[i * n + j] = frac[j * n + i] = leg.fraction;
      if (leg.fraction > 0) exposed += 2;
      if (leg.blocked) {
        blocked[i * n + j] = blocked[j * n + i] = 1;
        blockedCount += 2;
      }
    }
  }
  return {
    matrix: { ...matrix, floodFrac: frac, blocked },
    summary: {
      status,
      layerFeatures: field?.featureCount ?? 0,
      reportsUsed: reports.length,
      exposedArcs: exposed,
      blockedArcs: blockedCount,
      live: live ?? null,
    },
  };
}
