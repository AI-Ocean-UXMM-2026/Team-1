import {
  makeOrder,
  minutesAgo,
  minutesFromNow,
  signInAs,
} from "./support/supabase-mock";
import { expect, test } from "./support/test";

const assignment = (orderId: string) => ({
  id: `assignment-${orderId}`,
  order_id: orderId,
  driver_id: "driver-1",
  vehicle_id: null,
  route_id: null,
  assigned_at: minutesAgo(30),
  ended_at: null,
});

test("a parcel past its estimate reads as running late (H-04)", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({
        customer_id: "user-1",
        status: "in_transit",
        estimated_delivery_at: minutesAgo(30),
      }),
    ],
    delivery_assignments: [assignment("order-1")],
  });
  await page.goto("/track?order=order-1");
  await expect(page.getByText("Running late").first()).toBeVisible();
  await expect(page.getByText(/Arriving in Running late/)).toHaveCount(0);
  await page.goto("/orders");
  await expect(page.getByText(/ETA Running late/)).toHaveCount(0);
  await expect(page.getByText(/Running late/).first()).toBeVisible();
});

test("a failed delivery explains itself in the timeline (H-05)", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [makeOrder({ customer_id: "user-1", status: "failed" })],
    delivery_assignments: [assignment("order-1")],
    delivery_status_events: [
      {
        id: "e1",
        order_id: "order-1",
        status: "assigned",
        note: null,
        created_at: minutesAgo(50),
      },
      {
        id: "e2",
        order_id: "order-1",
        status: "failed",
        note: "Recipient unavailable",
        created_at: minutesAgo(5),
      },
    ],
  });
  await page.goto("/track?order=order-1");
  const progress = page.getByRole("region", { name: "Selected delivery" });
  await expect(progress.getByText(/Recipient unavailable/)).toBeVisible();
  await expect(progress.getByText("Not reached").first()).toBeVisible();
  await expect(progress.getByText("Up next")).toHaveCount(0);
  // No invented progress for a delivery that did not happen.
  await expect(progress.getByText("At your door")).toHaveCount(0);
});

test("no progress bar is drawn without real route progress (M-02)", async ({
  page,
  context,
}) => {
  await signInAs(context, "customer", {
    delivery_orders: [
      makeOrder({
        customer_id: "user-1",
        status: "in_transit",
        estimated_delivery_at: minutesFromNow(15),
        route_progress_percent: null,
      }),
    ],
    delivery_assignments: [assignment("order-1")],
  });
  await page.goto("/track?order=order-1");
  await expect(page.getByText("Arriving in")).toBeVisible();
  await expect(page.getByText("At your door")).toHaveCount(0);
});
