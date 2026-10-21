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
    await expect(
      page.getByRole("region", { name: "Sign in required" }),
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
