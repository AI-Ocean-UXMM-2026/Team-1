"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  Brand,
  DemoBadge,
  LoadingBlock,
  StatusBadge,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { LocationMap } from "@/components/delivery/location-map";
import {
  assignDelivery,
  reviewRoadReport,
  setDriverAvailability,
  updateRiderRequestStatus,
} from "@/lib/delivery/actions";
import {
  attentionSummary,
  codPending,
  hourlyBuckets,
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
import type {
  DeliveryOrder,
  DriverOption,
  RiderRequest,
  WorkspaceData,
} from "@/lib/delivery/types";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

const managerNavItems = [
  { id: "home", label: "Overview", href: "/manager/home", icon: "delivery" },
  { id: "track", label: "Track", href: "/manager/track", icon: "track" },
  { id: "order", label: "Orders", href: "/manager/order", icon: "box" },
  { id: "profile", label: "Team", href: "/manager/profile", icon: "user" },
] as const;

export type ManagerView = (typeof managerNavItems)[number]["id"];

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
type Notice = {
  scope: "assign" | "reports" | "riders" | "requests";
  tone: "success" | "error";
  text: string;
};

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
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderFilter>(
    initialFilter(searchParams.get("filter")),
  );

  const orders = useMemo(
    () => prioritiseOrders(workspace.data.orders),
    [workspace.data.orders],
  );
  const filteredOrders = orders.filter((order) => matchesFilter(order, filter));
  const selectedOrder =
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
  const recommendations = useMemo(
    () =>
      recommendAssignments(
        selectedOrder,
        workspace.data.drivers,
        workspace.data.vehicles,
        orders,
      ),
    [selectedOrder, workspace.data.drivers, workspace.data.vehicles, orders],
  );
  const summary = useMemo(
    () => attentionSummary(orders, workspace.data.roadReports),
    [orders, workspace.data.roadReports],
  );
  const recentList = useMemo(() => recentOrders(orders), [orders]);
  const hourly = useMemo(() => hourlyBuckets(orders), [orders]);
  const movingOrders = orders.filter(isMovingOrder);
  const movingCount = movingOrders.length;
  const activeCount = orders.filter(isActiveOrder).length;
  const deliveredCount = orders.filter(
    (order) => order.status === "delivered",
  ).length;
  const atRiskCount =
    orders.filter((order) => ["failed", "cancelled"].includes(order.status))
      .length + summary.delayed;
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
    if (notice?.tone !== "success") return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (workspace.isLoading)
    return <LoadingBlock title="Opening dispatch operations…" />;

  async function assignRecommendation(
    driverId: string,
    vehicleId: string | null,
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
        text: `${selectedOrder.tracking_code} assigned to ${riderName}.`,
      });
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
  const attentionTotal =
    summary.needsRider +
    summary.delayed +
    summary.codPending +
    summary.pendingReports +
    openRequests.length;

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
    order: {
      title: "Orders",
      description: "Work through the queue and assign riders in one step.",
    },
    profile: {
      title: "Team",
      description: "Rider availability for dispatch.",
    },
  }[view];

  return (
    <main className="manager-app">
      <aside className="manager-sidebar">
        <Brand href="/manager/home" />
        <div className="manager-sidebar-label">Workspace</div>
        <nav className="manager-side-nav" aria-label="Manager workspace">
          {managerNavItems.map((item) => (
            <Link
              key={item.id}
              className={view === item.id ? "side-nav-active" : undefined}
              href={item.href}
              aria-current={view === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
              {item.id === "track" && movingCount > 0 && (
                <span>{movingCount}</span>
              )}
              {item.id === "order" && orders.length > 0 && (
                <span>{orders.length}</span>
              )}
            </Link>
          ))}
          <Link href="/manager/insights">
            <Icon name="truck" size={17} />
            Fleet
          </Link>
        </nav>
      </aside>

      <div className="manager-main">
        <header className="manager-topbar">
          <Brand href="/manager/home" />
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
              aria-label="Refresh data"
              onClick={() => void workspace.refresh()}
              disabled={saving || signedOut}
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

          <header className="dash-page-header">
            <h1>{pageCopy.title}</h1>
            <p>{pageCopy.description}</p>
          </header>

          {view === "home" && signedOut && (
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
            <div className="dash-overview">
              <div className="dash-main">
                <section className="dash-card" aria-label="Delivery metrics">
                  <div className="dash-kpi-grid">
                    <KpiCell
                      label="Live now"
                      value={movingCount}
                      hint="On the road"
                      tone="live"
                    />
                    <KpiCell
                      label="Active"
                      value={activeCount}
                      hint="Assigned or moving"
                    />
                    <KpiCell
                      label="Delivered"
                      value={deliveredCount}
                      hint="All time"
                    />
                    <KpiCell
                      label="At risk"
                      value={atRiskCount}
                      hint="Delayed or failed"
                      tone="warning"
                    />
                  </div>
                  <div className="dash-trend">
                    <span>Orders created · last 12 h</span>
                    {hourly.some((count) => count > 0) ? (
                      <Sparkline values={hourly} />
                    ) : (
                      <span className="dash-trend-empty">
                        None in the last 12 h
                      </span>
                    )}
                  </div>
                </section>

                <section className="dash-card" aria-label="Live map">
                  <CardHeader title="Live map" meta={`${movingCount} live`} />
                  <div className="dash-map">
                    <LocationMap
                      order={null}
                      orders={movingOrders}
                      mode="manager"
                      isDemo={workspace.isDemo}
                      compact
                    />
                    {movingCount === 0 && (
                      <p className="dash-map-empty">No parcels on the move</p>
                    )}
                  </div>
                </section>

                <section className="dash-card" aria-label="Recent deliveries">
                  <CardHeader title="Recent deliveries">
                    <Link className="dash-link" href="/manager/order">
                      View queue
                    </Link>
                  </CardHeader>
                  <table className="dash-table">
                    <caption className="visually-hidden">
                      Recent deliveries
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Delivery</th>
                        <th scope="col">Status</th>
                        <th scope="col">Rider</th>
                        <th scope="col">ETA</th>
                        <th scope="col">COD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentList.map((order) => (
                        <tr key={order.id} className="dash-table-row">
                          <td className="dash-cell-main">
                            <Link href={`/manager/order?id=${order.id}`}>
                              <strong>{order.tracking_code}</strong>
                            </Link>
                            <small>{order.customer_name}</small>
                          </td>
                          <td>
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="dash-cell-truncate">
                            {order.driver_name || "Unassigned"}
                          </td>
                          <td>{formatTime(order.estimated_delivery_at)}</td>
                          <td>
                            {order.cod_amount > 0
                              ? currency.format(order.cod_amount)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!recentList.length && (
                    <p className="dash-empty">No deliveries yet.</p>
                  )}
                </section>
              </div>

              <aside className="dash-rail">
                <section className="dash-card" aria-label="Needs attention">
                  <CardHeader
                    title="Needs attention"
                    meta={
                      attentionTotal ? `${attentionTotal} open` : "All clear"
                    }
                  />
                  <ul className="dash-list">
                    {(
                      [
                        [
                          "Needs rider",
                          summary.needsRider,
                          "/manager/order?filter=unassigned",
                        ],
                        ["Delayed on route", summary.delayed, "/manager/track"],
                        [
                          "COD to settle",
                          summary.codPending,
                          "/manager/order?filter=cod",
                        ],
                        [
                          "Rider requests",
                          openRequests.length,
                          "/manager/track#rider-requests",
                        ],
                        [
                          "Road reports",
                          summary.pendingReports,
                          "/manager/track#road-knowledge",
                        ],
                      ] as const
                    ).map(([label, value, href]) => (
                      <li
                        key={label}
                        className={value > 0 ? "is-alert" : "is-clear"}
                      >
                        <Link href={href}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                          <Icon name="arrow-right" size={14} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="dash-card" aria-label="Fleet status">
                  <CardHeader title="Fleet" />
                  <ul className="dash-list">
                    <li>
                      <Link href="/manager/profile">
                        <span>Riders free</span>
                        <strong>
                          {workspace.data.drivers.length ? (
                            <>
                              {freeRiders}
                              <small> / {workspace.data.drivers.length}</small>
                            </>
                          ) : (
                            "—"
                          )}
                        </strong>
                        <Icon name="arrow-right" size={14} />
                      </Link>
                    </li>
                    <li>
                      <Link href="/manager/profile">
                        <span>Vehicles ready</span>
                        <strong>
                          {workspace.data.vehicles.length ? (
                            <>
                              {availableVehicles.length}
                              <small> / {workspace.data.vehicles.length}</small>
                            </>
                          ) : (
                            "—"
                          )}
                        </strong>
                        <Icon name="arrow-right" size={14} />
                      </Link>
                    </li>
                  </ul>
                </section>
              </aside>
            </div>
          )}

          {view === "order" && (
            <section className="manager-operations-grid">
              <div className="manager-orders-panel" id="orders">
                <div className="panel-heading-row">
                  <div>
                    <h2>Delivery queue</h2>
                  </div>
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
                  {filteredOrders.map((order) => (
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
                      </span>
                    </button>
                  ))}
                  {!filteredOrders.length && (
                    <div className="manager-empty-list">
                      No deliveries match this view.
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

          {view === "profile" && (
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

          {view === "profile" && (
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

          {view === "track" && (
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
                            <a
                              className="button button-outline button-small"
                              href={`https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open location
                            </a>
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
      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}

function KpiCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "live" | "warning";
}) {
  return (
    <div className={`dash-kpi ${tone ? `is-${tone}` : ""}`}>
      <span className="dash-kpi-label">{label}</span>
      <strong className="dash-kpi-value">{value}</strong>
      <span className="dash-kpi-hint">{hint}</span>
    </div>
  );
}

function CardHeader({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <header className="dash-card-header">
      <h2>{title}</h2>
      <div>
        {meta && <span className="dash-meta">{meta}</span>}
        {children}
      </div>
    </header>
  );
}

function NoticeStrip({
  notice,
  scope,
}: {
  notice: Notice | null;
  scope: Notice["scope"];
}) {
  const active = notice?.scope === scope ? notice : null;
  return (
    <div className="dash-notice-slot" aria-live="polite">
      {active && (
        <p className={`dash-notice is-${active.tone}`}>
          <Icon
            name={active.tone === "success" ? "check" : "warning"}
            size={15}
          />
          {active.text}
        </p>
      )}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const step = values.length > 1 ? 100 / (values.length - 1) : 100;
  const points = values
    .map((value, index) => {
      const x = (index * step).toFixed(2);
      const y = (23 - (value / max) * 21).toFixed(2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      className="dash-sparkline"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${total} orders created in the last ${values.length} hours, at most ${max} in one hour`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
