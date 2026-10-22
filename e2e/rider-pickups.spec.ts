import type { Page } from "@playwright/test";

import { swipeToConfirm } from "./support/swipe";
import { expect, test } from "./support/test";

/*
 * The "mixed" preview is a labelled sample of a committed truck plan: two
 * parcels already at the depot and four to collect from customers, with
 * pickups and deliveries interleaved the way the planner sequences them.
 * It runs the same driver-route logic and status rules as live data, with no
 * Supabase involved.
 */

async function arrive(page: Page) {
  await swipeToConfirm(page, /i.ve arrived/i);
  // The preview rider starts a few hundred metres away, so arrival asks first.
  await page.getByRole("button", { name: /yes, i.m here/i }).click();
}

test("a mixed pickup and delivery route runs from the depot load check to a failed pickup", async ({
  page,
}) => {
  await page.goto("/rider/route?preview=mixed");

  // Load check lists only what is already at the depot.
  const load = page.getByRole("region", { name: /check your load/i });
  await expect(load).toBeVisible();
  await expect(load).toContainText("SAMPLE-D1");
  await expect(load).toContainText("SAMPLE-D2");
  await expect(load).not.toContainText("SAMPLE-M1");
  await page.getByRole("button", { name: "Tick all" }).click();
  await page.getByRole("button", { name: /confirm 2 parcels loaded/i }).click();

  // Ready: the plan's stops interleave pickups and deliveries.
  await expect(page.getByText("Ready to start")).toBeVisible();
  await expect(
    page.getByText(/4 parcels to collect from customers/),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stop order" })).toBeVisible();
  const rows = page.locator(".dv-stop-list > li");
  await expect(rows).toHaveCount(10);
  await expect(rows.nth(0)).toContainText("Pick up · Sample shop A");
  await expect(rows.nth(1)).toContainText("Pick up · Sample shop B");
  await expect(rows.nth(2)).toContainText("Sample customer 1");
  await expect(rows.nth(0)).toContainText("Window");

  await swipeToConfirm(page, /start route · 10 stops/i);

  // The first stop is a pickup, not a delivery.
  const sheet = page.getByRole("region", { name: "Stop 1 of 10" });
  await expect(sheet).toContainText("Collect from Sample shop A");
  await arrive(page);
  await page.getByRole("button", { name: "Start pickup" }).click();

  // Locked until the parcel is checked.
  await expect(
    page.locator(".dv-swipe-label", { hasText: "Check the parcel" }),
  ).toBeVisible();
  await page.getByLabel(/weighed on the scale/i).fill("4.2");
  await swipeToConfirm(page, /collect parcel/i);
  await expect(
    page.locator(".dv-swipe-label", { hasText: "Check the parcel" }),
  ).toBeVisible();
  await page.getByText("SAMPLE-M1").click();
  await swipeToConfirm(page, /collect parcel/i);
  await expect(page.getByText(/Pickup 1 collected · 1 parcel/)).toBeVisible();

  // Next: the second pickup, even though parcel 1 is on board and its delivery is later in the plan.
  const second = page.getByRole("region", { name: "Stop 2 of 10" });
  await expect(second).toContainText("Collect from Sample shop B");
  await arrive(page);
  await page.getByRole("button", { name: "Start pickup" }).click();
  await page
    .getByRole("button", { name: /can.t collect this parcel/i })
    .click();
  await page.getByText("Nobody there").click();
  await swipeToConfirm(page, /record not collected/i);
  await expect(
    page.getByText(/Pickup 2 recorded as not collected/),
  ).toBeVisible();

  // Its delivery drops off the route; the next actionable stop is parcel 1's delivery.
  const next = page.getByRole("region", { name: "Stop 3 of 9" });
  await expect(next).toContainText("Sample customer 1");
  await expect(page.getByText("Sample customer 2")).toHaveCount(0);
  // Nothing says the driver's own actions were a dispatcher change.
  await expect(page.getByText(/taken off your route/i)).toHaveCount(0);
});

test("the pickup problem button opens the pickup form, not the delivery exceptions", async ({
  page,
}) => {
  await page.goto("/rider/route?preview=mixed");
  await page.getByRole("button", { name: "Tick all" }).click();
  await page.getByRole("button", { name: /confirm 2 parcels loaded/i }).click();
  await swipeToConfirm(page, /start route/i);
  await page
    .getByRole("button", { name: "Show stop details and full route" })
    .click();
  await page.getByRole("button", { name: /problem with this stop/i }).click();
  await expect(
    page.getByRole("button", { name: /can.t collect this parcel/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /recipient not there/i }),
  ).toHaveCount(0);
});

test("the pickup form needs a reason, and a description for 'something else'", async ({
  page,
}) => {
  await page.goto("/rider/route?preview=mixed");
  await page.getByRole("button", { name: "Tick all" }).click();
  await page.getByRole("button", { name: /confirm 2 parcels loaded/i }).click();
  await swipeToConfirm(page, /start route/i);
  await arrive(page);
  await page.getByRole("button", { name: "Start pickup" }).click();
  await page
    .getByRole("button", { name: /can.t collect this parcel/i })
    .click();
  await expect(page.getByText("Choose a reason")).toBeVisible();
  await page.getByText("Something else").click();
  await expect(page.getByText("Describe what happened")).toBeVisible();
  await page.getByLabel(/^Note/).fill("Gate locked");
  await expect(page.getByText("Swipe to record")).toBeVisible();
});
