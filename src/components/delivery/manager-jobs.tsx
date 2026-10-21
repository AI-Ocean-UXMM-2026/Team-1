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
  countdownText,
  createJobBatch,
  type DeliveryJob,
  JOB_STATUS_LABELS,
  loadJobs,
  loadLastScheduledBatch,
  loadQueue,
  nextBatchAt,
  type QueueEntry,
  queueOrders,
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
  const orderById = useMemo(
    () => new Map(workspace.data.orders.map((order) => [order.id, order])),
    [workspace.data.orders],
  );
  const openJobs = jobs.filter((job) => job.status === "open");
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
      const count = await queueOrders(createClient(), ids);
      return count === 1
        ? "1 order added to the queue."
        : `${count} orders added to the queue.`;
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
            <Icon name="arrow-left" size={15} /> Back to dispatch
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
          description="Accept orders into the queue. Every 9 hours the queue is grouped into jobs that drivers pick from."
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
            <section className="operations-kpis">
              <div>
                <span>Requests to accept</span>
                <strong>{requests.length}</strong>
              </div>
              <div>
                <span>In queue</span>
                <strong>{waiting.length}</strong>
              </div>
              <div>
                <span>Next jobs created</span>
                <strong>{countdownText(nextRun, now)}</strong>
              </div>
              <div>
                <span>Open jobs</span>
                <strong>{openJobs.length}</strong>
              </div>
            </section>

            <section className="operations-grid">
              <div className="operations-panel operations-panel-wide">
                <div className="section-head-inline">
                  <h2>New requests</h2>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!requests.length || busy != null}
                    onClick={() =>
                      void accept(requests.map((order) => order.id))
                    }
                  >
                    {busy === "accept" ? "Accepting…" : "Accept all"}
                  </button>
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
                        Accept
                      </button>
                    </article>
                  ))}
                  {!requests.length && (
                    <p className="empty-small-copy">
                      No new requests are waiting for acceptance.
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
                          <strong>{order?.tracking_code ?? "Order"}</strong>
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
                        <strong>{job.label}</strong>
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
