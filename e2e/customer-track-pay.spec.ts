import { makeOrder, signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

/** Opens the delivery details sheet and its cash on delivery section. */
async function openPayment(page: import("@playwright/test").Page) {
  await page.goto("/track?order=order-1");
  const region = page.getByRole("region", { name: "Selected delivery" });
  await region.getByRole("button", { name: "View delivery details" }).click();
  await region.getByRole("button", { name: "Cash on delivery" }).click();
}

const me = {
  id: "user-1",
  full_name: "May Thazin",
  phone: null,
  role: "customer",
};

const order = (over: Record<string, unknown> = {}) =>
  makeOrder({
    customer_id: "user-1",
    status: "assigned",
    cod_amount: 12000,
    delivery_fee: 7000,
    discount_amount: 0,
    ...over,
  });

const rpc = {
  validate_coupon: (args: Record<string, unknown>) =>
    args.p_code === "WELCOME"
      ? { coupon_id: "c1", discount: 1000, reason: null }
      : { coupon_id: null, discount: 0, reason: "This coupon has expired." },
  redeem_order_rewards: () => ({ discount: 1000, cod_amount: 11000 }),
};

test("a pay link opens MMQR with CTZPay inside it, and cash as the other option", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", {
    profiles: [me],
    delivery_orders: [order()],
  });
  await openPayment(page);

  await expect(page.getByText(/How would you like to pay/)).toBeVisible();
  const mmqr = page.getByRole("radio", { name: /MMQR/ });
  await expect(mmqr).toBeChecked();
  await expect(page.getByText(/CTZPay, KBZPay/)).toBeVisible();
  await expect(
    page.getByText(/CTZPay or any participating bank and wallet app/),
  ).toBeVisible();

  await page.getByRole("radio", { name: /Cash to the rider/ }).check();
  await expect(
    page.getByText(/to the rider when the parcel arrives/),
  ).toBeVisible();
});

test("the owner applies a coupon on Track before paying", async ({
  context,
  page,
}) => {
  const { mutations } = await signInAs(
    context,
    "customer",
    { profiles: [me], delivery_orders: [order()], loyalty_balances: [] },
    { rpc },
  );
  await openPayment(page);

  await page.getByLabel("Coupon code").fill("welcome");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("Saves", { exact: false })).toBeVisible();

  await page
    .getByRole("button", { name: /Apply discount · MMK\s?11,000 to pay/ })
    .click();
  const call = mutations.find((m) => m.table === "redeem_order_rewards")
    ?.body as Record<string, unknown>;
  expect(call).toMatchObject({
    p_order_id: "order-1",
    p_fee: 7000,
    p_coupon_code: "WELCOME",
    p_points: 0,
  });
});

test("points can be spent on Track too", async ({ context, page }) => {
  const { mutations } = await signInAs(
    context,
    "customer",
    {
      profiles: [me],
      delivery_orders: [order()],
      loyalty_balances: [{ customer_id: "user-1", balance: 1000 }],
    },
    { rpc },
  );
  await openPayment(page);
  await expect(async () => {
    await page.getByLabel(/use points/i).check({ timeout: 1500 });
  }).toPass();
  await expect(page.getByText(/Use points · save/)).toBeVisible();
  await page.getByRole("button", { name: /Apply discount/ }).click();
  const call = mutations.find((m) => m.table === "redeem_order_rewards")
    ?.body as Record<string, unknown>;
  // Half of the 7,000 fee at 10 MMK a point.
  expect(call.p_points).toBe(350);
});

test("an order that already has a discount shows it instead of the controls", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", {
    profiles: [me],
    delivery_orders: [order({ discount_amount: 1000, cod_amount: 11000 })],
  });
  await openPayment(page);
  await expect(page.getByText(/Discount applied · −MMK\s?1,000/)).toBeVisible();
  await expect(page.getByLabel("Coupon code")).toHaveCount(0);
});

test("a parcel the rider already collected no longer offers rewards", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", {
    profiles: [me],
    delivery_orders: [order({ status: "in_transit" })],
  });
  await openPayment(page);
  await expect(page.getByText(/How would you like to pay/)).toBeVisible();
  await expect(page.getByLabel("Coupon code")).toHaveCount(0);
});

test("sandbox provider confirmation shows a wait state, then Paid", async ({
  context,
  page,
}) => {
  const { mutations } = await signInAs(
    context,
    "customer",
    {
      profiles: [me],
      delivery_orders: [order()],
      payment_settings: [{ id: true, sandbox: true }],
    },
    {
      rpc: {
        sandbox_pay_order: () => ({ paid: 12000, cod_amount: 0 }),
      },
    },
  );
  await openPayment(page);
  await page
    .getByRole("button", { name: "Simulate provider confirmation" })
    .click();
  await expect(page.getByText("Waiting for provider…")).toBeVisible();
  await expect(page.getByText(/Paid · MMK\s?12,000/)).toBeVisible();
  await expect(page.getByText(/rider sees this right away/)).toBeVisible();

  const call = mutations.find((m) => m.table === "sandbox_pay_order")
    ?.body as Record<string, unknown>;
  expect(call).toMatchObject({ p_tracking_code: "OR-9001", p_method: "mmqr" });
});

test("without sandbox mode the provider connection requirement is explicit", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", {
    profiles: [me],
    delivery_orders: [order()],
    payment_settings: [{ id: true, sandbox: false }],
  });
  await openPayment(page);
  await expect(
    page.getByText(/after a payment provider is connected/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Simulate provider confirmation/ }),
  ).toHaveCount(0);
});

test("a failed sandbox payment can be retried", async ({ context, page }) => {
  let attempts = 0;
  await signInAs(
    context,
    "customer",
    {
      profiles: [me],
      delivery_orders: [order()],
      payment_settings: [{ id: true, sandbox: true }],
    },
    {
      rpc: {
        sandbox_pay_order: () => {
          attempts += 1;
          if (attempts === 1) throw new Error("fetch failed");
          return { paid: 12000, cod_amount: 0 };
        },
      },
    },
  );
  await openPayment(page);
  await page
    .getByRole("button", { name: "Simulate provider confirmation" })
    .click();
  await expect(page.getByText(/did not go through/)).toBeVisible();
  await page
    .getByRole("button", { name: "Simulate provider confirmation" })
    .click();
  await expect(page.getByText(/Paid · MMK/)).toBeVisible();
});
