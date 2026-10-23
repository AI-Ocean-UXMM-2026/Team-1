# Shortest-Path Routing Upgrade Plan

## Goal

Replace Oern's shortest-path foundation (Mapbox Matrix API plus haversine calibration) with a Yangon road-network shortest-path engine that is more accurate than straight-line calibration and faster than repeated external matrix calls, while keeping Mapbox as a fallback and oracle for validation.

## Scope

- Road-network shortest path for dispatch matrix pairs and rider navigation.
- Algorithm implementation and benchmarking in TypeScript.
- Build-time graph generation from `data/yangon.osm.pbf`.
- Integration with `src/lib/delivery/dispatch/road-matrix.ts`, `src/lib/delivery/mapbox.ts`, and energy routing.

## Non-goals

- Rewriting the VRP solver objective or ALNS structure.
- Live traffic prediction beyond existing speed cells and road reports.
- Country-wide routing; Yangon metro bbox only.

## Current State

- Dispatch uses `buildRoadMatrix`, which calls Mapbox Matrix in tiled blocks, then calibrates missing pairs from haversine bands.
- Rider navigation uses Mapbox Directions with client caching and hazard detours.
- Energy routing counts signals and interceptions by corridor projection, not true paths.
- `data/yangon.osm.pbf` exists but is unused by runtime code.

## Proposed Architecture

1. Build-time graph compiler
   - Parse OSM PBF into a compact road graph for Yangon metro bbox.
   - Keep drivable ways, oneway, access, maxspeed, and turn restrictions.
   - Emit node coordinates, edge length, base travel time, and road class.
   - Store as a versioned static artifact loaded by server and client.

2. Shortest-path core
   - Baseline: Dijkstra and bidirectional Dijkstra on the road graph.
   - Primary: A* with haversine heuristic for single-pair routes.
   - High-throughput: Contraction Hierarchies for all-pairs matrix construction.
   - Optional ALT landmarks for long-distance A* queries.
   - Turn-aware costs and prohibited turns as graph constraints.

3. Cost model
   - Base edge time from length and posted speed.
   - Edge multipliers for flood zones, road reports, speed cells, and signal delays.
   - Truck factor and traffic multiplier applied centrally, not in graph edges.

4. Integration
   - Dispatch: `buildRoadMatrix` queries CH for every requested pair before Mapbox; Mapbox fills only missing or low-confidence pairs.
   - Rider: `fetchRoadRoute` uses local shortest path for geometry and distance, with Mapbox fallback.
   - Energy: compute signals, interceptions, and fuel impact along the actual shortest path.

5. Caching
   - In-memory LRU for repeated node pairs.
   - Persisted pair cache for cold starts.
   - Version graph artifact by OSM data hash.

## Algorithm Selection

- Dijkstra: correctness baseline and validation oracle.
- Bidirectional Dijkstra: faster single-pair queries without preprocessing.
- A*: best for rider navigation where one origin and destination are known.
- Contraction Hierarchies: best for dispatch matrix construction because it answers many pairs quickly after preprocessing.
- ALT: useful only if landmark preprocessing is justified by benchmark results.

## Data Pipeline

1. Add `scripts/build-road-graph.mjs` to parse PBF and emit `data/yangon-road-graph.json` or a binary artifact.
2. Normalize coordinates and snap dispatch/request points to nearest graph nodes.
3. Add graph version metadata and validation checks.
4. Add tests for graph connectivity and snap behavior.

## Performance Strategy

- Precompute CH at build time, not request time.
- Load graph lazily and cache in module scope.
- Batch matrix pair queries by shared endpoints.
- Keep straight-line fallback for graph gaps and out-of-bbox points.
- Preserve deterministic output for identical inputs.

## Validation

- Compare local shortest paths against Mapbox Directions for a sampled Yangon coordinate set.
- Assert local distance is within an agreed tolerance of Mapbox distance.
- Measure query latency and memory for Dijkstra, bidirectional Dijkstra, A*, and CH.
- Keep existing dispatch solver tests passing.
- Add tests for turn restrictions, oneway handling, and disconnected components.

## Risks

- OSM data quality and missing speed limits.
- Graph artifact size in serverless bundles.
- Turn restrictions and access tags are easy to mishandle.
- Local shortest paths may differ from Mapbox due to profile differences.
- Cold-start loading of large graph artifacts.

## Task List

1. Inspect OSM PBF schema and choose a parser strategy.
2. Implement build-time road graph compiler and artifact format.
3. Implement Dijkstra, bidirectional Dijkstra, and A* with tests.
4. Implement Contraction Hierarchies and benchmark against baseline.
5. Add node snapping and graph versioning.
6. Integrate local shortest paths into dispatch matrix builder.
7. Integrate local shortest paths into rider road route provider.
8. Recompute energy metrics along actual paths.
9. Add benchmark and validation suites.
10. Document fallback and rollout behavior.

## Open Questions

- Should Mapbox remain the primary geometry provider during a transition period?
- What distance tolerance is acceptable between local and Mapbox routes?
- Should the graph artifact be committed or generated in CI?
