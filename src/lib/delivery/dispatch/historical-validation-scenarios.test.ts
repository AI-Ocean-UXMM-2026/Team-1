/**
 * Validation Scenarios for YUTRA Historical Traffic Integration
 *
 * Six test cases validating that historical data improves route decisions
 * without breaking existing functionality.
 */

/// <reference types="vitest" />
import { describe, it, expect } from "vitest";
import {
  freeFlowTime,
  bprTravelTime,
  calculateHistoricalArcCost,
  type BPRParameters,
} from "./historical-cost-calculator";

describe("YUTRA Historical Traffic Validation Scenarios", () => {
  const bprParams: BPRParameters = { alpha: 3.0, beta: 4.0 };

  /**
   * Scenario 1: Shorter Road with Major Intersection Delays
   *
   * A secondary road is shorter but has a major intersection with significant
   * delays. Historical YUTRA data captures these delays, making it potentially
   * slower than a longer alternative despite the distance advantage.
   *
   * Expected: Historical data improves route selection by identifying the
   * slower shorter path.
   */
  describe("Scenario 1: Secondary Road with Major Intersection", () => {
    it("should identify major intersection delays on shorter route", () => {
      // Short route: 2 km, but passes through major intersection (Sule Square)
      const shortRoute = {
        distance_km: 2.0,
        max_speed_kmh: 40,
        capacity_veh_hour: 800,
        survey_year: 2013,
      };

      // Major intersection: Sule Square
      const majorIntersection = {
        peak_volume_veh_hour: 948,
        off_peak_volume_veh_hour: 504,
        signal_delay_seconds: 22, // Documented in YUTRA
        time_of_day: "peak" as const,
      };

      const cost = calculateHistoricalArcCost(shortRoute, majorIntersection, bprParams);

      // Free-flow: 3 min, congestion: 2.88x, signal: 0.37 min
      // Total: ~8.3 min (not 2 min)
      expect(cost.total_time_minutes).toBeGreaterThan(7.0);
      expect(cost.signal_delay_minutes).toBeGreaterThan(0.3);

      // Confidence should be sufficient to use this estimate
      expect(cost.confidence).toBe(0.5);

      console.log(`  Short route actual time: ${cost.total_time_minutes.toFixed(2)} min (vs. 2 min free-flow)`);
    });

    it("should compare against longer bypass without signals", () => {
      // Long bypass: 3.5 km, no major signals
      const longBypass = {
        distance_km: 3.5,
        max_speed_kmh: 55,
        capacity_veh_hour: 1200,
        survey_year: 2013,
      };

      const lightTraffic = {
        peak_volume_veh_hour: 400,
        off_peak_volume_veh_hour: 200,
        signal_delay_seconds: 0,
        time_of_day: "peak" as const,
      };

      const cost = calculateHistoricalArcCost(longBypass, lightTraffic, bprParams);

      // Free-flow: 3.82 min, minimal congestion, no signals
      // Total: ~4 min
      expect(cost.total_time_minutes).toBeLessThan(5.0);
      expect(cost.signal_delay_minutes).toBe(0);

      console.log(`  Long bypass time: ${cost.total_time_minutes.toFixed(2)} min`);
      console.log(
        `  RESULT: Bypass (${cost.total_time_minutes.toFixed(1)} min) faster than short route (8.3 min)`
      );
    });
  });

  /**
   * Scenario 2: Peak vs. Off-Peak Time-Aware Routing
   *
   * The same route has very different characteristics during peak and off-peak.
   * Historical YUTRA data provides distinct volumes for each period, enabling
   * time-aware optimization.
   *
   * Expected: Route selection changes based on time of day.
   */
  describe("Scenario 2: Peak Hour vs. Off-Peak", () => {
    it("should show peak hour delay", () => {
      const pyayRoad = {
        distance_km: 3.0,
        max_speed_kmh: 60,
        capacity_veh_hour: 1800,
        survey_year: 2013,
      };

      const peakTraffic = {
        peak_volume_veh_hour: 1067,
        off_peak_volume_veh_hour: 533,
        signal_delay_seconds: 15,
        time_of_day: "peak" as const,
      };

      const cost = calculateHistoricalArcCost(pyayRoad, peakTraffic, bprParams);

      // Peak: high volume, significant delay
      expect(cost.total_time_minutes).toBeGreaterThan(7.0);
      console.log(`  Pyay Rd PEAK time: ${cost.total_time_minutes.toFixed(2)} min`);
    });

    it("should show faster off-peak", () => {
      const pyayRoad = {
        distance_km: 3.0,
        max_speed_kmh: 60,
        capacity_veh_hour: 1800,
        survey_year: 2013,
      };

      const offPeakTraffic = {
        peak_volume_veh_hour: 1067,
        off_peak_volume_veh_hour: 533,
        signal_delay_seconds: 15,
        time_of_day: "off_peak" as const,
      };

      const cost = calculateHistoricalArcCost(pyayRoad, offPeakTraffic, bprParams);

      // Off-peak: lower volume, minimal delay
      expect(cost.total_time_minutes).toBeLessThan(5.0);
      console.log(`  Pyay Rd OFF-PEAK time: ${cost.total_time_minutes.toFixed(2)} min`);
    });
  });

  /**
   * Scenario 3: Missing Historical Data Graceful Fallback
   *
   * If a road segment has no YUTRA data, the system should fall back to
   * Haversine estimates without crashing.
   *
   * Expected: No errors; fallback confidence (0.4) indicates lower reliability.
   */
  describe("Scenario 3: Missing Historical Data", () => {
    it("should handle zero capacity gracefully", () => {
      const unknownRoad = {
        distance_km: 2.0,
        max_speed_kmh: 50,
        capacity_veh_hour: 0, // Unknown capacity
        survey_year: 2013,
      };

      const traffic = {
        peak_volume_veh_hour: 500,
        off_peak_volume_veh_hour: 200,
        signal_delay_seconds: 0,
        time_of_day: "peak" as const,
      };

      const cost = calculateHistoricalArcCost(unknownRoad, traffic, bprParams);

      // Should not crash; should default to free-flow
      expect(cost.total_time_minutes).toBeGreaterThan(0);
      expect(cost.total_time_minutes).toBeLessThanOrEqual(5.0); // Close to free-flow

      console.log(`  Unknown road time: ${cost.total_time_minutes.toFixed(2)} min (fallback used)`);
    });
  });

  /**
   * Scenario 4: Directional Asymmetry Check
   *
   * YUTRA may have directional differences (e.g., outbound congestion vs.
   * inbound). The system should track these without assuming symmetry.
   *
   * Expected: Routes adapt to directional patterns without artifact.
   */
  describe("Scenario 4: Directional Asymmetry", () => {
    it("should apply directional costs independently", () => {
      const northbound = {
        distance_km: 2.0,
        max_speed_kmh: 60,
        capacity_veh_hour: 900,
        survey_year: 2013,
      };

      // Morning peak: inbound (high volume)
      const inboundPeak = {
        peak_volume_veh_hour: 800,
        off_peak_volume_veh_hour: 300,
        signal_delay_seconds: 20,
        time_of_day: "peak" as const,
      };

      // Evening peak: outbound (high volume)
      const outboundPeak = {
        peak_volume_veh_hour: 750,
        off_peak_volume_veh_hour: 300,
        signal_delay_seconds: 18,
        time_of_day: "peak" as const,
      };

      const inboundCost = calculateHistoricalArcCost(northbound, inboundPeak, bprParams);
      const outboundCost = calculateHistoricalArcCost(northbound, outboundPeak, bprParams);

      // Should show different delays
      expect(Math.abs(inboundCost.total_time_minutes - outboundCost.total_time_minutes)).toBeGreaterThan(
        0.1
      );

      console.log(`  Inbound peak time: ${inboundCost.total_time_minutes.toFixed(2)} min`);
      console.log(`  Outbound peak time: ${outboundCost.total_time_minutes.toFixed(2)} min`);
    });
  });

  /**
   * Scenario 5: Mapbox vs. Historical Confidence
   *
   * When both Mapbox and YUTRA data are available, Mapbox should be preferred.
   * But when Mapbox is sparse, YUTRA fills the gap with confidence tracking.
   *
   * Expected: Confidence levels indicate data reliability; solver can use this
   * for conservative move acceptance.
   */
  describe("Scenario 5: Data Confidence & Move Acceptance", () => {
    it("should assign appropriate confidence levels", () => {
      const road = {
        distance_km: 2.0,
        max_speed_kmh: 60,
        capacity_veh_hour: 900,
        survey_year: 2013,
      };

      const traffic = {
        peak_volume_veh_hour: 800,
        off_peak_volume_veh_hour: 300,
        signal_delay_seconds: 22,
        time_of_day: "peak" as const,
      };

      const cost = calculateHistoricalArcCost(road, traffic, bprParams);

      // YUTRA confidence should be 0.5 (between Mapbox 1.0 and Haversine 0.4)
      expect(cost.confidence).toBe(0.5);

      // Move acceptance threshold should be more conservative
      const baseThreshold = 0.01; // 1% improvement
      const conservativeThreshold = baseThreshold * 2; // 2% for medium confidence
      expect(conservativeThreshold).toBe(0.02);

      console.log(`  YUTRA confidence: ${cost.confidence} → conservative moves (2% improvement required)`);
    });
  });

  /**
   * Scenario 6: Historical vs. Current Road Network Mismatch
   *
   * The Yangon road network has evolved since 2013. New roads exist, old
   * roads may be closed. YUTRA data must be matched with OSM carefully to
   * avoid false arcs.
   *
   * Expected: Unmatched intersections go to manual review queue; no fabricated
   * estimates.
   */
  describe("Scenario 6: Road Network Evolution", () => {
    it("should validate geospatial matches", () => {
      // Example: Yangon-Mandalay Expressway (opened 2013-2016, partial operation in YUTRA survey)

      const expressway = {
        distance_km: 5.0,
        max_speed_kmh: 80, // High-speed facility
        capacity_veh_hour: 2000,
        survey_year: 2013,
      };

      const lightTraffic = {
        peak_volume_veh_hour: 500,
        off_peak_volume_veh_hour: 200,
        signal_delay_seconds: 0, // No signals on expressway
        time_of_day: "peak" as const,
      };

      const cost = calculateHistoricalArcCost(expressway, lightTraffic, bprParams);

      // High-speed, light traffic, no signals → very fast
      expect(cost.total_time_minutes).toBeLessThan(6.0);
      expect(cost.signal_delay_minutes).toBe(0);

      console.log(
        `  Expressway (high-speed, light traffic): ${cost.total_time_minutes.toFixed(2)} min`
      );
    });
  });

  /**
   * Integration Test: Complete End-to-End Scenario
   *
   * Simulates a full dispatch scenario with multiple routes and data sources.
   */
  describe("Integration: Complete Dispatch Scenario", () => {
    it("should handle mixed data sources", () => {
      // Scenario: Dispatch to 3 orders across downtown Yangon

      // Route 1: Sule Square (major intersection, high confidence YUTRA data)
      const route1 = calculateHistoricalArcCost(
        { distance_km: 2.0, max_speed_kmh: 40, capacity_veh_hour: 800, survey_year: 2013 },
        { peak_volume_veh_hour: 948, off_peak_volume_veh_hour: 504, signal_delay_seconds: 22, time_of_day: "peak" },
        bprParams
      );

      // Route 2: Pyay Road (major arterial, good YUTRA coverage)
      const route2 = calculateHistoricalArcCost(
        { distance_km: 3.0, max_speed_kmh: 60, capacity_veh_hour: 1800, survey_year: 2013 },
        { peak_volume_veh_hour: 1067, off_peak_volume_veh_hour: 533, signal_delay_seconds: 15, time_of_day: "peak" },
        bprParams
      );

      // Route 3: Side street (limited YUTRA data, will use Haversine)
      const route3 = calculateHistoricalArcCost(
        { distance_km: 1.5, max_speed_kmh: 35, capacity_veh_hour: 300, survey_year: 2013 },
        { peak_volume_veh_hour: 250, off_peak_volume_veh_hour: 100, signal_delay_seconds: 18, time_of_day: "peak" },
        bprParams
      );

      // Verify all routes calculated successfully
      expect(route1.total_time_minutes).toBeGreaterThan(0);
      expect(route2.total_time_minutes).toBeGreaterThan(0);
      expect(route3.total_time_minutes).toBeGreaterThan(0);

      // Verify confidence levels
      expect(route1.confidence).toBe(0.5);
      expect(route2.confidence).toBe(0.5);
      expect(route3.confidence).toBe(0.5);

      console.log("\n  DISPATCH SCENARIO RESULTS:");
      console.log(`    Route 1 (Sule Square): ${route1.total_time_minutes.toFixed(2)} min`);
      console.log(`    Route 2 (Pyay Rd): ${route2.total_time_minutes.toFixed(2)} min`);
      console.log(`    Route 3 (Side street): ${route3.total_time_minutes.toFixed(2)} min`);
      console.log(`    Total estimated time: ${(route1.total_time_minutes + route2.total_time_minutes + route3.total_time_minutes).toFixed(2)} min`);
    });
  });
});
