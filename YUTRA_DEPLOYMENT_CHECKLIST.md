# YUTRA Historical Traffic Integration — Deployment Checklist

**Last Updated:** 2026-10-23  
**Status:** Ready for Integration Phase (Phase 5)

---

## Pre-Integration Verification

- [x] Architecture analysis complete (Phase 1)
- [x] YUTRA data extracted & validated (Phase 2a)
- [x] Geospatial matching strategy defined (Phase 2b)
- [x] BPR cost calculator implemented (Phase 3)
- [x] Arc cost strategy with confidence hierarchy (Phase 4)
- [x] Validation scenarios created (Phase 6)
- [x] Documentation complete (Phase 7)

---

## Phase 5: Integration Checklist

### Code Integration

- [ ] Review `src/lib/delivery/dispatch/historical-cost-calculator.ts`
- [ ] Review `src/lib/delivery/dispatch/arc-cost-strategy.ts`
- [ ] Modify `src/lib/delivery/dispatch/arc-cost.ts` to use strategy
- [ ] Extend `src/lib/delivery/dispatch/types.ts` with provenance fields
- [ ] Create `src/lib/delivery/dispatch/historical-arc-lookup.ts`
- [ ] Add YUTRA data loader & caching
- [ ] Run full test suite
  ```bash
  npm test -- historical-cost-calculator.test.ts
  npm test -- historical-validation-scenarios.test.ts
  ```
- [ ] No regressions: Existing tests still pass
- [ ] Performance verified: Matrix build < 500ms

### Configuration

- [ ] Add environment variables:
  ```bash
  YUTRA_HISTORICAL_ENABLED=false
  YUTRA_DATA_PATH=./data/yutra_processed/
  YUTRA_CONFIDENCE_THRESHOLD=0.65
  YUTRA_CACHE_TTL_SECONDS=86400
  ```
- [ ] Document in `.env.example`
- [ ] Add to deployment guide

### Data Pipeline

- [ ] Load `data/yangon.osm.pbf`
- [ ] Run geospatial matching (Phase 2b)
- [ ] Verify 85%+ coverage at confidence ≥0.65
- [ ] Create `data/yutra_matched/roads_matched_osm.csv`
- [ ] Create `data/yutra_matched/intersections_matched_osm.csv`
- [ ] Process into `data/yutra_processed/historical_arc_matrix.csv`
- [ ] Verify data quality & provenance

### Monitoring & Alerting

- [ ] Set up CloudWatch / Datadog metrics:
  - `dispatch.arc_cost.source.mapbox_live` (%)
  - `dispatch.arc_cost.source.yutra_historical` (%)
  - `dispatch.arc_cost.source.haversine` (%)
  - `dispatch.matrix_build_time_ms` (target: <500ms)
  - `dispatch.plan.success_rate` (target: >95%)
- [ ] Configure alerts:
  - If `yutra_historical` > 50% → investigate
  - If `matrix_build_time_ms` > 1000ms → investigate
  - If `plan.success_rate` drops > 5% → investigate
- [ ] Verify monitoring dashboard

---

## Phase 5.5: Dry Run (Week 1)

### Disabled State

- [ ] Deploy with `YUTRA_HISTORICAL_ENABLED=false`
- [ ] Verify: No change in dispatch behavior
- [ ] Verify: No performance regression
- [ ] Run: 100 test dispatch scenarios
- [ ] Compare: Baseline vs. dry run (should be identical)

### Validation

- [ ] ETA consistency check (±5% tolerance)
- [ ] Route selection consistency (100% match with baseline)
- [ ] No crashes or errors
- [ ] Logs clean (no warnings)

---

## Phase 5.6: Canary Rollout (Week 2)

### 10% Traffic

- [ ] Deploy with `YUTRA_HISTORICAL_ENABLED=true`
- [ ] Set `YUTRA_ROLLOUT_PERCENTAGE=10`
- [ ] Run: 100 dispatch scenarios
- [ ] Monitor: Metrics for 1 week

### Metrics

- [ ] ETA accuracy: Measured vs. actual (target: ±12%)
- [ ] Route quality: Same high-risk roads identified?
- [ ] Success rate: >95%
- [ ] No crashes or hangs

### Decision Gate

- [ ] Metrics within targets? → Proceed to 50%
- [ ] Issues detected? → Investigate & fix → Re-test

---

## Phase 5.7: Staged Rollout (Week 3+)

### 50% Traffic

- [ ] Set `YUTRA_ROLLOUT_PERCENTAGE=50`
- [ ] Monitor for 1 week
- [ ] A/B test: Compare baseline vs. YUTRA
- [ ] Measure: Customer satisfaction (delivery success rate)

### 100% Traffic

- [ ] Set `YUTRA_ROLLOUT_PERCENTAGE=100`
- [ ] Full production deployment
- [ ] Continuous monitoring

### Rollback Procedure

If issues arise:

```bash
# Immediate rollback
export YUTRA_HISTORICAL_ENABLED=false
# Restart dispatch service
systemctl restart oern-dispatch
# Clear cache
rm -rf .yutra_cache/
```

---

## Phase 6: Validation Testing

### Unit Tests

- [x] `historical-cost-calculator.test.ts` — 25+ tests (PASSING)
- [x] `historical-validation-scenarios.test.ts` — 6 scenarios (PASSING)
- [ ] Integration tests with real Mapbox data

### End-to-End Scenarios

- [ ] Scenario 1: Secondary road with major intersection
- [ ] Scenario 2: Peak vs. off-peak routing
- [ ] Scenario 3: Missing historical data
- [ ] Scenario 4: Directional asymmetry
- [ ] Scenario 5: Data confidence & move acceptance
- [ ] Scenario 6: Road network evolution

### Performance Testing

- [ ] Dispatch time for 50-stop problem: <500ms
- [ ] Dispatch time for 100-stop problem: <1000ms
- [ ] YUTRA lookup latency: <5ms per 100 arcs
- [ ] Cache hit ratio: >85%

### Accuracy Testing

- [ ] ETA error on Mapbox-covered roads: ±5% (unchanged)
- [ ] ETA error on YUTRA-covered roads: ±12% (improved)
- [ ] Route consistency: >85% match with baseline

---

## Phase 7: Documentation & Training

### Documentation

- [x] PHASE1_SUMMARY.md
- [x] YUTRA_PROJECT_INDEX.md
- [x] YUTRA_INTEGRATION_ANALYSIS.md
- [x] YUTRA_EXTRACTION_PLAN.md
- [x] HISTORICAL_TRAFFIC_INTEGRATION_PLAN.md
- [x] ROUTING_ALGORITHM_IMPROVEMENTS.md
- [x] IMPLEMENTATION_COMPLETE.md
- [ ] README_YUTRA_SETUP.md (operations)
- [ ] TROUBLESHOOTING.md

### Operations Training

- [ ] Deploy with YUTRA disabled initially
- [ ] Monitor metrics dashboard
- [ ] Recognize when to enable YUTRA
- [ ] Recognize issues & rollback procedure
- [ ] Regular maintenance: data refresh, cache invalidation

### Developer Training

- [ ] How BPR model works
- [ ] How confidence hierarchy operates
- [ ] How to add new data sources
- [ ] How to troubleshoot routing issues

---

## Sign-Off

### Engineering Lead

- [ ] Code review approved
- [ ] Tests reviewed & passing
- [ ] Performance acceptable
- [ ] Ready for integration

**Signature:** ________________  **Date:** _________

### Operations Lead

- [ ] Monitoring configured
- [ ] Deployment procedure documented
- [ ] Rollback procedure tested
- [ ] Team trained
- [ ] Ready for production

**Signature:** ________________  **Date:** _________

### Product Manager

- [ ] Architecture aligned with product vision
- [ ] Benefits understood (ETA improvement, route quality)
- [ ] Risks mitigated (historical data fallback only)
- [ ] Timeline acceptable
- [ ] Ready to communicate to stakeholders

**Signature:** ________________  **Date:** _________

---

## Post-Deployment (Weeks 4+)

### Monitoring KPIs

- [ ] Daily: Check dispatch success rate (target: >95%)
- [ ] Daily: Check YUTRA coverage (target: <50%)
- [ ] Weekly: Review ETA accuracy trends
- [ ] Weekly: Review customer satisfaction
- [ ] Monthly: Review all metrics & optimization opportunities

### Maintenance

- [ ] Cache invalidation: Nightly refresh
- [ ] Data staleness: Monitor YUTRA age
- [ ] OSM updates: Re-match when roads change significantly
- [ ] Parameter tuning: Optimize α, β if better data becomes available

### Future Improvements

- [ ] Local BPR calibration (current: standard global parameters)
- [ ] Real-time traffic integration with Mapbox live layer
- [ ] Weather-based congestion adjustments
- [ ] Special event crowd modeling
- [ ] Multi-modal transport (public transit, walking)

---

## Contact & Escalation

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Transportation Data Engineer | [Name] | [Phone] | [Email] |
| Backend Engineer | [Name] | [Phone] | [Email] |
| DevOps | [Name] | [Phone] | [Email] |
| Product Manager | [Name] | [Phone] | [Email] |

---

**Checklist Status:** 🟡 In Progress (Phase 5 Integration)  
**Target Completion:** Week 4 (Phase 7)  
**Last Updated:** 2026-10-23

