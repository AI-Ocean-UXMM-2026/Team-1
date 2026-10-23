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
};

/** Types into an address field and chooses the first township suggestion. */
async function pickTownship(page: Page, field: string, typed: string) {
  const input = page.getByLabel(field);
  await input.click();
  await input.fill(typed);
  await page.getByRole("option").first().click();
}

test.beforeEach(async ({ context }) => {
  await signInAs(context, "customer", customer);
});

test("typing part of a township offers it, and choosing it pins the address", async ({
  page,
}) => {
  await page.goto("/pickup");
  const input = page.getByLabel("Pickup address");
  await input.click();
  await input.fill("shwepyi");
  await expect(
    page.getByRole("option", { name: /Shwe Pyi Thar/ }),
  ).toBeVisible();
  await page.getByRole("option", { name: /Shwe Pyi Thar/ }).click();

  await expect(input).toHaveValue("Shwe Pyi Thar, Yangon");
  await expect(page.getByText("Pickup pin set")).toBeVisible();
});

test("changing the address after a pin keeps the pin and asks for a check", async ({
  page,
}) => {
  await page.goto("/pickup");
  await pickTownship(page, "Pickup address", "insein");
  await expect(page.getByText("Pickup pin set")).toBeVisible();

  // The pin stays where it was, so the price survives the edit; the form
  // instead warns that the words and the pin may no longer agree.
  await page.getByLabel("Pickup address").pressSequentially(" Road");
  await expect(page.getByText("Pickup pin set")).toBeVisible();
  await expect(page.getByText(/the pin is still where it was/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Check" })).toBeVisible();
});

test("the fee shows as soon as both ends are pinned, before the payment step", async ({
  page,
}) => {
  await page.goto("/pickup");
  const fee = page.getByRole("region", { name: "Delivery fee estimate" });
  await expect(fee).toContainText("Pick a suggestion");

  await pickTownship(page, "Pickup address", "shwepyi");
  await expect(fee).toContainText("Pick a suggestion");
  await pickTownship(page, "Delivery address", "mayangone");

  await expect(fee).toContainText(/MMK\s?[\d,]+/);
  // Shwe Pyi Thar's base fee is 4,500, so the trip costs more than that.
  const text = (await fee.innerText()).replace(/,/g, "");
  expect(Number(text.match(/MMK\s?(\d+)/)?.[1])).toBeGreaterThan(4500);
});

test("Use my location works for the delivery address too", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 16.82, longitude: 96.13 });
  await page.goto("/pickup");

  await page.getByRole("button", { name: "Use my location" }).nth(1).click();
  await expect(page.getByText("Delivery pin set")).toBeVisible();
  await expect(page.getByText(/Located to within/)).toBeVisible();
  await expect(page.getByText("Pickup pin set")).toHaveCount(0);
  // The address follows the pin so the text never names another place.
  await expect(page.getByLabel("Delivery address")).not.toHaveValue("");
});

test("a blocked location explains itself for the field that asked", async ({
  context,
  page,
}) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _ok: unknown,
          fail: (error: { code: number; PERMISSION_DENIED: number }) => void,
        ) => fail({ code: 1, PERMISSION_DENIED: 1 }),
      },
    });
  });
  await page.goto("/pickup");
  await page.getByRole("button", { name: "Use my location" }).first().click();
  await expect(page.getByText(/Location is blocked/)).toBeVisible();
  await expect(page.getByText(/Location is blocked/)).toHaveCount(1);
});

test("phone, amount and name are tidied when you leave the field", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "oern.pickup-draft.v1",
      JSON.stringify({
        pickupAddress: "Shwe Pyi Thar, Yangon",
        deliveryAddress: "Insein, Yangon",
      }),
    ),
  );
  await page.goto("/pickup/details");
  const name = page.getByLabel("Recipient name");
  await name.fill("  Daw Hnin  ");
  await page.getByLabel("Recipient phone").click();
  await expect(name).toHaveValue("Daw Hnin");

  const phone = page.getByLabel("Recipient phone");
  await phone.fill("+95 9421555018");
  await name.click();
  await expect(phone).toHaveValue("09 421 555 018");

  await page.getByRole("button", { name: /more details/i }).click();
  const cod = page.getByLabel(/Cash on delivery/);
  await cod.fill("25000");
  await name.click();
  await expect(cod).toHaveValue("25,000");
});

test("Enter moves to the next field and sends the step from the last", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "oern.pickup-draft.v1",
      JSON.stringify({
        pickupAddress: "Shwe Pyi Thar, Yangon",
        deliveryAddress: "Insein, Yangon",
      }),
    ),
  );
  await page.goto("/pickup/details");
  await page.getByLabel("Recipient name").fill("Daw Hnin");
  await page.getByLabel("Recipient name").press("Enter");
  await expect(page.getByLabel("Recipient phone")).toBeFocused();

  await page.getByLabel("Recipient phone").fill("09 421 555 018");
  await page.getByRole("button", { name: /more details/i }).click();
  const last = page.getByLabel("Note for the rider");
  await expect(last).toBeVisible();
  await page.getByLabel("Recipient phone").press("Enter");
  await expect(page.getByLabel(/Your phone for the rider/)).toBeFocused();
});
