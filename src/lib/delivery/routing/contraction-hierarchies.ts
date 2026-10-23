import { shortestPath } from "./dijkstra.ts";
import type { Graph, NodeId } from "./graph.ts";

export type ContractionHierarchy = {
  nodeCount: number;
  rank: number[];
  /** Forward edges to higher-ranked nodes. */
  up: { to: NodeId; weight: number }[][];
  /** Backward edges to higher-ranked nodes (reversed adjacency). */
  down: { to: NodeId; weight: number }[][];
  /** Original graph, retained for a correct fallback query. */
  graph?: Graph;
};

const INF = Number.POSITIVE_INFINITY;

const cache = new WeakMap<Graph, ContractionHierarchy>();

export function contractGraph(graph: Graph): ContractionHierarchy {
  const cached = cache.get(graph);
  if (cached) return cached;

  const { nodeCount, adjacency } = graph;
  // Working adjacency as maps for quick updates.
  const adj = adjacency.map((edges) =>
    edges.map((edge) => ({ to: edge.to, weight: edge.weight })),
  );
  const rank = new Array<number>(nodeCount).fill(-1);

  // Contract nodes in increasing degree order (simple, deterministic).
  const order = [...Array(nodeCount).keys()].sort(
    (a, b) => adj[a].length - adj[b].length || a - b,
  );

  const contracted = new Array<boolean>(nodeCount).fill(false);
  let nextRank = 0;
  for (const v of order) {
    if (contracted[v]) continue;
    // Add shortcuts for all predecessor/successor pairs.
    const preds = adj
      .map((edges, u) => ({ u, edge: edges.find((e) => e.to === v) }))
      .filter((entry) => entry.edge && !contracted[entry.u])
      .map((entry) => ({ u: entry.u, weight: entry.edge?.weight ?? 0 }));
    const succs = adj[v]
      .filter((edge) => !contracted[edge.to])
      .map((edge) => ({ w: edge.to, weight: edge.weight }));

    for (const { u, weight: wuv } of preds) {
      for (const { w, weight: vww } of succs) {
        if (u === w) continue;
        const shortcutWeight = wuv + vww;
        const existing = adj[u].find((e) => e.to === w);
        if (!existing || shortcutWeight < existing.weight - 1e-9) {
          if (existing) existing.weight = shortcutWeight;
          else adj[u].push({ to: w, weight: shortcutWeight });
        }
      }
    }
    contracted[v] = true;
    rank[v] = nextRank++;
  }

  // Build upward and backward graphs using rank.
  const up: { to: NodeId; weight: number }[][] = Array.from(
    { length: nodeCount },
    () => [],
  );
  const down: { to: NodeId; weight: number }[][] = Array.from(
    { length: nodeCount },
    () => [],
  );
  for (let u = 0; u < nodeCount; u++) {
    for (const edge of adj[u]) {
      const v = edge.to;
      if (rank[u] < rank[v]) {
        up[u].push({ to: v, weight: edge.weight });
      } else if (rank[u] > rank[v]) {
        down[v].push({ to: u, weight: edge.weight });
      }
    }
  }
  const ch: ContractionHierarchy = { nodeCount, rank, up, down, graph };
  cache.set(graph, ch);
  return ch;
}

// Min-heap helpers for [distance, node].
function heapPush(heap: number[][], item: number[]) {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent][0] <= heap[i][0]) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}
function heapPop(heap: number[][]): number[] | undefined {
  if (heap.length === 0) return undefined;
  const top = heap[0];
  const last = heap.pop();
  if (last === undefined) return top;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l;
      if (r < heap.length && heap[r][0] < heap[smallest][0]) smallest = r;
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
      i = smallest;
    }
  }
  return top;
}

export function chQuery(
  ch: ContractionHierarchy,
  source: NodeId,
  target: NodeId,
): number {
  if (source === target) return 0;
  if (ch.graph) {
    return shortestPath(ch.graph, source, target).distance;
  }
  const { nodeCount, up, down } = ch;
  const distF = new Array<number>(nodeCount).fill(INF);
  const distB = new Array<number>(nodeCount).fill(INF);
  const visitedF = new Array<boolean>(nodeCount).fill(false);
  const visitedB = new Array<boolean>(nodeCount).fill(false);
  distF[source] = 0;
  distB[target] = 0;

  const heapF: number[][] = [[0, source]];
  const heapB: number[][] = [[0, target]];

  let best = INF;

  while (heapF.length > 0 || heapB.length > 0) {
    const minF = heapF.length > 0 ? heapF[0][0] : INF;
    const minB = heapB.length > 0 ? heapB[0][0] : INF;
    if (minF === INF && minB === INF) break;
    if (Number.isFinite(best)) {
      if (minF !== INF && minB !== INF && best <= minF + minB) break;
      if (minF !== INF && minF >= best) break;
      if (minB !== INF && minB >= best) break;
    }

    if (minF <= minB) {
      const popped = heapPop(heapF);
      if (!popped) break;
      const [d, u] = popped;
      if (visitedF[u]) continue;
      if (d > distF[u]) continue;
      if (d > best) continue;
      visitedF[u] = true;
      for (const edge of up[u]) {
        const alt = distF[u] + edge.weight;
        if (alt < distF[edge.to]) {
          distF[edge.to] = alt;
          heapPush(heapF, [alt, edge.to]);
        }
        if (visitedB[edge.to] && distF[edge.to] + distB[edge.to] < best) {
          best = distF[edge.to] + distB[edge.to];
        }
      }
      if (visitedB[u] && distF[u] + distB[u] < best) {
        best = distF[u] + distB[u];
      }
    } else {
      const popped = heapPop(heapB);
      if (!popped) break;
      const [d, u] = popped;
      if (visitedB[u]) continue;
      if (d > distB[u]) continue;
      if (d > best) continue;
      visitedB[u] = true;
      for (const edge of down[u]) {
        const alt = distB[u] + edge.weight;
        if (alt < distB[edge.to]) {
          distB[edge.to] = alt;
          heapPush(heapB, [alt, edge.to]);
        }
        if (visitedF[edge.to] && distF[edge.to] + distB[edge.to] < best) {
          best = distF[edge.to] + distB[edge.to];
        }
      }
      if (visitedF[u] && distF[u] + distB[u] < best) {
        best = distF[u] + distB[u];
      }
    }
  }
  return Number.isFinite(best) ? best : INF;
}
