"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  ActionToast,
  LoadingBlock,
  PageHeader,
  SignInGate,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { currency, formatDateTime } from "@/lib/delivery/format";
import {
  autoAcceptOrders,
  confirmOrders,
  countdownText,
  createJobBatch,
  type DeliveryJob,
  JOB_STATUS_LABELS,
  loadJobs,
  loadLastScheduledBatch,
  loadQueue,
  nextBatchAt,
  type QueueEntry,
  reproduceUnclaimedTasks,
  runAutomationWorkflow,
  unqueueOrders,
} from "@/lib/delivery/jobs";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

function friendly(cause: unknown) {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

export function ManagerJobsApp() {
  const workspace = useWorkspace("manager");
  const live = workspace.isAuthenticated && workspace.canUseLiveData;
  const [authOpen, setAuthOpen] = useState(false);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [lastBatchAt, setLastBatchAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const reload = useCallback(async () => {
    const supabase = createClient();
    try {
      const [nextJobs, nextQueue, batch] = await Promise.all([
        loadJobs(supabase),
        loadQueue(supabase),
        loadLastScheduledBatch(supabase),
      ]);
      setJobs(nextJobs);
      setQueue(nextQueue);
      setLastBatchAt(batch?.created_at ?? null);
      setError(null);
    } catch (cause) {
      setError(friendly(cause));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    void reload();
    const supabase = createClient();
    const channel = supabase
      .channel("manager-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_jobs" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_queue" },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [live, reload]);

  const queuedIds = useMemo(
    () => new Set(queue.map((entry) => entry.order_id)),
    [queue],
  );
  const requests = workspace.data.orders.filter(
    (order) => order.status === "pending" && !queuedIds.has(order.id),
  );
  const waiting = queue.filter((entry) => !entry.job_id);
  const autoAcceptedWaiting = waiting.filter((entry) => entry.auto_accepted);
  const orderById = useMemo(
    () => new Map(workspace.data.orders.map((order) => [order.id, order])),
    [workspace.data.orders],
  );
  const openJobs = jobs.filter((job) => job.status === "open");
  const priorityJobs = openJobs.filter(
    (job) =>
      job.priority === "urgent" ||
      job.priority === "high" ||
      job.reproduce_count > 0,
  );
  const activeJobs = jobs.filter(
    (job) => job.status === "claimed" || job.status === "in_progress",
  );
  const nextRun = nextBatchAt(lastBatchAt);

  async function run(key: string, action: () => Promise<string>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      setMessage(await action());
      await reload();
    } catch (cause) {
      setError(friendly(cause));
    } finally {
      setBusy(null);
    }
  }

  const accept = (ids: string[]) =>
    run("accept", async () => {
      const result = await confirmOrders(createClient(), ids);
      if (!result.confirmed) return "Nothing to confirm.";
      const orders =
        result.confirmed === 1 ? "1 order" : `${result.confirmed} orders`;
      const jobs = result.jobs === 1 ? "1 job" : `${result.jobs} jobs`;
      return `${orders} confirmed. Automation posted ${jobs} to the driver board.`;
    });

  const autoAcceptAll = () =>
    run("auto-accept", async () => {
      const count = await autoAcceptOrders(createClient());
      return count === 1
        ? "1 pending order auto-accepted into the queue."
        : `${count} pending orders auto-accepted into the queue.`;
    });

  const reproduceUnclaimed = () =>
    run("reproduce", async () => {
      const res = await reproduceUnclaimedTasks(createClient());
      return res.message || "No unclaimed jobs to escalate.";
    });

  const runWorkflow = () =>
    run("workflow", async () => {
      const res = await runAutomationWorkflow(createClient());
      return res.message;
    });

  const remove = (id: string) =>
    run(`remove-${id}`, async () => {
      await unqueueOrders(createClient(), [id]);
      return "Order moved back to requests.";
    });

  const createNow = () =>
    run("batch", async () => {
      const result = await createJobBatch(createClient());
      return result.jobs
        ? `Created ${result.jobs} ${result.jobs === 1 ? "job" : "jobs"} from ${result.orders} orders.`
        : "Nothing is waiting in the queue.";
    });

  if (workspace.isLoading)
    return <LoadingBlock title="Opening the job board…" />;
  const signedOut = !workspace.isAuthenticated;

  return (
    <main className="operations-app jobs-app">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <Link className="workspace-back-link" href="/manager/home">
            <Icon name="arrow-left" size={15} /> Back to overview
          </Link>
          {!signedOut && (
            <UserActions
              profile={workspace.profile}
              isAuthenticated={workspace.isAuthenticated}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={() => void signOut()}
              label="Manager"
            />
          )}
        </div>
      </header>

      <div className="operations-shell">
        <PageHeader
          title="Job board"
          description="Confirm or check new requests. Automation clusters them into jobs for the nearest areas and posts them to the driver board, where drivers take them."
        />
        {(error || workspace.error) && (
          <div className="error-notice" role="alert">
            {error ?? workspace.error}
          </div>
        )}

        {signedOut ? (
          <SignInGate
            title="Sign in to the job board"
            body="Queue and jobs are available to manager accounts."
            onSignIn={() => setAuthOpen(true)}
          />
        ) : !loaded ? (
          <LoadingBlock title="Loading jobs…" />
        ) : (
          <>
            <section className="operations-panel operations-panel-wide automation-workflow-panel">
              <div className="automation-workflow-header">
                <div>
                  <div className="automation-badge-row">
                    <span className="automation-live-dot" />
                    <span className="automation-status-tag">
                      Automation Engine Active
                    </span>
                  </div>
                  <h3>Group nearby orders into jobs</h3>
                  <p>
                    Each run takes the waiting orders, unpacks open jobs no
                    driver has taken, and regroups everything by delivery
                    distance, so drop-offs close to each other share one job.
                    Drivers take jobs from their board; automation only builds
                    the groups and the stop order.
                  </p>
                </div>
                <div className="automation-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={busy != null}
                    onClick={() => void runWorkflow()}
                  >
                    {busy === "workflow"
                      ? "Running workflow…"
                      : "Accept all and regroup"}
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={!openJobs.length || busy != null}
                    onClick={() => void reproduceUnclaimed()}
                  >
                    {busy === "reproduce"
                      ? "Escalating…"
                      : "Escalate unclaimed jobs"}
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={!requests.length || busy != null}
                    onClick={() => void autoAcceptAll()}
                  >
                    {busy === "auto-accept"
                      ? "Auto-accepting…"
                      : "Auto-Accept Requests"}
                  </button>
                </div>
              </div>
            </section>

            <section className="operations-kpis">
              <div>
                <span>Requests to accept</span>
                <strong>{requests.length}</strong>
              </div>
              <div>
                <span>In queue</span>
                <strong>
                  {waiting.length}
                  {autoAcceptedWaiting.length > 0 && (
                    <small
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 400,
                        color: "#0284c7",
                      }}
                    >
                      {autoAcceptedWaiting.length} auto-accepted
                    </small>
                  )}
                </strong>
              </div>
              <div>
                <span>Next jobs created</span>
                <strong>{countdownText(nextRun, now)}</strong>
              </div>
              <div>
                <span>Open jobs</span>
                <strong>
                  {openJobs.length}
                  {priorityJobs.length > 0 && (
                    <small
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 400,
                        color: "#ea580c",
                      }}
                    >
                      {priorityJobs.length} priority / reproduced
                    </small>
                  )}
                </strong>
              </div>
            </section>

            <section className="operations-grid">
              <div className="operations-panel operations-panel-wide">
                <div className="section-head-inline">
                  <h2>New pickup requests</h2>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={!requests.length || busy != null}
                      onClick={() => void autoAcceptAll()}
                    >
                      {busy === "auto-accept"
                        ? "Auto-accepting…"
                        : "Auto-accept"}
                    </button>
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={!requests.length || busy != null}
                      onClick={() =>
                        void accept(requests.map((order) => order.id))
                      }
                    >
                      {busy === "accept" ? "Confirming…" : "Confirm all"}
                    </button>
                  </div>
                </div>
                <div className="operations-list">
                  {requests.map((order) => (
                    <article className="operations-list-item" key={order.id}>
                      <div>
                        <strong>{order.tracking_code}</strong>
                        <span>
                          {order.recipient_name || "Recipient"} ·{" "}
                          {order.delivery_address}
                        </span>
                        <span>
                          {order.parcel_weight_kg
                            ? `${order.parcel_weight_kg} kg`
                            : "Weight not set"}
                          {order.cod_amount
                            ? ` · COD ${currency.format(order.cod_amount)}`
                            : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="button button-dark"
                        disabled={busy != null}
                        onClick={() => void accept([order.id])}
                      >
                        Confirm
                      </button>
                    </article>
                  ))}
                  {!requests.length && (
                    <p className="empty-small-copy">
                      No new pickup requests to confirm.
                    </p>
                  )}
                </div>
              </div>

              <div className="operations-panel operations-panel-wide">
                <div className="section-head-inline">
                  <h2>Queue</h2>
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={!waiting.length || busy != null}
                    onClick={() => void createNow()}
                  >
                    {busy === "batch" ? "Creating…" : "Create jobs now"}
                  </button>
                </div>
                <div className="operations-list">
                  {waiting.map((entry) => {
                    const order = orderById.get(entry.order_id);
                    return (
                      <article
                        className="operations-list-item"
                        key={entry.order_id}
                      >
                        <div>
                          <div className="jobs-meta-row">
                            <strong>{order?.tracking_code ?? "Order"}</strong>
                            {entry.auto_accepted && (
                              <span className="jobs-pill is-auto">
                                Auto-accepted
                              </span>
                            )}
                            {(entry.reproduce_count ?? 0) > 0 && (
                              <span className="jobs-pill is-retry">
                                Cycle {entry.reproduce_count}
                              </span>
                            )}
                          </div>
                          <span>
                            {order?.delivery_address ?? "Address unavailable"} ·
                            queued {formatDateTime(entry.queued_at)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="button button-outline"
                          disabled={busy != null}
                          onClick={() => void remove(entry.order_id)}
                        >
                          Remove
                        </button>
                      </article>
                    );
                  })}
                  {!waiting.length && (
                    <p className="empty-small-copy">
                      The queue is empty. Accepted orders wait here for the next
                      batch.
                    </p>
                  )}
                </div>
              </div>

              <div className="operations-panel operations-panel-wide">
                <div className="section-head-inline">
                  <h2>Jobs</h2>
                  <span>{activeJobs.length} with drivers</span>
                </div>
                <div className="operations-list">
                  {jobs.map((job) => (
                    <article className="operations-list-item" key={job.id}>
                      <div>
                        <div className="jobs-meta-row">
                          <strong>{job.label}</strong>
                          {job.priority === "urgent" && (
                            <span className="jobs-pill is-urgent">
                              ⚡ Urgent · 2nd Call
                            </span>
                          )}
                          {(job.priority === "high" ||
                            job.reproduce_count > 0) && (
                            <span className="jobs-pill is-high">
                              ⚡ Priority{" "}
                              {job.reproduce_count > 0
                                ? `· R${job.reproduce_count}`
                                : ""}
                            </span>
                          )}
                        </div>
                        <span>
                          {job.order_count}{" "}
                          {job.order_count === 1 ? "parcel" : "parcels"} ·{" "}
                          {job.total_weight_kg} kg
                          {job.cod_total
                            ? ` · COD ${currency.format(job.cod_total)}`
                            : ""}
                          {job.area_label ? ` · ${job.area_label}` : ""}
                        </span>
                      </div>
                      <span className="jobs-status" data-status={job.status}>
                        {JOB_STATUS_LABELS[job.status]}
                      </span>
                    </article>
                  ))}
                  {!jobs.length && (
                    <p className="empty-small-copy">No jobs yet.</p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
      <ActionToast message={message} onDismiss={() => setMessage(null)} />
    </main>
  );
}
