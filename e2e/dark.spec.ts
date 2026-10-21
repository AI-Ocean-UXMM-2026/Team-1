import { makeOrder, signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

test.use({ colorScheme: "dark" });

test("rider screens use the dark theme at night (H-13)", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 16.79, longitude: 96.145 });
  await signInAs(context, "driver", {
    delivery_orders: [makeOrder({ status: "in_transit" })],
    delivery_assignments: [
      {
        id: "a1",
        order_id: "order-1",
        driver_id: "driver-1",
        vehicle_id: null,
        route_id: null,
        assigned_at: new Date().toISOString(),
        ended_at: null,
      },
    ],
  });
  await page.goto("/rider/route");
  await expect(page.getByText(/Stop 1 of 1/)).toBeVisible();
  const isDark = (color: string) => {
    const [r, g, b] = color.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
    return (r + g + b) / 3 < 80;
  };
  const surface = await page
    .locator(".rf-app")
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(isDark(surface), `background ${surface} is not dark`).toBe(true);
  await page.getByRole("button", { name: /i.ve arrived/i }).click();
  await page.getByRole("button", { name: /report delivery outcome/i }).click();
  await page.screenshot({ path: "test-results/dark-outcome.png" });
  const outcome = await page
    .locator(".rf-app")
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(isDark(outcome)).toBe(true);
});
