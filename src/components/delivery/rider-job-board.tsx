"use client";

import "./rider-jobs.css";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Icon } from "@/components/delivery/icons";
import { SwipeConfirm } from "@/components/delivery/swipe-confirm";
import {
  type DeliveryJob,
  isSampleJob,
  jobSpreadKm,
  loadOpenJobs,
  SAMPLE_OPEN_JOBS,
  startJob,
} from "@/lib/delivery/jobs";
import {
  distanceKm,
  formatDistance,
  type GeoPoint,
} from "@/lib/delivery/rider-route";
import type { VehicleOption } from "@/lib/delivery/types";
import { createClient } from "@/lib/supabase/client";

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 } as const;

/** One fix, or null when location is off or slow. Never throws. */
function currentPoint(timeout = 6000): Promise<GeoPoint | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator))
    return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (fix) =>
        resolve({
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60_000 },
    );
  });
}

const centreOf = (job: DeliveryJob): GeoPoint | null =>
  job.center_latitude != null && job.center_longitude != null
    ? { latitude: job.center_latitude, longitude: job.center_longitude }
    : null;

/**
 * Open jobs every driver can see. Tap a card to review it, swipe to take it;
 * the route page then handles loading and starting.
 */
export function RiderJobBoard({
  vehicles,
  onTaken,
  blocked = null,
  sampleJobs = false,
  menu = null,
  notices = null,
}: {
  vehicles: VehicleOption[];
  onTaken: (job: DeliveryJob) => void;
  /** Why the driver can't take a job right now, e.g. one is already running. */
  blocked?: string | null;
  /** Dev preview only: show sample jobs instead of the live board. */
  sampleJobs?: boolean;
  /** The shift tools button, shown beside the title. */
  menu?: ReactNode;
  /** Banners shown under the title, such as a job already in progress. */
  notices?: ReactNode;
}) {
  const [jobs, setJobs] = useState<DeliveryJob[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [here, setHere] = useState<GeoPoint | null>(null);

  const reload = useCallback(async () => {
    if (sampleJobs) {
      setJobs(SAMPLE_OPEN_JOBS);
      return;
    }
    try {
      // Only open, unclaimed jobs: processed work never returns to the board.
      const open = (await loadOpenJobs(createClient())).filter(
        (job) => job.status === "open" && job.claimed_by == null,
      );
      setJobs(open);
      setLoadFailed(false);
      setExpandedId((current) =>
        current && open.some((job) => job.id === current) ? current : null,
      );
    } catch {
      // Keep what is on screen; never invent work when the fetch fails.
      setJobs((current) => current ?? []);
      setLoadFailed(true);
    }
  }, [sampleJobs]);

  useEffect(() => {
    void reload();
    void currentPoint().then((point) => point && setHere(point));
    if (sampleJobs) return;
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel("rider-job-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_jobs" },
        () => {
          clearTimeout(pending);
          pending = setTimeout(() => void reload(), 300);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [reload, sampleJobs]);

  // Nearest first once we know where the driver is; urgent work leads either way.
  const sorted = useMemo(() => {
    if (!jobs) return null;
    const away = (job: DeliveryJob) => {
      const centre = centreOf(job);
      return here && centre ? distanceKm(here, centre) : null;
    };
    return jobs
      .map((job) => ({ job, awayKm: away(job) }))
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.job.priority] - PRIORITY_RANK[b.job.priority] ||
          (a.awayKm ?? Number.POSITIVE_INFINITY) -
            (b.awayKm ?? Number.POSITIVE_INFINITY) ||
          b.job.created_at.localeCompare(a.job.created_at),
      );
  }, [jobs, here]);

  const usable = vehicles.filter(
    (vehicle) => vehicle.status === "available" || vehicle.status === "in_use",
  );
  // Riders no longer choose a vehicle; it is only used when exactly one is usable.
  const selectedVehicleId = usable.length === 1 ? usable[0].id : "";
  const selectedVehicle = usable.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );
  const isTooHeavy = (job: DeliveryJob) =>
    selectedVehicle?.capacity_kg != null &&
    job.total_weight_kg > selectedVehicle.capacity_kg;
  // Why the swipe is locked: a few words, shown once, on the swipe itself.
  const lockReason = (job: DeliveryJob) =>
    blocked ?? (isTooHeavy(job) ? "Too heavy" : null);

  async function take(job: DeliveryJob) {
    if (starting || lockReason(job)) return;
    setStarting(job.id);
    setError(null);
    try {
      // Sample jobs live on this phone only; real ones are claimed on the server.
      if (!isSampleJob(job))
        await startJob(createClient(), job.id, selectedVehicleId || null, here);
      onTaken(job);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not take the job.",
      );
      await reload();
    } finally {
      setStarting(null);
    }
  }

  return (
    <section className="rj-board" aria-labelledby="rj-title">
      <header className="rj-header">
        <div className="rj-title-block">
          <h1 id="rj-title">Jobs</h1>
          {sorted && sorted.length > 0 && (
            <span className="rj-count">{sorted.length} open</span>
          )}
        </div>
        {menu}
      </header>

      {notices}

      {(error || loadFailed) && (
        <div className="rj-error-banner" role="alert">
          <Icon name="warning" size={18} />
          <span>
            {error ??
              "Couldn’t refresh the job list. What you see may be out of date."}
          </span>
          {loadFailed && !error && (
            <button type="button" onClick={() => void reload()}>
              Retry
            </button>
          )}
        </div>
      )}

      {sorted === null ? (
        <output className="rj-status">Loading jobs…</output>
      ) : sorted.length === 0 ? (
        <div className="rj-empty">
          <span className="rj-empty-icon" aria-hidden="true">
            <Icon name="package" size={24} />
          </span>
          <h2>No jobs open right now</h2>
          <p>New jobs appear here as soon as dispatch confirms orders.</p>
        </div>
      ) : (
        <ul className="rj-list">
          {sorted.map(({ job, awayKm }, index) => {
            const isExpanded = expandedId === job.id;
            const spread = jobSpreadKm(job);
            const panelId = `rj-job-${job.id}`;
            const title = job.area_label ?? job.label;
            const locked = lockReason(job);
            const tooHeavy = isTooHeavy(job);

            return (
              <li
                key={job.id}
                className={`rj-card${isExpanded ? " is-selected" : ""}`}
              >
                <button
                  type="button"
                  className="rj-card-content"
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                >
                  <span
                    className="rj-stops"
                    role="img"
                    aria-label={`${job.order_count} ${job.order_count === 1 ? "stop" : "stops"}`}
                  >
                    <strong>{job.order_count}</strong>
                    <small>{job.order_count === 1 ? "stop" : "stops"}</small>
                  </span>
                  <span className="rj-main">
                    <span className="rj-card-title-row">
                      <strong className="rj-card-title">{title}</strong>
                      {index === 0 && awayKm != null ? (
                        <span className="rj-tag">Nearest</span>
                      ) : null}
                    </span>
                    <span className="rj-facts">
                      <span className={tooHeavy ? "is-over" : undefined}>
                        {job.total_weight_kg} kg
                      </span>
                      {spread != null && (
                        <span>Within {formatDistance(spread)}</span>
                      )}
                    </span>
                  </span>
                  <span className="rj-side">
                    {awayKm != null && (
                      <span className="rj-away">{formatDistance(awayKm)}</span>
                    )}
                    <span
                      className={`rj-chevron${isExpanded ? " is-open" : ""}`}
                      aria-hidden="true"
                    >
                      <Icon name="chevron-down" size={18} />
                    </span>
                  </span>
                </button>

                {isExpanded && (
                  <div className="rj-card-detail" id={panelId}>
                    <SwipeConfirm
                      label={`Take ${title}`}
                      hint={
                        locked ??
                        (starting === job.id
                          ? "Taking job…"
                          : "Swipe to take this job")
                      }
                      disabled={starting != null || locked != null}
                      onConfirm={() => void take(job)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
