"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  ActionToast,
  DemoBadge,
  LoadingBlock,
  MobileNav,
  type MobileNavItem,
  PageHeader,
  SignInGate,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { Icon, type IconName } from "@/components/delivery/icons";
import {
  type FloodPoint,
  FloodWatch,
  floodZoneAt,
} from "@/components/delivery/manager-flood-watch";
import { ManagerSidebar } from "@/components/delivery/manager-sidebar";
import {
  type FloodZone,
  getYangonFloodZones,
} from "@/lib/delivery/flood-zones";
import { currency, formatDateTime } from "@/lib/delivery/format";
import {
  autoAcceptOrders,
  confirmOrders,
  createJobBatch,
  type DeliveryJob,
  isSampleJob,
  JOB_STATUS_LABELS,
  loadJobs,
  loadQueue,
  type QueueEntry,
  releaseJob,
  SAMPLE_OPEN_JOBS,
  unqueueOrders,
} from "@/lib/delivery/jobs";
import "./manager-jobs.css";
import {
  isSampleOrder,
  SAMPLE_QUEUE_ENTRIES,
  SAMPLE_REQUEST_ORDERS,
  SAMPLE_TASK_JOBS,
} from "@/lib/delivery/sample-automation";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

function friendly(cause: unknown) {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

const mobileNavItems: MobileNavItem[] = [
  { id: "home", label: "Overview", href: "/manager/home", icon: "delivery" },
  { id: "order", label: "Orders", href: "/manager/order", icon: "box" },
  { id: "track", label: "Track", href: "/manager/track", icon: "track" },
  { id: "cod", label: "COD", href: "/manager/cod", icon: "coin" },
  { id: "jobs", label: "Automation", href: "/manager/jobs", icon: "spark" },
];

function EmptyStage({ icon, children }: { icon: IconName; children: string }) {
  return (
    <div className="jobs-empty">
      <span className="jobs-empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <p>{children}</p>
    </div>
  );
}

function FloodChip({ zone }: { zone: FloodZone | null }) {
  if (!zone) return null;
  return (
    <em className="flood-chip" data-class={zone.hazardClass}>
      <Icon name="flood" size={13} />
      {zone.name}
    </em>
  );
}

const BOARD_COLUMNS = [
  { status: "open", title: "Open", hint: "Waiting for a driver" },
  { status: "claimed", title: "Taken", hint: "Driver assigned" },
  { status: "in_progress", title: "On the road", hint: "Route started" },
  { status: "completed", title: "Done", hint: "Latest finished" },
] as const;

const DONE_LIMIT = 5;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ManagerJobsApp() {
  const workspace = useWorkspace("manager");
  const live = workspace.isAuthenticated && workspace.canUseLiveData;
  const [authOpen, setAuthOpen] = useState(false);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    try {
      const [nextJobs, nextQueue] = await Promise.all([
        loadJobs(supabase),
        loadQueue(supabase),
      ]);
      setJobs(nextJobs);
      setQueue(nextQueue);
      setError(null);
    } catch (cause) {
      setError(friendly(cause));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!live) {
      setLoaded(true);
      return;
    }
    void reload();
    const supabase = createClient();
    const channel = supabase.channel("manager-jobs");
    for (const table of ["delivery_jobs", "delivery_queue"]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => void reload(),
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [live, reload]);

  const queuedIds = useMemo(
    () =>
      new Set([
        ...queue.map((entry) => entry.order_id),
        ...SAMPLE_QUEUE_ENTRIES.map((entry) => entry.order_id),
      ]),
    [queue],
  );
  const orderById = useMemo(
    () =>
      new Map(
        [...workspace.data.orders, ...SAMPLE_REQUEST_ORDERS].map((order) => [
          order.id,
          order,
        ]),
      ),
    [workspace.data.orders],
  );
  // Live requests drive the bulk actions; sample rows are display-only.
  const liveRequests = useMemo(
    () =>
      workspace.data.orders.filter(
        (order) => order.status === "pending" && !queuedIds.has(order.id),
      ),
    [workspace.data.orders, queuedIds],
  );
  const requests = useMemo(
    () => [
      ...liveRequests,
      ...SAMPLE_REQUEST_ORDERS.filter((order) => !queuedIds.has(order.id)),
    ],
    [liveRequests, queuedIds],
  );
  const waiting = [
    ...queue.filter((entry) => !entry.job_id),
    ...SAMPLE_QUEUE_ENTRIES,
  ];
  const floodZones = useMemo(() => getYangonFloodZones(), []);
  // Demo mode has no jobs table behind it, so show the sample tasks instead.
  const tasks = useMemo(
    () => [
      ...(workspace.isDemo ? SAMPLE_OPEN_JOBS : jobs),
      ...SAMPLE_TASK_JOBS,
    ],
    [workspace.isDemo, jobs],
  );
  const activeTaskCount = tasks.filter((job) =>
    ["open", "claimed", "in_progress"].includes(job.status),
  ).length;
  const driverName = (id: string | null) =>
    id
      ? (workspace.data.drivers.find((driver) => driver.id === id)?.full_name ??
        "Driver")
      : null;
  const floodPoints = useMemo<FloodPoint[]>(() => {
    const result: FloodPoint[] = [];
    for (const order of requests) {
      if (order.delivery_latitude != null && order.delivery_longitude != null)
        result.push({
          id: order.id,
          label: order.tracking_code,
          latitude: order.delivery_latitude,
          longitude: order.delivery_longitude,
          kind: "request",
        });
    }
    for (const job of tasks) {
      if (
        job.center_latitude != null &&
        job.center_longitude != null &&
        ["open", "claimed", "in_progress"].includes(job.status)
      )
        result.push({
          id: job.id,
          label: job.label,
          latitude: job.center_latitude,
          longitude: job.center_longitude,
          kind: "task",
        });
    }
    return result;
  }, [requests, tasks]);

  async function run(action: () => Promise<string>) {
    if (busy) return;
    if (!live) {
      setMessage("Sign in with a manager account to change jobs.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setMessage(await action());
      await reload();
    } catch (cause) {
      setError(friendly(cause));
    } finally {
      setBusy(false);
    }
  }

  const accept = (ids: string[]) =>
    run(async () => {
      const result = await confirmOrders(createClient(), ids);
      if (!result.confirmed) return "Nothing to post.";
      return `${plural(result.confirmed, "order")} posted as ${plural(result.jobs, "job")} on the driver board.`;
    });

  const queueOrders = (ids?: string[]) =>
    run(async () => {
      const count = await autoAcceptOrders(createClient(), ids);
      return `${plural(count, "order")} added to the queue.`;
    });

  const remove = (id: string) =>
    run(async () => {
      await unqueueOrders(createClient(), [id]);
      return "Order moved back to requests.";
    });

  const reopen = (id: string) =>
    run(async () => {
      await releaseJob(createClient(), id);
      return "Task reopened for other drivers.";
    });

  const createNow = () =>
    run(async () => {
      const result = await createJobBatch(createClient());
      return result.jobs
        ? `Created ${plural(result.jobs, "job")} from ${plural(result.orders, "order")}.`
        : "Nothing is waiting in the queue.";
    });

  if (workspace.isLoading)
    return <LoadingBlock title="Opening Task Automation…" />;
  const signedOut = !workspace.isAuthenticated && !workspace.isDemo;

  return (
    <main className="manager-app jobs-app">
      <ManagerSidebar active="jobs" />
      <MobileNav
        label="Manager workspace"
        items={mobileNavItems}
        activeId="jobs"
      />

      <div className="manager-main">
        <header className="manager-topbar">
          <div className="manager-topbar-right">
            <UserActions
              profile={workspace.profile}
              isAuthenticated={workspace.isAuthenticated}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={() => void signOut()}
              label="Manager"
            />
          </div>
        </header>

        <div className="manager-content">
          <PageHeader
            title="Task Automation"
            description="Queue new requests and automation groups nearby drop-offs into jobs. Post now to skip the queue."
          />
          {workspace.isDemo && (
            <div className="workspace-demo manager-demo">
              <DemoBadge>Demo operations</DemoBadge>
              <span>
                Sign in with a manager account to queue and post jobs.
              </span>
            </div>
          )}
          {(error || workspace.error) && (
            <div className="error-notice" role="alert">
              {error ?? workspace.error}
            </div>
          )}

          {signedOut ? (
            <SignInGate
              title="Sign in to Task Automation"
              body="Queue and jobs are available to manager accounts."
              onSignIn={() => setAuthOpen(true)}
            />
          ) : !loaded ? (
            <LoadingBlock title="Loading jobs…" />
          ) : (
            <>
              <div className="jobs-pipeline">
                <section className="jobs-stage" aria-labelledby="jobs-requests">
                  <header className="jobs-stage-head">
                    <h2 id="jobs-requests">
                      New requests <span>{requests.length}</span>
                    </h2>
                    <div className="jobs-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={!live || !liveRequests.length || busy}
                        onClick={() => void queueOrders()}
                      >
                        Queue all
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={!live || !liveRequests.length || busy}
                        onClick={() =>
                          void accept(liveRequests.map((order) => order.id))
                        }
                      >
                        Post all now
                      </button>
                    </div>
                  </header>
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
                          <FloodChip
                            zone={floodZoneAt(
                              order.delivery_latitude,
                              order.delivery_longitude,
                              floodZones,
                            )}
                          />
                        </div>
                        <div className="jobs-row-actions">
                          <button
                            type="button"
                            className="button button-outline"
                            disabled={!live || busy || isSampleOrder(order.id)}
                            aria-label={`Queue ${order.tracking_code}`}
                            onClick={() => void queueOrders([order.id])}
                          >
                            Queue
                          </button>
                          <button
                            type="button"
                            className="button button-dark"
                            disabled={!live || busy || isSampleOrder(order.id)}
                            aria-label={`Post ${order.tracking_code} now`}
                            onClick={() => void accept([order.id])}
                          >
                            Post now
                          </button>
                        </div>
                      </article>
                    ))}
                    {!requests.length && (
                      <EmptyStage icon="package">
                        No requests waiting. New pickup requests appear here.
                      </EmptyStage>
                    )}
                  </div>
                </section>

                <section className="jobs-stage" aria-labelledby="jobs-queue">
                  <header className="jobs-stage-head">
                    <h2 id="jobs-queue">
                      Queue <span>{waiting.length}</span>
                    </h2>
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={!live || !waiting.length || busy}
                      onClick={() => void createNow()}
                    >
                      Group into jobs
                    </button>
                  </header>
                  <div className="operations-list">
                    {waiting.map((entry) => {
                      const order = orderById.get(entry.order_id);
                      const code = order?.tracking_code ?? "Order";
                      return (
                        <article
                          className="operations-list-item"
                          key={entry.order_id}
                        >
                          <div>
                            <strong>{code}</strong>
                            <span>
                              {order?.delivery_address ?? "Address unavailable"}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="button button-outline"
                            disabled={
                              !live || busy || isSampleOrder(entry.order_id)
                            }
                            aria-label={`Move ${code} back to requests`}
                            onClick={() => void remove(entry.order_id)}
                          >
                            Remove
                          </button>
                        </article>
                      );
                    })}
                    {!waiting.length && (
                      <EmptyStage icon="history">
                        Queued orders wait here until automation groups them by
                        area.
                      </EmptyStage>
                    )}
                  </div>
                </section>
              </div>

              <section className="jobs-board" aria-labelledby="jobs-tasks">
                <header className="jobs-stage-head">
                  <h2 id="jobs-tasks">
                    Tasks <span>{activeTaskCount} active</span>
                  </h2>
                </header>
                <div className="jobs-board-columns">
                  {BOARD_COLUMNS.map((column) => {
                    const all = tasks.filter(
                      (job) => job.status === column.status,
                    );
                    const shown =
                      column.status === "completed"
                        ? all.slice(0, DONE_LIMIT)
                        : all;
                    return (
                      <div
                        className="jobs-board-column"
                        data-status={column.status}
                        key={column.status}
                      >
                        <h3>
                          {column.title} <span>{all.length}</span>
                        </h3>
                        <ul>
                          {shown.map((job) => {
                            const zone = floodZoneAt(
                              job.center_latitude,
                              job.center_longitude,
                              floodZones,
                            );
                            const driver = driverName(job.claimed_by);
                            return (
                              <li className="task-card" key={job.id}>
                                <strong>{job.label}</strong>
                                <span>
                                  {plural(job.order_count, "parcel")} ·{" "}
                                  {job.total_weight_kg} kg
                                  {job.cod_total
                                    ? ` · COD ${currency.format(job.cod_total)}`
                                    : ""}
                                </span>
                                {job.area_label && (
                                  <span>{job.area_label}</span>
                                )}
                                <span>
                                  {driver
                                    ? `${driver} · since ${formatDateTime(job.claimed_at ?? job.created_at)}`
                                    : `Posted ${formatDateTime(job.created_at)}`}
                                </span>
                                <FloodChip zone={zone} />
                                {job.status === "claimed" && (
                                  <button
                                    type="button"
                                    className="button button-outline"
                                    disabled={!live || busy || isSampleJob(job)}
                                    aria-label={`Reopen ${job.label} for other drivers`}
                                    onClick={() => void reopen(job.id)}
                                  >
                                    Reopen
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        {!all.length && (
                          <p className="jobs-board-empty">{column.hint}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <FloodWatch zones={floodZones} points={floodPoints} />
            </>
          )}
        </div>
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
