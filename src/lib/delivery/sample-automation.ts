import type { DeliveryJob, QueueEntry } from "@/lib/delivery/jobs";
import type { DeliveryOrder } from "@/lib/delivery/types";

/**
 * In-memory sample data for Task Automation. Nothing here is written to
 * Supabase; sample ids are excluded from every live action.
 */
export const SAMPLE_ORDER_PREFIX = "sample-order-";

export function isSampleOrder(orderId: string) {
  return orderId.startsWith(SAMPLE_ORDER_PREFIX);
}

const now = Date.now();
const minutesAgo = (minutes: number) =>
  new Date(now - minutes * 60_000).toISOString();

function sampleOrder(
  n: number,
  fields: Pick<
    DeliveryOrder,
    | "customer_name"
    | "delivery_address"
    | "delivery_latitude"
    | "delivery_longitude"
    | "parcel_description"
    | "parcel_weight_kg"
    | "cod_amount"
  >,
): DeliveryOrder {
  return {
    id: `${SAMPLE_ORDER_PREFIX}${n}`,
    tracking_code: `SMP-${4900 + n}`,
    customer_id: null,
    status: "pending",
    pickup_address: "Sample pickup · Lanmadaw, Yangon",
    pickup_latitude: 16.7797,
    pickup_longitude: 96.1434,
    recipient_name: fields.customer_name,
    recipient_phone: null,
    cod_status: fields.cod_amount ? "pending" : "not_required",
    estimated_delivery_at: null,
    route_progress_percent: null,
    traffic_delay_minutes: 0,
    eta_confidence: null,
    eta_updated_at: null,
    created_at: minutesAgo(10 + n * 3),
    driver_id: null,
    driver_name: null,
    driver_phone: null,
    vehicle_id: null,
    vehicle_label: null,
    latest_location: null,
    ...fields,
  };
}

export const SAMPLE_REQUEST_ORDERS: DeliveryOrder[] = [
  sampleOrder(1, {
    customer_name: "Sample · Hnin Si",
    delivery_address: "Kyauktada, near Sule Pagoda",
    delivery_latitude: 16.7758,
    delivery_longitude: 96.1601,
    parcel_description: "Clothing · 2 parcels",
    parcel_weight_kg: 2.4,
    cod_amount: 55_000,
  }),
  sampleOrder(2, {
    customer_name: "Sample · Aung Myo",
    delivery_address: "Tamwe, Pazundaung Creek",
    delivery_latitude: 16.7995,
    delivery_longitude: 96.1836,
    parcel_description: "Electronics · phone case",
    parcel_weight_kg: 0.8,
    cod_amount: 32_000,
  }),
  sampleOrder(3, {
    customer_name: "Sample · Moe Kyi",
    delivery_address: "Mayangone, 6 Mile",
    delivery_latitude: 16.8637,
    delivery_longitude: 96.1282,
    parcel_description: "Groceries · 3 bags",
    parcel_weight_kg: 6.1,
    cod_amount: 84_000,
  }),
  sampleOrder(4, {
    customer_name: "Sample · Zin Mar",
    delivery_address: "Sanchaung, Kaba Aye Pagoda Road",
    delivery_latitude: 16.8053,
    delivery_longitude: 96.1362,
    parcel_description: "Cosmetics · 1 box",
    parcel_weight_kg: 1.2,
    cod_amount: 0,
  }),
];

/** Sample orders already grouped in the queue, waiting for a job. */
export const SAMPLE_QUEUE_ENTRIES: QueueEntry[] = [
  {
    order_id: SAMPLE_REQUEST_ORDERS[0].id,
    queued_at: minutesAgo(6),
    job_id: null,
    auto_accepted: false,
  },
  {
    order_id: SAMPLE_REQUEST_ORDERS[1].id,
    queued_at: minutesAgo(4),
    job_id: null,
    auto_accepted: true,
  },
];

const sampleTask = (
  id: string,
  fields: Pick<
    DeliveryJob,
    "label" | "area_label" | "status" | "order_count" | "total_weight_kg"
  > &
    Partial<
      Pick<
        DeliveryJob,
        | "claimed_by"
        | "claimed_at"
        | "started_at"
        | "completed_at"
        | "cod_total"
      >
    >,
): DeliveryJob => ({
  id: `job-sample-${id}`,
  batch_id: "batch-sample-live",
  cod_total: 0,
  center_latitude: 16.79,
  center_longitude: 96.16,
  claimed_by: null,
  claimed_at: null,
  vehicle_id: null,
  route_id: null,
  started_at: null,
  completed_at: null,
  created_at: minutesAgo(60),
  reproduce_count: 0,
  priority: "normal",
  reproduced_from_job_id: null,
  metadata: {},
  ...fields,
});

/** Sample jobs past the open stage, so the Taken, On the road and Done columns have cards. */
export const SAMPLE_TASK_JOBS: DeliveryJob[] = [
  sampleTask("taken-1", {
    label: "Sample · Tamwe Morning Run",
    area_label: "Tamwe",
    status: "claimed",
    order_count: 3,
    total_weight_kg: 5.5,
    cod_total: 96_000,
    claimed_by: "sample-driver-aung",
    claimed_at: minutesAgo(12),
  }),
  sampleTask("road-1", {
    label: "Sample · Kyauktada Loop",
    area_label: "Kyauktada",
    status: "in_progress",
    order_count: 5,
    total_weight_kg: 9.2,
    cod_total: 140_000,
    claimed_by: "sample-driver-zaw",
    claimed_at: minutesAgo(40),
    started_at: minutesAgo(35),
  }),
  sampleTask("done-1", {
    label: "Sample · Mayangone Drop-offs",
    area_label: "Mayangone",
    status: "completed",
    order_count: 4,
    total_weight_kg: 7.0,
    cod_total: 61_000,
    claimed_by: "sample-driver-aung",
    claimed_at: minutesAgo(150),
    started_at: minutesAgo(140),
    completed_at: minutesAgo(95),
  }),
  sampleTask("done-2", {
    label: "Sample · Sanchaung Express",
    area_label: "Sanchaung",
    status: "completed",
    order_count: 2,
    total_weight_kg: 2.3,
    cod_total: 18_000,
    claimed_by: "sample-driver-zaw",
    claimed_at: minutesAgo(210),
    started_at: minutesAgo(200),
    completed_at: minutesAgo(180),
  }),
];
