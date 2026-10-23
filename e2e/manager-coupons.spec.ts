import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

const coupon = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  code: "WELCOME",
  kind: "percent",
  value: 20,
  min_fee: 0,
  max_discount: 1000,
  starts_at: null,
  ends_at: null,
  max_redemptions: 10,
  per_customer_limit: 1,
  active: true,
  created_by: null,
  created_at: "2026-10-20T00:00:00Z",
  ...over,
});

const tables = () => ({
  coupons: [
    coupon(),
    coupon({ id: "c2", code: "OLD", ends_at: "2026-01-01T00:00:00Z" }),
  ],
  coupon_redemptions: [
    { coupon_id: "c1", amount: 600 },
    { coupon_id: "c1", amount: 400 },
  ],
});

test("the manager sees every coupon with its use and state", async ({
  context,
  page,
}) => {
  await signInAs(context, "manager", tables());
  await page.goto("/manager/coupons");

  const row = page.getByRole("row", { name: /WELCOME/ });
  await expect(row).toContainText("20% off the fee, up to 1,000 MMK");
  await expect(row).toContainText("2 of 10");
  await expect(row).toContainText("Active");
  await expect(page.getByRole("row", { name: /OLD/ })).toContainText("Expired");
  await expect(
    page.locator('a[href="/manager/coupons"]').first(),
  ).toHaveAttribute("aria-current", "page");
});

test("a new coupon is validated, then saved", async ({ context, page }) => {
  const { mutations } = await signInAs(context, "manager", tables());
  await page.goto("/manager/coupons");
  await page.getByRole("button", { name: "New coupon" }).click();

  await page.getByRole("button", { name: "Save coupon" }).click();
  await expect(page.getByText(/3 to 24 letters/)).toBeVisible();
  await expect(page.getByText(/whole number above 0/)).toBeVisible();

  await page.getByLabel("Code").fill("save 10");
  await page.getByRole("textbox", { name: /Percent/ }).fill("10");
  await page.getByLabel("Total uses").fill("50");
  await page.getByRole("button", { name: "Save coupon" }).click();

  await expect(page.getByRole("dialog")).toBeHidden();
  const insert = mutations.find(
    (m) => m.table === "coupons" && m.method === "POST",
  );
  expect(insert?.body).toMatchObject({
    code: "SAVE10",
    kind: "percent",
    value: 10,
    max_redemptions: 50,
    min_fee: 0,
  });
});

test("turning a coupon off asks first and keeps it if cancelled", async ({
  context,
  page,
}) => {
  const { mutations } = await signInAs(context, "manager", tables());
  await page.goto("/manager/coupons");

  await page.getByRole("button", { name: "Turn off WELCOME" }).click();
  await page.getByRole("button", { name: "Keep on" }).click();
  expect(mutations.some((m) => m.method === "PATCH")).toBe(false);

  await page.getByRole("button", { name: "Turn off WELCOME" }).click();
  await page.getByRole("button", { name: "Turn off", exact: true }).click();
  const patch = mutations.find((m) => m.method === "PATCH");
  expect(patch?.body).toEqual({ active: false });
});

test("a duplicate code is reported on the sheet", async ({ context, page }) => {
  await signInAs(context, "manager", tables());
  await context.route("**/rest/v1/coupons", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return route.fulfill({
      status: 409,
      json: { code: "23505", message: "duplicate key" },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/manager/coupons");
  await page.getByRole("button", { name: "New coupon" }).click();
  await page.getByLabel("Code").fill("WELCOME");
  await page.getByRole("textbox", { name: /Percent/ }).fill("10");
  await page.getByRole("button", { name: "Save coupon" }).click();
  await expect(page.getByText("That code already exists.")).toBeVisible();
});

test("a manual order applies a manager coupon to the fee", async ({
  context,
  page,
}) => {
  await signInAs(context, "manager", tables(), {
    rpc: {
      validate_coupon: () => ({ coupon_id: "c1", discount: 500, reason: null }),
    },
  });
  await page.goto("/manager/order/create");
  await page.getByLabel("Coupon code").fill("welcome");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Coupon WELCOME")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
  await expect(page.getByText(/use points/i)).toHaveCount(0);
});
