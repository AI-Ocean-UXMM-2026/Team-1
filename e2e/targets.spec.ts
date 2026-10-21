import { makeOrder, signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

// Brand links and the map-provider attribution are not task controls.
const ignored = (control: { cls: string; text: string }) =>
  control.cls.includes("brand-lockup") ||
  /OpenStreetMap|Mapbox/i.test(control.text);

test("customer controls meet the 44px minimum (M-01)", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({ customer_id: "user-1", status: "in_transit" }),
      makeOrder({
        id: "order-2",
        tracking_code: "OR-2",
        customer_id: "user-1",
        status: "assigned",
      }),
    ],
  });
  for (const path of [
    "/home",
    "/track",
    "/orders",
    "/profile",
    "/home?signin=1",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const small = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          "button, a[href], input:not([type=hidden]), select, textarea",
        ),
      ]
        .map((el) => {
          const box = el.getBoundingClientRect();
          return {
            text: (
              el.textContent ||
              el.getAttribute("aria-label") ||
              el.tagName
            )
              .trim()
              .slice(0, 30),
            cls: String(el.className),
            w: Math.round(box.width),
            h: Math.round(box.height),
          };
        })
        .filter((c) => c.w > 0 && c.h > 0 && (c.h < 44 || c.w < 44)),
    );
    expect(
      small.filter((c) => !ignored(c)),
      path,
    ).toEqual([]);
  }
});
