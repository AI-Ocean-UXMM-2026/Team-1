import AxeBuilder from "@axe-core/playwright";

import {
  makeOrder,
  minutesAgo,
  minutesFromNow,
  signInAs,
} from "./support/supabase-mock";
import { expect, test } from "./support/test";

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
    }),
    makeOrder({
      id: "order-2",
      tracking_code: "OR-1002",
      customer_id: "user-1",
      status: "delivered",
      cod_status: "collected",
      created_at: minutesAgo(1500),
    }),
  ],
  delivery_assignments: [
    {
      id: "a1",
      order_id: "order-1",
      driver_id: "driver-1",
      vehicle_id: null,
      route_id: null,
      assigned_at: minutesAgo(30),
      ended_at: null,
    },
  ],
});

const DRAFT = {
  pickupAddress: "12 Pyay Road, Kamayut",
  pickupPoint: { latitude: 16.78, longitude: 96.15 },
  deliveryAddress: "Bahan, near Inya Road",
  deliveryPoint: { latitude: 16.82, longitude: 96.13 },
  recipientName: "Daw Hnin",
  recipientPhone: "09 421 555 018",
};

const screens: {
  name: string;
  path: string;
  ready: RegExp | string;
  enabled?: string;
}[] = [
  { name: "home", path: "/home", ready: "OR-1001" },
  { name: "orders active", path: "/orders", ready: "OR-1001" },
  { name: "orders history", path: "/orders?tab=history", ready: "OR-1002" },
  { name: "profile", path: "/profile", ready: "Sign out" },
  { name: "track", path: "/track?order=order-1", ready: "OR-1001" },
  { name: "notifications", path: "/notifications", ready: /notifications/i },
  { name: "pickup addresses", path: "/pickup", ready: "Pickup address" },
  { name: "pickup details", path: "/pickup/details", ready: "Recipient name" },
  {
    name: "pickup payment",
    path: "/pickup/payment",
    ready: "Coupon and points",
  },
  {
    name: "pickup review",
    path: "/pickup/review",
    ready: "Request pickup",
    enabled: "Request pickup",
  },
];

for (const screen of screens) {
  test(`customer ${screen.name} has no axe violations`, async ({
    context,
    page,
  }) => {
    await page.addInitScript(
      ([key, draft]) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, draft);
      },
      ["oern.pickup-draft.v1", JSON.stringify(DRAFT)],
    );
    await signInAs(context, "customer", tables());
    await page.goto(screen.path);
    await expect(page.getByText(screen.ready).first()).toBeVisible();
    if (screen.enabled)
      await expect(
        page.getByRole("button", { name: screen.enabled }),
      ).toBeEnabled();
    // Colours mid-transition (a button enabling) would measure as low contrast.
    // Live markers and the tracking rail pulse forever, and an animation that
    // repeats without end never finishes, so only finite ones are awaited.
    await page.waitForLoadState("networkidle");
    await page.evaluate(() =>
      Promise.allSettled(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !==
              Number.POSITIVE_INFINITY,
          )
          .map((animation) => animation.finished),
      ),
    );
    const results = await new AxeBuilder({ page: page as never })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .exclude("nextjs-portal")
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html.slice(0, 140)),
      })),
    ).toEqual([]);
  });
}
