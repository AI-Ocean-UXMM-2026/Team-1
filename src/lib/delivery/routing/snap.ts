import type { GeoPoint, Graph } from "./graph.ts";
import { haversineKm } from "./graph.ts";

export function snapToNode(
  graph: Graph,
  point: GeoPoint,
  maxSnapKm = Number.POSITIVE_INFINITY,
): number | null {
  if (!graph.coordinates || graph.coordinates.length === 0) {
    throw new Error("graph has no coordinates for snapping");
  }
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < graph.coordinates.length; i++) {
    const distance = haversineKm(graph.coordinates[i], point);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  if (bestDistance > maxSnapKm) return null;
  return best;
}
