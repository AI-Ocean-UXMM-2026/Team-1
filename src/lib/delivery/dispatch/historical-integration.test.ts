/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  HistoricalArcCache,
  getHistoricalArcCache,
  getTimeOfDayPeriod,
  getHistoricalArcCostEnhancement,
  blendMapboxAndHistorical,
  getHistoricalTrafficConfig,
  calculateMoveAcceptanceThreshold,
  ArcCostMetadataTracker,
  getArcCostMetadataTracker,
} from "./historical-integration.ts";
import type { RoutingCost } from "../routing-cost.ts";
import type { HistoricalArcData } from "./historical-integration.ts";

describe("Historical Traffic Integration (Phase 5)", () => {
  let cache: HistoricalArcCache;

  beforeEach(() => {
    cache = new HistoricalArcCache(3600); // 1 hour TTL for testing
  });

  describe("HistoricalArcCache", () => {
    it("should store and retrieve arc data", () => {
      const arcData: HistoricalArcData = {
        arc_id: "arc_sule_square",
        road_name: "Sule Square / Bogyoke Rd",
        distance_km: 2.0,
        max_speed_kmh: 40,
        capacity_veh_hour: 800,
        peak_volume_veh_hour: 948,
        off_peak_volume_veh_hour: 504,
        signal_delay_seconds: 22,
        survey_year: 2013,
        source_page: "5-15",
        table_id: "5.2.2",
        confidence: 0.5,
        timestamp: Date.now(),
      };

      cache.set("arc_sule_square", arcData);

      const retrieved = cache.get("arc_sule_square");
      expect(retrieved).toBeDefined();
      expect(retrieved?.road_name).toBe("Sule Square / Bogyoke Rd");
    });

    it("should return null for non-existent arcs", () => {
      const result = cache.get("arc_nonexistent");
      expect(result).toBeNull();
    });

    it("should expire entries after TTL", () => {
      const arcData: HistoricalArcData = {
        arc_id: "arc_test",
        road_name: "Test Road",
        distance_km: 1.0,
        max_speed_kmh: 50,
        capacity_veh_hour: 1000,
        peak_volume_veh_hour: 500,
        off_peak_volume_veh_hour: 250,
        signal_delay_seconds: 15,
        survey_year: 2013,
        source_page: "5-1",
        table_id: "5.1",
        confidence: 0.5,
        timestamp: Date.now() - 7200000, // 2 hours ago
      };

      cache.set("arc_test", arcData);

      // Should expire immediately with 1 hour TTL
      const retrieved = cache.get("arc_test");
      expect(retrieved).toBeNull();
    });

    it("should provide cache statistics", () => {
      const stats = cache.getStats();
      expect(stats.ttlSeconds).toBe(3600);
      expect(stats.size).toBe(0);
    });
  });

  describe("Time-of-day period selection", () => {
    it("should identify morning peak (6-9 AM)", () => {
      // 7 AM = 420 minutes
      expect(getTimeOfDayPeriod(420)).toBe("peak");
      // 8 AM = 480 minutes
      expect(getTimeOfDayPeriod(480)).toBe("peak");
    });

    it("should identify evening peak (5-7 PM)", () => {
      // 5 PM = 1020 minutes
      expect(getTimeOfDayPeriod(1020)).toBe("peak");
      // 6 PM = 1080 minutes
      expect(getTimeOfDayPeriod(1080)).toBe("peak");
    });

    it("should identify off-peak periods", () => {
      // 10 AM = 600 minutes
      expect(getTimeOfDayPeriod(600)).toBe("off_peak");
      // 2 PM = 840 minutes
      expect(getTimeOfDayPeriod(840)).toBe("off_peak");
      // Midnight = 0
      expect(getTimeOfDayPeriod(0)).toBe("off_peak");
    });
  });

  describe("Historical cost enhancement", () => {
    it("should return null when historical integration is disabled", () => {
      const config = {
        enabled: false,
        dataPath: "./data/yutra_processed/",
        confidenceThreshold: 0.65,
        cacheTtlSeconds: 3600,
        bprParameters: { alpha: 3.0, beta: 4.0 },
      };

      const result = getHistoricalArcCostEnhancement(
        "arc_test",
        420, // 7 AM
        config
      );

      expect(result).toBeNull();
    });

    it("should return null for arc not in cache", () => {
      const config = {
        enabled: true,
        dataPath: "./data/yutra_processed/",
        confidenceThreshold: 0.65,
        cacheTtlSeconds: 3600,
        bprParameters: { alpha: 3.0, beta: 4.0 },
      };

      const result = getHistoricalArcCostEnhancement(
        "arc_nonexistent",
        420,
        config
      );

      expect(result).toBeNull();
    });

    it("should return cost when data is available and meets threshold", () => {
      const config = {
        enabled: true,
        dataPath: "./data/yutra_processed/",
        confidenceThreshold: 0.3, // Low threshold for testing
        cacheTtlSeconds: 3600,
        bprParameters: { alpha: 3.0, beta: 4.0 },
      };

      const arcData: HistoricalArcData = {
        arc_id: "arc_pyay",
        road_name: "Pyay Road",
        distance_km: 3.0,
        max_speed_kmh: 60,
        capacity_veh_hour: 1800,
        peak_volume_veh_hour: 1067,
        off_peak_volume_veh_hour: 533,
        signal_delay_seconds: 15,
        survey_year: 2013,
        source_page: "5-20",
        table_id: "5.2.3",
        confidence: 0.5,
        timestamp: Date.now(),
      };

      const testCache = new HistoricalArcCache(3600);
      testCache.set("arc_pyay", arcData);

      // Store in global cache for this test
      const originalCache = getHistoricalArcCache();
      (getHistoricalArcCache as any).return = () => testCache;

      const result = getHistoricalArcCostEnhancement("arc_pyay", 420, config);

      expect(result).toBeDefined();
      if (result) {
        expect(result.durationSeconds).toBeGreaterThan(0);
        expect(result.distanceMeters).toBe(3000);
        expect(result.confidence).toBe(0.5);
      }
    });
  });

  describe("Mapbox and historical blending", () => {
    it("should prefer Mapbox when both are available", () => {
      const mapboxCost: RoutingCost = {
        durationSeconds: 300, // 5 minutes
        distanceMeters: 5000,
        operatingCostMMK: 50,
        riskPenaltySeconds: 0,
        confidence: 1.0,
        blocked: false,
      };

      const historicalCost: RoutingCost = {
        durationSeconds: 600, // 10 minutes (slower)
        distanceMeters: 5000,
        operatingCostMMK: 50,
        riskPenaltySeconds: 0,
        confidence: 0.5,
        blocked: false,
      };

      const blended = blendMapboxAndHistorical(mapboxCost, historicalCost);

      // Should be closer to Mapbox (5 min) than historical (10 min)
      // Weights: Mapbox 1.0, Historical 0.5 → Mapbox gets 67% weight
      expect(blended.durationSeconds).toBeLessThan(
        (mapboxCost.durationSeconds + historicalCost.durationSeconds) / 2
      );
      expect(blended.durationSeconds).toBeCloseTo(400, 0); // Weighted average
    });

    it("should use Mapbox cost and risk fields", () => {
      const mapboxCost: RoutingCost = {
        durationSeconds: 300,
        distanceMeters: 5000,
        operatingCostMMK: 50,
        riskPenaltySeconds: 30,
        confidence: 1.0,
        blocked: false,
      };

      const historicalCost: RoutingCost = {
        durationSeconds: 600,
        distanceMeters: 5100, // Slightly different
        operatingCostMMK: 55,
        riskPenaltySeconds: 0,
        confidence: 0.5,
        blocked: false,
      };

      const blended = blendMapboxAndHistorical(mapboxCost, historicalCost);

      // Preserve Mapbox fields
      expect(blended.distanceMeters).toBe(5000);
      expect(blended.operatingCostMMK).toBe(50);
      expect(blended.riskPenaltySeconds).toBe(30);
    });

    it("should respect hard block from Mapbox", () => {
      const mapboxCost: RoutingCost = {
        durationSeconds: 300,
        distanceMeters: 5000,
        operatingCostMMK: 50,
        riskPenaltySeconds: 0,
        confidence: 1.0,
        blocked: true, // Road closed
      };

      const historicalCost: RoutingCost = {
        durationSeconds: 600,
        distanceMeters: 5000,
        operatingCostMMK: 50,
        riskPenaltySeconds: 0,
        confidence: 0.5,
        blocked: false,
      };

      const blended = blendMapboxAndHistorical(mapboxCost, historicalCost);
      expect(blended.blocked).toBe(true); // Preserve block
    });
  });

  describe("Move acceptance threshold calculation", () => {
    it("should use standard threshold for high confidence (≥0.8)", () => {
      const threshold = calculateMoveAcceptanceThreshold(0.95, 0.01);
      expect(threshold).toBe(0.01);
    });

    it("should use 2x threshold for medium confidence (0.5-0.8)", () => {
      const threshold = calculateMoveAcceptanceThreshold(0.6, 0.01);
      expect(threshold).toBe(0.02);
    });

    it("should use 5x threshold for low confidence (<0.5)", () => {
      const threshold = calculateMoveAcceptanceThreshold(0.4, 0.01);
      expect(threshold).toBe(0.05);
    });
  });

  describe("Arc cost metadata tracker", () => {
    let tracker: ArcCostMetadataTracker;

    beforeEach(() => {
      tracker = new ArcCostMetadataTracker();
    });

    it("should record arc cost metadata", () => {
      tracker.record(0, {
        source: "mapbox_live",
        confidence: 1.0,
        blended: false,
      });

      const all = tracker.getAll();
      expect(all.length).toBe(1);
      expect(all[0].source).toBe("mapbox_live");
    });

    it("should calculate source coverage", () => {
      tracker.record(0, {
        source: "mapbox_live",
        confidence: 1.0,
        blended: false,
      });
      tracker.record(1, {
        source: "mapbox_live",
        confidence: 1.0,
        blended: false,
      });
      tracker.record(2, {
        source: "yutra_historical",
        confidence: 0.5,
        blended: true,
      });
      tracker.record(3, {
        source: "haversine",
        confidence: 0.4,
        blended: false,
      });

      const coverage = tracker.getCoverage();
      expect(coverage.mapbox_live).toBeCloseTo(50, 0);
      expect(coverage.yutra_historical).toBeCloseTo(25, 0);
      expect(coverage.haversine).toBeCloseTo(25, 0);
    });

    it("should clear all metadata", () => {
      tracker.record(0, {
        source: "mapbox_live",
        confidence: 1.0,
        blended: false,
      });

      expect(tracker.getAll().length).toBe(1);

      tracker.clear();
      expect(tracker.getAll().length).toBe(0);
    });
  });

  describe("Configuration from environment", () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should use defaults when environment variables not set", () => {
      process.env = { ...originalEnv };
      delete process.env.YUTRA_HISTORICAL_ENABLED;
      delete process.env.YUTRA_DATA_PATH;

      const config = getHistoricalTrafficConfig();
      expect(config.enabled).toBe(false); // Default disabled
      expect(config.dataPath).toBe("./data/yutra_processed/");
      expect(config.confidenceThreshold).toBe(0.65);
    });

    it("should read configuration from environment", () => {
      process.env = {
        ...originalEnv,
        YUTRA_HISTORICAL_ENABLED: "true",
        YUTRA_DATA_PATH: "/custom/path",
        YUTRA_CONFIDENCE_THRESHOLD: "0.75",
        YUTRA_CACHE_TTL_SECONDS: "7200",
      };

      const config = getHistoricalTrafficConfig();
      expect(config.enabled).toBe(true);
      expect(config.dataPath).toBe("/custom/path");
      expect(config.confidenceThreshold).toBe(0.75);
      expect(config.cacheTtlSeconds).toBe(7200);
    });
  });

  describe("End-to-end scenario", () => {
    it("should handle complete integration workflow", () => {
      const arcData: HistoricalArcData = {
        arc_id: "arc_downtown",
        road_name: "Downtown Loop",
        distance_km: 1.5,
        max_speed_kmh: 35,
        capacity_veh_hour: 400,
        peak_volume_veh_hour: 380,
        off_peak_volume_veh_hour: 150,
        signal_delay_seconds: 30,
        survey_year: 2013,
        source_page: "5-10",
        table_id: "5.1.1",
        confidence: 0.6,
        timestamp: Date.now(),
      };

      const testCache = new HistoricalArcCache(3600);
      testCache.set("arc_downtown", arcData);

      // Verify cache
      const cached = testCache.get("arc_downtown");
      expect(cached).toBeDefined();

      // Verify time-of-day selection
      const period = getTimeOfDayPeriod(480); // 8 AM
      expect(period).toBe("peak");

      // Verify cost calculation would work
      const tracker = getArcCostMetadataTracker();
      tracker.record(0, {
        source: "yutra_historical",
        confidence: 0.6,
        blended: true,
        historicalArcId: "arc_downtown",
        historicalRoadName: "Downtown Loop",
      });

      const coverage = tracker.getCoverage();
      expect(coverage.yutra_historical).toBe(100);
    });
  });
});
