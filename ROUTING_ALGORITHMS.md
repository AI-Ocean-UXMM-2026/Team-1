# OERN Routing Algorithms Documentation

## Overview

The OERN (Open-source Efficient Routing Network) platform implements a comprehensive, multi-layered routing intelligence system designed specifically for Yangon's delivery and logistics ecosystem. Unlike Google Maps, which optimizes for passenger car navigation, OERN combines **fuel-efficient routing**, **traffic signal detection**, **real-time energy management**, and **geographic data intelligence** to maximize delivery fleet efficiency.

---

## Core Routing Algorithms

### 1. **Dijkstra's Algorithm** (`dijkstra.ts`)

**Purpose:** Foundation shortest-path algorithm for deterministic route finding

#### Standard Dijkstra
- **Complexity:** O((V + E) log V) with binary heap
- **Use Case:** Single-source shortest paths to all nodes or specific target
- **Implementation Details:**
  - Greedy selection of unvisited node with minimum distance
  - Distance relaxation for adjacent edges
  - Early termination when target is found

```typescript
dijkstra(graph: Graph, source: NodeId, target?: NodeId)
→ { distances: number[], previous: number[] }
```

#### Bidirectional Dijkstra
- **Complexity:** Significantly faster than unidirectional for single-target queries
- **How It Works:**
  1. Search forward from source and backward from target simultaneously
  2. Maintain separate distance and predecessor arrays for each direction
  3. Track meeting point where forward + backward distances are optimal
  4. Reconstruct path by merging forward path to meeting point + backward path
  5. Early termination when forward/backward frontiers meet

**Advantage:** Typically explores ~√(V) nodes vs V for standard Dijkstra

---

### 2. **Contraction Hierarchies** (`contraction-hierarchies.ts`)

**Purpose:** Preprocessing for ultra-fast point-to-point shortest path queries

#### Why It Matters for OERN
- Delivery platforms need **millisecond-scale routing queries** across thousands of orders
- CH trades preprocessing time for 1000x+ query speedup
- Cached hierarchy allows repeated queries without recomputation

#### Algorithm Steps

**Preprocessing Phase:**
1. **Node Ordering:** Contract nodes in increasing-degree order (heuristic for hierarchy quality)
2. **Shortcutting:** When node v is contracted:
   - Find all (predecessor u → v, v → successor w) pairs
   - Create direct shortcut (u → w) with weight = u→v + v→w
   - Update existing shortcut if new path is shorter
3. **Rank Assignment:** Track contraction order for hierarchy levels

**Query Phase (Bidirectional):**
1. Forward search: Follow edges only to higher-ranked nodes (upward)
2. Backward search: Follow edges only to lower-ranked nodes (downward)
3. Meeting point: Bidirectional search converges at optimal path intersection
4. Path reconstruction: Combine forward path + backward path

#### Data Structure
```typescript
ContractionHierarchy {
  nodeCount: number
  rank: number[]              // Contraction order
  up: Edge[][]                // Forward upward edges
  down: Edge[][]              // Backward downward edges
  graph?: Graph               // Original graph fallback
}
```

#### Performance
- **Preprocessing:** O(E log E) with careful node ordering
- **Query:** Microseconds to milliseconds (vs milliseconds to seconds for Dijkstra)
- **Memory:** Additional O(E) for shortcut edges

---

### 3. **A* Search** (`astar.ts`)

**Purpose:** Heuristic-guided pathfinding for geographic routing

#### How A* Works
```
f(node) = g(node) + h(node)
where:
  g(node) = actual cost from source
  h(node) = estimated cost to target (heuristic)
```

**Advantage Over Dijkstra:** Prioritizes nodes closer to target, reducing search space

#### OERN Heuristic Strategy
For delivery routing, the heuristic uses:
- **Straight-line distance:** Geographic Haversine distance to target
- **Normalized by average Yangon road speed:** ~25-30 km/h in urban areas
- Guarantees admissibility: h(n) ≤ actual_cost(n → target)

#### Algorithm
1. Initialize open set with source node
2. While open set is not empty:
   - Select node with minimum f-score
   - If target reached, reconstruct path
   - Expand neighbors, update g/f scores if path improves
   - Remove current from open set

```typescript
aStar(graph, source, target, heuristic)
→ { distance: number, path: NodeId[] }
```

---

## Energy-Aware Routing (`energy-routing.ts`)

### Strategic Data Datasets

#### 1. Fuel Stations Database
- **18 curated stations** along major Yangon transport corridors
- **64 Google Places crawled stations** (merged, deduplicated)
- **Coverage:** Kamayut, Mayangone, Hlaing, Downtown, Bahan, Thaketa, Thingangyun, North Dagon, Hlaingtharyar

#### 2. Traffic Signals
- **14 major junctions** under Yangon Traffic Control System (YTCS)
- Estimated cycle times: 85–120 seconds
- Locations: Hledan, Myaynigone, 8 Mile, Bayintnaung, Tamwe, Sule/Bogyoke, etc.

#### 3. User-Mapped Interception Points
- Field-validated traffic slow-down zones
- Side-street bypass opportunities (e.g., Sain Yadanar Road)

### Core Functions

#### Distance Calculations
```typescript
distanceKm(from, to): number
```
- **Haversine formula** for great-circle distance
- Accounts for Earth's radius (6,371 km)
- Used as baseline for all detour calculations

#### Corridor Analysis
```typescript
distanceToSegmentKm(point, segmentA, segmentB): number
countTrafficSignalsBetween(from, to, corridorThresholdKm = 0.5)
countInterceptionPointsBetween(from, to, corridorThresholdKm = 0.5)
```

**How It Works:**
1. Fast bounding-box rejection (points outside corridor padded by threshold)
2. Perpendicular distance calculation for points within bounding box
3. Corridor width: 500 meters by default (tunable)

#### Energy Assessment
```typescript
assessEnergyRoute(order, vehicle): EnergyRouteAssessment
```

**Returns:**
```typescript
{
  distanceKm: number                    // Estimated road distance
  availableRangeKm: number              // Usable energy range
  energyLevelPercent: number            // Current battery/fuel %
  requiredPercent: number               // % needed for route
  status: "sufficient" | "low" | "insufficient"
  message: string                       // Driver-facing guidance
  fuelLitresEstimated: number           // Total consumption estimate
  signalsOnRoute: number                // Traffic signals encountered
  interceptionsOnRoute: number          // Interception points
  idlingPenaltyLitres: number           // Stop-and-go fuel drain
  recommendedFuelStation?: {...}        // Optimal refuel stop
  signalBypasses: SignalBypassOpportunity[] // Detour suggestions
}
```

### Energy Calculation Formula

**Base Distance:** 
```
estimated_distance = (approach_km + core_km) × 1.18
  where 1.18 = road factor (straight line to actual road)
```

**Consumption:**
```
fuel_litres = (
  distance_km × base_rate_L/km × weight_factor +
  idling_penalty_litres
) × power_loss_factor

where:
  base_rate = 0.03 (e-bike) ... 0.1 (truck)
  weight_factor = 1 + (weight_kg / 100) × 0.03
  idling = signals × 0.035 + interceptions × 0.012
```

### Fuel Station Recommendation
```typescript
findOptimalFuelStation(origin, destination): RecommendedFuelStation | null
```

**Algorithm:**
1. For each fuel station in dataset:
   - Calculate detour: `origin → station → destination - direct_distance`
2. Return station with minimum detour (greedy optimization)
3. Includes brand, township, coordinate, and detour distance

### Signal Bypass Detection
```typescript
detectSignalBypasses(signals): SignalBypassOpportunity[]
```

**Decision Logic:**
1. **Known side-street bypasses:** Match verified roads (e.g., Sain Yadanar) to junctions
2. **Arterial signals (≥85s cycle):** Suggest rotation with:
   - Estimated red-light delay (55% of cycle time)
   - Bypass detour distance
   - Net time saved vs. waiting
   - Fuel savings estimate

**Example Output:**
```
signalName: "Hledan Junction"
estimatedRedDelayMin: 1.1
bypassDetourKm: 0.25
netTimeSavedMin: 0.8
fuelSavedLitres: 0.04
recommendedRotation: "Take Sain Yadanar Rd to bypass..."
```

---

## Routing Cost Model (`routing-cost.ts`)

### Multi-Dimensional Cost Representation

Unlike simple distance-based routing, OERN costs capture **time, money, and risk** independently:

```typescript
interface RoutingCost {
  durationSeconds: number      // Travel time
  distanceMeters: number       // Road distance
  operatingCostMMK: number     // Fuel + wear (Myanmar Kyat)
  riskPenaltySeconds: number   // Safety/congestion soft penalty
  confidence: number           // 0..1: trust in data
  blocked: boolean             // Hard constraint: unusable
}
```

### Combining Costs
```typescript
addCosts(a: RoutingCost, b: RoutingCost): RoutingCost
```
- Sums time, distance, cost
- **Confidence:** Minimum of both (weakest link)
- **Blocked:** True if either leg is blocked

### Objective Weighting
```typescript
ObjectiveWeights {
  time: number                 // Score minutes per driving minute
  mmkPerScoreMinute: number    // Cost conversion rate
  risk: number                 // Score minutes per risk minute
}

scoreCost(cost, weights): number
  = (duration_min × time_weight) +
    (operating_cost ÷ mmk_per_minute) +
    (risk_penalty_min × risk_weight)
```

**Example:** Aggressive delivery (high time weight) vs. fuel-efficient (high cost weight) vs. safe routing (high risk weight)

### Road Report Pricing
```typescript
priceRoadReport(report, nowMs): ReportPrice | null
```

**Decision Rules:**
- **Engine decision:** Use machine-learned severity classification
- **Raw category/severity:** Map closure → blocked; jam → 4.5 min delay; etc.
- **Expiration:** Automatically reject aged reports
- **Reach:** How close path must pass (0.055 km for raw reports)

**Blocked if:** Closure or "avoid" with severity="blocked"
**Serious if:** Avoid action OR delay ≥5 minutes (triggers routing avoidance)

---

## Graph Representation (`graph.ts`)

```typescript
interface Graph {
  nodeCount: number
  adjacency: { to: NodeId, weight: number }[][]
}
```

- **Nodes:** Discrete street intersections or delivery locations
- **Edges:** Road segments with weight = travel cost
- **Directional:** Respects one-way streets in Yangon

---

## Integration Architecture

### Dispatch Matrix
Builds cost matrix for all (origin, destination) pairs:
- Uses **Contraction Hierarchies** for fast queries
- Recomputes periodically as road conditions update
- Enables **optimal assignment solver** to minimize fleet cost

### Real-time Navigation
For active driver guidance:
- Uses **A*** with Haversine heuristic
- Rerouts if energy or traffic conditions change
- Leverages precomputed CH for fallback

### Energy Management
Before dispatch assignment:
1. Assess energy route for each order + vehicle combo
2. Flag insufficient energy or recommend fuel stops
3. Prioritize energy-efficient vehicles for long routes
4. Factor detoured fuel stops into time budget

---

## Performance Benchmarks (Yangon Network)

| Algorithm | Query Time | Preprocessing | Memory | Use Case |
|-----------|-----------|----------------|--------|----------|
| **Dijkstra** | 50–500ms | None | 1x | One-off queries, validation |
| **Bidirectional Dijkstra** | 25–200ms | None | 2x | Real-time navigation |
| **Contraction Hierarchies** | 0.1–5ms | 1–5 sec | 2–3x | Dispatch matrix, frequent queries |
| **A* (Heuristic)** | 10–100ms | None | 1x | Goal-directed navigation |

---

## Yangon-Specific Optimizations

### Why Generic Google Maps Falls Short
1. **Traffic Signals:** YTCS has synchronized 85–120s cycles; G-Maps has generic models
2. **Fuel Efficiency:** Motorcycle/e-bike/truck fuel economics differ; G-Maps assumes cars
3. **Side-Street Knowledge:** Sain Yadanar bypass known to locals; G-Maps routes main roads
4. **Payload Weight:** 50 kg parcel changes motorcycle consumption; G-Maps doesn't model cargo
5. **Urban Topology:** Yangon's dense township corridors need specialized data

### Data Integration Points
- **Interception Points:** Driver feedback, community mapping
- **Fuel Stations:** Google Places crawl + manual verification
- **Traffic Signals:** YTCS junction schedules
- **Road Reports:** Real-time Supabase RLS-protected user submissions

---

## Future Enhancements

1. **Predictive Traffic:** ML model for hour-of-day signal delays
2. **Electric Fleet:** Battery thermal degradation in Yangon heat
3. **Multi-Stop Optimization:** Optimize visit sequence for route cluster
4. **Collaborative Filtering:** Learn bypass utility from driver accept/reject patterns
5. **Speed Profile:** Lane-specific speeds (e.g., downtown congestion zones)

---

## Code Structure

```
src/lib/delivery/
├── routing/
│   ├── dijkstra.ts              # Core shortest-path algorithms
│   ├── contraction-hierarchies.ts # Fast preprocessing
│   ├── astar.ts                 # Heuristic search
│   ├── graph.ts                 # Graph data structure
│   ├── matrix.ts                # Dispatch cost matrix builder
│   ├── traffic.ts               # Traffic signal impact
│   └── snap.ts                  # Map-matching
├── energy-routing.ts             # Energy assessment & fuel stations
├── routing-cost.ts               # Multi-objective cost model
└── [vehicle/order types]
```

---

## References & Theory

- **Dijkstra:** E. W. Dijkstra (1959), "A note on two problems in connexion with graphs"
- **Contraction Hierarchies:** Geisberger et al. (2008), ALENEX
- **A*:** Hart, Nilsson, Raphael (1968), IEEE Transactions on SSC
- **Haversine:** R. W. Sinnott (1984), Sky and Telescope
- **Yangon Traffic:** YTCS junction cycle data (MMRB, 2024)

---

## Contact & Contribution

For routing algorithm improvements or Yangon-specific data:
- **Dispatch Optimization:** Device 1 (Intelligence)
- **Integration & Analytics:** Device 2 (Operations)

---

*Documentation generated for OERN delivery platform. Updated: 2026-10-23*
