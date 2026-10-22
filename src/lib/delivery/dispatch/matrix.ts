import type { DispatchParams, Instance, Matrix, Point } from "./types.ts";

export function haversineKm(a: Point, b: Point) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Node 0 = depot; request r: pickup 1+2r (depot point for depot orders), delivery 2+2r. */
export function nodePoints(inst: Instance): Point[] {
  const points: Point[] = [inst.depot];
  for (const request of inst.requests) {
    points.push(request.pickup ?? inst.depot, request.delivery);
  }
  return points;
}

/**
 * Straight-line tier: haversine x road factor at a fixed speed. It is the
 * labelled fallback when road data is missing, never presented as road time.
 */
export function buildStraightLineMatrix(
  points: Point[],
  params: Pick<DispatchParams, "speedKmh" | "roadFactor">,
): Matrix {
  const n = points.length;
  const time = new Float64Array(n * n);
  const km = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const road = haversineKm(points[i], points[j]) * params.roadFactor;
      km[i * n + j] = road;
      time[i * n + j] = (road / params.speedKmh) * 60;
    }
  }
  return {
    n,
    time,
    km,
    floodFrac: null,
    blocked: null,
    source: "straight_line",
  };
}
