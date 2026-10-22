import {
  makeOrder,
  minutesAgo,
  minutesFromNow,
  signInAs,
} from "./support/supabase-mock";
import { expect, test } from "./support/test";

const assignment = {
  id: "a1",
  order_id: "order-1",
  driver_id: "driver-1",
  vehicle_id: null,
  route_id: null,
  assigned_at: minutesAgo(30),
  ended_at: null,
};

const tables = () => ({
  profiles: [
    {
      id: "user-1",
      full_name: "May Thazin",
      phone: "+95 9 421 555 018",
      role: "customer",
    },
    { id: "driver-1", full_name: "Aung Kyaw", phone: null, role: "driver" },
  ],
  delivery_orders: [
    makeOrder({
      id: "order-1",
      tracking_code: "OR-1001",
      customer_id: "user-1",
      status: "in_transit",
      estimated_delivery_at: minutesFromNow(12),
      delivery_address: "Bahan, near Inya Road",
    }),
    makeOrder({
      id: "order-2",
      tracking_code: "OR-1002",
      customer_id: "user-1",
      status: "failed",
      cod_status: "pending",
      delivery_address: "Kamayut, Yangon",
      created_at: minutesAgo(900),
    }),
    makeOrder({
      id: "order-3",
      tracking_code: "OR-1003",
      customer_id: "user-1",
      status: "delivered",
      cod_status: "collected",
      delivery_address: "Hlaing, Yangon",
      created_at: minutesAgo(1500),
    }),
  ],
  delivery_assignments: [assignment],
  delivery_status_events: [
    // Created long ago, but it ended most recently: it must lead History.
    {
      id: "e1",
      order_id: "order-3",
      status: "delivered",
      note: null,
      created_at: minutesAgo(10),
    },
    {
      id: "e2",
      order_id: "order-2",
      status: "failed",
      note: "Recipient unavailable",
      created_at: minutesAgo(300),
    },
  ],
});

test("Orders splits Active from History and keeps the view in the URL", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", tables());
  await page.goto("/orders");

  await expect(page.getByRole("tab", { name: /Active · 1/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const rows = page
    .getByRole("list", { name: "Active deliveries" })
    .getByRole("link");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("OR-1001");

  await page.getByRole("tab", { name: /History · 2/ }).click();
  await expect(page).toHaveURL(/tab=history/);
  const history = page
    .getByRole("list", { name: "Delivery history" })
    .getByRole("link");
  await expect(history).toHaveCount(2);
  // Sorted by when each delivery ended, not when it was created.
  await expect(history.first()).toContainText("OR-1003");
  await expect(history.first()).toContainText("COD paid");
  await expect(history.nth(1)).toContainText("COD not collected");
});

test("search and outcome filter live in the URL and survive opening a delivery", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", tables());
  await page.goto("/orders?tab=history");
  await page.getByRole("button", { name: "Not delivered" }).click();
  await expect(page).toHaveURL(/outcome=failed/);
  await page.getByLabel("Search history").fill("kamayut");
  await expect(page).toHaveURL(/q=kamayut/);

  const list = page.getByRole("list", { name: "Delivery history" });
  await expect(list.getByRole("link")).toHaveCount(1);
  await list.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/track\?order=order-2/);

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/tab=history/);
  await expect(page).toHaveURL(/outcome=failed/);
  await expect(page.getByLabel("Search history")).toHaveValue("kamayut");
  await expect(page.getByRole("tab", { name: /History/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByLabel("Search history").fill("nothing-matches");
  await expect(page.getByText("No deliveries match that search")).toBeVisible();
});

test("a delivery that finishes moves from Active to History while the app is open", async ({
  page,
  context,
}) => {
  const backend = await signInAs(context, "customer", tables());
  await page.goto("/orders");
  await expect(page.getByRole("tab", { name: /Active · 1/ })).toBeVisible();

  // The rider completes the delivery; the next refresh brings it in.
  const order = backend.tables.delivery_orders.find(
    (row) => row.id === "order-1",
  );
  if (!order) throw new Error("fixture order missing");
  order.status = "delivered";
  backend.tables.delivery_status_events.push({
    id: "e9",
    order_id: "order-1",
    status: "delivered",
    note: null,
    created_at: new Date().toISOString(),
  });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect(page.getByRole("tab", { name: /Active · 0/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /History · 3/ })).toBeVisible();
  await page.getByRole("tab", { name: /History/ }).click();
  await expect(
    page
      .getByRole("list", { name: "Delivery history" })
      .getByRole("link")
      .first(),
  ).toContainText("OR-1001");
});

test("finished deliveries are off Home and reachable from Delivery history", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", tables());
  await page.goto("/home");
  await expect(page.getByText("OR-1001").first()).toBeVisible();
  await expect(page.getByText("OR-1002")).toHaveCount(0);
  await expect(page.getByText("OR-1003")).toHaveCount(0);
  await page.getByRole("link", { name: /Delivery history/ }).click();
  await expect(page).toHaveURL(/\/orders\?tab=history/);
});

test("Profile shows the account and asks before signing out", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", tables());
  await page.goto("/profile");
  await expect(page.getByText("May Thazin")).toBeVisible();
  await expect(page.getByText("+95 9 421 555 018")).toBeVisible();
  await expect(page.getByText("MT", { exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Account" });
  await expect(
    nav.getByRole("link", { name: /Delivery history/ }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: /Notifications/ })).toBeVisible();
  await expect(
    nav.getByRole("button", { name: /Help and support/ }),
  ).toBeVisible();
  await expect(page.getByText(/Signed in as/)).toHaveCount(0);

  // A failing sign-out is reported and the session stays.
  await context.route("**/auth/v1/logout*", (route) =>
    route.fulfill({ status: 500, json: { message: "server unavailable" } }),
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign out of Oern?" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: "Sign out" }).click();
  await sheet.getByRole("button", { name: "Sign out" }).click();
  await expect(sheet.getByRole("alert")).toContainText(
    /couldn.t sign you out/i,
  );
  await expect(page).toHaveURL(/\/profile/);
});

test("closing Help returns focus to the control that opened it", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", tables());
  await page.goto("/profile");
  const trigger = page
    .getByRole("navigation", { name: "Account" })
    .getByRole("button", { name: /Help and support/ });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("signing in from Orders brings the customer back to Orders", async ({
  page,
}) => {
  await page.goto("/orders?tab=history");
  await page
    .getByRole("button", { name: /sign in/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/signin\?.*next=%2Forders%3Ftab%3Dhistory/);
  await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
    "href",
    "/orders?tab=history",
  );
  await expect(
    page.getByRole("link", { name: "Create an account" }),
  ).toHaveAttribute("href", /next=%2Forders%3Ftab%3Dhistory/);
});

test("a sign-in link cannot send the customer to another site", async ({
  page,
}) => {
  await page.goto("/signin?next=https%3A%2F%2Fevil.example%2Fphish");
  await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
    "href",
    "/welcome",
  );
});
