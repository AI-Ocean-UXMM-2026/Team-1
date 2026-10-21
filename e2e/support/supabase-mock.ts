import type { BrowserContext, Route } from "@playwright/test";

/**
 * Synthetic Supabase backend for browser tests. Auth cookies carry an unsigned
 * session and every REST call is answered from in-memory tables, so tests never
 * touch a real project, payment or customer.
 */
export type Role = "customer" | "driver" | "manager" | "seller" | "support";
type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;
export type Mutation = { method: string; table: string; body: unknown };

const SUPABASE_URL = "https://oern-e2e.invalid";
const REF = "oern-e2e";
const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

export const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();
export const minutesFromNow = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

export function makeOrder(overrides: Row = {}): Row {
  return {
    id: "order-1",
    tracking_code: "OR-9001",
    customer_id: "customer-1",
    status: "assigned",
    pickup_address: "Lanmadaw, Yangon",
    delivery_address: "Bahan, near Inya Road",
    pickup_latitude: 16.7797,
    pickup_longitude: 96.1434,
    delivery_latitude: 16.8178,
    delivery_longitude: 96.1566,
    recipient_name: "May Thazin",
    recipient_phone: "+95 9 421 555 018",
    parcel_description: "Documents",
    parcel_weight_kg: 0.4,
    cod_amount: 68000,
    cod_status: "pending",
    estimated_delivery_at: minutesFromNow(20),
    route_progress_percent: null,
    traffic_delay_minutes: 0,
    eta_confidence: "medium",
    eta_updated_at: minutesAgo(1),
    created_at: minutesAgo(60),
    ...overrides,
  };
}

export function baseTables(role: Role, userId: string): Tables {
  return {
    profiles: [
      { id: userId, full_name: "Test User", phone: null, role },
      {
        id: "customer-1",
        full_name: "May Thazin",
        phone: null,
        role: "customer",
      },
      {
        id: "driver-1",
        full_name: "Aung Kyaw",
        phone: "+95 9 421 555 222",
        role: "driver",
      },
    ],
    delivery_orders: [],
    delivery_assignments: [],
    driver_profiles: [{ user_id: "driver-1", availability: "available" }],
    vehicles: [],
    latest_delivery_locations: [],
    delivery_status_events: [],
    road_reports: [],
    delivery_routes: [],
    route_stops: [],
  };
}

export async function signInAs(
  context: BrowserContext,
  role: Role,
  tables: Partial<Tables> = {},
  options: { userId?: string } = {},
) {
  const userId = options.userId ?? (role === "driver" ? "driver-1" : "user-1");
  const all: Tables = {
    ...baseTables(role, userId),
    ...(tables as Tables),
  };
  // The signed-in user is the first profile with their id; drop duplicates.
  const seen = new Set<unknown>();
  all.profiles = all.profiles.filter((row) =>
    seen.has(row.id) ? false : (seen.add(row.id), true),
  );
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "t@oern.test",
  };
  const accessToken = `${b64({ alg: "none" })}.${b64({ sub: userId, exp, role: "authenticated" })}.sig`;
  const session = {
    access_token: accessToken,
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: exp,
    user,
  };
  await context.addCookies([
    {
      name: `sb-${REF}-auth-token`,
      value: `base64-${b64(session)}`,
      url: "http://localhost:3100",
    },
  ]);

  const mutations: Mutation[] = [];
  const handler = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (url.pathname.startsWith("/auth/v1/user"))
      return route.fulfill({ status: 200, headers, json: user });
    const table = url.pathname.match(/^\/rest\/v1\/([^/]+)/)?.[1];
    if (!table) return route.fulfill({ status: 404, headers, json: {} });
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
      mutations.push({ method: request.method(), table, body });
      return route.fulfill({ status: 201, headers, json: [] });
    }
    let rows = all[table] ?? [];
    const eq = url.searchParams.get("id");
    if (eq?.startsWith("eq.")) rows = rows.filter((r) => r.id === eq.slice(3));
    const single = (request.headers().accept ?? "").includes(
      "vnd.pgrst.object",
    );
    if (single)
      return route.fulfill({
        status: rows.length ? 200 : 406,
        headers,
        json: rows[0] ?? { message: "no rows" },
      });
    return route.fulfill({ status: 200, headers, json: rows });
  };
  await context.route(`${SUPABASE_URL}/**`, handler);
  // Map tiles are third-party and irrelevant to behavior under test.
  await context.route(/tile\.openstreetmap\.org|api\.mapbox\.com/, (route) =>
    route.abort(),
  );
  return { mutations, tables: all, handler };
}

/** Every Supabase request fails, as on a dead connection. */
export async function failSupabase(context: BrowserContext) {
  await context.unroute(`${SUPABASE_URL}/**`);
  await context.route(`${SUPABASE_URL}/**`, (route) => route.abort("failed"));
}
