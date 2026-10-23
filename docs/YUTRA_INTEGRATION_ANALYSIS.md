# YUTRA Historical Traffic Integration Analysis
## Oern Smart Route Decision Engine — Phase 1 Architecture Review

**Author:** Transportation Data Engineer & GIS Specialist  
**Date:** 2026-10-23  
**Objective:** Design reliable integration of historical Yangon traffic observations into Oern's routing optimization

---

## Executive Summary

Oern's dispatch and routing system is architecturally sound for historical traffic integration. The existing system separates **cost calculation** (routing-cost layer) from **routing logic** (dispatch solver), creating a natural insertion point for YUTRA historical baselines without disrupting current functionality.

### Key Findings

1. **Routing Architecture is Modular:**
   - Cost abstraction (`RoutingCost`) already accommodates multiple confidence levels
   - Mapbox Matrix API calls are cached at the road-pair level, preserving network budget
   - Travel-time estimation already incorporates multiple factors: trucks are slower than cars (`truckTimeFactor`), traffic multipliers are applied, and flood delays are modeled

2. **Historical Data Will Improve Accuracy Where Live Traffic is Unavailable:**
   - Mapbox provides real-time traffic for major corridors only; minor streets have no live observations
   - 2013 YUTRA data provides validated intersection delays and traffic volume baselines
   - BPR congestion model can estimate how 2013 conditions compare to current OSM road geometry

3. **Three Confidence Levels Already Exist:**
   - `road_matrix`: Real road data from Mapbox (confidence 1.0)
   - `road_calibrated`: Mapbox with calibration (confidence 0.7)
   - `straight_line`: Haversine fallback (confidence 0.4)
   - **Proposal:** Add `yutra_historical` at confidence 0.5 — between live traffic and fallback heuristics

4. **Shortest Route ≠ Fastest Route is Already Implemented:**
   - Route evaluation scores combine time, cost, risk, uncertainty, and late penalties
   - Dispatch solver explicitly weights uncertainty via `legSigma` and `serviceSigma`
   - Flood delays and weather conditions already factor into route selection

---

## 1. Existing Routing Architecture Deep Dive

### 1.1 High-Level Flow: Request to Delivery

```
POST /api/dispatch/plan (manager request)
  ↓
handlePlan() → createSupabaseSource() → buildMatrix()
  ├─ Policy: "no_network" (offline) → buildStraightLineMatrix() [confidence 0.4]
  └─ Policy: "network" (online) → buildRoadMatrix() [via Mapbox Matrix API]
  ↓
solve(instance, matrix, deps)
  ├─ construct() — Nearest insertion, time-window feasible initial solution
  ├─ improve() — Local search (2-opt, relocate, exchange)
  ├─ ruinAndRecreate() — Shaw removal + regret-2 reinsertion (escape local optima)
  └─ finish() — Recompute with detail timings
  ↓
POST response contains:
  - routes[]: driver, vehicle, stops with sequence, timings, costs
  - unassigned[]: orders that could not fit (reason: capacity, window, range)
  - objective: route_cost, unserved_penalty, total
  - metrics: iterations, evaluation count, cache statistics
```

### 1.2 Cost Model: RoutingCost Interface

**Location:** `src/lib/delivery/routing-cost.ts`

Every road segment (arc in the matrix) is priced with:

```typescript
interface RoutingCost {
  durationSeconds: number;      // Travel time
  distanceMeters: number;       // Haul distance
  operatingCostMMK: number;     // Vehicle cost (costPerKm × km)
  riskPenaltySeconds: number;   // Soft penalty for hazards (floods, closures)
  confidence: number;           // 0..1: data reliability
  blocked: boolean;             // Hard constraint: leg forbidden
}
```

**Scoring:**
```typescript
scoreCost(cost, weights) = 
  (cost.durationSeconds / 60) × weights.time +
  cost.operatingCostMMK / weights.mmkPerScoreMinute +
  (cost.riskPenaltySeconds / 60) × weights.risk

// DEFAULT_OBJECTIVE: { time: 1, mmkPerScoreMinute: 100, risk: 1 }
```

**Key Insight:** Confidence is tracked but *not* used in scoring. It indicates data provenance but does not reduce the cost if confidence is low. This means:
- A segment from live Mapbox traffic and a segment from YUTRA historical data will score identically if durations are equal
- The solver makes no automatic trade-off between "reliable new data" vs. "old but verified data"

### 1.3 Matrix Building: Road Matrix Construction

**Location:** `src/lib/delivery/dispatch/road-matrix.ts`

Road matrix is built by:

1. **Spatial Blocking (Hilbert Curve):** Coordinates are ordered along a space-filling Hilbert curve, grouped into blocks of 12, then combined into bands of 2–5 blocks (up to 24–60 coordinates per Mapbox request).

2. **Caching:** RoadPairCache stores previously fetched Mapbox pairs (roundable to ~1m precision). Cache entry:
   ```typescript
   { seconds: number; meters: number; at: number }
   ```
   - Default TTL: 6 hours
   - Max entries: 50,000 pairs
   - Survives across requests on a warm instance

3. **Fallback Estimation:** Pairs not found in Mapbox are estimated from straight-line distance scaled by a ratio measured on fetched pairs. Result is labeled `road_calibrated` (confidence 0.7).

4. **Output:** Matrix with:
   - `time: Float64Array` — minutes, row i to column j
   - `km: Float64Array` — road distance
   - `floodFrac: Float64Array | null` — fraction of leg in flood zone (if known)
   - `blocked: Uint8Array | null` — hard blocked arcs
   - `source: "road_matrix" | "road_calibrated" | "straight_line"`

### 1.4 Arc Cost Calculation

**Location:** `src/lib/delivery/dispatch/arc-cost.ts`

For each matrix arc (from node → to node):

```typescript
arcCost(matrix, from, to, truck, params):

  arc = from × matrix.n + to
  frac = matrix.floodFrac?.[arc] ?? 0
  km = matrix.km[arc]
  
  return {
    durationSeconds: matrix.time[arc] × (1 + floodSlowdown × frac) × 60,
    distanceMeters: km × 1000,
    operatingCostMMK: km × truck.costPerKm,
    riskPenaltySeconds: floodWeight × frac × km × 60,
    confidence: CONFIDENCE[matrix.source],
    blocked: matrix.blocked?.[arc] === 1,
  }
```

**Flood handling:** When a fraction of the leg is in a flood zone, both duration and risk penalty increase.

### 1.5 Solver: Adaptive Large Neighborhood Search (ALNS)

**Location:** `src/lib/delivery/dispatch/solve.ts`

Three-phase metaheuristic:

1. **Construction:** Nearest-insertion with time-window feasibility (greedy, deterministic given a seed).

2. **Improvement:** 2-opt local search, relocate, and exchange moves. Stops on deadline or iteration limit.

3. **Ruin-and-Recreate:** Shaw-based spatial/temporal removal (destroy) + regret-2 reinsertion (rebuild). Uses Metropolis acceptance criterion to escape local optima. Stops early if no improvement after `ruinPatience` iterations.

**Key parameters:**
- `maxIterations`: Total budget (default likely ~10,000)
- `ruinIterations`: R&R rounds (default ~100)
- `ruinPatience`: Patience before early stop (default ~50)
- `seed`: Deterministic RNG initialization

**Metrics produced:**
- `iterations`: Count of local-search steps
- `cacheHits`, `cacheMisses`: Evaluation cache performance
- `routeEvaluations`: Times a full route was scored

### 1.6 Confidence and Data Quality Tracking

**Location:** `src/lib/delivery/dispatch/arc-cost.ts` (lines 4–8)

```typescript
const CONFIDENCE: Record<Matrix["source"], number> = {
  road_matrix: 1,           // Live Mapbox API result
  road_calibrated: 0.7,     // Estimated from observed ratio
  straight_line: 0.4,       // Haversine fallback
};
```

**Current flow:**
- Matrix source is recorded (`plan.dataQuality`)
- Confidence is attached to every cost
- **Not used in cost comparison** — low-confidence legs are not avoided by the solver

**Implication:** Historical YUTRA data can be added as a new source with an intermediate confidence level, but the solver will not penalize using it compared to live data unless the actual time estimate differs.

---

## 2. Recommended Integration Points

### 2.1 Option A: Historical Baseline Layer (Recommended)

**Concept:** Historical YUTRA data provides a **baseline** for roads where Mapbox live traffic is sparse or unavailable.

**Integration:**
1. Create a new matrix source: `"yutra_historical"` (confidence 0.5)
2. For each arc in the dispatch matrix, check:
   - Does Mapbox have live traffic data? → Use `road_matrix` (confidence 1.0)
   - Does YUTRA have observed data? → Use `yutra_historical` (confidence 0.5)
   - Otherwise → Use `straight_line` (confidence 0.4)
3. Store provenance in an extended matrix metadata field:
   ```typescript
   arcMetadata[arc] = {
     source: "yutra_historical",
     survey_year: 2013,
     table_id: "5.2.2.1",
     page: "5-5",
   }
   ```

**Advantages:**
- Non-invasive: Existing Mapbox logic untouched
- Preserves cache efficiency: Mapbox calls unaffected
- Gradual fallback: live → historical → heuristic
- Testable: Can compare solutions with/without YUTRA

**Disadvantages:**
- Requires OSM-to-YUTRA matching (geospatial challenge)
- Historical data may differ significantly from current road topology

### 2.2 Option B: Confirmation/Calibration Layer

**Concept:** Use YUTRA as a **validator** for anomalous Mapbox estimates.

**Integration:**
1. When Mapbox returns a time estimate that seems too low (outlier in distribution), check if YUTRA has evidence of congestion at that location.
2. If YUTRA confidence is high and Mapbox time seems optimistic, apply a confidence-weighted adjustment.

**Advantages:**
- Protects against unrealistic Mapbox estimates in congested areas
- Keeps YUTRA as a secondary check

**Disadvantages:**
- Adds complexity to cost calculation
- Requires heuristic "too low" threshold
- Not suitable for offline planning

### 2.3 Option C: Pre-Dispatch Calibration

**Concept:** Calibrate dispatch parameters (`trafficMultiplier`, `truckTimeFactor`) using YUTRA historical patterns before solving.

**Integration:**
1. Analyze YUTRA data to estimate `trafficMultiplier` by time-of-day
2. Before dispatch, adjust solver parameters based on service date and time
3. Solver then runs with calibrated parameters

**Advantages:**
- Lightweight: No per-arc lookups
- Systemic effect: Influences all routes

**Disadvantages:**
- Coarse grain: Cannot address localized delays
- Parameter tuning needed

---

## 3. Proposed Integration: Option A + Fallback Safety

### 3.1 Architecture

```
┌─────────────────────────────────────────────┐
│ Dispatch Request (Orders, Depot, Vehicles) │
└────────────────┬────────────────────────────┘
                 │
                 v
        ┌────────────────────┐
        │  buildRoadMatrix() │
        └────────┬───────────┘
                 │
         ┌───────┴───────┐
         │               │
         v               v
    ┌─────────────┐  ┌──────────────┐
    │   Mapbox    │  │ YUTRA Lookup │
    │  Live Data  │  │  & Estimate  │
    │ (conf 1.0)  │  │ (conf 0.5)   │
    └──────┬──────┘  └────────┬─────┘
           │                  │
           └──────────────────┘
                    │
                    v
           ┌────────────────────┐
           │  selectArcCost()   │
           │  by confidence &   │
           │  availability      │
           └────────┬───────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         v                     v
    ┌─────────────┐      ┌────────────┐
    │  Mapbox or  │      │ Haversine  │
    │  YUTRA      │      │ Fallback   │
    │             │      │(conf 0.4)  │
    └──────┬──────┘      └────┬───────┘
           │                  │
           └──────────┬───────┘
                      │
                      v
           ┌─────────────────────┐
           │ arcCost() with      │
           │ confidence metadata │
           └────────┬────────────┘
                    │
                    v
           ┌─────────────────────┐
           │ solve() (ALNS)      │
           └─────────────────────┘
```

### 3.2 Implementation Strategy

**Phase 1: Data Preparation**
- Extract YUTRA tables into normalized CSV/JSON
- Create geospatial match between YUTRA intersections and OSM nodes/ways
- Build a lookup table: (origin_osm_id, destination_osm_id) → (time_min, confidence, metadata)

**Phase 2: Matrix Augmentation**
- Modify `buildRoadMatrix()` to accept optional YUTRA baseline
- For each arc, attempt Mapbox → YUTRA → fallback
- Record provenance

**Phase 3: Cost Selection**
- Extend `arcCost()` to prefer higher-confidence data
- Maintain separate `arcMetadata` for traceability

**Phase 4: Validation**
- Run dispatch with live Mapbox only → baseline plan
- Run dispatch with YUTRA fallback → alternative plan
- Compare: Do they identify the same high-risk roads? Do ETAs improve where Mapbox is sparse?

---

## 4. Data Requirements from YUTRA

### 4.1 Priority 1: Road Capacity & Speed

| Data | Location | Usage | Confidence |
|------|----------|-------|-----------|
| Road max speed | Table 2.4.2 | Baseline for free-flow time | High: verified by survey |
| Road capacity (PCU/hour) | Table 2.4.1 | Input to BPR congestion model | High: measured |
| Vehicle PCU factors | Table 2.3.6 | Convert vehicles to PCU | High: standardized |

### 4.2 Priority 2: Intersection Delays

| Data | Location | Usage | Confidence |
|------|----------|-------|-----------|
| Signal delay (red light) | Section 5.5 | Add to free-flow estimate | Medium: point-in-time |
| Intersection volume (peak/off-peak) | Table 5.2.2.1 | Input to BPR model | Medium: survey 2013 |
| Congestion level by intersection | Section 5.2.2 | Classify severity | Medium: modeled |

### 4.3 Priority 3: Turn Movements & Directions

| Data | Location | Usage | Confidence |
|------|----------|-------|-----------|
| Turn movement profiles | Section 5.3 | Directional delay estimates | Low: aggregated |
| Directional split by road | Section 5.3 | Confirm matching before/after directions | Low: time-varying |

### 4.4 BPR Congestion Model Parameters

**Formula:**
```
t = t₀ × [ 1 + 3 × (v/c)⁴ ]

where:
  t    = estimated travel time (minutes)
  t₀   = free-flow travel time (minutes)
  v    = traffic volume (vehicles per hour)
  c    = road capacity (vehicles per hour)
```

**Required calibration:**
- Free-flow speed (km/h) → t₀
- Measured peak volume → v
- Design capacity → c
- Confidence in v (point-in-time or average?)

---

## 5. Integration Points Summary

| Component | Current Logic | Historical Integration | Impact |
|-----------|---------------|------------------------|--------|
| `buildRoadMatrix()` | Mapbox → Haversine | Mapbox → YUTRA → Haversine | Non-breaking; optional layer |
| `arcCost()` | Single source per arc | Multi-source selection | Confidence metadata added |
| `scoreCost()` | Ignores confidence | Confidence used for tie-breaking only | Non-breaking |
| `solve()` | ALNS with arc costs | Same; arc costs come from YUTRA source | Non-breaking |
| `RouteEval` | Time, cost, risk | Additional provenance metadata | Additive; for audit trail |

---

## 6. Known Constraints

### 6.1 Cannot Break Existing Behavior

1. **Mapbox cache must remain active:** YUTRA lookup should not disable the existing road-pair cache.
2. **Straight-line fallback must remain:** If neither Mapbox nor YUTRA has data, Haversine with road factor is the safety net.
3. **Solver parameters unchanged:** The dispatch algorithm configuration must work unchanged with the new cost source.

### 6.2 Data Quality Challenges

1. **Road network evolution:** 2013 OSM may differ significantly from current roads. Bridges, bypasses, widening, and closures are common in urban Yangon.
2. **Geocoding ambiguity:** YUTRA reports use Burmese and English place names; exact intersection coordinates must be verified.
3. **Directional asymmetry:** YUTRA may report intersection delays without directional breakdown. One-way streets are underspecified.
4. **Temporal scope:** YUTRA is a snapshot; daily and seasonal variation is not captured.

---

## 7. Recommended Next Steps

### Phase 2 Tasks

1. **Extract YUTRA tables** into structured formats:
   - `road_speed_profiles.json`: Road → max_speed_kmh
   - `road_capacity.csv`: Road → capacity_veh_per_hour
   - `intersection_volume.csv`: Intersection → peak_volume, off_peak_volume
   - `intersection_congestion.csv`: Intersection → congestion_level
   - `signal_delay_observations.csv`: Signal → mean_red_time_seconds
   - `traffic_model_parameters.json`: BPR α, β calibration

2. **Geospatial matching:**
   - Load `data/yangon.osm.pbf` (already in repo)
   - Normalize YUTRA place names (Burmese ↔ English aliases)
   - Create OSM node/way lookup table
   - Score match confidence

3. **Design fallback safely:**
   - If YUTRA match confidence < 0.6, don't use; fall through to Haversine
   - Maintain audit trail for every substitution

4. **Create test matrix:**
   - Render 100-stop dispatch scenario
   - Compare: Mapbox only vs. Mapbox + YUTRA fallback
   - Measure: same optimal routes? Better ET as?

---

## 8. Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| YUTRA 2013 data may be outdated | High | Use only as fallback; prioritize live Mapbox. Never override live data. |
| OSM matching creates false arcs | High | Require match confidence > 0.65. Maintain unmatched queue for manual review. |
| Increased matrix build time | Medium | Cache aggressively. Profile build time; alert if > 500ms. |
| Solver produces different routes | Medium | Compare baseline vs. YUTRA in A/B test with real orders. |
| False confidence in historical estimates | High | Label all YUTRA-sourced arcs; audit logs must show source provenance. |

---

## 9. Definition of Success (Phase 1)

- [ ] Architecture reviewed and approved
- [ ] YUTRA data inventory complete (all tables identified and assessed)
- [ ] Geospatial matching approach documented
- [ ] Integration points specified (Option A chosen with fallback safety)
- [ ] Risk mitigation plan in place
- [ ] Next-phase deliverables clearly scoped

