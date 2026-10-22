import type {
  DispatchParams,
  Instance,
  Request,
  Truck,
  UnassignedReason,
} from "./types.ts";

/*
 * Turns database rows into a solver Instance. Nothing is invented silently:
 * every weight, volume and window carries its source, and an order that cannot
 * be planned is returned with a reason code instead of being dropped.
 */

const YANGON_OFFSET_MS = 6.5 * 60 * 60 * 1000;

export type DepotRow = {
  id: string;
  code: string;
  latitude: number | null;
  longitude: number | null;
  location_status: string;
  is_active: boolean;
};

export type LogisticsRow = {
  origin_kind: string;
  parcel_size: string | null;
  weight_kg: number | null;
  weight_source: string | null;
  volume_m3: number | null;
  volume_source: string | null;
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  window_source: string | null;
  delivery_deadline_at: string | null;
  deadline_hard: boolean;
  pickup_township_pcode: string | null;
  delivery_township_pcode: string | null;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  status: string;
  pickup_address: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  delivery_address: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  parcel_weight_kg: number | null;
  cod_amount: number;
  traffic_delay_minutes?: number | null;
  updated_at: string;
  logistics: LogisticsRow | null;
};

export type TruckRow = {
  id: string;
  registration_number: string;
  vehicle_type: string;
  status: string;
  capacity_kg: number | null;
  energy_source: string;
  fuel_level_percent: number | null;
  battery_level_percent: number | null;
  range_km_at_full: number | null;
  reserve_percent: number;
  profile: {
    depot_id: string | null;
    default_driver_id: string | null;
    capacity_m3: number | null;
    cost_per_km_mmk: number | null;
    fixed_cost_mmk: number | null;
    cost_source: string;
  } | null;
};

export type RequestMeta = {
  orderId: string;
  pickupAddress: string;
  deliveryAddress: string;
  orderUpdatedAt: string;
  logisticsUpdatedAt: string | null;
  weightSource: "declared" | "weighed" | "size_estimate" | "default_assumed";
  volumeSource: "declared" | "measured" | "size_estimate" | "default_assumed";
  windowSource: "declared" | "parsed_description" | "default_assumed";
  windowStart: number;
  windowEnd: number;
  originKind: "door" | "depot";
  pickupTownship: string | null;
  deliveryTownship: string | null;
  deadlineHard: boolean;
};

export type PreExcluded = {
  orderId: string;
  reason: UnassignedReason;
  detail: Record<string, unknown>;
  meta: Omit<RequestMeta, "windowStart" | "windowEnd"> & {
    windowStart: number | null;
    windowEnd: number | null;
  };
};

export type BuildInstanceResult = {
  instance: Instance;
  metas: RequestMeta[];
  preExcluded: PreExcluded[];
  /** Door orders whose pickup window falls on a later day. Not an error. */
  scheduledLater: string[];
  excludedTrucks: { vehicleId: string; registration: string; reason: string }[];
  truckMeta: Map<
    string,
    {
      row: TruckRow;
      energyKnown: boolean;
      usableKm: number | null;
      volumeKnown: boolean;
    }
  >;
  counts: Record<string, number>;
  warnings: string[];
  dayStartMs: number;
};

export const dayStartMs = (serviceDate: string) => {
  const [y, m, d] = serviceDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - YANGON_OFFSET_MS;
};

export const yangonDate = (at: Date) =>
  new Date(at.getTime() + YANGON_OFFSET_MS).toISOString().slice(0, 10);

const toMinutes = (iso: string, startMs: number) =>
  (Date.parse(iso) - startMs) / 60000;

/** Usable range after the reserve: range x (level - reserve) / 100. */
export function usableRangeKm(truck: TruckRow): number | null {
  if (truck.range_km_at_full == null) return null;
  const fuel = truck.fuel_level_percent;
  const battery = truck.battery_level_percent;
  const level =
    truck.energy_source === "electric"
      ? battery
      : truck.energy_source === "hybrid"
        ? fuel == null && battery == null
          ? null
          : Math.max(fuel ?? 0, battery ?? 0)
        : fuel;
  if (level == null) return null;
  return Math.max(
    0,
    (truck.range_km_at_full * (level - truck.reserve_percent)) / 100,
  );
}

type Size = "small" | "medium" | "large";

export function buildInstance(input: {
  depot: DepotRow;
  serviceDate: string;
  now: Date;
  orders: OrderRow[];
  trucks: TruckRow[];
  params: DispatchParams;
}): BuildInstanceResult {
  const { depot, serviceDate, now, params } = input;
  if (depot.latitude == null || depot.longitude == null)
    throw new Error("Depot has no coordinates");
  const startMs = dayStartMs(serviceDate);
  const today = yangonDate(now) === serviceDate;
  const earliestDepart = today
    ? Math.max(
        params.shiftStart,
        (now.getTime() - startMs) / 60000 + params.dispatchLeadMin,
      )
    : params.shiftStart;

  const counts: Record<string, number> = {
    weight_declared: 0,
    weight_weighed: 0,
    weight_size_estimate: 0,
    weight_default_assumed: 0,
    window_declared: 0,
    window_parsed: 0,
    window_default_assumed: 0,
  };
  const warnings: string[] = [];
  const requests: Request[] = [];
  const metas: RequestMeta[] = [];
  const preExcluded: PreExcluded[] = [];
  const scheduledLater: string[] = [];

  for (const order of [...input.orders].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const l = order.logistics;
    const origin = (l?.origin_kind === "depot" ? "depot" : "door") as
      | "door"
      | "depot";
    const size = (l?.parcel_size ?? "medium") as Size;

    // Weight: weighed/declared on the order, then a legacy declared weight,
    // then a size-class estimate, then the medium default. Never silent.
    let weightKg: number;
    let weightSource: RequestMeta["weightSource"];
    if (l?.weight_kg != null && l.weight_source) {
      weightKg = l.weight_kg;
      weightSource = l.weight_source as "declared" | "weighed";
    } else if (order.parcel_weight_kg != null) {
      weightKg = order.parcel_weight_kg;
      weightSource = "declared";
    } else if (l?.parcel_size) {
      weightKg = params.sizeKg[size];
      weightSource = "size_estimate";
    } else {
      weightKg = params.sizeKg.medium;
      weightSource = "default_assumed";
    }
    let volumeM3: number;
    let volumeSource: RequestMeta["volumeSource"];
    if (l?.volume_m3 != null && l.volume_source) {
      volumeM3 = l.volume_m3;
      volumeSource = l.volume_source as "declared" | "measured";
    } else if (l?.parcel_size) {
      volumeM3 = params.sizeM3[size];
      volumeSource = "size_estimate";
    } else {
      volumeM3 = params.sizeM3.medium;
      volumeSource = "default_assumed";
    }

    // Pickup window in minutes since local midnight of the service date.
    let windowStart = params.shiftStart;
    let windowEnd = params.shiftEnd;
    let windowSource: RequestMeta["windowSource"] = "default_assumed";
    if (origin === "door" && l?.pickup_window_start && l.pickup_window_end) {
      windowStart = toMinutes(l.pickup_window_start, startMs);
      windowEnd = toMinutes(l.pickup_window_end, startMs);
      windowSource =
        l.window_source === "declared" ? "declared" : "parsed_description";
    }

    const meta: PreExcluded["meta"] = {
      orderId: order.id,
      pickupAddress: order.pickup_address,
      deliveryAddress: order.delivery_address,
      orderUpdatedAt: order.updated_at,
      logisticsUpdatedAt: l?.updated_at ?? null,
      weightSource,
      volumeSource,
      windowSource,
      windowStart: origin === "door" ? windowStart : null,
      windowEnd: origin === "door" ? windowEnd : null,
      originKind: origin,
      pickupTownship: l?.pickup_township_pcode ?? null,
      deliveryTownship: l?.delivery_township_pcode ?? null,
      deadlineHard: l?.deadline_hard ?? false,
    };
    const exclude = (
      reason: UnassignedReason,
      detail: Record<string, unknown> = {},
    ) => preExcluded.push({ orderId: order.id, reason, detail, meta });

    const hasDelivery =
      order.delivery_latitude != null && order.delivery_longitude != null;
    const hasPickup =
      order.pickup_latitude != null && order.pickup_longitude != null;
    if (!hasDelivery || (origin === "door" && !hasPickup)) {
      exclude("missing_coordinates", {
        missing: [
          !hasPickup && origin === "door" ? "pickup" : null,
          !hasDelivery ? "delivery" : null,
        ].filter(Boolean),
      });
      continue;
    }
    if (origin === "door" && windowStart >= 1440) {
      scheduledLater.push(order.id);
      continue;
    }
    if (origin === "door" && windowEnd <= 0) {
      exclude("window_passed", { window_end_minutes: windowEnd });
      continue;
    }
    if (origin === "door" && windowSource !== "default_assumed") {
      // Clip a window that straddles midnight to this service day.
      windowStart = Math.max(0, windowStart);
      windowEnd = Math.min(1440, windowEnd);
    }

    const deadline = l?.delivery_deadline_at
      ? toMinutes(l.delivery_deadline_at, startMs)
      : origin === "door"
        ? Math.min(params.shiftEnd, windowEnd + params.defaultDeadlineSlackMin)
        : null;

    const extra = params.serviceExtraMin;
    requests.push({
      id: order.id,
      origin,
      pickup:
        origin === "door"
          ? {
              lat: order.pickup_latitude as number,
              lng: order.pickup_longitude as number,
            }
          : null,
      delivery: {
        lat: order.delivery_latitude as number,
        lng: order.delivery_longitude as number,
      },
      weightKg,
      volumeM3,
      windowStart,
      windowEnd,
      deadline,
      deadlineHard: l?.delivery_deadline_at ? l.deadline_hard : false,
      pickupService: 6 + extra[size],
      deliveryService: 5 + extra[size] + (order.cod_amount > 0 ? extra.cod : 0),
      pickupTownship: l?.pickup_township_pcode ?? null,
      deliveryTownship: l?.delivery_township_pcode ?? null,
    });
    metas.push({ ...meta, windowStart, windowEnd });
    counts[`weight_${weightSource}`]++;
    counts[
      windowSource === "parsed_description"
        ? "window_parsed"
        : `window_${windowSource}`
    ]++;
  }

  const trucks: Truck[] = [];
  const excludedTrucks: BuildInstanceResult["excludedTrucks"] = [];
  const truckMeta: BuildInstanceResult["truckMeta"] = new Map();
  for (const row of [...input.trucks].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const why =
      row.vehicle_type !== "truck"
        ? "not_a_truck"
        : !["available", "in_use"].includes(row.status)
          ? `status_${row.status}`
          : row.capacity_kg == null
            ? "no_capacity_kg"
            : row.profile?.depot_id && row.profile.depot_id !== depot.id
              ? "other_depot"
              : null;
    if (why) {
      excludedTrucks.push({
        vehicleId: row.id,
        registration: row.registration_number,
        reason: why,
      });
      continue;
    }
    const usableKm = usableRangeKm(row);
    const volumeKnown = row.profile?.capacity_m3 != null;
    trucks.push({
      id: row.id,
      capKg: row.capacity_kg as number,
      capM3: row.profile?.capacity_m3 ?? Number.POSITIVE_INFINITY,
      costPerKm: row.profile?.cost_per_km_mmk ?? params.defaultCostPerKm,
      fixedCost: row.profile?.fixed_cost_mmk ?? 0,
      maxKm: usableKm,
    });
    truckMeta.set(row.id, {
      row,
      energyKnown: usableKm != null,
      usableKm,
      volumeKnown,
    });
  }
  if (trucks.some((t) => !Number.isFinite(t.capM3)))
    warnings.push(
      "volume_unconstrained: some trucks have no capacity_m3, so only weight limits their load",
    );
  if (trucks.some((t) => t.maxKm == null))
    warnings.push(
      "energy_unknown: some trucks have no range or fuel level, so no range limit was applied",
    );

  return {
    instance: {
      synthetic: false,
      label: `Dispatch ${serviceDate}`,
      depot: { lat: depot.latitude, lng: depot.longitude },
      trucks,
      requests,
      earliestDepart,
      params,
    },
    metas,
    preExcluded,
    scheduledLater,
    excludedTrucks,
    truckMeta,
    counts,
    warnings,
    dayStartMs: startMs,
  };
}
