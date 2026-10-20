"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
import {
  collectCod,
  sendDriverLocation,
  setOrderStatus,
} from "@/lib/delivery/actions";
import { currency, formatTime, prioritiseOrders } from "@/lib/delivery/format";
import { hasCollectedParcel } from "@/lib/delivery/location-state";
import { watchRiderLocations } from "@/lib/delivery/rider-location";
import type { DeliveryStatus, WorkspaceData } from "@/lib/delivery/types";
import { STATUS_LABELS } from "@/lib/delivery/types";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

const riderNavItems = [
  { id: "route", label: "Route", href: "#route", icon: "navigation" },
  {
    id: "deliveries",
    label: "Deliveries",
    href: "#deliveries",
    icon: "package",
  },
  { id: "cod", label: "COD", href: "#cod", icon: "coin" },
  {
    id: "rider-account",
    label: "Profile",
    href: "#rider-account",
    icon: "user",
  },
] as const;

function nextAction(status: DeliveryStatus) {
  if (status === "assigned")
    return {
      status: "accepted" as const,
      label: "Accept delivery",
      icon: "check" as const,
    };
  if (status === "accepted")
    return {
      status: "picked_up" as const,
      label: "Parcel received · start tracking",
      icon: "package" as const,
    };
  if (status === "picked_up")
    return {
      status: "in_transit" as const,
      label: "Start delivery route",
      icon: "navigation" as const,
    };
  if (status === "in_transit")
    return {
      status: "delivered" as const,
      label: "Mark as delivered",
      icon: "check" as const,
    };
  return null;
}

export function RiderApp() {
  const workspace = useWorkspace("driver");
  const [selectedId, setSelectedId] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sharingScope, setSharingScope] = useState<string | null>(null);
  const [locationState, setLocationState] = useState(
    "Location sharing is paused",
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastLocationSent, setLastLocationSent] = useState<string | null>(null);
  const [codBusy, setCodBusy] = useState(false);

  const activeOrders = useMemo(
    () =>
      prioritiseOrders(
        workspace.data.orders.filter(
          (order) =>
            !["delivered", "failed", "cancelled"].includes(order.status),
        ),
      ),
    [workspace.data.orders],
  );
  const selectedOrder =
    activeOrders.find((order) => order.id === selectedId) ??
    activeOrders[0] ??
    null;
  const currentDriverId = workspace.profile?.id;
  const navigatingToPickup = selectedOrder
    ? !hasCollectedParcel(selectedOrder.status)
    : false;
  const navigationDestination = selectedOrder
    ? navigatingToPickup
      ? selectedOrder.pickup_latitude != null &&
        selectedOrder.pickup_longitude != null
        ? `${selectedOrder.pickup_latitude},${selectedOrder.pickup_longitude}`
        : selectedOrder.pickup_address
      : selectedOrder.delivery_latitude != null &&
          selectedOrder.delivery_longitude != null
        ? `${selectedOrder.delivery_latitude},${selectedOrder.delivery_longitude}`
        : selectedOrder.delivery_address
    : "";
  const navigationUrl = `https://www.google.com/maps/dir/?${new URLSearchParams(
    {
      api: "1",
      destination: navigationDestination,
      dir_action: "navigate",
    },
  )}`;
  const collectedOrderIds = workspace.data.orders
    .filter(
      (order) =>
        hasCollectedParcel(order.status) &&
        (workspace.isDemo || order.driver_id === currentDriverId),
    )
    .map((order) => order.id)
    .sort();
  const collectedOrdersKey = JSON.stringify(collectedOrderIds);
  const locationSharing =
    sharingScope !== null &&
    (workspace.isDemo
      ? sharingScope === "demo"
      : workspace.canUseLiveData && sharingScope === currentDriverId);
  const action = selectedOrder ? nextAction(selectedOrder.status) : null;

  useEffect(() => {
    if (selectedOrder && selectedId !== selectedOrder.id)
      setSelectedId(selectedOrder.id);
  }, [selectedId, selectedOrder]);

  useEffect(() => {
    if (sharingScope !== null && !locationSharing) {
      setSharingScope(null);
      setLastLocationSent(null);
      setLocationError(null);
      setLocationState("Location sharing is paused");
    }
  }, [locationSharing, sharingScope]);

  function startLocationSharing() {
    if (workspace.isDemo) setSharingScope("demo");
    else if (workspace.canUseLiveData && currentDriverId)
      setSharingScope(currentDriverId);
  }

  const updateLocalStatus = useCallback(
    (
      orderId: string,
      status: DeliveryStatus,
      note: string,
      recordEvent = true,
    ) => {
      workspace.updateData((previous: WorkspaceData) => {
        const nextId =
          Math.max(0, ...previous.statusEvents.map((event) => event.id)) + 1;
        return {
          ...previous,
          orders: previous.orders.map((order) =>
            order.id === orderId ? { ...order, status } : order,
          ),
          statusEvents: recordEvent
            ? [
                ...previous.statusEvents,
                {
                  id: nextId,
                  order_id: orderId,
                  status,
                  note,
                  created_at: new Date().toISOString(),
                },
              ]
            : previous.statusEvents,
        };
      });
    },
    [workspace.updateData],
  );

  async function advanceDelivery() {
    if (!selectedOrder || !action || busyAction) return;
    if (!workspace.isDemo && !workspace.canUseLiveData) return;
    setBusyAction(true);
    setActionError(null);
    try {
      if (workspace.isDemo) {
        updateLocalStatus(selectedOrder.id, action.status, action.label);
      } else {
        await setOrderStatus(createClient(), selectedOrder.id, action.status);
        updateLocalStatus(selectedOrder.id, action.status, action.label, false);
        await workspace.refresh();
      }
      if (action.status === "picked_up") {
        startLocationSharing();
        setLocationState(
          workspace.isDemo
            ? "Demo location preview · no GPS shared"
            : "Requesting GPS permission…",
        );
      }
      if (
        action.status === "delivered" &&
        !collectedOrderIds.some((id) => id !== selectedOrder.id)
      ) {
        setSharingScope(null);
        setLocationState("Location sharing stopped · delivery complete");
      }
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Could not update this delivery.",
      );
    } finally {
      setBusyAction(false);
    }
  }

  async function collectPayment() {
    if (!selectedOrder || codBusy) return;
    if (!workspace.isDemo && !workspace.canUseLiveData) return;
    setCodBusy(true);
    setActionError(null);
    try {
      if (workspace.isDemo) {
        workspace.updateData((previous) => ({
          ...previous,
          orders: previous.orders.map((order) =>
            order.id === selectedOrder.id
              ? { ...order, cod_status: "collected" }
              : order,
          ),
        }));
      } else {
        if (!workspace.profile)
          throw new Error("Your rider profile is unavailable. Sign in again.");
        await collectCod(createClient(), {
          orderId: selectedOrder.id,
          driverId: workspace.profile.id,
          amount: selectedOrder.cod_amount,
        });
        await workspace.refresh();
      }
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Could not record this COD payment.",
      );
    } finally {
      setCodBusy(false);
    }
  }

  async function reportDeliveryIssue() {
    if (!selectedOrder || busyAction) return;
    if (!workspace.isDemo && !workspace.canUseLiveData) return;
    const confirmed = window.confirm(
      `Mark ${selectedOrder.tracking_code} as failed? The customer and operations team will see a delivery issue.`,
    );
    if (!confirmed) return;

    setBusyAction(true);
    setActionError(null);
    try {
      if (workspace.isDemo) {
        updateLocalStatus(
          selectedOrder.id,
          "failed",
          "Delivery could not be completed",
        );
      } else {
        await setOrderStatus(createClient(), selectedOrder.id, "failed");
        updateLocalStatus(
          selectedOrder.id,
          "failed",
          "Delivery could not be completed",
          false,
        );
        await workspace.refresh();
      }
      if (!collectedOrderIds.some((id) => id !== selectedOrder.id)) {
        setSharingScope(null);
        setLocationState("Location sharing stopped · delivery issue reported");
      }
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Could not report this delivery issue.",
      );
    } finally {
      setBusyAction(false);
    }
  }

  useEffect(() => {
    const orderIds = JSON.parse(collectedOrdersKey) as string[];
    if (!locationSharing) return;
    if (!orderIds.length) {
      setSharingScope(null);
      setLastLocationSent(null);
      setLocationState("Location sharing stopped · no parcels on board");
      return;
    }
    if (workspace.isDemo) {
      setLocationState("Demo location preview · no GPS shared");
      return;
    }
    if (!workspace.canUseLiveData || !currentDriverId) return;
    if (!navigator.geolocation) {
      setLocationError(
        "This device does not support location sharing. Keep Oern open on a device with GPS.",
      );
      setLocationState("GPS unavailable");
      setSharingScope(null);
      return;
    }

    setLocationError(null);
    setLocationState("Waiting for your location…");
    return watchRiderLocations({
      geolocation: navigator.geolocation,
      orderIds,
      send: (orderId, point) =>
        sendDriverLocation(
          createClient(),
          orderId,
          currentDriverId,
          point.latitude,
          point.longitude,
          point.accuracy,
        ),
      onSent: (sentIds, point) => {
        setLastLocationSent(point.recordedAt);
        setLocationError(null);
        setLocationState(
          `Sharing location for ${sentIds.length} ${sentIds.length === 1 ? "parcel" : "parcels"} on board`,
        );
        workspace.updateData((previous) => ({
          ...previous,
          orders: previous.orders.map((order) =>
            sentIds.includes(order.id) &&
            order.driver_id === currentDriverId &&
            hasCollectedParcel(order.status)
              ? {
                  ...order,
                  latest_location: {
                    latitude: point.latitude,
                    longitude: point.longitude,
                    accuracy_meters: point.accuracy,
                    recorded_at: point.recordedAt,
                  },
                }
              : order,
          ),
        }));
      },
      onError: (message, permissionDenied) => {
        setLocationError(message);
        setLocationState(
          permissionDenied
            ? "GPS permission needed"
            : "Location update interrupted",
        );
        if (permissionDenied) setSharingScope(null);
      },
    });
  }, [
    locationSharing,
    collectedOrdersKey,
    workspace.canUseLiveData,
    workspace.isDemo,
    currentDriverId,
    workspace.updateData,
  ]);

  if (workspace.isLoading)
    return <LoadingBlock title="Opening your rider route…" />;

  const canFinish =
    selectedOrder &&
    (selectedOrder.cod_amount === 0 ||
      selectedOrder.cod_status === "collected" ||
      selectedOrder.cod_status === "settled");
  const canCollectCod =
    selectedOrder && ["picked_up", "in_transit"].includes(selectedOrder.status);

  return (
    <main className="rider-app">
      <header className="workspace-header rider-header">
        <div className="workspace-header-inner">
          <div className="workspace-title-lockup">
            <Brand />
            <span className="workspace-divider" />
            <div>
              <small>Rider workspace</small>
              <strong>Today’s route</strong>
            </div>
          </div>
          <div className="workspace-header-right">
            <span className="shift-indicator">
              <span /> Shift active
            </span>
            <UserActions
              profile={workspace.profile}
              isAuthenticated={workspace.isAuthenticated}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={() => void signOut()}
              label="Rider"
            />
          </div>
        </div>
      </header>

      {workspace.isDemo && (
        <div className="workspace-demo">
          <DemoBadge>Demo route</DemoBadge>
          <span>
            Preview actions stay in this browser and do not update Supabase or
            share GPS.
          </span>
        </div>
      )}
      {workspace.error && (
        <div className="error-notice workspace-error" role="alert">
          <Icon name="warning" size={17} />
          {workspace.error}
          <button type="button" onClick={() => void workspace.refresh()}>
            Retry
          </button>
        </div>
      )}

      <div className="rider-page-shell">
        <div className="rider-welcome">
          <div>
            <h1>Ready for the road?</h1>
            <p>Every update keeps the customer close to their parcel.</p>
          </div>
          <div className="rider-shift-stat">
            <strong>{activeOrders.length.toString().padStart(2, "0")}</strong>
            <span>Active stops</span>
          </div>
        </div>

        <div className="rider-layout">
          <section className="rider-main-column">
            <div className="rider-map-wrap" id="route">
              <LocationMap
                order={selectedOrder}
                mode="rider"
                isDemo={workspace.isDemo}
                tall
              />
              <div
                className={`location-sharing-strip ${locationSharing ? "is-sharing" : ""}`}
              >
                <span className="sharing-signal">
                  <Icon name="track" size={18} />
                </span>
                <div className="sharing-copy">
                  <strong>{locationState}</strong>
                  <span>
                    {workspace.isDemo
                      ? "Sample location only. Your device’s GPS is never used."
                      : lastLocationSent && locationSharing
                        ? `Last point sent at ${formatTime(lastLocationSent)} · keep this app open while delivering`
                        : collectedOrderIds.length
                          ? "Share your location for every collected parcel. Keep this app open during delivery."
                          : "Customer tracking begins when you receive the parcel."}
                  </span>
                </div>
                {collectedOrderIds.length > 0 &&
                  !locationSharing &&
                  !workspace.isDemo &&
                  workspace.canUseLiveData && (
                    <button
                      type="button"
                      className="button button-small button-dark"
                      onClick={startLocationSharing}
                    >
                      Share location
                    </button>
                  )}
              </div>
              {locationError && (
                <div className="inline-alert" role="alert">
                  <Icon name="warning" size={15} />
                  {locationError}
                </div>
              )}
            </div>

            {selectedOrder ? (
              <div className="rider-task-card" id="cod">
                <div className="rider-task-header">
                  <div>
                    <h2>{selectedOrder.tracking_code}</h2>
                  </div>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <div className="rider-task-route">
                  <div className="task-route-point">
                    <span className="task-route-mark task-pickup-mark">
                      <Icon name="box" size={15} />
                    </span>
                    <div>
                      <small>Collect from</small>
                      <strong>{selectedOrder.pickup_address}</strong>
                      <span>
                        {selectedOrder.status === "assigned" ||
                        selectedOrder.status === "accepted"
                          ? "Parcel handoff point"
                          : "Parcel collected"}
                      </span>
                    </div>
                  </div>
                  <div className="task-route-rule" />
                  <div className="task-route-point">
                    <span className="task-route-mark task-drop-mark">
                      <Icon name="location" size={15} />
                    </span>
                    <div>
                      <small>Deliver to</small>
                      <strong>{selectedOrder.delivery_address}</strong>
                      <span>
                        {selectedOrder.recipient_name || "Recipient"}
                        {selectedOrder.recipient_phone
                          ? ` · ${selectedOrder.recipient_phone}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rider-task-meta">
                  <span>
                    <Icon name="box" size={15} />
                    {selectedOrder.parcel_description ??
                      "Parcel details not provided"}
                  </span>
                  <span>
                    <Icon name="history" size={15} />
                    ETA {formatTime(selectedOrder.estimated_delivery_at)}
                  </span>
                </div>
                <a
                  className="button button-outline rider-primary-action"
                  href={navigationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="navigation" size={18} />
                  {navigatingToPickup
                    ? "Navigate to pickup"
                    : "Navigate to customer"}
                  <Icon name="arrow-right" size={17} />
                </a>
                {selectedOrder.cod_amount > 0 && (
                  <div className="rider-cod-row">
                    <div>
                      <small>
                        <Icon name="coin" size={14} /> COD due
                      </small>
                      <strong>
                        {currency.format(selectedOrder.cod_amount)}
                      </strong>
                    </div>
                    {selectedOrder.cod_status === "pending" ? (
                      <button
                        type="button"
                        className="button button-outline button-small"
                        onClick={() => void collectPayment()}
                        disabled={codBusy || !canCollectCod}
                      >
                        {codBusy
                          ? "Saving…"
                          : canCollectCod
                            ? "Record cash"
                            : "After pickup"}
                      </button>
                    ) : (
                      <span className="cod-paid">
                        <Icon name="check" size={14} />
                        Collected
                      </span>
                    )}
                  </div>
                )}
                {action && (
                  <button
                    type="button"
                    className="button button-primary rider-primary-action"
                    onClick={() => void advanceDelivery()}
                    disabled={
                      busyAction ||
                      (action.status === "delivered" && !canFinish)
                    }
                  >
                    <Icon name={action.icon} size={18} />
                    {busyAction
                      ? "Updating delivery…"
                      : action.status === "delivered" && !canFinish
                        ? "Collect COD before closing delivery"
                        : action.label}
                    <Icon name="arrow-right" size={17} />
                  </button>
                )}
                {selectedOrder.status !== "delivered" &&
                  selectedOrder.status !== "failed" &&
                  selectedOrder.status !== "cancelled" && (
                    <button
                      type="button"
                      className="rider-issue-action"
                      onClick={() => void reportDeliveryIssue()}
                      disabled={busyAction}
                    >
                      <Icon name="warning" size={14} /> Report a delivery issue
                    </button>
                  )}
                {actionError && (
                  <div className="form-message form-error" role="alert">
                    {actionError}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state rider-empty">
                <span className="empty-icon">
                  <Icon name="check" size={23} />
                </span>
                <h2>You’re clear for now</h2>
                <p>New delivery assignments will show up here.</p>
              </div>
            )}
          </section>

          <aside className="rider-stops-column">
            <div className="stops-card" id="deliveries">
              <div className="section-head-block stops-heading">
                <div>
                  <h2>Active stops</h2>
                </div>
                <span className="stops-count">{activeOrders.length}</span>
              </div>
              <div className="stop-list">
                {activeOrders.map((order, index) => (
                  <button
                    type="button"
                    key={order.id}
                    className={`stop-item ${selectedOrder?.id === order.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedId(order.id)}
                  >
                    <span
                      className={`stop-index ${order.status === "in_transit" ? "stop-index-live" : ""}`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="stop-copy">
                      <strong>{order.tracking_code}</strong>
                      <span>{order.delivery_address}</span>
                      <small>{STATUS_LABELS[order.status]}</small>
                    </span>
                    <Icon name="arrow-right" size={16} />
                  </button>
                ))}
                {!activeOrders.length && (
                  <p className="empty-small-copy">
                    Nothing assigned at the moment.
                  </p>
                )}
              </div>
              <div className="stops-footer">
                <span className="route-mini-icon">
                  <Icon name="compass" size={17} />
                </span>
                <span>
                  Each stop includes its pickup and delivery addresses.
                </span>
              </div>
            </div>
            <div className="rider-safety-note">
              <Icon name="shield" size={17} />
              <div>
                <strong>Keep your focus on the road</strong>
                <span>Only update this task when it is safe to stop.</span>
              </div>
            </div>
          </aside>
        </div>

        <footer className="workspace-footer" id="rider-account">
          <span>Oern Rider · Help center</span>
          <a href="/manager">Operations sign-in</a>
        </footer>
      </div>
      <MobileNav label="Rider app" items={riderNavItems} />
      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
