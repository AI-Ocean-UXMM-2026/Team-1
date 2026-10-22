"use client";

import { type FormEvent, useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  ActionToast,
  DemoBadge,
  LoadingBlock,
  MobileNav,
  PageHeader,
  SignInGate,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import {
  ManagerSidebar,
  managerMobileNav,
} from "@/components/delivery/manager-sidebar";
import { assessEnergyRoute } from "@/lib/delivery/energy-routing";
import { currency, formatDateTime, sentenceCase } from "@/lib/delivery/format";
import {
  configureVehicleReadiness,
  createDeliveryCost,
  createMaintenanceRecord,
} from "@/lib/delivery/operations-actions";
import type { VehicleOption } from "@/lib/delivery/types";
import { useOperationsWorkspace } from "@/lib/delivery/use-operations-workspace";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";
import "./manager-vehicles.css";

type Tab = "fleet" | "service" | "costs";

const TABS: { id: Tab; label: string }[] = [
  { id: "fleet", label: "Fleet" },
  { id: "service", label: "Maintenance" },
  { id: "costs", label: "Costs" },
];

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  in_use: "On route",
  maintenance: "In service",
  inactive: "Inactive",
};

const km = new Intl.NumberFormat("en-US");

function energyLevel(vehicle: VehicleOption) {
  return vehicle.energy_source === "electric"
    ? vehicle.battery_level_percent
    : vehicle.fuel_level_percent;
}

function serviceState(vehicle: VehicleOption) {
  if (vehicle.status === "maintenance")
    return { tone: "warn", text: "In the workshop" } as const;
  if (vehicle.service_due_at_km == null)
    return { tone: "muted", text: "No service interval set" } as const;
  const left = vehicle.service_due_at_km - vehicle.odometer_km;
  if (left <= 0)
    return {
      tone: "danger",
      text: `Service overdue by ${km.format(-left)} km`,
    } as const;
  if (left <= 500)
    return { tone: "warn", text: `Service in ${km.format(left)} km` } as const;
  return { tone: "ok", text: `Service in ${km.format(left)} km` } as const;
}

function EnergyMeter({ vehicle }: { vehicle: VehicleOption }) {
  const level = energyLevel(vehicle);
  const tone =
    level == null
      ? "unknown"
      : level <= vehicle.reserve_percent
        ? "low"
        : level <= vehicle.reserve_percent + 20
          ? "mid"
          : "high";
  const usable =
    level != null && vehicle.range_km_at_full
      ? Math.max(
          0,
          Math.round(
            ((level - vehicle.reserve_percent) / 100) *
              vehicle.range_km_at_full,
          ),
        )
      : null;
  return (
    <div className="vehicle-energy" data-tone={tone}>
      <div
        className="vehicle-energy-track"
        role="meter"
        aria-label={`${vehicle.energy_source === "electric" ? "Battery" : "Fuel"} level`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={level ?? undefined}
      >
        <span style={{ width: `${level ?? 0}%` }} />
        <i style={{ left: `${vehicle.reserve_percent}%` }} />
      </div>
      <span>
        <strong>{level == null ? "—" : `${level}%`}</strong>
        {usable != null ? ` · ${usable} km usable` : " · set range"}
      </span>
    </div>
  );
}

function EmptyNote({ children }: { children: string }) {
  return <p className="vehicles-empty">{children}</p>;
}

export function ManagerVehiclesApp() {
  const workspace = useWorkspace("manager");
  const operations = useOperationsWorkspace("manager");
  const live = workspace.isAuthenticated && !workspace.isDemo;
  const [tab, setTab] = useState<Tab>("fleet");
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const vehicles = workspace.data.vehicles;
  const selected =
    vehicles.find((vehicle) => vehicle.id === selectedId) ??
    vehicles[0] ??
    null;
  const { maintenanceRecords, costEntries } = operations.data;

  const counts = useMemo(() => {
    const byStatus = { available: 0, in_use: 0, maintenance: 0, other: 0 };
    for (const vehicle of vehicles) {
      if (vehicle.status in byStatus)
        byStatus[vehicle.status as keyof typeof byStatus] += 1;
      else byStatus.other += 1;
    }
    return byStatus;
  }, [vehicles]);
  const serviceDue = vehicles.filter((vehicle) =>
    ["warn", "danger"].includes(serviceState(vehicle).tone),
  ).length;
  const lowEnergy = vehicles.filter((vehicle) => {
    const level = energyLevel(vehicle);
    return level != null && level <= vehicle.reserve_percent;
  }).length;

  const totalCost = costEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const delivered = operations.data.orders.filter(
    (order) => order.status === "delivered",
  ).length;
  const costPerOrder = delivered ? totalCost / delivered : null;

  const routeChecks = useMemo(
    () =>
      operations.data.assignments.flatMap((assignment) => {
        const order = operations.data.orders.find(
          (item) => item.id === assignment.order_id,
        );
        const vehicle = vehicles.find(
          (item) => item.id === assignment.vehicle_id,
        );
        if (!order || !vehicle) return [];
        return [
          {
            id: assignment.id,
            order,
            vehicle,
            assessment: assessEnergyRoute(
              { ...order, latest_location: null },
              vehicle,
            ),
          },
        ];
      }),
    [operations.data.assignments, operations.data.orders, vehicles],
  );

  async function runAction(action: () => Promise<void>, message: string) {
    if (!live) {
      setNotice("Sign in with a manager account to save fleet records.");
      return false;
    }
    setSaving(true);
    setNotice(null);
    try {
      await action();
      await Promise.all([workspace.refresh(), operations.refresh()]);
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
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const source = String(form.get("energySource")) as
      "fuel" | "electric" | "hybrid";
    const level = Number(form.get("level"));
    await runAction(
      () =>
        configureVehicleReadiness(createClient(), {
          vehicleId: selected.id,
          energySource: source,
          fuelLevel: source === "electric" ? null : level,
          batteryLevel: source === "fuel" ? null : level,
          rangeKmAtFull: Number(form.get("range")),
          reservePercent: Number(form.get("reserve")),
          odometerKm: Number(form.get("odometer")),
          serviceDueAtKm: Number(form.get("serviceDue")) || null,
        }),
      `${selected.registration_number} updated.`,
    );
  }

  async function scheduleMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const managerId = operations.profile?.id;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await runAction(async () => {
      if (!managerId) throw new Error("Your manager profile is still loading.");
      await createMaintenanceRecord(createClient(), {
        managerId,
        vehicleId: String(form.get("vehicleId")),
        maintenanceType: String(form.get("maintenanceType")),
        scheduledFor: String(form.get("scheduledFor") || ""),
        odometerKm: Number(form.get("odometer")) || undefined,
        costAmount: Number(form.get("cost")) || 0,
        notes: String(form.get("notes") || ""),
      });
    }, "Service scheduled.");
    if (saved) formElement.reset();
  }

  async function recordCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const managerId = operations.profile?.id;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await runAction(async () => {
      if (!managerId) throw new Error("Your manager profile is still loading.");
      await createDeliveryCost(createClient(), {
        managerId,
        orderId: String(form.get("orderId") || ""),
        vehicleId: String(form.get("vehicleId") || ""),
        category: String(form.get("category")) as
          "fuel" | "charging" | "toll" | "maintenance" | "labor" | "other",
        amount: Number(form.get("amount")),
        notes: String(form.get("notes") || ""),
      });
    }, "Cost recorded.");
    if (saved) formElement.reset();
  }

  if (workspace.isLoading) return <LoadingBlock title="Opening vehicles…" />;
  const signedOut = !workspace.isAuthenticated && !workspace.isDemo;
  const vehicleOptions = vehicles.map((vehicle) => (
    <option value={vehicle.id} key={vehicle.id}>
      {vehicle.registration_number}
    </option>
  ));

  const segments = [
    { key: "available", label: "Available", count: counts.available },
    { key: "in_use", label: "On route", count: counts.in_use },
    { key: "maintenance", label: "In service", count: counts.maintenance },
    { key: "other", label: "Inactive", count: counts.other },
  ].filter((segment) => segment.count > 0);

  return (
    <main className="manager-app vehicles-app">
      <ManagerSidebar active="vehicles" />
      <MobileNav
        label="Manager workspace"
        items={managerMobileNav({
          id: "vehicles",
          label: "Vehicles",
          href: "/manager/vehicles",
          icon: "truck",
        })}
        activeId="vehicles"
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
            title="Vehicles"
            description="Fleet status, energy, servicing and operating cost."
          />
          {workspace.isDemo && (
            <div className="workspace-demo manager-demo">
              <DemoBadge>Demo fleet</DemoBadge>
              <span>
                Sample vehicles. Sign in with a manager account to edit the
                fleet.
              </span>
            </div>
          )}
          {(workspace.error || operations.error) && (
            <div className="error-notice" role="alert">
              {workspace.error ?? operations.error}
            </div>
          )}

          {signedOut ? (
            <SignInGate
              title="Sign in to vehicles"
              body="Fleet records are available to manager accounts."
              onSignIn={() => setAuthOpen(true)}
            />
          ) : (
            <>
              <section className="vehicles-overview" aria-label="Fleet status">
                <div className="vehicles-overview-head">
                  <strong>{vehicles.length}</strong>
                  <span>{vehicles.length === 1 ? "vehicle" : "vehicles"}</span>
                </div>
                <div className="vehicles-status-bar" aria-hidden="true">
                  {segments.map((segment) => (
                    <span
                      key={segment.key}
                      data-status={segment.key}
                      style={{ flexGrow: segment.count }}
                    />
                  ))}
                </div>
                <ul className="vehicles-legend">
                  {segments.map((segment) => (
                    <li key={segment.key} data-status={segment.key}>
                      {segment.label} <strong>{segment.count}</strong>
                    </li>
                  ))}
                  <li data-alert={serviceDue > 0 || undefined}>
                    Service due <strong>{serviceDue}</strong>
                  </li>
                  <li data-alert={lowEnergy > 0 || undefined}>
                    Below reserve <strong>{lowEnergy}</strong>
                  </li>
                </ul>
              </section>

              <div
                className="vehicles-tabs"
                role="tablist"
                aria-label="Vehicle views"
              >
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`vehicles-tab-${item.id}`}
                    aria-selected={tab === item.id}
                    aria-controls={`vehicles-panel-${item.id}`}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {tab === "fleet" && (
                <div
                  className="vehicles-layout"
                  role="tabpanel"
                  id="vehicles-panel-fleet"
                  aria-labelledby="vehicles-tab-fleet"
                >
                  <section className="vehicles-panel">
                    <h2>Fleet</h2>
                    <ul className="vehicles-list">
                      {vehicles.map((vehicle) => {
                        const service = serviceState(vehicle);
                        const active = selected?.id === vehicle.id;
                        return (
                          <li key={vehicle.id}>
                            <button
                              type="button"
                              className="vehicle-row"
                              aria-pressed={active}
                              onClick={() => setSelectedId(vehicle.id)}
                            >
                              <span className="vehicle-row-id">
                                <strong>{vehicle.registration_number}</strong>
                                <span>
                                  {sentenceCase(vehicle.vehicle_type)} ·{" "}
                                  {sentenceCase(vehicle.energy_source)}
                                  {vehicle.capacity_kg
                                    ? ` · ${vehicle.capacity_kg} kg`
                                    : ""}
                                </span>
                              </span>
                              <span
                                className="vehicle-status"
                                data-status={vehicle.status}
                              >
                                {STATUS_LABELS[vehicle.status] ??
                                  sentenceCase(vehicle.status)}
                              </span>
                              <EnergyMeter vehicle={vehicle} />
                              <span
                                className="vehicle-service"
                                data-tone={service.tone}
                              >
                                {service.text}
                                <small>
                                  {km.format(vehicle.odometer_km)} km on the
                                  clock
                                </small>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {!vehicles.length && (
                      <EmptyNote>No vehicles are registered yet.</EmptyNote>
                    )}
                  </section>

                  <aside className="vehicles-side">
                    {selected && (
                      <form
                        key={selected.id}
                        className="vehicles-panel operations-form"
                        onSubmit={saveReadiness}
                      >
                        <h2>{selected.registration_number}</h2>
                        <div className="operations-form-row">
                          <label>
                            Energy source
                            <select
                              name="energySource"
                              defaultValue={selected.energy_source}
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
                              defaultValue={energyLevel(selected) ?? undefined}
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
                                selected.range_km_at_full ?? undefined
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
                              required
                              defaultValue={selected.reserve_percent}
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
                              defaultValue={selected.odometer_km}
                            />
                          </label>
                          <label>
                            Service due km
                            <input
                              name="serviceDue"
                              type="number"
                              min="0"
                              defaultValue={
                                selected.service_due_at_km ?? undefined
                              }
                            />
                          </label>
                        </div>
                        <button
                          className="button button-dark"
                          type="submit"
                          disabled={!live || saving}
                        >
                          Save vehicle
                        </button>
                      </form>
                    )}

                    <section className="vehicles-panel">
                      <h2>Route energy checks</h2>
                      <ul className="vehicles-plain-list">
                        {routeChecks.map(
                          ({ id, order, vehicle, assessment }) => (
                            <li key={id} data-status={assessment.status}>
                              <strong>{order.tracking_code}</strong>
                              <span>
                                {vehicle.registration_number}
                                {assessment.distanceKm != null
                                  ? ` · ${assessment.distanceKm} km`
                                  : ""}
                              </span>
                              <p>{assessment.message}</p>
                            </li>
                          ),
                        )}
                      </ul>
                      {!routeChecks.length && (
                        <EmptyNote>
                          Assigned deliveries are checked against the
                          vehicle&apos;s usable range here.
                        </EmptyNote>
                      )}
                    </section>
                  </aside>
                </div>
              )}

              {tab === "service" && (
                <div
                  className="vehicles-layout"
                  role="tabpanel"
                  id="vehicles-panel-service"
                  aria-labelledby="vehicles-tab-service"
                >
                  <section className="vehicles-panel">
                    <h2>Maintenance schedule</h2>
                    <ul className="vehicles-plain-list">
                      {maintenanceRecords.map((record) => (
                        <li key={record.id}>
                          <strong>{record.maintenance_type}</strong>
                          <span>
                            {vehicles.find(
                              (item) => item.id === record.vehicle_id,
                            )?.registration_number ?? "Vehicle"}{" "}
                            · {record.scheduled_for || "Date pending"} ·{" "}
                            {currency.format(record.cost_amount)}
                          </span>
                          <em data-done={record.status === "completed"}>
                            {sentenceCase(record.status)}
                          </em>
                        </li>
                      ))}
                    </ul>
                    {!maintenanceRecords.length && (
                      <EmptyNote>No service scheduled yet.</EmptyNote>
                    )}
                  </section>
                  <form
                    className="vehicles-panel operations-form"
                    onSubmit={scheduleMaintenance}
                  >
                    <h2>Schedule service</h2>
                    <label>
                      Vehicle
                      <select name="vehicleId" required>
                        {vehicleOptions}
                      </select>
                    </label>
                    <label>
                      Service work
                      <input name="maintenanceType" required />
                    </label>
                    <div className="operations-form-row">
                      <label>
                        Date
                        <input name="scheduledFor" type="date" />
                      </label>
                      <label>
                        Odometer km
                        <input name="odometer" type="number" min="0" />
                      </label>
                    </div>
                    <label>
                      Expected cost MMK
                      <input name="cost" type="number" min="0" step="100" />
                    </label>
                    <label>
                      Notes
                      <textarea name="notes" rows={3} />
                    </label>
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={!live || saving || !vehicles.length}
                    >
                      Schedule service
                    </button>
                  </form>
                </div>
              )}

              {tab === "costs" && (
                <div
                  className="vehicles-layout"
                  role="tabpanel"
                  id="vehicles-panel-costs"
                  aria-labelledby="vehicles-tab-costs"
                >
                  <section className="vehicles-panel">
                    <h2>Cost ledger</h2>
                    <dl className="vehicles-cost-summary">
                      <div>
                        <dt>Operating spend</dt>
                        <dd>{currency.format(totalCost)}</dd>
                      </div>
                      <div>
                        <dt>Per delivered order</dt>
                        <dd>
                          {costPerOrder == null
                            ? "—"
                            : currency.format(costPerOrder)}
                        </dd>
                      </div>
                    </dl>
                    <ul className="vehicles-plain-list">
                      {costEntries.map((entry) => (
                        <li key={entry.id}>
                          <strong>{sentenceCase(entry.category)}</strong>
                          <span>
                            {formatDateTime(entry.incurred_at)} ·{" "}
                            {entry.notes || "No note"}
                          </span>
                          <em>{currency.format(entry.amount)}</em>
                        </li>
                      ))}
                    </ul>
                    {!costEntries.length && (
                      <EmptyNote>No costs recorded yet.</EmptyNote>
                    )}
                  </section>
                  <form
                    className="vehicles-panel operations-form"
                    onSubmit={recordCost}
                  >
                    <h2>Record a cost</h2>
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
                        {vehicleOptions}
                      </select>
                    </label>
                    <label>
                      Delivery
                      <select name="orderId">
                        <option value="">None</option>
                        {operations.data.orders.map((order) => (
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
                      disabled={!live || saving}
                    >
                      Record cost
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ActionToast message={notice} onDismiss={() => setNotice(null)} />
      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
