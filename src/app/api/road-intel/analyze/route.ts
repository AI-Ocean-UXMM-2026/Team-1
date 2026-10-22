import { anthropicCaller } from "@/lib/delivery/road-intel/agent";
import { handleAnalyze } from "@/lib/delivery/road-intel/handler";
import { createRoadIntelSource } from "@/lib/delivery/road-intel/supabase-source";
import { defaultSignalNodes } from "@/lib/delivery/signal-index";
import { createClient } from "@/lib/supabase/server";

// Each note may take a few model turns.
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: NO_STORE });
const error = (status: number, code: string, message: string) =>
  reply(status, { error: { code, message } });

const MODEL = process.env.ROAD_INTEL_MODEL ?? "claude-sonnet-5-5";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return error(400, "invalid_request", "Send application/json");
  const origin = request.headers.get("origin");
  if (origin) {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(origin).host === request.headers.get("host");
    } catch {}
    if (!sameOrigin)
      return error(403, "forbidden", "Cross-origin requests are not allowed");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "invalid_request", "Body must be valid JSON");
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  let role: string | null = null;
  if (auth.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();
    role = profile?.role ?? "none";
  }

  // Without a key the rule-based reader still decides; with one, an agent
  // investigates each note first.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  try {
    const result = await handleAnalyze(body, {
      role,
      source: createRoadIntelSource(supabase),
      now: new Date(),
      signals: defaultSignalNodes().map((node) => ({
        name: node.name,
        latitude: node.latitude,
        longitude: node.longitude,
        estimatedCycleSeconds: node.estimatedCycleSeconds,
      })),
      call: apiKey ? anthropicCaller({ apiKey, model: MODEL }) : undefined,
      model: apiKey ? MODEL : null,
    });
    return reply(result.status, result.body);
  } catch (caught) {
    console.error("road intel analysis failed", caught);
    return error(500, "internal_error", "The notes could not be analysed");
  }
}
