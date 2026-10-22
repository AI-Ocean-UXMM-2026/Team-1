import { haversineKilometers } from "./intelligence.ts";
import { isPrepaid, type PaymentMethod } from "./payment-methods.ts";

/** Placeholder rates in MMK until the business sets real ones. */
export const FEE_RULES = {
  base: 1500,
  perKm: 400,
  /** Distance covered by the base fee. */
  includedKm: 2,
  perKgOver: 300,
  includedKg: 3,
  urgent: 1500,
  /** Cash handling and the rider's return trip to settle. */
  codHandling: 500,
  /** Roads are longer than a straight line between two points. */
  roadFactor: 1.3,
  roundTo: 100,
} as const;

export type FeeLine = {
  id: "base" | "distance" | "weight" | "urgent" | "cod";
  label: string;
  amount: number;
};

export type FeeEstimate = {
  lines: FeeLine[];
  total: number;
  distanceKm: number;
};

const roundUp = (value: number, step: number) => Math.ceil(value / step) * step;

export const PARCEL_WEIGHT_KG = { Small: 1, Medium: 4, Large: 10 } as const;

/** Estimated road distance from two points, or null if either is missing. */
export function roadDistanceKm(
  from: { latitude: number; longitude: number } | null | undefined,
  to: { latitude: number; longitude: number } | null | undefined,
) {
  if (!from || !to) return null;
  return haversineKilometers(from, to) * FEE_RULES.roadFactor;
}

export function estimateDeliveryFee(
  input: {
    distanceKm: number;
    weightKg?: number;
    method: PaymentMethod;
    urgent?: boolean;
  },
  rules = FEE_RULES,
): FeeEstimate {
  const distanceKm = Math.max(0, input.distanceKm);
  const weightKg = Math.max(0, input.weightKg ?? 0);
  const lines: FeeLine[] = [
    { id: "base", label: "Base fee", amount: rules.base },
  ];
  const extraKm = Math.max(0, distanceKm - rules.includedKm);
  if (extraKm > 0)
    lines.push({
      id: "distance",
      label: `Distance (${extraKm.toFixed(1)} km extra)`,
      amount: roundUp(extraKm * rules.perKm, rules.roundTo),
    });
  const extraKg = Math.max(0, weightKg - rules.includedKg);
  if (extraKg > 0)
    lines.push({
      id: "weight",
      label: `Weight (${Math.ceil(extraKg)} kg extra)`,
      amount: Math.ceil(extraKg) * rules.perKgOver,
    });
  if (input.urgent)
    lines.push({ id: "urgent", label: "Urgent", amount: rules.urgent });
  if (!isPrepaid(input.method))
    lines.push({
      id: "cod",
      label: "Cash handling",
      amount: rules.codHandling,
    });
  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    distanceKm,
  };
}
