"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  Brand,
  DemoBadge,
  LoadingBlock,
  MobileNav,
  StatusBadge,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { LocationMap } from "@/components/delivery/location-map";
import { ModalPanel } from "@/components/delivery/modal-panel";
import {
  assignDelivery,
  createDelivery,
  setDriverAvailability,
  validateMapPin,
} from "@/lib/delivery/actions";
import { currency, formatTime, prioritiseOrders } from "@/lib/delivery/format";
import type {
  DeliveryOrder,
  DriverOption,
  WorkspaceData,
} from "@/lib/delivery/types";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

const managerNavItems = [
  { id: "overview", label: "Overview", href: "#overview", icon: "delivery" },
  { id: "orders", label: "Orders", href: "#orders", icon: "package" },
  { id: "drivers", label: "Drivers", href: "#drivers", icon: "users" },
  { id: "more", label: "More", href: "#more", icon: "more" },
] as const;

type OrderForm = {
  customerId: string;
  pickup: string;
  delivery: string;
  recipient: string;
  phone: string;
  parcel: string;
  cod: string;
  pickupLatitude: string;
  pickupLongitude: string;
  deliveryLatitude: string;
  deliveryLongitude: string;
};
const emptyForm: OrderForm = {
  customerId: "",
  pickup: "",
  delivery: "",
  recipient: "",
  phone: "",
  parcel: "",
  cod: "0",
  pickupLatitude: "",
  pickupLongitude: "",
  deliveryLatitude: "",
  deliveryLongitude: "",
};

function vehicleText(value: string) {
  return value
    .replace("e_bike", "E-bike")
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ManagerApp() {
  const workspace = useWorkspace("manager");
  const [selectedId, setSelectedId] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unassigned" | "moving">("all");
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignVehicleId, setAssignVehicleId] = useState("");

  const orders = useMemo(
    () => prioritiseOrders(workspace.data.orders),
    [workspace.data.orders],
  );
  const filteredOrders = orders.filter((order) => {
    if (filter === "unassigned")
      return (
        ["pending", "failed"].includes(order.status) ||
        (!order.driver_id && ["assigned", "accepted"].includes(order.status))
      );
    if (filter === "moving")
      return ["picked_up", "in_transit"].includes(order.status);
    return true;
  });
  const selectedOrder =
    filteredOrders.find((order) => order.id === selectedId) ??
    filteredOrders[0] ??
    null;
  const activeCount = orders.filter((order) =>
    ["assigned", "accepted", "picked_up", "in_transit"].includes(order.status),
  ).length;
  const movingCount = orders.filter((order) =>
    ["picked_up", "in_transit"].includes(order.status),
  ).length;
  const availableVehicles = workspace.data.vehicles.filter(
    (vehicle) =>
      vehicle.status === "available" &&
      !orders.some(
        (order) =>
          order.vehicle_id === vehicle.id &&
          ["assigned", "accepted", "picked_up", "in_transit"].includes(
            order.status,
          ),
      ),
  );
  const assignedDrivers = new Set(
    orders
      .filter((order) =>
        ["assigned", "accepted", "picked_up", "in_transit"].includes(
          order.status,
        ),
      )
      .map((order) => order.driver_id)
      .filter(Boolean),
  );
  const freeRiders = workspace.data.drivers.filter(
    (driver) =>
      driver.availability === "available" && !assignedDrivers.has(driver.id),
  ).length;
  const assignableDrivers = workspace.data.drivers.filter(
    (driver) => driver.availability !== "off_duty",
  );
  const assignableVehicles = workspace.data.vehicles.filter((vehicle) => {
    if (!["available", "in_use"].includes(vehicle.status)) return false;
    const otherOrders = orders.filter(
      (order) =>
        order.id !== selectedOrder?.id &&
        order.vehicle_id === vehicle.id &&
        ["assigned", "accepted", "picked_up", "in_transit"].includes(
          order.status,
        ),
    );
    if (otherOrders.some((order) => order.driver_id !== assignDriverId))
      return false;
    return (
      vehicle.status === "available" ||
      orders.some(
        (order) =>
          order.vehicle_id === vehicle.id &&
          order.driver_id === assignDriverId &&
          ["assigned", "accepted", "picked_up", "in_transit"].includes(
            order.status,
          ),
      )
    );
  });

  useEffect(() => {
    if (selectedOrder && selectedOrder.id !== selectedId)
      setSelectedId(selectedOrder.id);
  }, [selectedId, selectedOrder]);

  useEffect(() => {
    if (!selectedOrder?.id) {
      setAssignDriverId("");
      setAssignVehicleId("");
      return;
    }
    setAssignDriverId(
      selectedOrder?.driver_id ??
        workspace.data.drivers.find(
          (driver) => driver.availability !== "off_duty",
        )?.id ??
        "",
    );
    setAssignVehicleId(
      selectedOrder?.vehicle_id ??
        workspace.data.vehicles.find(
          (vehicle) => vehicle.status === "available",
        )?.id ??
        "",
    );
  }, [
    selectedOrder?.driver_id,
    selectedOrder?.vehicle_id,
    selectedOrder?.id,
    workspace.data.drivers,
    workspace.data.vehicles,
  ]);

  if (workspace.isLoading)
    return <LoadingBlock title="Opening dispatch operations…" />;

  function setField(field: keyof OrderForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const amount = Math.max(0, Number(form.cod) || 0);
      const pickupLatitude = form.pickupLatitude.trim()
        ? Number(form.pickupLatitude)
        : null;
      const pickupLongitude = form.pickupLongitude.trim()
        ? Number(form.pickupLongitude)
        : null;
      const deliveryLatitude = form.deliveryLatitude.trim()
        ? Number(form.deliveryLatitude)
        : null;
      const deliveryLongitude = form.deliveryLongitude.trim()
        ? Number(form.deliveryLongitude)
        : null;
      validateMapPin("pickup", pickupLatitude, pickupLongitude);
      validateMapPin("drop-off", deliveryLatitude, deliveryLongitude);
      if (workspace.canUseLiveData && workspace.profile) {
        const created = await createDelivery(createClient(), {
          managerId: workspace.profile.id,
          customerId: form.customerId,
          pickupAddress: form.pickup,
          deliveryAddress: form.delivery,
          recipientName: form.recipient,
          recipientPhone: form.phone,
          parcelDescription: form.parcel,
          codAmount: amount,
          pickupLatitude,
          pickupLongitude,
          deliveryLatitude,
          deliveryLongitude,
        });
        await workspace.refresh();
        setSelectedId(created.id);
      } else if (workspace.isDemo && !workspace.isAuthenticated) {
        const timestamp = Date.now();
        const customer = workspace.data.customers.find(
          (item) => item.id === form.customerId,
        );
        const demoOrder: DeliveryOrder = {
          id: `demo-order-${timestamp}`,
          tracking_code: `OR-${String(timestamp).slice(-4)}`,
          customer_id: form.customerId,
          customer_name: customer?.full_name || "Preview customer",
          status: "pending",
          pickup_address: form.pickup,
          delivery_address: form.delivery,
          pickup_latitude: pickupLatitude,
          pickup_longitude: pickupLongitude,
          delivery_latitude: deliveryLatitude,
          delivery_longitude: deliveryLongitude,
          recipient_name: form.recipient || null,
          recipient_phone: form.phone || null,
          parcel_description: form.parcel || null,
          parcel_weight_kg: null,
          cod_amount: amount,
          cod_status: amount > 0 ? "pending" : "not_required",
          estimated_delivery_at: new Date(
            Date.now() + 60 * 60_000,
          ).toISOString(),
          created_at: new Date().toISOString(),
          driver_id: null,
          driver_name: null,
          driver_phone: null,
          vehicle_id: null,
          vehicle_label: null,
          latest_location: null,
        };
        workspace.updateData((previous) => ({
          ...previous,
          orders: [demoOrder, ...previous.orders],
        }));
        setSelectedId(demoOrder.id);
      } else {
        throw new Error(
          "Your manager workspace is unavailable. Refresh before creating a delivery.",
        );
      }
      setForm(emptyForm);
      setCreateOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create this delivery.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function assignSelected() {
    if (!selectedOrder || !canAssign || !assignDriverId) return;
    setSaving(true);
    setError(null);
    try {
      if (workspace.isDemo || selectedOrder.id.startsWith("demo-")) {
        const driver = workspace.data.drivers.find(
          (item) => item.id === assignDriverId,
        );
        const vehicle = workspace.data.vehicles.find(
          (item) => item.id === assignVehicleId,
        );
        workspace.updateData((previous: WorkspaceData) => ({
          ...previous,
          orders: previous.orders.map((order) =>
            order.id === selectedOrder.id
              ? {
                  ...order,
                  status:
                    order.driver_id === assignDriverId &&
                    order.vehicle_id === (assignVehicleId || null) &&
                    ["assigned", "accepted"].includes(order.status)
                      ? order.status
                      : "assigned",
                  driver_id: assignDriverId,
                  driver_name: driver?.full_name ?? "Rider assigned",
                  driver_phone: driver?.phone ?? null,
                  vehicle_id: assignVehicleId || null,
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
          driverId: assignDriverId,
          vehicleId: assignVehicleId || null,
        });
        await workspace.refresh();
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not assign this delivery.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(driver: DriverOption) {
    setSaving(true);
    setError(null);
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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update this rider's availability.",
      );
    } finally {
      setSaving(false);
    }
  }

  const canAssign =
    selectedOrder &&
    ["pending", "assigned", "accepted", "failed"].includes(
      selectedOrder.status,
    );

  return (
    <main className="manager-app">
      <aside className="manager-sidebar">
        <Brand />
        <div className="manager-sidebar-label">Workspace</div>
        <nav className="manager-side-nav" aria-label="Manager workspace">
          <a className="side-nav-active" href="#overview">
            <Icon name="delivery" size={17} />
            Overview
          </a>
          <a href="#orders">
            <Icon name="box" size={17} />
            Deliveries<span>{orders.length}</span>
          </a>
          <a href="#fleet">
            <Icon name="truck" size={17} />
            Fleet<span>{workspace.data.vehicles.length}</span>
          </a>
        </nav>
        <div className="manager-sidebar-bottom">
          <span className="sidebar-avatar">OP</span>
          <div>
            <strong>Oern Dispatch</strong>
            <small>Yangon operations</small>
          </div>
          <Icon name="more" size={16} />
        </div>
      </aside>

      <div className="manager-main">
        <header className="manager-topbar">
          <Brand href="/manager" />
          <div className="manager-topbar-right">
            <span className="manager-date">
              <Icon name="history" size={14} /> Live operations · Yangon
            </span>
            <UserActions
              profile={workspace.profile}
              isAuthenticated={workspace.isAuthenticated}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={() => void signOut()}
              label="Manager"
            />
          </div>
        </header>

        <div className="manager-content" id="overview">
          {workspace.isDemo && (
            <div className="workspace-demo manager-demo">
              <DemoBadge>Demo operations</DemoBadge>
              <span>
                {workspace.canUseLiveData
                  ? "You're viewing sample deliveries. Create a delivery to start your dispatch board; sample edits stay in this preview."
                  : "Sample orders, riders, and fleet are for preview. Preview changes stay on this device."}
              </span>
            </div>
          )}
          {(error || workspace.error) && (
            <div className="error-notice manager-error" role="alert">
              <Icon name="warning" size={17} />
              {error ?? workspace.error}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  void workspace.refresh();
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="manager-page-title">
            <div>
              <h1>Dispatch, made visible.</h1>
              <p>Every rider, parcel, and delivery status in one live view.</p>
            </div>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setCreateOpen(true)}
              disabled={!!workspace.error}
            >
              <Icon name="plus" size={17} />
              New delivery
            </button>
          </div>

          <section className="manager-metrics" aria-label="Delivery metrics">
            <article className="metric-card">
              <div className="metric-head">
                <span className="metric-icon metric-orange">
                  <Icon name="track" size={17} />
                </span>
                <span className="metric-caption">Live now</span>
              </div>
              <strong>{movingCount.toString().padStart(2, "0")}</strong>
              <div className="metric-foot">
                <span className="availability-dot" />
                Parcels on the move
              </div>
            </article>
            <article className="metric-card">
              <div className="metric-head">
                <span className="metric-icon metric-blue">
                  <Icon name="delivery" size={17} />
                </span>
                <span className="metric-caption">Active deliveries</span>
              </div>
              <strong>{activeCount.toString().padStart(2, "0")}</strong>
              <div className="metric-foot">Orders being handled</div>
            </article>
            <article className="metric-card">
              <div className="metric-head">
                <span className="metric-icon metric-green">
                  <Icon name="users" size={17} />
                </span>
                <span className="metric-caption">Riders available</span>
              </div>
              <strong>{freeRiders.toString().padStart(2, "0")}</strong>
              <div className="metric-foot">
                {workspace.data.drivers.length} registered riders
              </div>
            </article>
            <article className="metric-card">
              <div className="metric-head">
                <span className="metric-icon metric-violet">
                  <Icon name="truck" size={17} />
                </span>
                <span className="metric-caption">Fleet ready</span>
              </div>
              <strong>
                {availableVehicles.length.toString().padStart(2, "0")}
              </strong>
              <div className="metric-foot">
                {workspace.data.vehicles.length} vehicles registered
              </div>
            </article>
          </section>

          <section className="manager-operations-grid">
            <div className="manager-orders-panel" id="orders">
              <div className="panel-heading-row">
                <div>
                  <h2>Delivery orders</h2>
                </div>
                <button
                  type="button"
                  className="icon-button manager-filter-button"
                  aria-label="Refresh orders"
                  onClick={() => void workspace.refresh()}
                  disabled={saving}
                >
                  <Icon name="history" size={17} />
                </button>
              </div>
              <div
                className="order-filter-tabs"
                role="tablist"
                aria-label="Filter delivery orders"
              >
                <button
                  type="button"
                  className={filter === "all" ? "is-active" : ""}
                  role="tab"
                  aria-selected={filter === "all"}
                  onClick={() => setFilter("all")}
                >
                  All <span>{orders.length}</span>
                </button>
                <button
                  type="button"
                  className={filter === "unassigned" ? "is-active" : ""}
                  role="tab"
                  aria-selected={filter === "unassigned"}
                  onClick={() => setFilter("unassigned")}
                >
                  Needs rider
                </button>
                <button
                  type="button"
                  className={filter === "moving" ? "is-active" : ""}
                  role="tab"
                  aria-selected={filter === "moving"}
                  onClick={() => setFilter("moving")}
                >
                  On route
                </button>
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
                      className={`order-row-marker ${["picked_up", "in_transit"].includes(order.status) ? "marker-live" : ""}`}
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
              <button
                type="button"
                className="manager-view-all"
                onClick={() => setFilter("all")}
              >
                View all delivery orders <Icon name="arrow-right" size={15} />
              </button>
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
                orders={orders.filter((item) =>
                  ["picked_up", "in_transit"].includes(item.status),
                )}
                mode="manager"
                isDemo={workspace.isDemo}
                tall
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
                    <div className="assignment-controls">
                      <label className="field-label compact-label">
                        ASSIGN RIDER
                        <select
                          value={assignDriverId}
                          onChange={(event) => {
                            setAssignDriverId(event.target.value);
                            setAssignVehicleId("");
                          }}
                          disabled={
                            !assignableDrivers.length ||
                            saving ||
                            !!workspace.error
                          }
                        >
                          <option value="">
                            {assignableDrivers.length
                              ? "Select a rider"
                              : "No riders on duty"}
                          </option>
                          {workspace.data.drivers.map((driver) => (
                            <option
                              value={driver.id}
                              key={driver.id}
                              disabled={driver.availability === "off_duty"}
                            >
                              {driver.full_name || driver.phone || "Rider"} ·{" "}
                              {driver.availability === "off_duty"
                                ? "Off duty"
                                : assignedDrivers.has(driver.id)
                                  ? "On delivery"
                                  : "Available"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label compact-label">
                        VEHICLE
                        <select
                          value={assignVehicleId}
                          onChange={(event) =>
                            setAssignVehicleId(event.target.value)
                          }
                          disabled={saving || !!workspace.error}
                        >
                          <option value="">No vehicle</option>
                          {assignableVehicles.map((vehicle) => (
                            <option value={vehicle.id} key={vehicle.id}>
                              {vehicle.registration_number} ·{" "}
                              {vehicleText(vehicle.vehicle_type)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="button button-dark assignment-save"
                        onClick={() => void assignSelected()}
                        disabled={
                          saving ||
                          !!workspace.error ||
                          !assignableDrivers.some(
                            (driver) => driver.id === assignDriverId,
                          ) ||
                          (!!assignVehicleId &&
                            !assignableVehicles.some(
                              (vehicle) => vehicle.id === assignVehicleId,
                            ))
                        }
                      >
                        {saving
                          ? "Saving…"
                          : selectedOrder.driver_id
                            ? "Update assignment"
                            : "Assign delivery"}
                        <Icon name="arrow-right" size={15} />
                      </button>
                    </div>
                  )}
                  {!canAssign &&
                    ["picked_up", "in_transit"].includes(
                      selectedOrder.status,
                    ) && (
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
                      <small>{selectedOrder.cod_status}</small>
                    </div>
                  )}
                </div>
              ) : (
                <div className="manager-empty-map">
                  Create a delivery to start dispatching.
                </div>
              )}
            </div>
          </section>

          <section className="fleet-strip" id="drivers">
            <div>
              <h2>Riders and vehicles</h2>
            </div>
            <div className="fleet-item-list">
              {workspace.data.drivers.map((driver, index) => {
                const riding = orders.some(
                  (order) =>
                    order.driver_id === driver.id &&
                    [
                      "assigned",
                      "accepted",
                      "picked_up",
                      "in_transit",
                    ].includes(order.status),
                );
                return (
                  <div className="fleet-item" key={driver.id}>
                    <span
                      className={`fleet-person-avatar fleet-avatar-${index % 3}`}
                    >
                      {(driver.full_name?.[0] ?? "R").toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void toggleAvailability(driver)}
                      disabled={saving || !!workspace.error}
                      title={
                        driver.availability === "off_duty"
                          ? "Set rider on duty"
                          : "Set rider off duty"
                      }
                      aria-label={`Set ${driver.full_name || "rider"} ${driver.availability === "off_duty" ? "on" : "off"} duty`}
                      aria-pressed={driver.availability !== "off_duty"}
                    >
                      <Icon
                        name={
                          driver.availability === "off_duty" ? "plus" : "check"
                        }
                        size={16}
                      />
                    </button>
                    <span>
                      <strong>{driver.full_name || "Rider"}</strong>
                      <small>
                        <i
                          className={riding ? "fleet-dot busy" : "fleet-dot"}
                        />
                        {driver.availability === "off_duty"
                          ? "Off duty"
                          : riding
                            ? "On delivery"
                            : "Available"}
                      </small>
                    </span>
                  </div>
                );
              })}
              {!workspace.data.drivers.length && (
                <span className="fleet-empty">
                  No rider profiles available.
                </span>
              )}
            </div>
          </section>

          <footer className="manager-footer" id="more">
            <span>Oern Dispatch · Yangon operations</span>
            <a href="#overview">
              Back to overview <Icon name="arrow-right" size={13} />
            </a>
          </footer>
        </div>
      </div>

      <MobileNav label="Operations app" items={managerNavItems} />

      {createOpen && (
        <ModalPanel
          className="form-dialog"
          titleId="create-title"
          onClose={() => setCreateOpen(false)}
        >
          <button
            className="dialog-close"
            type="button"
            onClick={() => setCreateOpen(false)}
            aria-label="Close new delivery form"
          >
            <Icon name="close" size={19} />
          </button>
          <span className="eyebrow">New delivery</span>
          <h2 id="create-title">Create a delivery</h2>
          <p>
            Set the handoff and destination. Assign a rider from the dispatch
            map.
          </p>
          <form
            className="delivery-form"
            onSubmit={(event) => void saveOrder(event)}
          >
            <label className="field-label">
              Customer
              <select
                value={form.customerId}
                onChange={(event) => setField("customerId", event.target.value)}
                required
              >
                <option value="">Select a customer</option>
                {workspace.data.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name || customer.phone || "Customer"}
                  </option>
                ))}
              </select>
            </label>
            {workspace.data.customers.length === 0 && (
              <div className="form-hint">
                Create a customer account first. Public sign-up adds a customer
                profile automatically.
              </div>
            )}
            <label className="field-label">
              Pickup address
              <input
                value={form.pickup}
                onChange={(event) => setField("pickup", event.target.value)}
                placeholder="Sender address, township"
                required
              />
            </label>
            <label className="field-label">
              Delivery address
              <input
                value={form.delivery}
                onChange={(event) => setField("delivery", event.target.value)}
                placeholder="Recipient address, township"
                required
              />
            </label>
            <details>
              <summary>Map pins (optional)</summary>
              <p className="form-hint">
                Add coordinates to show pickup and drop-off markers and help
                rider navigation. Addresses are saved as entered.
              </p>
              <div className="form-two-col">
                <label className="field-label">
                  Pickup latitude
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    value={form.pickupLatitude}
                    onChange={(event) =>
                      setField("pickupLatitude", event.target.value)
                    }
                    placeholder="16.7797"
                  />
                </label>
                <label className="field-label">
                  Pickup longitude
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    value={form.pickupLongitude}
                    onChange={(event) =>
                      setField("pickupLongitude", event.target.value)
                    }
                    placeholder="96.1434"
                  />
                </label>
              </div>
              <div className="form-two-col">
                <label className="field-label">
                  Drop-off latitude
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    value={form.deliveryLatitude}
                    onChange={(event) =>
                      setField("deliveryLatitude", event.target.value)
                    }
                    placeholder="16.8178"
                  />
                </label>
                <label className="field-label">
                  Drop-off longitude
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    value={form.deliveryLongitude}
                    onChange={(event) =>
                      setField("deliveryLongitude", event.target.value)
                    }
                    placeholder="96.1566"
                  />
                </label>
              </div>
            </details>
            <div className="form-two-col">
              <label className="field-label">
                Recipient name
                <input
                  value={form.recipient}
                  onChange={(event) =>
                    setField("recipient", event.target.value)
                  }
                  required
                />
              </label>
              <label className="field-label">
                Recipient phone
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                />
              </label>
            </div>
            <div className="form-two-col">
              <label className="field-label">
                Parcel description
                <input
                  value={form.parcel}
                  onChange={(event) => setField("parcel", event.target.value)}
                  placeholder="Documents, clothing…"
                />
              </label>
              <label className="field-label">
                COD · MMK
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={form.cod}
                  onChange={(event) => setField("cod", event.target.value)}
                />
              </label>
            </div>
            {error && (
              <div className="form-message form-error" role="alert">
                {error}
              </div>
            )}
            <div className="form-dialog-footer">
              <span>
                {workspace.canUseLiveData
                  ? "Saved to your dispatch board."
                  : "Demo only · saved in this preview."}{" "}
                ETA is set to one hour from order creation.
              </span>
              <button
                className="button button-primary"
                type="submit"
                disabled={
                  saving ||
                  !!workspace.error ||
                  !workspace.data.customers.length
                }
              >
                {saving ? "Creating…" : "Create delivery"}
                <Icon name="arrow-right" size={16} />
              </button>
            </div>
          </form>
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
