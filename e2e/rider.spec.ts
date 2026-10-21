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
  await expect(
    page.getByRole("region", { name: /Stop 1 of 1|Check your load/ }),
  ).toBeVisible();
  return backend;
}

test("handover steps move forward and back (C-06)", async ({
  page,
  context,
}) => {
  await openRider(page, context, "in_transit");
  await page.getByRole("button", { name: /i.ve arrived/i }).click();
  await page.getByRole("button", { name: "Start handover" }).click();
  const next = page.getByRole("button", { name: "Continue to recipient" });
  await expect(next).toBeDisabled();

  // The checkbox is a custom control; the label is what a finger taps.
  await page.getByText("OR-9001").click();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(next).toHaveCount(0);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(next).toBeEnabled();
});

test("a failed write keeps the load check on screen (C-05)", async ({
  page,
  context,
}) => {
  await openRider(page, context, "accepted");
  await page.getByRole("button", { name: "Tick all" }).click();
  const confirm = page.getByRole("button", {
    name: /confirm 1 parcel loaded/i,
  });
  await expect(confirm).toBeVisible();

  await failSupabase(context);
  await confirm.click();

  // supabase-js retries failed requests for several seconds before giving up.
  await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByText(/your entries are kept/i)).toBeVisible();
  await expect(page.getByText("No deliveries assigned")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Check your load" }),
  ).toBeVisible();
});

test("a problem can be reported before arriving, without faking arrival (H-09)", async ({
  page,
  context,
}) => {
  await openRider(page, context, "in_transit");
  await page
    .getByRole("button", { name: "Show stop details and full route" })
    .click();
  await page.getByRole("button", { name: /can.t deliver this stop/i }).click();
  await expect(
    page.getByRole("button", { name: /recipient not there/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /wrong or incomplete address/i }),
  ).toBeVisible();
  // Reporting is not arriving: the stop must not have advanced.
  await expect(
    page.getByRole("button", { name: "Start handover" }),
  ).toHaveCount(0);
});

test("shift tools show their own errors (H-11)", async ({ page, context }) => {
  // No geolocation permission: a road report cannot be placed.
  await signInAs(context, "driver", {
    delivery_orders: [makeOrder({ status: "in_transit" })],
    delivery_assignments: [assignment],
  });
  await page.goto("/rider/route");
  await page.getByRole("button", { name: "Shift tools" }).first().click();
  await page.getByRole("button", { name: /^Road conditions/ }).click();
  await page.getByRole("button", { name: "Report a road condition" }).click();
  const menu = page.getByRole("dialog");
  await menu.getByLabel("What did you see?").fill("Left lane closed");
  await expect(menu.getByText(/location is needed/i)).toBeVisible();
  await expect(
    menu.getByRole("button", { name: "Send with my location" }),
  ).toBeDisabled();
});
