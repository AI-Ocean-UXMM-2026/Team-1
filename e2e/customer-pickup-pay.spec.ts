import type { Page } from "@playwright/test";

import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

const customer = {
  profiles: [
    {
      id: "user-1",
      full_name: "May Thazin",
      phone: "+95 9 421 555 018",
      role: "customer",
    },
  ],
  payment_settings: [{ id: true, sandbox: true }],
};

const created = {
  id: "order-new",
  tracking_code: "OR-7777",
  created_at: new Date().toISOString(),
};

const draft = JSON.stringify({
  pickupAddress: "Shwe Pyi Thar, Yangon",
  pickupPoint: { latitude: 16.96, longitude: 96.09 },
  deliveryAddress: "Bahan, Yangon",
  deliveryPoint: { latitude: 16.8046, longitude: 96.1507 },
  recipientName: "Daw Hnin",
  recipientPhone: "09 421 555 018",
  parcelSize: "Small",
});

async function toPayment(page: Page) {
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    ["oern.pickup-draft.v1", draft],
  );
  await page.goto("/pickup/payment");
}

test("the payment step offers pay now or pay later, defaulting to later", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", customer);
  await toPayment(page);
  const later = page.getByRole("radio", { name: /Pay later/ });
  await expect(later).toBeChecked();
  await expect(
    page.getByRole("radio", { name: /Pay MMK.* now/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/wait for confirmation before showing Paid/),
  ).toBeVisible();
});

test("a saved demo pay-now choice falls back safely when MMQR is not connected", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", {
    ...customer,
    payment_settings: [{ id: true, sandbox: false }],
  });
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [
      "oern.pickup-draft.v1",
      JSON.stringify({ ...JSON.parse(draft), payChoice: "now" }),
    ],
  );
  await page.goto("/pickup/payment");
  await expect(page.getByText(/pay after the request is sent/i)).toBeVisible();
  await page.getByRole("button", { name: /next: review/i }).click();
  await expect(page.getByText(/with Cash on delivery/)).toBeVisible();
  await expect(page.getByText(/scan its MMQR/i)).toHaveCount(0);
});

test("pay now creates the request first, then continues to its MMQR handoff", async ({
  context,
  page,
}) => {
  const { mutations } = await signInAs(context, "customer", customer, {
    rpc: {
      create_customer_pickup_order: () => created,
    },
  });
  await toPayment(page);
  await page.getByRole("radio", { name: /Pay MMK.* now/ }).check();
  await page.getByRole("button", { name: /next: review/i }).click();
  await expect(page.getByText(/scan its MMQR to pay MMK/)).toBeVisible();

  await page
    .getByRole("button", { name: "Request pickup and continue" })
    .click();
  await expect(page.getByText(/your tracking code is OR-7777/i)).toBeVisible();
  await expect(page.getByText(/not paid yet.*scan the MMQR/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continue to MMQR/ }),
  ).toHaveAttribute("href", "/track?order=order-new&pay=1");

  expect(mutations.some((m) => m.table === "sandbox_pay_order")).toBe(false);
});

test("passing on payment never charges", async ({ context, page }) => {
  const { mutations } = await signInAs(context, "customer", customer, {
    rpc: { create_customer_pickup_order: () => created },
  });
  await toPayment(page);
  await page.getByRole("button", { name: /next: review/i }).click();
  await page.getByRole("button", { name: "Request pickup" }).click();
  await expect(page.getByText(/your tracking code is OR-7777/i)).toBeVisible();
  expect(mutations.some((m) => m.table === "sandbox_pay_order")).toBe(false);
  await expect(page.getByText(/Pay online, share the link/)).toBeVisible();
});

test("the pickup flow never reports Paid before an MMQR confirmation", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", customer, {
    rpc: {
      create_customer_pickup_order: () => created,
    },
  });
  await toPayment(page);
  await page.getByRole("radio", { name: /Pay MMK.* now/ }).check();
  await page.getByRole("button", { name: /next: review/i }).click();
  await page
    .getByRole("button", { name: "Request pickup and continue" })
    .click();
  await expect(page.getByText(/your tracking code is OR-7777/i)).toBeVisible();
  await expect(page.getByText(/Paid · MMK/)).toHaveCount(0);
  await expect(page.getByText(/not paid yet/i)).toBeVisible();
});

test("Track shows a refund on a cancelled, paid order", async ({
  context,
  page,
}) => {
  const { makeOrder } = await import("./support/supabase-mock");
  await signInAs(context, "customer", {
    ...customer,
    delivery_orders: [
      makeOrder({
        customer_id: "user-1",
        status: "cancelled",
        cod_amount: 0,
        cod_status: "not_required",
        refunded_amount: 13800,
      }),
    ],
  });
  await page.goto("/track?order=order-1");
  // A cancelled parcel opens its details at once.
  await page.getByRole("button", { name: "Cash on delivery" }).click();
  await expect(page.getByText(/Refunded · MMK\s?13,800/)).toBeVisible();
});
