import {
  makeOrder,
  minutesAgo,
  minutesFromNow,
  signInAs,
} from "./support/supabase-mock";
import { expect, test } from "./support/test";

const DRAFT = {
  pickupAddress:
    "ရန်ကုန်မြို့၊ လှိုင်သာယာမြို့နယ်၊ ဦးဝိစာရလမ်း၊ အမှတ် ၁၂၃၄ ရှေ့တွင် အလွန်ရှည်လျားသော လိပ်စာ",
  deliveryAddress:
    "Bahan, near Inya Road, opposite the very long named pagoda compound",
  recipientName: "ဒေါ်ခင်မေသက်ထွေး (Daw Khin May Thet Htwe)",
  recipientPhone: "09 421 555 018",
};

const tables = () => ({
  profiles: [
    // No phone and a long Myanmar name.
    {
      id: "user-1",
      full_name: "ဒေါ်ခင်မေသက်ထွေး ကျော်စွာအောင်",
      phone: null,
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
      delivery_address: DRAFT.deliveryAddress,
      cod_amount: 250000,
    }),
    ...Array.from({ length: 30 }, (_, i) =>
      makeOrder({
        id: `old-${i}`,
        tracking_code: `OR-2${String(i).padStart(3, "0")}`,
        customer_id: "user-1",
        status: i % 3 ? "delivered" : "failed",
        cod_status: i % 3 ? "collected" : "pending",
        delivery_address: DRAFT.pickupAddress,
        created_at: minutesAgo(2000 + i * 60),
      }),
    ),
  ],
  delivery_assignments: [],
});

const paths = [
  "/home",
  "/orders",
  "/orders?tab=history",
  "/profile",
  "/track?order=order-1",
  "/notifications",
  "/pickup",
  "/pickup/details",
  "/pickup/review",
];

for (const size of [
  { name: "320", width: 320, height: 568 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test.describe(`customer at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const path of paths) {
      test(`${path} fits without sideways scroll`, async ({
        context,
        page,
      }) => {
        await page.addInitScript(
          ([key, draft]) => localStorage.setItem(key, draft),
          ["oern.pickup-draft.v1", JSON.stringify(DRAFT)],
        );
        await signInAs(context, "customer", tables());
        await page.goto(path);
        await expect(page.locator("main").first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        const metrics = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
          canvas: Math.max(
            ...[
              ...document.querySelectorAll(
                "main, nav[aria-label='Customer app']",
              ),
            ].map((el) => (el as HTMLElement).getBoundingClientRect().width),
          ),
        }));
        expect(metrics.scroll).toBeLessThanOrEqual(metrics.client);
        expect(metrics.canvas).toBeLessThanOrEqual(480.5);
      });
    }
  });
}

test("text scaled to 200% keeps the pickup action reachable", async ({
  context,
  page,
}) => {
  await page.addInitScript(
    ([key, draft]) => localStorage.setItem(key, draft),
    ["oern.pickup-draft.v1", JSON.stringify(DRAFT)],
  );
  await signInAs(context, "customer", tables());
  await page.goto("/pickup/details");
  await page.addStyleTag({ content: "html{font-size:200%}" });
  const next = page.getByRole("button", { name: /next: review/i });
  await expect(next).toBeInViewport();
  const box = await next.boundingBox();
  const viewport = page.viewportSize();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
    viewport?.height ?? 0,
  );
});

test.describe("reduced motion", () => {
  test("transitions are effectively instant", async ({ context, page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInAs(context, "customer", tables());
    await page.goto("/home");
    const longest = await page.evaluate(() => {
      let max = 0;
      for (const el of document.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        for (const value of style.transitionDuration.split(",")) {
          const seconds =
            Number.parseFloat(value) * (value.includes("ms") ? 0.001 : 1);
          if (seconds > max) max = seconds;
        }
      }
      return max;
    });
    expect(longest).toBeLessThan(0.05);
  });
});
