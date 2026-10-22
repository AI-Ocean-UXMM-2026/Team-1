import AxeBuilder from "@axe-core/playwright";
import { makeOrder, minutesAgo, signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

test("sign-in dialog covers the app chrome (C-01)", async ({ page }) => {
  await page.goto("/home?signin=1");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /create an account/i }).click();

  const covered = await page.evaluate(() => {
    const underneath = [document.querySelector("nav a, nav button")];
    return underneath.map((node) => {
      if (!node) return "missing";
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return hit?.closest(".dialog-backdrop") ? "covered" : "exposed";
    });
  });
  expect(covered, "the nav must sit beneath the modal").toEqual(["covered"]);

  const submit = dialog.locator('button[type="submit"]');
  await submit.scrollIntoViewIfNeeded();
  const box = await submit.boundingBox();
  if (!box) throw new Error("submit button has no box");
  const submitReachable = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[role="dialog"]'),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(submitReachable).toBe(true);
});

test("tracking detail has no contrast failures (C-02)", async ({
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
  await expect(
    page.getByRole("region", { name: "Selected delivery" }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page: page as never })
    .include('[aria-label="Selected delivery"]')
    .withRules(["color-contrast"])
    .analyze();
  expect(
    results.violations.map((v) => v.nodes.map((n) => n.html.slice(0, 120))),
  ).toEqual([]);
});
