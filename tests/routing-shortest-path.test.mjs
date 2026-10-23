import assert from "node:assert/strict";
import test from "node:test";
import { aStar } from "../src/lib/delivery/routing/astar.ts";
import {
  chQuery,
  contractGraph,
} from "../src/lib/delivery/routing/contraction-hierarchies.ts";
import {
  bidirectionalDijkstra,
  shortestPath,
} from "../src/lib/delivery/routing/dijkstra.ts";
import { addEdge, createGraph } from "../src/lib/delivery/routing/graph.ts";
import { buildShortestPathMatrix } from "../src/lib/delivery/routing/matrix.ts";
import { snapToNode } from "../src/lib/delivery/routing/snap.ts";

function squareGraph() {
  const graph = createGraph(4, [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 1, longitude: 1 },
    { latitude: 1, longitude: 0 },
  ]);
  addEdge(graph, 0, 1, 1);
  addEdge(graph, 1, 2, 1);
  addEdge(graph, 2, 3, 1);
  addEdge(graph, 3, 0, 1);
  addEdge(graph, 0, 2, 2.5);
  return graph;
}

test("dijkstra finds shortest path", () => {
  const graph = squareGraph();
  const result = shortestPath(graph, 0, 2);
  assert.equal(result.distance, 2);
  assert.deepEqual(result.path, [0, 1, 2]);
});

test("bidirectional dijkstra matches dijkstra", () => {
  const graph = squareGraph();
  const a = shortestPath(graph, 0, 3);
  const b = bidirectionalDijkstra(graph, 0, 3);
  assert.equal(b.distance, a.distance);
});

test("a* finds shortest path", () => {
  const graph = squareGraph();
  const result = aStar(graph, 0, 2, () => 0);
  assert.equal(result.distance, 2);
});

test("contraction hierarchies match dijkstra for all pairs", () => {
  const graph = squareGraph();
  const ch = contractGraph(graph);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const expected = i === j ? 0 : shortestPath(graph, i, j).distance;
      const actual = chQuery(ch, i, j);
      assert.equal(actual, expected, `pair ${i}->${j}`);
    }
  }
});

test("snap chooses nearest node", () => {
  const graph = squareGraph();
  assert.equal(snapToNode(graph, { latitude: 0.1, longitude: 0.1 }), 0);
});

test("buildShortestPathMatrix returns finite distances", () => {
  const graph = squareGraph();
  const matrix = buildShortestPathMatrix(
    graph,
    [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
    ],
    { speedKmh: 60, truckTimeFactor: 1, trafficMultiplier: 1 },
  );
  assert.equal(matrix.n, 2);
  assert.ok(Number.isFinite(matrix.time[1]));
  assert.ok(Number.isFinite(matrix.km[1]));
});
