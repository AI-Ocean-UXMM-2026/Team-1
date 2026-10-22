"use client";

import "./rider-jobs.css";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { SwipeConfirm } from "@/components/delivery/swipe-confirm";
import { currency } from "@/lib/delivery/format";
import {
  type DeliveryJob,
  SAMPLE_OPEN_JOBS,
  jobSpreadKm,
  loadJobs,
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
 * Open jobs every driver can see. Tap a card to see the load, swipe to take
 * it: the route starts at once and the app switches to navigation.
 */
export function RiderJobBoard({
  vehicles,
  onStarted,
}: {
  vehicles: VehicleOption[];
  onStarted: (job: DeliveryJob) => void;
}) {
  const [jobs, setJobs] = useState<DeliveryJob[] | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [here, setHere] = useState<GeoPoint | null>(null);

  const reload = useCallback(async () => {
    try {
      const all = await loadJobs(createClient());
      const open = all.filter((job) => job.status === "open");
      if (open.length === 0) {
        setJobs(SAMPLE_OPEN_JOBS);
      } else {
        const existingIds = new Set(open.map((j) => j.id));
        const extra = SAMPLE_OPEN_JOBS.filter((j) => !existingIds.has(j.id));
        setJobs([...open, ...extra]);
      }
      setExpandedId((current) =>
        current &&
        (open.some((job) => job.id === current) ||
          SAMPLE_OPEN_JOBS.some((job) => job.id === current))
          ? current
          : null,
      );
    } catch {
      setJobs(SAMPLE_OPEN_JOBS);
    }
  }, []);

  useEffect(() => {
    void reload();
    void currentPoint().then((point) => point && setHere(point));
    const supabase = createClient();
    const channel = supabase
      .channel("rider-job-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_jobs" },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

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

  async function start(job: DeliveryJob) {
    if (starting) return;
    setStarting(job.id);
    setError(null);
    try {
      const from = (await currentPoint(4000)) ?? here;
      if (!job.id.startsWith("job-ygn-") && !job.id.startsWith("job-sample-")) {
        try {
          await startJob(createClient(), job.id, vehicleId || null, from);
        } catch (rpcErr) {
          console.warn(
            "Could not start job in Supabase, continuing locally:",
            rpcErr,
          );
        }
      }
      onStarted(job);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start the job.",
      );
      await reload();
    } finally {
      setStarting(null);
    }
  }

  const usable = vehicles.filter(
    (vehicle) => vehicle.status === "available" || vehicle.status === "in_use",
  );
  const needsVehicle = usable.length > 0 && !vehicleId;

  return (
    <section className="rj-board" aria-labelledby="rj-title">
      <header className="rj-header">
        <div className="rj-header-text">
          <h2 id="rj-title">Jobs</h2>
          <p className="rf-muted">
            Each job groups drop-offs that are close together. Tap one to see
            the load, then swipe to start.
          </p>
        </div>
      </header>

      {usable.length > 0 && (
        <div className="rj-vehicle-card">
          <label className="rj-vehicle-label" htmlFor="rj-vehicle">
            <Icon name="truck" size={18} />
            <span>Vehicle</span>
          </label>
          <select
            id="rj-vehicle"
            className="rj-vehicle-select"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            <option value="">Choose your vehicle…</option>
            {usable.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number} ·{" "}
                {vehicle.vehicle_type.replace("_", "-")}
                {vehicle.capacity_kg ? ` · ${vehicle.capacity_kg} kg max` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="rj-error-banner" role="alert">
          <Icon name="warning" size={18} />
          <span>{error}</span>
        </div>
      )}

      {sorted === null ? (
        <div className="rj-loading">
          <span className="rf-result-mark is-neutral">
            <Icon name="refresh" size={24} />
          </span>
          <p className="rf-muted">Loading jobs…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rf-empty rj-empty">
          <span className="rf-result-mark is-neutral">
            <Icon name="truck" size={28} />
          </span>
          <h3>No jobs open right now</h3>
          <p>
            New jobs appear here as soon as dispatch confirms orders. This list
            updates by itself.
          </p>
        </div>
      ) : (
        <ul className="rj-list">
          {sorted.map(({ job, awayKm }) => {
            const isUrgent = job.priority === "urgent";
            const isPriority = job.priority === "high";
            const isExpanded = expandedId === job.id;
            const spread = jobSpreadKm(job);
            const panelId = `rj-job-${job.id}`;

            return (
              <li
                key={job.id}
                className={`rj-card${isUrgent ? " is-urgent" : isPriority ? " is-priority" : ""}${
                  isExpanded ? " is-selected" : ""
                }`}
              >
                <button
                  type="button"
                  className="rj-card-content"
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                >
                  <div className="rj-card-header">
                    <div className="rj-card-title-group">
                      <strong className="rj-card-title">
                        {job.area_label ?? job.label}
                      </strong>
                      <span className="rj-card-subtitle">
                        {job.order_count}{" "}
                        {job.order_count === 1 ? "drop-off" : "drop-offs"}
                        {awayKm != null
                          ? ` · ${formatDistance(awayKm)} from you`
                          : ""}
                      </span>
                    </div>

                    <div className="rj-badges-group">
                      {isUrgent ? (
                        <span className="rj-priority-pill is-urgent">
                          Urgent
                        </span>
                      ) : isPriority ? (
                        <span className="rj-priority-pill is-high">
                          Priority
                        </span>
                      ) : null}
                      <span
                        className={`rj-chevron${isExpanded ? " is-open" : ""}`}
                        aria-hidden="true"
                      >
                        <Icon name="arrow-right" size={16} />
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="rj-card-detail" id={panelId}>
                    <div className="rj-meta-grid">
                      <div className="rj-meta-item">
                        <Icon name="package" size={16} />
                        <span>
                          <strong>{job.order_count}</strong>{" "}
                          {job.order_count === 1 ? "parcel" : "parcels"}
                        </span>
                      </div>
                      <div className="rj-meta-item">
                        <Icon name="truck" size={16} />
                        <span>
                          <strong>{job.total_weight_kg}</strong> kg
                        </span>
                      </div>
                      <div className="rj-meta-item">
                        <Icon name="coin" size={16} />
                        <span>
                          {job.cod_total ? (
                            <>
                              COD{" "}
                              <strong>{currency.format(job.cod_total)}</strong>
                            </>
                          ) : (
                            "Prepaid"
                          )}
                        </span>
                      </div>
                      {spread != null && (
                        <div className="rj-meta-item">
                          <Icon name="location" size={16} />
                          <span>
                            Within <strong>{formatDistance(spread)}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="rj-detail-note">
                      Stops are ordered nearest first from where you are when
                      you start.
                    </p>

                    {needsVehicle && (
                      <div className="rj-vehicle-hint">
                        <Icon name="warning" size={16} />
                        <span>Choose your vehicle above to start</span>
                      </div>
                    )}

                    <SwipeConfirm
                      label={
                        starting === job.id ? "Starting…" : "Swipe to start job"
                      }
                      hint={
                        needsVehicle
                          ? "Choose a vehicle first"
                          : starting === job.id
                            ? "Setting up your route…"
                            : "Opens navigation to the first stop"
                      }
                      className="is-green"
                      disabled={starting != null || needsVehicle}
                      onConfirm={() => void start(job)}
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
