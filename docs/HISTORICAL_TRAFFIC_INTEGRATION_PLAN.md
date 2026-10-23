# Oern Historical Traffic Integration Plan
## Complete Implementation Roadmap

**Status:** Phase 1 Complete — Architecture Analysis Done  
**Target:** Integrate YUTRA 2013 Yangon traffic data into dispatch routing system  
**Goal:** Improve travel-time estimation where real-time traffic data is sparse

---

## Part 1: Architecture Review (COMPLETE)

See [`docs/YUTRA_INTEGRATION_ANALYSIS.md`](YUTRA_INTEGRATION_ANALYSIS.md) for:
- Existing routing architecture analysis
- Cost model (`RoutingCost`) and confidence tracking
- Recommended integration approach (Option A: Historical Baseline Layer)
- Risk mitigation strategy

**Key Decision:** Use YUTRA as a **fallback layer** between Mapbox live traffic and Haversine heuristics.

---

## Part 2: Data Extraction & Geospatial Matching (IN PROGRESS)

See [`docs/YUTRA_EXTRACTION_PLAN.md`](YUTRA_EXTRACTION_PLAN.md) for:
- Table-by-table extraction specifications
- Provenance requirements (source page, table ID, confidence)
- Geospatial matching workflow (name + proximity scoring)
- Validation and quality gates

**Deliverables:**
```
data/yutra_raw/
  ├── vehicle_pcu_factors.json
  ├── road_speed_capacity.csv
  ├── traffic_model_parameters.json
  ├── intersection_volume.csv
  ├── intersection_congestion.csv
  ├── signal_delay_observations.csv
  └── turn_movement_profiles.csv

data/yutra_matched/
  ├── roads_matched_osm.csv
  ├── intersections_matched_osm.csv
  ├── unmatched_intersections.json
  └── matching_report.md

data/yutra_processed/
  ├── historical_arc_matrix.csv
  ├── historical_signal_delays.csv
  └── integration_metadata.json
```

---

## Part 3: Implementation Architecture

### 3.1 System Design

```
┌─────────────────────────────────────────────┐
│  Dispatch Request Handler                   │
│  POST /api/dispatch/plan                    │
└────────────────┬────────────────────────────┘
                 │
         ┌───────v───────┐
         │  buildMatrix()│
         └───────┬───────┘
                 │
     ┌───────────┴───────────┐
     │                       │
     v                       v
┌──────────────┐    ┌─────────────────────┐
│   Mapbox     │    │  Historical YUTRA   │
│ Live Traffic │    │  Baseline Lookup    │
│  Cache       │    │   (CSV + JSON)      │
└──────┬───────┘    └────────┬────────────┘
       │                     │
       │ (confidence 1.0)    │ (confidence 0.5)
       │                     │
       └──────────┬──────────┘
                  │
                  v
        ┌──────────────────┐
        │ selectArcCost()  │
        │ (Strategy: Prefer│
        │  higher conf,    │
        │  then fallback)  │
        └────────┬─────────┘
                 │
     ┌───────────┴───────────┐
     │                       │
     v                       v
  ┌─────────┐          ┌────────────┐
  │Mapbox or│          │ Haversine  │
  │YUTRA    │          │ Fallback   │
  │Arc Cost │          │(conf 0.4)  │
  └────┬────┘          └──────┬─────┘
       │                      │
       └──────────┬───────────┘
                  │
                  v
      ┌──────────────────────┐
      │ arcCost() produces   │
      │ RoutingCost with     │
      │ confidence metadata  │
      └──────────┬───────────┘
                 │
                 v
      ┌──────────────────────┐
      │ solve() ALNS Solver  │
      │ (unchanged logic)    │
      └──────────┬───────────┘
                 │
                 v
      ┌──────────────────────┐
      │ Plan with routes,    │
      │ arcs traced to source│
      └──────────────────────┘
```

### 3.2 Code Structure (TypeScript)

**New Files to Create:**

```
src/lib/delivery/
├── dispatch/
│   ├── historical-arc-lookup.ts      # Load & cache YUTRA data
│   ├── historical-cost-calculator.ts # BPR model implementation
│   └── arc-cost-strategy.ts          # Confidence-based selection
│
├── road-intel/
│   ├── historical-data-types.ts      # YUTRA data interfaces
│   └── historical-geospatial.ts      # OSM matching utilities
│
└── data/
    └── yangon-yutra/
        ├── vehicle_pcu_factors.json
        ├── road_speed_capacity.csv
        ├── traffic_model_parameters.json
        ├── historical_arc_matrix.csv
        └── signal_delays.csv
```

---

## Part 4: Implementation Phases

### Phase 2a: Data Pipeline (Weeks 1–2)

**Tasks:**
1. Manually extract YUTRA tables (2–4 hours per table)
2. Validate extraction against PDF source
3. Implement `HistoricalDataLoader` class
4. Create CSV → JSON transformation pipeline
5. Load into memory cache on app startup

**Deliverables:**
- `src/lib/delivery/dispatch/historical-arc-lookup.ts` — Data loader
- `data/yutra_raw/*.csv` — Extracted YUTRA data
- `data/yutra_processed/historical_arc_matrix.csv` — Processed lookup table
- `validate_yutra_extract.py` — Validation script

**Testing:**
```bash
npm run test -- historical-arc-lookup.test.ts
# Validate: 500 test arcs load correctly
# Validate: Cache hit ratio > 95% on repeated lookups
# Validate: Unmatched arc falls through to null
```

### Phase 2b: Geospatial Matching (Weeks 2–3)

**Tasks:**
1. Load `data/yangon.osm.pbf` and extract nodes/ways
2. Implement name-matching algorithm (exact, fuzzy, translation)
3. Score each YUTRA road/intersection against OSM candidates
4. Generate unmatched queue
5. Manual review cycle (likely 50–100 intersections)
6. Update confidence scores based on manual verification

**Deliverables:**
- `src/lib/delivery/road-intel/historical-geospatial.ts` — Matching logic
- `data/yutra_matched/roads_matched_osm.csv` — Matched roads
- `data/yutra_matched/intersections_matched_osm.csv` — Matched intersections
- `data/yutra_matched/unmatched_intersections.json` — Manual review queue
- `data/yutra_matched/matching_report.md` — Summary statistics

**Matching Metrics:**
- Target: ≥ 85% of YUTRA intersections matched at confidence ≥ 0.65
- Expected unmatched: 10–15% (minor streets, renamed roads)
- Manual review time: 2–4 hours

### Phase 3: Cost Calculation (Weeks 3–4)

**Tasks:**
1. Implement BPR congestion model: `t = t₀ [1 + 3(v/c)⁴]`
2. Create `HistoricalCostCalculator` class
3. For each arc:
   - Look up YUTRA baseline (volume, capacity, max speed)
   - Calculate free-flow time (distance / max_speed)
   - Apply BPR formula if volume data exists
   - Add signal delays if known
4. Cache results; invalidate on dispatch date change
5. Handle missing data gracefully (fall through to next layer)

**Deliverables:**
- `src/lib/delivery/dispatch/historical-cost-calculator.ts` — BPR model
- Unit tests covering edge cases (v/c > 1.0, missing volume, etc.)
- Integration test: 1000 random arcs produce deterministic costs

**BPR Formula Implementation:**

```typescript
/**
 * Estimate travel time under congestion using BPR model.
 * t = t₀ × [1 + α × (v/c)^β]
 * 
 * @param freeFlowTime_min Free-flow time without congestion
 * @param volume_veh_hour Traffic volume (vehicles/hour)
 * @param capacity_veh_hour Road capacity (vehicles/hour, in PCU)
 * @param alpha BPR shape parameter (typically 3.0)
 * @param beta BPR exponent (typically 4.0)
 * @returns Estimated travel time (minutes)
 */
export function bprTravelTime(
  freeFlowTime_min: number,
  volume_veh_hour: number,
  capacity_veh_hour: number,
  alpha: number = 3.0,
  beta: number = 4.0
): number {
  if (capacity_veh_hour === 0 || volume_veh_hour === 0) {
    return freeFlowTime_min; // No data; return free-flow
  }
  
  const volumeCapacityRatio = volume_veh_hour / capacity_veh_hour;
  const congestionFactor = 1 + alpha * Math.pow(volumeCapacityRatio, beta);
  return freeFlowTime_min * congestionFactor;
}
```

### Phase 4: Arc Cost Strategy (Week 4)

**Tasks:**
1. Implement confidence-based arc cost selection
2. For each arc:
   - Try Mapbox live data (confidence 1.0)
   - If not available, try YUTRA historical (confidence 0.5)
   - If not available, use Haversine (confidence 0.4)
3. Attach provenance metadata to every cost
4. Never override live Mapbox data with historical

**Deliverables:**
- `src/lib/delivery/dispatch/arc-cost-strategy.ts` — Selection logic
- Extended `arcCost()` function with provenance tracking
- Unit tests verifying fallback chain

**Confidence-Based Selection Logic:**

```typescript
export type ArcSource = "mapbox_live" | "yutra_historical" | "haversine";

export interface ArcCostWithMetadata extends RoutingCost {
  source: ArcSource;
  provenance: {
    table_id?: string;
    survey_year?: number;
    source_page?: string;
  };
}

export function selectArcCost(
  arcIndex: number,
  matrix: Matrix,
  truck: Truck,
  params: DispatchParams,
  historicalLookup?: HistoricalArcLookup
): ArcCostWithMetadata {
  // Priority 1: Mapbox live traffic (if matrix source is road_matrix)
  if (matrix.source === "road_matrix") {
    return {
      ...arcCost(matrix, arcIndex, truck, params),
      source: "mapbox_live",
      confidence: 1.0,
      provenance: {}
    };
  }
  
  // Priority 2: YUTRA historical baseline
  if (historicalLookup) {
    const historical = historicalLookup.lookup(arcIndex);
    if (historical) {
      return {
        durationSeconds: historical.durationSeconds,
        distanceMeters: historical.distanceMeters,
        operatingCostMMK: historical.operatingCostMMK,
        riskPenaltySeconds: 0, // YUTRA doesn't cover current hazards
        confidence: 0.5,
        blocked: false,
        source: "yutra_historical",
        provenance: historical.provenance
      };
    }
  }
  
  // Priority 3: Haversine fallback
  return {
    ...arcCost(matrix, arcIndex, truck, params),
    source: "haversine",
    confidence: 0.4,
    provenance: {}
  };
}
```

### Phase 5: Integration into Routing (Week 4–5)

**Tasks:**
1. Modify `buildRoadMatrix()` to accept YUTRA layer
2. Modify `arcCost()` to call arc-cost strategy
3. Update `Plan` output to include arc provenance
4. Add `dataQuality` breakdown: `{ mapbox: 45%, yutra: 30%, haversine: 25% }`
5. Update route evaluation to track confidence per arc

**Deliverables:**
- Updated `src/lib/delivery/dispatch/road-matrix.ts`
- Updated `src/lib/delivery/dispatch/arc-cost.ts`
- Updated `src/lib/delivery/dispatch/types.ts` with provenance fields
- Integration test: Existing tests still pass; routes differ only where YUTRA fills gaps

**Modified Types:**

```typescript
// In dispatch/types.ts
export type ArcCostMetadata = {
  source: "mapbox_live" | "yutra_historical" | "haversine";
  table_id?: string;
  survey_year?: number;
  source_page?: string;
};

export type Plan = {
  routes: PlanRoute[];
  unassigned: Plan["unassigned"];
  objective: { routes: number; unserved: number; total: number };
  seed: number;
  iterations: number;
  stopReason: "deadline" | "optimal" | "infeasible";
  dataQuality: {
    source: "road_matrix" | "road_calibrated" | "straight_line";
    coverage: {
      mapbox_live: number; // percentage of arcs
      yutra_historical: number;
      haversine: number;
    };
    arcProvenance?: ArcCostMetadata[]; // Optional: per-arc tracing
  };
  hash: string;
};
```

### Phase 6: Validation & Testing (Week 5–6)

**Tasks:**
1. Create dispatch test scenarios:
   - **Scenario A:** Short route with major intersection delay (YUTRA captures, Mapbox miss)
   - **Scenario B:** Long route, potentially faster despite distance (historical data shows congestion on short route)
   - **Scenario C:** Missing YUTRA data (must gracefully fall through)
   - **Scenario D:** Peak vs. off-peak (confirm time adjustment)
   - **Scenario E:** Unmatched intersection (ensure no crash, use fallback)

2. Baseline measurements:
   - Run dispatch with Mapbox only
   - Record route selections, durations, costs
   - Save plan hash

3. YUTRA comparison:
   - Run dispatch with Mapbox + YUTRA fallback
   - Compare plan hash (should differ only in sparse areas)
   - Measure ETA accuracy where independent journey data exists
   - Document any improvements or regressions

4. Performance testing:
   - Profile matrix build time (target: < 500ms for 100-stop problem)
   - Profile YUTRA lookups (target: < 5ms per 100 arcs)
   - Verify cache hit ratio (target: > 85%)

**Deliverables:**
- `test/dispatch/historical-traffic.test.ts` — Comprehensive test suite
- `test/dispatch/validation-scenarios.ts` — Real-world test cases
- `docs/VALIDATION_RESULTS.md` — Performance and accuracy results

**Test Scenario Example (TypeScript):**

```typescript
describe("Historical YUTRA Integration", () => {
  it("should select YUTRA baseline when Mapbox has no live data", async () => {
    const instance = createTestInstance({
      trucks: [{ id: "t1", capKg: 50, capM3: 1, costPerKm: 100, fixedCost: 5000, maxKm: 100 }],
      requests: [
        { id: "r1", origin: "door", pickup: { lat: 16.85, lng: 96.20 }, delivery: { lat: 16.88, lng: 96.22 }, ... },
        { id: "r2", origin: "door", pickup: { lat: 16.88, lng: 96.22 }, delivery: { lat: 16.90, lng: 96.25 }, ... }
      ]
    });
    
    const matrix = buildStraightLineMatrix([/* points */], {});
    const historicalLookup = new HistoricalArcLookup("data/yutra_processed/historical_arc_matrix.csv");
    
    // Arc cost should select YUTRA if available
    const cost = selectArcCost(arcIndex, matrix, instance.trucks[0], instance.params, historicalLookup);
    
    expect(cost.source).toBe("yutra_historical");
    expect(cost.confidence).toBe(0.5);
    expect(cost.provenance.survey_year).toBe(2013);
  });
  
  it("should never override Mapbox live data with YUTRA", async () => {
    // Create matrix with road_matrix source (live Mapbox)
    const matrix = { source: "road_matrix", ... };
    const cost = selectArcCost(arcIndex, matrix, truck, params, historicalLookup);
    
    expect(cost.source).toBe("mapbox_live");
    expect(cost.confidence).toBe(1.0);
  });
});
```

### Phase 7: Documentation (Week 6)

**Tasks:**
1. Complete extraction report (tables, page numbers, quality notes)
2. Geospatial matching summary (coverage, unmatched items, manual review log)
3. Integration guide (how to enable/disable YUTRA layer)
4. Data provenance audit trail (every arc traces back to source)
5. Validation results (performance, accuracy, confidence metrics)
6. Future improvements (opportunities for better data)

**Deliverables:**
- `docs/YUTRA_DATA_INVENTORY.md` — Complete table census
- `docs/YUTRA_EXTRACTION_REPORT.md` — Extraction summary with quality metrics
- `docs/DATA_PROVENANCE.md` — Full traceability from YUTRA → OSM → routing
- `docs/VALIDATION_RESULTS.md` — Performance and accuracy benchmarks
- `docs/HISTORICAL_TRAFFIC_USAGE_GUIDE.md` — How to use in production

---

## Part 5: Integration Configuration

### 5.1 Environment Variables

Add to `.env.local` or deployment config:

```bash
# Historical traffic data options
YUTRA_HISTORICAL_ENABLED=true               # Enable/disable YUTRA fallback
YUTRA_DATA_PATH=./data/yutra_processed/    # Path to processed YUTRA CSV/JSON
YUTRA_CONFIDENCE_THRESHOLD=0.65             # Min confidence score to use
YUTRA_CACHE_TTL_SECONDS=86400               # Cache duration (1 day)
```

### 5.2 Dispatch Parameters

Extend `DispatchParams` type:

```typescript
export type DispatchParams = {
  // ... existing params ...
  
  // New: Historical traffic configuration
  useHistoricalBaseline: boolean;
  historicalConfidenceThreshold: number;
  historicalMaxAgeHours: number;
};
```

### 5.3 API Response Enhancement

```typescript
export type DispatchPlanResponse = {
  // ... existing fields ...
  
  // New: Data quality transparency
  dataQuality: {
    source: string;
    coverage: {
      mapbox_live: number;
      yutra_historical: number;
      haversine: number;
    };
    timestamp: string;
  };
  
  // Optional: Per-arc provenance (for audit)
  arcSources?: {
    arcIndex: number;
    source: "mapbox_live" | "yutra_historical" | "haversine";
    confidence: number;
    table_id?: string;
  }[];
};
```

---

## Part 6: Deployment & Safety

### 6.1 Rollout Strategy

**Week 1–2: Dry Run**
- Deploy with `YUTRA_HISTORICAL_ENABLED=false` (disabled)
- Monitor: No change in behavior
- Verify: No increase in dispatch time

**Week 3–4: Canary**
- Enable for 10% of dispatch requests (A/B test)
- Compare: Route selections, ETA accuracy, cost
- Alert if: Dispatch time > 1s, cache miss rate > 20%

**Week 5+: Full Rollout**
- Gradually increase to 100%
- Monitor KPIs: Delivery success rate, customer satisfaction
- Document any observed improvements

### 6.2 Fallback & Disable

**If issues arise:**
1. Set `YUTRA_HISTORICAL_ENABLED=false` (immediate)
2. Requests fall back to Mapbox → Haversine chain
3. Clear YUTRA cache: `rm -rf .yutra_cache/`
4. Restart dispatch service

**No manual intervention needed:** Existing code path unaffected.

### 6.3 Monitoring & Alerts

Create CloudWatch/Datadog metrics:

```
dispatch.arc_cost.source.mapbox_live     # % of arcs from Mapbox
dispatch.arc_cost.source.yutra_historical # % of arcs from YUTRA
dispatch.arc_cost.source.haversine        # % of arcs from Haversine

dispatch.matrix_build_time_ms             # Time to build matrix
dispatch.historical_lookup_time_ms        # Time to lookup YUTRA arcs

dispatch.plan.success_rate                # % of plans that found solution
dispatch.plan.unassigned_count            # Orders not assigned
```

**Alerts:**
- If `yutra_historical` > 50%: Manual review (indicates Mapbox sparse area or cache issue)
- If `matrix_build_time_ms` > 1000: Investigate lookup performance
- If `plan.success_rate` drops > 5%: Potential issue with YUTRA data

---

## Part 7: Timeline & Milestones

| Phase | Weeks | Deliverables | Status |
|-------|-------|--------------|--------|
| 1: Architecture Analysis | Week 1 | YUTRA_INTEGRATION_ANALYSIS.md | ✅ DONE |
| 2a: Data Extraction | Weeks 2–3 | vehicle_pcu_factors.json, road_speed_capacity.csv, etc. | 📋 NEXT |
| 2b: Geospatial Matching | Weeks 3–4 | roads_matched_osm.csv, matching_report.md | 📋 NEXT |
| 3: Cost Calculation | Weeks 4–5 | historical-cost-calculator.ts, BPR tests | 📋 NEXT |
| 4: Arc Cost Strategy | Week 5 | arc-cost-strategy.ts, selectArcCost() | 📋 NEXT |
| 5: Integration | Week 5–6 | Modified dispatch pipeline, full integration | 📋 NEXT |
| 6: Validation & Testing | Week 6–7 | Test scenarios, validation results | 📋 NEXT |
| 7: Documentation | Week 7 | All doc files, usage guide | 📋 NEXT |
| **Total** | **7 weeks** | **Full production integration** | **IN PROGRESS** |

---

## Part 8: Success Criteria

### Phase 1 (Architecture) ✅

- [x] Architecture reviewed
- [x] Integration points identified
- [x] Risk mitigation planned
- [x] Confidence model chosen

### Phase 2 (Data Extraction) 📋

- [ ] All YUTRA tables extracted with provenance
- [ ] ≥ 85% of intersections matched to OSM (confidence ≥ 0.65)
- [ ] Unmatched queue < 15% of data
- [ ] Data passes automated validation checks

### Phase 3–5 (Implementation) 📋

- [ ] Historical cost calculation deterministic and tested
- [ ] Arc selection follows confidence hierarchy
- [ ] Existing dispatch tests still pass
- [ ] No performance regression (matrix build < 500ms)

### Phase 6 (Validation) 📋

- [ ] Test scenarios cover edge cases
- [ ] Baseline vs. YUTRA comparison documented
- [ ] ETA accuracy measured where independent data exists
- [ ] No crashes or hangs observed

### Phase 7 (Documentation) 📋

- [ ] Complete data inventory
- [ ] Extraction methodology documented
- [ ] Geospatial matching results published
- [ ] Validation results show measurable improvements or clear neutral impact
- [ ] Usage guide complete for operations team

---

## Part 9: Known Constraints & Assumptions

### Assumptions
1. YUTRA 2013 data is reasonably representative of seasonal/peak patterns (even if traffic volumes changed)
2. OSM road network is sufficiently similar to 2013 (new bypasses, closures are exceptions)
3. Dispatch decisions will improve when historical data fills gaps in Mapbox coverage

### Constraints
1. **Mapbox is always preferred:** Live traffic overrides historical baselines automatically
2. **No synthetic data:** If YUTRA doesn't have observed values, use `null` (fall through to Haversine)
3. **Manual matching required:** Cannot fully automate geospatial matching; human review needed for 10–15%
4. **Backward compatibility:** Existing dispatch must work unchanged if YUTRA layer is disabled
5. **No offline data updates:** YUTRA data is static 2013 snapshot; cannot be updated without reprocessing

---

## Part 10: Appendix: Command Reference

### Extract YUTRA Data (Manual)
```bash
# Open YUTRA PDF, navigate to table pages, manually copy to CSV
# Use tool: OpenOffice Calc or LibreOffice for quick copy-paste
# Verify: Check row counts match report totals
```

### Validate Extracted Data
```bash
python3 validate_yutra_extract.py data/yutra_raw/road_speed_capacity.csv
# Output: PASS or FAIL + details
```

### Run Geospatial Matching
```bash
npm run match:yutra:osm
# Input: data/yutra_raw/*.csv
# Output: data/yutra_matched/*.csv
```

### Build Historical Arc Matrix
```bash
npm run build:historical:arc-matrix
# Input: data/yutra_matched/, OSM data
# Output: data/yutra_processed/historical_arc_matrix.csv
```

### Test Integration
```bash
npm test -- dispatch/historical-traffic.test.ts
# Runs all YUTRA integration tests
```

### Deploy to Production
```bash
# 1. Dry run (disabled)
export YUTRA_HISTORICAL_ENABLED=false
npm run deploy

# 2. Canary (10%)
export YUTRA_HISTORICAL_ENABLED=true
export YUTRA_ROLLOUT_PERCENTAGE=10
npm run deploy

# 3. Full rollout (100%)
export YUTRA_ROLLOUT_PERCENTAGE=100
npm run deploy
```

---

## Summary

This integration plan transforms YUTRA 2013 Yangon traffic observations into a reliable fallback layer within Oern's dispatch system. By preserving the existing Mapbox-first logic and gracefully falling through to historical baselines when live data is unavailable, we improve route recommendations in sparse-coverage areas without risking regression in well-served corridors.

**The final system maintains a clear hierarchy:**
1. **Mapbox live traffic** (confidence 1.0) — always preferred
2. **YUTRA historical baseline** (confidence 0.5) — when Mapbox unavailable
3. **Haversine heuristic** (confidence 0.4) — fallback when both fail

All decisions are auditable: every arc traces back to its source with complete provenance.

