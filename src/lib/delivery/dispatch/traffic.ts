import {
  countInterceptionPointsBetween,
  countTrafficSignalsBetween,
  distanceToSegmentKm,
} from "../energy-routing.ts";
import { priceRoadReport, signalCostMin } from "../routing-cost.ts";
import type { Matrix, Point } from "./types.ts";

export type TrafficReport = {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  category?: string;
  severity?: string;
  /** The engine's reading of the note; replaces the raw category/severity table. */
  decision?: {
    action: "avoid" | "delay" | "monitor" | "ignore";
    severity: string;
    delayMinutes: number;
    radiusMeters: number;
  };
};

export type TrafficOrder = {
  id?: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  traffic_delay_minutes?: number | null;
};

export type TrafficSummary = {
  signalsCovered: number;
  interceptionsCovered: number;
  reportsCovered: number;
  ordersWithTrafficDelay: number;
  addedDelayMin: number;
  arcsWithDelay: number;
  blockedArcs: number;
};

export type ApplyTrafficOptions = {
  reports?: TrafficReport[];
  orders?: TrafficOrder[];
  corridorThresholdKm?: number;
  nowMs?: number;
};

const TRAFFIC_CATEGORIES = new Set([
  "congestion",
  "roadwork",
  "hazard",
  "closure",
]);

function reportPoint(
  report: TrafficReport,
): { latitude: number; longitude: number } | null {
  const lat = report.latitude ?? report.lat;
  const lng = report.longitude ?? report.lng;
  return lat != null && lng != null ? { latitude: lat, longitude: lng } : null;
}

function isTrafficReport(report: TrafficReport): boolean {
  if (!report.category) return true;
  return TRAFFIC_CATEGORIES.has(report.category);
}

/**
 * Layers Yangon's signalized junctions, user-mapped interception points,
 * live traffic road reports (congestion, roadwork, hazard, closure),
 * and order-level traffic delays onto the dispatch travel-time matrix.
 *
 * For each directed arc (i -> j):
 * - Signals add deceleration and red-light cycle delay (~0.95 min per signal)
 * - User interception midpoints add deceleration and traffic friction (~0.35 min per midpoint)
 * - Live traffic road reports within the corridor add congestion delay according to severity
 * - Blocked/closure road reports mark the arc as impassable (matrix.blocked)
 * - Arcs leading to delivery destinations with order traffic delays incur those delays
 *
 * This guides Clarke-Wright savings heuristics and 2-Opt/Or-Opt local search
 * to route deliveries around congested bottlenecks and avoid high-friction corridors.
 */
export function applyTraffic(
  matrix: Matrix,
  points: Point[],
  optionsOrThreshold?: number | ApplyTrafficOptions,
): { matrix: Matrix; summary: TrafficSummary } {
  const options: ApplyTrafficOptions =
    typeof optionsOrThreshold === "number"
      ? { corridorThresholdKm: optionsOrThreshold }
      : (optionsOrThreshold ?? {});

  const corridorThresholdKm = options.corridorThresholdKm ?? 0.45;
  const nowMs = options.nowMs ?? Date.now();
  const reports = options.reports ?? [];
  const orders = options.orders ?? [];

  const n = matrix.n;
  const time = new Float64Array(matrix.time);
  let blocked = matrix.blocked ? new Uint8Array(matrix.blocked) : null;

  let signalsCovered = 0;
  let interceptionsCovered = 0;
  const matchedReports = new Set<TrafficReport>();
  let addedDelayMin = 0;
  let arcsWithDelay = 0;
  let blockedArcs = 0;

  // Build a delivery point to order traffic delay map (matching delivery latitude and longitude)
  const deliveryNodeDelays = new Map<number, number>();
  const ordersApplied = new Set<string>();

  for (const order of orders) {
    const delay = order.traffic_delay_minutes ?? 0;
    if (delay <= 0) continue;
    if (order.delivery_latitude == null || order.delivery_longitude == null)
      continue;

    // Find corresponding node index in points
    for (let idx = 0; idx < points.length; idx++) {
      if (
        Math.abs(points[idx].lat - order.delivery_latitude) < 1e-5 &&
        Math.abs(points[idx].lng - order.delivery_longitude) < 1e-5
      ) {
        const existing = deliveryNodeDelays.get(idx) ?? 0;
        deliveryNodeDelays.set(idx, Math.max(existing, delay));
        if (order.id) ordersApplied.add(order.id);
        else ordersApplied.add(`idx-${idx}`);
      }
    }
  }

  // Filter traffic reports once
  const validTrafficReports = reports
    .filter(isTrafficReport)
    .map((r) => ({ report: r, point: reportPoint(r) }))
    .filter(
      (
        entry,
      ): entry is {
        report: TrafficReport;
        point: { latitude: number; longitude: number };
      } => entry.point != null,
    );

  // Reports do not vary by arc, so price each once.
  const prices = new Map(
    validTrafficReports.map(({ report }) => [
      report,
      priceRoadReport(
        {
          ...report,
          category: report.category ?? "congestion",
          severity: report.severity ?? "medium",
        },
        nowMs,
      ),
    ]),
  );

  for (let i = 0; i < n; i++) {
    const from = { latitude: points[i].lat, longitude: points[i].lng };
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const arc = i * n + j;
      const to = { latitude: points[j].lat, longitude: points[j].lng };

      const intResult = countInterceptionPointsBetween(
        from,
        to,
        corridorThresholdKm,
      );
      const userPoints = intResult.points;
      const ints = intResult.count;
      // An arterial signal at the same junction as a hand-mapped light is one
      // stop, not two
      const signals = countTrafficSignalsBetween(
        from,
        to,
        corridorThresholdKm,
      ).signals.filter(
        (signal) =>
          !userPoints.some(
            (pt) =>
              pt.type === "traffic_light" &&
              Math.abs(pt.latitude - signal.latitude) < 0.0011 &&
              Math.abs(pt.longitude - signal.longitude) < 0.0012,
          ),
      );
      const sigs = signals.length;

      // Base signal and user traffic point delay:
      // Traffic lights apply cycle-calibrated red-light and deceleration delay;
      // Side-street bypass waypoints provide bottleneck relief; midpoints apply friction
      let userPointsDelay = 0;
      for (const pt of userPoints) {
        if (pt.type === "bypass_waypoint") {
          // Bypass waypoints represent side-street bypass routes; zero bottleneck delay
          continue;
        }
        if (pt.type === "traffic_light") {
          // If a known side-street bypass exists for this traffic light along the corridor,
          // traffic diversion significantly reduces junction delay
          const hasBypass = userPoints.some(
            (b) => b.type === "bypass_waypoint" && b.bypassesPointId === pt.id,
          );
          if (hasBypass) {
            userPointsDelay += 0.2; // Minor side-turn friction instead of full red-light queue
          } else {
            userPointsDelay += signalCostMin(pt.estimatedCycleSeconds);
          }
        } else {
          userPointsDelay += 0.35;
        }
      }

      // Arterial signals are priced by cycle, exactly as navigation prices them
      let arcDelay = userPointsDelay;
      for (const signal of signals)
        arcDelay += signalCostMin(signal.estimatedCycleSeconds);
      signalsCovered += sigs;
      interceptionsCovered += ints;

      // Check live traffic road reports along the corridor
      for (const { report, point } of validTrafficReports) {
        const price = prices.get(report);
        if (!price) continue;
        // No road geometry here, only the straight line: a wider corridor
        // stands in for the true path navigation measures against.
        const reach = report.decision
          ? Math.max(0.15, price.reachKm)
          : corridorThresholdKm;
        if (distanceToSegmentKm(point, from, to) > reach) continue;
        arcDelay += price.delayMin;
        matchedReports.add(report);
        if (price.blocked) {
          if (!blocked) blocked = new Uint8Array(n * n);
          blocked[arc] = 1;
          blockedArcs++;
        }
      }

      // Check order delivery traffic delay if node j is a delivery destination
      const orderDelay = deliveryNodeDelays.get(j);
      if (orderDelay != null && orderDelay > 0) {
        arcDelay += orderDelay;
      }

      if (arcDelay > 0) {
        time[arc] += arcDelay;
        addedDelayMin += arcDelay;
        arcsWithDelay++;
      }
    }
  }

  return {
    matrix: {
      ...matrix,
      time,
      blocked: blocked ?? matrix.blocked,
    },
    summary: {
      signalsCovered,
      interceptionsCovered,
      reportsCovered: matchedReports.size,
      ordersWithTrafficDelay: ordersApplied.size,
      addedDelayMin: Math.round(addedDelayMin * 10) / 10,
      arcsWithDelay,
      blockedArcs,
    },
  };
}
