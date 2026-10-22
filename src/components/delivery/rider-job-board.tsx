"use client";

import "./rider-jobs.css";

import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { SwipeConfirm } from "@/components/delivery/swipe-confirm";
import { currency } from "@/lib/delivery/format";
import { claimJob, type DeliveryJob, loadJobs } from "@/lib/delivery/jobs";
import type { VehicleOption } from "@/lib/delivery/types";
import { createClient } from "@/lib/supabase/client";

/** Open jobs a driver can pick from when they have no route yet. */
export function RiderJobBoard({
  vehicles,
  onClaimed,
}: {
  vehicles: VehicleOption[];
  onClaimed: () => void;
}) {
  const [jobs, setJobs] = useState<DeliveryJob[] | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const all = await loadJobs(createClient());
      const open = all.filter((job) => job.status === "open");
      setJobs(open);
      setSelectedJobId((current) => {
        if (current && open.some((j) => j.id === current)) return current;
        return open.length === 1 ? open[0].id : null;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Jobs could not load.");
      setJobs((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void reload();
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

  async function take(job: DeliveryJob) {
    if (claiming) return;
    setClaiming(job.id);
    setError(null);
    try {
      await claimJob(createClient(), job.id, vehicleId || null);
      onClaimed();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not take the job.",
      );
      await reload();
    } finally {
      setClaiming(null);
    }
  }

  const usable = vehicles.filter(
    (vehicle) => vehicle.status === "available" || vehicle.status === "in_use",
  );

  return (
    <section className="rj-board" aria-labelledby="rj-title">
      <header className="rj-header">
        <div className="rj-header-text">
          <h2 id="rj-title">Job Board</h2>
          <p className="rf-muted">
            Select an automated round-trip batch. Review your load and swipe to
            start.
          </p>
        </div>
      </header>

      {usable.length > 0 && (
        <div className="rj-vehicle-card">
          <div className="rj-vehicle-label">
            <Icon name="truck" size={18} />
            <span>Assigned Vehicle</span>
          </div>
          <select
            className="rj-vehicle-select"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            aria-label="Select delivery vehicle"
          >
            <option value="">Choose vehicle for shift…</option>
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

      {jobs === null ? (
        <div className="rj-loading">
          <span className="rf-result-mark is-neutral">
            <Icon name="refresh" size={24} />
          </span>
          <p className="rf-muted">Loading available jobs…</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="rf-empty rj-empty">
          <span className="rf-result-mark is-neutral">
            <Icon name="truck" size={28} />
          </span>
          <h3>No jobs open right now</h3>
          <p>
            Jobs are scheduled in 9-hour batch cycles. New round trips will
            appear as soon as dispatch posts them.
          </p>
        </div>
      ) : (
        <ul className="rj-list">
          {jobs.map((job) => {
            const isUrgent = job.priority === "urgent";
            const isPriority =
              job.priority === "high" || job.reproduce_count > 0;
            const isSelected = selectedJobId === job.id;
            const needsVehicle = usable.length > 0 && !vehicleId;

            return (
              <li
                key={job.id}
                className={`rj-card${isUrgent ? " is-urgent" : isPriority ? " is-priority" : ""}${
                  isSelected ? " is-selected" : ""
                }`}
              >
                <button
                  type="button"
                  className="rj-card-content"
                  onClick={() => setSelectedJobId(job.id)}
                  aria-expanded={isSelected}
                >
                  <div className="rj-card-header">
                    <div className="rj-card-title-group">
                      <strong className="rj-card-title">
                        {job.area_label ?? job.label}
                      </strong>
                      <span className="rj-card-subtitle">{job.label}</span>
                    </div>

                    <div className="rj-badges-group">
                      <span className="rj-circuit-pill">↺ Round trip</span>
                      {isUrgent ? (
                        <span className="rj-priority-pill is-urgent">
                          ⚡ Urgent
                        </span>
                      ) : isPriority ? (
                        <span className="rj-priority-pill is-high">
                          ⚡ Priority
                          {job.reproduce_count > 0
                            ? ` · R${job.reproduce_count}`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>

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
                        <strong>{job.total_weight_kg}</strong> kg payload
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
                          "Prepaid · No COD"
                        )}
                      </span>
                    </div>
                  </div>
                </button>

                <div className="rj-card-actions">
                  {isSelected ? (
                    <div className="rj-swipe-section">
                      {needsVehicle ? (
                        <div className="rj-vehicle-hint">
                          <Icon name="warning" size={16} />
                          <span>Select your vehicle above to start</span>
                        </div>
                      ) : null}

                      <SwipeConfirm
                        label={
                          claiming === job.id
                            ? "Starting job…"
                            : "Swipe to start job"
                        }
                        hint={
                          needsVehicle
                            ? "Pick vehicle first"
                            : claiming === job.id
                              ? "Locking in job…"
                              : "Slide right to accept & load"
                        }
                        disabled={claiming != null || needsVehicle}
                        onConfirm={() => void take(job)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="rj-select-trigger"
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <span>Select this job</span>
                      <Icon name="arrow-right" size={16} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
