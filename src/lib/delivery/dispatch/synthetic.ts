import { DEFAULT_PARAMS } from "./params.ts";
import { createRng } from "./rng.ts";
import type { DispatchParams, Instance, Request, Truck } from "./types.ts";

export type SyntheticOptions = {
  seed: number;
  orders: number;
  trucks: number;
  /** Share of orders already at the depot (0..1). */
  depotShare?: number;
  params?: Partial<DispatchParams>;
};

/** Pickup windows from the customer form: Morning 8-12, Afternoon 12-5, Evening 5-8. */
const WINDOWS: [number, number][] = [
  [8 * 60, 12 * 60],
  [12 * 60, 17 * 60],
  [17 * 60, 20 * 60],
];
const SIZES = [
  { kg: 2, m3: 0.015, service: 0 },
  { kg: 8, m3: 0.06, service: 1 },
  { kg: 20, m3: 0.15, service: 3 },
];

/**
 * A reproducible fixture: random points on a 6 x 6 grid of fake "townships"
 * around a made-up depot. SYNTHETIC: not Yangon data, not the real Mingalardone
 * pin, never written to Supabase.
 */
export function generateSynthetic(options: SyntheticOptions): Instance {
  const rng = createRng(options.seed);
  const params = { ...DEFAULT_PARAMS, seed: options.seed, ...options.params };
  const depot = { lat: 16.9, lng: 96.15 };
  const cell = 0.03;
  const point = () => {
    const gx = rng.int(6);
    const gy = rng.int(6);
    return {
      point: {
        lat: depot.lat + (gy - 2.5) * cell + (rng.next() - 0.5) * cell,
        lng: depot.lng + (gx - 2.5) * cell + (rng.next() - 0.5) * cell,
      },
      township: `SYN-${gy}${gx}`,
    };
  };

  const trucks: Truck[] = Array.from({ length: options.trucks }, (_, i) => ({
    id: `SYN-TRUCK-${i + 1}`,
    capKg: 150 + (i % 2) * 100,
    capM3: 1.5 + (i % 2) * 1,
    costPerKm: 1000,
    fixedCost: 0,
    maxKm: null,
  }));

  const requests: Request[] = [];
  for (let i = 0; i < options.orders; i++) {
    const size = SIZES[rng.int(3)];
    const fromDepot = rng.next() < (options.depotShare ?? 0.25);
    const drop = point();
    const pick = fromDepot ? null : point();
    const [a, b] = WINDOWS[rng.int(3)];
    requests.push({
      id: `SYN-${String(i + 1).padStart(3, "0")}`,
      origin: fromDepot ? "depot" : "door",
      pickup: pick?.point ?? null,
      delivery: drop.point,
      weightKg: size.kg,
      volumeM3: size.m3,
      windowStart: a,
      windowEnd: b,
      deadline: fromDepot
        ? params.shiftEnd
        : Math.min(params.shiftEnd, b + 240),
      deadlineHard: false,
      pickupService: 6 + size.service,
      deliveryService: 5 + size.service,
      pickupTownship: pick?.township ?? null,
      deliveryTownship: drop.township,
    });
  }
  return {
    synthetic: true,
    label: "SYNTHETIC DATA: not Yangon, not real orders",
    depot,
    trucks,
    requests,
    earliestDepart: params.shiftStart,
    params,
  };
}
