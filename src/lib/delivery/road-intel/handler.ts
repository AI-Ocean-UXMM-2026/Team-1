import type { ModelCaller } from "./agent.ts";
import { analyzeRoadNote, type EngineSignal } from "./engine.ts";
import { buildSpeedGrid } from "./speed-cells.ts";
import type { RoadDecision, RoadNote, SpeedCell } from "./types.ts";

/** Most notes analysed per request, to bound model spend and latency. */
export const MAX_NOTES_PER_REQUEST = 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RoadIntelSource = {
  /** Notes still in force, newest first, with the decision already on each. */
  activeNotes: (now: Date) => Promise<(RoadNote & { hasDecision: boolean })[]>;
  speedCells: () => Promise<SpeedCell[]>;
  saveDecisions: (decisions: RoadDecision[]) => Promise<void>;
};

export type RoadIntelDeps = {
  role: string | null;
  source: RoadIntelSource;
  now: Date;
  signals: readonly EngineSignal[];
  call?: ModelCaller;
  model?: string | null;
};

type Reply = { status: number; body: unknown };
const fail = (status: number, code: string, message: string): Reply => ({
  status,
  body: { error: { code, message } },
});

export async function handleAnalyze(
  body: unknown,
  deps: RoadIntelDeps,
): Promise<Reply> {
  if (deps.role == null) return fail(401, "unauthenticated", "Sign in first");
  if (deps.role !== "manager")
    return fail(403, "forbidden", "Only dispatch managers can analyse notes");

  const requested = (body as { reportIds?: unknown } | null)?.reportIds;
  let reportIds: string[] | null = null;
  if (requested !== undefined) {
    if (
      !Array.isArray(requested) ||
      requested.length > 20 ||
      !requested.every((id) => typeof id === "string" && UUID.test(id))
    )
      return fail(400, "invalid_request", "reportIds must be up to 20 UUIDs");
    reportIds = requested as string[];
  }

  const notes = await deps.source.activeNotes(deps.now);
  const targets = (
    reportIds
      ? notes.filter((note) => reportIds.includes(note.id))
      : notes.filter((note) => !note.hasDecision && note.status !== "rejected")
  )
    // Oldest unanswered note first, so none starves behind newer ones
    .sort((a, b) => a.reportedAt.localeCompare(b.reportedAt))
    .slice(0, MAX_NOTES_PER_REQUEST);

  if (!targets.length)
    return { status: 200, body: { decisions: [], remaining: 0 } };

  const speedGrid = buildSpeedGrid(await deps.source.speedCells());
  const context = {
    now: deps.now,
    otherNotes: notes,
    speedGrid,
    signals: deps.signals,
  };

  const decisions = await Promise.all(
    targets.map((note) =>
      analyzeRoadNote(note, context, { call: deps.call, model: deps.model }),
    ),
  );
  await deps.source.saveDecisions(decisions);

  const remaining = reportIds
    ? 0
    : notes.filter(
        (note) =>
          !note.hasDecision &&
          note.status !== "rejected" &&
          !targets.some((target) => target.id === note.id),
      ).length;
  return {
    status: 200,
    body: {
      decisions: decisions.map((decision) => ({
        reportId: decision.reportId,
        action: decision.action,
        confidence: decision.confidence,
        delayMinutes: decision.delayMinutes,
        source: decision.source,
        rationale: decision.rationale,
      })),
      remaining,
    },
  };
}
