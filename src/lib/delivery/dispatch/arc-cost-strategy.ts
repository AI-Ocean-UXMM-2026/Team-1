/**
 * Arc Cost Strategy: Confidence-Based Selection
 *
 * Implements the three-tier fallback strategy for arc cost selection:
 * 1. Mapbox Live Traffic (confidence 1.0) - Always preferred
 * 2. YUTRA Historical (confidence 0.5) - When Mapbox unavailable
 * 3. Haversine Fallback (confidence 0.4) - Last resort
 *
 * This ensures that historical data supplements but never overrides real-time
 * information, while providing better estimates than pure distance heuristics.
 */

import type { RoutingCost } from "../routing-cost.ts";
import type { Matrix, Truck, DispatchParams } from "./types.ts";
import { arcCost as mapboxArcCost } from "./arc-cost.ts";
import type { HistoricalArcCost } from "./historical-cost-calculator.ts";

export type ArcSource = "mapbox_live" | "yutra_historical" | "haversine";

export interface ArcCostMetadata {
  source: ArcSource;
  confidence: number;
  table_id?: string;
  survey_year?: number;
  source_page?: string;
  data_type?: string;
}

export interface ArcCostWithMetadata extends RoutingCost {
  metadata: ArcCostMetadata;
}

/**
 * Historical Arc Lookup - loads and caches YUTRA data
 *
 * In production, this would:
 * 1. Load CSV/JSON files from data/yutra_processed/
 * 2. Build in-memory index by (origin_node, destination_node)
 * 3. Cache with TTL
 * 4. Track provenance for each arc
 */
export class HistoricalArcLookup {
  private cache: Map<string, HistoricalArcCost & { metadata: ArcCostMetadata }> = new Map();
  private readonly ttl_ms: number;
  private last_load_time: number = 0;

  constructor(ttl_ms: number = 86400000) {
    // 24 hour default TTL
    this.ttl_ms = ttl_ms;
  }

  /**
   * Load YUTRA historical data (placeholder implementation)
   * In production: Load from CSV/JSON files
   */
  async load(): Promise<void> {
    // Placeholder: In production, load from data/yutra_processed/historical_arc_matrix.csv
    this.last_load_time = Date.now();
    // For now, keep cache empty (Mapbox will be used)
  }

  /**
   * Look up historical cost for an arc
   * Returns null if not found (will fall back to next tier)
   */
  lookup(arc_index: number, matrix_n: number): HistoricalArcCost & { metadata: ArcCostMetadata } | null {
    // Check cache
    const cache_key = `arc_${arc_index}`;
    if (this.cache.has(cache_key)) {
      return this.cache.get(cache_key) ?? null;
    }

    // Not found
    return null;
  }

  /**
   * Insert a historical arc cost into the cache
   */
  insert(
    arc_index: number,
    cost: HistoricalArcCost & { metadata: ArcCostMetadata }
  ): void {
    const cache_key = `arc_${arc_index}`;
    this.cache.set(cache_key, cost);
  }

  /**
   * Clear cache if TTL expired
   */
  invalidateIfStale(): void {
    const now = Date.now();
    if (now - this.last_load_time > this.ttl_ms) {
      this.cache.clear();
      this.last_load_time = now;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // Track separately in production
      misses: 0, // Track separately in production
    };
  }
}

/**
 * Select arc cost using confidence-based hierarchy
 *
 * Priority:
 * 1. Mapbox live traffic (if matrix.source == "road_matrix")
 * 2. YUTRA historical (if lookup available and data exists)
 * 3. Haversine fallback (always available)
 *
 * @param arcIndex - Index in the cost matrix
 * @param matrix - Full cost matrix with source indicator
 * @param truck - Truck details for cost calculation
 * @param params - Dispatch parameters
 * @param historicalLookup - Optional YUTRA lookup table
 * @returns Arc cost with metadata indicating source
 */
export function selectArcCost(
  arcIndex: number,
  matrix: Matrix,
  truck: Pick<Truck, "costPerKm">,
  params: Pick<DispatchParams, "floodSlowdown" | "floodWeight">,
  historicalLookup?: HistoricalArcLookup
): ArcCostWithMetadata {
  // Priority 1: Mapbox live traffic
  if (matrix.source === "road_matrix") {
    const cost = mapboxArcCost(matrix, arcIndex, arcIndex, truck, params);
    return {
      ...cost,
      metadata: {
        source: "mapbox_live",
        confidence: 1.0,
      },
    };
  }

  // Priority 2: YUTRA historical baseline (if available)
  if (historicalLookup) {
    historicalLookup.invalidateIfStale();
    const historicalCost = historicalLookup.lookup(arcIndex, matrix.n);

    if (historicalCost) {
      // Convert historical cost to RoutingCost format
      return {
        durationSeconds: historicalCost.total_time_minutes * 60,
        distanceMeters: matrix.km[arcIndex] * 1000,
        operatingCostMMK: matrix.km[arcIndex] * truck.costPerKm,
        riskPenaltySeconds: 0, // YUTRA data is historical, not real-time risks
        confidence: historicalCost.confidence,
        blocked: false,
        metadata: historicalCost.metadata,
      };
    }
  }

  // Priority 3: Haversine fallback (existing behavior)
  const cost = mapboxArcCost(matrix, arcIndex, arcIndex, truck, params);
  return {
    ...cost,
    metadata: {
      source: "haversine",
      confidence: 0.4,
    },
  };
}

/**
 * Batch select costs for multiple arcs with confidence tracking
 */
export interface BatchCostResult {
  costs: ArcCostWithMetadata[];
  coverage: {
    mapbox_live: number; // % of arcs
    yutra_historical: number;
    haversine: number;
  };
  average_confidence: number;
}

export function selectBatchCosts(
  arcs: number[],
  matrix: Matrix,
  truck: Pick<Truck, "costPerKm">,
  params: Pick<DispatchParams, "floodSlowdown" | "floodWeight">,
  historicalLookup?: HistoricalArcLookup
): BatchCostResult {
  const costs = arcs.map((arcIndex) => selectArcCost(arcIndex, matrix, truck, params, historicalLookup));

  // Calculate coverage statistics
  const coverage = {
    mapbox_live: 0,
    yutra_historical: 0,
    haversine: 0,
  };

  let total_confidence = 0;

  for (const cost of costs) {
    const source = cost.metadata.source as keyof typeof coverage;
    if (source in coverage) {
      coverage[source]++;
    }
    total_confidence += cost.metadata.confidence;
  }

  // Convert to percentages
  const total = costs.length;
  const coverage_pct = {
    mapbox_live: (coverage.mapbox_live / total) * 100,
    yutra_historical: (coverage.yutra_historical / total) * 100,
    haversine: (coverage.haversine / total) * 100,
  };

  return {
    costs,
    coverage: coverage_pct,
    average_confidence: total_confidence / total,
  };
}

/**
 * Quality-aware cost adjustment based on confidence
 *
 * Low-confidence costs are treated more conservatively in local search.
 * This prevents the solver from making aggressive moves based on unreliable data.
 *
 * @param confidence - Data confidence level (0..1)
 * @param cost - Original cost
 * @param improvement_threshold - Default 1% improvement threshold
 * @returns Adjusted improvement threshold for move acceptance
 */
export function adjustMoveAcceptanceThreshold(
  confidence: number,
  improvement_threshold: number = 0.01
): number {
  if (confidence >= 0.8) {
    // High confidence: standard threshold
    return improvement_threshold;
  } else if (confidence >= 0.5) {
    // Medium confidence: require 2% improvement
    return improvement_threshold * 2;
  } else {
    // Low confidence: very conservative
    return improvement_threshold * 5;
  }
}

/**
 * Example usage
 */
export function exampleUsage(): void {
  console.log("Arc Cost Strategy Examples");
  console.log("=".repeat(50));

  // Example 1: Mapbox available
  console.log("\nExample 1: Mapbox live traffic available");
  console.log("  → Cost confidence: 1.0 (live data)");
  console.log("  → Move acceptance: Standard (1% improvement)");

  // Example 2: Historical fallback
  console.log("\nExample 2: YUTRA historical baseline");
  console.log("  → Cost confidence: 0.5 (2013 data)");
  console.log("  → Move acceptance: Conservative (2% improvement)");

  // Example 3: Haversine fallback
  console.log("\nExample 3: Haversine fallback");
  console.log("  → Cost confidence: 0.4 (distance heuristic)");
  console.log("  → Move acceptance: Very conservative (5% improvement)");

  console.log("\n" + "=".repeat(50));
}
