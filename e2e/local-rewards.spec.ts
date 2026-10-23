import { test } from "@playwright/test";

test("local rewards", async ({ page }) => {
  page.on("console", m => console.log("CONSOLE", m.type(), m.text()));
  page.on("requestfailed", r => console.log("REQFAILED", r.url(), r.failure()?.errorText));
  page.on("pageerror", e => console.log("PAGEERROR", e.message));
  await page.goto("/signin");
  await page.locator('input[type="email"]').fill("cust@test.local");
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(5000);
  console.log("URL after signin:", page.url());
});
