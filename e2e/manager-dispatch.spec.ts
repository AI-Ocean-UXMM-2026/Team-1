import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

/*
 * The planner API runs on the server, where Playwright cannot intercept its
 * fetches, so the browser's calls to /api/dispatch/plan are stubbed here. The
 * stub body is a small hand-written plan whose ids and addresses say SYNTHETIC;
 * the real handler and solver are covered by the Node tests.
 */

const DEPOT = "d0000000-0000-4000-8000-000000000001";
const TRUCK = "00000000-0000-4000-8000-000000000901";
const RUN = "00000000-0000-4000-8000-000000005000";
const ORDER_A = "00000000-0000-4000-8000-0000000000a1";
const ORDER_B = "00000000-0000-4000-8000-0000000000b2";
const iso = (h: number, m = 0) =>
  new Date(Date.UTC(2026, 9, 22, h, m) - 6.5 * 3600e3).toISOString();

const stop = (
  order: string,
  type: "pickup" | "delivery",
  seq: number,
  address: string,
  lat: number,
  lng: number,
  h: number,
  extra = {},
) => ({
  order_id: order,
  stop_type: type,
  seq,
  address,
  latitude: lat,
  longitude: lng,
  window_start_at: type === "pickup" ? iso(8) : null,
  window_end_at: type === "pickup" ? iso(12) : null,
  planned_arrival_at: iso(h),
  planned_departure_at: iso(h, 5),
  slack_min: 90,
  leg_min: 20,
  leg_km: 4,
  leg_flood_km: 0,
  load_after_kg: 8,
  reasons: [],
  ...extra,
});

const planBody = (over: Record<string, unknown> = {}) => ({
  run: {
    id: RUN,
    revision: 1,
    status: "draft",
    engineVersion: "test",
    seed: 1,
    iterations: 10,
    runtimeMs: 5,
    stopReason: "converged",
  },
  quality: {
    tier: "straight_line",
    label: "Estimated from straight-line distance, no road data",
    matrix: null,
    flood: { status: "unknown", blockedArcs: 0, exposedArcs: 0 },
  },
  objective: { total: 321, unserved: 600 },
  routes: [
    {
      vehicle_id: TRUCK,
      driver_id: "driver-1",
      display_order: 0,
      planned_depart_at: iso(8, 10),
      planned_return_at: iso(11),
      distance_km: 18.4,
      travel_min: 90,
      service_min: 20,
      wait_min: 0,
      peak_kg: 8,
      cap_kg_used: 270,
      usable_range_km: 260,
      energy_status: "enough",
      score_total: 150,
      score_time: 120,
      score_uncertainty: 10,
      score_cost: 20,
      score_flood: 4,
      score_late: 0,
      score_cohesion: 0,
      flags: ["flood_exposure"],
      explanation: {
        summary: "1 order(s), 18.4 km, leaves 08:10, back 11:00 (Yangon time)",
      },
      stops: [
        stop(ORDER_A, "pickup", 1, "SYNTHETIC pickup street", 16.9, 96.15, 9),
        stop(
          ORDER_A,
          "delivery",
          2,
          "SYNTHETIC drop street",
          16.93,
          96.18,
          10,
          { leg_flood_km: 0.8 },
        ),
      ],
    },
  ],
  unassigned: [
    {
      order_id: ORDER_B,
      delivery_address: "SYNTHETIC far drop",
      disposition: "unassigned",
      unassigned_reason: "exceeds_capacity_single",
      origin_kind: "door",
      weight_source: "declared",
      window_source: "default_assumed",
    },
  ],
  orders: [
    {
      order_id: ORDER_A,
      disposition: "assigned",
      vehicle_id: TRUCK,
      origin_kind: "door",
      weight_source: "size_estimate",
      window_source: "parsed_description",
    },
    {
      order_id: ORDER_B,
      disposition: "unassigned",
      unassigned_reason: "exceeds_capacity_single",
      origin_kind: "door",
      weight_source: "declared",
      window_source: "default_assumed",
    },
  ],
  assumptions: [
    {
      key: "utilisation",
      label: "Share of truck capacity that may be used",
      value: 0.9,
    },
  ],
  warnings: [
    "straight_line: no road data was used",
    "flood_unknown: no flood layer",
  ],
  excludedTrucks: [],
  scheduledLater: [],
  basis:
    "Estimated from straight-line distance, no road data. 0 weight(s) declared, 1 estimated from size. Estimates are not yet validated.",
  serviceDate: "2026-10-22",
  today: "2026-10-22",
  depot: { code: "MGD", latitude: 16.9, longitude: 96.15 },
  trucks: [{ id: TRUCK, registration: "SYN-TRUCK-1", capacityKg: 300 }],
  simulated: false,
  ...over,
});

const setupTables = (depotStatus: "verified" | "unverified" = "verified") => ({
  depots: [
    {
      id: DEPOT,
      code: "MGD",
      name: "Mingalardone",
      latitude: depotStatus === "verified" ? 16.9 : null,
      longitude: depotStatus === "verified" ? 96.15 : null,
      location_status: depotStatus,
      coordinate_source: depotStatus === "verified" ? "e2e fixture" : null,
      is_active: true,
    },
  ],
  vehicles: [
    {
      id: TRUCK,
      registration_number: "SYN-TRUCK-1",
      vehicle_type: "truck",
      status: "available",
      capacity_kg: 300,
      vehicle_dispatch_profiles: {
        depot_id: null,
        default_driver_id: "driver-1",
      },
    },
    {
      id: "v2",
      registration_number: "SYN-TRUCK-2",
      vehicle_type: "truck",
      status: "maintenance",
      capacity_kg: 300,
      vehicle_dispatch_profiles: null,
    },
  ],
});

async function stubPlan(
  page: Page,
  handler: (
    body: Record<string, unknown>,
    calls: number,
  ) => { status: number; json: unknown },
) {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/dispatch/plan", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    bodies.push(body);
    const result = handler(body, bodies.length);
    await route.fulfill({
      status: result.status,
      contentType: "application/json",
      json: result.json,
    });
  });
  return bodies;
}

test("synthetic preview is labelled, explains every unplaced order and cannot commit", async ({
  page,
}) => {
  await page.goto("/manager/dispatch?preview=synthetic");
  await expect(page.getByText("SYNTHETIC DATA")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Commit routes" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: /Not planned/ }),
  ).toBeVisible();
  await expect(page.getByText("Too big for any truck")).toBeVisible();
  await expect(page.getByText("No map pin")).toBeVisible();
  // Straight-line data is stated, and flood risk is "unknown", never zero.
  await expect(
    page.getByText(/Estimated from straight-line distance/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/Flood risk is unknown, not zero/).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Discard" })).toHaveCount(0);

  await page.getByRole("button", { name: "Simulated flood zone" }).click();
  await expect(
    page.getByText(/mapped flood-hazard zone \(static map, not live\)/).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulated blocked road" }).click();
  await expect(
    page.getByText("Blocked by a verified road report"),
  ).toBeVisible();
});

test("synthetic preview has no horizontal overflow and passes the axe scan", async ({
  page,
}) => {
  await page.goto("/manager/dispatch?preview=synthetic");
  await expect(
    page.getByRole("heading", { name: /Not planned/ }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page: page as never })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});

test("signed-out visitors are asked to sign in", async ({ page }) => {
  await page.goto("/manager/dispatch");
  await expect(
    page.getByRole("button", { name: /^sign in/i }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Build routes" })).toHaveCount(
    0,
  );
});

test("an unconfirmed depot blocks planning until a manager confirms the pin", async ({
  page,
  context,
}) => {
  const { mutations } = await signInAs(
    context,
    "manager",
    setupTables("unverified"),
  );
  await page.goto("/manager/dispatch");
  await expect(
    page.getByText("Confirm the Mingalardone location"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Build routes/ }),
  ).toBeDisabled();
  await expect(
    page.getByText("Confirm the depot location first."),
  ).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirm location" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Latitude").fill("16.9");
  await page.getByLabel("Longitude").fill("96.15");
  await page.getByLabel("Where the coordinates came from").fill("e2e fixture");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect
    .poll(() => mutations.find((m) => m.table === "rpc"))
    .toBeTruthy();
});

test("setup lists trucks with reasons and needs a driver per truck", async ({
  page,
  context,
}) => {
  await signInAs(context, "manager", {
    ...setupTables(),
    driver_profiles: [{ user_id: "driver-1", availability: "available" }],
  });
  await page.goto("/manager/dispatch");
  await expect(page.getByText("Not available (maintenance)")).toBeVisible();
  const build = page.getByRole("button", { name: /Build routes/ });
  await expect(build).toBeEnabled(); // the default driver is pre-selected
  await page.getByLabel("Driver").first().selectOption("");
  await expect(build).toBeDisabled();
  await expect(
    page.getByText("Choose a driver for every selected truck."),
  ).toBeVisible();
});

test("build, review, and commit with a stale order (skip) end to end", async ({
  page,
  context,
}) => {
  await signInAs(context, "manager", {
    ...setupTables(),
    driver_profiles: [{ user_id: "driver-1", availability: "available" }],
  });
  const bodies = await stubPlan(page, () => ({
    status: 200,
    json: planBody(),
  }));
  let commits = 0;
  const commitCalls: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/rpc/commit_dispatch_run", async (route) => {
    commits++;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    commitCalls.push(body);
    const json =
      body.p_on_stale === "skip"
        ? { committed: true, duplicate: false, partial: true, orders: 1 }
        : {
            committed: false,
            reason: "stale",
            stale_orders: [{ order_id: ORDER_A, change: "order_changed" }],
          };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      json,
    });
  });

  await page.goto("/manager/dispatch");
  await page.getByRole("button", { name: /Build routes/ }).click();
  await expect(
    page.getByRole("heading", { name: "SYN-TRUCK-1", exact: false }),
  ).toBeVisible();
  expect(bodies[0]).toMatchObject({
    depotId: DEPOT,
    mode: "persist",
    vehicleIds: [TRUCK],
    driverByVehicle: { [TRUCK]: "driver-1" },
  });
  await expect(
    page.getByText(/Estimated from straight-line distance/).first(),
  ).toBeVisible();
  await expect(page.getByText("Too big for any truck")).toBeVisible();
  await expect(
    page
      .locator(".dispatch-chips")
      .getByText("Crosses a mapped flood-hazard zone (static map, not live)"),
  ).toBeVisible();
  await page.getByText("2 stops in order").click();
  await expect(
    page.getByText(/Pick up · SYNTHETIC pickup street/),
  ).toBeVisible();
  await expect(page.getByText(/window 08:00–12:00/)).toBeVisible();

  await page.getByRole("button", { name: "Commit routes" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Assign 1 order to 1 driver");
  await dialog.getByRole("button", { name: "Commit routes" }).click();
  await expect(dialog).toContainText(
    "Some orders changed after this plan was made",
  );
  await expect(dialog).toContainText("the order was edited");
  await dialog
    .getByRole("button", { name: /Commit without 1 changed order/ })
    .click();
  await expect(
    page.getByRole("heading", { name: /Routes committed/ }),
  ).toBeVisible();
  expect(commits).toBe(2);
  expect(commitCalls[0]).toMatchObject({
    p_run_id: RUN,
    p_expected_revision: 1,
    p_on_stale: "abort",
  });
  expect(commitCalls[1].p_commit_key).toBe(commitCalls[0].p_commit_key); // retry is idempotent
  await expect(
    page.getByRole("link", { name: /Follow in Track/ }),
  ).toBeVisible();
});

test("an existing draft offers to replace it", async ({ page, context }) => {
  await signInAs(context, "manager", {
    ...setupTables(),
    driver_profiles: [{ user_id: "driver-1", availability: "available" }],
  });
  const bodies = await stubPlan(page, (body) =>
    body.replaceDraft
      ? { status: 200, json: planBody() }
      : {
          status: 409,
          json: {
            error: {
              code: "draft_exists",
              message: "exists",
              detail: { run_id: RUN },
            },
          },
        },
  );
  await page.goto("/manager/dispatch");
  await page.getByRole("button", { name: /Build routes/ }).click();
  await expect(
    page.getByText("A draft plan already exists for this depot and day."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replace the draft" }).click();
  await expect(
    page.getByRole("heading", { name: "SYN-TRUCK-1", exact: false }),
  ).toBeVisible();
  expect(bodies.map((b) => b.replaceDraft)).toEqual([false, true]);
});

test("planner failures are explained and can be retried", async ({
  page,
  context,
}) => {
  await signInAs(context, "manager", {
    ...setupTables(),
    driver_profiles: [{ user_id: "driver-1", availability: "available" }],
  });
  await stubPlan(page, (_body, n) =>
    n === 1
      ? {
          status: 422,
          json: {
            error: {
              code: "no_open_orders",
              message: "No open orders to plan",
            },
          },
        }
      : { status: 200, json: planBody() },
  );
  await page.goto("/manager/dispatch");
  await page.getByRole("button", { name: /Build routes/ }).click();
  await expect(
    page.getByText("There are no open orders to plan."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "SYN-TRUCK-1", exact: false }),
  ).toBeVisible();
});

test("a plan for a later day says it can only be committed on the day", async ({
  page,
  context,
}) => {
  await signInAs(context, "manager", {
    ...setupTables(),
    driver_profiles: [{ user_id: "driver-1", availability: "available" }],
  });
  await stubPlan(page, () => ({
    status: 200,
    json: planBody({ serviceDate: "2026-10-23", today: "2026-10-22" }),
  }));
  await page.route("**/rest/v1/rpc/commit_dispatch_run", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      json: { committed: false, reason: "future_date" },
    }),
  );
  await page.goto("/manager/dispatch");
  await page.getByRole("button", { name: /Build routes/ }).click();
  await expect(page.getByText(/not today: commit on the day/)).toBeVisible();
  await page.getByRole("button", { name: "Commit routes" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Commit routes" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "only be committed on their service day",
  );
});
