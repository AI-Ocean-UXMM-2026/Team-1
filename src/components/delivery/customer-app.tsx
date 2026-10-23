"use client";

import Button from "@mui/material/Button";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import { signOut } from "@/components/delivery/common";
import {
  CodSheet,
  CustomerHeader,
  CustomerHome,
  DemoChip,
  HelpSheet,
  HomeSkeleton,
  NotificationsPage,
  ParcelSwitcher,
  TrackingLookup,
  TrackLookupNotice,
} from "@/components/delivery/customer-home";

const ScanSheet = dynamic(
  () => import("@/components/delivery/scan-sheet").then((mod) => mod.ScanSheet),
  { ssr: false },
);

import { OrdersPage } from "@/components/delivery/customer-orders";
import {
  CustomerBottomNav,
  EmptyState,
} from "@/components/delivery/customer-pages";
import { ProfilePage } from "@/components/delivery/customer-profile";
import { ConfirmSheet } from "@/components/delivery/customer-sheet";
import { Icon } from "@/components/delivery/icons";
import { TrackDetail } from "@/components/delivery/track-detail";
import { useBackNavigation } from "@/components/delivery/use-back-navigation";
import {
  buildNotifications,
  type CustomerNotification,
  codDue,
  homeSummary,
  isActiveStatus,
  isTerminalStatus,
  matchOrders,
  normaliseCode,
  rememberTrackingCode,
} from "@/lib/delivery/customer-home";
import { prioritiseOrders } from "@/lib/delivery/format";
import {
  fromTrackingPayload,
  type PublicTracking,
} from "@/lib/delivery/public-tracking";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

export type CustomerView =
  | "home"
  | "track"
  | "orders"
  | "profile"
  | "notifications";

type ReadState = { upTo: number; ids: string[] };

/**
 * Applies ?order= and ?code= whenever they change. Notifications, scans and
 * Help links can all navigate to /track while it is already open, and each
 * must switch to that parcel.
 */
function UrlSelection({
  ready,
  orders,
  onOrder,
  onCode,
}: {
  ready: boolean;
  orders: { id: string }[];
  onOrder: (id: string) => void;
  onCode: (code: string) => void;
}) {
  const params = useSearchParams();
  const key = params.toString();
  const applied = useRef("");
  useEffect(() => {
    if (!ready || !key || applied.current === key) return;
    applied.current = key;
    const requested = params.get("order");
    if (requested) {
      if (orders.some((order) => order.id === requested)) {
        onOrder(requested);
      } else {
        onCode(requested);
      }
    }
    const code = params.get("code");
    if (code) onCode(code);
  }, [ready, key, params, orders, onOrder, onCode]);
  return null;
}

export function CustomerApp({ view }: { view: CustomerView }) {
  const workspace = useWorkspace("customer");
  const [selectedId, setSelectedId] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [now, setNow] = useState(0);
  const router = useRouter();
  const [sheet, setSheet] = useState<"help" | "scan" | "cod" | null>(null);
  const [readState, setReadState] = useState<ReadState | null>(null);
  const [demoDismissed, setDemoDismissed] = useState(false);
  const [lookupMiss, setLookupMiss] = useState<string | null>(null);
  const [publicHit, setPublicHit] = useState<PublicTracking | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const orders = useMemo(
    () => prioritiseOrders(workspace.data.orders),
    [workspace.data.orders],
  );
  // Sample records are for previews only; they never count as account data.
  const realOrders = useMemo(
    () => (workspace.isDemo ? [] : orders),
    [orders, workspace.isDemo],
  );
  // Track shows a parcel only once one is chosen (link, lookup or chip);
  // falling back to "some order" put an unrelated parcel under the search box.
  const selectedOrder =
    publicHit && publicHit.order.id === selectedId
      ? publicHit.order
      : (orders.find((order) => order.id === selectedId) ?? null);
  // Opened from a parcel link (Home, Orders, notifications): a detail page,
  // not a search page.
  const [linkedOrder, setLinkedOrder] = useState(false);
  const trackEvents = publicHit
    ? [...workspace.data.statusEvents, ...publicHit.events]
    : workspace.data.statusEvents;
  const profileId = workspace.profile?.id ?? "guest";
  const readKey = `oern.notifications.read.${profileId}`;
  const notifications = useMemo(
    () => buildNotifications(realOrders, workspace.data.statusEvents, now),
    [realOrders, workspace.data.statusEvents, now],
  );
  const isUnread = useCallback(
    (item: CustomerNotification) =>
      readState !== null &&
      Date.parse(item.at) > readState.upTo &&
      !readState.ids.includes(item.id),
    [readState],
  );
  const unreadCount = workspace.isAuthenticated
    ? notifications.filter(isUnread).length
    : 0;

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        window.localStorage.getItem(readKey) ?? "null",
      );
      const value = stored as Partial<ReadState> | null;
      setReadState({
        upTo: typeof value?.upTo === "number" ? value.upTo : 0,
        ids: Array.isArray(value?.ids)
          ? value.ids.filter((id): id is string => typeof id === "string")
          : [],
      });
    } catch {
      setReadState({ upTo: 0, ids: [] });
    }
  }, [readKey]);

  function saveReadState(next: ReadState) {
    setReadState(next);
    try {
      window.localStorage.setItem(readKey, JSON.stringify(next));
    } catch {
      // Read state just won't persist.
    }
  }

  function markRead(id: string) {
    const current = readState ?? { upTo: 0, ids: [] };
    if (current.ids.includes(id)) return;
    // Only ids newer than the "all read" mark need remembering.
    saveReadState({
      upTo: current.upTo,
      ids: [...current.ids, id].slice(-100),
    });
  }

  function markAllRead() {
    // Never behind the newest update, even if the server clock runs ahead.
    const newest = Math.max(
      Date.now(),
      ...notifications.map((item) => Date.parse(item.at)),
    );
    saveReadState({ upTo: newest, ids: [] });
  }

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

  /**
   * Keep the selected parcel in the URL so a refresh, a back gesture or a
   * shared link lands on the same record. replaceState avoids a router
   * navigation that would re-run UrlSelection.
   */
  function syncTrackUrl(next: { order?: string; code?: string } | null) {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/track") return;
    const params = new URLSearchParams();
    if (next?.order) params.set("order", next.order);
    if (next?.code) params.set("code", next.code);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }

  const fetchPublicTracking = useCallback(async (code: string) => {
    try {
      const { data, error } = await createClient().rpc("track_delivery", {
        code,
      });
      return error ? null : fromTrackingPayload(data);
    } catch {
      return null;
    }
  }, []);

  /**
   * Your own parcels match locally; any other code is looked up by its exact
   * value, so tracking works without an account.
   */
  async function lookupCode(value: string, linked = false, keepUrl = false) {
    const code = value.trim();
    if (!normaliseCode(code)) return;
    const hits = matchOrders(realOrders, code);
    const hit =
      hits.find(
        (order) => normaliseCode(order.tracking_code) === normaliseCode(code),
      ) ?? (hits.length === 1 ? hits[0] : null);
    if (hit) {
      setPublicHit(null);
      setSelectedId(hit.id);
      setLookupMiss(null);
      if (linked) setLinkedOrder(true);
      rememberTrackingCode(hit.tracking_code);
      if (!keepUrl) syncTrackUrl({ order: hit.id });
      return;
    }
    const found = await fetchPublicTracking(code);
    if (found) {
      setPublicHit(found);
      setSelectedId(found.order.id);
      setLookupMiss(null);
      if (linked) setLinkedOrder(true);
      rememberTrackingCode(found.order.tracking_code);
      if (!keepUrl) syncTrackUrl({ code: found.order.tracking_code });
      return;
    }
    setLookupMiss(code);
    if (!keepUrl) syncTrackUrl(null);
  }

  /** Back out of a parcel to the lookup, and drop its URL state. */
  function clearSelection() {
    setSelectedId("");
    setPublicHit(null);
    setLookupMiss(null);
    setLinkedOrder(false);
    syncTrackUrl(null);
  }

  /**
   * One refresh control for every tracking path: re-read the public record,
   * or re-sync the signed-in workspace. The selected parcel stays put.
   */
  async function refreshTracking() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (publicHit) {
        const found = await fetchPublicTracking(publicHit.order.tracking_code);
        if (found) setPublicHit(found);
      } else if (workspace.isAuthenticated) {
        await workspace.refresh(true);
      }
    } finally {
      setRefreshing(false);
    }
  }

  // Guests have no Realtime subscription, so a public parcel keeps itself
  // current while its tab is visible. Both paths stop at a terminal status.
  useEffect(() => {
    const code = publicHit?.order.tracking_code;
    const status = publicHit?.order.status;
    if (!code || !status || isTerminalStatus(status)) return;
    let cancelled = false;
    let inFlight = false;
    const tick = async () => {
      if (cancelled || inFlight) return;
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      inFlight = true;
      const found = await fetchPublicTracking(code);
      inFlight = false;
      if (!cancelled && found) setPublicHit(found);
    };
    const interval = window.setInterval(() => void tick(), 20_000);
    const wake = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [
    fetchPublicTracking,
    publicHit?.order.status,
    publicHit?.order.tracking_code,
  ]);

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
    setNow(Date.now());
    if (view !== "home" && view !== "track") return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [view]);

  const showsDemo = workspace.isDemo && !publicHit;

  const goBack = useBackNavigation(
    view === "track" && linkedOrder ? "/orders" : "/home",
  );
  const trackDetailOnly =
    view === "track" && (linkedOrder || Boolean(selectedId)) && !!selectedOrder;
  const isRootTab = view === "home" || view === "orders" || view === "profile";
  // Help follows the parcel on screen. Elsewhere it only assumes a parcel
  // when there is exactly one in progress; otherwise the sheet asks which.
  const liveOrders = realOrders.filter((order) => isActiveStatus(order.status));
  const helpOrder =
    view === "track"
      ? selectedOrder
      : liveOrders.length === 1
        ? liveOrders[0]
        : null;
  const firstName = workspace.profile?.full_name?.split(" ")[0];
  const header = {
    home: {
      title:
        workspace.isAuthenticated && firstName ? `Hi, ${firstName}` : "Welcome",
      subtitle: workspace.isAuthenticated
        ? homeSummary(realOrders)
        : "Track and send parcels in Yangon",
    },
    track:
      trackDetailOnly && selectedOrder
        ? { title: selectedOrder.tracking_code, subtitle: undefined }
        : { title: "Track a parcel", subtitle: undefined },
    orders: { title: "Orders", subtitle: undefined },
    profile: { title: "Profile", subtitle: undefined },
    notifications: { title: "Notifications", subtitle: undefined },
  }[view];

  async function confirmSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    const failure = await signOut();
    // On success the page navigates away; only a failure comes back here.
    if (failure) {
      setSignOutError(`We couldn’t sign you out. ${failure}`);
      setSigningOut(false);
    }
  }

  // Keep the page's own header and tab bar while loading so nothing jumps.
  if (workspace.isLoading || now === 0)
    return (
      <main className="customer-app">
        <CustomerHeader
          title={view === "home" ? "Home" : header.title}
          isAuthenticated={false}
          unreadCount={0}
          showBell={false}
          onBack={isRootTab ? undefined : goBack}
        />
        <HomeSkeleton />
        {isRootTab && <CustomerBottomNav activeId={view} />}
      </main>
    );

  return (
    <main
      className={`customer-app ${view === "track" && selectedOrder ? "is-track-mode" : ""}`}
    >
      <Suspense fallback={null}>
        <UrlSelection
          ready={!workspace.isLoading}
          orders={orders}
          onOrder={(id) => {
            setSelectedId(id);
            setLinkedOrder(true);
          }}
          onCode={(code) => void lookupCode(code, true, true)}
        />
      </Suspense>
      <CustomerHeader
        title={header.title}
        subtitle={header.subtitle}
        isAuthenticated={workspace.isAuthenticated}
        unreadCount={unreadCount}
        onBack={
          isRootTab
            ? undefined
            : view === "track" && !linkedOrder && selectedOrder
              ? clearSelection
              : goBack
        }
        showBell={view === "home" || view === "orders"}
        action={
          view === "notifications" && unreadCount > 0 ? (
            <Button
              color="secondary"
              onClick={markAllRead}
              sx={{ minHeight: 48, fontWeight: 700, flex: "none" }}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {workspace.isDemo &&
        (view === "orders" || (view === "track" && !publicHit)) &&
        !demoDismissed && <DemoChip onDismiss={dismissDemo} />}

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
          {!trackDetailOnly && (
            <>
              <TrackingLookup
                onLookup={(code) => void lookupCode(code)}
                onOpenScan={() => setSheet("scan")}
              />
              {lookupMiss && <TrackLookupNotice code={lookupMiss} />}
              {!lookupMiss && !publicHit && (
                <ParcelSwitcher
                  orders={orders}
                  selectedId={selectedOrder?.id ?? ""}
                  onSelect={(order) => {
                    setPublicHit(null);
                    setSelectedId(order.id);
                    setLinkedOrder(false);
                    syncTrackUrl({ order: order.id });
                  }}
                />
              )}
            </>
          )}
          {!lookupMiss &&
            (selectedOrder ? (
              <TrackDetail
                order={selectedOrder}
                events={trackEvents}
                isDemo={showsDemo}
                now={now}
                onOpenHelp={() => setSheet("help")}
                onRefresh={showsDemo ? undefined : () => void refreshTracking()}
                refreshing={refreshing}
                onTrackAnother={clearSelection}
              />
            ) : (
              <EmptyState
                illustration="/icons/track-parcel.svg"
                title="Follow any parcel"
                body={
                  orders.length > 0
                    ? "Enter a tracking code, or pick one of your parcels above."
                    : "Enter the tracking code from your receipt or message. No account needed."
                }
              />
            ))}
        </>
      )}

      {view === "orders" && (
        <Suspense fallback={<HomeSkeleton />}>
          <OrdersPage
            orders={orders}
            events={workspace.data.statusEvents}
            isAuthenticated={workspace.isAuthenticated}
            onSignIn={() => setAuthOpen(true)}
          />
        </Suspense>
      )}

      {view === "profile" && (
        <ProfilePage
          name={workspace.profile?.full_name ?? null}
          phone={workspace.profile?.phone ?? null}
          isAuthenticated={workspace.isAuthenticated}
          unreadCount={unreadCount}
          historyCount={
            realOrders.filter((order) => isTerminalStatus(order.status)).length
          }
          onSignIn={() => setAuthOpen(true)}
          onSignOut={() => {
            setSignOutError(null);
            setSignOutOpen(true);
          }}
          onOpenHelp={() => setSheet("help")}
        />
      )}

      {view === "notifications" && (
        <NotificationsPage
          notifications={notifications}
          isUnread={isUnread}
          isAuthenticated={workspace.isAuthenticated}
          now={now}
          onOpen={markRead}
          onSignIn={() => setAuthOpen(true)}
        />
      )}

      {isRootTab && <CustomerBottomNav activeId={view} />}
      <HelpSheet
        open={sheet === "help"}
        order={helpOrder}
        orders={realOrders}
        requesterId={
          workspace.isAuthenticated ? (workspace.profile?.id ?? null) : null
        }
        showStatusLink={view !== "track"}
        onSignIn={() => {
          setSheet(null);
          setAuthOpen(true);
        }}
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
      <ConfirmSheet
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        titleId="sign-out-title"
        title="Sign out of Oern?"
        body="You can sign back in at any time. Tracking by code still works without an account."
        confirmLabel="Sign out"
        pendingLabel="Signing out…"
        destructive
        pending={signingOut}
        error={signOutError}
        onConfirm={() => void confirmSignOut()}
      />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
