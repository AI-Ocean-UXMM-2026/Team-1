export type RoadCategory =
  | "congestion"
  | "closure"
  | "roadwork"
  | "flooding"
  | "hazard";
export type RoadSeverity = "low" | "medium" | "high" | "blocked";
export type RoadAction = "avoid" | "delay" | "monitor" | "ignore";

/** A driver-written note about the road, as stored in `road_reports`. */
export type RoadNote = {
  id: string;
  driverId: string;
  category: RoadCategory;
  severity: RoadSeverity;
  description: string;
  latitude: number;
  longitude: number;
  reportedAt: string;
  expiresAt: string;
  status: "pending" | "verified" | "rejected";
};

/** Observed driving speed in one ~110 m grid cell, aggregated across riders. */
export type SpeedCell = {
  latitude: number;
  longitude: number;
  samples: number;
  drivers: number;
  medianSpeedKmh: number;
};

/** What the engine concluded about a note, and how routing should treat it. */
export type RoadDecision = {
  reportId: string;
  action: RoadAction;
  category: RoadCategory;
  severity: RoadSeverity;
  /** 0–1: how sure the engine is that the note describes a real, current hazard. */
  confidence: number;
  /** Extra minutes a vehicle should expect when it drives through. */
  delayMinutes: number;
  /** How far from the note the effect reaches. */
  radiusMeters: number;
  expiresAt: string;
  rationale: string;
  evidence: Record<string, unknown>;
  source: "agent" | "heuristic";
  model: string | null;
};

/** The routing-facing slice of a decision, carried on a road report. */
export type AttachedDecision = Pick<
  RoadDecision,
  | "action"
  | "severity"
  | "confidence"
  | "delayMinutes"
  | "radiusMeters"
  | "expiresAt"
  | "rationale"
  | "source"
>;
