/**
 * Historical Cost Calculation using YUTRA 2013 Yangon Traffic Data
 *
 * Implements BPR (Bureau of Public Roads) congestion model for travel-time
 * estimation based on observed traffic volumes and road capacity.
 *
 * Formula: t = t₀ × [1 + α × (v/c)^β]
 * where:
 *   t    = estimated travel time (minutes)
 *   t₀   = free-flow travel time (minutes)
 *   v    = traffic volume (vehicles/hour, in PCU units)
 *   c    = road capacity (vehicles/hour, in PCU units)
 *   α    = shape parameter (typically 3.0)
 *   β    = power exponent (typically 4.0)
 */

export interface RoadCharacteristics {
  distance_km: number;
  max_speed_kmh: number;
  capacity_veh_hour: number;
  survey_year: number;
}

export interface TrafficConditions {
  peak_volume_veh_hour: number;
  off_peak_volume_veh_hour: number;
  signal_delay_seconds?: number;
  time_of_day?: "peak" | "off_peak" | "unknown";
}

export interface BPRParameters {
  alpha: number; // Shape parameter (default: 3.0)
  beta: number;  // Power exponent (default: 4.0)
}

/**
 * Calculate free-flow travel time for a road segment
 * @param distance_km - Road segment distance
 * @param max_speed_kmh - Maximum (free-flow) speed
 * @returns Free-flow time in minutes
 */
export function freeFlowTime(
  distance_km: number,
  max_speed_kmh: number
): number {
  if (max_speed_kmh <= 0) return 0;
  return (distance_km / max_speed_kmh) * 60;
}

/**
 * Calculate congestion multiplier using BPR model
 * @param volume - Traffic volume (vehicles/hour, PCU units)
 * @param capacity - Road capacity (vehicles/hour, PCU units)
 * @param alpha - Shape parameter (default: 3.0)
 * @param beta - Power exponent (default: 4.0)
 * @returns Congestion multiplier (1.0 = no congestion)
 *
 * Valid range: v/c from 0.0 (free-flow) to 1.2+ (oversaturation/gridlock)
 */
export function congestionMultiplier(
  volume: number,
  capacity: number,
  alpha: number = 3.0,
  beta: number = 4.0
): number {
  if (capacity === 0 || volume === 0) {
    return 1.0; // No data; use free-flow
  }

  const volumeCapacityRatio = volume / capacity;

  // Clamp v/c to reasonable range to prevent numerical overflow
  const clampedRatio = Math.max(0, Math.min(volumeCapacityRatio, 3.0));

  // BPR formula: 1 + α × (v/c)^β
  const multiplier = 1 + alpha * Math.pow(clampedRatio, beta);

  // Sanity check: ensure reasonable output
  return Math.min(multiplier, 100); // Cap at 100x to prevent gridlock artifacts
}

/**
 * Estimate travel time with BPR congestion model
 * @param freeFlow_min - Free-flow time (minutes)
 * @param volume - Traffic volume (vehicles/hour)
 * @param capacity - Road capacity (vehicles/hour)
 * @param params - BPR parameters (alpha, beta)
 * @returns Estimated travel time (minutes)
 */
export function bprTravelTime(
  freeFlow_min: number,
  volume: number,
  capacity: number,
  params: BPRParameters = { alpha: 3.0, beta: 4.0 }
): number {
  const multiplier = congestionMultiplier(volume, capacity, params.alpha, params.beta);
  return freeFlow_min * multiplier;
}

/**
 * Calculate signal delay component
 * Adds intersection delay (red light wait + queue discharge)
 *
 * @param mean_delay_seconds - Mean delay per vehicle (seconds)
 * @returns Signal delay in minutes
 */
export function signalDelayMinutes(mean_delay_seconds: number): number {
  return mean_delay_seconds / 60;
}

/**
 * Complete arc cost calculation combining segment and signal delays
 */
export interface HistoricalArcCost {
  total_time_minutes: number;
  segment_time_minutes: number;
  signal_delay_minutes: number;
  volume_veh_hour: number;
  capacity_veh_hour: number;
  congestion_multiplier: number;
  confidence: number; // 0..1: data reliability
  provenance: {
    source: "yutra_historical";
    survey_year: number;
    table_id: string;
    source_page: string;
  };
}

/**
 * Calculate complete historical arc cost
 *
 * @param road - Road characteristics (distance, speed, capacity)
 * @param traffic - Traffic conditions (volume, optional signal delay)
 * @param params - BPR model parameters
 * @returns Complete arc cost with provenance
 */
export function calculateHistoricalArcCost(
  road: RoadCharacteristics,
  traffic: TrafficConditions,
  params: BPRParameters = { alpha: 3.0, beta: 4.0 }
): HistoricalArcCost {
  // Select volume based on time of day
  const volume =
    traffic.time_of_day === "peak"
      ? traffic.peak_volume_veh_hour
      : traffic.time_of_day === "off_peak"
        ? traffic.off_peak_volume_veh_hour
        : (traffic.peak_volume_veh_hour + traffic.off_peak_volume_veh_hour) / 2;

  // Segment travel time with congestion
  const t0 = freeFlowTime(road.distance_km, road.max_speed_kmh);
  const multiplier = congestionMultiplier(volume, road.capacity_veh_hour, params.alpha, params.beta);
  const segment_time = bprTravelTime(t0, volume, road.capacity_veh_hour, params);

  // Signal delay (if provided)
  const signal_delay = signalDelayMinutes(traffic.signal_delay_seconds ?? 0);

  // Total estimated time
  const total_time = segment_time + signal_delay;

  return {
    total_time_minutes: total_time,
    segment_time_minutes: segment_time,
    signal_delay_minutes: signal_delay,
    volume_veh_hour: volume,
    capacity_veh_hour: road.capacity_veh_hour,
    congestion_multiplier: multiplier,
    confidence: 0.5, // Historical data confidence level
    provenance: {
      source: "yutra_historical",
      survey_year: road.survey_year,
      table_id: "5.2.2.1", // Placeholder; should come from data
      source_page: "5-15", // Placeholder; should come from data
    },
  };
}

/**
 * Example usage and validation
 */
export function exampleCalculations(): void {
  // Example 1: Free-flow conditions (light traffic)
  console.log("=== Example 1: Free-flow (light traffic) ===");
  const road1 = {
    distance_km: 2.0,
    max_speed_kmh: 60,
    capacity_veh_hour: 900,
    survey_year: 2013,
  };
  const traffic1 = {
    peak_volume_veh_hour: 300,
    off_peak_volume_veh_hour: 150,
    signal_delay_seconds: 0,
    time_of_day: "off_peak" as const,
  };
  const cost1 = calculateHistoricalArcCost(road1, traffic1);
  console.log(`  Free-flow time: ${freeFlowTime(road1.distance_km, road1.max_speed_kmh).toFixed(2)} min`);
  console.log(`  Volume/Capacity: ${(traffic1.off_peak_volume_veh_hour / road1.capacity_veh_hour).toFixed(3)}`);
  console.log(`  Congestion factor: ${cost1.congestion_multiplier.toFixed(3)}`);
  console.log(`  Estimated time: ${cost1.total_time_minutes.toFixed(2)} min\n`);

  // Example 2: Peak hour congestion
  console.log("=== Example 2: Peak hour congestion ===");
  const traffic2 = {
    peak_volume_veh_hour: 800,
    off_peak_volume_veh_hour: 150,
    signal_delay_seconds: 22,
    time_of_day: "peak" as const,
  };
  const cost2 = calculateHistoricalArcCost(road1, traffic2);
  console.log(`  Volume/Capacity: ${(traffic2.peak_volume_veh_hour / road1.capacity_veh_hour).toFixed(3)}`);
  console.log(`  Congestion factor: ${cost2.congestion_multiplier.toFixed(3)}`);
  console.log(`  Segment time: ${cost2.segment_time_minutes.toFixed(2)} min`);
  console.log(`  Signal delay: ${cost2.signal_delay_minutes.toFixed(2)} min`);
  console.log(`  Total estimated time: ${cost2.total_time_minutes.toFixed(2)} min\n`);

  // Example 3: Oversaturation (v > c)
  console.log("=== Example 3: Oversaturation (gridlock) ===");
  const traffic3 = {
    peak_volume_veh_hour: 1200,
    off_peak_volume_veh_hour: 150,
    signal_delay_seconds: 45,
    time_of_day: "peak" as const,
  };
  const cost3 = calculateHistoricalArcCost(road1, traffic3);
  console.log(`  Volume/Capacity: ${(traffic3.peak_volume_veh_hour / road1.capacity_veh_hour).toFixed(3)}`);
  console.log(`  Congestion factor: ${cost3.congestion_multiplier.toFixed(3)}`);
  console.log(`  Total estimated time: ${cost3.total_time_minutes.toFixed(2)} min\n`);
}
