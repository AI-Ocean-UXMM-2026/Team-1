import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

const DRAFT_KEY = "oern.pickup-draft.v1";

const tables = (balance?: number) => ({
  profiles: [
    {
      id: "user-1",
      full_name: "May Thazin",
      phone: "+95 9 421 555 018",
      role: "customer",
    },
  ],
  loyalty_balances: balance ? [{ customer_id: "user-1", balance }] : [],
});

const created = {
  id: "order-new",
  tracking_code: "OR-7777",
  created_at: new Date().toISOString(),
};

const draft = JSON.stringify({
  pickupAddress: "12 Pyay Road, Kamayut",
  pickupPoint: { latitude: 16.78, longitude: 96.15 },
  deliveryAddress: "Bahan, near Inya Road",
  deliveryPoint: { latitude: 16.82, longitude: 96.13 },
  recipientName: "Daw Hnin",
  recipientPhone: "09 421 555 018",
  parcelKind: "Documents",
  parcelSize: "Small",
  paymentMethod: "cod",
  payer: "me",
});

const coupons: Record<string, number> = { WELCOME: 500 };

const rpc = {
  create_customer_pickup_order: () => created,
  validate_coupon: (args: Record<string, unknown>) => {
    const discount = coupons[String(args.p_code)];
    return discount
      ? { coupon_id: "coupon-1", discount, reason: null }
      : { coupon_id: null, discount: 0, reason: "This coupon has expired." };
  },
  redeem_order_rewards: (args: Record<string, unknown>) => ({
    discount: 500,
    cod_amount: Number(args.p_fee) - 500,
  }),
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    [DRAFT_KEY, draft],
  );
});

test("a valid coupon lowers the fee and is redeemed on the new order", async ({
  context,
  page,
}) => {
  const { mutations } = await signInAs(context, "customer", tables(), { rpc });
  await page.goto("/pickup/payment");
  await page.getByRole("button", { name: /coupon/i }).click();
  await page.getByLabel("Coupon code").fill("welcome");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByText("Saves", { exact: false })).toBeVisible();
  await expect(page.getByText("Coupon WELCOME")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();

  await page.getByRole("button", { name: /next: review/i }).click();
  await page.getByRole("button", { name: "Request pickup" }).click();
  await expect(page.getByText(/your tracking code is OR-7777/i)).toBeVisible();

  const redeem = mutations.find((m) => m.table === "redeem_order_rewards")
    ?.body as Record<string, unknown>;
  expect(redeem).toMatchObject({
    p_order_id: "order-new",
    p_coupon_code: "WELCOME",
    p_points: 0,
  });
});

test("an unusable coupon shows why and changes nothing", async ({
  context,
  page,
}) => {
  const { mutations } = await signInAs(context, "customer", tables(), { rpc });
  await page.goto("/pickup/payment");
  await page.getByRole("button", { name: /coupon/i }).click();
  await page.getByLabel("Coupon code").fill("OLDCODE");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("#pickup-coupon-error")).toHaveText(/expired/i);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: /next: review/i }).click();
  await page.getByRole("button", { name: "Request pickup" }).click();
  await expect(page.getByText(/your tracking code is OR-7777/i)).toBeVisible();
  expect(mutations.some((m) => m.table === "redeem_order_rewards")).toBe(false);
});

test("points are spent on the fee up to half of it", async ({
  context,
  page,
}) => {
  const { mutations } = await signInAs(context, "customer", tables(1000), {
    rpc,
  });
  await page.goto("/pickup/payment");
  await page.getByLabel(/use points/i).check();
  await expect(page.getByText(/points · save/i)).toBeVisible();

  await page.getByRole("button", { name: /next: review/i }).click();
  await page.getByRole("button", { name: "Request pickup" }).click();
  await expect(page.getByText(/your tracking code is OR-7777/i)).toBeVisible();

  const redeem = mutations.find((m) => m.table === "redeem_order_rewards")
    ?.body as Record<string, unknown>;
  expect(Number(redeem.p_points)).toBeGreaterThan(0);
  expect(redeem.p_coupon_code).toBeNull();
});

test("the order still goes through when rewards cannot be applied", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", tables(), {
    rpc: {
      ...rpc,
      redeem_order_rewards: () => {
        throw new Error("Coupon cannot be used on this order");
      },
    },
  });
  await page.goto("/pickup/payment");
  await page.getByRole("button", { name: /coupon/i }).click();
  await page.getByLabel("Coupon code").fill("WELCOME");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Coupon WELCOME")).toBeVisible();
  await page.getByRole("button", { name: /next: review/i }).click();
  await page.getByRole("button", { name: "Request pickup" }).click();
  await expect(page.getByText(/your tracking code is OR-7777/i)).toBeVisible();
  await expect(page.getByText(/could not be applied/i)).toBeVisible();
});
