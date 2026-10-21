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
  const stop = page.getByRole("region", { name: /Stop 1 of 1/ });
  await expect(stop).toBeVisible();
  const isDark = (color: string) => {
    const [r, g, b] = color.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
    return (r + g + b) / 3 < 80;
  };
  // The first opaque background at or above the sheet is what the rider sees.
  const surfaceOf = (locator: typeof stop) =>
    locator.evaluate((node) => {
      for (let el: Element | null = node; el; el = el.parentElement) {
        const color = getComputedStyle(el).backgroundColor;
        if (!/rgba\(.*, 0\)|transparent/.test(color)) return color;
      }
      return "rgb(255, 255, 255)";
    });
  const surface = await surfaceOf(stop);
  expect(isDark(surface), `stop sheet ${surface} is not dark`).toBe(true);
  await page.getByRole("button", { name: /i.ve arrived/i }).click();
  await page.getByRole("button", { name: "Start handover" }).click();
  const handover = page.getByRole("group", { name: "Verify the parcel" });
  await expect(handover).toBeVisible();
  const outcome = await surfaceOf(handover);
  expect(isDark(outcome), `handover ${outcome} is not dark`).toBe(true);
});
