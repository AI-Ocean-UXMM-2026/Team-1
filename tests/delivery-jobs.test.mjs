import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateJobPriority,
  countdownText,
  enrichReproducedTask,
  extractUnclaimedTasks,
  formatJobReproductionLabel,
  nextBatchAt,
} from "../src/lib/delivery/jobs.ts";

test("next batch is nine hours after the last, less slack, on the hour", () => {
  const next = nextBatchAt("2026-10-23T00:00:00Z");
  assert.equal(next?.toISOString(), "2026-10-23T09:00:00.000Z");
  // Within the 5 minute slack it still runs on the ninth-hour tick.
  const slack = nextBatchAt("2026-10-23T00:00:04Z");
  assert.equal(slack?.toISOString(), "2026-10-23T09:00:00.000Z");
  // A batch that ran more than 5 minutes late misses that tick and waits an hour.
  const late = nextBatchAt("2026-10-23T00:20:00Z");
  assert.equal(late?.toISOString(), "2026-10-23T10:00:00.000Z");
});

test("no earlier batch means the next hourly check", () => {
  assert.equal(nextBatchAt(null), null);
  assert.equal(nextBatchAt("not a date"), null);
  assert.equal(countdownText(null, 0), "at the next hourly check");
});

test("countdown reads in hours and minutes", () => {
  const now = Date.parse("2026-10-23T06:00:00Z");
  assert.equal(countdownText(new Date("2026-10-23T08:15:00Z"), now), "2h 15m");
  assert.equal(countdownText(new Date("2026-10-23T09:00:00Z"), now), "3h");
  assert.equal(countdownText(new Date("2026-10-23T06:40:00Z"), now), "40m");
  assert.equal(
    countdownText(new Date("2026-10-23T05:00:00Z"), now),
    "any minute now",
  );
});

test("extractUnclaimedTasks identifies jobs not taken by any driver and unlinks their orders", () => {
  const jobs = [
    {
      id: "job-1",
      batch_id: "batch-1",
      label: "Job 1",
      status: "open",
      claimed_by: null,
      claimed_at: null,
      order_count: 2,
      total_weight_kg: 5,
      cod_total: 0,
      center_latitude: 16.8,
      center_longitude: 96.1,
      area_label: "Kamayut",
      vehicle_id: null,
      route_id: null,
      started_at: null,
      completed_at: null,
      created_at: "2026-10-23T01:00:00Z",
      reproduce_count: 0,
      priority: "normal",
      reproduced_from_job_id: null,
    },
    {
      id: "job-2",
      batch_id: "batch-1",
      label: "Job 2",
      status: "claimed",
      claimed_by: "driver-uuid-1",
      claimed_at: "2026-10-23T01:10:00Z",
      order_count: 1,
      total_weight_kg: 3,
      cod_total: 10000,
      center_latitude: 16.82,
      center_longitude: 96.12,
      area_label: "Hlaing",
      vehicle_id: null,
      route_id: "route-1",
      started_at: null,
      completed_at: null,
      created_at: "2026-10-23T01:00:00Z",
      reproduce_count: 0,
      priority: "normal",
      reproduced_from_job_id: null,
    },
  ];

  const queue = [
    { order_id: "ord-1", queued_at: "2026-10-23T00:50:00Z", job_id: "job-1" },
    { order_id: "ord-2", queued_at: "2026-10-23T00:55:00Z", job_id: "job-1" },
    { order_id: "ord-3", queued_at: "2026-10-23T00:58:00Z", job_id: "job-2" },
  ];

  const { unclaimedJobs, extractedOrderIds } = extractUnclaimedTasks(
    jobs,
    queue,
    Date.parse("2026-10-23T01:30:00Z"),
  );

  assert.equal(unclaimedJobs.length, 1);
  assert.equal(unclaimedJobs[0].id, "job-1");
  assert.deepEqual(extractedOrderIds, ["ord-1", "ord-2"]);
});

test("enrichReproducedTask increments count, escalates priority and extends buffer", () => {
  const now = Date.parse("2026-10-23T02:00:00Z");

  // First reproduction
  const first = enrichReproducedTask(
    {
      reproduce_count: 0,
      priority: "normal",
      estimated_delivery_at: "2026-10-23T02:30:00Z",
    },
    now,
  );
  assert.equal(first.reproduce_count, 1);
  assert.equal(first.priority, "high");
  // +90 minutes buffer from existing estimate (02:30 -> 04:00)
  assert.equal(first.estimated_delivery_at, "2026-10-23T04:00:00.000Z");
  assert.equal(first.note, "Auto-reproduced (cycle 1)");

  // Second reproduction (escalates to urgent)
  const second = enrichReproducedTask(
    {
      reproduce_count: 1,
      priority: "high",
      estimated_delivery_at: "2026-10-23T04:00:00Z",
    },
    now,
  );
  assert.equal(second.reproduce_count, 2);
  assert.equal(second.priority, "urgent");
  assert.equal(second.estimated_delivery_at, "2026-10-23T05:30:00.000Z");
  assert.equal(second.note, "Auto-reproduced (cycle 2)");
});

test("calculateJobPriority aggregates task priorities accurately", () => {
  assert.equal(calculateJobPriority(["normal", "normal"]), "normal");
  assert.equal(calculateJobPriority(["normal", "high"]), "high");
  assert.equal(calculateJobPriority(["high", "urgent", "normal"]), "urgent");
  assert.equal(calculateJobPriority(["low"]), "low");
});

test("formatJobReproductionLabel tags labels for driver board clarity", () => {
  assert.equal(formatJobReproductionLabel("Job 3", 0, "normal"), "Job 3");
  assert.equal(
    formatJobReproductionLabel("Job 3", 1, "high"),
    "⚡ Priority (R1) · Job 3",
  );
  assert.equal(
    formatJobReproductionLabel("Job 3", 2, "urgent"),
    "⚡ Urgent · 2nd Call · Job 3",
  );
});

test("SAMPLE_OPEN_JOBS populates rich Yangon delivery tasks for drivers", async () => {
  const { SAMPLE_OPEN_JOBS, createOrdersForJob } = await import(
    "../src/lib/delivery/jobs.ts"
  );
  assert.ok(SAMPLE_OPEN_JOBS.length >= 8);
  for (const job of SAMPLE_OPEN_JOBS) {
    assert.equal(job.status, "open");
    assert.ok(job.order_count >= 1);
    assert.ok(job.total_weight_kg > 0);
    assert.ok(job.center_latitude != null);
    assert.ok(job.center_longitude != null);
  }

  const sampleJob = SAMPLE_OPEN_JOBS[0];
  const { orders, routeStops } = createOrdersForJob(
    sampleJob,
    "driver-test-1",
    1700000000000,
  );
  assert.equal(orders.length, sampleJob.order_count);
  assert.equal(routeStops.length, sampleJob.order_count);
  assert.equal(orders[0].driver_id, "driver-test-1");
  // Taken, not started: taking the job accepts its parcels, so the driver goes
  // straight to the load check and then starts the route.
  assert.equal(orders[0].status, "accepted");
  assert.equal(routeStops[0].sequence_number, 1);
  assert.equal(
    routeStops[routeStops.length - 1].sequence_number,
    sampleJob.order_count,
  );
  const totalWeight = orders.reduce(
    (sum, o) => sum + (o.parcel_weight_kg ?? 0),
    0,
  );
  assert.ok(Math.abs(totalWeight - sampleJob.total_weight_kg) < 1.0);
});
