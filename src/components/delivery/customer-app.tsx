"use client";

import HomeOutlined from "@mui/icons-material/HomeOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  Brand,
  Eyebrow,
  LoadingBlock,
  StatusBadge,
  signOut,
} from "@/components/delivery/common";
import {
  CodSheet,
  CustomerHome,
  CustomerTopBar,
  DemoChip,
  HelpSheet,
  HomeSkeleton,
  NotificationsSheet,
  ParcelSwitcher,
  ScanSheet,
  TrackingLookup,
  TrackLookupNotice,
} from "@/components/delivery/customer-home";
import { CustomerProviderTracking } from "@/components/delivery/customer-provider-tracking";
import { Icon } from "@/components/delivery/icons";
import { LocationMap } from "@/components/delivery/location-map";
import {
  buildNotifications,
  codDue,
  homeSummary,
  matchOrders,
  normaliseCode,
  pickNextParcel,
  rememberTrackingCode,
} from "@/lib/delivery/customer-home";
import {
  currency,
  formatDateTime,
  formatTime,
  nextCustomerAction,
  prioritiseOrders,
  relativeUpdatedAt,
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
  { id: "home", label: "Home", href: "/home", icon: "home" },
  { id: "track", label: "Track", href: "/track", icon: "track" },
  { id: "orders", label: "Orders", href: "/orders", icon: "list" },
  { id: "profile", label: "Profile", href: "/profile", icon: "user" },
] as const;

type OrderFilter = "all" | "active" | "delivered" | "issues";
const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "delivered", label: "Delivered" },
  { id: "issues", label: "Issues" },
];
const ACTIVE_ORDER_STATUSES = [
  "pending",
  "assigned",
  "accepted",
  "picked_up",
  "in_transit",
];
function matchesOrderFilter(order: DeliveryOrder, filter: OrderFilter) {
  if (filter === "all") return true;
  if (filter === "active") return ACTIVE_ORDER_STATUSES.includes(order.status);
  if (filter === "delivered") return order.status === "delivered";
  return order.status === "failed" || order.status === "cancelled";
}

const customerNavIcons = {
  home: HomeOutlined,
  track: LocalShippingOutlined,
  orders: ReceiptLongOutlined,
  profile: PersonOutlined,
} as const;

/** Material 2 bottom navigation: 56dp bar, elevation 8, labels always shown. */
function CustomerBottomNav({ activeId }: { activeId: string }) {
  return (
    <BottomNavigation
      showLabels
      value={activeId}
      aria-label="Customer app"
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        marginInline: "auto",
        maxWidth: 430,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        height: "calc(56px + env(safe-area-inset-bottom))",
        pb: "env(safe-area-inset-bottom)",
        boxShadow: (theme) => theme.shadows[8],
        "& .MuiBottomNavigationAction-root": { minWidth: 0, maxWidth: "none" },
      }}
    >
      {customerNavItems
        .filter((item) => item.id !== "track")
        .map((item) => {
          const NavIcon = customerNavIcons[item.id];
          return (
            <BottomNavigationAction
              key={item.id}
              component={Link}
              href={item.href}
              value={item.id}
              label={item.label}
              icon={<NavIcon />}
              aria-current={activeId === item.id ? "page" : undefined}
            />
          );
        })}
    </BottomNavigation>
  );
}

export type CustomerView = (typeof customerNavItems)[number]["id"];

export function CustomerApp({ view }: { view: CustomerView }) {
  const workspace = useWorkspace("customer");
  const [selectedId, setSelectedId] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(0);
  const router = useRouter();
  const [sheet, setSheet] = useState<
    "notifications" | "help" | "scan" | "cod" | null
  >(null);
  const [readUpTo, setReadUpTo] = useState<number | null>(null);
  const [unreadIds, setUnreadIds] = useState<ReadonlySet<string>>(new Set());
  const [demoDismissed, setDemoDismissed] = useState(false);
  const [lookupMiss, setLookupMiss] = useState<string | null>(null);
  const urlHandled = useRef(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const orders = useMemo(
    () => prioritiseOrders(workspace.data.orders),
    [workspace.data.orders],
  );
  // Sample records are for previews only; they never count as account data.
  const realOrders = useMemo(
    () => (workspace.isDemo ? [] : orders),
    [orders, workspace.isDemo],
  );
  const selectedOrder =
    orders.find((order) => order.id === selectedId) ?? orders[0] ?? null;
  const visibleOrders = orders.filter((order) =>
    matchesOrderFilter(order, orderFilter),
  );
  const profileId = workspace.profile?.id ?? "guest";
  const readKey = `oern.notifications.readAt.${profileId}`;
  const notifications = useMemo(
    () => buildNotifications(realOrders, workspace.data.statusEvents, now),
    [realOrders, workspace.data.statusEvents, now],
  );
  const unreadCount =
    readUpTo === null || !workspace.isAuthenticated
      ? 0
      : notifications.filter((item) => Date.parse(item.at) > readUpTo).length;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(readKey);
      setReadUpTo(stored ? Number(stored) || 0 : 0);
    } catch {
      setReadUpTo(0);
    }
  }, [readKey]);

  // The welcome screen's "I already have an account" button links here with
  // ?signin=1 so the dialog opens right away; drop the flag from the URL
  // once read so a refresh doesn't reopen it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") !== "1") return;
    setAuthOpen(true);
    params.delete("signin");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, []);

  useEffect(() => {
    try {
      setDemoDismissed(
        window.sessionStorage.getItem("oern.demo-notice.dismissed") === "1",
      );
    } catch {
      // Storage can be blocked; the notice simply stays visible.
    }
  }, []);

  // Runs once, when the data first arrives, to apply ?order= and ?code=.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot URL handling
  useEffect(() => {
    if (urlHandled.current || workspace.isLoading) return;
    urlHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedOrder = params.get("order");
    if (requestedOrder && orders.some((order) => order.id === requestedOrder))
      setSelectedId(requestedOrder);
    const code = params.get("code");
    if (code) lookupCode(code);
  }, [orders, workspace.isLoading]);

  function lookupCode(value: string) {
    const code = value.trim();
    if (!normaliseCode(code)) return;
    const hits = matchOrders(realOrders, code);
    const hit =
      hits.find(
        (order) => normaliseCode(order.tracking_code) === normaliseCode(code),
      ) ?? (hits.length === 1 ? hits[0] : null);
    if (hit) {
      setSelectedId(hit.id);
      setLookupMiss(null);
      rememberTrackingCode(hit.tracking_code);
    } else {
      setLookupMiss(code);
    }
  }

  function openNotifications() {
    setUnreadIds(
      new Set(
        notifications
          .filter((item) => Date.parse(item.at) > (readUpTo ?? 0))
          .map((item) => item.id),
      ),
    );
    setSheet("notifications");
    const stamp = Date.now();
    setReadUpTo(stamp);
    try {
      window.localStorage.setItem(readKey, String(stamp));
    } catch {
      // Unread state just won't persist.
    }
  }

  function dismissDemo() {
    setDemoDismissed(true);
    try {
      window.sessionStorage.setItem("oern.demo-notice.dismissed", "1");
    } catch {
      // Nothing to persist.
    }
  }

  const handleScanned = useCallback(
    (code: string) => {
      setSheet(null);
      router.push(`/track?code=${encodeURIComponent(code)}`);
    },
    [router],
  );

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
    ? "Simulated tracking"
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
    ? "A sample route for illustration only. Times shown are estimates, not a real delivery. Sign in to follow your own parcel."
    : locationState === "live"
      ? "Location points update automatically while the rider keeps their app open."
      : locationState === "closed"
        ? "Your delivery’s final status remains available below."
        : locationState === "stale"
          ? "A fresh GPS point has not arrived yet. The rider may have lost connection."
          : selectedOrder && hasCollectedParcel(selectedOrder.status)
            ? "Your parcel is collected. The map will update when your rider shares a GPS point."
            : "Your rider’s location becomes available after they receive the parcel.";

  if (workspace.isLoading || now === 0) {
    if (view !== "home")
      return <LoadingBlock title="Opening your delivery view…" />;
    return (
      <main className="customer-app">
        <CustomerTopBar
          profile={workspace.profile}
          isAuthenticated={workspace.isAuthenticated}
          unreadCount={0}
          summary={null}
          onSignIn={() => setAuthOpen(true)}
          onOpenNotifications={() => undefined}
        />
        <HomeSkeleton />
        <CustomerBottomNav activeId={view} />
      </main>
    );
  }

  return (
    <main className="customer-app">
      <CustomerTopBar
        profile={workspace.profile}
        isAuthenticated={workspace.isAuthenticated}
        unreadCount={unreadCount}
        summary={homeSummary(realOrders)}
        onSignIn={() => setAuthOpen(true)}
        onOpenNotifications={openNotifications}
      />

      {workspace.isDemo && view !== "home" && !demoDismissed && (
        <DemoChip onDismiss={dismissDemo} />
      )}

      {workspace.error && (
        <div className="error-notice shell-width" role="alert">
          <Icon name="warning" size={17} /> {workspace.error}
          <button type="button" onClick={() => void workspace.refresh()}>
            Try again
          </button>
        </div>
      )}

      {view === "home" && (
        <CustomerHome
          orders={realOrders}
          statusEvents={workspace.data.statusEvents}
          isAuthenticated={workspace.isAuthenticated}
          now={now}
          onSignIn={() => setAuthOpen(true)}
          onOpenCod={() => setSheet("cod")}
          onOpenHelp={() => setSheet("help")}
        />
      )}

      {view === "track" && (
        <>
          <h1 className="sr-only">Track</h1>
          <TrackingLookup
            onLookup={lookupCode}
            onOpenScan={() => setSheet("scan")}
          />
          {lookupMiss && (
            <TrackLookupNotice
              code={lookupMiss}
              isAuthenticated={workspace.isAuthenticated}
              onSignIn={() => setAuthOpen(true)}
            />
          )}
          {!lookupMiss && (
            <ParcelSwitcher
              orders={orders}
              selectedId={selectedOrder?.id ?? ""}
              onSelect={(order) => setSelectedId(order.id)}
            />
          )}
        </>
      )}

      {view === "track" &&
        !lookupMiss &&
        (selectedOrder ? (
          <section
            className="tracking-layout shell-width"
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
                      : workspace.isDemo
                        ? "Estimated arrival · sample"
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
                <div className="tracking-freshness-row">
                  <span>
                    {relativeUpdatedAt(
                      selectedOrder.latest_location?.recorded_at ??
                        selectedOrder.eta_updated_at,
                      now,
                    )}
                  </span>
                  <strong>
                    {nextCustomerAction(
                      selectedOrder.status,
                      selectedOrder.traffic_delay_minutes > 0,
                    )}
                  </strong>
                </div>
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
                {selectedOrder.driver_phone &&
                  selectedOrder.latest_location && (
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
        ))}

      {view === "orders" && (
        <section className="delivery-list shell-width" id="history">
          <div className="section-head-block">
            <div>
              <h2>{showAll ? "All deliveries" : "Your deliveries"}</h2>
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
          <nav className="orders-filter" aria-label="Filter deliveries">
            {ORDER_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={orderFilter === item.id}
                onClick={() => setOrderFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          {visibleOrders.length === 0 && (
            <p className="orders-empty">No deliveries in this group.</p>
          )}
          <div className="delivery-order-grid">
            {(showAll ? visibleOrders : visibleOrders.slice(0, 3)).map(
              (order) => (
                <Link
                  key={order.id}
                  className={`delivery-order-card ${selectedOrder?.id === order.id ? "is-selected" : ""}`}
                  href={`/track?order=${encodeURIComponent(order.id)}`}
                >
                  <div className="delivery-order-top">
                    <span className="order-code">{order.tracking_code}</span>
                    <Icon name="arrow-right" size={16} />
                  </div>
                  <strong>{order.delivery_address}</strong>
                  <div className="delivery-order-bottom">
                    <StatusBadge status={order.status} />
                    <span>
                      {order.status === "in_transit" ||
                      order.status === "picked_up"
                        ? `ETA ${timeUntil(order.estimated_delivery_at)}`
                        : formatTime(order.estimated_delivery_at)}
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>
        </section>
      )}

      {view === "orders" && <CustomerProviderTracking />}

      {view === "profile" && (
        <section className="customer-profile-page shell-width">
          <div className="customer-profile-card">
            <span className="customer-profile-avatar">
              <PersonOutlined />
            </span>
            <div>
              <Eyebrow>Account</Eyebrow>
              <h1>{workspace.profile?.full_name || "Guest"}</h1>
              <p>
                {workspace.isAuthenticated
                  ? (workspace.profile?.phone ?? "No phone number on file")
                  : "Sign in to manage your account."}
              </p>
            </div>
          </div>
          {!workspace.isAuthenticated && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => setAuthOpen(true)}
            >
              Sign in to your account <Icon name="arrow-right" size={16} />
            </button>
          )}
          <div className="customer-profile-links">
            <button type="button" onClick={() => setSheet("notifications")}>
              <Icon name="bell" size={18} />
              <span>
                <strong>Notifications</strong>
                <small>Delivery updates and alerts</small>
              </span>
              <Icon name="arrow-right" size={16} />
            </button>
            <button type="button" onClick={() => setSheet("help")}>
              <Icon name="help" size={18} />
              <span>
                <strong>Help and support</strong>
                <small>Report a problem with a parcel</small>
              </span>
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
          {workspace.isAuthenticated && (
            <button
              className="button button-outline"
              type="button"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          )}
        </section>
      )}

      {view !== "home" && (
        <footer className="customer-footer shell-width">
          <Brand href="/home" />
          <span>Every parcel deserves a clear path home.</span>
          <div className="workspace-links">
            <a href="/rider/route">
              Rider workspace <Icon name="arrow-right" size={13} />
            </a>
            <a href="/manager">
              Operations <Icon name="arrow-right" size={13} />
            </a>
          </div>
        </footer>
      )}
      <CustomerBottomNav activeId={view} />
      <NotificationsSheet
        open={sheet === "notifications"}
        notifications={notifications}
        unreadIds={unreadIds}
        isAuthenticated={workspace.isAuthenticated}
        onSignIn={() => setAuthOpen(true)}
        onClose={() => setSheet(null)}
      />
      <HelpSheet
        open={sheet === "help"}
        order={pickNextParcel(realOrders)}
        onClose={() => setSheet(null)}
      />
      <ScanSheet
        open={sheet === "scan"}
        onClose={() => setSheet(null)}
        onDetected={handleScanned}
      />
      <CodSheet
        open={sheet === "cod"}
        orders={codDue(realOrders)}
        onClose={() => setSheet(null)}
      />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
