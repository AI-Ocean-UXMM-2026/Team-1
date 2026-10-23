/**
 * Phase 5: Historical Traffic Integration Layer
 *
 * Integrates YUTRA historical traffic data into the dispatch cost model.
 * Implements confidence-based three-tier fallback:
 * 1. Mapbox Live (confidence 1.0)
 * 2. YUTRA Historical (confidence 0.5)
 * 3. Haversine Fallback (confidence 0.4)
 *
 * This module hooks into arcCost() to enhance time estimates without breaking
 * existing routing. Enable/disable via environment variables.
 */

import type { RoutingCost } from "../routing-cost.ts";
import type { DispatchParams, Matrix, Truck } from "./types.ts";
import {
  calculateHistoricalArcCost,
  type RoadCharacteristics,
  type TrafficConditions,
  type BPRParameters,
} from "./historical-cost-calculator.ts";

/**
 * Configuration for historical traffic integration
 */
export interface HistoricalTrafficConfig {
  enabled: boolean;
  dataPath: string;
  confidenceThreshold: number; // Minimum confidence to use historical data
  cacheTtlSeconds: number;
  bprParameters: BPRParameters;
}

/**
 * Get config from environment or use defaults
 */
export function getHistoricalTrafficConfig(): HistoricalTrafficConfig {
  return {
    enabled: process.env.YUTRA_HISTORICAL_ENABLED === "true",
    dataPath: process.env.YUTRA_DATA_PATH ?? "./data/yutra_processed/",
    confidenceThreshold: parseFloat(process.env.YUTRA_CONFIDENCE_THRESHOLD ?? "0.65"),
    cacheTtlSeconds: parseInt(process.env.YUTRA_CACHE_TTL_SECONDS ?? "86400"),
    bprParameters: {
      alpha: parseFloat(process.env.YUTRA_BPR_ALPHA ?? "3.0"),
      beta: parseFloat(process.env.YUTRA_BPR_BETA ?? "4.0"),
    },
  };
}

/**
 * Historical arc data: road characteristics and traffic conditions
 * Loaded from CSV files in data/yutra_processed/
 */
export interface HistoricalArcData {
  arc_id: string; // Unique arc identifier
  road_name: string;
  distance_km: number;
  max_speed_kmh: number;
  capacity_veh_hour: number;
  peak_volume_veh_hour: number;
  off_peak_volume_veh_hour: number;
  signal_delay_seconds: number;
  survey_year: number;
  source_page: string;
  table_id: string;
  confidence: number; // 0..1: how confident we are in this data
  timestamp: number; // When this was added to the cache
}

/**
 * In-memory cache for historical arc data
 * Keyed by arc_id (geospatially matched to origin/destination pair)
 */
export class HistoricalArcCache {
  private cache: Map<string, HistoricalArcData> = new Map();
  private readonly ttlSeconds: number;
  private lastCleanup: number = Date.now();

  constructor(ttlSeconds: number = 86400) {
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Get historical data for an arc, returning null if not found or expired
   */
  get(arcId: string): HistoricalArcData | null {
    const entry = this.cache.get(arcId);
    if (!entry) return null;

    const ageSeconds = (Date.now() - entry.timestamp) / 1000;
    if (ageSeconds > this.ttlSeconds) {
      this.cache.delete(arcId);
      return null;
    }

    return entry;
  }

  /**
   * Store historical data for an arc
   */
  set(arcId: string, data: HistoricalArcData): void {
    this.cache.set(arcId, { ...data, timestamp: Date.now() });
    this.maybeCleanup();
  }

  /**
   * Periodically remove expired entries (every 1000 accesses)
   */
  private maybeCleanup(): void {
    if (Date.now() - this.lastCleanup < 60000) return; // Cleanup every minute max

    const now = Date.now();
    const expired = [];

    for (const [key, value] of this.cache.entries()) {
      const ageSeconds = (now - value.timestamp) / 1000;
      if (ageSeconds > this.ttlSeconds) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.cache.delete(key);
    }

    this.lastCleanup = now;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    capacity: number;
    ttlSeconds: number;
  } {
    return {
      size: this.cache.size,
      capacity: 10000, // Default max entries
      ttlSeconds: this.ttlSeconds,
    };
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Global cache instance (singleton)
 */
let globalCache: HistoricalArcCache | null = null;

export function getHistoricalArcCache(): HistoricalArcCache {
  if (!globalCache) {
    const config = getHistoricalTrafficConfig();
    globalCache = new HistoricalArcCache(config.cacheTtlSeconds);
  }
  return globalCache;
}

/**
 * Determine time-of-day period for traffic lookup
 * @param minutesSinceMidnight - Minutes since service-day start
 * @returns "peak" or "off_peak"
 */
export function getTimeOfDayPeriod(minutesSinceMidnight: number): "peak" | "off_peak" {
  const hour = Math.floor(minutesSinceMidnight / 60);

  // Morning peak: 6 AM - 9 AM
  if (hour >= 6 && hour < 9) return "peak";

  // Evening peak: 5 PM - 7 PM
  if (hour >= 17 && hour < 19) return "peak";

  return "off_peak";
}

/**
 * Calculate arc cost enhancement from historical data
 *
 * Returns the historical cost if available and meets confidence threshold,
 * otherwise returns null (allowing fallback to Mapbox/Haversine).
 *
 * @param arcId - Unique arc identifier (from geospatial matching)
 * @param minutesSinceMidnight - Time of day for period selection
 * @param config - Historical traffic configuration
 * @returns Historical RoutingCost or null
 */
export function getHistoricalArcCostEnhancement(
  arcId: string,
  minutesSinceMidnight: number,
  config: HistoricalTrafficConfig
): RoutingCost | null {
  if (!config.enabled) return null;

  const cache = getHistoricalArcCache();
  const historicalData = cache.get(arcId);

  if (!historicalData) return null;

  // Check confidence threshold
  if (historicalData.confidence < config.confidenceThreshold) {
    return null; // Below threshold, use fallback
  }

  // Build road characteristics
  const road: RoadCharacteristics = {
    distance_km: historicalData.distance_km,
    max_speed_kmh: historicalData.max_speed_kmh,
    capacity_veh_hour: historicalData.capacity_veh_hour,
    survey_year: historicalData.survey_year,
  };

  // Select traffic conditions based on time of day
  const timeOfDay = getTimeOfDayPeriod(minutesSinceMidnight);
  const traffic: TrafficConditions = {
    peak_volume_veh_hour: historicalData.peak_volume_veh_hour,
    off_peak_volume_veh_hour: historicalData.off_peak_volume_veh_hour,
    signal_delay_seconds: historicalData.signal_delay_seconds,
    time_of_day: timeOfDay,
  };

  // Calculate historical cost using BPR model
  const historicalCost = calculateHistoricalArcCost(road, traffic, config.bprParameters);

  return {
    durationSeconds: historicalCost.total_time_minutes * 60,
    distanceMeters: historicalData.distance_km * 1000,
    operatingCostMMK: 0, // Operating cost stays with road matrix
    riskPenaltySeconds: 0, // Historical data is not real-time risk
    confidence: historicalCost.confidence,
    blocked: false,
  };
}

/**
 * Blend Mapbox and historical costs based on confidence
 *
 * When both are available, combines them with a confidence-weighted blend.
 * This gives historical data influence without overriding live data.
 *
 * @param mapboxCost - Cost from Mapbox matrix
 * @param historicalCost - Cost from historical data
 * @returns Blended cost favoring Mapbox
 */
export function blendMapboxAndHistorical(
  mapboxCost: RoutingCost,
  historicalCost: RoutingCost
): RoutingCost {
  // Mapbox always preferred (confidence 1.0)
  const mapboxWeight = 1.0;
  const historicalWeight = historicalCost.confidence;

  const totalWeight = mapboxWeight + historicalWeight;

  // Blend duration (weighted average)
  const blendedDuration =
    (mapboxCost.durationSeconds * mapboxWeight + 
     historicalCost.durationSeconds * historicalWeight) /
    totalWeight;

  return {
    durationSeconds: blendedDuration,
    distanceMeters: mapboxCost.distanceMeters, // Use Mapbox distance
    operatingCostMMK: mapboxCost.operatingCostMMK, // Use Mapbox cost
    riskPenaltySeconds: mapboxCost.riskPenaltySeconds, // Use Mapbox risk
    confidence: mapboxWeight / totalWeight, // Blended confidence
    blocked: mapboxCost.blocked, // Hard constraint from Mapbox
  };
}

/**
 * Metadata about arc cost source for monitoring/debugging
 */
export interface ArcCostMetadata {
  source: "mapbox_live" | "yutra_historical" | "haversine";
  confidence: number;
  blended: boolean; // True if both Mapbox and historical were available
  historicalArcId?: string;
  historicalRoadName?: string;
  historicalTableId?: string;
  historicalSourcePage?: string;
}

/**
 * Track metadata for each arc (for monitoring dashboard)
 */
export class ArcCostMetadataTracker {
  private metadata: Map<number, ArcCostMetadata> = new Map();

  /**
   * Record metadata for an arc cost decision
   */
  record(arcIndex: number, meta: ArcCostMetadata): void {
    this.metadata.set(arcIndex, meta);
  }

  /**
   * Get all recorded metadata
   */
  getAll(): ArcCostMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Get coverage statistics
   */
  getCoverage(): {
    mapbox_live: number;
    yutra_historical: number;
    haversine: number;
  } {
    const stats = {
      mapbox_live: 0,
      yutra_historical: 0,
      haversine: 0,
    };

    for (const meta of this.metadata.values()) {
      stats[meta.source]++;
    }

    const total = this.metadata.size || 1;
    return {
      mapbox_live: (stats.mapbox_live / total) * 100,
      yutra_historical: (stats.yutra_historical / total) * 100,
      haversine: (stats.haversine / total) * 100,
    };
  }

  /**
   * Clear all recorded metadata
   */
  clear(): void {
    this.metadata.clear();
  }
}

/**
 * Global metadata tracker
 */
let globalMetadataTracker: ArcCostMetadataTracker | null = null;

export function getArcCostMetadataTracker(): ArcCostMetadataTracker {
  if (!globalMetadataTracker) {
    globalMetadataTracker = new ArcCostMetadataTracker();
  }
  return globalMetadataTracker;
}

/**
 * Calculate quality-aware move acceptance threshold
 *
 * Conservative moves for low-confidence data prevent the solver from
 * making aggressive optimizations based on unreliable information.
 *
 * @param confidence - Data confidence (0..1)
 * @param baseThreshold - Default improvement threshold (e.g., 0.01 = 1%)
 * @returns Adjusted threshold for move acceptance
 */
export function calculateMoveAcceptanceThreshold(
  confidence: number,
  baseThreshold: number = 0.01
): number {
  if (confidence >= 0.8) {
    return baseThreshold; // High confidence: standard
  } else if (confidence >= 0.5) {
    return baseThreshold * 2; // Medium: require 2% improvement
  } else {
    return baseThreshold * 5; // Low: very conservative (5% improvement)
  }
}

/**
 * Example: Initialize historical data (stub for Phase 5.5)
 *
 * In production, this would load CSV files from data/yutra_processed/
 * and populate the cache with matched road data.
 */
export async function initializeHistoricalData(
  config: HistoricalTrafficConfig
): Promise<number> {
  const cache = getHistoricalArcCache();

  // TODO: Load from data/yutra_processed/historical_arc_matrix.csv
  // For now: Empty cache (will use Mapbox/Haversine fallback)

  console.log(
    `[YUTRA] Historical integration initialized (enabled: ${config.enabled}, threshold: ${config.confidenceThreshold})`
  );

  return cache.getStats().size;
}

/**
 * Logging helper for monitoring
 */
export function logHistoricalCostDecision(
  arcIndex: number,
  from: number,
  to: number,
  decision: ArcCostMetadata,
  cost: RoutingCost
): void {
  if (process.env.DEBUG_YUTRA !== "true") return;

  const confidence = (cost.confidence * 100).toFixed(0);
  const duration = (cost.durationSeconds / 60).toFixed(2);

  let msg = `Arc ${arcIndex} [${from}→${to}]: ${decision.source} (confidence ${confidence}%, ${duration}min)`;

  if (decision.blended) {
    msg += " [BLENDED with Mapbox]";
  }

  if (decision.historicalRoadName) {
    msg += ` - ${decision.historicalRoadName}`;
  }

  console.log(msg);
}
