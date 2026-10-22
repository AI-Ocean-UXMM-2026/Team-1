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
/** Answers a PostgREST RPC; throw to fail it with a database-style error. */
export type RpcHandlers = Record<string, (args: Row) => unknown>;

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

/**
 * A four-stop in-transit route for driver-1, in route order. Stop 3's promised
 * time is earlier than stop 2's, as happens when sellers promise independently
 * of the planned sequence. Stops 1 and 3 collect COD.
 */
export function makeRoute(): Tables {
  const stops = [
    {
      name: "Su Myat",
      area: "Sanchaung",
      lat: 16.8023,
      lng: 96.1312,
      cod: 20000,
      eta: 25,
    },
    {
      name: "Thuriya Ye Naing",
      area: "Tamwe",
      lat: 16.8065,
      lng: 96.1771,
      cod: 0,
      eta: 70,
    },
    {
      name: "Hnin Thiri",
      area: "Kamayut",
      lat: 16.8267,
      lng: 96.1322,
      cod: 125000,
      eta: 40,
    },
    {
      name: "Kyaw Zin",
      area: "Insein",
      lat: 16.8891,
      lng: 96.1046,
      cod: 0,
      eta: 110,
    },
  ];
  const orders = stops.map((stop, index) =>
    makeOrder({
      id: `order-${index + 1}`,
      tracking_code: `YGN-R-00${index + 1}`,
      status: "in_transit",
      recipient_name: stop.name,
      delivery_address: `${stop.area} delivery`,
      delivery_latitude: stop.lat,
      delivery_longitude: stop.lng,
      cod_amount: stop.cod,
      estimated_delivery_at: minutesFromNow(stop.eta),
    }),
  );
  return {
    delivery_orders: orders,
    delivery_assignments: orders.map((order, index) => ({
      id: `assignment-${index + 1}`,
      order_id: order.id,
      driver_id: "driver-1",
      vehicle_id: null,
      route_id: "route-1",
      assigned_at: minutesAgo(30),
      ended_at: null,
    })),
    route_stops: orders.map((order, index) => ({
      id: `stop-${index + 1}`,
      route_id: "route-1",
      order_id: order.id,
      stop_type: "delivery",
      sequence_number: index + 1,
    })),
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
  options: { userId?: string; rpc?: RpcHandlers } = {},
) {
  const userId = options.userId ?? (role === "driver" ? "driver-1" : "user-1");
  const all: Tables = {
    ...baseTables(role, userId),
    ...(tables as Tables),
  };
  // The signed-in user is the first profile with their id; drop duplicates.
  const seen = new Set<unknown>();
  all.profiles = all.profiles.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
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
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
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
    const rpcName = url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)/)?.[1];
    if (rpcName) {
      let args: Row = {};
      try {
        args = (request.postDataJSON() ?? {}) as Row;
      } catch {}
      mutations.push({ method: "RPC", table: rpcName, body: args });
      if (rpcName === "complete_delivery") {
        mutations.push({ method: "RPC", table: "rpc", body: args });
      }
      const answer =
        options.rpc?.[rpcName] ??
        (rpcName === "complete_delivery"
          ? (a: Row) => ({
              status: (a.delivery_outcome as string) ?? "delivered",
              cod_status: a.cod_received ? "collected" : "not_required",
              duplicate: false,
            })
          : null);
      if (!answer)
        return route.fulfill({
          status: 404,
          headers,
          json: { message: `No mock for ${rpcName}` },
        });
      try {
        return route.fulfill({ status: 200, headers, json: answer(args) });
      } catch (cause) {
        return route.fulfill({
          status: 400,
          headers,
          json: {
            message: cause instanceof Error ? cause.message : String(cause),
          },
        });
      }
    }
    const table = url.pathname.match(/^\/rest\/v1\/([^/]+)/)?.[1];
    if (!table) return route.fulfill({ status: 404, headers, json: {} });
    const matches = (row: Row) =>
      [...url.searchParams].every(([key, value]) => {
        if (!value.startsWith("eq.")) return true;
        return String(row[key]) === value.slice(3);
      });
    const method = request.method();
    if (method !== "GET" && method !== "HEAD") {
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
      mutations.push({ method, table, body });
      if (method === "PATCH" && body && typeof body === "object") {
        const updated = (all[table] ?? []).filter(matches);
        for (const row of updated) Object.assign(row, body);
        return route.fulfill({ status: 200, headers, json: updated });
      }
      if (method === "POST") {
        const created = Array.isArray(body) ? body : [body];
        all[table] = [...(all[table] ?? []), ...(created as Row[])];
        return route.fulfill({ status: 201, headers, json: created });
      }
      return route.fulfill({ status: 204, headers });
    }
    const rows = (all[table] ?? []).filter(matches);
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
