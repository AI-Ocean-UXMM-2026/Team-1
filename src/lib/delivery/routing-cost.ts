import { signalDelayMin } from "./signal-index.ts";

/**
 * One vocabulary for what a stretch of road costs, shared by the dispatch
 * solver (macro: which truck takes which order) and street-level navigation
 * (micro: which road to drive). Time, money and risk stay separate until a
 * caller combines them with explicit weights, so the two layers can disagree
 * about priorities without disagreeing about the facts.
 */
export interface RoutingCost {
  durationSeconds: number;
  distanceMeters: number;
  operatingCostMMK: number;
  /** Soft penalty for risk that is not already in the duration. */
  riskPenaltySeconds: number;
  /** 0..1: how much of this figure comes from measured road data. */
  confidence: number;
  /** A hard constraint: the leg must not be used. */
  blocked: boolean;
}

export const ZERO_COST: RoutingCost = {
  durationSeconds: 0,
  distanceMeters: 0,
  operatingCostMMK: 0,
  riskPenaltySeconds: 0,
  confidence: 1,
  blocked: false,
};

export function addCosts(a: RoutingCost, b: RoutingCost): RoutingCost {
  return {
    durationSeconds: a.durationSeconds + b.durationSeconds,
    distanceMeters: a.distanceMeters + b.distanceMeters,
    operatingCostMMK: a.operatingCostMMK + b.operatingCostMMK,
    riskPenaltySeconds: a.riskPenaltySeconds + b.riskPenaltySeconds,
    confidence: Math.min(a.confidence, b.confidence),
    blocked: a.blocked || b.blocked,
  };
}

export type ObjectiveWeights = {
  /** Score minutes per minute of driving. */
  time: number;
  /** MMK that is worth one score minute. */
  mmkPerScoreMinute: number;
  /** Score minutes per minute of risk penalty. */
  risk: number;
};

export const DEFAULT_OBJECTIVE: ObjectiveWeights = {
  time: 1,
  mmkPerScoreMinute: 100,
  risk: 1,
};

/**
 * Collapse a cost into the single number used to compare candidates, in score
 * minutes. A blocked leg is infinite so no weighting can make it attractive.
 */
export function scoreCost(
  cost: RoutingCost,
  weights: ObjectiveWeights = DEFAULT_OBJECTIVE,
): number {
  if (cost.blocked) return Number.POSITIVE_INFINITY;
  return (
    (cost.durationSeconds / 60) * weights.time +
    cost.operatingCostMMK / weights.mmkPerScoreMinute +
    (cost.riskPenaltySeconds / 60) * weights.risk
  );
}

/** Minutes of red-light wait, slow-down and pull-away at one signal. */
export const signalCostMin = signalDelayMin;

/** A road report as either layer holds it; every field the pricing needs. */
export type PricedReport = {
  category: string;
  severity: string;
  status?: string;
  expires_at?: string;
  decision?: {
    action: "avoid" | "delay" | "monitor" | "ignore";
    severity: string;
    delayMinutes: number;
    radiusMeters: number;
    expiresAt?: string;
  } | null;
};

export type ReportPrice = {
  /** Soft delay in minutes. Zero for a blocked report; the block is the cost. */
  delayMin: number;
  /** Closed, per the engine's decision or a raw closure report. */
  blocked: boolean;
  /** Heavy enough that a rider should be steered around it. */
  serious: boolean;
  /** How close the path must pass for the report to apply, in km. */
  reachKm: number;
};

/** Reach, in km, of a report with no engine decision, measured to a true path. */
export const RAW_REPORT_REACH_KM = 0.055;

/**
 * What a road report costs a vehicle that passes it. A report the road
 * intelligence engine has judged is priced by that judgement; otherwise by
 * its category and severity. Null when the report no longer applies
 * (rejected, expired, or judged ignorable). Navigation and dispatch both
 * price reports here so a closure or jam looks the same to both.
 */
export function priceRoadReport(
  report: PricedReport,
  nowMs: number,
): ReportPrice | null {
  if (report.status === "rejected") return null;
  if (report.expires_at && Date.parse(report.expires_at) <= nowMs) return null;
  const decision =
    report.decision &&
    (!report.decision.expiresAt ||
      Date.parse(report.decision.expiresAt) > nowMs)
      ? report.decision
      : null;
  if (decision?.action === "ignore") return null;

  if (decision) {
    const blocked =
      decision.action === "avoid" && decision.severity === "blocked";
    return {
      delayMin: blocked
        ? 0
        : decision.action === "avoid"
          ? // Heavy enough to prefer a detour, not a hard block
            Math.max(8, decision.delayMinutes)
          : decision.action === "delay"
            ? decision.delayMinutes
            : 0,
      blocked,
      serious:
        decision.action === "avoid" ||
        (decision.action === "delay" && decision.delayMinutes >= 5),
      reachKm: decision.radiusMeters / 1000,
    };
  }

  if (report.category === "closure")
    return {
      delayMin: 0,
      blocked: true,
      serious: true,
      reachKm: RAW_REPORT_REACH_KM,
    };
  const delayMin =
    report.category === "congestion"
      ? report.severity === "high"
        ? 4.5
        : report.severity === "medium"
          ? 2.5
          : 1.5
      : report.severity === "high"
        ? 3.5
        : 2.0;
  return {
    delayMin,
    blocked: false,
    serious: false,
    reachKm: RAW_REPORT_REACH_KM,
  };
}
