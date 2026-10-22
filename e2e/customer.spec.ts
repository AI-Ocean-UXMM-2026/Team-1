import AxeBuilder from "@axe-core/playwright";
import { makeOrder, minutesAgo, signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

test("signed-out customers get a standalone sign-in page without app chrome (C-01)", async ({
  page,
}) => {
  await page.goto("/home?signin=1");
  await expect(
    page.getByRole("heading", { name: "Your parcel, in view." }),
  ).toBeVisible();
  // The app chrome may stay mounted behind the page, but it must be hidden
  // from assistive tech and unreachable, not sit beside the form.
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(0);

  const submit = page.getByRole("button", { name: "Sign in to your account" });
  await submit.scrollIntoViewIfNeeded();
  const box = await submit.boundingBox();
  if (!box) throw new Error("submit button has no box");
  const submitReachable = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest("button") !== null,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(submitReachable).toBe(true);

  await page.getByRole("link", { name: /create an account/i }).click();
  await expect(page).toHaveURL(/\/signup/);
});

test("ETA panel text meets contrast on Track (C-02)", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({ customer_id: "user-1", status: "in_transit" }),
    ],
    delivery_assignments: [
      {
        id: "a1",
        order_id: "order-1",
        driver_id: "driver-1",
        vehicle_id: null,
        route_id: null,
        assigned_at: minutesAgo(30),
        ended_at: null,
      },
    ],
    latest_delivery_locations: [
      {
        order_id: "order-1",
        latitude: 16.8,
        longitude: 96.15,
        accuracy_meters: 10,
        recorded_at: minutesAgo(9),
      },
    ],
  });
  await page.goto("/track?order=order-1");
  const delivery = page.getByRole("region", { name: "Selected delivery" });
  await expect(delivery.getByText(/Updated 9 min ago/)).toBeVisible();
  const results = await new AxeBuilder({ page: page as never })
    .include('[aria-label="Selected delivery"]')
    .withRules(["color-contrast"])
    .analyze();
  expect(results.violations.map((v) => v.nodes.map((n) => n.html))).toEqual([]);
});

test("COD amount on Track is at least 12px (H-06)", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({ customer_id: "user-1", status: "in_transit" }),
    ],
  });
  await page.goto("/track?order=order-1");
  const size = await page
    .getByRole("region", { name: "Selected delivery" })
    .getByText("MMK 68,000")
    .first()
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThanOrEqual(12);
});

test("Home keeps every active delivery visible", async ({ page, context }) => {
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({
        id: "moving-order",
        tracking_code: "OR-MOVING",
        customer_id: "user-1",
        status: "in_transit",
      }),
      makeOrder({
        id: "scheduled-order",
        tracking_code: "OR-SCHEDULED",
        customer_id: "user-1",
        status: "assigned",
        estimated_delivery_at: null,
      }),
    ],
  });

  await page.goto("/home");

  await expect(
    page.getByRole("heading", { name: "Next delivery" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Also on the way" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Other active deliveries" })
      .getByText("OR-SCHEDULED"),
  ).toBeVisible();
});
