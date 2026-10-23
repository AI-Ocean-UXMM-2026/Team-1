# Oern Historical Traffic Integration — Phase 1 Summary
## YUTRA Data Integration Project Kickoff

**Date:** 2026-10-23  
**Status:** Phase 1 Complete — Architecture Review & Planning Complete  
**Next Phase:** Data Extraction (Weeks 2–3)

---

## What We Did

This analysis assessed how to integrate historical Yangon traffic observations (YUTRA 2013) into Oern's Smart Route Decision Engine, following the principle that **shortest route ≠ fastest route**.

### Three Documents Created

1. **[YUTRA_INTEGRATION_ANALYSIS.md](YUTRA_INTEGRATION_ANALYSIS.md)** (5,500 words)
   - Deep dive into Oern's existing routing architecture
   - How `RoutingCost` and confidence tracking already work
   - Why historical data fits naturally into the system
   - Three integration options evaluated; Option A recommended

2. **[YUTRA_EXTRACTION_PLAN.md](YUTRA_EXTRACTION_PLAN.md)** (4,000 words)
   - Table-by-table breakdown of what to extract from YUTRA
   - Provenance requirements (source, page, table ID, confidence level)
   - Geospatial matching strategy (confidence scoring, unmatched queue)
   - CSV/JSON templates for each data type

3. **[HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md](HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md)** (6,000 words)
   - Complete 7-week implementation roadmap
   - Phase-by-phase tasks, deliverables, testing
   - Code architecture and data flow diagrams
   - Deployment strategy and safety measures

---

## Key Findings

### ✅ Oern's Architecture is Ready

The dispatch system already:
- **Separates cost calculation from routing logic** via `RoutingCost` interface
- **Tracks confidence levels** (1.0 for Mapbox, 0.4 for Haversine fallback)
- **Caches road-pair data** at 1m resolution (improves with YUTRA lookups)
- **Modulates travel times** with multiple factors (truck speed, flood delays, traffic multipliers)
- **Supports multiple matrix sources** (Mapbox live, calibrated estimates, heuristics)

**Implication:** Historical data can be added as a new layer without breaking existing functionality.

### ✅ Shortest Route ≠ Fastest Route is Already Implemented

The solver explicitly considers:
- **Time uncertainty** (`legSigma`, `serviceSigma`)
- **Cost penalties** (mmkPerScoreMinute)
- **Risk penalties** (flood hazards, road closures)
- **Service windows** (hard and soft deadlines)

Historical data will improve the **time estimates** component, enabling better decisions where live traffic is sparse.

### ✅ Natural Integration Point Found

**Recommended approach: Historical Baseline Layer**

```
Mapbox Live (confidence 1.0)
    ↓ if unavailable
YUTRA Historical (confidence 0.5)
    ↓ if unavailable
Haversine Fallback (confidence 0.4)
```

This preserves all existing behavior while filling gaps.

### ⚠️ Challenges Identified

1. **Geospatial matching:** 2013 Yangon roads may differ from current OSM
   - Expected solution: ≥ 85% match at confidence ≥ 0.65; manual review for remainder
   - Effort: 2–4 hours for unmatched queue

2. **Directional asymmetry:** YUTRA may not break down intersection delays by direction
   - Expected solution: Use unidirectional averages; flag asymmetric cases for review

3. **Temporal scope:** YUTRA is a snapshot; daily/seasonal variation unknown
   - Expected solution: Use as peak-hour baseline; apply `trafficMultiplier` for time-of-day

4. **Data quality verification:** Must trace every arc back to original source
   - Expected solution: Full provenance metadata on every record

---

## Architecture Decision: Option A (Recommended)

### Why This Approach

1. **Non-invasive:** Mapbox logic untouched; YUTRA is purely additive
2. **Safe fallback:** If YUTRA data is wrong, live traffic (when available) overrides it
3. **Testable:** Can compare baseline (Mapbox only) vs. augmented (Mapbox + YUTRA)
4. **Gradual rollout:** Enable/disable via config without code changes

### How It Works

1. **At dispatch time:** Load Mapbox live traffic data (existing behavior)
2. **For sparse arcs:** Look up YUTRA historical estimates
3. **Missing both:** Fall back to Haversine (existing safety net)
4. **Solver unchanged:** Uses costs as-is; doesn't know which source they came from
5. **Full traceability:** Every arc tagged with source + confidence + metadata

### Data Confidence Hierarchy

| Source | Confidence | Usage | Override Risk |
|--------|-----------|-------|----------------|
| Mapbox Live Traffic | 1.0 | Always use | None — highest priority |
| YUTRA Historical | 0.5 | When Mapbox unavailable | Low — fallback only |
| Haversine Heuristic | 0.4 | Last resort | Low — only if both fail |

---

## What Data We Need to Extract

### From the YUTRA PDF

| Table | Purpose | Output Format |
|-------|---------|---|
| **Table 2.3.6** | Vehicle PCU factors | `vehicle_pcu_factors.json` |
| **Table 2.4.1–2.4.2** | Road speeds & capacity | `road_speed_capacity.csv` |
| **Section 2.3.8** | BPR model parameters | `traffic_model_parameters.json` |
| **Table 5.2.2.1** | Intersection volumes | `intersection_volume.csv` |
| **Section 5.2.2** | Congestion levels | `intersection_congestion.csv` |
| **Section 5.5** | Signal delays | `signal_delay_observations.csv` |
| **Section 5.3** | Turn movements | `turn_movement_profiles.csv` |

### Required Metadata on Every Record

```json
{
  "source": "YUTRA Volume II",
  "survey_year": 2013,
  "source_page": "5-5",
  "table_id": "5.2.2.1",
  "data_type": "observed",
  "confidence": "verified",
  "unit": "veh/hour"
}
```

**Rule:** Never fabricate values. Use `null` for missing data; don't interpolate.

---

## Implementation Timeline

| Phase | Duration | Key Deliverable | When |
|-------|----------|---|---|
| 1: Architecture Review | 1 week | This analysis ✅ | Complete |
| 2a: Data Extraction | 2 weeks | YUTRA tables in CSV/JSON | Weeks 2–3 |
| 2b: Geospatial Matching | 1 week | Roads/intersections linked to OSM | Week 4 |
| 3: Cost Calculation | 1 week | BPR model implementation | Week 4 |
| 4: Arc Cost Strategy | 1 week | Confidence-based arc selection | Week 5 |
| 5: Integration | 1 week | Historical layer in dispatch pipeline | Week 5 |
| 6: Testing & Validation | 2 weeks | Test scenarios, performance metrics | Weeks 6–7 |
| 7: Documentation | 1 week | Final docs, usage guide, audit trail | Week 7 |
| **Total** | **7 weeks** | **Production-ready integration** | Week 7 |

---

## Immediate Next Steps (Week 1)

### Task 1: Manually Extract YUTRA Data (2–4 hours)

1. Open the YUTRA PDF: `/Users/happer/Downloads/12182739_02 (1).pdf`
2. Use table of contents to locate:
   - Table 2.3.6 (Vehicle PCU factors)
   - Table 2.4.1–2.4.2 (Road capacity & speeds)
   - Section 2.3.8 (BPR model parameters)
3. Copy data into CSV or JSON files in `data/yutra_raw/`
4. Add provenance fields (source page, table ID, confidence)
5. Save with UTF-8 encoding for Burmese text

**Deliverable:** Sample extractions in `data/yutra_raw/`

### Task 2: Set Up Validation Pipeline (1–2 hours)

1. Create `validate_yutra_extract.py` script
2. Implement checks:
   - All provenance fields present
   - No fabricated values
   - Date/survey period explicitly stated
   - Confidence level classified
3. Run validation on sample extractions
4. Fix any validation errors

**Deliverable:** Passing validation tests

### Task 3: Prepare Geospatial Matching (1–2 hours)

1. Load `data/yangon.osm.pbf` (already in repo)
2. Extract OSM road names and intersection coordinates
3. Design name-matching algorithm (exact, fuzzy, translation)
4. Create confidence scoring formula
5. Prepare QGIS for manual review of unmatched intersections

**Deliverable:** Matching algorithm design & initial test

---

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| YUTRA 2013 may be outdated | High | Use only as fallback; never override Mapbox live data |
| OSM matching creates false arcs | High | Require confidence score ≥ 0.65; manual review unmatched |
| Historical data misleads solver | Medium | A/B test baseline vs. augmented; compare route selections |
| Performance regression | Medium | Profile matrix build time; alert if > 500ms |
| False confidence in estimates | High | Label all YUTRA sources in audit trail; trace every arc |

---

## Definition of Done (Phase 1)

**All of the following must be true:**

- [x] Architecture analyzed and documented (see YUTRA_INTEGRATION_ANALYSIS.md)
- [x] Recommended approach chosen and justified (Option A: Historical Baseline Layer)
- [x] Data requirements identified (7 tables from YUTRA)
- [x] Extraction methodology documented (see YUTRA_EXTRACTION_PLAN.md)
- [x] Geospatial matching approach specified
- [x] Implementation roadmap created (see HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md)
- [x] Risk assessment completed
- [x] Timeline estimated (7 weeks)
- [x] Next-phase deliverables clearly scoped

---

## How to Use These Documents

### For Managers / Product
- Read: [YUTRA_INTEGRATION_ANALYSIS.md](YUTRA_INTEGRATION_ANALYSIS.md) Sections 1–3
- Start: Week 1 data extraction task
- Track: 7-week implementation timeline

### For Engineers
- Read: All three documents completely
- Implement: Following [HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md](HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md) phases
- Test: Using validation scenarios in Part 6

### For Data & GIS Specialists
- Read: [YUTRA_EXTRACTION_PLAN.md](YUTRA_EXTRACTION_PLAN.md) completely
- Extract: YUTRA data using table-by-table specifications
- Match: Intersections & roads to OSM using confidence scoring
- Validate: Using automated and manual review processes

### For DevOps / Operations
- Read: [HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md](HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md) Part 6 (Deployment & Safety)
- Configure: Environment variables (YUTRA_ENABLED, cache TTL, etc.)
- Monitor: Dispatch metrics (arc source breakdown, build time)
- Deploy: Using gradual rollout strategy (dry run → canary → full)

---

## Expected Outcomes

### After Phase 2 (Data Ready, Week 4)

- ✅ 500+ road segments mapped to OSM with historical speeds/capacity
- ✅ 100+ signalized intersections with delay observations
- ✅ 85%+ geospatial match confidence
- ✅ < 15% unmatched items in manual review queue

### After Phase 5 (Integrated, Week 5–6)

- ✅ Historical data layer available in dispatch pipeline
- ✅ Confidence metadata on every arc
- ✅ Existing Mapbox behavior unchanged
- ✅ Test scenarios pass (no regressions)

### After Phase 7 (Production Ready, Week 7)

- ✅ Full documentation complete
- ✅ Data provenance audit trail
- ✅ Performance metrics within targets
- ✅ Deployment ready (gradual rollout)
- ✅ Operations team trained

---

## Summary

**Oern's routing system is architecturally sound for historical traffic integration.** By adding YUTRA 2013 Yangon data as a fallback layer beneath real-time Mapbox traffic, we improve travel-time estimates in sparse-coverage areas while preserving all existing safety and performance characteristics.

**The approach is:**
- ✅ Non-invasive (Mapbox logic untouched)
- ✅ Safe (live traffic always preferred)
- ✅ Testable (clear A/B comparison)
- ✅ Auditable (full provenance tracking)
- ✅ Deployable (gradual rollout with kill switch)

**The work ahead:**
1. Extract YUTRA tables (2–3 weeks)
2. Match to OSM roads/intersections (1 week)
3. Implement BPR cost model (1 week)
4. Integrate into dispatch pipeline (1–2 weeks)
5. Test and validate (1–2 weeks)
6. Document and deploy (1 week)

**Ready to begin Week 1 data extraction.** 🚀

---

## Appendix: File References

### In Oern Repository

**Existing Routing Code:**
- [`src/lib/delivery/dispatch/solve.ts`](../../../src/lib/delivery/dispatch/solve.ts) — ALNS solver
- [`src/lib/delivery/dispatch/arc-cost.ts`](../../../src/lib/delivery/dispatch/arc-cost.ts) — Arc costing
- [`src/lib/delivery/dispatch/road-matrix.ts`](../../../src/lib/delivery/dispatch/road-matrix.ts) — Mapbox integration
- [`src/lib/delivery/routing-cost.ts`](../../../src/lib/delivery/routing-cost.ts) — Cost interface
- [`src/app/api/dispatch/plan/route.ts`](../../../src/app/api/dispatch/plan/route.ts) — Dispatch API entry

**Data:**
- [`data/yangon.osm.pbf`](../../../data/yangon.osm.pbf) — OpenStreetMap Yangon (already in repo)

**Documentation:**
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — System architecture overview
- [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) — PostgreSQL schema

### New Documents Created

- [`docs/YUTRA_INTEGRATION_ANALYSIS.md`](YUTRA_INTEGRATION_ANALYSIS.md) — Phase 1 analysis ✅
- [`docs/YUTRA_EXTRACTION_PLAN.md`](YUTRA_EXTRACTION_PLAN.md) — Phase 2 plan ✅
- [`docs/HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md`](HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md) — Full roadmap ✅

### External References

- **YUTRA Final Report:** `/Users/happer/Downloads/12182739_02 (1).pdf` (6.4 MB)
- **OpenStreetMap:** https://www.openstreetmap.org/ (Yangon data in repo)
- **BPR Congestion Model:** Highway Capacity Manual (HCM), ASCE standard

---

**Status:** ✅ Phase 1 Complete  
**Next Milestone:** Week 2 — Begin data extraction  
**Contact:** Transportation Data Engineer (happer@oern.local)

