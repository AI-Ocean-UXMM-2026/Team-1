"use client";

import { useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
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
import { sentenceCase } from "@/lib/delivery/format";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import "./manager-vehicles.css";

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  in_use: "On route",
  maintenance: "In service",
  inactive: "Inactive",
};

const km = new Intl.NumberFormat("en-US");

export function ManagerVehiclesApp() {
  const workspace = useWorkspace("manager");
  const [authOpen, setAuthOpen] = useState(false);

  const vehicles = workspace.data.vehicles;

  const counts = useMemo(() => {
    const byStatus = { available: 0, in_use: 0, maintenance: 0, other: 0 };
    for (const vehicle of vehicles) {
      if (vehicle.status in byStatus)
        byStatus[vehicle.status as keyof typeof byStatus] += 1;
      else byStatus.other += 1;
    }
    return byStatus;
  }, [vehicles]);

  if (workspace.isLoading) return <LoadingBlock title="Opening vehicles…" />;
  const signedOut = !workspace.isAuthenticated;

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
          <PageHeader title="Vehicles" description="Your fleet at a glance." />
          {workspace.isDemo && (
            <div className="workspace-demo manager-demo">
              <DemoBadge>Demo fleet</DemoBadge>
              <span>Sample vehicles. Sign in with a manager account.</span>
            </div>
          )}
          {workspace.error && (
            <div className="error-notice" role="alert">
              {workspace.error}
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
                </ul>
              </section>

              <section className="vehicles-panel">
                <h2>Vehicles</h2>
                <ul className="vehicles-list">
                  {vehicles.map((vehicle) => (
                    <li key={vehicle.id} className="vehicle-row">
                      <span className="vehicle-row-id">
                        <strong>{vehicle.registration_number}</strong>
                        <span>
                          {sentenceCase(vehicle.vehicle_type)}
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
                      <span className="vehicle-service">
                        <small>{km.format(vehicle.odometer_km)} km</small>
                      </span>
                    </li>
                  ))}
                </ul>
                {!vehicles.length && (
                  <p className="vehicles-empty">
                    No vehicles are registered yet.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
