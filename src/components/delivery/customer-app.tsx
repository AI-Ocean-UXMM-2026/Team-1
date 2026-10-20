"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  Brand,
  DemoBadge,
  Eyebrow,
  LoadingBlock,
  MobileNav,
  StatusBadge,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import { LocationMap } from "@/components/delivery/location-map";
import {
  currency,
  formatDateTime,
  formatTime,
  prioritiseOrders,
  timeUntil,
} from "@/lib/delivery/format";
import {
  hasCollectedParcel,
  parcelLocationState,
} from "@/lib/delivery/location-state";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { STATUS_LABELS, STATUS_STEPS } from "@/lib/delivery/types";
import { useWorkspace } from "@/lib/delivery/use-workspace";

function etaCopy(order: DeliveryOrder) {
  if (order.status === "delivered") return "Arrived safely";
  if (order.status === "failed") return "We’re resolving an issue";
  if (order.status === "cancelled") return "Delivery cancelled";
  if (!hasCollectedParcel(order.status)) return "After parcel pickup";
  return timeUntil(order.estimated_delivery_at);
}

const customerNavItems = [
  { id: "delivery", label: "Home", href: "#delivery", icon: "delivery" },
  { id: "tracking", label: "Track", href: "#tracking", icon: "track" },
  { id: "history", label: "Orders", href: "#history", icon: "package" },
  { id: "account", label: "Profile", href: "#account", icon: "user" },
] as const;

export function CustomerApp() {
  const workspace = useWorkspace("customer");
  const [selectedId, setSelectedId] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(0);
  const orders = useMemo(
    () => prioritiseOrders(workspace.data.orders),
    [workspace.data.orders],
  );
  const selectedOrder =
    orders.find((order) => order.id === selectedId) ?? orders[0] ?? null;

  useEffect(() => {
    if (!selectedOrder) return;
    if (selectedId !== selectedOrder.id) setSelectedId(selectedOrder.id);
  }, [selectedId, selectedOrder]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const locationState = parcelLocationState(selectedOrder, now);
  const deliveredEvent = selectedOrder
    ? workspace.data.statusEvents
        .filter(
          (event) =>
            event.order_id === selectedOrder.id && event.status === "delivered",
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    : null;
  const locationHeading = workspace.isDemo
    ? "Sample parcel location"
    : locationState === "live"
      ? "Your rider’s latest location"
      : locationState === "closed"
        ? "Location sharing has ended"
        : locationState === "stale"
          ? "Showing the last known location"
          : selectedOrder && hasCollectedParcel(selectedOrder.status)
            ? "Waiting for the rider’s first location"
            : "Live location starts at pickup";
  const locationDescription = workspace.isDemo
    ? "This map illustrates tracking after pickup. Sign in to follow your own delivery."
    : locationState === "live"
      ? "Location points update automatically while the rider keeps their app open."
      : locationState === "closed"
        ? "Your delivery’s final status remains available below."
        : locationState === "stale"
          ? "A fresh GPS point has not arrived yet. The rider may have lost connection."
          : selectedOrder && hasCollectedParcel(selectedOrder.status)
            ? "Your parcel is collected. The map will update when your rider shares a GPS point."
            : "Your rider’s location becomes available after they receive the parcel.";

  if (workspace.isLoading)
    return <LoadingBlock title="Opening your delivery view…" />;

  return (
    <main className="customer-app">
      <header className="customer-header shell-width">
        <Brand />
        <nav className="customer-nav" aria-label="Main navigation">
          <a className="nav-current" href="#delivery">
            My deliveries
          </a>
          <a href="#history">Delivery history</a>
        </nav>
        <UserActions
          profile={workspace.profile}
          isAuthenticated={workspace.isAuthenticated}
          onSignIn={() => setAuthOpen(true)}
          onSignOut={() => void signOut()}
          label="Customer"
        />
      </header>

      <section className="customer-intro shell-width" id="delivery">
        <div>
          <h1>
            {selectedOrder?.status === "in_transit"
              ? "Your parcel is on the move."
              : "Every handoff, in view."}
          </h1>
          <p>
            See your rider’s location from the moment your parcel is collected
            to the moment it arrives.
          </p>
        </div>
        <div className="customer-intro-aside">
          <span className="availability-dot" /> Live parcel visibility
        </div>
      </section>

      {workspace.isDemo && (
        <div className="demo-notice shell-width">
          <DemoBadge>Preview mode</DemoBadge>
          <span>
            {workspace.isAuthenticated
              ? "These are sample deliveries. No orders are linked to this account yet."
              : "These Yangon deliveries are sample records. Sign in to follow orders linked to your account."}
          </span>
          {!workspace.isAuthenticated && (
            <button type="button" onClick={() => setAuthOpen(true)}>
              Sign in <Icon name="arrow-right" size={14} />
            </button>
          )}
        </div>
      )}

      {workspace.error && (
        <div className="error-notice shell-width" role="alert">
          <Icon name="warning" size={17} /> {workspace.error}
          <button type="button" onClick={() => void workspace.refresh()}>
            Try again
          </button>
        </div>
      )}

      {selectedOrder ? (
        <section
          className="tracking-layout shell-width"
          id="tracking"
          aria-label="Selected delivery"
        >
          <div className="tracking-map-column">
            <div className="selected-order-kicker">
              <div>
                <Eyebrow>Tracking number</Eyebrow>
                <strong>{selectedOrder.tracking_code}</strong>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>
            <LocationMap
              order={selectedOrder}
              mode="customer"
              isDemo={workspace.isDemo}
              tall
            />
            <div className="map-underbar">
              <div className="map-underbar-icon">
                <Icon name="track" size={18} />
              </div>
              <div>
                <strong>{locationHeading}</strong>
                <span>{locationDescription}</span>
              </div>
              <span className="map-underbar-arrow">
                <Icon name="arrow-right" size={17} />
              </span>
            </div>
          </div>

          <aside className="tracking-side-column">
            <div className="eta-panel">
              <div className="eta-head">
                <span className="eta-label">
                  {selectedOrder.status === "delivered"
                    ? "Delivery complete"
                    : "Estimated arrival"}
                </span>
                <span className="eta-icon">
                  <Icon name="navigation" size={17} />
                </span>
              </div>
              <div className="eta-time">{etaCopy(selectedOrder)}</div>
              <p>
                {selectedOrder.status === "delivered"
                  ? deliveredEvent
                    ? `Delivered ${formatDateTime(deliveredEvent.created_at)} · Yangon time`
                    : "Delivery confirmed · completion time unavailable"
                  : selectedOrder.status === "failed" ||
                      selectedOrder.status === "cancelled"
                    ? "See the latest delivery status below."
                    : selectedOrder.estimated_delivery_at
                      ? `Around ${formatDateTime(selectedOrder.estimated_delivery_at)} · Yangon time`
                      : "An arrival estimate is being arranged."}
              </p>
              {selectedOrder.eta_updated_at &&
                !["delivered", "failed", "cancelled"].includes(
                  selectedOrder.status,
                ) && (
                  <div className="eta-intelligence-note">
                    <span>
                      {selectedOrder.eta_confidence ?? "low"} confidence
                    </span>
                    {selectedOrder.traffic_delay_minutes > 0
                      ? `Verified road conditions add about ${selectedOrder.traffic_delay_minutes} min.`
                      : "Updated from the rider’s route progress."}
                  </div>
                )}
              <div className="eta-meter">
                <span
                  style={{
                    width:
                      selectedOrder.status === "delivered"
                        ? "100%"
                        : selectedOrder.route_progress_percent != null
                          ? `${selectedOrder.route_progress_percent}%`
                          : selectedOrder.status === "in_transit"
                            ? "72%"
                            : selectedOrder.status === "picked_up"
                              ? "56%"
                              : selectedOrder.status === "accepted"
                                ? "32%"
                                : "18%",
                  }}
                />
              </div>
              <div className="eta-meter-labels">
                <span>Collected</span>
                <span>At your door</span>
              </div>
            </div>

            <div className="order-route-card">
              <div className="route-address-row">
                <span className="address-marker pickup-marker">
                  <Icon name="box" size={14} />
                </span>
                <div>
                  <small>From</small>
                  <strong>{selectedOrder.pickup_address}</strong>
                </div>
              </div>
              <div className="address-connector" />
              <div className="route-address-row">
                <span className="address-marker destination-marker">
                  <Icon name="location" size={14} />
                </span>
                <div>
                  <small>To</small>
                  <strong>{selectedOrder.delivery_address}</strong>
                </div>
              </div>
            </div>

            <div className="tracking-timeline-card">
              <div className="section-head-inline">
                <h2>Delivery progress</h2>
                <span>Live updates</span>
              </div>
              <div className="progress-timeline">
                {STATUS_STEPS.map((step, index) => {
                  const activeIndex = STATUS_STEPS.indexOf(
                    selectedOrder.status as (typeof STATUS_STEPS)[number],
                  );
                  const completed =
                    selectedOrder.status === "delivered" ||
                    (activeIndex >= 0 && index <= activeIndex);
                  const event = workspace.data.statusEvents.find(
                    (item) =>
                      item.order_id === selectedOrder.id &&
                      item.status === step,
                  );
                  return (
                    <div
                      className={`timeline-step ${completed ? "is-complete" : ""} ${selectedOrder.status === step ? "is-current" : ""}`}
                      key={step}
                    >
                      <span className="timeline-dot">
                        {completed ? (
                          <Icon name="check" size={12} strokeWidth={2.4} />
                        ) : (
                          <span />
                        )}
                      </span>
                      <div>
                        <strong>{STATUS_LABELS[step]}</strong>
                        <small>
                          {event
                            ? formatDateTime(event.created_at)
                            : completed
                              ? "Completed"
                              : "Up next"}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rider-card">
              <div className="rider-avatar">
                <Icon name="user" size={21} />
              </div>
              <div className="rider-card-copy">
                <small>Your rider</small>
                <strong>
                  {selectedOrder.driver_name ?? "Finding your rider"}
                </strong>
                <span>
                  {selectedOrder.vehicle_label ??
                    (selectedOrder.driver_id
                      ? "On a delivery route"
                      : "Assigned before pickup")}
                </span>
              </div>
              {selectedOrder.driver_phone && selectedOrder.latest_location && (
                <a
                  className="rider-call"
                  href={`tel:${selectedOrder.driver_phone}`}
                  aria-label="Call your rider"
                >
                  <Icon name="user" size={17} />
                </a>
              )}
            </div>

            {selectedOrder.cod_amount > 0 && (
              <div className="cod-card">
                <span className="cod-icon">
                  <Icon name="coin" size={18} />
                </span>
                <div>
                  <small>Cash on delivery</small>
                  <strong>{currency.format(selectedOrder.cod_amount)}</strong>
                </div>
                <span
                  className={`cod-state ${selectedOrder.cod_status === "collected" || selectedOrder.cod_status === "settled" ? "cod-paid" : ""}`}
                >
                  {selectedOrder.cod_status === "collected" ||
                  selectedOrder.cod_status === "settled"
                    ? "COD collected"
                    : "COD due"}
                </span>
              </div>
            )}
          </aside>
        </section>
      ) : (
        <div className="empty-state shell-width">
          <span className="empty-icon">
            <Icon name="package" size={24} />
          </span>
          <h2>No deliveries to track yet</h2>
          <p>
            When an order is connected to your account, it will appear here.
          </p>
        </div>
      )}

      <section className="delivery-list shell-width" id="history">
        <div className="section-head-block">
          <div>
            <h2>{showAll ? "All deliveries" : "Recent deliveries"}</h2>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show recent" : "See all"}
            <Icon name="arrow-right" size={15} />
          </button>
        </div>
        <div className="delivery-order-grid">
          {(showAll ? orders : orders.slice(0, 3)).map((order) => (
            <button
              key={order.id}
              className={`delivery-order-card ${selectedOrder?.id === order.id ? "is-selected" : ""}`}
              type="button"
              onClick={() => setSelectedId(order.id)}
            >
              <div className="delivery-order-top">
                <span className="order-code">{order.tracking_code}</span>
                <Icon name="arrow-right" size={16} />
              </div>
              <strong>{order.delivery_address}</strong>
              <div className="delivery-order-bottom">
                <StatusBadge status={order.status} />
                <span>
                  {order.status === "in_transit" || order.status === "picked_up"
                    ? `ETA ${timeUntil(order.estimated_delivery_at)}`
                    : formatTime(order.estimated_delivery_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <footer className="customer-footer shell-width" id="account">
        <Brand />
        <span>Every parcel deserves a clear path home.</span>
        <div className="workspace-links">
          <a href="/rider">
            Rider workspace <Icon name="arrow-right" size={13} />
          </a>
          <a href="/manager">
            Operations <Icon name="arrow-right" size={13} />
          </a>
        </div>
      </footer>
      <MobileNav label="Customer app" items={customerNavItems} />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
