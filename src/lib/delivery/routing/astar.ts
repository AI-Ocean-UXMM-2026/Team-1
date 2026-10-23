import type { Graph, NodeId, ShortestPathResult } from "./graph.ts";

const INF = Number.POSITIVE_INFINITY;

export type Heuristic = (node: NodeId) => number;

export function aStar(
  graph: Graph,
  source: NodeId,
  target: NodeId,
  heuristic: Heuristic,
): ShortestPathResult {
  const { nodeCount, adjacency } = graph;
  const gScore = new Array<number>(nodeCount).fill(INF);
  const fScore = new Array<number>(nodeCount).fill(INF);
  const previous = new Array<number>(nodeCount).fill(-1);
  const open = new Set<NodeId>([source]);
  gScore[source] = 0;
  fScore[source] = heuristic(source);

  while (open.size > 0) {
    let current = -1;
    let best = INF;
    for (const node of open) {
      if (fScore[node] < best) {
        best = fScore[node];
        current = node;
      }
    }
    if (current < 0) break;
    if (current === target) {
      const path: NodeId[] = [];
      let node = target;
      while (node !== -1) {
        path.unshift(node);
        if (node === source) break;
        node = previous[node];
      }
      return { distance: gScore[target], path };
    }
    open.delete(current);
    for (const edge of adjacency[current]) {
      const tentative = gScore[current] + edge.weight;
      if (tentative < gScore[edge.to]) {
        previous[edge.to] = current;
        gScore[edge.to] = tentative;
        fScore[edge.to] = tentative + heuristic(edge.to);
        open.add(edge.to);
      }
    }
  }
  return { distance: INF, path: [] };
}
