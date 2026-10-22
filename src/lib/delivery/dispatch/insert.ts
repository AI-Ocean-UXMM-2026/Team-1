import type { EvalOptions } from "./route-eval.ts";
import { EPS, evaluateRoute, pickupNode, stopNode } from "./route-eval.ts";
import type { Instance, Matrix, RouteEval, Stop, Truck } from "./types.ts";

export type Insertion = { seq: Stop[]; eval: RouteEval; delta: number };

/**
 * Memo of exact insertion results. An insertion depends only on the truck,
 * the order and the truck's current stop sequence, and ALNS leaves most trucks
 * untouched between iterations, so the same question recurs constantly.
 * `null` (no feasible slot) is cached too. Shared by reference across the
 * clones of a search state.
 */
export type InsertionCache = {
  entries: Map<string, { seq: Stop[]; eval: RouteEval } | null>;
  hits: number;
  misses: number;
  /** Full route evaluations spent inside insertion search. */
  evaluations: number;
};

const CACHE_LIMIT = 150_000;

export function createInsertionCache(): InsertionCache {
  return { entries: new Map(), hits: 0, misses: 0, evaluations: 0 };
}

const routeKey = (seq: readonly Stop[]) =>
  seq.map((stop) => (stop.r << 1) | (stop.kind === "D" ? 1 : 0)).join(",");

export type InsertOptions = EvalOptions & { cache?: InsertionCache };

/**
 * Cheapest feasible way to add request `r` to `seq`, judged by the exact
 * forward pass. Door orders try every (pickup, delivery) position pair with
 * the pickup first; depot orders try every delivery position.
 */
export function bestInsertion(
  inst: Instance,
  matrix: Matrix,
  truck: Truck,
  seq: readonly Stop[],
  currentScore: number,
  r: number,
  { cache, ...options }: InsertOptions = {},
): Insertion | null {
  const request = inst.requests[r];
  // Exact feasibility filter: a truck that cannot carry the order alone can
  // never take it, so skip the whole slot search.
  if (!options.ignoreCapacity) {
    const util = inst.params.utilisation;
    if (
      request.weightKg > truck.capKg * util + EPS ||
      request.volumeM3 > truck.capM3 * util + EPS
    )
      return null;
  }
  const useCache = cache != null && !options.detail && !options.ignoreCapacity;
  const key = useCache ? `${truck.id}|${r}|${routeKey(seq)}` : "";
  if (useCache) {
    const hit = cache.entries.get(key);
    if (hit !== undefined) {
      cache.hits++;
      return hit
        ? { seq: hit.seq, eval: hit.eval, delta: hit.eval.score - currentScore }
        : null;
    }
    cache.misses++;
  }
  const found = searchInsertion(
    inst,
    matrix,
    truck,
    seq,
    currentScore,
    r,
    options,
    cache,
  );
  if (useCache) {
    if (cache.entries.size >= CACHE_LIMIT) cache.entries.clear();
    cache.entries.set(key, found ? { seq: found.seq, eval: found.eval } : null);
  }
  return found;
}

function searchInsertion(
  inst: Instance,
  matrix: Matrix,
  truck: Truck,
  seq: readonly Stop[],
  currentScore: number,
  r: number,
  options: EvalOptions,
  cache: InsertionCache | undefined,
): Insertion | null {
  const request = inst.requests[r];
  let best: Insertion | null = null;
  const consider = (candidate: Stop[]) => {
    if (cache) cache.evaluations++;
    const result = evaluateRoute(inst, matrix, truck, candidate, {
      ...options,
      bail: true,
      trustedOrder: true,
    });
    if (!result.feasible) return;
    const delta = result.score - currentScore;
    if (best == null || delta < best.delta - 1e-9)
      best = { seq: candidate, eval: result, delta };
  };
  const length = seq.length;
  if (request.origin === "depot") {
    for (let i = 0; i <= length; i++) {
      consider([...seq.slice(0, i), { r, kind: "D" }, ...seq.slice(i)]);
    }
    return best;
  }
  // Exact pruning before the full pass. The stops ahead of the delivery see
  // the same timings as a route with only the pickup added, so: a pickup slot
  // reached after its window closes is skipped, and once some later stop
  // breaks a window, hard deadline or the shift with the pickup alone, the
  // delivery must come before it. (An empty route reports no departure time,
  // so it is never pruned.)
  const base = evaluateRoute(inst, matrix, truck, seq, {
    ...options,
    detail: true,
  });
  const p = inst.params;
  const n = matrix.n;
  const legMin = (from: number, to: number) => {
    const arc = from * n + to;
    return (
      matrix.time[arc] * (1 + p.floodSlowdown * (matrix.floodFrac?.[arc] ?? 0))
    );
  };
  const node = pickupNode(r);
  for (let i = 0; i <= length; i++) {
    let last = length;
    if (length > 0) {
      const leave = i === 0 ? base.depart : base.stops[i - 1].leave;
      const arrive = leave + legMin(i === 0 ? 0 : stopNode(seq[i - 1]), node);
      if (arrive > request.windowEnd + EPS) continue;
      let t = Math.max(arrive, request.windowStart) + request.pickupService;
      let prev = node;
      for (let k = i; k < length; k++) {
        const stop = seq[k];
        const other = inst.requests[stop.r];
        const at = stopNode(stop);
        t += legMin(prev, at);
        if (stop.kind === "P") {
          if (t > other.windowEnd + EPS) {
            last = k;
            break;
          }
          t = Math.max(t, other.windowStart) + other.pickupService;
        } else {
          if (
            other.deadlineHard &&
            other.deadline != null &&
            t > other.deadline + EPS
          ) {
            last = k;
            break;
          }
          t += other.deliveryService;
        }
        if (t > p.shiftEnd + EPS) {
          last = k;
          break;
        }
        prev = at;
      }
    }
    for (let j = i; j <= last; j++) {
      consider([
        ...seq.slice(0, i),
        { r, kind: "P" },
        ...seq.slice(i, j),
        { r, kind: "D" },
        ...seq.slice(j),
      ]);
    }
  }
  return best;
}

export function removeRequest(seq: readonly Stop[], r: number): Stop[] {
  return seq.filter((stop) => stop.r !== r);
}
