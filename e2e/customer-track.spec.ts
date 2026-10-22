import {
  makeOrder,
  minutesAgo,
  minutesFromNow,
  signInAs,
} from "./support/supabase-mock";
import { expect, test } from "./support/test";

const rider = {
  id: "driver-1",
  full_name: "Aung Kyaw",
  phone: "+95 9 421 555 222",
  role: "driver",
};
const me = {
  id: "user-1",
  full_name: "May Thazin",
  phone: null,
  role: "customer",
};
const assign = (orderId: string) => ({
  id: `a-${orderId}`,
  order_id: orderId,
  driver_id: "driver-1",
  vehicle_id: null,
  route_id: null,
  assigned_at: minutesAgo(40),
  ended_at: null,
});
const here = (recorded_at: string) => ({
  order_id: "order-1",
  latitude: 16.8,
  longitude: 96.15,
  accuracy_meters: 8,
  recorded_at,
});

test("a live parcel leads with the map, then the summary", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    profiles: [me, rider],
    delivery_orders: [
      makeOrder({
        customer_id: "user-1",
        status: "in_transit",
        estimated_delivery_at: minutesFromNow(15),
      }),
    ],
    delivery_assignments: [assign("order-1")],
    latest_delivery_locations: [here(minutesAgo(0))],
  });
  await page.goto("/track?order=order-1");
  const region = page.getByRole("region", { name: "Selected delivery" });
  await expect(region.getByText(/Arriving in/)).toBeVisible();
  await expect(region.getByText("Live location")).toBeVisible();

  const mapBox = await region
    .locator(".map-viewport, .map-card")
    .first()
    .boundingBox();
  const summaryBox = await region.getByText(/Arriving in/).boundingBox();
  expect(mapBox && summaryBox && mapBox.y < summaryBox.y).toBe(true);

  // Details are behind labelled sections, closed until asked for.
  const route = region.getByRole("button", { name: "Route and addresses" });
  await expect(route).toHaveAttribute("aria-expanded", "false");
  await route.click();
  await expect(route).toHaveAttribute("aria-expanded", "true");
  await expect(region.getByText("Bahan, near Inya Road").last()).toBeVisible();
});

test("stale GPS and a late parcel each say what is wrong and offer a way to act", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    profiles: [me, rider],
    delivery_orders: [
      makeOrder({
        customer_id: "user-1",
        status: "in_transit",
        estimated_delivery_at: minutesAgo(30),
      }),
    ],
    delivery_assignments: [assign("order-1")],
    latest_delivery_locations: [here(minutesAgo(12))],
  });
  await page.goto("/track?order=order-1");
  const region = page.getByRole("region", { name: "Selected delivery" });
  await expect(region.getByText("Running late")).toBeVisible();
  await expect(region.getByText(/No new location for 12 min/)).toBeVisible();
  const call = region.getByRole("link", { name: "Call rider" });
  await expect(call).toHaveAttribute("href", "tel:+95 9 421 555 222");
});

test("a parcel before pickup leads with its assignment, not a countdown", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    profiles: [me, rider],
    delivery_orders: [makeOrder({ customer_id: "user-1", status: "accepted" })],
    delivery_assignments: [assign("order-1")],
  });
  await page.goto("/track?order=order-1");
  const region = page.getByRole("region", { name: "Selected delivery" });
  await expect(region.getByText("Waiting for pickup")).toBeVisible();
  await expect(region.getByText(/Aung Kyaw is assigned/)).toBeVisible();
  await expect(region.getByText(/Arriving in/)).toHaveCount(0);
  await expect(
    region.getByText("Live location starts at pickup"),
  ).toBeVisible();
});

test("a delivered parcel with unpaid COD opens its payment details", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    profiles: [me, rider],
    delivery_orders: [
      makeOrder({
        customer_id: "user-1",
        status: "delivered",
        cod_amount: 68000,
        cod_status: "pending",
      }),
    ],
    delivery_assignments: [assign("order-1")],
    delivery_status_events: [
      {
        id: "e1",
        order_id: "order-1",
        status: "delivered",
        note: null,
        created_at: minutesAgo(20),
      },
    ],
  });
  await page.goto("/track?order=order-1");
  const region = page.getByRole("region", { name: "Selected delivery" });
  await expect(region.getByText(/^Delivered /)).toBeVisible();
  await expect(region.getByText(/MMK\s?68,000/)).toBeVisible();
  await expect(region.getByText("Still due")).toBeVisible();
});

test("opening another parcel from Notifications while on Track switches to it", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    profiles: [me, rider],
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
        status: "failed",
      }),
    ],
    delivery_status_events: [
      {
        id: "e1",
        order_id: "order-2",
        status: "failed",
        note: "Recipient unavailable",
        created_at: minutesAgo(2),
      },
    ],
  });
  await page.goto("/track?order=order-1");
  await expect(page.getByRole("heading", { name: "OR-2001" })).toBeVisible();
  // The same navigation a notification link performs.
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/track?order=order-2";
    document.body.append(link);
    link.click();
  });
  await expect(page.getByRole("heading", { name: "OR-2002" })).toBeVisible();
});

test("Help asks which parcel when opened without one, then attaches it", async ({
  page,
  context,
}) => {
  const backend = await signInAs(context, "customer", {
    profiles: [me, rider],
    delivery_orders: [
      makeOrder({
        id: "order-1",
        tracking_code: "OR-3001",
        customer_id: "user-1",
        status: "in_transit",
      }),
      makeOrder({
        id: "order-2",
        tracking_code: "OR-3002",
        customer_id: "user-1",
        status: "accepted",
      }),
    ],
    delivery_assignments: [assign("order-1"), assign("order-2")],
  });
  await page.goto("/profile");
  await page.getByRole("button", { name: /Help and support/ }).click();
  const sheet = page.getByRole("dialog", { name: "Get help" });
  await expect(sheet.getByText("Which parcel is this about?")).toBeVisible();

  await sheet.getByRole("radio", { name: "Late or missing parcel" }).click();
  await sheet.getByLabel("Describe the problem").fill("Still waiting");
  // Choosing a parcel (or "Not about a parcel") is required first.
  await expect(
    sheet.getByRole("button", { name: "Send to support" }),
  ).toBeDisabled();
  await sheet.getByRole("radio", { name: /OR-3002/ }).click();
  await sheet.getByRole("button", { name: "Send to support" }).click();
  await expect(sheet.getByText(/Request sent/)).toBeVisible();
  expect(
    backend.mutations.find((item) => item.table === "support_cases")?.body,
  ).toMatchObject({ order_id: "order-2", requester_id: "user-1" });
});

test("Notifications is one timeline, newest first, with unread dots", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    profiles: [me, rider],
    delivery_orders: [
      makeOrder({
        id: "order-1",
        tracking_code: "OR-4001",
        customer_id: "user-1",
        status: "in_transit",
        created_at: minutesAgo(50),
      }),
      makeOrder({
        id: "order-2",
        tracking_code: "OR-4002",
        customer_id: "user-1",
        status: "delivered",
        created_at: minutesAgo(200),
      }),
    ],
    delivery_assignments: [assign("order-1")],
    delivery_status_events: [
      {
        id: "e1",
        order_id: "order-1",
        status: "in_transit",
        note: null,
        created_at: minutesAgo(3),
      },
      {
        id: "e2",
        order_id: "order-2",
        status: "delivered",
        note: null,
        created_at: minutesAgo(90),
      },
    ],
  });
  await page.goto("/notifications");
  const items = page
    .getByRole("list", { name: "Notifications" })
    .getByRole("link");
  // On the way, the COD reminder for the same parcel, and the delivered one.
  await expect(items).toHaveCount(3);
  await expect(items.first()).toContainText("OR-4001");
  await expect(items.first()).toContainText("3 min ago");
  await expect(items.first().getByText("Unread")).toBeAttached();
  // No filter chips or category labels any more.
  await expect(
    page.getByRole("group", { name: "Filter notifications" }),
  ).toHaveCount(0);
  await items.first().click();
  await expect(page).toHaveURL(/\/track\?order=order-1/);
});
