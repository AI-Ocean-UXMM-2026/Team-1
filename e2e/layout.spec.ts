import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

const publicRoutes = ["/welcome", "/home", "/track", "/orders", "/profile"];
const teamRoutes = [
  ["manager", "/manager/home"],
  ["manager", "/manager/order"],
  ["manager", "/manager/track"],
  ["manager", "/manager/profile"],
  ["manager", "/manager/insights"],
  ["seller", "/seller"],
  ["support", "/support"],
] as const;

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, "page scrolls sideways").toBeLessThanOrEqual(client);
}

for (const route of publicRoutes) {
  test(`customer ${route} fits the viewport`, async ({ page }) => {
    await page.goto(route);
    await expectNoHorizontalScroll(page);
  });
}

for (const [role, route] of teamRoutes) {
  test(`${role} ${route} fits the viewport`, async ({ page, context }) => {
    await signInAs(context, role);
    await page.goto(route);
    await expectNoHorizontalScroll(page);
  });
}
