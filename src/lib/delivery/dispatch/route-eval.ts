import type {
  Instance,
  Matrix,
  RouteEval,
  Stop,
  StopTiming,
  Terms,
  Truck,
  ViolationCode,
} from "./types.ts";

export const EPS = 1e-9;

export type EvalOptions = {
  /** Keep per-stop timings (needed for display, not for search). */
  detail?: boolean;
  /** Used only to diagnose why an order does not fit. */
  ignoreCapacity?: boolean;
  /**
   * Stop at the first violation and return an infeasible result with an
   * infinite score and partial figures. For search, which discards these.
   */
  bail?: boolean;
};

export const pickupNode = (r: number) => 1 + 2 * r;
export const deliveryNode = (r: number) => 2 + 2 * r;
export const stopNode = (stop: Stop) =>
  stop.kind === "P" ? pickupNode(stop.r) : deliveryNode(stop.r);

const EMPTY_TERMS: Terms = {
  time: 0,
  uncertainty: 0,
  cost: 0,
  flood: 0,
  late: 0,
  cohesion: 0,
};

/**
 * Exact forward pass over one truck's stop sequence. This is the single
 * authority for feasibility and score; construction and local search only
 * propose sequences and ask it. An empty route costs nothing.
 */
export function evaluateRoute(
  inst: Instance,
  matrix: Matrix,
  truck: Truck,
  seq: readonly Stop[],
  options: EvalOptions = {},
): RouteEval {
  const p = inst.params;
  const violations = new Set<ViolationCode>();
  const stops: StopTiming[] = [];

  if (seq.length === 0) {
    return {
      feasible: true,
      violations: [],
      score: 0,
      terms: { ...EMPTY_TERMS },
      km: 0,
      depart: 0,
      ret: 0,
      waitMin: 0,
      peakKg: 0,
      peakM3: 0,
      stops,
    };
  }

  // Precedence: each door order needs P then D on this route; depot orders only D.
  const seen = new Map<number, number>();
  let depotParcels = 0;
  let loadKg = 0;
  let loadM3 = 0;
  for (const stop of seq) {
    const request = inst.requests[stop.r];
    if (stop.kind === "P") {
      if (request.origin === "depot" || seen.has(stop.r))
        violations.add("precedence");
      seen.set(stop.r, 1);
    } else {
      if (request.origin === "door") {
        if (seen.get(stop.r) !== 1) violations.add("precedence");
      } else {
        depotParcels++;
        loadKg += request.weightKg;
        loadM3 += request.volumeM3;
      }
      seen.set(stop.r, 2);
    }
  }

  const bailOut = (): RouteEval => ({
    feasible: false,
    violations: [...violations],
    score: Number.POSITIVE_INFINITY,
    terms: { ...EMPTY_TERMS },
    km: 0,
    depart: 0,
    ret: 0,
    waitMin: 0,
    peakKg: 0,
    peakM3: 0,
    stops,
  });
  if (options.bail && violations.size > 0) return bailOut();

  const capKg = truck.capKg * p.utilisation;
  const capM3 = truck.capM3 * p.utilisation;
  let peakKg = loadKg;
  let peakM3 = loadM3;
  if (!options.ignoreCapacity && (loadKg > capKg + EPS || loadM3 > capM3 + EPS))
    violations.add("capacity");
  if (options.bail && violations.size > 0) return bailOut();

  const loadMin = p.loadBaseMin + p.loadPerParcelMin * depotParcels;
  const depart = Math.max(p.shiftStart, inst.earliestDepart) + loadMin;
  const n = matrix.n;
  let t = depart;
  let prev = 0;
  let km = 0;
  let wait = 0;
  let sigma2 = 0;
  let uncertainty = 0;
  let late = 0;
  let flood = 0;
  let cohesion = 0;
  let lastTownship: string | null = null;
  const townships = new Set<string>();

  for (const stop of seq) {
    const request = inst.requests[stop.r];
    const node = stopNode(stop);
    const arc = prev * n + node;
    if (matrix.blocked?.[arc]) violations.add("blocked");
    const frac = matrix.floodFrac?.[arc] ?? 0;
    const leg = matrix.time[arc] * (1 + p.floodSlowdown * frac);
    const legKm = matrix.km[arc];
    t += leg;
    km += matrix.km[arc];
    flood += p.floodWeight * frac * matrix.km[arc];
    sigma2 += (p.legSigma * leg) ** 2;
    const arrive = t;

    let start = arrive;
    let service: number;
    let slack: number;
    if (stop.kind === "P") {
      if (arrive > request.windowEnd + EPS) violations.add("window");
      start = Math.max(arrive, request.windowStart);
      wait += start - arrive;
      service = request.pickupService;
      slack = request.windowEnd - start;
      loadKg += request.weightKg;
      loadM3 += request.volumeM3;
      peakKg = Math.max(peakKg, loadKg);
      peakM3 = Math.max(peakM3, loadM3);
      if (
        !options.ignoreCapacity &&
        (loadKg > capKg + EPS || loadM3 > capM3 + EPS)
      )
        violations.add("capacity");
    } else {
      service = request.deliveryService;
      const due = request.deadline ?? p.shiftEnd;
      slack = due - start;
      if (request.deadline != null && start > request.deadline + EPS) {
        if (request.deadlineHard) violations.add("deadline");
        else late += start - request.deadline;
      }
      loadKg -= request.weightKg;
      loadM3 -= request.volumeM3;
    }

    if (slack >= 0) {
      uncertainty +=
        p.uncertaintyWeight * Math.max(0, p.z * Math.sqrt(sigma2) - slack);
    }
    sigma2 += (p.serviceSigma * service) ** 2;
    t = start + service;

    const township =
      stop.kind === "P" ? request.pickupTownship : request.deliveryTownship;
    if (township) {
      townships.add(township);
      if (lastTownship && lastTownship !== township)
        cohesion += p.cohesionKappa;
      lastTownship = township;
    }
    if (options.detail)
      stops.push({
        r: stop.r,
        kind: stop.kind,
        arrive,
        start,
        leave: t,
        slack,
        loadKg,
        legMin: leg,
        legKm,
        floodKm: frac * legKm,
      });
    prev = node;
    // Time only moves forward, so a route already past the shift cannot recover.
    if (options.bail && (violations.size > 0 || t > p.shiftEnd + EPS))
      return bailOut();
  }

  const back = prev * n;
  const frac = matrix.floodFrac?.[back] ?? 0;
  if (matrix.blocked?.[back]) violations.add("blocked");
  t += matrix.time[back] * (1 + p.floodSlowdown * frac);
  km += matrix.km[back];
  flood += p.floodWeight * frac * matrix.km[back];
  const ret = t;

  if (ret > p.shiftEnd + EPS || ret - depart > p.maxRouteMin + EPS)
    violations.add("shift");
  if (truck.maxKm != null && km > truck.maxKm + EPS) violations.add("range");

  if (townships.size > 1) cohesion += p.territoryPenalty * (townships.size - 1);

  const terms: Terms = {
    time: ret - depart + loadMin,
    uncertainty,
    cost: (truck.fixedCost + truck.costPerKm * km) / p.mmkPerScoreMinute,
    flood,
    late: late * p.lateWeight,
    cohesion,
  };
  const score =
    terms.time +
    terms.uncertainty +
    terms.cost +
    terms.flood +
    terms.late +
    terms.cohesion;

  return {
    feasible: violations.size === 0,
    violations: [...violations],
    score,
    terms,
    km,
    depart,
    ret,
    waitMin: wait,
    peakKg,
    peakM3,
    stops,
  };
}
