import {
  failSupabase,
  makeOrder,
  makeRoute,
  signInAs,
} from "./support/supabase-mock";
import { swipeToConfirm } from "./support/swipe";
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
  await swipeToConfirm(page, /i.ve arrived/i);
  // The test position is a few km from the stop, so arrival asks first.
  await page.getByRole("button", { name: /yes, i.m here/i }).click();
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
  await page.getByRole("button", { name: /problem with this stop/i }).click();
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
  // The map's own button opens road conditions without going through the menu.
  await page
    .getByRole("button", { name: "Road conditions", exact: true })
    .click();
  await page.getByRole("button", { name: "Report a road condition" }).click();
  const menu = page.getByRole("dialog");
  await menu.getByLabel("What did you see?").fill("Left lane closed");
  await expect(menu.getByText(/location is needed/i)).toBeVisible();
  await expect(
    menu.getByRole("button", { name: "Send with my location" }),
  ).toBeDisabled();
});

test("arriving far from the stop asks before telling the customer", async ({
  page,
  context,
}) => {
  await openRider(page, context, "in_transit");
  await swipeToConfirm(page, /i.ve arrived/i);
  await expect(page.getByText(/km away\. arrived anyway\?/i)).toBeVisible();
  await page.getByRole("button", { name: "Not yet" }).click();
  await expect(
    page.getByRole("button", { name: "Start handover" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /i.ve arrived/i }),
  ).toBeVisible();
});

test("the timeline shows COD amounts and flags promises out of route order", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 16.79, longitude: 96.145 });
  await signInAs(context, "driver", makeRoute());
  await page.goto("/rider/route");
  const sheet = page.getByRole("region", { name: "Stop 1 of 4" });
  await expect(sheet).toBeVisible();
  await page
    .getByRole("button", { name: "Show stop details and full route" })
    .click();
  const rows = sheet.locator(".dv-stop-row.is-dense");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Thuriya Ye Naing");
  await expect(rows.nth(0).locator(".is-warn")).toHaveCount(0);
  // Stop 3 was promised before stop 2, which comes first on the route.
  await expect(rows.nth(1)).toContainText("125K cash");
  await expect(rows.nth(1).locator(".dv-stop-state.is-warn")).toBeVisible();
  await expect(sheet.getByText(/\+1 more stop after these/)).toBeVisible();
});

test("the map shows the posted speed limit and flags speeding", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await page.addInitScript(() => {
    const fix = {
      coords: {
        latitude: 16.79,
        longitude: 96.145,
        heading: 20,
        speed: 14,
        accuracy: 8,
      },
      timestamp: Date.now(),
    };
    navigator.geolocation.watchPosition = (ok) => {
      setTimeout(() => ok(fix as never), 50);
      return 1;
    };
  });
  await page.route("**/directions/v5/**", (route) =>
    route.fulfill({
      json: {
        routes: [
          {
            distance: 4200,
            duration: 780,
            geometry: {
              coordinates: [
                [96.145, 16.79],
                [96.1451, 16.7905],
                [96.146, 16.8],
              ],
            },
            legs: [
              {
                annotation: {
                  maxspeed: [
                    { speed: 40, unit: "km/h" },
                    { speed: 40, unit: "km/h" },
                  ],
                },
                steps: [],
              },
            ],
          },
        ],
      },
    }),
  );
  await signInAs(context, "driver", {
    delivery_orders: [makeOrder({ status: "in_transit" })],
    delivery_assignments: [assignment],
  });
  await page.goto("/rider/route");
  const sign = page.getByRole("group", {
    name: "Speed limit 40 kilometres per hour",
  });
  await expect(sign).toBeVisible();
  // 14 m/s is 50 km/h, over the limit of 40.
  await expect(sign.locator(".dv-now.is-over")).toContainText("50");
});

test("tapping or half-swiping arrive does not confirm it", async ({
  page,
  context,
}) => {
  await openRider(page, context, "in_transit");
  const knob = page.getByRole("button", { name: /i.ve arrived/i });
  await knob.click();
  await swipeToConfirm(page, /i.ve arrived/i, 0.4);
  await expect(page.getByText(/arrived anyway/i)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start handover" }),
  ).toHaveCount(0);
  await expect(knob).toBeVisible();
});

test("cash due sits above the swipe, not in the stop header", async ({
  page,
  context,
}) => {
  await openRider(page, context, "in_transit");
  const actions = page.locator(".dv-sheet-actions");
  await expect(actions.getByText("Collect cash")).toBeVisible();
  await expect(actions.getByText(/68,000/)).toBeVisible();
  await expect(page.locator(".dv-stop-head").getByText(/68,000/)).toHaveCount(
    0,
  );
});
