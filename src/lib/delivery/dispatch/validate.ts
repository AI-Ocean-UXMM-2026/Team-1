import type { Instance, Matrix, Plan } from "./types.ts";

export type Violation = { truckId: string; code: string; detail: string };

/**
 * Independent re-check of a finished plan. It does not call the solver's
 * evaluator: it replays each route with its own small simulation, so a bug in
 * one is unlikely to hide in the other.
 */
export function validateSolution(
  inst: Instance,
  matrix: Matrix,
  plan: Plan,
): Violation[] {
  const out: Violation[] = [];
  const p = inst.params;
  const placed = new Map<string, number>();
  const n = matrix.n;

  for (const route of plan.routes) {
    const truck = inst.trucks.find((t) => t.id === route.truckId);
    if (!truck) {
      out.push({ truckId: route.truckId, code: "unknown_truck", detail: "" });
      continue;
    }
    if (route.stops.length === 0) continue;
    const fail = (code: string, detail: string) =>
      out.push({ truckId: truck.id, code, detail });

    const kinds = new Map<number, string>();
    let onboardKg = 0;
    let onboardM3 = 0;
    let depotCount = 0;
    for (const stop of route.stops) {
      const request = inst.requests[stop.r];
      placed.set(
        request.id,
        (placed.get(request.id) ?? 0) + (stop.kind === "D" ? 1 : 0),
      );
      if (request.origin === "depot") {
        if (stop.kind === "P") fail("precedence", request.id);
        else {
          onboardKg += request.weightKg;
          onboardM3 += request.volumeM3;
          depotCount++;
        }
      } else if (stop.kind === "P") {
        if (kinds.has(stop.r)) fail("precedence", request.id);
        kinds.set(stop.r, "P");
      } else if (kinds.get(stop.r) !== "P") fail("precedence", request.id);
    }
    for (const [r, kind] of kinds) {
      const hasDelivery = route.stops.some((s) => s.r === r && s.kind === "D");
      if (kind === "P" && !hasDelivery) fail("precedence", inst.requests[r].id);
    }

    const limitKg = truck.capKg * p.utilisation + 1e-9;
    const limitM3 = truck.capM3 * p.utilisation + 1e-9;
    let clock =
      Math.max(p.shiftStart, inst.earliestDepart) +
      p.loadBaseMin +
      p.loadPerParcelMin * depotCount;
    const departAt = clock;
    let at = 0;
    let km = 0;
    if (onboardKg > limitKg || onboardM3 > limitM3)
      fail("capacity", "start load");
    for (const stop of route.stops) {
      const request = inst.requests[stop.r];
      const node = stop.kind === "P" ? 1 + 2 * stop.r : 2 + 2 * stop.r;
      const arc = at * n + node;
      if (matrix.blocked?.[arc]) fail("blocked", request.id);
      clock +=
        matrix.time[arc] *
        (1 + p.floodSlowdown * (matrix.floodFrac?.[arc] ?? 0));
      km += matrix.km[arc];
      if (stop.kind === "P") {
        if (clock > request.windowEnd + 1e-9) fail("window", request.id);
        clock = Math.max(clock, request.windowStart) + request.pickupService;
        onboardKg += request.weightKg;
        onboardM3 += request.volumeM3;
        if (onboardKg > limitKg || onboardM3 > limitM3)
          fail("capacity", request.id);
      } else {
        if (
          request.deadline != null &&
          request.deadlineHard &&
          clock > request.deadline + 1e-9
        )
          fail("deadline", request.id);
        clock += request.deliveryService;
        onboardKg -= request.weightKg;
        onboardM3 -= request.volumeM3;
      }
      at = node;
    }
    clock += matrix.time[at * n];
    km += matrix.km[at * n];
    if (clock > p.shiftEnd + 1e-9 || clock - departAt > p.maxRouteMin + 1e-9)
      fail("shift", `return ${clock.toFixed(1)}`);
    if (truck.maxKm != null && km > truck.maxKm + 1e-9)
      fail("range", `${km.toFixed(1)} km`);
    if (Math.abs(onboardKg) > 1e-6) fail("load_not_zero", String(onboardKg));
  }

  const unassigned = new Set(plan.unassigned.map((u) => u.requestId));
  for (const request of inst.requests) {
    const times = placed.get(request.id) ?? 0;
    if (times > 1)
      out.push({ truckId: "", code: "duplicate", detail: request.id });
    if (times === 0 && !unassigned.has(request.id))
      out.push({ truckId: "", code: "dropped", detail: request.id });
    if (times === 1 && unassigned.has(request.id))
      out.push({
        truckId: "",
        code: "both_placed_and_unassigned",
        detail: request.id,
      });
  }
  return out;
}
