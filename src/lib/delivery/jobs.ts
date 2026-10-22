import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { DeliveryOrder, RouteStop } from "@/lib/delivery/types";

type JobsClient = SupabaseClient<Database>;

/** Hours between scheduled batches. Mirrors private.run_scheduled_job_batch. */
export const BATCH_INTERVAL_HOURS = 9;

export type JobStatus =
  "open" | "claimed" | "in_progress" | "completed" | "cancelled" | "superseded";

export type JobPriority = "low" | "normal" | "high" | "urgent";

export type DeliveryJob = {
  id: string;
  batch_id: string;
  label: string;
  status: JobStatus;
  area_label: string | null;
  order_count: number;
  total_weight_kg: number;
  cod_total: number;
  center_latitude: number | null;
  center_longitude: number | null;
  claimed_by: string | null;
  claimed_at: string | null;
  vehicle_id: string | null;
  route_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  reproduce_count: number;
  priority: JobPriority;
  reproduced_from_job_id: string | null;
  metadata?: Record<string, unknown>;
};

export type JobBatch = {
  id: string;
  trigger: "schedule" | "manual" | "automation" | "reproduce";
  job_count: number;
  order_count: number;
  created_at: string;
};

export type QueueEntry = {
  order_id: string;
  queued_at: string;
  job_id: string | null;
  auto_accepted?: boolean;
  reproduce_count?: number;
  last_calculated_at?: string | null;
};

export type ReproduceTasksResult = {
  batch_id: string | null;
  reproduced_jobs: number;
  extracted_tasks: number;
  stagnant_unassigned: number;
  superseded_jobs: number;
  message: string;
};

export type WorkflowRunResult = {
  auto_accepted: number;
  extracted_tasks: number;
  superseded_jobs: number;
  reproduced_jobs: number;
  additional_jobs: number;
  total_jobs_posted: number;
  message: string;
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "Open",
  claimed: "Taken",
  in_progress: "On the road",
  completed: "Done",
  cancelled: "Cancelled",
  superseded: "Superseded",
};

const JOB_COLUMNS =
  "id, batch_id, label, status, area_label, order_count, total_weight_kg, cod_total, center_latitude, center_longitude, claimed_by, claimed_at, vehicle_id, route_id, started_at, completed_at, created_at, reproduce_count, priority, reproduced_from_job_id, metadata";

/**
 * When the next scheduled batch runs. Batches run on the first hourly check at
 * least 9 hours (less 5 minutes of slack) after the last scheduled one, so the
 * answer is rounded up to the next whole hour. Null when none has run yet,
 * which means the next hourly check will create one.
 */
export function nextBatchAt(lastScheduledAt: string | null): Date | null {
  if (!lastScheduledAt) return null;
  const last = Date.parse(lastScheduledAt);
  if (Number.isNaN(last)) return null;
  const due = last + BATCH_INTERVAL_HOURS * 3_600_000 - 5 * 60_000;
  const hour = 3_600_000;
  return new Date(Math.ceil(due / hour) * hour);
}

/** "2h 15m", "40m", or "any minute now" for a time that is due. */
export function countdownText(target: Date | null, now: number): string {
  if (!target) return "at the next hourly check";
  const minutes = Math.ceil((target.getTime() - now) / 60_000);
  if (minutes <= 1) return "any minute now";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function toJob(row: Record<string, unknown>): DeliveryJob {
  return {
    ...(row as unknown as DeliveryJob),
    order_count: toNumber(row.order_count),
    total_weight_kg: toNumber(row.total_weight_kg),
    cod_total: toNumber(row.cod_total),
    center_latitude:
      row.center_latitude == null ? null : toNumber(row.center_latitude),
    center_longitude:
      row.center_longitude == null ? null : toNumber(row.center_longitude),
    reproduce_count: toNumber(row.reproduce_count) || 0,
    priority: (row.priority as JobPriority) || "normal",
    reproduced_from_job_id: (row.reproduced_from_job_id as string) || null,
    metadata: (row.metadata as Record<string, unknown>) || {},
  };
}

/** Jobs the signed-in user may see: row-level security limits drivers to open and own jobs. */
export async function loadJobs(
  supabase: JobsClient,
  limit = 60,
): Promise<DeliveryJob[]> {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(JOB_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toJob(row as Record<string, unknown>));
}

/**
 * Jobs a driver can still take: open and not yet claimed. Claimed, running,
 * finished, cancelled and superseded jobs are processed work and never shown.
 */
export async function loadOpenJobs(
  supabase: JobsClient,
  limit = 60,
): Promise<DeliveryJob[]> {
  const { data, error } = await supabase
    .from("delivery_jobs")
    .select(JOB_COLUMNS)
    .eq("status", "open")
    .is("claimed_by", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toJob(row as Record<string, unknown>));
}

export async function loadQueue(supabase: JobsClient): Promise<QueueEntry[]> {
  const { data, error } = await supabase
    .from("delivery_queue")
    .select(
      "order_id, queued_at, job_id, auto_accepted, reproduce_count, last_calculated_at",
    )
    .order("queued_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    order_id: String(row.order_id),
    queued_at: String(row.queued_at),
    job_id: row.job_id ? String(row.job_id) : null,
    auto_accepted: Boolean(row.auto_accepted),
    reproduce_count: toNumber(row.reproduce_count) || 0,
    last_calculated_at: row.last_calculated_at
      ? String(row.last_calculated_at)
      : null,
  }));
}

export async function loadLastScheduledBatch(
  supabase: JobsClient,
): Promise<JobBatch | null> {
  const { data, error } = await supabase
    .from("job_batches")
    .select("id, trigger, job_count, order_count, created_at")
    .eq("trigger", "schedule")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as JobBatch | null) ?? null;
}

export async function queueOrders(supabase: JobsClient, orderIds: string[]) {
  const { data, error } = await supabase.rpc("queue_orders", {
    p_order_ids: orderIds,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

/**
 * Manager confirmation: queues the orders and lets automation cluster them into
 * jobs on the driver board straight away.
 */
export async function confirmOrders(supabase: JobsClient, orderIds: string[]) {
  const { data, error } = await supabase.rpc("confirm_orders", {
    p_order_ids: orderIds,
  });
  if (error) throw new Error(error.message);
  return data as { confirmed: number; jobs: number; orders: number };
}

export async function unqueueOrders(supabase: JobsClient, orderIds: string[]) {
  const { data, error } = await supabase.rpc("unqueue_orders", {
    p_order_ids: orderIds,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

export async function createJobBatch(supabase: JobsClient) {
  const { data, error } = await supabase.rpc("create_job_batch");
  if (error) throw new Error(error.message);
  return data as { batch_id: string; jobs: number; orders: number };
}

export async function claimJob(
  supabase: JobsClient,
  jobId: string,
  vehicleId: string | null,
) {
  const { data, error } = await supabase.rpc("claim_delivery_job", {
    p_job_id: jobId,
    p_vehicle_id: vehicleId,
  });
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error(
      "Those parcels were already assigned elsewhere, so the job was closed.",
    );
  return data;
}

/**
 * One swipe on the board: claims the job, orders its stops nearest-first from
 * the driver's position, loads the parcels and starts the route.
 */
export async function startJob(
  supabase: JobsClient,
  jobId: string,
  vehicleId: string | null,
  from: { latitude: number; longitude: number } | null,
) {
  const { data, error } = await supabase.rpc("start_delivery_job", {
    p_job_id: jobId,
    p_vehicle_id: vehicleId,
    p_latitude: from?.latitude ?? null,
    p_longitude: from?.longitude ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error(
      "Those parcels were already assigned elsewhere, so the job was closed.",
    );
  return data;
}

/** How far apart the job's drop-offs are, from its clustering metadata. */
export function jobSpreadKm(job: DeliveryJob): number | null {
  const value = Number(job.metadata?.spread_km);
  return Number.isFinite(value) ? value : null;
}

export async function releaseJob(supabase: JobsClient, jobId: string) {
  const { error } = await supabase.rpc("release_delivery_job", {
    p_job_id: jobId,
  });
  if (error) throw new Error(error.message);
}

/** Automatically accepts pending orders into the delivery queue. */
export async function autoAcceptOrders(
  supabase: JobsClient,
  orderIds?: string[],
): Promise<number> {
  const { data, error } = await supabase.rpc("auto_accept_orders", {
    p_order_ids: orderIds && orderIds.length > 0 ? orderIds : null,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/**
 * Extracts tasks from jobs not taken by any driver, enriches them with new
 * data (priority escalation, reproduce count, time extensions), supersedes
 * previous unclaimed jobs, and reproduces them onto the board for drivers.
 */
export async function reproduceUnclaimedTasks(
  supabase: JobsClient,
  options?: {
    maxAgeInterval?: string;
    maxOrders?: number;
    maxKg?: number;
  },
): Promise<ReproduceTasksResult> {
  const { data, error } = await supabase.rpc("reproduce_unclaimed_tasks", {
    p_max_age_interval: options?.maxAgeInterval ?? "0 seconds",
    p_max_orders: options?.maxOrders ?? 8,
    p_max_kg: options?.maxKg ?? 150,
  });
  if (error) throw new Error(error.message);
  return data as unknown as ReproduceTasksResult;
}

/**
 * Full automated workflow:
 * 1. Auto-accepts all pending unqueued orders into the delivery queue.
 * 2. Extracts unclaimed tasks, adds new data, supersedes old jobs, and reproduces them.
 * 3. Batches any remaining newly auto-accepted orders onto the board.
 */
export async function runAutomationWorkflow(
  supabase: JobsClient,
): Promise<WorkflowRunResult> {
  const { data, error } = await supabase.rpc(
    "run_auto_accept_and_reproduce_workflow",
  );
  if (error) throw new Error(error.message);
  return data as unknown as WorkflowRunResult;
}

// -----------------------------------------------------------------------------
// Pure Calculation Helpers for Automation Workflow
// -----------------------------------------------------------------------------

/**
 * Identifies unclaimed open jobs and extracts their assigned queue order IDs.
 * An open job with claimed_by === null and status === "open" is eligible.
 */
export function extractUnclaimedTasks(
  jobs: DeliveryJob[],
  queue: QueueEntry[],
  cutoffMs: number = Date.now(),
): { unclaimedJobs: DeliveryJob[]; extractedOrderIds: string[] } {
  const unclaimedJobs = jobs.filter(
    (job) =>
      job.status === "open" &&
      !job.claimed_by &&
      Date.parse(job.created_at) <= cutoffMs,
  );
  const unclaimedJobIds = new Set(unclaimedJobs.map((j) => j.id));
  const extractedOrderIds = queue
    .filter((entry) => entry.job_id && unclaimedJobIds.has(entry.job_id))
    .map((entry) => entry.order_id);

  return { unclaimedJobs, extractedOrderIds };
}

/**
 * Enriches a task when reproduced: increments reproduction count, escalates
 * priority to 'high' or 'urgent', and extends the estimated delivery buffer (+90m).
 */
export function enrichReproducedTask(
  task: {
    reproduce_count?: number;
    priority?: string;
    estimated_delivery_at?: string | null;
  },
  nowMs: number = Date.now(),
): {
  reproduce_count: number;
  priority: JobPriority;
  estimated_delivery_at: string;
  note: string;
} {
  const nextCount = (task.reproduce_count ?? 0) + 1;
  const priority: JobPriority = nextCount >= 2 ? "urgent" : "high";
  const existingEst = task.estimated_delivery_at
    ? Date.parse(task.estimated_delivery_at)
    : NaN;
  const baseTime =
    Number.isFinite(existingEst) && existingEst > nowMs ? existingEst : nowMs;
  const newDeliveryAt = new Date(baseTime + 90 * 60_000).toISOString();

  return {
    reproduce_count: nextCount,
    priority,
    estimated_delivery_at: newDeliveryAt,
    note: `Auto-reproduced (cycle ${nextCount})`,
  };
}

/**
 * Calculates aggregate job priority from its constituent orders.
 * If any order is urgent, job becomes urgent; if any is high, high; otherwise normal.
 */
export function calculateJobPriority(orderPriorities: string[]): JobPriority {
  if (orderPriorities.some((p) => p === "urgent")) return "urgent";
  if (orderPriorities.some((p) => p === "high")) return "high";
  if (orderPriorities.some((p) => p === "low")) return "low";
  return "normal";
}

/**
 * Formats a reproduction-aware label for driver board cards.
 */
export function formatJobReproductionLabel(
  baseLabel: string,
  reproduceCount: number,
  priority: string,
): string {
  if (priority === "urgent" || reproduceCount >= 2) {
    return `⚡ Urgent · 2nd Call · ${baseLabel}`;
  }
  if (priority === "high" || reproduceCount === 1) {
    return `⚡ Priority (R1) · ${baseLabel}`;
  }
  return baseLabel;
}

/**
 * Rich realistic Yangon delivery tasks ready for drivers to take.
 * Used when no open jobs are in the database, in offline mode, or in preview.
 */
/** Sample jobs are generated on the device and never claimed on the server. */
export function isSampleJob(job: Pick<DeliveryJob, "id">) {
  return job.id.startsWith("job-ygn-") || job.id.startsWith("job-sample-");
}

export const SAMPLE_OPEN_JOBS: DeliveryJob[] = [
  {
    id: "job-ygn-sanchaung-express",
    batch_id: "batch-sample-01",
    label: "Sanchaung Express Delivery",
    area_label: "Sanchaung Express",
    status: "open",
    order_count: 4,
    total_weight_kg: 8.5,
    cod_total: 45000,
    center_latitude: 16.8053,
    center_longitude: 96.1362,
    claimed_by: null,
    claimed_at: null,
    vehicle_id: null,
    route_id: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 15 * 60_000).toISOString(),
    reproduce_count: 0,
    priority: "urgent",
    reproduced_from_job_id: null,
    metadata: { spread_km: 1.8 },
  },
  {
    id: "job-ygn-kamayut-hledan",
    batch_id: "batch-sample-02",
    label: "Kamayut & Hledan Cluster",
    area_label: "Kamayut & Hledan",
    status: "open",
    order_count: 6,
    total_weight_kg: 12.0,
    cod_total: 72000,
    center_latitude: 16.8291,
    center_longitude: 96.1287,
    claimed_by: null,
    claimed_at: null,
    vehicle_id: null,
    route_id: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    reproduce_count: 0,
    priority: "high",
    reproduced_from_job_id: null,
    metadata: { spread_km: 2.4 },
  },
  {
    id: "job-ygn-downtown-core",
    batch_id: "batch-sample-03",
    label: "Downtown Commercial Core",
    area_label: "Downtown (Kyauktada & Pabedan)",
    status: "open",
    order_count: 8,
    total_weight_kg: 18.5,
    cod_total: 110000,
    center_latitude: 16.7745,
    center_longitude: 96.1585,
    claimed_by: null,
    claimed_at: null,
    vehicle_id: null,
    route_id: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    reproduce_count: 0,
    priority: "normal",
    reproduced_from_job_id: null,
    metadata: { spread_km: 1.5 },
  },
  {
    id: "job-ygn-bahan-embassy",
    batch_id: "batch-sample-04",
    label: "Bahan Embassy Quarter",
    area_label: "Bahan & Golden Valley",
    status: "open",
    order_count: 3,
    total_weight_kg: 5.2,
    cod_total: 0,
    center_latitude: 16.8122,
    center_longitude: 96.1524,
    claimed_by: null,
    claimed_at: null,
    vehicle_id: null,
    route_id: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    reproduce_count: 0,
    priority: "normal",
    reproduced_from_job_id: null,
    metadata: { spread_km: 1.2 },
  },
  {
    id: "job-ygn-yankin-hub",
    batch_id: "batch-sample-05",
    label: "Yankin Commercial Hub",
    area_label: "Yankin Township",
    status: "open",
    order_count: 5,
    total_weight_kg: 9.8,
    cod_total: 38000,
    center_latitude: 16.8375,
    center_longitude: 96.1628,
    claimed_by: null,
    claimed_at: null,
    vehicle_id: null,
    route_id: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 20 * 60_000).toISOString(),
    reproduce_count: 0,
    priority: "high",
    reproduced_from_job_id: null,
    metadata: { spread_km: 2.1 },
  },
  {
    id: "job-ygn-mayangone-j8",
    batch_id: "batch-sample-06",
    label: "Mayangone Junction 8 Loop",
    area_label: "Mayangone",
    status: "open",
    order_count: 7,
    total_weight_kg: 14.2,
    cod_total: 85000,
    center_latitude: 16.8672,
    center_longitude: 96.1415,
    claimed_by: null,
    claimed_at: null,
    vehicle_id: null,
    route_id: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 75 * 60_000).toISOString(),
    reproduce_count: 0,
    priority: "normal",
    reproduced_from_job_id: null,
    metadata: { spread_km: 3.2 },
  },
  {
    id: "job-ygn-tamwe-cluster",
    batch_id: "batch-sample-07",
    label: "Tamwe Township Cluster",
    area_label: "Tamwe & Kyauk Myaung",
    status: "open",
    order_count: 5,
    total_weight_kg: 11.0,
    cod_total: 54000,
    center_latitude: 16.7995,
    center_longitude: 96.1732,
    claimed_by: null,
    claimed_at: null,
    vehicle_id: null,
    route_id: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 40 * 60_000).toISOString(),
    reproduce_count: 0,
    priority: "normal",
    reproduced_from_job_id: null,
    metadata: { spread_km: 1.9 },
  },
  {
    id: "job-ygn-dagon-center",
    batch_id: "batch-sample-08",
    label: "Dagon Center Priority Loop",
    area_label: "Dagon (Pyay Road)",
    status: "open",
    order_count: 3,
    total_weight_kg: 4.8,
    cod_total: 0,
    center_latitude: 16.7885,
    center_longitude: 96.1425,
    claimed_by: null,
    claimed_at: null,
    vehicle_id: null,
    route_id: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    reproduce_count: 0,
    priority: "urgent",
    reproduced_from_job_id: null,
    metadata: { spread_km: 1.0 },
  },
];

const SAMPLE_NAMES = [
  "Daw Thida Khin",
  "U Kyaw Zeya",
  "Ko Min Thant",
  "Ma Hnin Ei",
  "U Soe Naing",
  "Daw San San Aye",
  "Ko Aung Myint",
  "Ma Yu Wai",
];

const SAMPLE_DESCRIPTIONS = [
  "Electronics item & cables",
  "Apparel and footwear package",
  "Home cookware set",
  "Office documents & stationery",
  "Personal care essentials",
  "Books and magazines set",
];

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Creates realistic active delivery orders and route stops for a taken job.
 * Allows immediate transition to active full-screen map navigation.
 */
export { isLocalOrderId } from "./ids.ts";

export function createOrdersForJob(
  job: DeliveryJob,
  driverId: string | null,
  nowTs = Date.now(),
): { orders: DeliveryOrder[]; routeStops: RouteStop[] } {
  const centerLat = job.center_latitude ?? 16.8053;
  const centerLng = job.center_longitude ?? 96.1362;
  const count = Math.max(1, job.order_count);
  const routeId = job.route_id || `route-${job.id}`;

  const weightPerOrder = Math.round((job.total_weight_kg / count) * 10) / 10;
  const codPerOrder =
    job.cod_total > 0 ? Math.round(job.cod_total / count / 100) * 100 : 0;

  const orders: DeliveryOrder[] = [];
  const routeStops: RouteStop[] = [];

  for (let i = 0; i < count; i += 1) {
    const orderId = `job-${job.id}-ord-${i + 1}`;
    // Spread stops naturally around the township cluster
    const angle = (i * 2 * Math.PI) / count + 0.4;
    const radius = 0.005 + (i % 3) * 0.004;
    const lat = centerLat + Math.sin(angle) * radius;
    const lng = centerLng + Math.cos(angle) * radius;

    const recipient = SAMPLE_NAMES[i % SAMPLE_NAMES.length];
    const isLast = i === count - 1;
    const codAmount =
      job.cod_total > 0
        ? isLast
          ? Math.max(0, job.cod_total - codPerOrder * (count - 1))
          : codPerOrder
        : 0;

    const stopAddress = `No. ${12 + i * 14}, ${job.area_label ?? "Yangon Central"}, Yangon`;

    const order: DeliveryOrder = {
      id: orderId,
      tracking_code: `YGN-${5000 + (Math.abs(stringHash(orderId)) % 4000)}`,
      customer_id: `customer-${job.id}-${i + 1}`,
      customer_name: recipient,
      status: "accepted",
      pickup_address: "Oern Central Depot, Yangon",
      delivery_address: stopAddress,
      pickup_latitude: 16.8053,
      pickup_longitude: 96.1362,
      delivery_latitude: lat,
      delivery_longitude: lng,
      recipient_name: recipient,
      recipient_phone: `09 450 ${100 + i} ${200 + i}`,
      parcel_description: SAMPLE_DESCRIPTIONS[i % SAMPLE_DESCRIPTIONS.length],
      parcel_weight_kg: weightPerOrder,
      cod_amount: codAmount,
      cod_status: codAmount > 0 ? "pending" : "not_required",
      estimated_delivery_at: new Date(
        nowTs + (i + 1) * 20 * 60_000,
      ).toISOString(),
      route_progress_percent: null,
      traffic_delay_minutes: 0,
      eta_confidence: "high",
      eta_updated_at: new Date(nowTs).toISOString(),
      created_at: new Date(nowTs - 45 * 60_000).toISOString(),
      driver_id: driverId,
      driver_name: "Oern Driver",
      driver_phone: "09 777 000 111",
      vehicle_id: job.vehicle_id ?? null,
      vehicle_label: null,
      route_id: routeId,
      latest_location: null,
    };

    orders.push(order);

    routeStops.push({
      id: `stop-${job.id}-${i + 1}`,
      route_id: routeId,
      order_id: orderId,
      stop_type: "delivery",
      sequence_number: i + 1,
      address: stopAddress,
      latitude: lat,
      longitude: lng,
      status: "pending",
      completed_at: null,
      created_at: new Date(nowTs - 45 * 60_000).toISOString(),
    });
  }

  return { orders, routeStops };
}
