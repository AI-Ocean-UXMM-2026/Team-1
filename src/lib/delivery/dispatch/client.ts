/*
 * Browser-side helpers for the planner screen: calling the plan API, and turning
 * its response into plain-language, display-ready data. Pure, so the Node test
 * runner covers it. All wording about confidence and flood risk lives here so
 * the screen cannot overclaim.
 */

export type ApiStop = {
  order_id: string;
  stop_type: "pickup" | "delivery";
  seq: number;
  address: string;
  latitude: number;
  longitude: number;
  window_start_at: string | null;
  window_end_at: string | null;
  planned_arrival_at: string;
  planned_departure_at: string | null;
  slack_min: number | null;
  leg_min: number | null;
  leg_km: number | null;
  leg_flood_km: number | null;
  load_after_kg: number | null;
  reasons: string[];
};

export type ApiRoute = {
  vehicle_id: string;
  driver_id: string | null;
  display_order: number;
  planned_depart_at: string;
  planned_return_at: string;
  distance_km: number;
  travel_min: number;
  service_min: number;
  wait_min: number;
  peak_kg: number;
  cap_kg_used: number | null;
  usable_range_km: number | null;
  energy_status: "enough" | "tight" | "short" | "unknown";
  score_total: number;
  score_time: number;
  score_uncertainty: number;
  score_cost: number;
  score_flood: number;
  score_late: number;
  score_cohesion: number;
  flags: string[];
  explanation: { summary?: string };
  stops: ApiStop[];
};

export type ApiOrder = {
  order_id: string;
  pickup_address?: string;
  delivery_address?: string;
  disposition: "assigned" | "unassigned";
  vehicle_id?: string;
  unassigned_reason?: string;
  unassigned_detail?: Record<string, unknown>;
  origin_kind: "door" | "depot";
  weight_kg?: number;
  weight_source: string;
  window_source: string;
};

export type PlanResponse = {
  run: {
    id: string | null;
    revision: number | null;
    status: string;
    engineVersion: string;
    seed: number;
    iterations: number;
    runtimeMs: number;
    stopReason: string;
  };
  quality: {
    tier: "road_matrix" | "road_calibrated" | "straight_line";
    label: string;
    matrix: {
      requests: number;
      coverage: number;
      elementsBilled: number;
    } | null;
    flood: {
      status: "layer" | "reports_only" | "unknown";
      blockedArcs: number;
      exposedArcs: number;
    };
  };
  objective: { total: number; unserved: number } & Record<string, number>;
  routes: ApiRoute[];
  unassigned: ApiOrder[];
  orders: ApiOrder[];
  assumptions: { key: string; label: string; value: unknown }[];
  warnings: string[];
  excludedTrucks: { vehicleId: string; registration: string; reason: string }[];
  scheduledLater: string[];
  basis: string;
  serviceDate: string;
  today: string;
  depot: { code: string; latitude: number; longitude: number };
  trucks: { id: string; registration: string; capacityKg: number | null }[];
  simulated: boolean;
};

export type ApiError = { code: string; message: string; detail?: unknown };
export type PlanOutcome =
  | { ok: true; data: PlanResponse }
  | { ok: false; error: ApiError; status: number };

export async function requestPlan(
  body: Record<string, unknown>,
  fetchFn: typeof fetch = fetch,
): Promise<PlanOutcome> {
  try {
    const response = await fetchFn("/api/dispatch/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as
      | (PlanResponse & { error?: ApiError })
      | { error?: ApiError }
      | null;
    if (response.ok && json && !("error" in json && json.error))
      return { ok: true, data: json as PlanResponse };
    const error = (json as { error?: ApiError } | null)?.error;
    return {
      ok: false,
      status: response.status,
      error: error ?? {
        code: "unexpected_response",
        message: "The planner returned an unexpected response.",
      },
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: {
        code: "network",
        message:
          "Could not reach the planner. Check your connection and try again.",
      },
    };
  }
}

/* ---------------------------------------------------------------- wording -- */

export const REASON_COPY: Record<string, { title: string; hint: string }> = {
  missing_coordinates: {
    title: "No map pin",
    hint: "Add a pickup or delivery pin, then plan again.",
  },
  outside_service_area: {
    title: "Outside the service area",
    hint: "Confirm the address or serve it another way.",
  },
  window_passed: {
    title: "Pickup window has closed",
    hint: "Agree a new window with the customer.",
  },
  window_infeasible: {
    title: "Cannot meet its time window",
    hint: "Widen the window or add a truck earlier in the day.",
  },
  exceeds_capacity_single: {
    title: "Too big for any truck",
    hint: "Check the weight, or split the parcel.",
  },
  exceeds_range: {
    title: "Beyond a truck's fuel range",
    hint: "Refuel a truck or update its fuel level.",
  },
  exceeds_shift: {
    title: "Would end after the shift",
    hint: "Move the pickup earlier or extend the shift.",
  },
  flood_blocked: {
    title: "Blocked by a verified road report",
    hint: "Wait for the report to clear or reroute by hand.",
  },
  no_eligible_truck: {
    title: "No truck can take it",
    hint: "Check truck status and capacity.",
  },
  capacity_exhausted: {
    title: "Trucks are full",
    hint: "Add a truck, or move it to another day.",
  },
  time_exhausted: {
    title: "No time left in the day",
    hint: "Add a truck, or move it to another day.",
  },
  manager_excluded: {
    title: "Left out by a manager",
    hint: "Include it and plan again.",
  },
  stale_order: {
    title: "Changed after planning",
    hint: "Plan again to include the latest version.",
  },
  solver_budget: {
    title: "Not placed within the time budget",
    hint: "Plan again with a longer budget.",
  },
};

export const reasonCopy = (code: string | undefined) =>
  REASON_COPY[code ?? ""] ?? { title: code ?? "Not placed", hint: "" };

const WARNING_COPY: Record<string, string> = {
  straight_line:
    "Times are estimated from straight-line distance, because no road data was used.",
  flood_unknown:
    "Flood risk is unknown: no flood map or verified reports were available. This is not the same as no risk.",
  flood_layer_missing:
    "Only verified road reports were used for flooding; no flood map is loaded.",
  volume_unconstrained:
    "Some trucks have no volume set, so only weight limits their load.",
  energy_unknown:
    "Some trucks have no range or fuel level, so range was not checked for them.",
  scheduled_later:
    "Some orders have a pickup window on another day and were left out.",
};

/** Warnings arrive as "code: detail"; show our wording for the code. */
export function warningCopy(warning: string) {
  const code = warning.split(":")[0];
  return WARNING_COPY[code] ?? warning;
}

export const TRUCK_EXCLUSION_COPY: Record<string, string> = {
  not_a_truck: "Not a truck",
  no_capacity_kg: "No weight capacity set",
  status_maintenance: "In maintenance",
  status_inactive: "Inactive",
  other_depot: "Based at another depot",
};

export const WEIGHT_SOURCE_COPY: Record<string, string> = {
  declared: "declared",
  weighed: "weighed",
  size_estimate: "estimated from size",
  default_assumed: "assumed (medium)",
};

export const TIER_TONE: Record<
  PlanResponse["quality"]["tier"],
  "good" | "caution" | "warn"
> = {
  road_matrix: "good",
  road_calibrated: "caution",
  straight_line: "warn",
};

/* ------------------------------------------------------------ view model -- */

const YANGON_OFFSET_MS = 6.5 * 60 * 60 * 1000;
export const yangonTime = (iso: string) => {
  const t = new Date(new Date(iso).getTime() + YANGON_OFFSET_MS);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
};
export const minutesToLabel = (minutes: number) => {
  const m = Math.round(minutes);
  return m >= 60
    ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`
    : `${m} min`;
};

export type RouteCard = {
  vehicleId: string;
  label: string;
  letter: string;
  orders: number;
  km: number;
  depart: string;
  back: string;
  loadPct: number | null;
  peakKg: number;
  durationLabel: string;
  flags: { code: string; text: string }[];
  summary: string;
  stops: (ApiStop & {
    time: string;
    windowLabel: string | null;
    typeLabel: string;
  })[];
  score: number;
};

const FLAG_COPY: Record<string, string> = {
  waits_for_window: "Waits for a pickup window",
  flood_exposure: "Crosses a mapped flood-hazard zone (static map, not live)",
  energy_tight: "Fuel range is tight",
};

export function routeCards(
  routes: ApiRoute[],
  labelFor: (vehicleId: string) => string,
): RouteCard[] {
  return routes.map((route, index) => ({
    vehicleId: route.vehicle_id,
    label: labelFor(route.vehicle_id),
    letter: String.fromCharCode(65 + index),
    orders: new Set(route.stops.map((s) => s.order_id)).size,
    km: route.distance_km,
    depart: yangonTime(route.planned_depart_at),
    back: yangonTime(route.planned_return_at),
    loadPct: route.cap_kg_used
      ? Math.round((route.peak_kg / route.cap_kg_used) * 100)
      : null,
    peakKg: route.peak_kg,
    durationLabel: minutesToLabel(
      (new Date(route.planned_return_at).getTime() -
        new Date(route.planned_depart_at).getTime()) /
        60000,
    ),
    flags: [
      ...route.flags.map((code) => ({ code, text: FLAG_COPY[code] ?? code })),
      ...(route.energy_status === "short"
        ? [{ code: "energy_short", text: "Fuel range is short" }]
        : []),
    ],
    summary: route.explanation.summary ?? "",
    stops: route.stops.map((stop) => ({
      ...stop,
      time: yangonTime(stop.planned_arrival_at),
      windowLabel:
        stop.window_start_at && stop.window_end_at
          ? `${yangonTime(stop.window_start_at)}–${yangonTime(stop.window_end_at)}`
          : null,
      typeLabel: stop.stop_type === "pickup" ? "Pick up" : "Deliver",
    })),
    score: route.score_total,
  }));
}

export type PlanSummary = {
  routes: number;
  assigned: number;
  unassigned: number;
  km: number;
  tone: "good" | "caution" | "warn";
  tierText: string;
  mixedWeights: string;
};

export function summarize(plan: PlanResponse): PlanSummary {
  const declared = plan.orders.filter(
    (o) => o.weight_source === "declared" || o.weight_source === "weighed",
  ).length;
  const assigned = plan.orders.filter(
    (o) => o.disposition === "assigned",
  ).length;
  return {
    routes: plan.routes.length,
    assigned,
    unassigned: plan.orders.length - assigned,
    km:
      Math.round(plan.routes.reduce((sum, r) => sum + r.distance_km, 0) * 10) /
      10,
    tone: TIER_TONE[plan.quality.tier],
    tierText: plan.quality.label,
    mixedWeights: `${declared} of ${plan.orders.length} weights declared or weighed; the rest are estimates`,
  };
}

/** Which committed-state message to show for each commit_dispatch_run outcome. */
export function commitMessage(result: Record<string, unknown>): {
  kind: "done" | "stale" | "blocked" | "info";
  text: string;
} {
  if (result.committed === true)
    return {
      kind: "done",
      text: result.duplicate
        ? "Already committed. Drivers have these routes."
        : "Routes committed. Drivers can see them now.",
    };
  switch (result.reason) {
    case "stale":
      return {
        kind: "stale",
        text: "Some orders changed after this plan was made.",
      };
    case "revision_conflict":
      return {
        kind: "info",
        text: "This plan was changed elsewhere. Reload it before committing.",
      };
    case "future_date":
      return {
        kind: "info",
        text: "Plans can only be committed on their service day. Keep this draft and commit it that morning.",
      };
    case "past_date":
      return {
        kind: "info",
        text: "This plan is for a past day. Discard it and plan again.",
      };
    case "already_committed":
      return { kind: "info", text: "This plan was already committed." };
    case "routes_blocked": {
      const problems = ((result.routes as { problem: string }[]) ?? []).map(
        (r) => r.problem,
      );
      const copy: Record<string, string> = {
        missing_driver: "a truck has no driver",
        driver_unavailable: "a driver is off duty",
        driver_busy: "a driver already has a planned route that day",
        vehicle_unavailable: "a truck is not available",
        vehicle_capacity: "a truck's capacity changed",
      };
      return {
        kind: "blocked",
        text: `Cannot commit: ${[...new Set(problems)].map((p) => copy[p] ?? p).join("; ")}.`,
      };
    }
    default:
      return { kind: "info", text: "The plan was not committed." };
  }
}
