import { handlePlan } from "@/lib/delivery/dispatch/handler";
import { buildStraightLineMatrix } from "@/lib/delivery/dispatch/matrix";
import {
  buildRoadMatrix,
  createRoadPairCache,
} from "@/lib/delivery/dispatch/road-matrix";
import { createSupabaseSource } from "@/lib/delivery/dispatch/supabase-source";
import { createClient } from "@/lib/supabase/server";

// Planning makes up to ~55 Matrix calls and then searches for a few seconds.
export const maxDuration = 30;

// Survives across requests on a warm instance, so a re-plan with mostly the
// same stops only pays Mapbox for the legs it has not seen.
const roadCache = createRoadPairCache();

const NO_STORE = { "Cache-Control": "no-store" };
const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: NO_STORE });
const error = (status: number, code: string, message: string) =>
  reply(status, { error: { code, message } });

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

  // Everything below runs as the signed-in manager, under row-level security.
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

  // A server-only token is preferred; the public one is a fallback for local use.
  const token =
    process.env.MAPBOX_SERVER_TOKEN ??
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
    "";

  try {
    const result = await handlePlan(body, {
      role,
      source: createSupabaseSource(supabase),
      now: new Date(),
      newKey: () => crypto.randomUUID(),
      makeDeps: (policy) => ({
        nowMs: () => Date.now(),
        buildMatrix: async (points, params) =>
          policy === "no_network" || !token
            ? { matrix: buildStraightLineMatrix(points, params), stats: null }
            : buildRoadMatrix(points, params, {
                fetch,
                token,
                cache: roadCache,
              }),
      }),
    });
    return reply(result.status, result.body);
  } catch (caught) {
    console.error("dispatch plan failed", caught);
    return error(500, "internal_error", "The plan could not be built");
  }
}
