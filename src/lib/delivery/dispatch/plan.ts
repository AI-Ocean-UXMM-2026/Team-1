import type { FloodField, FloodReport, FloodSummary } from "./flood.ts";
import { applyFlood } from "./flood.ts";
import type {
  BuildInstanceResult,
  DepotRow,
  OrderRow,
  TruckRow,
} from "./inputs.ts";
import { buildInstance } from "./inputs.ts";
import { nodePoints } from "./matrix.ts";
import type { LiveFloodConditions } from "./open-meteo.ts";
import { withParams } from "./params.ts";
import type { RoadMatrixStats } from "./road-matrix.ts";
import { solve } from "./solve.ts";
import { applyTraffic, type TrafficSummary } from "./traffic.ts";
import type { DispatchParams, Matrix, Plan, Point } from "./types.ts";
import { validateSolution } from "./validate.ts";

export const ENGINE_VERSION = "dispatch-0.3 (regret-2 + local search)";
export const MAX_ORDERS = 150;

export type PlanInput = {
  depot: DepotRow;
  serviceDate: string;
  now: Date;
  orders: OrderRow[];
  trucks: TruckRow[];
  driverByVehicle?: Record<string, string | null>;
  params?: Partial<DispatchParams>;
  field: FloodField | null;
  reports: FloodReport[];
  liveFlood?: LiveFloodConditions | null;
};

export type PlanDeps = {
  buildMatrix: (
    points: Point[],
    params: DispatchParams,
  ) => Promise<{ matrix: Matrix; stats: RoadMatrixStats | null }>;
  nowMs: () => number;
};

export type PlanErrorCode =
  | "no_open_orders"
  | "no_eligible_trucks"
  | "too_many_orders"
  | "depot_unverified"
  | "internal_invalid_plan";

export type PlanResult =
  | { ok: false; code: PlanErrorCode; message: string; detail?: unknown }
  | {
      ok: true;
      /** Exactly what save_dispatch_run stores; also what the review screen shows. */
      payload: SavePayload;
      plan: Plan;
      quality: DataQuality;
      assumptions: { key: string; label: string; value: unknown }[];
      warnings: string[];
      excludedTrucks: BuildInstanceResult["excludedTrucks"];
      scheduledLater: string[];
      basis: string;
    };

export type DataQuality = {
  tier: Matrix["source"];
  label: string;
  matrix: RoadMatrixStats | null;
  flood: FloodSummary;
  traffic?: TrafficSummary;
};

type Json = Record<string, unknown>;
export type SavePayload = {
  depot_id: string;
  service_date: string;
  engine_version: string;
  params: DispatchParams;
  seed: number;
  iterations: number;
  stop_reason: Plan["stopReason"];
  runtime_ms: number;
  data_quality: Matrix["source"];
  data_quality_detail: Json;
  score_total: number;
  score_breakdown: Json;
  routes: Json[];
  orders: Json[];
  matrix?: Json;
};

const TIER_LABEL: Record<Matrix["source"], string> = {
  road_matrix: "Road times, typical traffic",
  road_calibrated: "Road times for part of the network, estimated for the rest",
  straight_line: "Estimated from straight-line distance, no road data",
};

const ASSUMPTION_LABELS: [keyof DispatchParams, string][] = [
  ["sizeKg", "Parcel weight by size when none was declared (kg)"],
  ["sizeM3", "Parcel volume by size (m³)"],
  ["utilisation", "Share of truck capacity that may be used"],
  ["serviceExtraMin", "Extra service minutes by size / COD"],
  ["loadBaseMin", "Depot loading time before departure (min)"],
  ["loadPerParcelMin", "Extra loading minutes per depot parcel"],
  ["shiftStart", "Shift start (minutes after midnight)"],
  ["shiftEnd", "Shift end (minutes after midnight)"],
  ["maxRouteMin", "Longest route (min)"],
  ["truckTimeFactor", "Truck vs car time on road data"],
  ["trafficMultiplier", "Traffic multiplier (not live traffic)"],
  ["speedKmh", "Straight-line fallback speed (km/h)"],
  ["roadFactor", "Straight-line to road distance factor"],
  ["legSigma", "Relative uncertainty of travel time"],
  ["serviceSigma", "Relative uncertainty of service time"],
  [
    "defaultDeadlineSlackMin",
    "Default delivery deadline after pickup window (min)",
  ],
  ["defaultCostPerKm", "Operating cost per km when not set (MMK)"],
  ["mmkPerScoreMinute", "MMK per score-minute"],
  ["floodWeight", "Flood penalty per flooded km equivalent"],
  ["floodSlowdown", "Slowdown on flooded legs"],
  ["lateWeight", "Penalty per late minute"],
  ["unservedPenalty", "Penalty per unassigned order"],
  ["cohesionKappa", "Penalty per township switch"],
];

const iso = (startMs: number, minutes: number) =>
  new Date(startMs + Math.round(minutes * 60000)).toISOString();
const round = (value: number, places = 2) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};
const hhmm = (minutes: number) => {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export async function planDispatch(
  input: PlanInput,
  deps: PlanDeps,
): Promise<PlanResult> {
  const startedAt = deps.nowMs();
  const params = withParams(input.params);
  if (
    input.depot.location_status !== "verified" ||
    input.depot.latitude == null
  )
    return {
      ok: false,
      code: "depot_unverified",
      message: "The depot location has not been confirmed",
    };
  if (input.orders.length > MAX_ORDERS)
    return {
      ok: false,
      code: "too_many_orders",
      message: `${input.orders.length} open orders; plan at most ${MAX_ORDERS} at once (split by township)`,
    };
  if (input.orders.length === 0)
    return {
      ok: false,
      code: "no_open_orders",
      message: "No open orders to plan",
    };

  const built = buildInstance({
    depot: input.depot,
    serviceDate: input.serviceDate,
    now: input.now,
    orders: input.orders,
    trucks: input.trucks,
    params,
  });
  const inst = built.instance;
  if (inst.trucks.length === 0)
    return {
      ok: false,
      code: "no_eligible_trucks",
      message: "No truck is available with a capacity_kg set",
      detail: built.excludedTrucks,
    };

  // If live rain or flood risk was detected and not manually overridden, adjust flood slowdown.
  if (
    input.liveFlood &&
    input.params?.floodSlowdown == null &&
    input.liveFlood.suggestedSlowdown > 0
  ) {
    params.floodSlowdown = Math.max(
      params.floodSlowdown,
      input.liveFlood.suggestedSlowdown,
    );
  }

  // Road data first; flood and traffic interception exposure are layered onto the matrix.
  const points = nodePoints(inst);
  const road = await deps.buildMatrix(points, params);
  const flooded = applyFlood(
    road.matrix,
    points,
    input.field,
    input.reports,
    input.liveFlood,
  );
  const trafficked = applyTraffic(flooded.matrix, points, {
    reports: input.reports,
    orders: input.orders,
  });
  const matrix = trafficked.matrix;

  const plan = solve(inst, matrix, { nowMs: deps.nowMs });
  const violations = validateSolution(inst, matrix, plan);
  if (violations.length > 0)
    return {
      ok: false,
      code: "internal_invalid_plan",
      message:
        "The planner produced a plan that failed its own validation; nothing was saved",
      detail: violations,
    };

  const quality: DataQuality = {
    tier: matrix.source,
    label: TIER_LABEL[matrix.source],
    matrix: road.stats,
    flood: flooded.summary,
    traffic: trafficked.summary,
  };
  const warnings = [...built.warnings];
  if (
    input.liveFlood &&
    (input.liveFlood.severity === "heavy_rain" ||
      input.liveFlood.severity === "flood_risk")
  ) {
    warnings.push(
      `live_flood_alert: Live Open-Meteo reports ${input.liveFlood.precipitationMm} mm/h rain (active weather slowdown applied)`,
    );
  }
  if (flooded.summary.status === "unknown")
    warnings.push(
      "flood_unknown: no flood layer or verified reports were available, so flood risk is unknown (not zero)",
    );
  if (flooded.summary.status === "reports_only")
    warnings.push("flood_layer_missing: only verified road reports were used");
  if (matrix.source === "straight_line")
    warnings.push(
      "straight_line: no road data was used, so times are rough estimates",
    );
  if (trafficked.summary.reportsCovered > 0)
    warnings.push(
      `traffic_reports: ${trafficked.summary.reportsCovered} verified traffic report(s) layered onto travel times (+${trafficked.summary.addedDelayMin} min total delay)`,
    );
  if (trafficked.summary.ordersWithTrafficDelay > 0)
    warnings.push(
      `order_traffic_delays: ${trafficked.summary.ordersWithTrafficDelay} order(s) carry localized traffic delays`,
    );
  if (built.scheduledLater.length > 0)
    warnings.push(
      `scheduled_later: ${built.scheduledLater.length} order(s) have a pickup window on another day`,
    );

  const payload = buildSavePayload(
    input,
    built,
    plan,
    matrix,
    road.stats,
    quality,
    warnings,
    deps.nowMs() - startedAt,
  );

  const weightsDeclared =
    built.counts.weight_declared + built.counts.weight_weighed;
  const weightsEstimated =
    built.counts.weight_size_estimate + built.counts.weight_default_assumed;
  const basis =
    `${quality.label}. ${weightsDeclared} weight(s) declared, ${weightsEstimated} estimated from size. ` +
    "Estimates are not yet validated; predictions are recorded so they can be compared with actual arrivals.";

  return {
    ok: true,
    payload,
    plan,
    quality,
    assumptions: ASSUMPTION_LABELS.map(([key, label]) => ({
      key,
      label,
      value: params[key],
    })),
    warnings,
    excludedTrucks: built.excludedTrucks,
    scheduledLater: built.scheduledLater,
    basis,
  };
}

function buildSavePayload(
  input: PlanInput,
  built: BuildInstanceResult,
  plan: Plan,
  matrix: Matrix,
  stats: RoadMatrixStats | null,
  quality: DataQuality,
  warnings: string[],
  runtimeMs: number,
): SavePayload {
  const inst = built.instance;
  const start = built.dayStartMs;
  const metaFor = (r: number) => built.metas[r];
  const indexOfOrder = new Map(inst.requests.map((req, r) => [req.id, r]));
  const routes: Json[] = [];
  const orders: Json[] = [];
  const totals = {
    time: 0,
    uncertainty: 0,
    cost: 0,
    flood: 0,
    late: 0,
    cohesion: 0,
  };
  let displayOrder = 0;

  for (const route of plan.routes) {
    if (route.stops.length === 0) continue;
    const truck = inst.trucks.find((t) => t.id === route.truckId);
    const truckInfo = built.truckMeta.get(route.truckId);
    const e = route.eval;
    const service = e.stops.reduce((sum, s) => sum + (s.leave - s.start), 0);
    const floodKm = e.stops.reduce((sum, s) => sum + s.floodKm, 0);
    const flags: string[] = [];
    if (e.waitMin > 0.5) flags.push("waits_for_window");
    if (floodKm > 0.05) flags.push("flood_exposure");
    const energy =
      truck?.maxKm == null
        ? "unknown"
        : e.km > truck.maxKm
          ? "short"
          : e.km > 0.85 * truck.maxKm
            ? "tight"
            : "enough";
    if (energy === "tight") flags.push("energy_tight");
    for (const k of Object.keys(totals) as (keyof typeof totals)[])
      totals[k] += e.terms[k];

    routes.push({
      vehicle_id: route.truckId,
      driver_id: input.driverByVehicle?.[route.truckId] ?? null,
      display_order: displayOrder++,
      planned_depart_at: iso(start, e.depart),
      planned_return_at: iso(start, e.ret),
      distance_km: round(e.km),
      travel_min: round(Math.max(0, e.ret - e.depart - e.waitMin - service), 1),
      service_min: round(service, 1),
      wait_min: round(e.waitMin, 1),
      peak_kg: round(e.peakKg),
      peak_m3: round(Number.isFinite(e.peakM3) ? e.peakM3 : 0, 4),
      cap_kg_used: truck ? round(truck.capKg * inst.params.utilisation) : null,
      cap_m3_used:
        truck && Number.isFinite(truck.capM3)
          ? round(truck.capM3 * inst.params.utilisation, 4)
          : null,
      usable_range_km:
        truckInfo?.usableKm != null ? round(truckInfo.usableKm) : null,
      energy_status: energy,
      score_time: round(e.terms.time),
      score_uncertainty: round(e.terms.uncertainty),
      score_cost: round(e.terms.cost),
      score_flood: round(e.terms.flood),
      score_late: round(e.terms.late),
      score_cohesion: round(e.terms.cohesion),
      score_total: round(e.score),
      flags,
      explanation: {
        summary:
          `${new Set(route.stops.map((s) => s.r)).size} order(s), ${round(e.km, 1)} km, ` +
          `leaves ${hhmm(e.depart)}, back ${hhmm(e.ret)} (Yangon time)` +
          (e.waitMin > 0.5
            ? `, waits ${Math.round(e.waitMin)} min for pickup windows`
            : "") +
          (floodKm > 0.05
            ? `, ${round(floodKm, 1)} km through mapped flood-hazard zones (static map, not live)`
            : ""),
      },
      stops: e.stops.map((s, i) => {
        const req = inst.requests[s.r];
        const meta = metaFor(s.r);
        const pickup = s.kind === "P";
        const point = pickup ? req.pickup : req.delivery;
        return {
          order_id: req.id,
          stop_type: pickup ? "pickup" : "delivery",
          seq: i + 1,
          address: pickup ? meta.pickupAddress : meta.deliveryAddress,
          latitude: round(point?.lat ?? 0, 6),
          longitude: round(point?.lng ?? 0, 6),
          window_start_at:
            pickup && meta.originKind === "door"
              ? iso(start, req.windowStart)
              : null,
          window_end_at:
            pickup && meta.originKind === "door"
              ? iso(start, req.windowEnd)
              : null,
          planned_arrival_at: iso(start, s.arrive),
          planned_departure_at: iso(start, s.leave),
          slack_min: round(s.slack, 1),
          leg_min: round(s.legMin, 1),
          leg_km: round(s.legKm),
          leg_flood_km: round(s.floodKm),
          load_after_kg: round(s.loadKg),
          township_pcode: pickup ? meta.pickupTownship : meta.deliveryTownship,
          reasons: [
            `Arrives ${hhmm(s.arrive)}${
              pickup
                ? ` (window ${hhmm(req.windowStart)}–${hhmm(req.windowEnd)})`
                : ""
            }, ${Math.round(s.slack)} min before its limit`,
          ],
        };
      }),
    });
    for (const r of new Set(route.stops.map((s) => s.r))) {
      const req = inst.requests[r];
      orders.push(
        orderEntry(
          metaFor(r),
          req.weightKg,
          req.volumeM3,
          { disposition: "assigned", vehicle_id: route.truckId },
          start,
        ),
      );
    }
  }

  for (const u of plan.unassigned) {
    const r = indexOfOrder.get(u.requestId) as number;
    const req = inst.requests[r];
    orders.push(
      orderEntry(
        metaFor(r),
        req.weightKg,
        req.volumeM3,
        {
          disposition: "unassigned",
          unassigned_reason: u.reason,
          unassigned_detail: {
            weight_kg: req.weightKg,
            volume_m3: req.volumeM3,
          },
        },
        start,
      ),
    );
  }
  for (const x of built.preExcluded) {
    const m = x.meta;
    orders.push({
      order_id: x.orderId,
      pickup_address: m.pickupAddress,
      delivery_address: m.deliveryAddress,
      disposition: "unassigned",
      unassigned_reason: x.reason,
      unassigned_detail: x.detail,
      origin_kind: m.originKind,
      order_updated_at: m.orderUpdatedAt,
      logistics_updated_at: m.logisticsUpdatedAt,
      weight_source: m.weightSource,
      volume_source: m.volumeSource,
      window_source: m.windowSource,
      deadline_hard: m.deadlineHard,
      pickup_township_pcode: m.pickupTownship,
      delivery_township_pcode: m.deliveryTownship,
    });
  }

  const payload: SavePayload = {
    depot_id: input.depot.id,
    service_date: input.serviceDate,
    engine_version: ENGINE_VERSION,
    params: inst.params,
    seed: plan.seed,
    iterations: plan.iterations,
    stop_reason: plan.stopReason,
    runtime_ms: Math.max(0, Math.round(runtimeMs)),
    data_quality: matrix.source,
    data_quality_detail: {
      label: quality.label,
      matrix: stats,
      flood: quality.flood,
      traffic: quality.traffic,
      warnings,
      counts: built.counts,
      excluded_trucks: built.excludedTrucks,
      scheduled_later: built.scheduledLater,
    },
    score_total: round(plan.objective.total),
    score_breakdown: {
      ...Object.fromEntries(
        Object.entries(totals).map(([k, v]) => [k, round(v)]),
      ),
      unserved: round(plan.objective.unserved),
    },
    routes,
    orders,
  };

  // Only road-derived matrices are worth keeping for later re-evaluation; a
  // straight-line one can be recomputed. Deleted on commit or discard.
  if (matrix.source !== "straight_line") {
    payload.matrix = {
      nodes: nodePoints(inst),
      duration_s: Array.from(matrix.time, (m) => Math.round(m * 60)),
      distance_m: Array.from(matrix.km, (k) => Math.round(k * 1000)),
      provider: "mapbox",
      profile: "driving",
      elements_billed: stats?.elementsBilled ?? 0,
    };
  }
  return payload;
}

function orderEntry(
  m: BuildInstanceResult["metas"][number],
  weightKg: number,
  volumeM3: number,
  extra: Json,
  start: number,
): Json {
  return {
    order_id: m.orderId,
    pickup_address: m.pickupAddress,
    delivery_address: m.deliveryAddress,
    origin_kind: m.originKind,
    order_updated_at: m.orderUpdatedAt,
    logistics_updated_at: m.logisticsUpdatedAt,
    weight_kg: weightKg,
    weight_source: m.weightSource,
    volume_m3: volumeM3,
    volume_source: m.volumeSource,
    window_start_at: m.originKind === "door" ? iso(start, m.windowStart) : null,
    window_end_at: m.originKind === "door" ? iso(start, m.windowEnd) : null,
    window_source: m.windowSource,
    deadline_hard: m.deadlineHard,
    pickup_township_pcode: m.pickupTownship,
    delivery_township_pcode: m.deliveryTownship,
    ...extra,
  };
}
