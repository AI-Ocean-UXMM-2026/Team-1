import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

const profiles = [
  {
    id: "user-1",
    full_name: "May Thazin",
    phone: "+95 9 421 555 018",
    role: "customer",
  },
];

const rewardTables = {
  profiles,
  loyalty_balances: [{ customer_id: "user-1", balance: 42 }],
  loyalty_ledger: [
    {
      id: "l1",
      customer_id: "user-1",
      delta: 5,
      reason: "delivered",
      order_id: "o1",
      created_at: "2026-10-20T08:00:00Z",
    },
    {
      id: "l2",
      customer_id: "user-1",
      delta: -3,
      reason: "redeemed",
      order_id: "o2",
      created_at: "2026-10-21T08:00:00Z",
    },
  ],
  coupons: [
    {
      id: "c1",
      code: "WELCOME",
      kind: "percent",
      value: 20,
      min_fee: 2000,
      max_discount: 1000,
      starts_at: null,
      ends_at: "2026-12-31T00:00:00Z",
      max_redemptions: null,
      per_customer_limit: 1,
    },
  ],
};

test("the Rewards page shows balance, coupons and a filterable history", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", rewardTables);
  await page.goto("/profile/rewards");

  await expect(page.getByText("Points available")).toBeVisible();
  await expect(page.getByLabel("Points balance")).toContainText("42");
  await expect(
    page.getByText("20% off the fee, up to 1,000 MMK"),
  ).toBeVisible();
  await expect(page.getByText("WELCOME", { exact: true })).toBeVisible();

  await expect(page.getByText("Delivery completed")).toBeVisible();
  await expect(page.getByText("Used on a delivery fee")).toBeVisible();
  await page.getByRole("tab", { name: "Earned" }).click();
  await expect(page.getByText("Used on a delivery fee")).toBeHidden();
  await page.getByRole("tab", { name: "Used" }).click();
  await expect(page.getByText("Delivery completed")).toBeHidden();
  await expect(page.getByText("−3 points")).toBeVisible();
});

test("an empty account explains how points are earned", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", {
    profiles,
    loyalty_balances: [],
    loyalty_ledger: [],
    coupons: [],
  });
  await page.goto("/profile/rewards");
  await expect(page.getByText(/no coupons right now/i)).toBeVisible();
  await expect(page.getByText(/no points yet/i)).toBeVisible();
});

test("using a coupon stores it in the pickup draft", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", rewardTables);
  await page.goto("/profile/rewards");
  await page.getByRole("button", { name: "Use WELCOME at checkout" }).click();
  await expect(page).toHaveURL(/\/pickup$/);
  expect(
    await page.evaluate(() => localStorage.getItem("oern.pickup-draft.v1")),
  ).toContain("WELCOME");
});

test("the Profile and Home screens link to rewards", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", rewardTables);
  await page.goto("/profile");
  await expect(
    page.getByRole("link", { name: /coupons and points/i }),
  ).toHaveAttribute("href", "/profile/rewards");

  await page.goto("/home");
  await expect(page.getByRole("link", { name: /42 points/i })).toHaveAttribute(
    "href",
    "/profile/rewards",
  );
});

test("a signed-out visitor is asked to sign in", async ({ page }) => {
  await page.goto("/profile/rewards");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
