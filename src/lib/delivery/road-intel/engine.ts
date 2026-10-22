import {
  type AgentTools,
  type ModelCaller,
  type RawDecision,
  runRoadAgent,
} from "./agent.ts";
import { readRoadNote } from "./heuristic.ts";
import { CRAWL_KMH, observedSpeedNear, type SpeedGrid } from "./speed-cells.ts";
import type { RoadDecision, RoadNote, RoadSeverity } from "./types.ts";

export type EngineSignal = {
  name: string;
  latitude: number;
  longitude: number;
  estimatedCycleSeconds: number;
};

export type EngineContext = {
  now: Date;
  /** Every other recent note, for corroboration. */
  otherNotes: readonly RoadNote[];
  speedGrid: SpeedGrid;
  signals: readonly EngineSignal[];
};

const KM_PER_DEG = 111.32;
const distanceM = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) =>
  Math.hypot(
    (a.latitude - b.latitude) * KM_PER_DEG,
    (a.longitude - b.longitude) *
      KM_PER_DEG *
      Math.cos((a.latitude * Math.PI) / 180),
  ) * 1000;

const minutesBetween = (later: Date, earlier: string) =>
  Math.round((later.getTime() - new Date(earlier).getTime()) / 60_000);

/** How the note looks next to what riders measured and what others wrote. */
export function gatherEvidence(note: RoadNote, context: EngineContext) {
  const near = context.otherNotes.filter(
    (other) =>
      other.id !== note.id &&
      other.driverId !== note.driverId &&
      other.status !== "rejected" &&
      minutesBetween(context.now, other.reportedAt) <= 180 &&
      distanceM(other, note) <= 300,
  );
  const sameKind = near.filter((other) => other.category === note.category);
  const speed = observedSpeedNear(context.speedGrid, note, 0.25);
  return { near, sameKind, speed };
}

/** Tool answers for the agent, built from the same evidence the engine uses. */
export function buildAgentTools(
  note: RoadNote,
  context: EngineContext,
): AgentTools {
  return {
    nearbyNotes: (radiusMeters) =>
      context.otherNotes
        .filter(
          (other) =>
            other.id !== note.id &&
            other.status !== "rejected" &&
            distanceM(other, note) <= radiusMeters,
        )
        .slice(0, 12)
        .map((other) => ({
          category: other.category,
          severity: other.severity,
          ageMinutes: minutesBetween(context.now, other.reportedAt),
          status: other.status,
          sameRider: other.driverId === note.driverId,
          text: other.description.slice(0, 160),
        })),
    speedNear: (radiusMeters) => {
      const speed = observedSpeedNear(
        context.speedGrid,
        note,
        radiusMeters / 1000,
      );
      return speed.samples
        ? {
            medianSpeedKmh: speed.speedKmh,
            riders: speed.drivers,
            samples: speed.samples,
            windowMinutes: 30,
          }
        : { medianSpeedKmh: null, note: "No rider telemetry here lately." };
    },
    signalsNear: (radiusMeters) =>
      context.signals
        .filter((signal) => distanceM(signal, note) <= radiusMeters)
        .slice(0, 8)
        .map((signal) => ({
          name: signal.name,
          distanceMeters: Math.round(distanceM(signal, note)),
          cycleSeconds: signal.estimatedCycleSeconds,
        })),
  };
}

export function noteBrief(note: RoadNote, context: EngineContext) {
  return [
    `Rider chose: category=${note.category}, severity=${note.severity}.`,
    `Reported ${minutesBetween(context.now, note.reportedAt)} minutes ago at ${note.latitude.toFixed(5)}, ${note.longitude.toFixed(5)}.`,
    `<driver_note>${note.description.replace(/<\/?driver_note>/gi, "")}</driver_note>`,
  ].join("\n");
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Turns a note into a routing decision. A language model investigates when
 * one is supplied; the rule-based reader covers for it when it is missing or
 * fails. Either way the same measured evidence adjusts confidence and a few
 * hard guardrails apply, so a confident-sounding answer cannot close a road
 * that riders are driving down.
 */
export async function analyzeRoadNote(
  note: RoadNote,
  context: EngineContext,
  options: { call?: ModelCaller; model?: string | null } = {},
): Promise<RoadDecision> {
  const reading = readRoadNote(note);
  let source: RoadDecision["source"] = "heuristic";
  let raw: RawDecision | null = null;
  let toolCalls: string[] = [];
  let agentError: string | null = null;

  if (options.call) {
    try {
      const result = await runRoadAgent({
        call: options.call,
        tools: buildAgentTools(note, context),
        noteBrief: noteBrief(note, context),
      });
      raw = result.decision;
      toolCalls = result.toolCalls;
      if (raw) source = "agent";
      else agentError = "agent did not submit a decision";
    } catch (cause) {
      agentError = cause instanceof Error ? cause.message : "agent failed";
    }
  }

  const category = raw?.category ?? reading.category;
  const severity: RoadSeverity = raw?.severity ?? reading.severity;
  let action = raw?.action ?? reading.action;
  let confidence = raw?.confidence ?? reading.confidence;
  let delayMinutes = raw?.delayMinutes ?? reading.delayMinutes;
  const radiusMeters = raw?.radiusMeters ?? reading.radiusMeters;
  const ttlMinutes = raw?.validForMinutes ?? reading.ttlMinutes;
  let rationale =
    raw?.rationale ??
    `Rule-based reading of the note${reading.signals.length ? ` (${reading.signals.join("; ")})` : ""}.`;

  const evidence = gatherEvidence(note, context);
  const adjustments: string[] = [];

  // A note that says the problem is over outranks a model that disagrees
  if (reading.cleared) {
    action = "ignore";
    adjustments.push("note says the problem is cleared");
  }

  const corroborating = Math.min(2, evidence.sameKind.length);
  if (corroborating) {
    confidence += 0.1 * corroborating;
    adjustments.push(
      `${evidence.sameKind.length} other rider(s) report the same`,
    );
  }

  const { speed } = evidence;
  const measured = speed.drivers >= 2 && speed.speedKmh != null;
  if (measured && (speed.speedKmh as number) < CRAWL_KMH) {
    confidence += 0.15;
    adjustments.push(`riders crawling at ${speed.speedKmh} km/h`);
  } else if (
    measured &&
    (speed.speedKmh as number) > 25 &&
    category !== "roadwork" &&
    minutesBetween(context.now, note.reportedAt) >= 10
  ) {
    // People are driving through freely: the note no longer matches the road
    confidence -= 0.3;
    adjustments.push(`riders driving freely at ${speed.speedKmh} km/h`);
    if (action === "avoid") action = "delay";
  }

  // Only the report age, not the reporter's wording, decides staleness
  const ageMinutes = minutesBetween(context.now, note.reportedAt);
  if (ageMinutes > ttlMinutes) {
    action = "ignore";
    adjustments.push(`older than its ${ttlMinutes} min lifetime`);
  }

  confidence = round2(clamp01(confidence));

  // Guardrails that hold whatever the model said
  if (action === "avoid" && confidence < 0.55) {
    action = "delay";
    adjustments.push("avoid needs confidence of 0.55");
  }
  if (action !== "ignore" && confidence < 0.3) {
    action = "monitor";
    adjustments.push("too uncertain to affect routing");
  }
  if (action === "ignore" || action === "monitor") {
    if (action === "ignore") delayMinutes = 0;
  }
  delayMinutes = Math.round(Math.max(0, Math.min(60, delayMinutes)) * 10) / 10;

  if (adjustments.length)
    rationale = `${rationale} Checks: ${adjustments.join("; ")}.`;
  rationale = rationale.slice(0, 600);

  const expiresAt = new Date(
    Math.max(
      context.now.getTime() + 10 * 60_000,
      new Date(note.reportedAt).getTime() + ttlMinutes * 60_000,
    ),
  );

  return {
    reportId: note.id,
    action,
    category,
    severity,
    confidence,
    delayMinutes,
    radiusMeters,
    expiresAt: expiresAt.toISOString(),
    rationale,
    evidence: {
      corroboratingNotes: evidence.sameKind.length,
      nearbyNotes: evidence.near.length,
      observedSpeedKmh: speed.speedKmh,
      observedRiders: speed.drivers,
      toolCalls,
      adjustments,
      ...(agentError ? { agentError } : {}),
    },
    source,
    model: source === "agent" ? (options.model ?? null) : null,
  };
}
