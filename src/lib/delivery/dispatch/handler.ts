import type { FloodField, FloodReport } from "./flood.ts";
import type { DepotRow, OrderRow, TruckRow } from "./inputs.ts";
import { yangonDate } from "./inputs.ts";
import type { PlanDeps, PlanErrorCode, SavePayload } from "./plan.ts";
import { MAX_ORDERS, planDispatch } from "./plan.ts";
import type { DispatchParams } from "./types.ts";

/*
 * Request handling for POST /api/dispatch/plan, kept free of Next.js and
 * Supabase imports so it runs under the Node test runner. The route handler
 * supplies the data source (reads under the signed-in manager's RLS) and the
 * Mapbox-backed matrix builder.
 */

export type PlanRequest = {
  depotId: string;
  serviceDate: string;
  orderIds?: string[];
  vehicleIds?: string[];
  driverByVehicle?: Record<string, string | null>;
  mode: "preview" | "persist";
  seed?: number;
  budgetMs?: number;
  matrixPolicy: "auto" | "no_network";
  paramsOverride?: Partial<DispatchParams>;
  replaceDraft: boolean;
  clientKey?: string;
};

export type SaveOutcome =
  | {
      saved: true;
      duplicate: boolean;
      run_id: string;
      revision: number;
      status: string;
    }
  | { saved: false; reason: string; run_id?: string };

export interface PlanDataSource {
  loadDepot(id: string): Promise<DepotRow | null>;
  loadTrucks(ids: string[] | undefined): Promise<TruckRow[]>;
  loadOrders(ids: string[] | undefined, limit: number): Promise<OrderRow[]>;
  loadFlood(): Promise<{ field: FloodField | null; layerId: string | null }>;
  loadReports(now: Date): Promise<FloodReport[]>;
  save(
    payload: SavePayload,
    clientKey: string,
    replaceDraft: boolean,
  ): Promise<SaveOutcome>;
}

export type HandlerContext = {
  /** Role of the signed-in user, or null when not signed in. */
  role: string | null;
  source: PlanDataSource;
  makeDeps: (policy: PlanRequest["matrixPolicy"]) => PlanDeps;
  now: Date;
  newKey: () => string;
};

export type HandlerResponse = { status: number; body: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Tunables a manager may override, with hard bounds. Anything else is rejected. */
const OVERRIDES: Record<string, [number, number]> = {
  maxIterations: [50, 20000],
  deadlineMs: [500, 8000],
  seed: [0, 2 ** 31],
  utilisation: [0.5, 1],
  truckTimeFactor: [0.5, 3],
  trafficMultiplier: [0.5, 3],
  speedKmh: [5, 60],
  maxMatrixRequests: [0, 55],
  maxMatrixElements: [0, 40000],
  mmkPerScoreMinute: [1, 100000],
  defaultCostPerKm: [0, 100000],
};

const fail = (
  status: number,
  code: string,
  message: string,
  detail?: unknown,
): HandlerResponse => ({
  status,
  body: {
    error: { code, message, ...(detail === undefined ? {} : { detail }) },
  },
});

export function parsePlanRequest(
  raw: unknown,
): { ok: true; value: PlanRequest } | { ok: false; message: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false, message: "Body must be a JSON object" };
  const b = raw as Record<string, unknown>;
  if (typeof b.depotId !== "string" || !UUID.test(b.depotId))
    return { ok: false, message: "depotId must be a uuid" };
  if (
    typeof b.serviceDate !== "string" ||
    !DATE.test(b.serviceDate) ||
    Number.isNaN(Date.parse(b.serviceDate))
  )
    return { ok: false, message: "serviceDate must be YYYY-MM-DD" };
  const ids = (key: string, max: number) => {
    const value = b[key];
    if (value === undefined) return undefined;
    if (
      !Array.isArray(value) ||
      value.length > max ||
      !value.every((v) => typeof v === "string" && UUID.test(v))
    )
      throw new Error(`${key} must be an array of at most ${max} uuids`);
    return value as string[];
  };
  try {
    const mode = b.mode === undefined ? "preview" : b.mode;
    if (mode !== "preview" && mode !== "persist")
      return { ok: false, message: "mode must be preview or persist" };
    const policy = b.matrixPolicy === undefined ? "auto" : b.matrixPolicy;
    if (policy !== "auto" && policy !== "no_network")
      return { ok: false, message: "matrixPolicy must be auto or no_network" };
    if (
      b.clientKey !== undefined &&
      (typeof b.clientKey !== "string" || !UUID.test(b.clientKey))
    )
      return { ok: false, message: "clientKey must be a uuid" };
    if (b.seed !== undefined && !Number.isInteger(b.seed))
      return { ok: false, message: "seed must be an integer" };
    if (
      b.budgetMs !== undefined &&
      (typeof b.budgetMs !== "number" || !(b.budgetMs > 0))
    )
      return { ok: false, message: "budgetMs must be a positive number" };

    let paramsOverride: Partial<DispatchParams> | undefined;
    if (b.paramsOverride !== undefined) {
      if (
        b.paramsOverride == null ||
        typeof b.paramsOverride !== "object" ||
        Array.isArray(b.paramsOverride)
      )
        return { ok: false, message: "paramsOverride must be an object" };
      paramsOverride = {};
      for (const [key, value] of Object.entries(b.paramsOverride)) {
        const bounds = OVERRIDES[key];
        if (!bounds)
          return {
            ok: false,
            message: `paramsOverride.${key} is not adjustable`,
          };
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < bounds[0] ||
          value > bounds[1]
        )
          return {
            ok: false,
            message: `paramsOverride.${key} must be between ${bounds[0]} and ${bounds[1]}`,
          };
        (paramsOverride as Record<string, number>)[key] = value;
      }
    }
    let driverByVehicle: Record<string, string | null> | undefined;
    if (b.driverByVehicle !== undefined) {
      const entries = Object.entries(
        (b.driverByVehicle ?? {}) as Record<string, unknown>,
      );
      if (
        !entries.every(
          ([k, v]) =>
            UUID.test(k) &&
            (v === null || (typeof v === "string" && UUID.test(v))),
        )
      )
        return {
          ok: false,
          message:
            "driverByVehicle must map vehicle uuids to driver uuids or null",
        };
      driverByVehicle = Object.fromEntries(entries) as Record<
        string,
        string | null
      >;
    }
    return {
      ok: true,
      value: {
        depotId: b.depotId,
        serviceDate: b.serviceDate,
        orderIds: ids("orderIds", 200),
        vehicleIds: ids("vehicleIds", 20),
        driverByVehicle,
        mode,
        seed: b.seed as number | undefined,
        budgetMs: b.budgetMs as number | undefined,
        matrixPolicy: policy,
        paramsOverride,
        replaceDraft: b.replaceDraft === true,
        clientKey: b.clientKey as string | undefined,
      },
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

const ERROR_STATUS: Record<PlanErrorCode, number> = {
  depot_unverified: 409,
  no_open_orders: 422,
  no_eligible_trucks: 422,
  too_many_orders: 422,
  internal_invalid_plan: 500,
};

export async function handlePlan(
  raw: unknown,
  ctx: HandlerContext,
): Promise<HandlerResponse> {
  if (ctx.role == null)
    return fail(401, "unauthenticated", "Sign in to plan routes");
  if (ctx.role !== "manager")
    return fail(403, "forbidden", "Only managers can plan routes");

  const parsed = parsePlanRequest(raw);
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  const req = parsed.value;

  const depot = await ctx.source.loadDepot(req.depotId);
  if (!depot || !depot.is_active)
    return fail(404, "depot_not_found", "Depot not found");
  if (depot.location_status !== "verified" || depot.latitude == null)
    return fail(
      409,
      "depot_unverified",
      "Confirm the depot location before planning routes",
    );

  const [trucks, orders, flood, reports] = await Promise.all([
    ctx.source.loadTrucks(req.vehicleIds),
    ctx.source.loadOrders(req.orderIds, MAX_ORDERS + 1),
    ctx.source.loadFlood(),
    ctx.source.loadReports(ctx.now),
  ]);

  const driverByVehicle: Record<string, string | null> = {};
  for (const truck of trucks)
    driverByVehicle[truck.id] = truck.profile?.default_driver_id ?? null;
  Object.assign(driverByVehicle, req.driverByVehicle ?? {});

  const params: Partial<DispatchParams> = { ...req.paramsOverride };
  if (req.seed !== undefined) params.seed = req.seed;
  if (req.budgetMs !== undefined)
    params.deadlineMs = Math.min(req.budgetMs, 8000);

  const result = await planDispatch(
    {
      depot,
      serviceDate: req.serviceDate,
      now: ctx.now,
      orders,
      trucks,
      driverByVehicle,
      params,
      field: flood.field,
      reports,
    },
    ctx.makeDeps(req.matrixPolicy),
  );
  if (!result.ok)
    return fail(
      ERROR_STATUS[result.code],
      result.code,
      result.message,
      result.detail,
    );

  let run: Record<string, unknown> = {
    id: null,
    revision: null,
    status: "preview",
    engineVersion: result.payload.engine_version,
    seed: result.payload.seed,
    iterations: result.payload.iterations,
    runtimeMs: result.payload.runtime_ms,
    stopReason: result.payload.stop_reason,
  };
  if (req.mode === "persist") {
    const outcome = await ctx.source.save(
      result.payload,
      req.clientKey ?? ctx.newKey(),
      req.replaceDraft,
    );
    if (!outcome.saved) {
      return outcome.reason === "draft_exists"
        ? fail(
            409,
            "draft_exists",
            "A draft plan already exists for this depot and day",
            { run_id: outcome.run_id },
          )
        : outcome.reason === "depot_unverified"
          ? fail(
              409,
              "depot_unverified",
              "Confirm the depot location before planning routes",
            )
          : fail(
              500,
              "save_failed",
              `Could not save the plan: ${outcome.reason}`,
            );
    }
    run = {
      ...run,
      id: outcome.run_id,
      revision: outcome.revision,
      status: outcome.status,
    };
  }

  return {
    status: 200,
    body: {
      run,
      quality: result.quality,
      objective: {
        total: result.payload.score_total,
        ...(result.payload.score_breakdown as object),
      },
      routes: result.payload.routes,
      unassigned: result.payload.orders.filter(
        (o) => (o as { disposition: string }).disposition === "unassigned",
      ),
      orders: result.payload.orders,
      assumptions: result.assumptions,
      warnings: result.warnings,
      excludedTrucks: result.excludedTrucks,
      scheduledLater: result.scheduledLater,
      basis: result.basis,
      serviceDate: req.serviceDate,
      trucks: trucks.map((t) => ({
        id: t.id,
        registration: t.registration_number,
        capacityKg: t.capacity_kg,
      })),
      depot: {
        code: depot.code,
        latitude: depot.latitude,
        longitude: depot.longitude,
      },
      today: yangonDate(ctx.now),
      simulated: false,
    },
  };
}
