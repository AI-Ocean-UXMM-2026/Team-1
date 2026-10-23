import { describe, it, expect } from "vitest";
import {
  freeFlowTime,
  congestionMultiplier,
  bprTravelTime,
  signalDelayMinutes,
  calculateHistoricalArcCost,
  type BPRParameters,
} from "./historical-cost-calculator";

describe("Historical Cost Calculator (BPR Model)", () => {
  const bprParams: BPRParameters = { alpha: 3.0, beta: 4.0 };

  describe("freeFlowTime", () => {
    it("should calculate free-flow time correctly", () => {
      // 2 km at 60 km/h = 2 minutes
      expect(freeFlowTime(2.0, 60)).toBeCloseTo(2.0, 2);

      // 3 km at 50 km/h = 3.6 minutes
      expect(freeFlowTime(3.0, 50)).toBeCloseTo(3.6, 2);

      // Zero speed should return zero
      expect(freeFlowTime(2.0, 0)).toBe(0);
    });
  });

  describe("congestionMultiplier", () => {
    it("should return 1.0 for free-flow conditions (v/c < 0.5)", () => {
      // v/c = 0.3 → minimal congestion
      const multiplier = congestionMultiplier(300, 900, 3.0, 4.0);
      expect(multiplier).toBeCloseTo(1.04, 2); // Small increase only
    });

    it("should calculate congestion correctly for peak conditions (v/c ≈ 0.89)", () => {
      // v/c = 0.889 → significant congestion
      const multiplier = congestionMultiplier(800, 900, 3.0, 4.0);
      expect(multiplier).toBeCloseTo(2.875, 2);
    });

    it("should handle oversaturation (v/c > 1.0)", () => {
      // v/c = 1.333 → gridlock conditions (capped at 100x)
      const multiplier = congestionMultiplier(1200, 900, 3.0, 4.0);
      expect(multiplier).toBeGreaterThan(10);
      expect(multiplier).toBeLessThanOrEqual(100); // Should be capped
    });

    it("should return 1.0 when capacity is zero", () => {
      expect(congestionMultiplier(300, 0, 3.0, 4.0)).toBe(1.0);
    });

    it("should return 1.0 when volume is zero", () => {
      expect(congestionMultiplier(0, 900, 3.0, 4.0)).toBe(1.0);
    });

    it("should respect parameter variations", () => {
      // Default BPR: alpha=3, beta=4
      const standard = congestionMultiplier(800, 900, 3.0, 4.0);

      // Higher alpha (more sensitive to congestion)
      const sensitive = congestionMultiplier(800, 900, 5.0, 4.0);
      expect(sensitive).toBeGreaterThan(standard);

      // Higher beta (sharper curve)
      const sharp = congestionMultiplier(800, 900, 3.0, 5.0);
      expect(sharp).toBeGreaterThan(standard);
    });
  });

  describe("bprTravelTime", () => {
    it("should calculate travel time with congestion", () => {
      // Free-flow: 2 min, volume 300 veh/h, capacity 900 veh/h
      const freeFlow = 2.0;
      const time = bprTravelTime(freeFlow, 300, 900, bprParams);
      expect(time).toBeCloseTo(2.07, 1); // Minimal increase
    });

    it("should show significant delay in peak congestion", () => {
      // Free-flow: 2 min, peak volume 800 veh/h, capacity 900 veh/h
      const freeFlow = 2.0;
      const time = bprTravelTime(freeFlow, 800, 900, bprParams);
      expect(time).toBeCloseTo(5.75, 1); // ~188% increase
    });

    it("should clamp to 100x multiplier in extreme gridlock", () => {
      // Free-flow: 2 min, gridlock 1200 veh/h, capacity 900 veh/h
      const freeFlow = 2.0;
      const time = bprTravelTime(freeFlow, 1200, 900, bprParams);
      expect(time).toBeLessThanOrEqual(200); // 100 * 2 min
    });
  });

  describe("signalDelayMinutes", () => {
    it("should convert seconds to minutes", () => {
      expect(signalDelayMinutes(60)).toBe(1.0);
      expect(signalDelayMinutes(30)).toBe(0.5);
      expect(signalDelayMinutes(22)).toBeCloseTo(0.367, 2);
    });

    it("should return zero for zero delay", () => {
      expect(signalDelayMinutes(0)).toBe(0);
    });
  });

  describe("calculateHistoricalArcCost", () => {
    it("should combine segment and signal delays", () => {
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

      // Expected:
      // Free-flow: 2 min
      // Congestion multiplier: 2.875
      // Segment time: 5.75 min
      // Signal delay: 22/60 = 0.367 min
      // Total: 6.117 min
      expect(cost.total_time_minutes).toBeCloseTo(6.12, 1);
      expect(cost.segment_time_minutes).toBeCloseTo(5.75, 1);
      expect(cost.signal_delay_minutes).toBeCloseTo(0.367, 2);
    });

    it("should select peak traffic when time_of_day is peak", () => {
      const road = {
        distance_km: 1.0,
        max_speed_kmh: 50,
        capacity_veh_hour: 1000,
        survey_year: 2013,
      };

      const traffic = {
        peak_volume_veh_hour: 900,
        off_peak_volume_veh_hour: 300,
        signal_delay_seconds: 0,
        time_of_day: "peak" as const,
      };

      const cost = calculateHistoricalArcCost(road, traffic, bprParams);
      expect(cost.volume_veh_hour).toBe(900); // Should use peak volume
    });

    it("should select off-peak traffic when time_of_day is off_peak", () => {
      const road = {
        distance_km: 1.0,
        max_speed_kmh: 50,
        capacity_veh_hour: 1000,
        survey_year: 2013,
      };

      const traffic = {
        peak_volume_veh_hour: 900,
        off_peak_volume_veh_hour: 300,
        signal_delay_seconds: 0,
        time_of_day: "off_peak" as const,
      };

      const cost = calculateHistoricalArcCost(road, traffic, bprParams);
      expect(cost.volume_veh_hour).toBe(300); // Should use off-peak volume
    });

    it("should use average volume when time_of_day is unknown", () => {
      const road = {
        distance_km: 1.0,
        max_speed_kmh: 50,
        capacity_veh_hour: 1000,
        survey_year: 2013,
      };

      const traffic = {
        peak_volume_veh_hour: 800,
        off_peak_volume_veh_hour: 400,
        signal_delay_seconds: 0,
        time_of_day: "unknown" as const,
      };

      const cost = calculateHistoricalArcCost(road, traffic, bprParams);
      expect(cost.volume_veh_hour).toBe(600); // Average of 800 and 400
    });

    it("should include provenance metadata", () => {
      const road = {
        distance_km: 2.0,
        max_speed_kmh: 60,
        capacity_veh_hour: 900,
        survey_year: 2013,
      };

      const traffic = {
        peak_volume_veh_hour: 800,
        off_peak_volume_veh_hour: 300,
        signal_delay_seconds: 0,
        time_of_day: "peak" as const,
      };

      const cost = calculateHistoricalArcCost(road, traffic, bprParams);

      expect(cost.provenance.source).toBe("yutra_historical");
      expect(cost.provenance.survey_year).toBe(2013);
      expect(cost.confidence).toBe(0.5);
    });
  });

  describe("Real-world scenarios", () => {
    it("should differentiate between main road and secondary road", () => {
      const bprParams: BPRParameters = { alpha: 3.0, beta: 4.0 };

      // Main road: Pyay Rd, 2 km, 60 km/h, 1800 capacity
      const mainRoad = {
        distance_km: 2.0,
        max_speed_kmh: 60,
        capacity_veh_hour: 1800,
        survey_year: 2013,
      };

      // Secondary road: Merchant Rd, 2 km, 40 km/h, 600 capacity
      const secondaryRoad = {
        distance_km: 2.0,
        max_speed_kmh: 40,
        capacity_veh_hour: 600,
        survey_year: 2013,
      };

      const peakTraffic = {
        peak_volume_veh_hour: 800,
        off_peak_volume_veh_hour: 300,
        signal_delay_seconds: 22,
        time_of_day: "peak" as const,
      };

      const mainCost = calculateHistoricalArcCost(mainRoad, peakTraffic, bprParams);
      const secondaryCost = calculateHistoricalArcCost(secondaryRoad, peakTraffic, bprParams);

      // Secondary road should have higher delay (smaller capacity, limited speed)
      expect(secondaryCost.total_time_minutes).toBeGreaterThan(mainCost.total_time_minutes);
    });

    it("should show day-night variation", () => {
      const road = {
        distance_km: 2.0,
        max_speed_kmh: 60,
        capacity_veh_hour: 900,
        survey_year: 2013,
      };

      const peakTraffic = {
        peak_volume_veh_hour: 900,
        off_peak_volume_veh_hour: 300,
        signal_delay_seconds: 22,
        time_of_day: "peak" as const,
      };

      const offPeakTraffic = {
        peak_volume_veh_hour: 900,
        off_peak_volume_veh_hour: 300,
        signal_delay_seconds: 22,
        time_of_day: "off_peak" as const,
      };

      const peakCost = calculateHistoricalArcCost(road, peakTraffic, bprParams);
      const offPeakCost = calculateHistoricalArcCost(road, offPeakTraffic, bprParams);

      // Peak should be slower
      expect(peakCost.total_time_minutes).toBeGreaterThan(offPeakCost.total_time_minutes);
    });
  });
});
