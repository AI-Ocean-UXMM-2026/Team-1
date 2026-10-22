"use client";

import "./rider-jobs.css";

import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/delivery/icons";
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
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const all = await loadJobs(createClient());
      setJobs(all.filter((job) => job.status === "open"));
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
      <h2 id="rj-title">Pick a job</h2>
      <p className="rf-muted">
        Each job is a group of parcels in one area. Take one and its stops
        appear as your route.
      </p>
      {usable.length > 0 && (
        <label className="rj-vehicle">
          <span>Vehicle</span>
          <select
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            <option value="">No vehicle selected</option>
            {usable.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number} ·{" "}
                {vehicle.vehicle_type.replace("_", "-")}
                {vehicle.capacity_kg ? ` · ${vehicle.capacity_kg} kg` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p className="rj-error" role="alert">
          {error}
        </p>
      )}
      {jobs === null ? (
        <p className="rf-muted">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <div className="rf-empty">
          <span className="rf-result-mark is-neutral">
            <Icon name="truck" size={26} />
          </span>
          <h3>No jobs open right now</h3>
          <p>New jobs are posted every 9 hours. This list updates by itself.</p>
        </div>
      ) : (
        <ul className="rj-list">
          {jobs.map((job) => {
            const isUrgent = job.priority === "urgent";
            const isPriority =
              job.priority === "high" || job.reproduce_count > 0;

            return (
              <li
                key={job.id}
                className={`rj-card${isUrgent ? " is-urgent" : isPriority ? " is-priority" : ""}`}
              >
                <div>
                  <div className="rj-card-header">
                    <strong>{job.label}</strong>
                    {isUrgent ? (
                      <span className="rj-priority-pill is-urgent">
                        ⚡ Urgent
                      </span>
                    ) : isPriority ? (
                      <span className="rj-priority-pill is-high">
                        ⚡ Priority{" "}
                        {job.reproduce_count > 0
                          ? `· R${job.reproduce_count}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  <span>
                    {job.order_count}{" "}
                    {job.order_count === 1 ? "parcel" : "parcels"} ·{" "}
                    {job.total_weight_kg} kg
                  </span>
                  <span>
                    {job.area_label ?? "Area to confirm"}
                    {job.cod_total
                      ? ` · COD ${currency.format(job.cod_total)}`
                      : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="rj-take"
                  disabled={claiming != null}
                  onClick={() => void take(job)}
                >
                  {claiming === job.id ? "Taking…" : "Take job"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
