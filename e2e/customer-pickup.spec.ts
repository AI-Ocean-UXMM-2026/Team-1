import type { Page } from "@playwright/test";

import { signInAs } from "./support/supabase-mock";
import { expect, test } from "./support/test";

const DRAFT_KEY = "oern.pickup-draft.v1";

const customerTables = () => ({
  profiles: [
    {
      id: "user-1",
      full_name: "May Thazin",
      phone: "+95 9 421 555 018",
      role: "customer",
    },
  ],
});

const created = {
  id: "order-new",
  tracking_code: "OR-7777",
  created_at: new Date().toISOString(),
};

async function fillAddresses(page: Page) {
  await page.getByLabel("Pickup address").fill("12 Pyay Road, Kamayut");
  await page.getByLabel("Deliver to").fill("Bahan, near Inya Road");
  await page
    .getByRole("button", { name: /next: parcel and contacts/i })
    .click();
  await expect(page).toHaveURL(/\/pickup\/details$/);
}

async function fillDetails(page: Page) {
  await page.getByLabel("Recipient name").fill("Daw Hnin");
  await page.getByLabel("Recipient phone").fill("09 421 555 018");
  await page.getByRole("button", { name: /next: review/i }).click();
  await expect(page).toHaveURL(/\/pickup\/review$/);
}

test("a signed-in customer requests a pickup in three steps", async ({
  context,
  page,
}) => {
  const { mutations } = await signInAs(context, "customer", customerTables(), {
    rpc: { create_customer_pickup_order: () => created },
  });
  await page.goto("/pickup");
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  // The tab bar belongs to the first step only.
  await expect(page.getByLabel("Customer app")).toBeVisible();

  await fillAddresses(page);
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.getByLabel("Customer app")).toBeHidden();

  await fillDetails(page);
  await expect(page.getByText("12 Pyay Road, Kamayut")).toBeVisible();
  await expect(page.getByText("Daw Hnin · 09 421 555 018")).toBeVisible();

  await page.getByRole("button", { name: "Request pickup" }).click();
  await expect(
    page.getByRole("heading", { name: /your tracking code is OR-7777/i }),
  ).toBeVisible();
  const view = page.getByRole("link", { name: "View order" });
  await expect(view).toHaveAttribute("href", "/track?order=order-new");

  const call = mutations.find(
    (m) => m.table === "create_customer_pickup_order",
  );
  expect(call?.body).toMatchObject({
    p_pickup_address: "12 Pyay Road, Kamayut",
    p_delivery_address: "Bahan, near Inya Road",
    p_recipient_name: "Daw Hnin",
  });
  // The schedule rides in the description the database turns into a window.
  expect(
    String((call?.body as Record<string, unknown>).p_parcel_description),
  ).toMatch(/Pickup (today|tomorrow), (morning|afternoon|evening)/i);
  // Success clears the stored draft.
  expect(
    await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY),
  ).toBeNull();
});

test("each step blocks until its fields are valid", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", customerTables());
  await page.goto("/pickup");
  await page
    .getByRole("button", { name: /next: parcel and contacts/i })
    .click();
  await expect(page).toHaveURL(/\/pickup$/);
  await expect(page.getByText(/add the pickup address/i)).toBeVisible();
  await expect(page.getByText(/add the delivery address/i)).toBeVisible();

  await fillAddresses(page);
  await page.getByLabel("Recipient phone").fill("12345");
  await page.getByLabel("Recipient phone").blur();
  await expect(page.getByText(/use a myanmar mobile number/i)).toBeVisible();
  await page.getByRole("button", { name: /next: review/i }).click();
  await expect(page).toHaveURL(/\/pickup\/details$/);
  await expect(page.getByText(/add the recipient’s name/i)).toBeVisible();
  await expect(page.getByLabel("Recipient phone")).toHaveAttribute(
    "inputmode",
    "tel",
  );
});

test("a later step cannot be opened before the earlier ones are done", async ({
  context,
  page,
}) => {
  await signInAs(context, "customer", customerTables());
  await page.goto("/pickup/review");
  await expect(page).toHaveURL(/\/pickup$/);
});

test("the draft survives a reload", async ({ context, page }) => {
  await signInAs(context, "customer", customerTables());
  await page.goto("/pickup");
  await page.getByLabel("Pickup address").fill("12 Pyay Road, Kamayut");
  await page.reload();
  await expect(page.getByLabel("Pickup address")).toHaveValue(
    "12 Pyay Road, Kamayut",
  );
});

test("a failed request keeps everything the customer typed", async ({
  context,
  page,
}) => {
  let attempts = 0;
  await signInAs(context, "customer", customerTables(), {
    rpc: {
      create_customer_pickup_order: () => {
        attempts += 1;
        if (attempts === 1) throw new Error("fetch failed");
        return created;
      },
    },
  });
  await page.goto("/pickup");
  await fillAddresses(page);
  await fillDetails(page);
  await page.getByRole("button", { name: "Request pickup" }).click();
  await expect(page.getByText(/your details are saved/i)).toBeVisible();
  await expect(page).toHaveURL(/\/pickup\/review$/);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY),
  ).toContain("Daw Hnin");

  await page.getByRole("button", { name: "Request pickup" }).click();
  await expect(page.getByText(/your tracking code is OR-7777/i)).toBeVisible();
});

test("signing in mid-request returns to the review step with the draft intact", async ({
  page,
}) => {
  await page.addInitScript(
    ([key]) => {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(
        key,
        JSON.stringify({
          pickupAddress: "12 Pyay Road, Kamayut",
          deliveryAddress: "Bahan, near Inya Road",
          recipientName: "Daw Hnin",
          recipientPhone: "09 421 555 018",
        }),
      );
    },
    [DRAFT_KEY],
  );
  await page.goto("/pickup/review");
  await expect(page).toHaveURL(/\/pickup\/review$/);
  await page.getByRole("button", { name: "Sign in to request pickup" }).click();
  await expect(page).toHaveURL(/\/signin\?.*next=%2Fpickup%2Freview/);
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    DRAFT_KEY,
  );
  expect(stored).toContain("Daw Hnin");
});
