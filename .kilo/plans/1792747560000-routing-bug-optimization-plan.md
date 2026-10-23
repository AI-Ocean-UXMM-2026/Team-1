# Routing Bug & Optimization Plan

## Goal
Fix correctness, performance, and potential issues in the routing stack introduced/used by the shortest-path work: `src/lib/delivery/routing/*`, `src/lib/delivery/dispatch/road-matrix.ts`, and routing integration in `src/lib/delivery/mapbox.ts`.

## Scope
- Shortest-path algorithms (Dijkstra, bidirectional Dijkstra, A*, Contraction Hierarchies).
- Graph snapping, graph matrix construction, and traffic-signal weighting.
- Dispatch matrix integration when a local graph is provided.
- Tests, typecheck, lint, and regression against existing dispatch/matrix/flood tests.

## Out of scope
- VRP solver objective/ALNS changes.
- Non-routing UI/energy/COD/subscriber code.
- OSM PBF parser strategy and graph artifact storage (marked as open question).

## Identified issues

### Correctness
1. `traffic.ts` `applyTrafficSignals` mutates edge weights in place and is not idempotent. Calling it twice double-counts signal delays. It also converts signal delay (minutes) into equivalent metres and adds it to edge weight, which inflates reported `km` in `buildShortestPathMatrix`.
   - Fix: make signal weighting pure or return an additive cost; do not mutate graph weights. Keep distance and time separate, or convert delay only for the cost objective, not for reported distance.
2. `traffic.ts` checks distance between signal and edge endpoints only via `distanceToSegmentKm(signal, start, end)`. If `edge.coordinates` has multiple segments, intermediate segments are not checked.
   - Fix: iterate every segment of `edge.coordinates` and sum signal delays per segment.
3. `buildShortestPathMatrix` snaps every point to the nearest graph node with no maximum snap distance. Off-network or out-of-bbox points can snap to an arbitrarily wrong node.
   - Fix: add `maxSnapKm`; pairs beyond it fall back to straight-line or are marked unreachable/infeasible.
4. `road-matrix.ts` early graph return sets `realPairs`/`coverage` but leaves `tilesPlanned`, `tilesFetched`, `elementsBilled`, etc. at zero, which can misreport coverage.
   - Fix: set consistent stats or document that graph-backed plans do not use tile stats.

### Performance
5. `buildShortestPathMatrix` calls `contractGraph(graph)` on every matrix build. Contraction is preprocessing work and should not run per request.
   - Fix: preprocess the graph once, cache the `ContractionHierarchy` by graph version, and pass it into matrix construction/querying.
6. `chQuery` recomputes `Math.min(...distF.map(...))` and `Math.min(...distB.map(...))` every loop, making query roughly O(V^2). This will not scale to the full Yangon graph.
   - Fix: replace with a priority queue / bucket-based frontier, or document small-graph-only usage until replaced.
7. `dijkstra.ts` bidirectional backward search scans all edges on every settle (O(E) per settle). Fine for tests, not for large graphs.
   - Fix: build a reverse adjacency index once, or limit bidirectional Dijkstra to small graphs/tests.
8. `mapbox.ts` `fetchRoadRoute` returns null if any chunk is null, with no partial fallback; short `DIRECTIONS_TTL_MS` (45s) re-fetches stable road geometry; bypass/hazard probes add sequential/parallel latency.
   - Accept as known trade-off unless latency is measured; add optional partial-fallback and longer cache for static geometry as follow-up.

### Potential issues
9. Traffic signal delay is applied in graph weights while `params.trafficMultiplier` is also applied in `buildShortestPathMatrix`, risking double counting of traffic effects.
   - Fix: choose one layer (graph edge time or matrix multiplier) and document it.
10. Existing Mapbox matrix calibration estimates missing pairs from straight-line band medians. With low coverage, dispatch quality degrades silently.
    - Fix: log/return coverage and warn when below threshold; do not label partial coverage as full `road_matrix`.

## Validation plan
- Unit tests: CH matches Dijkstra for all pairs on random connected/disconnected graphs; traffic weighting is idempotent/pure and does not double count; `maxSnapKm` rejects off-network points; matrix distances equal Dijkstra distances on small graphs.
- Regression: existing `tests/dispatch-solver.test.mjs`, `tests/dispatch-matrix-flood.test.mjs`, and new routing tests pass; `tsc --noEmit` and `biome check` clean.
- Accuracy: sample Yangon coordinate pairs; compare local shortest-path distances/times against Mapbox Directions ground truth; assert agreed tolerance.
- Fallback: with no graph provided, behavior must be identical to before the graph integration.

## Rollout / migration
- Gate local graph behind `deps.graph`; default remains Mapbox/straight-line. Rollback by removing `graph` from dependencies.
- Do not commit to `main` or force-push shared branch per device coordination rules.

## Open questions
- OSM PBF parser strategy and whether the graph artifact is committed or generated in CI.
- Whether traffic delay should be a separate time weight rather than equivalent metres.
