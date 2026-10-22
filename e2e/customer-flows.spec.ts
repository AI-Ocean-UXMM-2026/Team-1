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
  await page.goto("/track?order=order-1");
  const delivery = page.getByRole("region", { name: "Selected delivery" });
  await expect(delivery.getByText("Running late").first()).toBeVisible();
  // The headline once read "Arriving in Running late".
  await expect(delivery.getByText(/Arriving in/)).toHaveCount(0);
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
  await page.goto("/track?order=order-1");
  const timeline = page.getByRole("region", { name: "Progress" });
  await expect(timeline.getByText("Delivery issue")).toBeVisible();
  await expect(timeline.getByText(/Recipient unavailable/)).toBeVisible();
  await expect(timeline.getByText("Not reached").first()).toBeVisible();
  await expect(timeline.getByText("Up next")).toHaveCount(0);
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
  await page.getByRole("button", { name: /help and support/i }).click();
  const sheet = page.getByRole("dialog", { name: "Get help" });
  await sheet.getByRole("radio", { name: "Late or missing parcel" }).check();
  await sheet
    .getByLabel("Describe the problem")
    .fill("Estimated time passed an hour ago");
  await sheet.getByRole("button", { name: "Send to support" }).click();
  await expect(page.getByText(/Request sent/)).toBeVisible();
  const created = backend.mutations.find((m) => m.table === "support_cases");
  expect(created?.body).toMatchObject({
    requester_id: "user-1",
    order_id: "order-1",
    priority: "high",
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
  await page.goto("/track?order=order-1");
  const delivery = page.getByRole("region", { name: "Selected delivery" });
  await expect(delivery.getByText("OR-2001").first()).toBeVisible();

  // Client-side navigation from Notifications must replace the selection.
  await page.goto("/notifications");
  await page.getByRole("link", { name: /OR-2002/ }).click();
  await expect(page).toHaveURL(/order=order-2/);
  await expect(delivery.getByText("OR-2002").first()).toBeVisible();
  await expect(delivery.getByText("OR-2001")).toHaveCount(0);
});

test("home leads with the parcel on the way, and the tab bar has one current tab", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({ customer_id: "user-1", status: "in_transit" }),
    ],
  });
  await page.goto("/home");
  const live = page.getByRole("link", { name: /track live/i });
  const pickup = page.getByRole("link", { name: /request a pickup/i });
  await expect(live).toBeVisible();
  const liveY = (await live.boundingBox())?.y ?? 0;
  const pickupY = (await pickup.boundingBox())?.y ?? 0;
  expect(liveY).toBeLessThan(pickupY);

  const nav = page.getByRole("navigation", { name: "Customer app" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
