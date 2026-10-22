"use client";

import Button from "@mui/material/Button";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
  TrackDetail,
} from "@/components/delivery/customer-pages";
import { ProfilePage } from "@/components/delivery/customer-profile";
import { CustomerProviderTracking } from "@/components/delivery/customer-provider-tracking";
import { ConfirmSheet } from "@/components/delivery/customer-sheet";
import { Icon } from "@/components/delivery/icons";
import { useBackNavigation } from "@/components/delivery/use-back-navigation";
import {
  buildNotifications,
  type CustomerNotification,
  codDue,
  homeSummary,
  isTerminalStatus,
  matchOrders,
  normaliseCode,
  pickNextParcel,
  rememberTrackingCode,
} from "@/lib/delivery/customer-home";
import { prioritiseOrders } from "@/lib/delivery/format";
import {
  hasCollectedParcel,
  isRecentLocation,
  parcelLocationState,
} from "@/lib/delivery/location-state";
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
  const urlHandled = useRef(false);
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
    saveReadState({ upTo: Date.now(), ids: [] });
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

  // Runs once, when the data first arrives, to apply ?order= and ?code=.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot URL handling
  useEffect(() => {
    if (urlHandled.current || workspace.isLoading) return;
    urlHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedOrder = params.get("order");
    if (requestedOrder && orders.some((order) => order.id === requestedOrder)) {
      setSelectedId(requestedOrder);
      setLinkedOrder(true);
    }
    const code = params.get("code");
    if (code) void lookupCode(code);
  }, [orders, workspace.isLoading]);

  /**
   * Your own parcels match locally; any other code is looked up by its exact
   * value, so tracking works without an account.
   */
  async function lookupCode(value: string) {
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
      rememberTrackingCode(hit.tracking_code);
      return;
    }
    try {
      const { data, error } = await createClient().rpc("track_delivery", {
        code,
      });
      const found = error ? null : fromTrackingPayload(data);
      if (found) {
        setPublicHit(found);
        setSelectedId(found.order.id);
        setLookupMiss(null);
        rememberTrackingCode(found.order.tracking_code);
        return;
      }
    } catch {
      // Treated as not found below.
    }
    setLookupMiss(code);
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
    setNow(Date.now());
    if (view !== "home" && view !== "track") return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [view]);

  const locationState = parcelLocationState(selectedOrder, now);
  const showsDemo = workspace.isDemo && !publicHit;
  const locationHeading = showsDemo
    ? "Simulated tracking"
    : locationState === "live"
      ? "Your rider’s latest location"
      : locationState === "closed"
        ? "Location sharing has ended"
        : locationState === "stale"
          ? isRecentLocation(selectedOrder, now)
            ? "Your rider’s latest location"
            : "Showing the last known location"
          : selectedOrder && hasCollectedParcel(selectedOrder.status)
            ? "Waiting for the rider’s first location"
            : "Live location starts at pickup";
  const locationDescription = showsDemo
    ? "A sample route for illustration only. Enter your tracking code to follow your own parcel."
    : locationState === "live"
      ? "Location points update automatically while the rider keeps their app open."
      : locationState === "closed"
        ? "Your delivery’s final status remains available below."
        : locationState === "stale"
          ? isRecentLocation(selectedOrder, now)
            ? "The map refreshes on its own every few seconds."
            : "No new GPS point for a few minutes. The rider may have lost connection."
          : selectedOrder && hasCollectedParcel(selectedOrder.status)
            ? "Your parcel is collected. The map will update when your rider shares a GPS point."
            : "Your rider’s location becomes available after they receive the parcel.";

  const goBack = useBackNavigation(
    view === "track" && linkedOrder ? "/orders" : "/home",
  );
  const trackDetailOnly = view === "track" && linkedOrder && !!selectedOrder;
  const isRootTab = view === "home" || view === "orders" || view === "profile";
  const helpOrder =
    view === "track" ? selectedOrder : pickNextParcel(realOrders);
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
    <main className="customer-app">
      <CustomerHeader
        title={header.title}
        subtitle={header.subtitle}
        isAuthenticated={workspace.isAuthenticated}
        unreadCount={unreadCount}
        onBack={isRootTab ? undefined : goBack}
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
                  onSelect={(order) => setSelectedId(order.id)}
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
                locationHeading={locationHeading}
                locationDescription={locationDescription}
                onOpenHelp={() => setSheet("help")}
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
        <>
          <Suspense fallback={<HomeSkeleton />}>
            <OrdersPage
              orders={orders}
              events={workspace.data.statusEvents}
              isAuthenticated={workspace.isAuthenticated}
              onSignIn={() => setAuthOpen(true)}
            />
          </Suspense>
          <CustomerProviderTracking />
        </>
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
