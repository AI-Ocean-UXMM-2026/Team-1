import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type JobsClient = SupabaseClient<Database>;

/** Hours between scheduled batches. Mirrors private.run_scheduled_job_batch. */
export const BATCH_INTERVAL_HOURS = 9;

export type JobStatus =
  | "open"
  | "claimed"
  | "in_progress"
  | "completed"
  | "cancelled";

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
};

export type JobBatch = {
  id: string;
  trigger: "schedule" | "manual";
  job_count: number;
  order_count: number;
  created_at: string;
};

export type QueueEntry = {
  order_id: string;
  queued_at: string;
  job_id: string | null;
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "Open",
  claimed: "Taken",
  in_progress: "On the road",
  completed: "Done",
  cancelled: "Cancelled",
};

const JOB_COLUMNS =
  "id, batch_id, label, status, area_label, order_count, total_weight_kg, cod_total, center_latitude, center_longitude, claimed_by, claimed_at, vehicle_id, route_id, started_at, completed_at, created_at";

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

export async function loadQueue(supabase: JobsClient): Promise<QueueEntry[]> {
  const { data, error } = await supabase
    .from("delivery_queue")
    .select("order_id, queued_at, job_id")
    .order("queued_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
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

export async function releaseJob(supabase: JobsClient, jobId: string) {
  const { error } = await supabase.rpc("release_delivery_job", {
    p_job_id: jobId,
  });
  if (error) throw new Error(error.message);
}
