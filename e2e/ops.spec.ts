import { makeOrder, minutesAgo, signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

test("signed-out ops workspaces ask for sign-in instead of showing forms (O-05)", async ({
  page,
}) => {
  for (const route of [
    "/seller",
    "/support",
    "/manager/insights",
    "/manager/order",
    "/manager/track",
    "/manager/profile",
  ]) {
    await page.goto(route);
    // Each workspace words its own prompt; all of them offer a Sign in button.
    await expect(
      page.getByRole("button", { name: /^sign in/i }).first(),
      route,
    ).toBeVisible();
    await expect(page.locator("form"), route).toHaveCount(0);
  }
});

test("dispatch opens on an order that still needs a rider (O-04)", async ({
  page,
  context,
}) => {
  await signInAs(context, "manager", {
    delivery_orders: [
      makeOrder({
        id: "order-1",
        tracking_code: "OR-3001",
        status: "in_transit",
      }),
      makeOrder({ id: "order-2", tracking_code: "OR-3002", status: "pending" }),
    ],
    delivery_assignments: [
      {
        id: "a1",
        order_id: "order-1",
        driver_id: "driver-1",
        vehicle_id: null,
        route_id: null,
        assigned_at: minutesAgo(20),
        ended_at: null,
      },
    ],
  });
  await page.goto("/manager/order");
  await expect(page.getByText("Suggested riders")).toBeVisible();
});

test("manager overview prioritises stale GPS and unsettled cash across widths", async ({
  page,
  context,
}) => {
  await signInAs(context, "manager", {
    delivery_orders: [
      makeOrder({
        id: "moving-fresh",
        tracking_code: "OR-LIVE",
        status: "in_transit",
      }),
      makeOrder({
        id: "moving-stale",
        tracking_code: "OR-STALE",
        status: "in_transit",
        traffic_delay_minutes: 25,
      }),
      makeOrder({
        id: "cash",
        tracking_code: "OR-CASH",
        status: "delivered",
        cod_amount: 42000,
        cod_status: "collected",
      }),
      makeOrder({
        id: "unassigned",
        tracking_code: "OR-NEW",
        status: "pending",
        cod_amount: 0,
        cod_status: "not_required",
      }),
    ],
    delivery_assignments: [
      {
        id: "a1",
        order_id: "moving-fresh",
        driver_id: "driver-1",
        vehicle_id: null,
        route_id: null,
        assigned_at: minutesAgo(30),
        ended_at: null,
      },
      {
        id: "a2",
        order_id: "moving-stale",
        driver_id: "driver-1",
        vehicle_id: null,
        route_id: null,
        assigned_at: minutesAgo(30),
        ended_at: null,
      },
    ],
    latest_delivery_locations: [
      {
        order_id: "moving-fresh",
        latitude: 16.8,
        longitude: 96.15,
        accuracy_meters: 8,
        recorded_at: minutesAgo(0),
      },
      {
        order_id: "moving-stale",
        latitude: 16.79,
        longitude: 96.14,
        accuracy_meters: 12,
        recorded_at: minutesAgo(10),
      },
    ],
    delivery_status_events: [
      {
        id: 1,
        order_id: "cash",
        status: "delivered",
        note: null,
        created_at: minutesAgo(20),
      },
    ],
  });

  await page.goto("/manager/home");
  await expect(page.getByRole("heading", { name: "Act now" })).toBeVisible();
  await expect(page.getByText("OR-STALE location is stale")).toBeVisible();
  await expect(page.getByText("OR-CASH cash needs settlement")).toBeVisible();
  await expect(page.getByText("42,000 MMK collected")).toBeVisible();
  await expect(page.getByText("1 GPS live · 1 stale")).toBeVisible();

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.locator(".dash-delivery-list")).toBeVisible();
  await expect(
    page.locator(".dash-delivery-list").getByText("Rider").first(),
  ).toBeVisible();
  await expect(
    page.locator(".dash-delivery-list").getByText("ETA").first(),
  ).toBeVisible();
  await expect(page.locator(".manager-app .mobile-bottom-nav")).toBeVisible();
  await expect(page.locator(".manager-sidebar")).toBeHidden();

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator(".dash-table")).toBeVisible();
  await expect(page.locator(".manager-sidebar")).toBeVisible();
  await expect(page.locator(".manager-app .mobile-bottom-nav")).toBeHidden();
});

test("support resolution notes do not leak between cases (O-08)", async ({
  page,
  context,
}) => {
  const base = {
    requester_id: "customer-1",
    order_id: null,
    status: "open",
    priority: "normal",
    assigned_to: null,
    resolution_notes: null,
    created_at: minutesAgo(30),
  };
  await signInAs(context, "support", {
    support_cases: [
      {
        ...base,
        id: "case-1",
        subject: "Late parcel",
        description: "x",
        updated_at: minutesAgo(5),
      },
      {
        ...base,
        id: "case-2",
        subject: "Damaged parcel",
        description: "y",
        updated_at: minutesAgo(10),
      },
    ],
  });
  await page.goto("/support");
  const notes = page.getByLabel("Resolution notes");
  await notes.fill("Refund approved");
  await page.getByRole("button", { name: /Damaged parcel/ }).click();
  await expect(notes).toHaveValue("");
});

test("managers reconcile and settle cash on delivery (O-02)", async ({
  page,
  context,
}) => {
  const backend = await signInAs(context, "manager", {
    delivery_orders: [
      makeOrder({
        id: "order-1",
        tracking_code: "OR-4001",
        status: "delivered",
        cod_amount: 68000,
        cod_status: "collected",
      }),
      makeOrder({
        id: "order-2",
        tracking_code: "OR-4002",
        status: "delivered",
        cod_amount: 30000,
        cod_status: "collected",
      }),
      makeOrder({
        id: "order-3",
        tracking_code: "OR-4003",
        status: "delivered",
        cod_amount: 9000,
        cod_status: "pending",
      }),
    ],
    cod_payments: [
      {
        order_id: "order-1",
        amount: 68000,
        payment_method: "cash",
        status: "collected",
        collected_by: "driver-1",
        collected_at: minutesAgo(40),
        settled_at: null,
      },
      {
        order_id: "order-2",
        amount: 25000,
        payment_method: "cash",
        status: "collected",
        collected_by: "driver-1",
        collected_at: minutesAgo(35),
        settled_at: null,
      },
    ],
    delivery_outcome_reports: [
      {
        order_id: "order-2",
        cod_collected: 25000,
        cod_discrepancy_reason: "Customer short of cash",
        reported_at: minutesAgo(35),
      },
    ],
  });
  await page.goto("/manager/cod");

  const rows = page.locator(".cod-ledger-row");
  await expect(rows).toHaveCount(3);
  // A delivered order with no cash recorded is listed first.
  await expect(rows.first()).toContainText("OR-4003");
  await expect(rows.first()).toContainText("Cash not recorded");
  await expect(page.getByText("Customer short of cash")).toBeVisible();
  await expect(page.getByText(/5,000.*short/)).toBeVisible();

  const row = rows.filter({ hasText: "OR-4001" });
  await row.getByRole("button", { name: "Mark as handed over" }).click();
  await row.getByRole("button", { name: "Yes, settled" }).click();
  await expect(row).toContainText("Settled");
  expect(
    backend.mutations.find((m) => m.table === "cod_payments")?.body,
  ).toMatchObject({ status: "settled" });
});

test("dispatch can show every rider, not only the top three (O-03)", async ({
  page,
  context,
}) => {
  const ids = ["d1", "d2", "d3", "d4", "d5"];
  await signInAs(context, "manager", {
    delivery_orders: [
      makeOrder({ id: "order-1", tracking_code: "OR-5001", status: "pending" }),
    ],
    profiles: [
      { id: "user-1", full_name: "Manager", phone: null, role: "manager" },
      ...ids.map((id) => ({
        id,
        full_name: `Rider ${id}`,
        phone: null,
        role: "driver",
      })),
    ],
    driver_profiles: ids.map((id) => ({
      user_id: id,
      availability: "available",
    })),
    vehicles: ids.map((id) => ({
      id: `bike-${id}`,
      registration_number: `YGN-${id}`,
      vehicle_type: "motorcycle",
      status: "available",
      capacity_kg: 20,
      energy_source: "fuel",
      fuel_level_percent: 80,
      battery_level_percent: null,
      range_km_at_full: 200,
      reserve_percent: 10,
      odometer_km: 0,
      service_due_at_km: null,
    })),
  });
  await page.goto("/manager/order");
  const cards = page.locator(".recommendation-card");
  await expect(cards).toHaveCount(3);
  await page.getByRole("button", { name: "Show all 5 riders" }).click();
  await expect(cards).toHaveCount(5);
});

test("manager orders queue supports search and filtering", async ({
  page,
  context,
}) => {
  await signInAs(context, "manager", {
    delivery_orders: [
      makeOrder({
        id: "order-s1",
        tracking_code: "OR-ALPHA",
        customer_name: "Aung San",
        delivery_address: "Bahan Township",
        status: "pending",
      }),
      makeOrder({
        id: "order-s2",
        tracking_code: "OR-BETA",
        customer_name: "Kyaw Kyaw",
        delivery_address: "Kamayut Township",
        status: "pending",
      }),
    ],
  });
  await page.goto("/manager/order");

  const rows = page.locator(".manager-order-row");
  await expect(rows).toHaveCount(2);

  const search = page.getByLabel("Search deliveries");
  await search.fill("ALPHA");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("OR-ALPHA");

  await search.fill("Kamayut");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("OR-BETA");

  await search.fill("NonExistentCode");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("No deliveries match")).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(rows).toHaveCount(2);
});

test("reassigning an active parcel prompts confirmation via ModalPanel", async ({
  page,
  context,
}) => {
  const backend = await signInAs(context, "manager", {
    delivery_orders: [
      makeOrder({
        id: "order-r1",
        tracking_code: "OR-REASSIGN",
        status: "assigned",
      }),
    ],
    delivery_assignments: [
      {
        id: "a-old",
        order_id: "order-r1",
        driver_id: "driver-old",
        vehicle_id: null,
        route_id: null,
        assigned_at: minutesAgo(40),
        ended_at: null,
      },
    ],
    profiles: [
      { id: "user-mgr", full_name: "Manager", phone: null, role: "manager" },
      {
        id: "driver-old",
        full_name: "Old Driver",
        phone: null,
        role: "driver",
      },
      {
        id: "driver-new",
        full_name: "New Driver",
        phone: null,
        role: "driver",
      },
    ],
    driver_profiles: [
      { user_id: "driver-old", availability: "on_delivery" },
      { user_id: "driver-new", availability: "available" },
    ],
    vehicles: [
      {
        id: "bike-new",
        registration_number: "YGN-NEW",
        vehicle_type: "motorcycle",
        status: "available",
        capacity_kg: 25,
        energy_source: "fuel",
        fuel_level_percent: 90,
        battery_level_percent: null,
        range_km_at_full: 200,
        reserve_percent: 10,
        odometer_km: 0,
        service_due_at_km: null,
      },
    ],
  });
  await page.goto("/manager/order");

  const reassignBtn = page.getByRole("button", { name: "Reassign" });
  await expect(reassignBtn).toBeVisible();
  await reassignBtn.click();

  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(
    modal.getByRole("heading", { name: "Confirm driver reassignment" }),
  ).toBeVisible();
  await expect(modal.getByText("New Driver")).toBeVisible();

  await modal.getByRole("button", { name: "Confirm reassignment" }).click();
  await expect(modal).toHaveCount(0);
  expect(
    backend.mutations.find((m) => m.table === "delivery_assignments")?.body,
  ).toMatchObject({ driver_id: "driver-new" });
});

test("mobile bottom nav includes More drawer with full manager operations", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(context, "manager", {
    delivery_orders: [],
  });
  await page.goto("/manager/home");

  const moreBtn = page.getByRole("button", { name: "More" });
  await expect(moreBtn).toBeVisible();
  await moreBtn.click();

  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("heading", { name: "Operations menu" }),
  ).toBeVisible();
  await expect(menu.getByRole("link", { name: /Team roster/ })).toBeVisible();
  await expect(menu.getByRole("link", { name: /Plan routes/ })).toBeVisible();
  await expect(menu.getByRole("link", { name: /Job board/ })).toBeVisible();
  await expect(
    menu.getByRole("link", { name: /Fleet insights/ }),
  ).toBeVisible();
});
