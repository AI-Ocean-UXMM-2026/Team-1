export type NodeId = number;

export type GeoPoint = { latitude: number; longitude: number };

export type GraphEdge = {
  to: NodeId;
  weight: number;
  /** Optional road geometry for this edge. */
  coordinates?: GeoPoint[];
  /** Marks that traffic-signal delay has already been folded into `weight`. */
  trafficSignalsApplied?: boolean;
};

export type Graph = {
  nodeCount: number;
  adjacency: GraphEdge[][];
  coordinates?: GeoPoint[];
};

export type ShortestPathResult = {
  distance: number;
  path: NodeId[];
};

export function createGraph(
  nodeCount: number,
  coordinates?: GeoPoint[],
): Graph {
  return {
    nodeCount,
    adjacency: Array.from({ length: nodeCount }, () => []),
    coordinates,
  };
}

export function addEdge(
  graph: Graph,
  from: NodeId,
  to: NodeId,
  weight: number,
  coordinates?: GeoPoint[],
  directed = false,
): void {
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error("edge weight must be a non-negative finite number");
  }
  graph.adjacency[from].push({ to, weight, coordinates });
  if (!directed) {
    graph.adjacency[to].push({ to: from, weight, coordinates });
  }
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
