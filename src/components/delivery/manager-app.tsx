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
import "@/components/delivery/manager-create-order.css";
import { ManagerHomeView } from "@/components/delivery/manager-home-view";
import { ModalPanel } from "@/components/delivery/modal-panel";
import {
  CardHeader,
  type ManagerNotice as Notice,
  NoticeStrip,
} from "@/components/delivery/manager-ui-components";
import {
  assignDelivery,
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
import {
  currency,
  formatTime,
  prioritiseOrders,
  sentenceCase,
} from "@/lib/delivery/format";
import { recommendAssignments } from "@/lib/delivery/intelligence";
import { assessEnergyRoute } from "@/lib/delivery/energy-routing";
import type {
  DeliveryOrder,
  DriverOption,
  RiderRequest,
  VehicleOption,
  WorkspaceData,
} from "@/lib/delivery/types";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

const managerNavItems = [
  { id: "home", label: "Overview", href: "/manager/home", icon: "delivery" },
  { id: "track", label: "Track", href: "/manager/track", icon: "track" },
  { id: "order", label: "Orders", href: "/manager/order", icon: "box" },
  { id: "cod", label: "COD", href: "/manager/cod", icon: "coin" },
  { id: "profile", label: "Team", href: "/manager/profile", icon: "user" },
] as const;

const managerMobileNav = managerNavItems;

export type ManagerView = (typeof managerNavItems)[number]["id"] | "create";

type OrderFilter = "all" | "unassigned" | "moving" | "cod";

const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unassigned", label: "Needs rider" },
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
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [filter, setFilter] = useState<OrderFilter>(
    initialFilter(searchParams.get("filter")),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [reassignModal, setReassignModal] = useState<{
    driverId: string;
    driverName: string;
    vehicleId: string | null;
    vehicleLabel: string;
  } | null>(null);
  const [manualOverrideOpen, setManualOverrideOpen] = useState(false);
  const [manualDriverId, setManualDriverId] = useState("");
  const [manualVehicleId, setManualVehicleId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [mapFocusPoint, setMapFocusPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const mobileNavItems: MobileNavItem[] = useMemo(
    () => [
      { id: "home", label: "Overview", href: "/manager/home", icon: "delivery" },
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

  const orders = useMemo(
    () => prioritiseOrders(workspace.data.orders),
    [workspace.data.orders],
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
        (order.driver_name && order.driver_name.toLowerCase().includes(q)),
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
  const selectedRouteStops = selectedRoute
    ? workspace.data.routeStops
        .filter((stop) => stop.route_id === selectedRoute.id)
        .sort((left, right) => left.sequence_number - right.sequence_number)
    : [];
  const [showAllRiders, setShowAllRiders] = useState(false);
  const allRecommendations = useMemo(
    () =>
      recommendAssignments(
        selectedOrder,
        workspace.data.drivers,
        workspace.data.vehicles,
        orders,
        Number.POSITIVE_INFINITY,
        workspace.data.roadReports,
      ),
    [
      selectedOrder,
      workspace.data.drivers,
      workspace.data.vehicles,
      orders,
      workspace.data.roadReports,
    ],
  );
  const recommendations = showAllRiders
    ? allRecommendations
    : allRecommendations.slice(0, 3);
  const selectedOrderAssessment = useMemo(() => {
    if (!selectedOrder) return null;
    const vehicle = selectedOrder.vehicle_id
      ? workspace.data.vehicles.find((v) => v.id === selectedOrder.vehicle_id)
      : recommendations[0]?.vehicleId
        ? workspace.data.vehicles.find(
            (v) => v.id === recommendations[0].vehicleId,
          )
        : workspace.data.vehicles[0] ?? null;
    return assessEnergyRoute(
      { ...selectedOrder, latest_location: null },
      vehicle as VehicleOption | null,
    );
  }, [selectedOrder, workspace.data.vehicles, recommendations]);
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
  const movingOrders = orders.filter(isMovingOrder);
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
  const canAssign =
    !!selectedOrder &&
    ["pending", "assigned", "accepted", "failed"].includes(
      selectedOrder.status,
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

  async function assignRecommendation(
    driverId: string,
    vehicleId: string | null,
    reasonOverride?: string,
  ) {
    if (!selectedOrder || !canAssign) return;
    const driver = workspace.data.drivers.find((item) => item.id === driverId);
    const vehicle = workspace.data.vehicles.find(
      (item) => item.id === vehicleId,
    );
    const vehicleLabel = vehicle
      ? `${vehicle.registration_number} · ${vehicleText(vehicle.vehicle_type)}`
      : "No vehicle";
    const driverName = driver?.full_name || "Rider";

    if (
      selectedOrder.driver_id &&
      selectedOrder.driver_id !== driverId &&
      !reasonOverride
    ) {
      setReassignModal({
        driverId,
        driverName,
        vehicleId,
        vehicleLabel,
      });
      return;
    }

    await executeAssignment(driverId, vehicleId, reasonOverride);
  }

  async function executeAssignment(
    driverId: string,
    vehicleId: string | null,
    reasonOverride?: string,
  ) {
    if (!selectedOrder || !canAssign) return;
    setSaving(true);
    setPendingKey(`${driverId}-${vehicleId ?? "none"}`);
    setNotice(null);
    try {
      if (workspace.isDemo || selectedOrder.id.startsWith("demo-")) {
        const driver = workspace.data.drivers.find(
          (item) => item.id === driverId,
        );
        const vehicle = workspace.data.vehicles.find(
          (item) => item.id === vehicleId,
        );
        workspace.updateData((previous: WorkspaceData) => ({
          ...previous,
          orders: previous.orders.map((order) =>
            order.id === selectedOrder.id
              ? {
                  ...order,
                  status:
                    order.driver_id === driverId &&
                    order.vehicle_id === (vehicleId ?? null) &&
                    ["assigned", "accepted"].includes(order.status)
                      ? order.status
                      : "assigned",
                  driver_id: driverId,
                  driver_name: driver?.full_name ?? "Rider assigned",
                  driver_phone: driver?.phone ?? null,
                  vehicle_id: vehicleId,
                  vehicle_label: vehicle
                    ? `${vehicle.registration_number} · ${vehicleText(vehicle.vehicle_type)}`
                    : null,
                }
              : order,
          ),
        }));
      } else {
        if (!workspace.canUseLiveData || !workspace.profile)
          throw new Error(
            "Your manager profile is unavailable. Sign in again.",
          );
        await assignDelivery(createClient(), {
          orderId: selectedOrder.id,
          driverId,
          vehicleId,
        });
        await workspace.refresh();
      }
      const riderName =
        workspace.data.drivers.find((item) => item.id === driverId)
          ?.full_name || "the rider";
      setNotice({
        scope: "assign",
        tone: "success",
        text: `${selectedOrder.tracking_code} assigned to ${riderName}${reasonOverride ? ` (Override: ${reasonOverride})` : ""}.`,
      });
      setManualOverrideOpen(false);
      setOverrideReason("");
    } catch (cause) {
      setNotice({
        scope: "assign",
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Could not assign this delivery.",
      });
    } finally {
      setSaving(false);
      setPendingKey(null);
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
    (request) => request.status !== "resolved",
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
        "Book a delivery for an outside customer. No customer account needed.",
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
      <aside className="manager-sidebar">
        <div className="manager-sidebar-group">
          <div className="manager-sidebar-label">Dispatch Operations</div>
          <nav className="manager-side-nav" aria-label="Dispatch operations">
            <Link
              className={activeNav === "home" ? "side-nav-active" : undefined}
              href="/manager/home"
              aria-current={activeNav === "home" ? "page" : undefined}
            >
              <Icon name="delivery" size={17} />
              Overview
            </Link>
            <Link
              className={activeNav === "order" ? "side-nav-active" : undefined}
              href="/manager/order"
              aria-current={activeNav === "order" ? "page" : undefined}
            >
              <Icon name="box" size={17} />
              Orders
              {orders.length > 0 && <span>{orders.length}</span>}
            </Link>
            <Link
              className={activeNav === "track" ? "side-nav-active" : undefined}
              href="/manager/track"
              aria-current={activeNav === "track" ? "page" : undefined}
            >
              <Icon name="track" size={17} />
              Live track
              {movingCount > 0 && <span>{movingCount}</span>}
            </Link>
            <Link
              className={view === "create" ? "side-nav-active" : undefined}
              href="/manager/order/create"
              aria-current={view === "create" ? "page" : undefined}
            >
              <Icon name="plus" size={17} />
              Create order
            </Link>
            <Link href="/manager/dispatch">
              <Icon name="navigation" size={17} />
              Plan routes
            </Link>
          </nav>
        </div>

        <div className="manager-sidebar-group">
          <div className="manager-sidebar-label">Field &amp; Fleet</div>
          <nav className="manager-side-nav" aria-label="Field and fleet">
            <Link
              className={activeNav === "profile" ? "side-nav-active" : undefined}
              href="/manager/profile"
              aria-current={activeNav === "profile" ? "page" : undefined}
            >
              <Icon name="user" size={17} />
              Team roster
            </Link>
            <Link href="/manager/jobs">
              <Icon name="box" size={17} />
              Job board
            </Link>
            <Link href="/manager/insights">
              <Icon name="truck" size={17} />
              Fleet insights
            </Link>
          </nav>
        </div>

        <div className="manager-sidebar-group">
          <div className="manager-sidebar-label">Financials</div>
          <nav className="manager-side-nav" aria-label="Financials">
            <Link
              className={activeNav === "cod" ? "side-nav-active" : undefined}
              href="/manager/cod"
              aria-current={activeNav === "cod" ? "page" : undefined}
            >
              <Icon name="coin" size={17} />
              COD ledger
            </Link>
          </nav>
        </div>

        <div className="manager-sidebar-group">
          <div className="manager-sidebar-label">Tools</div>
          <nav className="manager-side-nav" aria-label="Tools">
            <a
              href="/tools/traffic-editor.html"
              target="_blank"
              rel="noopener noreferrer"
              title="Open interactive Yangon traffic and junction editor"
            >
              <Icon name="compass" size={17} />
              Traffic editor ↗
            </a>
          </nav>
        </div>
      </aside>

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
              nowMs={nowMs}
              refreshing={refreshing}
              onRefresh={refreshWorkspace}
              movingOrders={movingOrders}
              recentList={recentList}
              summary={summary}
              openRequests={openRequests}
              freeRiders={freeRiders}
              availableVehicles={availableVehicles}
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
            <section className="manager-operations-grid">
              <div className="manager-orders-panel" id="orders">
                <div className="panel-heading-row">
                  <div>
                    <h2>Delivery queue</h2>
                  </div>
                  <Link
                    className="button button-outline button-small"
                    href="/manager/dispatch"
                  >
                    <Icon name="navigation" size={15} />
                    Plan routes
                  </Link>
                </div>
                <div className="manager-search-box">
                  <Icon name="search" size={16} />
                  <input
                    type="search"
                    placeholder="Search tracking ID, customer, address, rider…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search deliveries"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="manager-search-clear"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
                <div
                  className="order-filter-tabs"
                  role="tablist"
                  aria-label="Filter delivery orders"
                >
                  {ORDER_FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={filter === item.id ? "is-active" : ""}
                      role="tab"
                      aria-selected={filter === item.id}
                      onClick={() => setFilter(item.id)}
                    >
                      {item.label}{" "}
                      <span>
                        {
                          orders.filter((order) =>
                            matchesFilter(order, item.id),
                          ).length
                        }
                      </span>
                    </button>
                  ))}
                </div>
                <div className="manager-order-list">
                  {searchedOrders.map((order) => (
                    <button
                      type="button"
                      key={order.id}
                      className={`manager-order-row ${selectedOrder?.id === order.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedId(order.id)}
                    >
                      <span
                        className={`order-row-marker ${isMovingOrder(order) ? "marker-live" : ""}`}
                      >
                        <Icon name="box" size={16} />
                      </span>
                      <span className="manager-row-main">
                        <span>
                          <strong>{order.tracking_code}</strong>
                          <span className="manager-row-customer">
                            {order.customer_name}
                          </span>
                        </span>
                        <small>{order.delivery_address}</small>
                      </span>
                      <span className="manager-row-side">
                        <StatusBadge status={order.status} />
                        <small>{formatTime(order.estimated_delivery_at)}</small>
                        {selectedOrder?.id === order.id && (
                          <span className="manager-row-selected-pill">
                            Selected
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                  {!searchedOrders.length && (
                    <div className="manager-empty-list">
                      {searchQuery ? (
                        <div className="manager-search-empty">
                          <p>No deliveries match &ldquo;{searchQuery}&rdquo;.</p>
                          <button
                            type="button"
                            className="button button-small button-outline"
                            onClick={() => setSearchQuery("")}
                          >
                            Clear search
                          </button>
                        </div>
                      ) : (
                        "No deliveries match this view."
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="manager-map-panel" id="fleet-map">
                <div className="panel-heading-row manager-map-heading">
                  <div>
                    <h2>Delivery map</h2>
                  </div>
                  <span className="manager-live-tag">
                    <span className="availability-dot" />
                    {movingCount} live
                  </span>
                </div>
                <LocationMap
                  order={selectedOrder}
                  orders={movingOrders}
                  mode="manager"
                  isDemo={workspace.isDemo}
                  tall
                  onSelectOrder={setSelectedId}
                  roadReports={workspace.data.roadReports}
                  focusPoint={mapFocusPoint}
                />
                {selectedOrder ? (
                  <div className="dispatch-detail">
                    <div className="dispatch-order-title">
                      <span>
                        <strong>{selectedOrder.tracking_code}</strong>
                        <small>
                          {selectedOrder.customer_name} ·{" "}
                          {selectedOrder.delivery_address}
                        </small>
                      </span>
                      <StatusBadge status={selectedOrder.status} />
                    </div>
                    {selectedOrderAssessment &&
                      selectedOrderAssessment.distanceKm != null && (
                        <div className="dispatch-energy-card">
                          <div className="energy-card-metrics">
                            <span className="energy-pill">
                              <Icon name="navigation" size={14} />
                              <strong>
                                {selectedOrderAssessment.distanceKm} km
                              </strong>
                            </span>
                            {selectedOrderAssessment.fuelLitresEstimated !=
                              null && (
                              <span className="energy-pill">
                                <Icon name="truck" size={14} />
                                <strong>
                                  {selectedOrderAssessment.fuelLitresEstimated} L
                                  fuel
                                </strong>
                              </span>
                            )}
                            {selectedOrderAssessment.signalsOnRoute != null && (
                              <span className="energy-pill">
                                <Icon name="warning" size={14} />
                                <strong>
                                  {selectedOrderAssessment.signalsOnRoute}{" "}
                                  {selectedOrderAssessment.signalsOnRoute === 1
                                    ? "traffic signal"
                                    : "traffic signals"}
                                </strong>
                              </span>
                            )}
                            {selectedOrderAssessment.interceptionsOnRoute !=
                              null &&
                              selectedOrderAssessment.interceptionsOnRoute >
                                0 && (
                                <span className="energy-pill">
                                  <Icon name="navigation" size={14} />
                                  <strong>
                                    {
                                      selectedOrderAssessment.interceptionsOnRoute
                                    }{" "}
                                    {selectedOrderAssessment.interceptionsOnRoute ===
                                    1
                                      ? "interception"
                                      : "interceptions"}
                                  </strong>
                                </span>
                              )}
                          </div>
                          {selectedOrderAssessment.signalBypasses &&
                            selectedOrderAssessment.signalBypasses.length > 0 && (
                              <div className="energy-bypass-tip">
                                <Icon name="compass" size={14} />
                                <span>
                                  <strong>Small rotation bypass:</strong>{" "}
                                  {
                                    selectedOrderAssessment.signalBypasses[0]
                                      .recommendedRotation
                                  }
                                </span>
                              </div>
                            )}
                          {selectedOrderAssessment.recommendedFuelStation && (
                            <div className="energy-station-tip">
                              <Icon name="location" size={14} />
                              <span>
                                <strong>Fuel station:</strong>{" "}
                                {
                                  selectedOrderAssessment.recommendedFuelStation
                                    .name
                                }{" "}
                                (+
                                {
                                  selectedOrderAssessment.recommendedFuelStation
                                    .detourKm
                                }{" "}
                                km detour)
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    {canAssign && (
                      <div className="assignment-recommendations">
                        <div className="recommendation-heading">
                          <span>
                            <Icon name="compass" size={16} /> Suggested riders
                          </span>
                          <small>Workload · proximity · vehicle fit</small>
                        </div>
                        <NoticeStrip notice={notice} scope="assign" />
                        {recommendations.length ? (
                          <div className="recommendation-list">
                            {recommendations.map((recommendation, index) => {
                              const driver = workspace.data.drivers.find(
                                (item) => item.id === recommendation.driverId,
                              );
                              const vehicle = workspace.data.vehicles.find(
                                (item) => item.id === recommendation.vehicleId,
                              );
                              const isCurrent =
                                selectedOrder.driver_id ===
                                  recommendation.driverId &&
                                (selectedOrder.vehicle_id ?? null) ===
                                  (recommendation.vehicleId ?? null);
                              return (
                                <div
                                  className={`recommendation-card ${isCurrent ? "is-selected" : ""}`}
                                  key={`${recommendation.driverId}-${recommendation.vehicleId ?? "none"}`}
                                >
                                  <span className="recommendation-rank">
                                    {index + 1}
                                  </span>
                                  <span className="recommendation-copy">
                                    <strong>
                                      {driver?.full_name || "Rider"}
                                    </strong>
                                    <small>
                                      {vehicle
                                        ? `${vehicle.registration_number} · ${vehicleText(vehicle.vehicle_type)}`
                                        : "No vehicle"}
                                    </small>
                                    <em>
                                      {recommendation.reasons
                                        .slice(0, 3)
                                        .join(" · ")}
                                    </em>
                                  </span>
                                  <span className="recommendation-score">
                                    {recommendation.score}
                                    <small>fit</small>
                                  </span>
                                  <button
                                    type="button"
                                    className="button button-dark button-small"
                                    onClick={() =>
                                      void assignRecommendation(
                                        recommendation.driverId,
                                        recommendation.vehicleId ?? null,
                                      )
                                    }
                                    disabled={
                                      saving || !!workspace.error || isCurrent
                                    }
                                  >
                                    {pendingKey ===
                                    `${recommendation.driverId}-${recommendation.vehicleId ?? "none"}`
                                      ? "Assigning…"
                                      : isCurrent
                                        ? "Assigned"
                                        : selectedOrder.driver_id
                                          ? "Reassign"
                                          : "Assign"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="form-hint">
                            No compatible on-duty rider and vehicle pair is
                            available.
                          </p>
                        )}
                        {allRecommendations.length > 3 && (
                          <button
                            type="button"
                            className="button button-outline"
                            aria-expanded={showAllRiders}
                            onClick={() => setShowAllRiders((value) => !value)}
                          >
                            {showAllRiders
                              ? "Show top 3 only"
                              : `Show all ${allRecommendations.length} riders`}
                          </button>
                        )}
                        <div className="manual-override-container">
                          <button
                            type="button"
                            className="button button-outline button-small"
                            onClick={() =>
                              setManualOverrideOpen((open) => !open)
                            }
                            aria-expanded={manualOverrideOpen}
                          >
                            <Icon name="user" size={15} />
                            {manualOverrideOpen
                              ? "Hide manual selection"
                              : "Manual driver assignment (with override reason)"}
                          </button>
                          {manualOverrideOpen && (
                            <form
                              className="manual-override-panel"
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!manualDriverId) return;
                                void assignRecommendation(
                                  manualDriverId,
                                  manualVehicleId || null,
                                  overrideReason.trim() || "Manual override",
                                );
                              }}
                            >
                              <div className="manual-override-fields">
                                <label>
                                  <span>Select driver</span>
                                  <select
                                    value={manualDriverId}
                                    onChange={(e) =>
                                      setManualDriverId(e.target.value)
                                    }
                                    required
                                  >
                                    <option value="">Select a driver…</option>
                                    {workspace.data.drivers.map((driver) => (
                                      <option key={driver.id} value={driver.id}>
                                        {driver.full_name || "Rider"} (
                                        {driver.availability.replace("_", " ")})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  <span>Vehicle (optional)</span>
                                  <select
                                    value={manualVehicleId}
                                    onChange={(e) =>
                                      setManualVehicleId(e.target.value)
                                    }
                                  >
                                    <option value="">
                                      Default / no vehicle
                                    </option>
                                    {workspace.data.vehicles.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.registration_number} (
                                        {vehicleText(v.vehicle_type)})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  <span>Override reason</span>
                                  <input
                                    type="text"
                                    value={overrideReason}
                                    onChange={(e) =>
                                      setOverrideReason(e.target.value)
                                    }
                                    placeholder="e.g. Shift swap, VIP urgent delivery, truck upgrade"
                                    required
                                  />
                                </label>
                              </div>
                              <button
                                type="submit"
                                className="button button-primary button-small"
                                disabled={
                                  saving ||
                                  !manualDriverId ||
                                  !overrideReason.trim()
                                }
                              >
                                {saving ? "Assigning…" : "Assign with override"}
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    )}
                    {!canAssign && isMovingOrder(selectedOrder) && (
                      <div className="form-hint">
                        {selectedOrder.driver_name || "Assigned rider"} has the
                        parcel. Assignment stays fixed while this delivery is
                        active.
                      </div>
                    )}
                    {selectedOrder.cod_amount > 0 && (
                      <div className="dispatch-cod">
                        <span>COD to collect</span>
                        <strong>
                          {currency.format(selectedOrder.cod_amount)}
                        </strong>
                        <small>{sentenceCase(selectedOrder.cod_status)}</small>
                      </div>
                    )}
                    {selectedRoute && (
                      <div className="dispatch-route-summary">
                        <span>
                          <strong>Persisted route</strong>
                          <small>
                            {selectedRoute.status} · {selectedRouteStops.length}{" "}
                            stops
                          </small>
                        </span>
                        <div>
                          {selectedRouteStops.map((stop) => (
                            <small key={stop.id}>
                              {stop.sequence_number}. {stop.stop_type} ·{" "}
                              {stop.address}
                            </small>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="manager-empty-map">
                    No deliveries in this view yet.
                  </div>
                )}
              </div>
            </section>
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
            <section className="dash-card" id="drivers">
              <CardHeader title="Riders" />
              <NoticeStrip notice={notice} scope="riders" />
              <ul className="dash-list dash-roster">
                {workspace.data.drivers.map((driver) => {
                  const riding = assignedDrivers.has(driver.id);
                  const offDuty = driver.availability === "off_duty";
                  return (
                    <li key={driver.id}>
                      <span className="dash-roster-name">
                        <strong>{driver.full_name || "Rider"}</strong>
                        <small>
                          <i className={`fleet-dot ${riding ? "busy" : ""}`} />
                          {offDuty
                            ? "Off duty"
                            : riding
                              ? "On delivery"
                              : "Available"}
                        </small>
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
                                  setMapFocusPoint({
                                    latitude: request.latitude!,
                                    longitude: request.longitude!,
                                  });
                                  document
                                    .querySelector(".manager-track-map")
                                    ?.scrollIntoView({ behavior: "smooth" });
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

      {reassignModal && (
        <ModalPanel
          titleId="reassign-modal-title"
          className="reassign-modal"
          onClose={() => setReassignModal(null)}
        >
          <div className="reassign-modal-content">
            <div className="reassign-modal-header">
              <h2 id="reassign-modal-title">Confirm driver reassignment</h2>
            </div>
            <p className="reassign-modal-desc">
              Reassign delivery <strong>{selectedOrder?.tracking_code}</strong> to a different rider?
            </p>
            <div className="reassign-parties">
              <div className="reassign-party">
                <span className="reassign-party-label">Current assignment</span>
                <strong>{selectedOrder?.driver_name || "Assigned rider"}</strong>
              </div>
              <div className="reassign-arrow" aria-hidden="true">
                <Icon name="arrow-right" size={18} />
              </div>
              <div className="reassign-party is-new">
                <span className="reassign-party-label">New assignment</span>
                <strong>{reassignModal.driverName}</strong>
                <small>{reassignModal.vehicleLabel}</small>
              </div>
            </div>
            <div className="reassign-modal-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setReassignModal(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  const pending = reassignModal;
                  setReassignModal(null);
                  void executeAssignment(pending.driverId, pending.vehicleId);
                }}
                disabled={saving}
              >
                {saving ? "Reassigning…" : "Confirm reassignment"}
              </button>
            </div>
          </div>
        </ModalPanel>
      )}

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
                <small>Energy reserves, service due &amp; operating costs</small>
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
