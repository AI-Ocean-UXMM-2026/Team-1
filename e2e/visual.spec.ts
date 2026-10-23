import type { Page } from "@playwright/test";
import { makeOrder, signInAs, type Tables } from "./support/supabase-mock";
import { expect, test } from "./support/test";

/**
 * Visual regression for the main screens. Baselines live next to this file and
 * are produced on Linux Chromium: `bunx playwright test e2e/visual.spec.ts
 * --project=mobile-390 --update-snapshots`. The clock is frozen so ETAs and
 * relative times are stable.
 */
const NOW = Date.parse("2026-10-20T04:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const ahead = (minutes: number) =>
  new Date(NOW + minutes * 60_000).toISOString();

test.beforeEach(({ browserName }, testInfo) => {
  void browserName;
  test.skip(
    testInfo.project.name !== "mobile-390",
    "Baselines are captured at 390×844 (manager desktop uses its own viewport)",
  );
});

async function shoot(page: Page, name: string, fullPage = true) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage,
    animations: "disabled",
    // The animated mascot is the only moving content.
    mask: [page.locator("img")],
    maxDiffPixelRatio: 0.002,
  });
}

const assignment = (orderId: string, status = "assigned") => ({
  id: `assignment-${orderId}`,
  order_id: orderId,
  driver_id: "driver-1",
  vehicle_id: null,
  route_id: null,
  assigned_at: ago(30),
  ended_at: null,
  status,
});

const inTransit = (overrides = {}) =>
  makeOrder({
    customer_id: "user-1",
    status: "in_transit",
    created_at: ago(60),
    estimated_delivery_at: ahead(18),
    eta_updated_at: ago(1),
    ...overrides,
  });

async function open(
  page: Page,
  context: import("@playwright/test").BrowserContext,
  role: Parameters<typeof signInAs>[1],
  tables: Partial<Tables>,
  path: string,
) {
  await page.clock.setFixedTime(NOW);
  await signInAs(context, role, tables);
  await page.goto(path);
}

test("customer home, signed out", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto("/home");
  await shoot(page, "customer-home-signed-out");
});

test("welcome", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto("/welcome");
  await shoot(page, "welcome", false);
});

test("customer sign-in page", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto("/signin?next=%2Fpickup%2Freview");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await shoot(page, "customer-signin", false);
});

test("customer track, in transit", async ({ page, context }) => {
  await open(
    page,
    context,
    "customer",
    {
      delivery_orders: [inTransit()],
      delivery_assignments: [assignment("order-1")],
      delivery_status_events: [
        {
          id: "e1",
          order_id: "order-1",
          status: "assigned",
          note: null,
          created_at: ago(50),
        },
      ],
    },
    "/track",
  );
  await shoot(page, "customer-track-in-transit");
});

test("customer track, failed delivery", async ({ page, context }) => {
  await open(
    page,
    context,
    "customer",
    {
      delivery_orders: [
        makeOrder({
          customer_id: "user-1",
          status: "failed",
          created_at: ago(90),
        }),
      ],
      delivery_status_events: [
        {
          id: "e2",
          order_id: "order-1",
          status: "failed",
          note: "Recipient unavailable",
          created_at: ago(5),
        },
      ],
    },
    "/track",
  );
  await shoot(page, "customer-track-failed");
});

test("customer orders", async ({ page, context }) => {
  await open(
    page,
    context,
    "customer",
    {
      delivery_orders: [
        inTransit({ id: "order-1", tracking_code: "OR-1001" }),
        makeOrder({
          id: "order-2",
          tracking_code: "OR-1002",
          customer_id: "user-1",
          status: "delivered",
          created_at: ago(300),
        }),
      ],
    },
    "/orders",
  );
  await shoot(page, "customer-orders");
});

const customerOrders = () => [
  inTransit({ id: "order-1", tracking_code: "OR-1001" }),
  makeOrder({
    id: "order-2",
    tracking_code: "OR-1002",
    customer_id: "user-1",
    status: "delivered",
    cod_status: "collected",
    created_at: ago(300),
  }),
];

test("customer home, active parcel", async ({ page, context }) => {
  await open(
    page,
    context,
    "customer",
    {
      delivery_orders: customerOrders(),
      delivery_assignments: [assignment("order-1")],
    },
    "/home",
  );
  await expect(page.getByText("OR-1001").first()).toBeVisible();
  await shoot(page, "customer-home-active", false);
});

test("customer orders, history", async ({ page, context }) => {
  await open(
    page,
    context,
    "customer",
    { delivery_orders: customerOrders() },
    "/orders?tab=history",
  );
  await expect(page.getByText("OR-1002").first()).toBeVisible();
  await shoot(page, "customer-orders-history", false);
});

test("customer profile", async ({ page, context }) => {
  await open(
    page,
    context,
    "customer",
    {
      profiles: [
        {
          id: "user-1",
          full_name: "May Thazin",
          phone: "+95 9 421 555 018",
          role: "customer",
        },
      ],
      delivery_orders: customerOrders(),
    },
    "/profile",
  );
  await expect(page.getByText("Sign out").first()).toBeVisible();
  await shoot(page, "customer-profile", false);
});

test("customer pickup, three steps", async ({ page, context }) => {
  await page.addInitScript(
    ([key, draft]) => localStorage.setItem(key, draft),
    [
      "oern.pickup-draft.v1",
      JSON.stringify({
        pickupAddress: "12 Pyay Road, Kamayut",
        deliveryAddress: "Bahan, near Inya Road",
        recipientName: "Daw Hnin",
        recipientPhone: "09 421 555 018",
        day: "Tomorrow",
        window: "Morning",
      }),
    ],
  );
  await open(page, context, "customer", {}, "/pickup");
  await expect(page.getByLabel("Pickup address")).toHaveValue(/Pyay/);
  await shoot(page, "customer-pickup-addresses", false);
  await page.goto("/pickup/details");
  await expect(page.getByLabel("Recipient name")).toHaveValue("Daw Hnin");
  await shoot(page, "customer-pickup-details", false);
  await page.goto("/pickup/payment");
  await expect(
    page.getByRole("button", { name: /next: review/i }),
  ).toBeVisible();
  await shoot(page, "customer-pickup-payment", false);
  await page.goto("/pickup/review");
  await expect(
    page.getByRole("button", { name: "Request pickup" }),
  ).toBeEnabled();
  await shoot(page, "customer-pickup-review", false);
});

test("rider overview and navigation", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 16.79, longitude: 96.145 });
  await open(
    page,
    context,
    "driver",
    {
      delivery_orders: [inTransit({ customer_id: "customer-1" })],
      delivery_assignments: [assignment("order-1")],
    },
    "/rider/route",
  );
  await expect(page.getByText(/Stop 1 of 1/)).toBeVisible();
  await shoot(page, "rider-navigate", false);
});

test("manager overview, orders and cash", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const tables: Partial<Tables> = {
    delivery_orders: [
      inTransit({
        id: "order-1",
        tracking_code: "OR-3001",
        customer_id: "customer-1",
      }),
      makeOrder({
        id: "order-2",
        tracking_code: "OR-3002",
        status: "pending",
        created_at: ago(20),
      }),
      makeOrder({
        id: "order-3",
        tracking_code: "OR-3003",
        status: "delivered",
        cod_amount: 30000,
        cod_status: "collected",
        created_at: ago(200),
      }),
    ],
    delivery_assignments: [assignment("order-1")],
    cod_payments: [
      {
        order_id: "order-3",
        amount: 25000,
        payment_method: "cash",
        status: "collected",
        collected_by: "driver-1",
        collected_at: ago(60),
        settled_at: null,
      },
    ],
    delivery_outcome_reports: [
      {
        order_id: "order-3",
        cod_collected: 25000,
        cod_discrepancy_reason: "Customer short of cash",
        reported_at: ago(60),
      },
    ],
  };
  await open(page, context, "manager", tables, "/manager/home");
  await expect(page.getByText("OR-3001").first()).toBeVisible();
  await shoot(page, "manager-home-phone");
  await page.goto("/manager/order");
  await shoot(page, "manager-orders-phone");
  await page.goto("/manager/cod");
  await expect(page.locator(".cod-ledger-row").first()).toBeVisible();
  await shoot(page, "manager-cod-phone");
});

test("manager overview, desktop", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(
    page,
    context,
    "manager",
    {
      delivery_orders: [
        inTransit({
          id: "order-1",
          tracking_code: "OR-3001",
          customer_id: "customer-1",
        }),
        makeOrder({
          id: "order-2",
          tracking_code: "OR-3002",
          status: "pending",
          created_at: ago(20),
        }),
      ],
      delivery_assignments: [assignment("order-1")],
    },
    "/manager/home",
  );
  await expect(page.getByText("OR-3001").first()).toBeVisible();
  await shoot(page, "manager-home-desktop", false);
});

test("seller and support, signed out", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto("/seller");
  await shoot(page, "seller-signed-out", false);
  await page.goto("/support");
  await shoot(page, "support-signed-out", false);
});
