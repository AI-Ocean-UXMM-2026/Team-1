import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { makeOrder, minutesAgo, signInAs } from "./support/supabase-mock";

test("sign-in dialog covers the app chrome (C-01)", async ({ page }) => {
  await page.goto("/home?signin=1");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /create an account/i }).click();

  const covered = await page.evaluate(() => {
    const underneath = [
      document.querySelector("nav a"),
      document.querySelector("header button, header a"),
    ];
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
  expect(covered, "nav and header must sit beneath the modal").toEqual([
    "covered",
    "covered",
  ]);

  const submit = dialog.locator('button[type="submit"]');
  await submit.scrollIntoViewIfNeeded();
  const box = (await submit.boundingBox())!;
  const submitReachable = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[role="dialog"]'),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(submitReachable).toBe(true);
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
  await page.goto("/track");
  await expect(page.locator(".tracking-freshness-row")).toBeVisible();
  const results = await new AxeBuilder({ page: page as never })
    .include(".eta-panel")
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
  await page.goto("/track");
  const size = await page
    .locator(".cod-card strong")
    .first()
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThanOrEqual(12);
});
