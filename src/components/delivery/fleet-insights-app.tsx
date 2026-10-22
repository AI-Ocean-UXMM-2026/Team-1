"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  ActionToast,
  Brand,
  DemoBadge,
  LoadingBlock,
  MobileNav,
  PageHeader,
  SignInGate,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { assessEnergyRoute } from "@/lib/delivery/energy-routing";
import { currency, formatDateTime, sentenceCase } from "@/lib/delivery/format";
import {
  configureVehicleReadiness,
  createDeliveryCost,
  createMaintenanceRecord,
} from "@/lib/delivery/operations-actions";
import type { VehicleOption } from "@/lib/delivery/types";
import { useOperationsWorkspace } from "@/lib/delivery/use-operations-workspace";
import { createClient } from "@/lib/supabase/client";

const insightNavItems = [
  {
    id: "fleet-readiness",
    label: "Readiness",
    href: "#fleet-readiness",
    icon: "truck",
  },
  {
    id: "fleet-service",
    label: "Service",
    href: "#fleet-service",
    icon: "settings",
  },
  { id: "fleet-costs", label: "Costs", href: "#fleet-costs", icon: "coin" },
] as const;

function previewOrLoadingNotice(isDemo: boolean) {
  return isDemo
    ? "Preview mode: sign in as a manager to save fleet records."
    : "Your manager account is still loading. Try again in a moment.";
}

function NoVehiclesHint() {
  return (
    <p className="empty-small-copy">
      No vehicles are registered yet, so there is nothing to choose here.
    </p>
  );
}

export function FleetInsightsApp() {
  const workspace = useOperationsWorkspace("manager");
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const totalCost = workspace.data.costEntries.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const deliveredOrders = workspace.data.orders.filter(
    (item) => item.status === "delivered",
  ).length;
  // Without a delivered order there is nothing to divide by; showing the
  // total here made one cost look like a per-order figure.
  const averageCost = deliveredOrders ? totalCost / deliveredOrders : null;
  const [readinessVehicleId, setReadinessVehicleId] = useState("");
  const readinessVehicle =
    workspace.data.vehicles.find((item) => item.id === readinessVehicleId) ??
    workspace.data.vehicles[0] ??
    null;
  const hasVehicles = workspace.data.vehicles.length > 0;
  const maintenanceDue = workspace.data.vehicles.filter(
    (vehicle) =>
      vehicle.status === "maintenance" ||
      (vehicle.service_due_at_km != null &&
        vehicle.odometer_km >= vehicle.service_due_at_km),
  ).length;
  const routeAssessments = useMemo(
    () =>
      workspace.data.assignments.map((assignment) => {
        const order = workspace.data.orders.find(
          (item) => item.id === assignment.order_id,
        );
        const vehicle = workspace.data.vehicles.find(
          (item) => item.id === assignment.vehicle_id,
        );
        return {
          assignment,
          order,
          vehicle,
          assessment:
            order && vehicle
              ? assessEnergyRoute(
                  { ...order, latest_location: null },
                  vehicle as VehicleOption,
                )
              : null,
        };
      }),
    [
      workspace.data.assignments,
      workspace.data.orders,
      workspace.data.vehicles,
    ],
  );

  /** Resolves true once saved, so new-record forms can clear. */
  async function runAction(action: () => Promise<void>, message: string) {
    if (workspace.isDemo) {
      setNotice(previewOrLoadingNotice(true));
      return false;
    }
    setSaving(true);
    setNotice(null);
    try {
      await action();
      await workspace.refresh();
      setNotice(message);
      return true;
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Could not save the record.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveReadiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const source = String(form.get("energySource")) as
      | "fuel"
      | "electric"
      | "hybrid";
    const level = Number(form.get("level"));
    await runAction(
      () =>
        configureVehicleReadiness(createClient(), {
          vehicleId: String(form.get("vehicleId")),
          energySource: source,
          fuelLevel: source === "electric" ? null : level,
          batteryLevel: source === "fuel" ? null : level,
          rangeKmAtFull: Number(form.get("range")),
          reservePercent: Number(form.get("reserve")),
          odometerKm: Number(form.get("odometer")),
          serviceDueAtKm: Number(form.get("serviceDue")) || null,
        }),
      "Vehicle readiness updated.",
    );
  }

  async function scheduleMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = workspace.profile;
    if (!profile) {
      setNotice(previewOrLoadingNotice(workspace.isDemo));
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await runAction(
      () =>
        createMaintenanceRecord(createClient(), {
          managerId: profile.id,
          vehicleId: String(form.get("vehicleId")),
          maintenanceType: String(form.get("maintenanceType")),
          scheduledFor: String(form.get("scheduledFor") || ""),
          odometerKm: Number(form.get("odometer")) || undefined,
          costAmount: Number(form.get("cost")) || 0,
          notes: String(form.get("notes") || ""),
        }),
      "Maintenance scheduled.",
    );
    if (saved) formElement.reset();
  }

  async function recordCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = workspace.profile;
    if (!profile) {
      setNotice(previewOrLoadingNotice(workspace.isDemo));
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await runAction(
      () =>
        createDeliveryCost(createClient(), {
          managerId: profile.id,
          orderId: String(form.get("orderId") || ""),
          vehicleId: String(form.get("vehicleId") || ""),
          category: String(form.get("category")) as
            | "fuel"
            | "charging"
            | "toll"
            | "maintenance"
            | "labor"
            | "other",
          amount: Number(form.get("amount")),
          notes: String(form.get("notes") || ""),
        }),
      "Delivery cost recorded.",
    );
    if (saved) formElement.reset();
  }

  if (workspace.isLoading)
    return <LoadingBlock title="Opening fleet intelligence…" />;
  const signedOut = !workspace.isAuthenticated && !workspace.isDemo;

  return (
    <main className="operations-app fleet-app">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <Brand href="/manager" />
          <Link className="workspace-back-link" href="/manager/home">
            <Icon name="arrow-left" size={15} /> Back to dispatch
          </Link>
          {/* Signed out, the page body already offers sign-in. */}
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

      <div className="operations-shell" id="fleet-readiness">
        <PageHeader
          title="Fleet"
          description="Energy reserve, servicing and operating cost for the vehicles on dispatch."
        />
        {workspace.isDemo && (
          <div className="workspace-demo">
            <DemoBadge>Fleet preview</DemoBadge>
            <span>
              Fleet records are illustrative until a manager signs in.
            </span>
          </div>
        )}
        {workspace.error && (
          <div className="error-notice" role="alert">
            {workspace.error}
          </div>
        )}

        {signedOut ? (
          <SignInGate
            title="Sign in to fleet insights"
            body="Fleet records are available to manager accounts."
            onSignIn={() => setAuthOpen(true)}
          />
        ) : (
          <>
            <section className="operations-kpis">
              <div>
                <span>Operating cost</span>
                <strong>{currency.format(totalCost)}</strong>
              </div>
              <div>
                <span>Cost per delivered order</span>
                <strong>
                  {averageCost == null ? "—" : currency.format(averageCost)}
                </strong>
              </div>
              <div>
                <span>Service due</span>
                <strong>{maintenanceDue}</strong>
              </div>
              <div>
                <span>Vehicles</span>
                <strong>{workspace.data.vehicles.length}</strong>
              </div>
            </section>

            <section className="operations-grid">
              <div className="operations-panel operations-panel-wide">
                <div className="section-head-inline">
                  <h2>Energy-aware route readiness</h2>
                  <span>Configured reserve included</span>
                </div>
                <div className="operations-list">
                  {routeAssessments.map(
                    ({ assignment, order, vehicle, assessment }) => (
                      <article className="energy-route-row" key={assignment.id}>
                        <span
                          className={`energy-gauge energy-${assessment?.status ?? "unknown"}`}
                        >
                          <Icon name="navigation" size={18} />
                        </span>
                        <div>
                          <strong>
                            {order?.tracking_code ?? "Order unavailable"}
                          </strong>
                          <span>
                            {vehicle?.registration_number ?? "No vehicle"} ·{" "}
                            {assessment?.distanceKm != null
                              ? `${assessment.distanceKm} km route`
                              : "Route distance unavailable"}
                          </span>
                        </div>
                        <div className="energy-reading">
                          <strong>
                            {assessment?.energyLevelPercent != null
                              ? `${assessment.energyLevelPercent}%`
                              : "—"}
                          </strong>
                          <span>
                            {assessment?.availableRangeKm != null
                              ? `${assessment.availableRangeKm} km usable`
                              : "Set range"}
                          </span>
                        </div>
                        <p>
                          {assessment?.message ??
                            "Assign a vehicle to check readiness."}
                        </p>
                      </article>
                    ),
                  )}
                  {!routeAssessments.length && (
                    <p className="empty-small-copy">
                      Active assignments will appear here for an energy check.
                    </p>
                  )}
                </div>
              </div>

              <form
                key={readinessVehicle?.id ?? "none"}
                className="operations-panel operations-form"
                onSubmit={saveReadiness}
              >
                <div className="section-head-inline">
                  <h2>Configure vehicle readiness</h2>
                </div>
                {!hasVehicles && <NoVehiclesHint />}
                <label>
                  Vehicle
                  <select
                    name="vehicleId"
                    required
                    value={readinessVehicle?.id ?? ""}
                    onChange={(event) =>
                      setReadinessVehicleId(event.target.value)
                    }
                  >
                    {workspace.data.vehicles.map((vehicle) => (
                      <option value={vehicle.id} key={vehicle.id}>
                        {vehicle.registration_number}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="operations-form-row">
                  <label>
                    Energy source
                    <select
                      name="energySource"
                      defaultValue={readinessVehicle?.energy_source ?? "fuel"}
                    >
                      <option value="fuel">Fuel</option>
                      <option value="electric">Electric</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </label>
                  <label>
                    Current level %
                    <input
                      name="level"
                      type="number"
                      min="0"
                      max="100"
                      required
                      defaultValue={
                        (readinessVehicle?.energy_source === "electric"
                          ? readinessVehicle.battery_level_percent
                          : readinessVehicle?.fuel_level_percent) ?? undefined
                      }
                    />
                  </label>
                </div>
                <div className="operations-form-row">
                  <label>
                    Full range km
                    <input
                      name="range"
                      type="number"
                      min="1"
                      required
                      defaultValue={
                        readinessVehicle?.range_km_at_full ?? undefined
                      }
                    />
                  </label>
                  <label>
                    Reserve %
                    <input
                      name="reserve"
                      type="number"
                      min="0"
                      max="50"
                      defaultValue={readinessVehicle?.reserve_percent ?? 15}
                      required
                    />
                  </label>
                </div>
                <div className="operations-form-row">
                  <label>
                    Odometer km
                    <input
                      name="odometer"
                      type="number"
                      min="0"
                      required
                      defaultValue={readinessVehicle?.odometer_km ?? undefined}
                    />
                  </label>
                  <label>
                    Service due km
                    <input
                      name="serviceDue"
                      type="number"
                      min="0"
                      defaultValue={
                        readinessVehicle?.service_due_at_km ?? undefined
                      }
                    />
                  </label>
                </div>
                <button
                  className="button button-dark"
                  type="submit"
                  disabled={saving || !hasVehicles}
                >
                  Save readiness
                </button>
              </form>
            </section>

            <section className="operations-grid" id="fleet-service">
              <div className="operations-panel operations-panel-wide">
                <div className="section-head-inline">
                  <h2>Maintenance schedule</h2>
                  <span>
                    {workspace.data.maintenanceRecords.length}{" "}
                    {workspace.data.maintenanceRecords.length === 1
                      ? "record"
                      : "records"}
                  </span>
                </div>
                <div className="operations-list">
                  {workspace.data.maintenanceRecords.map((record) => {
                    const vehicle = workspace.data.vehicles.find(
                      (item) => item.id === record.vehicle_id,
                    );
                    return (
                      <article className="operations-list-item" key={record.id}>
                        <span className="operations-provider-mark">
                          <Icon name="settings" size={16} />
                        </span>
                        <div>
                          <strong>{record.maintenance_type}</strong>
                          <span>
                            {vehicle?.registration_number ?? "Vehicle"} ·{" "}
                            {record.scheduled_for || "Date pending"}
                          </span>
                        </div>
                        <span
                          className={`status-badge ${record.status === "completed" ? "status-success" : "status-warm"}`}
                        >
                          {sentenceCase(record.status)}
                        </span>
                        <strong>{currency.format(record.cost_amount)}</strong>
                      </article>
                    );
                  })}
                  {!workspace.data.maintenanceRecords.length && (
                    <p className="empty-small-copy">
                      No service scheduled yet.
                    </p>
                  )}
                </div>
              </div>
              <form
                className="operations-panel operations-form"
                onSubmit={scheduleMaintenance}
              >
                <div className="section-head-inline">
                  <h2>Schedule maintenance</h2>
                </div>
                {!hasVehicles && <NoVehiclesHint />}
                <label>
                  Vehicle
                  <select name="vehicleId" required>
                    {workspace.data.vehicles.map((vehicle) => (
                      <option value={vehicle.id} key={vehicle.id}>
                        {vehicle.registration_number}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Service work
                  <input name="maintenanceType" required />
                </label>
                <div className="operations-form-row">
                  <label>
                    Schedule date
                    <input name="scheduledFor" type="date" />
                  </label>
                  <label>
                    Odometer km
                    <input name="odometer" type="number" min="0" />
                  </label>
                </div>
                <label>
                  Expected cost
                  <input name="cost" type="number" min="0" step="100" />
                </label>
                <label>
                  Notes
                  <textarea name="notes" rows={3} />
                </label>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={saving || !hasVehicles}
                >
                  Schedule service
                </button>
              </form>
            </section>

            <section className="operations-grid" id="fleet-costs">
              <div className="operations-panel operations-panel-wide">
                <div className="section-head-inline">
                  <h2>Cost ledger</h2>
                  <span>MMK operating spend</span>
                </div>
                <div className="operations-list">
                  {workspace.data.costEntries.map((entry) => (
                    <article className="operations-list-item" key={entry.id}>
                      <span className="operations-provider-mark operations-provider-cost">
                        <Icon name="coin" size={16} />
                      </span>
                      <div>
                        <strong>{sentenceCase(entry.category)}</strong>
                        <span>
                          {formatDateTime(entry.incurred_at)} ·{" "}
                          {entry.notes || "No note"}
                        </span>
                      </div>
                      <strong>{currency.format(entry.amount)}</strong>
                    </article>
                  ))}
                  {!workspace.data.costEntries.length && (
                    <p className="empty-small-copy">No costs recorded yet.</p>
                  )}
                </div>
              </div>
              <form
                className="operations-panel operations-form"
                onSubmit={recordCost}
              >
                <div className="section-head-inline">
                  <h2>Record an operating cost</h2>
                </div>
                <label>
                  Category
                  <select name="category" defaultValue="fuel">
                    <option value="fuel">Fuel</option>
                    <option value="charging">Charging</option>
                    <option value="toll">Toll</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="labor">Labor</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Vehicle
                  <select name="vehicleId">
                    <option value="">None</option>
                    {workspace.data.vehicles.map((vehicle) => (
                      <option value={vehicle.id} key={vehicle.id}>
                        {vehicle.registration_number}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Delivery
                  <select name="orderId">
                    <option value="">None</option>
                    {workspace.data.orders.map((order) => (
                      <option value={order.id} key={order.id}>
                        {order.tracking_code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount MMK
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    step="100"
                    required
                  />
                </label>
                <label>
                  Notes
                  <textarea name="notes" rows={3} />
                </label>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={saving}
                >
                  Record cost
                </button>
              </form>
            </section>
          </>
        )}
      </div>
      {!signedOut && (
        <MobileNav label="Fleet insights" items={insightNavItems} />
      )}
      <ActionToast message={notice} onDismiss={() => setNotice(null)} />
      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
