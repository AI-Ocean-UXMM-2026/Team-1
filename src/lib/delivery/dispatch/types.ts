/*
 * Pure types for the multi-truck planner. No runtime imports from "@/" so the
 * Node test runner can load every module in this folder directly.
 */

export type Point = { lat: number; lng: number };

export type Truck = {
  id: string;
  capKg: number;
  capM3: number;
  costPerKm: number;
  fixedCost: number;
  /** Usable range in km (reserve already removed); null when unknown. */
  maxKm: number | null;
};

/**
 * One order. Door orders are collected at `pickup` inside the pickup window,
 * then delivered. Depot orders are already at the depot and are on board from
 * departure (their delivery is the only stop).
 */
export type Request = {
  id: string;
  origin: "door" | "depot";
  pickup: Point | null;
  delivery: Point;
  weightKg: number;
  volumeM3: number;
  /** Pickup window, minutes since service-day midnight (door orders). */
  windowStart: number;
  windowEnd: number;
  deadline: number | null;
  deadlineHard: boolean;
  pickupService: number;
  deliveryService: number;
  pickupTownship: string | null;
  deliveryTownship: string | null;
};

export type DispatchParams = {
  shiftStart: number;
  shiftEnd: number;
  maxRouteMin: number;
  loadBaseMin: number;
  loadPerParcelMin: number;
  utilisation: number;
  speedKmh: number;
  roadFactor: number;
  legSigma: number;
  serviceSigma: number;
  z: number;
  uncertaintyWeight: number;
  mmkPerScoreMinute: number;
  lateWeight: number;
  unservedPenalty: number;
  cohesionKappa: number;
  territoryPenalty: number;
  floodWeight: number;
  floodSlowdown: number;
  maxIterations: number;
  deadlineMs: number;
  seed: number;
  /** Mapbox "driving" is a car profile; trucks are slower (ASSUMED). */
  truckTimeFactor: number;
  /** Per-run traffic scalar on road times (ASSUMED, not live traffic). */
  trafficMultiplier: number;
  maxMatrixElements: number;
  maxMatrixRequests: number;
  /** Minutes between "now" and the earliest departure when planning today. */
  dispatchLeadMin: number;
  /** Size-class estimates used only when no weight or volume was declared (ASSUMED). */
  sizeKg: { small: number; medium: number; large: number };
  sizeM3: { small: number; medium: number; large: number };
  serviceExtraMin: {
    small: number;
    medium: number;
    large: number;
    cod: number;
  };
  defaultDeadlineSlackMin: number;
  defaultCostPerKm: number;
};

export type Instance = {
  /** True for generated fixtures. Synthetic instances are never persisted. */
  synthetic: boolean;
  label: string;
  depot: Point;
  trucks: Truck[];
  requests: Request[];
  /** Earliest minute a truck may start loading. */
  earliestDepart: number;
  params: DispatchParams;
};

/** Dense node matrix: node 0 is the depot; request r has pickup 1+2r and delivery 2+2r. */
export type Matrix = {
  n: number;
  /** Minutes, row i to column j. */
  time: Float64Array;
  km: Float64Array;
  /** Fraction (0..1) of a leg inside a flood-hazard zone, if known. */
  floodFrac: Float64Array | null;
  /** Arcs forbidden by a verified blocked report. */
  blocked: Uint8Array | null;
  source: "road_matrix" | "road_calibrated" | "straight_line";
};

export type Stop = { r: number; kind: "P" | "D" };

export type ViolationCode =
  | "precedence"
  | "capacity"
  | "window"
  | "deadline"
  | "shift"
  | "range"
  | "blocked";

export type Terms = {
  time: number;
  uncertainty: number;
  cost: number;
  flood: number;
  late: number;
  cohesion: number;
};

export type RouteEval = {
  feasible: boolean;
  violations: ViolationCode[];
  score: number;
  terms: Terms;
  km: number;
  depart: number;
  ret: number;
  waitMin: number;
  peakKg: number;
  peakM3: number;
  /** Per stop, only when detail was requested. */
  stops: StopTiming[];
};

export type StopTiming = {
  r: number;
  kind: "P" | "D";
  arrive: number;
  start: number;
  leave: number;
  slack: number;
  loadKg: number;
  legMin: number;
  legKm: number;
  floodKm: number;
};

export type UnassignedReason =
  | "missing_coordinates"
  | "exceeds_capacity_single"
  | "window_passed"
  | "window_infeasible"
  | "exceeds_range"
  | "exceeds_shift"
  | "flood_blocked"
  | "no_eligible_truck"
  | "capacity_exhausted"
  | "time_exhausted";

export type PlanRoute = {
  truckId: string;
  stops: Stop[];
  eval: RouteEval;
};

export type Plan = {
  routes: PlanRoute[];
  unassigned: { requestId: string; reason: UnassignedReason }[];
  objective: { routes: number; unserved: number; total: number };
  seed: number;
  iterations: number;
  stopReason: "converged" | "iterations" | "deadline";
  dataQuality: Matrix["source"];
  hash: string;
};
