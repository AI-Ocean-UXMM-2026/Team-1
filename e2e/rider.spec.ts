import { failSupabase, makeOrder, signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

const assignment = {
  id: "assignment-1",
  order_id: "order-1",
  driver_id: "driver-1",
  vehicle_id: null,
  route_id: null,
  assigned_at: new Date().toISOString(),
  ended_at: null,
};

async function openRider(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  status: string,
) {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 16.79, longitude: 96.145 });
  const backend = await signInAs(context, "driver", {
    delivery_orders: [makeOrder({ status })],
    delivery_assignments: [assignment],
  });
  await page.goto("/rider/route");
  await expect(page.getByText(/Stop 1 of 1/)).toBeVisible();
  return backend;
}

test("outcome: tapping the already-selected result still advances (C-06)", async ({
  page,
  context,
}) => {
  await openRider(page, context, "in_transit");
  await page.getByRole("button", { name: /i.ve arrived/i }).click();
  await page.getByRole("button", { name: /report delivery outcome/i }).click();
  await page.getByText("Delivered successfully").click();
  await expect(
    page.getByRole("heading", { name: "Delivery details" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(
    page.getByRole("heading", { name: "How did this delivery go?" }),
  ).toBeVisible();

  // The radio is still checked, so no change event fires on this tap.
  await page.getByText("Delivered successfully").click();
  await expect(
    page.getByRole("heading", { name: "Delivery details" }),
  ).toBeVisible();
});

test("a failed write keeps the active stop on screen (C-05)", async ({
  page,
  context,
}) => {
  await openRider(page, context, "accepted");
  await page.getByRole("button", { name: /i.ve arrived/i }).click();
  const collect = page.getByRole("button", { name: /parcel collected/i });
  await expect(collect).toBeVisible();

  await failSupabase(context);
  await collect.click();

  // supabase-js retries failed reads for several seconds before giving up; the
  // old behavior then emptied the route.
  await expect(page.getByText("Showing your saved route")).toBeVisible({
    timeout: 25_000,
  });
  // The failure is reported, and the stop stays available to retry.
  await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible();
  await expect(page.getByText("No deliveries assigned")).toHaveCount(0);
  await expect(collect).toBeVisible();
});

test("a problem can be reported before arriving, without faking arrival (H-09)", async ({
  page,
  context,
}) => {
  await openRider(page, context, "accepted");
  await page.getByRole("button", { name: "Report a problem" }).click();
  await expect(page.getByLabel("Recipient unavailable")).toBeVisible();
  await expect(page.getByLabel("Incorrect address")).toBeVisible();
});

test("shift tools show their own errors (H-11)", async ({ page, context }) => {
  // No geolocation permission: a road report cannot be placed.
  await signInAs(context, "driver", {
    delivery_orders: [makeOrder({ status: "in_transit" })],
    delivery_assignments: [assignment],
  });
  await page.goto("/rider/route");
  await page
    .getByRole("button", { name: "Help and shift tools" })
    .first()
    .click();
  const menu = page.getByRole("dialog");
  await menu.getByLabel("What did you see?").fill("Left lane closed");
  await menu.getByRole("button", { name: "Send with my location" }).click();
  await expect(menu.getByText(/location is needed/i)).toBeVisible();
});
