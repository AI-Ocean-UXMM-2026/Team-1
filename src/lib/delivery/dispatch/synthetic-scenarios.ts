import type { PlanResponse } from "./client.ts";
import type { FloodReport } from "./flood.ts";
import { FloodField } from "./flood.ts";
import type { PlanDataSource } from "./handler.ts";
import { handlePlan } from "./handler.ts";
import type { DepotRow, OrderRow, TruckRow } from "./inputs.ts";
import { dayStartMs, yangonDate } from "./inputs.ts";
import { buildStraightLineMatrix } from "./matrix.ts";
import { createRng } from "./rng.ts";

/*
 * Fixtures for the planner's preview mode. Every value is SYNTHETIC: invented
 * points around an invented depot, with no relation to real orders, real
 * traffic or real flooding. They run through the same handler and solver as a
 * real plan, in the browser, and are never sent to or stored in Supabase.
 */

export type SyntheticScenario = "baseline" | "flood_zone" | "closed_road";

export const SYNTHETIC_SCENARIOS: {
  id: SyntheticScenario;
  label: string;
  description: string;
}[] = [
  {
    id: "baseline",
    label: "Normal day",
    description:
      "No flooding. Shows capacity, time windows and unplaced orders.",
  },
  {
    id: "flood_zone",
    label: "Simulated flood zone",
    description:
      "A made-up hazard band crosses the middle of the map, so routes cost more through it.",
  },
  {
    id: "closed_road",
    label: "Simulated blocked road",
    description:
      "A made-up verified report blocks the road next to one delivery pin.",
  },
];

const hex = (n: number) =>
  `5e5e5e5e-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const DEPOT_ID = hex(0xdd);
const CENTER = { lat: 16.9, lng: 96.15 };

export const SYNTHETIC_DEPOT: DepotRow = {
  id: DEPOT_ID,
  code: "SYNTHETIC",
  latitude: CENTER.lat,
  longitude: CENTER.lng,
  location_status: "verified",
  is_active: true,
};

export function syntheticRows(
  scenario: SyntheticScenario,
  serviceDate: string,
) {
  const rng = createRng(2026);
  const start = dayStartMs(serviceDate);
  const at = (hour: number) => new Date(start + hour * 3600e3).toISOString();
  const windows: [number, number][] = [
    [8, 12],
    [12, 17],
    [17, 20],
  ];
  const sizes = ["small", "medium", "large"] as const;
  const pin = () => ({
    lat: CENTER.lat + (rng.next() - 0.5) * 0.12,
    lng: CENTER.lng + (rng.next() - 0.5) * 0.12,
  });

  const orders: OrderRow[] = [];
  for (let i = 1; i <= 16; i++) {
    const fromDepot = i % 4 === 0;
    const from = pin();
    const to = pin();
    const [w0, w1] = windows[i % 2 === 0 ? 0 : 1]; // keep most windows inside the shift
    const label = String(i).padStart(2, "0");
    orders.push({
      id: hex(0x100 + i),
      status: "pending",
      pickup_address: fromDepot
        ? "SYNTHETIC depot parcel"
        : `SYNTHETIC pickup ${label}`,
      pickup_latitude: fromDepot ? CENTER.lat : from.lat,
      pickup_longitude: fromDepot ? CENTER.lng : from.lng,
      delivery_address: `SYNTHETIC drop ${label}`,
      delivery_latitude: to.lat,
      delivery_longitude: to.lng,
      parcel_weight_kg: i === 3 ? 12 : null,
      cod_amount: i % 5 === 0 ? 1 : 0,
      updated_at: at(0),
      logistics: {
        origin_kind: fromDepot ? "depot" : "door",
        parcel_size: sizes[i % 3],
        weight_kg: null,
        weight_source: null,
        volume_m3: null,
        volume_source: null,
        pickup_window_start: fromDepot ? null : at(w0),
        pickup_window_end: fromDepot ? null : at(w1),
        window_source: fromDepot ? null : "parsed_description",
        delivery_deadline_at: null,
        deadline_hard: false,
        pickup_township_pcode: null,
        delivery_township_pcode: null,
        updated_at: at(0),
      },
    });
  }
  // Two orders that show why an order may not be planned.
  orders[14] = { ...orders[14], parcel_weight_kg: 5000 }; // too heavy for any truck
  orders[13] = {
    ...orders[13],
    delivery_latitude: null,
    delivery_longitude: null,
  }; // no pin

  const trucks: TruckRow[] = [300, 300, 150].map((capacity, index) => ({
    id: hex(0x900 + index + 1),
    registration_number: `SYN-TRUCK-${index + 1}`,
    vehicle_type: "truck",
    status: "available",
    capacity_kg: capacity,
    energy_source: "fuel",
    fuel_level_percent: 80,
    battery_level_percent: null,
    range_km_at_full: 400,
    reserve_percent: 15,
    profile: {
      depot_id: null,
      default_driver_id: null,
      capacity_m3: capacity / 100,
      cost_per_km_mmk: 1000,
      fixed_cost_mmk: 0,
      cost_source: "assumed",
    },
  }));

  let field: FloodField | null = null;
  const reports: FloodReport[] = [];
  if (scenario === "flood_zone") {
    const lat = CENTER.lat;
    field = new FloodField({
      features: [
        {
          properties: { hazard_class: 2 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [CENTER.lng - 0.1, lat - 0.012],
                [CENTER.lng + 0.1, lat - 0.012],
                [CENTER.lng + 0.1, lat + 0.012],
                [CENTER.lng - 0.1, lat + 0.012],
                [CENTER.lng - 0.1, lat - 0.012],
              ],
            ],
          },
        },
      ],
    });
  }
  if (scenario === "closed_road") {
    const target = orders[4];
    reports.push({
      lat: target.delivery_latitude as number,
      lng: target.delivery_longitude as number,
      severity: "blocked",
    });
  }
  return { orders, trucks, field, reports };
}

/** Runs the real handler and solver in the browser over synthetic rows. */
export async function runSyntheticPlan(
  scenario: SyntheticScenario,
  now: Date = new Date(),
): Promise<PlanResponse> {
  const serviceDate = yangonDate(now);
  const rows = syntheticRows(scenario, serviceDate);
  // The clock is pinned to 01:00 on the service day so the shift is ahead of us.
  const simulatedNow = new Date(dayStartMs(serviceDate) + 3600e3);
  const source: PlanDataSource = {
    loadDepot: async () => SYNTHETIC_DEPOT,
    loadTrucks: async () => rows.trucks,
    loadOrders: async () => rows.orders,
    loadFlood: async () => ({ field: rows.field, layerId: null }),
    loadReports: async () => rows.reports,
    save: async () => {
      throw new Error("Synthetic plans are never saved");
    },
  };
  const result = await handlePlan(
    {
      depotId: DEPOT_ID,
      serviceDate,
      mode: "preview",
      matrixPolicy: "no_network",
      paramsOverride: { deadlineMs: 1500, maxIterations: 600 },
    },
    {
      role: "manager",
      source,
      now: simulatedNow,
      newKey: () => hex(0xffff),
      makeDeps: () => ({
        nowMs: () => Date.now(),
        buildMatrix: async (points, params) => ({
          matrix: buildStraightLineMatrix(points, params),
          stats: null,
        }),
      }),
    },
  );
  if (result.status !== 200)
    throw new Error("Could not build the synthetic plan");
  const body = result.body as PlanResponse;
  return {
    ...body,
    simulated: true,
    depot: { ...body.depot, code: "SYNTHETIC" },
  };
}
