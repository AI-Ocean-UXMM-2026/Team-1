import type { Graph, NodeId, ShortestPathResult } from "./graph.ts";

const INF = Number.POSITIVE_INFINITY;

export function dijkstra(
  graph: Graph,
  source: NodeId,
  target?: NodeId,
): { distances: number[]; previous: number[] } {
  const { nodeCount, adjacency } = graph;
  const distances = new Array<number>(nodeCount).fill(INF);
  const previous = new Array<number>(nodeCount).fill(-1);
  const visited = new Array<boolean>(nodeCount).fill(false);
  distances[source] = 0;

  for (let settled = 0; settled < nodeCount; settled++) {
    let u = -1;
    let best = INF;
    for (let i = 0; i < nodeCount; i++) {
      if (!visited[i] && distances[i] < best) {
        best = distances[i];
        u = i;
      }
    }
    if (u < 0 || best === INF) break;
    if (target !== undefined && u === target) break;
    visited[u] = true;
    for (const edge of adjacency[u]) {
      const alt = distances[u] + edge.weight;
      if (alt < distances[edge.to]) {
        distances[edge.to] = alt;
        previous[edge.to] = u;
      }
    }
  }
  return { distances, previous };
}

export function shortestPath(
  graph: Graph,
  source: NodeId,
  target: NodeId,
): ShortestPathResult {
  const { distances, previous } = dijkstra(graph, source, target);
  if (!Number.isFinite(distances[target])) {
    return { distance: INF, path: [] };
  }
  const path: NodeId[] = [];
  let current = target;
  while (current !== -1) {
    path.unshift(current);
    if (current === source) break;
    current = previous[current];
  }
  return { distance: distances[target], path };
}

export function bidirectionalDijkstra(
  graph: Graph,
  source: NodeId,
  target: NodeId,
): ShortestPathResult {
  if (source === target) return { distance: 0, path: [source] };
  const { nodeCount, adjacency } = graph;
  // Reverse adjacency index for backward search.
  const reverseAdj: { from: number; weight: number }[][] = Array.from(
    { length: nodeCount },
    () => [],
  );
  for (let v = 0; v < nodeCount; v++) {
    for (const edge of adjacency[v]) {
      reverseAdj[edge.to].push({ from: v, weight: edge.weight });
    }
  }
  const distF = new Array<number>(nodeCount).fill(INF);
  const distB = new Array<number>(nodeCount).fill(INF);
  const prevF = new Array<number>(nodeCount).fill(-1);
  const prevB = new Array<number>(nodeCount).fill(-1);
  const doneF = new Array<boolean>(nodeCount).fill(false);
  const doneB = new Array<boolean>(nodeCount).fill(false);
  distF[source] = 0;
  distB[target] = 0;

  let best = INF;
  let meeting = -1;

  const settleForward = () => {
    let u = -1;
    let bestDist = INF;
    for (let i = 0; i < nodeCount; i++) {
      if (!doneF[i] && distF[i] < bestDist) {
        bestDist = distF[i];
        u = i;
      }
    }
    if (u < 0) return false;
    doneF[u] = true;
    if (distF[u] + distB[u] < best) {
      best = distF[u] + distB[u];
      meeting = u;
    }
    for (const edge of adjacency[u]) {
      const alt = distF[u] + edge.weight;
      if (alt < distF[edge.to]) {
        distF[edge.to] = alt;
        prevF[edge.to] = u;
      }
      if (doneB[edge.to] && distF[edge.to] + distB[edge.to] < best) {
        best = distF[edge.to] + distB[edge.to];
        meeting = edge.to;
      }
    }
    return true;
  };

  const settleBackward = () => {
    let u = -1;
    let bestDist = INF;
    for (let i = 0; i < nodeCount; i++) {
      if (!doneB[i] && distB[i] < bestDist) {
        bestDist = distB[i];
        u = i;
      }
    }
    if (u < 0) return false;
    doneB[u] = true;
    if (distF[u] + distB[u] < best) {
      best = distF[u] + distB[u];
      meeting = u;
    }
    // Backward search follows reversed edges via a precomputed reverse index.
    for (const { from: v, weight } of reverseAdj[u]) {
      const alt = distB[u] + weight;
      if (alt < distB[v]) {
        distB[v] = alt;
        prevB[v] = u;
      }
      if (doneF[v] && distF[v] + distB[v] < best) {
        best = distF[v] + distB[v];
        meeting = v;
      }
    }
    return true;
  };

  while (true) {
    const minF = Math.min(...distF.map((d, i) => (doneF[i] ? INF : d)));
    const minB = Math.min(...distB.map((d, i) => (doneB[i] ? INF : d)));
    if (minF === INF && minB === INF) break;
    if (Number.isFinite(best)) {
      if (minF !== INF && minB !== INF && best <= minF + minB) break;
      if (minF !== INF && minF >= best) break;
      if (minB !== INF && minB >= best) break;
    }
    if (minF <= minB) {
      if (!settleForward()) break;
    } else {
      if (!settleBackward()) break;
    }
    if (minF !== INF && minB !== INF && best <= minF + minB) break;
  }

  if (!Number.isFinite(best) || meeting < 0) {
    return { distance: INF, path: [] };
  }

  const forwardPath: NodeId[] = [];
  let current = meeting;
  while (current !== -1) {
    forwardPath.unshift(current);
    if (current === source) break;
    current = prevF[current];
  }
  const backwardPath: NodeId[] = [];
  current = prevB[meeting];
  while (current !== -1 && current !== target) {
    backwardPath.push(current);
    current = prevB[current];
  }
  if (current === target) backwardPath.push(target);
  // Remove duplicate meeting node.
  const path = forwardPath.concat(backwardPath);
  return { distance: best, path };
}
