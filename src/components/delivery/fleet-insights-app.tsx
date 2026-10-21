"use client";

import { type FormEvent, useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  Brand,
  DemoBadge,
  LoadingBlock,
  MobileNav,
  SignInRequired,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { assessEnergyRoute } from "@/lib/delivery/energy-routing";
import { currency, formatDateTime } from "@/lib/delivery/format";
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
  {
    id: "fleet-account",
    label: "Profile",
    href: "#fleet-account",
    icon: "user",
  },
] as const;

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
  const averageCost = deliveredOrders ? totalCost / deliveredOrders : totalCost;
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

  async function runAction(action: () => Promise<void>, message: string) {
    if (workspace.isDemo) {
      setNotice("Preview mode: sign in as a manager to save fleet records.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await action();
      await workspace.refresh();
      setNotice(message);
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Could not save the record.",
      );
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
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    await runAction(
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
  }

  async function recordCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = workspace.profile;
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    await runAction(
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
  }

  if (workspace.isLoading)
    return <LoadingBlock title="Opening fleet intelligence…" />;

  return (
    <main className="operations-app fleet-app">
      <header className="workspace-header">
        <div className="workspace-header-inner">
          <Brand href="/manager" />
          <a className="workspace-back-link" href="/manager">
            <Icon name="arrow-left" size={15} /> Dispatch
          </a>
          <UserActions
            profile={workspace.profile}
            isAuthenticated={workspace.isAuthenticated}
            onSignIn={() => setAuthOpen(true)}
            onSignOut={() => void signOut()}
            label="Manager"
          />
        </div>
      </header>

      {!workspace.isAuthenticated && !workspace.isDemo ? (
        <div className="operations-shell">
          <SignInRequired
            title="Sign in to see fleet insights"
            description="Energy readiness, maintenance and delivery costs appear once you sign in with a manager account."
            onSignIn={() => setAuthOpen(true)}
          />
        </div>
      ) : (
        <div className="operations-shell" id="fleet-readiness">
          <section className="operations-hero">
            <div>
              <span className="eyebrow">FLEET INTELLIGENCE</span>
              <h1>Know the route cost before wheels move.</h1>
              <p>
                Check energy reserve, service readiness, and operating cost
                across the active fleet.
              </p>
            </div>
            <div className="operations-health">
              <Icon name="truck" size={20} />
              <span>
                <strong>{workspace.data.vehicles.length}</strong> registered
                vehicles
              </span>
            </div>
          </section>
          {workspace.isDemo && (
            <div className="workspace-demo">
              <DemoBadge>Fleet preview</DemoBadge>
              <span>
                Fleet records are illustrative until a manager signs in.
              </span>
            </div>
          )}
          {notice && <output className="operations-notice">{notice}</output>}
          {workspace.error && (
            <div className="error-notice" role="alert">
              {workspace.error}
            </div>
          )}

          <section className="operations-kpis">
            <div>
              <span>Operating cost</span>
              <strong>{currency.format(totalCost)}</strong>
            </div>
            <div>
              <span>Cost per delivered order</span>
              <strong>{currency.format(averageCost)}</strong>
            </div>
            <div>
              <span>Service due</span>
              <strong>{maintenanceDue}</strong>
            </div>
            <div>
              <span>Routes checked</span>
              <strong>{routeAssessments.length}</strong>
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
              className="operations-panel operations-form"
              onSubmit={saveReadiness}
            >
              <div className="section-head-inline">
                <h2>Configure vehicle readiness</h2>
              </div>
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
              <div className="operations-form-row">
                <label>
                  Energy source
                  <select name="energySource" defaultValue="fuel">
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
                  />
                </label>
              </div>
              <div className="operations-form-row">
                <label>
                  Full range km
                  <input name="range" type="number" min="1" required />
                </label>
                <label>
                  Reserve %
                  <input
                    name="reserve"
                    type="number"
                    min="0"
                    max="50"
                    defaultValue="15"
                    required
                  />
                </label>
              </div>
              <div className="operations-form-row">
                <label>
                  Odometer km
                  <input name="odometer" type="number" min="0" required />
                </label>
                <label>
                  Service due km
                  <input name="serviceDue" type="number" min="0" />
                </label>
              </div>
              <button
                className="button button-dark"
                type="submit"
                disabled={saving || !workspace.isAuthenticated}
              >
                Save readiness
              </button>
            </form>
          </section>

          <section className="operations-grid" id="fleet-service">
            <div className="operations-panel operations-panel-wide">
              <div className="section-head-inline">
                <h2>Maintenance schedule</h2>
                <span>{workspace.data.maintenanceRecords.length} records</span>
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
                        {record.status.replace("_", " ")}
                      </span>
                      <strong>{currency.format(record.cost_amount)}</strong>
                    </article>
                  );
                })}
              </div>
            </div>
            <form
              className="operations-panel operations-form"
              onSubmit={scheduleMaintenance}
            >
              <div className="section-head-inline">
                <h2>Schedule maintenance</h2>
              </div>
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
                disabled={saving || !workspace.isAuthenticated}
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
                      <strong>{entry.category}</strong>
                      <span>
                        {formatDateTime(entry.incurred_at)} ·{" "}
                        {entry.notes || "No note"}
                      </span>
                    </div>
                    <strong>{currency.format(entry.amount)}</strong>
                  </article>
                ))}
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
                disabled={saving || !workspace.isAuthenticated}
              >
                Record cost
              </button>
            </form>
          </section>
          <div id="fleet-account" />
        </div>
      )}
      <MobileNav label="Fleet insights" items={insightNavItems} />
      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
