import {
  makeOrder,
  minutesAgo,
  minutesFromNow,
  signInAs,
} from "./support/supabase-mock";
import { expect, test } from "./support/test";

const assignment = (orderId: string) => ({
  id: `assignment-${orderId}`,
  order_id: orderId,
  driver_id: "driver-1",
  vehicle_id: null,
  route_id: null,
  assigned_at: minutesAgo(30),
  ended_at: null,
});

test("a parcel past its estimate reads as running late (H-04)", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({
        customer_id: "user-1",
        status: "in_transit",
        estimated_delivery_at: minutesAgo(30),
      }),
    ],
    delivery_assignments: [assignment("order-1")],
  });
  await page.goto("/track");
  await expect(page.locator(".eta-time")).toHaveText("Running late");
});

test("a failed delivery explains itself in the timeline (H-05)", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [makeOrder({ customer_id: "user-1", status: "failed" })],
    delivery_assignments: [assignment("order-1")],
    delivery_status_events: [
      {
        id: "e1",
        order_id: "order-1",
        status: "assigned",
        note: null,
        created_at: minutesAgo(50),
      },
      {
        id: "e2",
        order_id: "order-1",
        status: "failed",
        note: "Recipient unavailable",
        created_at: minutesAgo(5),
      },
    ],
  });
  await page.goto("/track");
  const timeline = page.locator(".tracking-timeline-card");
  await expect(timeline.getByText("Latest status")).toBeVisible();
  await expect(timeline.getByText("Delivery issue")).toBeVisible();
  await expect(timeline.getByText(/Recipient unavailable/)).toBeVisible();
  await expect(timeline.getByText("Not reached").first()).toBeVisible();
  await expect(timeline.getByText("Up next")).toHaveCount(0);
});

test("orders can be searched and show dates (H-07)", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({
        id: "order-1",
        tracking_code: "OR-1001",
        customer_id: "user-1",
        status: "delivered",
        delivery_address: "Bahan, near Inya Road",
      }),
      makeOrder({
        id: "order-2",
        tracking_code: "OR-1002",
        customer_id: "user-1",
        status: "assigned",
        delivery_address: "Kamayut, Yangon",
      }),
      makeOrder({
        id: "order-3",
        tracking_code: "OR-1003",
        customer_id: "user-1",
        status: "assigned",
        delivery_address: "Hlaing, Yangon",
      }),
      makeOrder({
        id: "order-4",
        tracking_code: "OR-1004",
        customer_id: "user-1",
        status: "assigned",
        delivery_address: "Insein, Yangon",
      }),
    ],
  });
  await page.goto("/orders");
  // All four are listed; the old view hid everything past the third card.
  await expect(page.locator(".delivery-order-card")).toHaveCount(4);
  await page.getByLabel("Search deliveries").fill("kamayut");
  await expect(page.locator(".delivery-order-card")).toHaveCount(1);
  await expect(page.locator(".delivery-order-card")).toContainText("OR-1002");
  await expect(page.locator(".delivery-order-card")).toContainText(/Ordered/);
  await page.getByLabel("Search deliveries").fill("zzz");
  await expect(
    page.getByText("No deliveries match that search."),
  ).toBeVisible();
});

test("Help sends a support case with the order attached (H-03)", async ({
  page,
  context,
}) => {
  const backend = await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({
        customer_id: "user-1",
        status: "in_transit",
        estimated_delivery_at: minutesFromNow(20),
      }),
    ],
    delivery_assignments: [assignment("order-1")],
  });
  await page.goto("/home");
  await page
    .getByRole("link", { name: /report a problem/i })
    .or(page.getByRole("button", { name: /report a problem/i }))
    .first()
    .click();
  await page.getByLabel("What is the problem?").selectOption("Parcel is late");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText(/Support has your report/)).toBeVisible();
  const created = backend.mutations.find((m) => m.table === "support_cases");
  expect(created?.body).toMatchObject({
    requester_id: "user-1",
    order_id: "order-1",
    priority: "normal",
  });
});

test("opening another parcel from Notifications while on Track switches to it (H-01)", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({
        id: "order-1",
        tracking_code: "OR-2001",
        customer_id: "user-1",
        status: "in_transit",
      }),
      makeOrder({
        id: "order-2",
        tracking_code: "OR-2002",
        customer_id: "user-1",
        status: "assigned",
      }),
    ],
    delivery_status_events: [
      {
        id: "e1",
        order_id: "order-2",
        status: "assigned",
        note: null,
        created_at: minutesAgo(2),
      },
    ],
  });
  await page.goto("/track");
  const selected = page.locator(".selected-order-kicker strong");
  await expect(selected).toHaveText("OR-2001");
  await page
    .getByRole("button", { name: /notifications/i })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link")
    .filter({ hasText: /OR-2002|assigned|rider/i })
    .first()
    .click();
  await expect(selected).toHaveText("OR-2002");
});
