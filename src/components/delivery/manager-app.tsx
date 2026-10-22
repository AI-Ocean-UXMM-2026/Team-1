"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  DemoBadge,
  LoadingBlock,
  MobileNav,
  type MobileNavItem,
  StatusBadge,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { LocationMap } from "@/components/delivery/location-map";
import { CodLedgerView } from "@/components/delivery/manager-cod";
import { ManagerCreateOrder } from "@/components/delivery/manager-create-order";
import { useRoadNoteAnalysis } from "@/lib/delivery/road-intel/use-road-intel";
import "@/components/delivery/manager-create-order.css";
import { ManagerHomeView } from "@/components/delivery/manager-home-view";
import { ManagerOrderView } from "@/components/delivery/manager-order-view";
import { ManagerSidebar } from "@/components/delivery/manager-sidebar";
import {
  type ManagerNotice as Notice,
  NoticeStrip,
} from "@/components/delivery/manager-ui-components";
import { ModalPanel } from "@/components/delivery/modal-panel";
import {
  reviewRoadReport,
  setDriverAvailability,
  updateRiderRequestStatus,
} from "@/lib/delivery/actions";
import {
  attentionSummary,
  codPending,
  isActiveOrder,
  isMovingOrder,
  needsRider,
  recentOrders,
} from "@/lib/delivery/dashboard";
import { assessEnergyRoute } from "@/lib/delivery/energy-routing";
import {
  formatTime,
  prioritiseOrders,
  sentenceCase,
} from "@/lib/delivery/format";
import { confirmOrders } from "@/lib/delivery/jobs";
import { useSimulatedFleet } from "@/lib/delivery/simulated-fleet";
import type {
  DeliveryOrder,
  DriverOption,
  RiderRequest,
  VehicleOption,
} from "@/lib/delivery/types";
import { useJobBoard } from "@/lib/delivery/use-job-board";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

const managerNavItems = [
  { id: "home", label: "Overview", href: "/manager/home", icon: "delivery" },
  { id: "track", label: "Track", href: "/manager/track", icon: "track" },
  { id: "order", label: "Orders", href: "/manager/order", icon: "box" },
  { id: "cod", label: "COD", href: "/manager/cod", icon: "coin" },
  { id: "profile", label: "Team", href: "/manager/profile", icon: "user" },
] as const;

const _managerMobileNav = managerNavItems;

export type ManagerView = (typeof managerNavItems)[number]["id"] | "create";

type OrderFilter = "all" | "unassigned" | "moving" | "cod";

const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unassigned", label: "To confirm" },
  { id: "moving", label: "On route" },
  { id: "cod", label: "COD due" },
];

function matchesFilter(order: DeliveryOrder, filter: OrderFilter) {
  if (filter === "unassigned") return needsRider(order);
  if (filter === "moving") return isMovingOrder(order);
  if (filter === "cod") return codPending(order);
  return true;
}

function initialFilter(value: string | null): OrderFilter {
  return ORDER_FILTERS.some((item) => item.id === value)
    ? (value as OrderFilter)
    : "all";
}
type Workspace = ReturnType<typeof useWorkspace>;

const RIDER_REQUEST_LABELS: Record<RiderRequest["category"], string> = {
  refuel: "Needs fuel",
  recharge: "Needs a charge",
  vehicle_problem: "Vehicle problem",
  accident: "Accident",
  parcel_damaged: "Parcel damaged",
  unsafe_area: "Feels unsafe",
  other: "Needs help",
};

function vehicleText(value: string) {
  return value
    .replace("e_bike", "E-bike")
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ManagerApp({ view }: { view: ManagerView }) {
  return (
    <Suspense fallback={<LoadingBlock title="Opening dispatch operations…" />}>
      <ManagerWorkspace view={view} />
    </Suspense>
  );
}

function ManagerWorkspace({ view }: { view: ManagerView }) {
  const workspace = useWorkspace("manager");
  useRoadNoteAnalysis(
    workspace.canUseLiveData && !workspace.isDemo,
    workspace.data.roadReports,
    workspace.refresh,
  );
  return <ManagerDashboard view={view} workspace={workspace} />;
}

export function ManagerDashboard({
  view,
  workspace,
}: {
  view: ManagerView;
  workspace: Workspace;
}) {
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get("id") ?? "");
  const [authOpen, setAuthOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [filter, setFilter] = useState<OrderFilter>(
    initialFilter(searchParams.get("filter")),
  );
  const [searchQuery, _setSearchQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [mapFocusPoint, setMapFocusPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [profileTab, setProfileTab] = useState<"riders" | "vehicles">(() =>
    searchParams.get("tab") === "vehicles" ? "vehicles" : "riders",
  );

  const jobBoard = useJobBoard(
    (view === "track" || view === "home") &&
      workspace.canUseLiveData &&
      !workspace.isDemo,
  );
  const roadJobs = jobBoard.jobs.filter(
    (job) => job.status === "claimed" || job.status === "in_progress",
  );

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "vehicles" || tab === "riders") {
      setProfileTab(tab);
    }
  }, [searchParams]);

  const mobileNavItems: MobileNavItem[] = useMemo(
    () => [
      {
        id: "home",
        label: "Overview",
        href: "/manager/home",
        icon: "delivery",
      },
      { id: "order", label: "Orders", href: "/manager/order", icon: "box" },
      { id: "track", label: "Track", href: "/manager/track", icon: "track" },
      { id: "cod", label: "COD", href: "/manager/cod", icon: "coin" },
      {
        id: "more",
        label: "More",
        href: "#more",
        icon: "menu",
        onClick: () => setMoreOpen(true),
      },
    ],
    [],
  );

  // The map and live list show fake cars driving around Yangon, held in memory only.
  const simulatedCars = useSimulatedFleet(view === "track" || view === "home");
  const orders = useMemo(
    () =>
      prioritiseOrders(
        view === "track"
          ? [...workspace.data.orders, ...simulatedCars]
          : workspace.data.orders,
      ),
    [workspace.data.orders, simulatedCars, view],
  );
  // Dispatch works the queue from the orders that still need a rider.
  const queueOrders = useMemo(
    () =>
      view === "order"
        ? [...orders].sort(
            (left, right) =>
              Number(needsRider(right)) - Number(needsRider(left)),
          )
        : orders,
    [orders, view],
  );
  const filteredOrders = queueOrders.filter((order) =>
    matchesFilter(order, filter),
  );
  const searchedOrders = useMemo(() => {
    if (!searchQuery.trim()) return filteredOrders;
    const q = searchQuery.trim().toLowerCase();
    return filteredOrders.filter(
      (order) =>
        order.tracking_code.toLowerCase().includes(q) ||
        order.customer_name.toLowerCase().includes(q) ||
        order.delivery_address.toLowerCase().includes(q) ||
        order.driver_name?.toLowerCase().includes(q),
    );
  }, [filteredOrders, searchQuery]);
  const selectedOrder =
    searchedOrders.find((order) => order.id === selectedId) ??
    searchedOrders[0] ??
    filteredOrders.find((order) => order.id === selectedId) ??
    filteredOrders[0] ??
    null;
  const selectedRoute = selectedOrder?.route_id
    ? workspace.data.routes.find((route) => route.id === selectedOrder.route_id)
    : null;
  const _selectedRouteStops = selectedRoute
    ? workspace.data.routeStops
        .filter((stop) => stop.route_id === selectedRoute.id)
        .sort((left, right) => left.sequence_number - right.sequence_number)
    : [];
  const _selectedOrderAssessment = useMemo(() => {
    if (!selectedOrder) return null;
    const vehicle = selectedOrder.vehicle_id
      ? workspace.data.vehicles.find((v) => v.id === selectedOrder.vehicle_id)
      : (workspace.data.vehicles[0] ?? null);
    return assessEnergyRoute(
      { ...selectedOrder, latest_location: null },
      vehicle as VehicleOption | null,
    );
  }, [selectedOrder, workspace.data.vehicles]);
  const summary = useMemo(
    () =>
      attentionSummary(
        orders,
        workspace.data.roadReports,
        nowMs,
        workspace.data.statusEvents,
      ),
    [nowMs, orders, workspace.data.roadReports, workspace.data.statusEvents],
  );
  const recentList = useMemo(() => recentOrders(orders), [orders]);
  const movingOrders = useMemo(
    () => [
      ...orders.filter(isMovingOrder),
      // On the overview the cars only feed the map, not the lists.
      ...(view === "home" ? simulatedCars : []),
    ],
    [orders, simulatedCars, view],
  );
  const movingCount = movingOrders.length;
  const deliveredCount = summary.deliveredToday;
  const atRiskCount =
    orders.filter((order) => order.status === "failed").length +
    summary.delayed;
  const assignedDrivers = new Set(
    orders
      .filter(isActiveOrder)
      .map((order) => order.driver_id)
      .filter(Boolean),
  );
  const freeRiders = workspace.data.drivers.filter(
    (driver) =>
      driver.availability === "available" && !assignedDrivers.has(driver.id),
  ).length;
  const availableVehicles = workspace.data.vehicles.filter(
    (vehicle) =>
      vehicle.status === "available" &&
      !orders.some(
        (order) => order.vehicle_id === vehicle.id && isActiveOrder(order),
      ),
  );

  useEffect(() => {
    if (selectedOrder && selectedOrder.id !== selectedId)
      setSelectedId(selectedOrder.id);
  }, [selectedId, selectedOrder]);

  useEffect(() => {
    if (view === "track") setFilter("moving");
  }, [view]);

  useEffect(() => {
    if (!workspace.isLoading && workspace.data)
      setUpdatedAt(new Date().toISOString());
  }, [workspace.isLoading, workspace.data]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (notice?.tone !== "success") return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (workspace.isLoading)
    return <LoadingBlock title="Opening dispatch operations…" />;

  async function refreshWorkspace() {
    if (refreshing) return;
    setRefreshing(true);
    await workspace.refresh().then(
      () => {
        setNowMs(Date.now());
        setRefreshing(false);
      },
      () => setRefreshing(false),
    );
  }

  async function _confirmSelectedOrder() {
    if (!selectedOrder || selectedOrder.status !== "pending") return;
    setSaving(true);
    setNotice(null);
    try {
      if (workspace.isDemo || selectedOrder.id.startsWith("demo-")) {
        throw new Error("Confirming orders needs live data.");
      }
      if (!workspace.canUseLiveData || !workspace.profile)
        throw new Error("Your manager profile is unavailable. Sign in again.");
      const result = await confirmOrders(createClient(), [selectedOrder.id]);
      await workspace.refresh();
      setNotice({
        scope: "assign",
        tone: "success",
        text: result.confirmed
          ? `${selectedOrder.tracking_code} confirmed. Posted to the driver job board.`
          : `${selectedOrder.tracking_code} is already confirmed and waiting on the job board.`,
      });
    } catch (cause) {
      setNotice({
        scope: "assign",
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Could not confirm this order.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(driver: DriverOption) {
    setSaving(true);
    setNotice(null);
    const availability =
      driver.availability === "off_duty"
        ? assignedDrivers.has(driver.id)
          ? "on_delivery"
          : "available"
        : "off_duty";
    try {
      if (workspace.isDemo) {
        workspace.updateData((previous) => ({
          ...previous,
          drivers: previous.drivers.map((item) =>
            item.id === driver.id ? { ...item, availability } : item,
          ),
        }));
      } else if (workspace.canUseLiveData) {
        await setDriverAvailability(createClient(), driver.id, availability);
        await workspace.refresh();
      } else {
        throw new Error(
          "Refresh your manager workspace before changing rider availability.",
        );
      }
      setNotice({
        scope: "riders",
        tone: "success",
        text: `${driver.full_name || "Rider"} is now ${availability === "off_duty" ? "off duty" : "on duty"}.`,
      });
    } catch (cause) {
      setNotice({
        scope: "riders",
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Could not update this rider's availability.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function reviewReport(
    reportId: string,
    decision: "verified" | "rejected",
  ) {
    setSaving(true);
    setNotice(null);
    try {
      if (workspace.isDemo || reportId.startsWith("demo-")) {
        workspace.updateData((previous) => ({
          ...previous,
          roadReports: previous.roadReports.map((report) =>
            report.id === reportId ? { ...report, status: decision } : report,
          ),
        }));
      } else if (workspace.canUseLiveData) {
        await reviewRoadReport(createClient(), reportId, decision);
        await workspace.refresh();
      } else {
        throw new Error(
          "Refresh the manager workspace before reviewing reports.",
        );
      }
      setNotice({
        scope: "reports",
        tone: "success",
        text:
          decision === "verified"
            ? "Report verified. It now feeds ETA predictions."
            : "Report rejected.",
      });
    } catch (cause) {
      setNotice({
        scope: "reports",
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Could not review this road report.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRequest(
    request: RiderRequest,
    status: "acknowledged" | "resolved",
  ) {
    setSaving(true);
    setNotice(null);
    try {
      if (workspace.isDemo || request.id.startsWith("demo-")) {
        workspace.updateData((previous) => ({
          ...previous,
          riderRequests: previous.riderRequests.map((item) =>
            item.id === request.id ? { ...item, status } : item,
          ),
        }));
      } else if (workspace.canUseLiveData) {
        await updateRiderRequestStatus(createClient(), request.id, status);
        await workspace.refresh();
      } else {
        throw new Error(
          "Refresh the manager workspace before handling requests.",
        );
      }
      setNotice({
        scope: "requests",
        tone: "success",
        text:
          status === "resolved"
            ? `${request.driver_name}'s request is resolved.`
            : `${request.driver_name} can see you're on it.`,
      });
    } catch (cause) {
      setNotice({
        scope: "requests",
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Could not update this request.",
      });
    } finally {
      setSaving(false);
    }
  }

  const signedOut = !workspace.isAuthenticated && !workspace.isDemo;
  const openRequests = workspace.data.riderRequests.filter(
    (request) => request.status !== "resolved" && request.kind !== "energy",
  );

  const activeNav = view === "create" ? "order" : view;
  const pageCopy = {
    home: {
      title: "Overview",
      description: "Live status across deliveries, riders and vehicles.",
    },
    track: {
      title: "Live tracking",
      description:
        "Follow parcels after pickup and verify road reports for ETAs.",
    },
    cod: {
      title: "Cash on delivery",
      description:
        "Check what riders collected against what was due, then settle it.",
    },
    order: {
      title: "Orders",
      description: "Work through the queue and assign riders in one step.",
    },
    create: {
      title: "Create order",
      description:
        "Add pickup, delivery and payment details. No customer account is needed.",
    },
    profile: {
      title: "Team",
      description: "Rider availability for dispatch.",
    },
  }[view];

  const mobileActiveId = ["home", "order", "track", "cod"].includes(activeNav)
    ? activeNav
    : "more";

  return (
    <main className="manager-app">
      <ManagerSidebar
        active={view === "create" ? "create" : activeNav}
        orderCount={orders.length}
        movingCount={movingCount}
      />

      <MobileNav
        label="Manager workspace"
        items={mobileNavItems}
        activeId={mobileActiveId}
      />

      <div className="manager-main">
        <header className="manager-topbar">
          <div className="manager-topbar-right">
            <span className="manager-date">
              {signedOut
                ? "Not signed in"
                : updatedAt
                  ? `Updated ${formatTime(updatedAt)}`
                  : "Loading…"}
            </span>
            <button
              type="button"
              className="icon-button manager-refresh"
              aria-label={refreshing ? "Refreshing data" : "Refresh data"}
              onClick={() => void refreshWorkspace()}
              disabled={saving || refreshing || signedOut}
            >
              <Icon name="refresh" size={16} />
            </button>
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
          {workspace.isDemo && (
            <div className="workspace-demo manager-demo">
              <DemoBadge>Demo operations</DemoBadge>
              <span>
                {workspace.canUseLiveData
                  ? "Live deliveries from Supabase. Create a delivery to start your dispatch board."
                  : "Sign in to view live orders, riders, and fleet records."}
              </span>
            </div>
          )}
          {workspace.error && (
            <div className="error-notice manager-error" role="alert">
              <Icon name="warning" size={17} />
              {workspace.error}
              <button type="button" onClick={() => void workspace.refresh()}>
                Retry
              </button>
            </div>
          )}
          {workspace.isStale && !workspace.error && (
            <div className="manager-stale-warning" role="alert">
              <Icon name="warning" size={18} />
              <span>
                <strong>Live updates are unavailable.</strong>
                Showing the last successful workspace data.
              </span>
              <button
                type="button"
                className="button button-outline"
                onClick={() => void refreshWorkspace()}
                disabled={refreshing}
              >
                <Icon name="refresh" size={15} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          )}

          <header className="dash-page-header">
            {view === "create" && (
              <Link className="manual-order-back" href="/manager/order">
                <Icon name="arrow-left" size={18} /> Back to orders
              </Link>
            )}
            <h1>{pageCopy.title}</h1>
            <p>{pageCopy.description}</p>
            {!signedOut && (view === "order" || view === "home") && (
              <Link
                className="button button-primary manual-order-entry"
                href="/manager/order/create"
              >
                <Icon name="plus" size={18} /> Create order
              </Link>
            )}
          </header>

          {signedOut && (
            <section
              className="dash-card dash-signin"
              aria-label="Sign in required"
            >
              <h2>Sign in to see live operations</h2>
              <p>
                Deliveries, riders and road reports appear here once you are
                signed in with a manager account.
              </p>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setAuthOpen(true)}
              >
                Sign in
                <Icon name="arrow-right" size={16} />
              </button>
            </section>
          )}

          {view === "home" && !signedOut && (
            <ManagerHomeView
              workspace={workspace}
              movingCount={movingCount}
              deliveredCount={deliveredCount}
              atRiskCount={atRiskCount}
              refreshing={refreshing}
              onRefresh={refreshWorkspace}
              movingOrders={movingOrders}
              recentList={recentList}
              summary={summary}
              freeRiders={freeRiders}
              availableVehicles={availableVehicles}
              tasks={
                workspace.canUseLiveData && !workspace.isDemo
                  ? {
                      requests: orders.filter(
                        (order) =>
                          order.status === "pending" &&
                          !jobBoard.queuedIds.has(order.id),
                      ).length,
                      queued: jobBoard.queue.filter((entry) => !entry.job_id)
                        .length,
                      open: jobBoard.jobs.filter((job) => job.status === "open")
                        .length,
                    }
                  : null
              }
            />
          )}

          {!signedOut && view === "cod" && (
            <CodLedgerView
              orders={orders}
              live={workspace.canUseLiveData && !workspace.isDemo}
            />
          )}

          {!signedOut && view === "create" && (
            <ManagerCreateOrder
              canCreate={workspace.canUseLiveData && !workspace.isDemo}
            />
          )}

          {!signedOut && view === "order" && (
            <ManagerOrderView
              workspace={workspace}
              orders={queueOrders}
              movingOrders={movingOrders}
              movingCount={movingCount}
              initialSelectedId={searchParams.get("id") ?? undefined}
            />
          )}

          {!signedOut && view === "profile" && (
            <section className="manager-profile-grid">
              <article className="manager-profile-card">
                <span className="manager-profile-avatar">
                  {(workspace.profile?.full_name?.[0] ?? "O").toUpperCase()}
                </span>
                <div>
                  <span className="section-kicker">Signed-in operator</span>
                  <h2>{workspace.profile?.full_name || "Oern Dispatch"}</h2>
                  <p>Yangon delivery operations workspace</p>
                </div>
                <span className="status-badge status-success">
                  <Icon name="shield" size={13} /> Manager access
                </span>
              </article>
            </section>
          )}

          {!signedOut && view === "profile" && (
            <section className="dash-card" id="team-roster">
              <header className="dash-card-header team-roster-header">
                <div>
                  <span className="section-kicker">Operations Resources</span>
                  <h2>Team & Fleet</h2>
                </div>
                <div
                  className="order-filter-tabs"
                  role="tablist"
                  aria-label="Team and fleet roster tabs"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={profileTab === "riders"}
                    className={profileTab === "riders" ? "is-active" : ""}
                    onClick={() => setProfileTab("riders")}
                  >
                    Riders <span>{workspace.data.drivers.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={profileTab === "vehicles"}
                    className={profileTab === "vehicles" ? "is-active" : ""}
                    onClick={() => setProfileTab("vehicles")}
                  >
                    Vehicles <span>{workspace.data.vehicles.length}</span>
                  </button>
                </div>
              </header>
              <NoticeStrip notice={notice} scope="riders" />

              {profileTab === "riders" ? (
                <ul className="dash-list dash-roster">
                  {workspace.data.drivers.map((driver) => {
                    const riding = assignedDrivers.has(driver.id);
                    const offDuty = driver.availability === "off_duty";
                    const activeOrder = orders.find(
                      (o) => o.driver_id === driver.id && isActiveOrder(o),
                    );
                    return (
                      <li key={driver.id} className="team-roster-item">
                        <span className="dash-roster-name">
                          <strong>{driver.full_name || "Rider"}</strong>
                          <small>
                            <i
                              className={`fleet-dot ${riding ? "busy" : ""}`}
                            />
                            {offDuty
                              ? "Off duty"
                              : riding
                                ? "On delivery"
                                : "Available"}
                            {driver.phone && (
                              <a
                                href={`tel:${driver.phone}`}
                                className="team-roster-phone"
                              >
                                · {driver.phone}
                              </a>
                            )}
                          </small>
                          {activeOrder && (
                            <span className="team-roster-assignment">
                              Active:{" "}
                              <strong>{activeOrder.tracking_code}</strong> ·{" "}
                              {activeOrder.delivery_address}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={() => void toggleAvailability(driver)}
                          disabled={saving || !!workspace.error}
                        >
                          {offDuty ? "Set on duty" : "Set off duty"}
                        </button>
                      </li>
                    );
                  })}
                  {!workspace.data.drivers.length && (
                    <li className="dash-empty">No rider profiles available.</li>
                  )}
                </ul>
              ) : (
                <div className="team-vehicles-grid">
                  {workspace.data.vehicles.map((vehicle) => {
                    const inUse = orders.some(
                      (o) => o.vehicle_id === vehicle.id && isActiveOrder(o),
                    );
                    const energyLevel =
                      vehicle.energy_source === "electric"
                        ? vehicle.battery_level_percent
                        : vehicle.fuel_level_percent;
                    return (
                      <article
                        key={vehicle.id}
                        className={`team-vehicle-card ${inUse ? "is-in-use" : ""}`}
                      >
                        <div className="team-vehicle-header">
                          <div>
                            <strong>{vehicle.registration_number}</strong>
                            <span className="team-vehicle-type">
                              {vehicleText(vehicle.vehicle_type)}
                            </span>
                          </div>
                          <span
                            className={`vehicle-status-tag ${inUse ? "status-busy" : vehicle.status === "available" ? "status-available" : "status-maintenance"}`}
                          >
                            {inUse
                              ? "In use"
                              : vehicle.status === "available"
                                ? "Ready"
                                : sentenceCase(vehicle.status)}
                          </span>
                        </div>

                        <div className="team-vehicle-specs">
                          <div className="team-spec-item">
                            <span className="spec-label">Capacity</span>
                            <strong>
                              {vehicle.capacity_kg != null
                                ? `${vehicle.capacity_kg} kg`
                                : "—"}
                            </strong>
                          </div>
                          <div className="team-spec-item">
                            <span className="spec-label">Odometer</span>
                            <strong>
                              {vehicle.odometer_km.toLocaleString()} km
                            </strong>
                          </div>
                        </div>

                        {energyLevel != null && (
                          <div className="team-vehicle-energy">
                            <div className="energy-meter-header">
                              <span className="energy-label">
                                <Icon
                                  name={
                                    vehicle.energy_source === "electric"
                                      ? "compass"
                                      : "truck"
                                  }
                                  size={13}
                                />
                                {vehicle.energy_source === "electric"
                                  ? "Battery"
                                  : "Fuel"}
                              </span>
                              <strong className="energy-percent">
                                {energyLevel}%
                              </strong>
                            </div>
                            <div className="energy-bar-track">
                              <div
                                className={`energy-bar-fill ${energyLevel < 20 ? "is-low" : energyLevel < 50 ? "is-mid" : "is-good"}`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, energyLevel))}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {!workspace.data.vehicles.length && (
                    <div className="dash-empty">
                      No vehicles in fleet roster.
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {!signedOut && view === "track" && (
            <section className="manager-track-grid">
              <div className="manager-live-orders">
                <div className="panel-heading-row">
                  <div>
                    <span className="section-kicker">After parcel pickup</span>
                    <h2>Live deliveries</h2>
                  </div>
                  <span className="manager-live-tag">
                    <span className="availability-dot" /> {movingCount} live
                  </span>
                </div>
                <div className="manager-order-list">
                  {filteredOrders.map((order) => (
                    <button
                      type="button"
                      key={order.id}
                      className={`manager-order-row ${selectedOrder?.id === order.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedId(order.id)}
                    >
                      <span className="order-row-marker marker-live">
                        <Icon name="navigation" size={16} />
                      </span>
                      <span className="manager-row-main">
                        <span>
                          <strong>{order.tracking_code}</strong>
                          <span className="manager-row-customer">
                            {order.driver_name || "Assigned rider"}
                          </span>
                        </span>
                        <small>{order.delivery_address}</small>
                      </span>
                      <span className="manager-row-side">
                        <StatusBadge status={order.status} />
                        <small>{formatTime(order.estimated_delivery_at)}</small>
                      </span>
                    </button>
                  ))}
                  {!filteredOrders.length && (
                    <div className="manager-empty-list">
                      No parcels are moving right now.
                    </div>
                  )}
                </div>
                <div className="manager-road-jobs">
                  <h3>
                    Jobs taken by riders <span>{roadJobs.length}</span>
                  </h3>
                  {roadJobs.map((job) => {
                    const rider = workspace.data.drivers.find(
                      (driver) => driver.id === job.claimed_by,
                    );
                    return (
                      <div className="manager-road-job" key={job.id}>
                        <span>
                          <strong>{job.area_label ?? job.label}</strong>
                          <small>
                            {rider?.full_name ?? "A rider"} · {job.order_count}{" "}
                            {job.order_count === 1 ? "parcel" : "parcels"}
                          </small>
                        </span>
                        <span
                          className={`status-badge ${job.status === "in_progress" ? "status-info" : "status-warning"}`}
                        >
                          {job.status === "in_progress"
                            ? "On the road"
                            : "Heading to pickup"}
                        </span>
                      </div>
                    );
                  })}
                  {!roadJobs.length && (
                    <p className="manager-road-jobs-empty">
                      When a rider takes a job from the board it shows here
                      before the first pickup.
                    </p>
                  )}
                </div>
              </div>
              <div className="manager-track-map">
                <LocationMap
                  order={selectedOrder}
                  orders={filteredOrders}
                  mode="manager"
                  isDemo={workspace.isDemo}
                  tall
                  onSelectOrder={setSelectedId}
                  roadReports={workspace.data.roadReports}
                  focusPoint={mapFocusPoint}
                />
                {selectedOrder && (
                  <div className="manager-track-summary">
                    <span>
                      <strong>{selectedOrder.tracking_code}</strong>
                      <small>
                        {selectedOrder.customer_name} ·{" "}
                        {selectedOrder.delivery_address}
                      </small>
                    </span>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "track" && (
            <section
              className="road-knowledge-panel rider-requests-panel"
              id="rider-requests"
            >
              <div className="road-knowledge-heading">
                <div>
                  <span className="section-kicker">From riders on route</span>
                  <h2>Rider requests</h2>
                </div>
                <span className="manager-live-tag">
                  {openRequests.length} open
                </span>
              </div>
              <p className="road-knowledge-intro">
                Fuel and charging stops, breakdowns and other problems riders
                raise from the road. Acknowledge so the rider knows someone is
                on it.
              </p>
              <NoticeStrip notice={notice} scope="requests" />
              <div className="road-report-list">
                {openRequests.map((request) => {
                  const order = request.order_id
                    ? orders.find((item) => item.id === request.order_id)
                    : null;
                  const vehicle = request.vehicle_id
                    ? workspace.data.vehicles.find(
                        (item) => item.id === request.vehicle_id,
                      )
                    : null;
                  return (
                    <article
                      className={`road-report-card rider-request-card is-${request.kind}`}
                      key={request.id}
                    >
                      <div className="road-report-title">
                        <span
                          className={`road-severity ${request.kind === "energy" ? "road-severity-medium" : "road-severity-high"}`}
                        >
                          {request.kind === "energy" ? "Energy" : "Issue"}
                        </span>
                        <strong>
                          {RIDER_REQUEST_LABELS[request.category]} ·{" "}
                          {request.driver_name}
                        </strong>
                        <small>{formatTime(request.created_at)}</small>
                      </div>
                      {request.note && <p>{request.note}</p>}
                      <span className="road-report-meta">
                        {[
                          order?.tracking_code,
                          vehicle?.registration_number,
                          request.energy_level_percent != null
                            ? `${request.energy_level_percent}% left`
                            : null,
                          request.status === "acknowledged"
                            ? "Acknowledged"
                            : "Waiting",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <div className="road-report-actions">
                        {request.latitude != null &&
                          request.longitude != null && (
                            <>
                              <button
                                type="button"
                                className="button button-outline button-small"
                                onClick={() => {
                                  if (
                                    request.latitude != null &&
                                    request.longitude != null
                                  ) {
                                    setMapFocusPoint({
                                      latitude: request.latitude,
                                      longitude: request.longitude,
                                    });
                                    document
                                      .querySelector(".manager-track-map")
                                      ?.scrollIntoView({ behavior: "smooth" });
                                  }
                                }}
                              >
                                <Icon name="location" size={13} /> View on map
                              </button>
                              <a
                                className="button button-outline button-small"
                                href={`https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Google Maps
                              </a>
                            </>
                          )}
                        {request.status === "open" && (
                          <button
                            type="button"
                            className="button button-outline button-small"
                            onClick={() =>
                              void handleRequest(request, "acknowledged")
                            }
                            disabled={saving}
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          type="button"
                          className="button button-dark button-small"
                          onClick={() =>
                            void handleRequest(request, "resolved")
                          }
                          disabled={saving}
                        >
                          Resolve
                        </button>
                      </div>
                    </article>
                  );
                })}
                {!openRequests.length && (
                  <div className="road-report-empty">
                    <Icon name="check" size={18} /> No rider is waiting on
                    operations.
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "track" && (
            <section className="road-knowledge-panel" id="road-knowledge">
              <div className="road-knowledge-heading">
                <div>
                  <span className="section-kicker">Rider intelligence</span>
                  <h2>Road knowledge</h2>
                </div>
                <span className="manager-live-tag">
                  {summary.pendingReports} pending
                </span>
              </div>
              <p className="road-knowledge-intro">
                Verify fresh rider reports before they influence predictive
                ETAs.
              </p>
              <NoticeStrip notice={notice} scope="reports" />
              <div className="road-report-list">
                {workspace.data.roadReports
                  .filter((report) => report.status === "pending")
                  .map((report) => (
                    <article className="road-report-card" key={report.id}>
                      <div className="road-report-title">
                        <span
                          className={`road-severity road-severity-${report.severity}`}
                        >
                          {sentenceCase(report.severity)}
                        </span>
                        <strong>{sentenceCase(report.category)}</strong>
                        <small>{formatTime(report.reported_at)}</small>
                      </div>
                      <p>{report.description}</p>
                      {report.decision && (
                        <p className="road-report-analysis">
                          <strong>
                            {report.decision.source === "agent"
                              ? "AI analysis"
                              : "Rule-based analysis"}
                            : {sentenceCase(report.decision.action)} ·{" "}
                            {Math.round(report.decision.confidence * 100)}%
                            confident
                            {report.decision.delayMinutes > 0
                              ? ` · +${report.decision.delayMinutes} min`
                              : ""}
                          </strong>
                          <br />
                          {report.decision.rationale}
                        </p>
                      )}
                      <span className="road-report-meta">
                        {report.driver_name}
                        {report.order_id
                          ? ` · ${orders.find((order) => order.id === report.order_id)?.tracking_code ?? "Linked delivery"}`
                          : ""}
                      </span>
                      <div className="road-report-actions">
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={() => {
                            setMapFocusPoint({
                              latitude: report.latitude,
                              longitude: report.longitude,
                            });
                            document
                              .querySelector(".manager-track-map")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          <Icon name="location" size={13} /> View on map
                        </button>
                        <button
                          type="button"
                          className="button button-outline button-small"
                          onClick={() =>
                            void reviewReport(report.id, "rejected")
                          }
                          disabled={saving}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="button button-dark button-small"
                          onClick={() =>
                            void reviewReport(report.id, "verified")
                          }
                          disabled={saving}
                        >
                          Verify for ETA
                        </button>
                      </div>
                    </article>
                  ))}
                {!summary.pendingReports && (
                  <div className="road-report-empty">
                    <Icon name="check" size={18} /> No reports awaiting review.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {moreOpen && (
        <ModalPanel
          titleId="operations-menu-title"
          className="operations-menu-modal"
          onClose={() => setMoreOpen(false)}
        >
          <div className="mobile-more-header">
            <h2 id="operations-menu-title">Operations menu</h2>
            <button
              type="button"
              className="icon-button modal-close-btn"
              onClick={() => setMoreOpen(false)}
              aria-label="Close menu"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="mobile-more-menu">
            <Link
              href="/manager/profile"
              className="mobile-more-item"
              onClick={() => setMoreOpen(false)}
            >
              <Icon name="user" size={20} />
              <div>
                <strong>Team roster</strong>
                <small>Driver availability and on-duty status</small>
              </div>
            </Link>
            <Link
              href="/manager/dispatch"
              className="mobile-more-item"
              onClick={() => setMoreOpen(false)}
            >
              <Icon name="navigation" size={20} />
              <div>
                <strong>Plan routes</strong>
                <small>Depot multi-truck assignment &amp; routing</small>
              </div>
            </Link>
            <Link
              href="/manager/jobs"
              className="mobile-more-item"
              onClick={() => setMoreOpen(false)}
            >
              <Icon name="box" size={20} />
              <div>
                <strong>Job board</strong>
                <small>Batch requests and task automation</small>
              </div>
            </Link>
            <Link
              href="/manager/insights"
              className="mobile-more-item"
              onClick={() => setMoreOpen(false)}
            >
              <Icon name="truck" size={20} />
              <div>
                <strong>Fleet insights</strong>
                <small>
                  Energy reserves, service due &amp; operating costs
                </small>
              </div>
            </Link>
            <a
              href="/tools/traffic-editor.html"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-more-item"
              onClick={() => setMoreOpen(false)}
            >
              <Icon name="compass" size={20} />
              <div>
                <strong>Traffic editor ↗</strong>
                <small>Interactive Yangon traffic and junction points</small>
              </div>
            </a>

            <div className="mobile-more-auth">
              {workspace.isAuthenticated ? (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => {
                    setMoreOpen(false);
                    void signOut();
                  }}
                >
                  Sign out ({workspace.profile?.full_name || "Manager"})
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setMoreOpen(false);
                    setAuthOpen(true);
                  }}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </ModalPanel>
      )}

      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
