"use client";

import "./rider-flow.css";

import type {
  FormEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  Brand,
  LoadingBlock,
  StatusBadge,
  signOut,
} from "@/components/delivery/common";
import { Icon, type IconName } from "@/components/delivery/icons";
import { type NavStop, RiderNavMap } from "@/components/delivery/rider-nav-map";
import {
  collectCod,
  type FailureReason,
  recordDeliveryOutcome,
  sendDriverLocation,
  setOrderStatus,
  submitRoadReport,
  updateVehicleEnergy,
} from "@/lib/delivery/actions";
import { assessEnergyRoute } from "@/lib/delivery/energy-routing";
import { currency, formatTime } from "@/lib/delivery/format";
import { watchRiderLocations } from "@/lib/delivery/rider-location";
import {
  bearingDegrees,
  buildRiderRoute,
  compassDirection,
  distanceKm,
  formatDistance,
  formatDuration,
  type GeoPoint,
  hasParcelOnBoard,
  legFor,
  summariseRoute,
} from "@/lib/delivery/rider-route";
import type {
  DeliveryOrder,
  DeliveryStatus,
  RoadReport,
  WorkspaceData,
} from "@/lib/delivery/types";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

type Screen =
  | "overview"
  | "start"
  | "navigate"
  | "outcome"
  | "result"
  | "complete";

type DevicePosition = GeoPoint & {
  heading: number | null;
  accuracy: number | null;
  at: number;
};

type GpsState = "off" | "waiting" | "live" | "stale" | "denied" | "unavailable";

type OutcomeDraft = {
  outcome: "delivered" | "failed" | null;
  recipientName: string;
  note: string;
  failureReason: FailureReason | null;
  /** null until the rider says whether cash changed hands. */
  codConfirmed: boolean | null;
  codAmount: string;
  codReason: string;
};

const EMPTY_DRAFT: OutcomeDraft = {
  outcome: null,
  recipientName: "",
  note: "",
  failureReason: null,
  codConfirmed: null,
  codAmount: "",
  codReason: "",
};

const FAILURE_REASONS: { id: FailureReason; label: string }[] = [
  { id: "recipient_unavailable", label: "Recipient unavailable" },
  { id: "incorrect_address", label: "Incorrect address" },
  { id: "recipient_refused", label: "Recipient refused delivery" },
  { id: "recipient_unreachable", label: "Unable to contact recipient" },
  { id: "other", label: "Other" },
];

const STALE_AFTER_MS = 60_000;
const ARRIVAL_RADIUS_KM = 0.08;

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing; drafts then live in memory only.
  }
}

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function mapsUrl(destination: string) {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: "1",
    destination,
    dir_action: "navigate",
  })}`;
}

function legDestination(order: DeliveryOrder) {
  const leg = legFor(order);
  return leg.point
    ? `${leg.point.latitude},${leg.point.longitude}`
    : leg.address;
}

function recipientLabel(order: DeliveryOrder) {
  return order.recipient_name || order.customer_name || "Recipient";
}

function CodBadge({ order }: { order: DeliveryOrder }) {
  if (order.cod_amount <= 0) return null;
  const collected =
    order.cod_status === "collected" || order.cod_status === "settled";
  return (
    <span className={`rf-cod ${collected ? "is-collected" : "is-due"}`}>
      <Icon name="coin" size={14} strokeWidth={2.1} />
      {collected ? "COD collected" : "COD due"} ·{" "}
      {currency.format(order.cod_amount)}
    </span>
  );
}

function Notice({
  tone,
  icon,
  children,
  action,
}: {
  tone: "info" | "warning" | "error" | "success" | "neutral";
  icon: IconName;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`rf-notice rf-notice-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={icon} size={18} strokeWidth={2.1} />
      <div className="rf-notice-copy">{children}</div>
      {action}
    </div>
  );
}

export function RiderApp() {
  const workspace = useWorkspace("driver");
  const driverId = workspace.isDemo
    ? "demo-driver-aung"
    : (workspace.profile?.id ?? null);
  const storeKey = `oern.rider.${driverId ?? "anon"}`;

  const [screen, setScreen] = useState<Screen | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [arrived, setArrived] = useState<string[]>([]);
  const [draft, setDraft] = useState<OutcomeDraft>(EMPTY_DRAFT);
  const [confirming, setConfirming] = useState(false);
  const [lastResult, setLastResult] = useState<{
    orderId: string;
    outcome: "delivered" | "failed";
    detailsSaved: boolean;
  } | null>(null);
  const [position, setPosition] = useState<DevicePosition | null>(null);
  const [gps, setGps] = useState<GpsState>("off");
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(0);
  const [viewHeight, setViewHeight] = useState(844);

  const route = useMemo(
    () =>
      buildRiderRoute(
        workspace.data.orders,
        workspace.data.statusEvents,
        driverId,
        now,
      ),
    [workspace.data.orders, workspace.data.statusEvents, driverId, now],
  );
  const current = route.current;
  const stopNumber = (order: DeliveryOrder | null) =>
    order ? route.stops.findIndex((stop) => stop.id === order.id) + 1 : 0;
  const leg = current ? legFor(current) : null;
  const vehicle = current?.vehicle_id
    ? (workspace.data.vehicles.find((item) => item.id === current.vehicle_id) ??
      null)
    : null;

  // The screen follows route progress unless the rider is mid-way through a step.
  const defaultScreen: Screen =
    route.phase === "active"
      ? "navigate"
      : route.phase === "complete"
        ? "complete"
        : "overview";
  const activeScreen = screen ?? defaultScreen;

  useEffect(() => {
    setNow(Date.now());
    const measure = () => setViewHeight(window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Restore arrival flags and the outcome draft so a reload or dropped connection loses nothing.
  useEffect(() => {
    setArrived(readStore<string[]>(`${storeKey}.arrived`, []));
  }, [storeKey]);
  useEffect(() => {
    writeStore(`${storeKey}.arrived`, arrived.length ? arrived : null);
  }, [arrived, storeKey]);
  const currentId = current?.id ?? null;
  useEffect(() => {
    if (!currentId) return;
    setDraft(readStore(`${storeKey}.draft.${currentId}`, EMPTY_DRAFT));
    setConfirming(false);
  }, [currentId, storeKey]);
  const updateDraft = (patch: Partial<OutcomeDraft>) => {
    setDraft((previous) => {
      const next = { ...previous, ...patch };
      if (current) writeStore(`${storeKey}.draft.${current.id}`, next);
      return next;
    });
  };

  // Device position for the on-screen map. This never leaves the phone; sharing with
  // customers is handled separately below and only for parcels already on board.
  const wantsGps =
    !workspace.isDemo &&
    workspace.isAuthenticated &&
    (activeScreen === "start" ||
      activeScreen === "navigate" ||
      route.phase === "active");
  useEffect(() => {
    if (!wantsGps) {
      setGps("off");
      return;
    }
    if (!("geolocation" in navigator)) {
      setGps("unavailable");
      return;
    }
    setGps((state) => (state === "live" ? state : "waiting"));
    const id = navigator.geolocation.watchPosition(
      (fix) => {
        setPosition({
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
          heading:
            fix.coords.heading != null && Number.isFinite(fix.coords.heading)
              ? fix.coords.heading
              : null,
          accuracy: fix.coords.accuracy ?? null,
          at: fix.timestamp || Date.now(),
        });
        setGps("live");
      },
      (error) =>
        setGps(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        ),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [wantsGps]);
  const gpsState: GpsState =
    gps === "live" && position && now - position.at > STALE_AFTER_MS
      ? "stale"
      : gps;

  // Share location for every parcel on board, as the customer tracking flow requires.
  const onBoardKey = JSON.stringify(
    route.active
      .filter((order) => hasParcelOnBoard(order.status))
      .map((order) => order.id)
      .sort(),
  );
  const [sharing, setSharing] = useState<{ count: number; at: string } | null>(
    null,
  );
  useEffect(() => {
    const orderIds = JSON.parse(onBoardKey) as string[];
    if (
      workspace.isDemo ||
      !workspace.canUseLiveData ||
      !driverId ||
      !orderIds.length ||
      !("geolocation" in navigator)
    ) {
      setSharing(null);
      return;
    }
    return watchRiderLocations({
      geolocation: navigator.geolocation,
      orderIds,
      send: (orderId, point) =>
        sendDriverLocation(
          createClient(),
          orderId,
          driverId,
          point.latitude,
          point.longitude,
          point.accuracy,
        ),
      onSent: (sentIds, point) =>
        setSharing({ count: sentIds.length, at: point.recordedAt }),
      onError: () => setSharing(null),
    });
  }, [onBoardKey, workspace.isDemo, workspace.canUseLiveData, driverId]);

  const riderPoint: GeoPoint | null = workspace.isDemo
    ? current?.latest_location
      ? {
          latitude: current.latest_location.latitude,
          longitude: current.latest_location.longitude,
        }
      : route.active[0]?.pickup_latitude != null &&
          route.active[0]?.pickup_longitude != null
        ? {
            latitude: route.active[0].pickup_latitude,
            longitude: route.active[0].pickup_longitude,
          }
        : null
    : position;
  const legDistance =
    riderPoint && leg?.point ? distanceKm(riderPoint, leg.point) : null;
  const legBearing =
    riderPoint && leg?.point ? bearingDegrees(riderPoint, leg.point) : null;
  const atTarget = legDistance != null && legDistance <= ARRIVAL_RADIUS_KM;
  const hasArrived = current ? arrived.includes(current.id) : false;

  const remainingDistance = useMemo(() => {
    let from = riderPoint;
    let total = 0;
    let known = false;
    for (const order of route.active) {
      const points: GeoPoint[] = [];
      if (
        !hasParcelOnBoard(order.status) &&
        order.pickup_latitude != null &&
        order.pickup_longitude != null
      )
        points.push({
          latitude: order.pickup_latitude,
          longitude: order.pickup_longitude,
        });
      if (order.delivery_latitude != null && order.delivery_longitude != null)
        points.push({
          latitude: order.delivery_latitude,
          longitude: order.delivery_longitude,
        });
      for (const point of points) {
        if (from) {
          total += distanceKm(from, point);
          known = true;
        }
        from = point;
      }
    }
    return known ? total : null;
  }, [riderPoint, route.active]);

  // Each order contributes its pickup (until collected) and its numbered drop-off, in route order.
  const navStops: NavStop[] = route.stops.flatMap((order, index) => {
    const state: NavStop["state"] =
      order.status === "delivered"
        ? "done"
        : order.status === "failed" || order.status === "cancelled"
          ? "failed"
          : order.id === current?.id
            ? "current"
            : "queued";
    const items: NavStop[] = [];
    if (
      legFor(order).kind === "pickup" &&
      order.pickup_latitude != null &&
      order.pickup_longitude != null
    )
      items.push({
        id: order.id,
        number: index + 1,
        kind: "pickup",
        state,
        point: {
          latitude: order.pickup_latitude,
          longitude: order.pickup_longitude,
        },
      });
    if (order.delivery_latitude != null && order.delivery_longitude != null)
      items.push({
        id: order.id,
        number: index + 1,
        kind: "dropoff",
        state,
        point: {
          latitude: order.delivery_latitude,
          longitude: order.delivery_longitude,
        },
      });
    return items;
  });

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);

  /* ---------------- data writes ---------------- */

  const applyLocalStatus = useCallback(
    (
      orderId: string,
      status: DeliveryStatus,
      extra: Partial<DeliveryOrder> = {},
    ) => {
      workspace.updateData((previous: WorkspaceData) => ({
        ...previous,
        orders: previous.orders.map((order) =>
          order.id === orderId ? { ...order, status, ...extra } : order,
        ),
        statusEvents: [
          ...previous.statusEvents,
          {
            id:
              Math.max(0, ...previous.statusEvents.map((event) => event.id)) +
              1,
            order_id: orderId,
            status,
            note: null,
            created_at: new Date().toISOString(),
          },
        ],
      }));
    },
    [workspace.updateData],
  );

  async function changeStatus(
    order: DeliveryOrder,
    status: "accepted" | "picked_up" | "in_transit" | "delivered" | "failed",
  ) {
    if (workspace.isDemo) {
      applyLocalStatus(order.id, status);
      return;
    }
    await setOrderStatus(createClient(), order.id, status);
    applyLocalStatus(order.id, status);
  }

  async function run(label: string, task: () => Promise<void>) {
    if (busy) return;
    if (!workspace.isDemo && !workspace.canUseLiveData) {
      setActionError(
        "Your session needs refreshing. Sign in again to continue.",
      );
      return;
    }
    setBusy(label);
    setActionError(null);
    try {
      await task();
    } catch (cause) {
      setActionError(message(cause, "That update did not save. Try again."));
    } finally {
      setBusy(null);
      if (!workspace.isDemo) void workspace.refresh(true);
    }
  }

  const startRoute = () =>
    run("start", async () => {
      for (const order of route.active)
        if (order.status === "assigned") await changeStatus(order, "accepted");
      setSheetOpen(false);
      setScreen("navigate");
    });

  const confirmPickup = () =>
    run("pickup", async () => {
      if (!current) return;
      if (current.status === "accepted")
        await changeStatus(current, "picked_up");
      await changeStatus({ ...current, status: "picked_up" }, "in_transit");
      setArrived((ids) => ids.filter((id) => id !== current.id));
      setSheetOpen(false);
    });

  const codExpected = current?.cod_amount ?? 0;
  const codNeeded =
    codExpected > 0 &&
    current?.cod_status !== "collected" &&
    current?.cod_status !== "settled";
  const codValue =
    draft.codAmount.trim() === "" ? null : Number(draft.codAmount);
  const codMismatch =
    codNeeded &&
    draft.codConfirmed &&
    codValue != null &&
    codValue !== codExpected;
  const outcomeReady =
    draft.outcome === "delivered"
      ? draft.recipientName.trim().length > 0 &&
        (!codNeeded ||
          (draft.codConfirmed &&
            codValue != null &&
            Number.isFinite(codValue) &&
            codValue >= 0 &&
            (!codMismatch || draft.codReason.trim().length >= 3)) ||
          (draft.codConfirmed === false && draft.codReason.trim().length >= 3))
      : draft.outcome === "failed"
        ? draft.failureReason != null &&
          (draft.failureReason !== "other" || draft.note.trim().length >= 3)
        : false;

  const submitOutcome = () =>
    run("outcome", async () => {
      if (!current || !draft.outcome) return;
      const order = current;
      const collected = codNeeded && draft.codConfirmed ? codValue : null;
      // COD is recorded only when the full amount was received; anything else is a discrepancy.
      if (
        draft.outcome === "delivered" &&
        codNeeded &&
        collected === codExpected
      ) {
        if (workspace.isDemo)
          workspace.updateData((previous) => ({
            ...previous,
            orders: previous.orders.map((item) =>
              item.id === order.id
                ? { ...item, cod_status: "collected" }
                : item,
            ),
          }));
        else
          await collectCod(createClient(), {
            orderId: order.id,
            driverId: driverId ?? "",
            amount: codExpected,
          });
      }
      if (draft.outcome === "delivered" && order.status === "picked_up")
        await changeStatus(order, "in_transit");
      await changeStatus(order, draft.outcome);

      let detailsSaved = true;
      if (!workspace.isDemo && driverId) {
        try {
          await recordDeliveryOutcome(createClient(), {
            orderId: order.id,
            driverId,
            outcome: draft.outcome,
            recipientName:
              draft.outcome === "delivered" ? draft.recipientName : null,
            failureReason:
              draft.outcome === "failed" ? draft.failureReason : null,
            note: draft.note,
            codExpected: order.cod_amount,
            codCollected: codNeeded ? (collected ?? 0) : null,
            codDiscrepancyReason:
              codNeeded && collected !== codExpected ? draft.codReason : null,
          });
        } catch {
          detailsSaved = false;
        }
      }
      writeStore(`${storeKey}.draft.${order.id}`, null);
      setArrived((ids) => ids.filter((id) => id !== order.id));
      setConfirming(false);
      setLastResult({
        orderId: order.id,
        outcome: draft.outcome,
        detailsSaved,
      });
      setWarning(
        detailsSaved
          ? null
          : "The delivery status is saved, but the outcome details (recipient, reason, cash notes) could not be stored. Tell operations.",
      );
      setScreen("result");
    });

  /* ---------------- shift menu: vehicle energy + road reports ---------------- */

  const [energyLevel, setEnergyLevel] = useState("");
  const [roadCategory, setRoadCategory] =
    useState<RoadReport["category"]>("congestion");
  const [roadSeverity, setRoadSeverity] =
    useState<RoadReport["severity"]>("medium");
  const [roadText, setRoadText] = useState("");
  const [menuNote, setMenuNote] = useState<string | null>(null);
  const energy = current ? assessEnergyRoute(current, vehicle) : null;

  const saveEnergy = () =>
    run("energy", async () => {
      if (!vehicle || energyLevel === "") return;
      const level = Number(energyLevel);
      if (workspace.isDemo)
        workspace.updateData((previous) => ({
          ...previous,
          vehicles: previous.vehicles.map((item) =>
            item.id === vehicle.id
              ? {
                  ...item,
                  fuel_level_percent:
                    item.energy_source === "electric"
                      ? item.fuel_level_percent
                      : level,
                  battery_level_percent:
                    item.energy_source === "fuel"
                      ? item.battery_level_percent
                      : level,
                }
              : item,
          ),
        }));
      else
        await updateVehicleEnergy(createClient(), {
          vehicleId: vehicle.id,
          energySource: vehicle.energy_source,
          levelPercent: level,
        });
      setEnergyLevel("");
      setMenuNote("Vehicle level saved.");
    });

  const sendRoadReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return run("road", async () => {
      if (!driverId) return;
      const point = riderPoint;
      if (!point)
        throw new Error(
          "Your location is needed to place a road report. Allow GPS and try again.",
        );
      if (!workspace.isDemo)
        await submitRoadReport(createClient(), {
          driverId,
          orderId: current?.id ?? null,
          category: roadCategory,
          severity: roadSeverity,
          description: roadText,
          latitude: point.latitude,
          longitude: point.longitude,
        });
      setRoadText("");
      setMenuNote(
        "Road report sent. Operations reviews it before it changes ETAs.",
      );
    });
  };

  /* ---------------- render ---------------- */

  if (workspace.isLoading) return <LoadingBlock title="Opening your route…" />;

  if (!workspace.isAuthenticated && !workspace.isDemo)
    return (
      <main className="rf-app rf-gate">
        <Brand href="/rider" />
        <h1>Sign in to see today’s deliveries</h1>
        <p>Rider accounts are set up by your operations team.</p>
        <button
          type="button"
          className="rf-btn rf-btn-primary"
          onClick={() => setAuthOpen(true)}
        >
          Sign in <Icon name="arrow-right" size={18} />
        </button>
        <AuthDialog
          open={authOpen}
          audience="team"
          onClose={() => setAuthOpen(false)}
        />
      </main>
    );

  const connectivityBanner = !online ? (
    <Notice tone="warning" icon="warning">
      <strong>You’re offline.</strong> Nothing new will save until the
      connection returns. What you enter stays on this phone.
    </Notice>
  ) : null;

  const errorBanner =
    actionError || workspace.error ? (
      <Notice
        tone="error"
        icon="warning"
        action={
          workspace.error ? (
            <button
              type="button"
              className="rf-link"
              onClick={() => void workspace.refresh()}
            >
              Retry
            </button>
          ) : (
            <button
              type="button"
              className="rf-link"
              onClick={() => setActionError(null)}
            >
              Dismiss
            </button>
          )
        }
      >
        {actionError ?? workspace.error}
      </Notice>
    ) : null;

  const menu = menuOpen ? (
    <div className="rf-scrim">
      <section
        className="rf-sheet rf-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Shift tools"
      >
        <span className="rf-handle" aria-hidden="true" />
        <header className="rf-menu-head">
          <div className="rf-avatar">
            {(workspace.profile?.full_name?.[0] ?? "R").toUpperCase()}
          </div>
          <div>
            <strong>{workspace.profile?.full_name || "Oern rider"}</strong>
            <span>
              {vehicle
                ? `${vehicle.registration_number} · ${vehicle.vehicle_type}`
                : "No vehicle on this route"}
            </span>
          </div>
          <button
            type="button"
            className="rf-icon-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Close shift tools"
          >
            <Icon name="close" size={20} />
          </button>
        </header>
        {menuNote && (
          <Notice tone="success" icon="check">
            {menuNote}
          </Notice>
        )}
        {vehicle && (
          <div className="rf-menu-block">
            <h3>
              {vehicle.energy_source === "electric"
                ? "Battery level"
                : "Fuel level"}
            </h3>
            <p>
              {energy?.message ??
                "Set the current level to check range for this route."}
            </p>
            <div className="rf-inline-field">
              <label className="rf-field">
                <span>Current level (%)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={energyLevel}
                  placeholder={String(energy?.energyLevelPercent ?? "")}
                  onChange={(event) => setEnergyLevel(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="rf-btn rf-btn-secondary"
                disabled={energyLevel === "" || busy != null}
                onClick={() => void saveEnergy()}
              >
                Save
              </button>
            </div>
          </div>
        )}
        <form
          className="rf-menu-block"
          onSubmit={(event) => void sendRoadReport(event)}
        >
          <h3>Report a road condition</h3>
          <p>
            Send only when safely stopped. Operations checks reports before they
            affect ETAs.
          </p>
          <div className="rf-two">
            <label className="rf-field">
              <span>Condition</span>
              <select
                value={roadCategory}
                onChange={(event) =>
                  setRoadCategory(event.target.value as RoadReport["category"])
                }
              >
                <option value="congestion">Congestion</option>
                <option value="closure">Road closure</option>
                <option value="roadwork">Roadwork</option>
                <option value="flooding">Flooding</option>
                <option value="hazard">Road hazard</option>
              </select>
            </label>
            <label className="rf-field">
              <span>Impact</span>
              <select
                value={roadSeverity}
                onChange={(event) =>
                  setRoadSeverity(event.target.value as RoadReport["severity"])
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
          </div>
          <label className="rf-field">
            <span>What did you see?</span>
            <textarea
              value={roadText}
              minLength={3}
              maxLength={240}
              required
              placeholder="Left lane closed after the market entrance"
              onChange={(event) => setRoadText(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="rf-btn rf-btn-secondary"
            disabled={roadText.trim().length < 3 || busy != null}
          >
            <Icon name="location" size={18} />
            {busy === "road" ? "Sending…" : "Send with my location"}
          </button>
        </form>
        <button
          type="button"
          className="rf-btn rf-btn-quiet"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </section>
    </div>
  ) : null;

  /* ----- Screen 6: result + next stop ----- */
  if (activeScreen === "result" && lastResult) {
    const done = workspace.data.orders.find(
      (order) => order.id === lastResult.orderId,
    );
    const next = route.current;
    const nextLeg = next ? legFor(next) : null;
    const nextDistance =
      riderPoint && nextLeg?.point
        ? distanceKm(riderPoint, nextLeg.point)
        : null;
    const delivered = lastResult.outcome === "delivered";
    return (
      <main className="rf-app rf-result">
        <section className="rf-result-head">
          <span
            className={`rf-result-mark ${delivered ? "is-success" : "is-failed"}`}
          >
            <Icon
              name={delivered ? "check" : "warning"}
              size={30}
              strokeWidth={2.4}
            />
          </span>
          <h1>{delivered ? "Delivery completed" : "Outcome recorded"}</h1>
          <p>
            {done
              ? `Stop ${stopNumber(done)} · ${recipientLabel(done)}`
              : "Stop saved"}
            {delivered ? "" : " · marked as not delivered"}
          </p>
          {done && <CodBadge order={done} />}
        </section>
        {warning && (
          <Notice tone="warning" icon="warning">
            {warning}
          </Notice>
        )}
        <section className="rf-progress-card">
          <div className="rf-progress-row">
            <span>
              <strong>{route.closedToday.length}</strong> done
            </span>
            <span>
              <strong>{route.active.length}</strong> left
            </span>
          </div>
          <div className="rf-progress-bar" aria-hidden="true">
            <span
              style={{
                width: `${(route.closedToday.length / Math.max(1, route.stops.length)) * 100}%`,
              }}
            />
          </div>
        </section>
        {next && nextLeg ? (
          <section className="rf-next-card">
            <span className="rf-stop-num">{stopNumber(next)}</span>
            <div>
              <small>
                {nextLeg.kind === "pickup"
                  ? "Next · collect parcel"
                  : "Next · deliver to"}
              </small>
              <strong>
                {nextLeg.kind === "pickup"
                  ? next.tracking_code
                  : recipientLabel(next)}
              </strong>
              <p>{nextLeg.address}</p>
              <div className="rf-meta">
                <span>
                  <Icon name="navigation" size={15} />
                  {formatDistance(nextDistance)} direct
                </span>
                {nextLeg.kind === "dropoff" && next.estimated_delivery_at && (
                  <span>
                    <Icon name="history" size={15} />
                    ETA {formatTime(next.estimated_delivery_at)}
                  </span>
                )}
              </div>
              <CodBadge order={next} />
            </div>
          </section>
        ) : null}
        <div className="rf-dock">
          <button
            type="button"
            className="rf-btn rf-btn-primary"
            onClick={() => {
              setSheetOpen(false);
              setScreen(next ? "navigate" : "complete");
            }}
          >
            {next ? "Navigate to next stop" : "See route summary"}
            <Icon name="arrow-right" size={18} />
          </button>
        </div>
      </main>
    );
  }

  /* ----- Screen 7: route complete ----- */
  if (activeScreen === "complete") {
    const summary = summariseRoute(route, workspace.data.statusEvents);
    return (
      <main className="rf-app rf-complete">
        <section className="rf-result-head">
          <span className="rf-result-mark is-success">
            <Icon name="check" size={30} strokeWidth={2.4} />
          </span>
          <h1>Route completed</h1>
          <p>Every stop on today’s route has an outcome.</p>
        </section>
        <section className="rf-summary">
          <h2>Deliveries</h2>
          <dl>
            <div>
              <dt>Assigned</dt>
              <dd>{summary.assigned}</dd>
            </div>
            <div>
              <dt>Delivered</dt>
              <dd className="is-success">{summary.delivered}</dd>
            </div>
            <div>
              <dt>Not delivered</dt>
              <dd className={summary.failed ? "is-failed" : ""}>
                {summary.failed}
              </dd>
            </div>
            <div>
              <dt>Distance (direct, pickup to drop-off)</dt>
              <dd>
                {summary.directDistanceKm == null
                  ? "—"
                  : formatDistance(summary.directDistanceKm)}
              </dd>
            </div>
            <div>
              <dt>Time on route</dt>
              <dd>{formatDuration(summary.durationMinutes)}</dd>
            </div>
          </dl>
        </section>
        <section className="rf-summary">
          <h2>
            <Icon name="coin" size={18} /> Cash on delivery
          </h2>
          <dl>
            <div>
              <dt>COD expected</dt>
              <dd>{currency.format(summary.codExpected)}</dd>
            </div>
            <div>
              <dt>COD collected</dt>
              <dd>{currency.format(summary.codCollected)}</dd>
            </div>
            <div>
              <dt>COD outstanding</dt>
              <dd className={summary.codOutstanding ? "is-warning" : ""}>
                {currency.format(summary.codOutstanding)}
              </dd>
            </div>
            <div>
              <dt>Awaiting handover</dt>
              <dd>{currency.format(summary.codAwaitingHandover)}</dd>
            </div>
          </dl>
          {summary.codAwaitingHandover > 0 && (
            <Notice tone="warning" icon="coin">
              Hand {currency.format(summary.codAwaitingHandover)} in cash to
              operations. It isn’t reconciled until they confirm it.
            </Notice>
          )}
          {summary.codOutstanding > 0 && (
            <Notice tone="warning" icon="warning">
              {currency.format(summary.codOutstanding)} was not collected in
              full. Operations will follow up using your notes.
            </Notice>
          )}
        </section>
        <details className="rf-summary rf-stop-log">
          <summary>View delivery summary</summary>
          <ol>
            {route.closedToday.map((order) => (
              <li key={order.id}>
                <span className="rf-stop-num is-small">
                  {stopNumber(order)}
                </span>
                <div>
                  <strong>{recipientLabel(order)}</strong>
                  <span>{order.delivery_address}</span>
                </div>
                <StatusBadge status={order.status} />
              </li>
            ))}
          </ol>
        </details>
        <div className="rf-dock">
          <button
            type="button"
            className="rf-btn rf-btn-primary"
            onClick={() => setScreen("overview")}
          >
            Finish route
          </button>
        </div>
        {menu}
      </main>
    );
  }

  /* ----- Screen 5: report outcome ----- */
  if (activeScreen === "outcome" && current) {
    return (
      <main className="rf-app rf-outcome">
        <header className="rf-topbar">
          <button
            type="button"
            className="rf-icon-btn"
            onClick={() => setScreen("navigate")}
            aria-label="Back to the map"
          >
            <Icon name="arrow-left" size={22} />
          </button>
          <div>
            <small>
              Stop {stopNumber(current)} of {route.stops.length}
            </small>
            <strong>{recipientLabel(current)}</strong>
          </div>
        </header>
        {connectivityBanner}
        <h1>How did this delivery go?</h1>
        <fieldset className="rf-choice-row">
          <legend className="rf-sr-only">Delivery outcome</legend>
          <label
            className={`rf-choice is-success ${draft.outcome === "delivered" ? "is-selected" : ""}`}
          >
            <input
              type="radio"
              name="delivery-outcome"
              checked={draft.outcome === "delivered"}
              onChange={() => updateDraft({ outcome: "delivered" })}
            />
            <span className="rf-choice-mark">
              <Icon name="check" size={22} strokeWidth={2.4} />
            </span>
            Delivered successfully
          </label>
          <label
            className={`rf-choice is-failed ${draft.outcome === "failed" ? "is-selected" : ""}`}
          >
            <input
              type="radio"
              name="delivery-outcome"
              checked={draft.outcome === "failed"}
              onChange={() => updateDraft({ outcome: "failed" })}
            />
            <span className="rf-choice-mark">
              <Icon name="close" size={22} strokeWidth={2.4} />
            </span>
            Unable to deliver
          </label>
        </fieldset>

        {draft.outcome === "delivered" && (
          <div className="rf-form">
            <label className="rf-field">
              <span>Received by</span>
              <input
                value={draft.recipientName}
                autoComplete="off"
                placeholder={
                  current.recipient_name ??
                  "Name of the person who took the parcel"
                }
                onChange={(event) =>
                  updateDraft({ recipientName: event.target.value })
                }
              />
              {current.recipient_name && !draft.recipientName && (
                <button
                  type="button"
                  className="rf-link rf-field-help"
                  onClick={() =>
                    updateDraft({ recipientName: current.recipient_name ?? "" })
                  }
                >
                  Use “{current.recipient_name}”
                </button>
              )}
            </label>
            {codNeeded && (
              <fieldset className="rf-cod-panel">
                <legend>
                  <Icon name="coin" size={17} /> Cash on delivery
                </legend>
                <div className="rf-cod-due">
                  <span>COD due</span>
                  <strong>{currency.format(codExpected)}</strong>
                </div>
                <div className="rf-reasons">
                  <label
                    className={`rf-reason is-positive ${draft.codConfirmed === true ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="cod-collected"
                      checked={draft.codConfirmed === true}
                      onChange={() =>
                        updateDraft({
                          codConfirmed: true,
                          codAmount:
                            draft.codAmount === ""
                              ? String(codExpected)
                              : draft.codAmount,
                        })
                      }
                    />
                    I received cash from the recipient
                  </label>
                  <label
                    className={`rf-reason ${draft.codConfirmed === false ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="cod-collected"
                      checked={draft.codConfirmed === false}
                      onChange={() => updateDraft({ codConfirmed: false })}
                    />
                    Cash was not collected
                  </label>
                </div>
                {draft.codConfirmed && (
                  <label className="rf-field">
                    <span>Amount received (MMK)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={draft.codAmount}
                      onChange={(event) =>
                        updateDraft({ codAmount: event.target.value })
                      }
                    />
                  </label>
                )}
                {(codMismatch || draft.codConfirmed === false) && (
                  <label className="rf-field">
                    <span>
                      {draft.codConfirmed
                        ? "Why is the amount different?"
                        : "Why wasn’t cash collected?"}
                    </span>
                    <textarea
                      value={draft.codReason}
                      maxLength={240}
                      placeholder={
                        draft.codConfirmed
                          ? "Customer paid part now, rest by transfer"
                          : "Customer says it was prepaid"
                      }
                      onChange={(event) =>
                        updateDraft({ codReason: event.target.value })
                      }
                    />
                  </label>
                )}
                {codMismatch && (
                  <p className="rf-field-warn">
                    <Icon name="warning" size={15} />{" "}
                    {currency.format(codValue ?? 0)} doesn’t match{" "}
                    {currency.format(codExpected)}. COD stays open for
                    operations to review.
                  </p>
                )}
              </fieldset>
            )}
            <label className="rf-field">
              <span>Delivery note (optional)</span>
              <textarea
                value={draft.note}
                maxLength={500}
                placeholder="Left with building security"
                onChange={(event) => updateDraft({ note: event.target.value })}
              />
            </label>
          </div>
        )}

        {draft.outcome === "failed" && (
          <div className="rf-form">
            <fieldset className="rf-reasons">
              <legend>What happened?</legend>
              {FAILURE_REASONS.map((reason) => (
                <label
                  key={reason.id}
                  className={`rf-reason ${draft.failureReason === reason.id ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="failure-reason"
                    checked={draft.failureReason === reason.id}
                    onChange={() => updateDraft({ failureReason: reason.id })}
                  />
                  {reason.label}
                </label>
              ))}
            </fieldset>
            <label className="rf-field">
              <span>
                {draft.failureReason === "other"
                  ? "Describe what happened"
                  : "Note (optional)"}
              </span>
              <textarea
                value={draft.note}
                maxLength={500}
                placeholder="Called twice, no answer. Gate locked."
                onChange={(event) => updateDraft({ note: event.target.value })}
              />
            </label>
          </div>
        )}

        {errorBanner}
        <div className="rf-dock">
          <button
            type="button"
            className="rf-btn rf-btn-primary"
            disabled={!outcomeReady || !online || busy != null}
            onClick={() => setConfirming(true)}
          >
            {draft.outcome === "failed" ? "Submit outcome" : "Confirm delivery"}
          </button>
          {!online && (
            <p className="rf-dock-note">
              Waiting for a connection. Your entries are kept.
            </p>
          )}
        </div>

        {confirming && (
          <div className="rf-scrim">
            <section
              className="rf-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="rf-confirm-title"
            >
              <h2 id="rf-confirm-title">
                {draft.outcome === "delivered"
                  ? "Mark as delivered?"
                  : "Mark as not delivered?"}
              </h2>
              <p>
                {draft.outcome === "delivered"
                  ? `${recipientLabel(current)} will see the parcel as delivered.`
                  : `${recipientLabel(current)} and operations will see a delivery issue: ${FAILURE_REASONS.find((r) => r.id === draft.failureReason)?.label.toLowerCase()}.`}
                {codNeeded && draft.outcome === "delivered"
                  ? draft.codConfirmed && !codMismatch
                    ? ` COD ${currency.format(codExpected)} will be recorded as collected.`
                    : " COD will stay open with your note."
                  : ""}{" "}
                This can’t be undone from the app.
              </p>
              <div className="rf-dialog-actions">
                <button
                  type="button"
                  className="rf-btn rf-btn-secondary"
                  onClick={() => setConfirming(false)}
                  disabled={busy != null}
                >
                  Go back
                </button>
                <button
                  type="button"
                  className="rf-btn rf-btn-primary"
                  onClick={() => void submitOutcome()}
                  disabled={busy != null}
                >
                  {busy === "outcome" ? "Saving…" : "Yes, submit"}
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    );
  }

  /* ----- Screens 3 + 4: full-screen navigation with delivery sheet ----- */
  if (activeScreen === "navigate" && current && leg) {
    const pickup = leg.kind === "pickup";
    const instruction = !leg.point
      ? {
          title: "No map pin for this address",
          sub: "Use the address and landmark below",
        }
      : !riderPoint
        ? {
            title:
              gpsState === "denied"
                ? "Location is off"
                : "Finding your location…",
            sub: pickup
              ? "Pickup marked on the map"
              : "Drop-off marked on the map",
          }
        : atTarget
          ? {
              title: pickup ? "You’re at the pickup" : "You’re at the drop-off",
              sub: "Stop safely, then confirm arrival",
            }
          : {
              title: `Head ${compassDirection(legBearing ?? 0)}`,
              sub: `${formatDistance(legDistance)} straight-line to ${pickup ? "pickup" : "drop-off"}`,
            };
    const etaText =
      !pickup && current.estimated_delivery_at
        ? formatTime(current.estimated_delivery_at)
        : null;

    return (
      <main className="rf-app rf-nav">
        <RiderNavMap
          driver={riderPoint}
          heading={workspace.isDemo ? legBearing : (position?.heading ?? null)}
          target={leg.point ? { ...leg.point, kind: leg.kind } : null}
          targetId={current.id}
          stops={navStops}
          padding={{
            x: 56,
            top: 168,
            bottom: sheetOpen ? Math.round(viewHeight * 0.6) + 16 : 300,
          }}
          label={`Map to stop ${stopNumber(current)}: ${leg.address}`}
        />

        <header className="rf-nav-top">
          <div className="rf-nav-instruction">
            <span className="rf-turn" aria-hidden="true">
              {leg.point && riderPoint && !atTarget ? (
                <svg
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                  style={{ transform: `rotate(${legBearing ?? 0}deg)` }}
                >
                  <path d="M16 3 26 27l-10-6-10 6Z" />
                </svg>
              ) : (
                <Icon
                  name={atTarget ? "location" : "compass"}
                  size={26}
                  strokeWidth={2.2}
                />
              )}
            </span>
            <div>
              <strong>{instruction.title}</strong>
              <span>{instruction.sub}</span>
            </div>
            <a
              className="rf-directions"
              href={mapsUrl(legDestination(current))}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open turn-by-turn directions in Google Maps"
            >
              <Icon name="navigation" size={18} />
              <span>Directions</span>
            </a>
          </div>
          <div className="rf-nav-chips">
            <button
              type="button"
              className="rf-chip-btn"
              onClick={() => setScreen("overview")}
            >
              <Icon name="list" size={16} /> All stops
            </button>
            {workspace.isDemo ? (
              <span className="rf-chip">Sample route · no GPS used</span>
            ) : gpsState === "stale" ? (
              <span className="rf-chip is-warning">
                <Icon name="warning" size={14} /> GPS last updated{" "}
                {Math.round((now - (position?.at ?? now)) / 60_000)} min ago
              </span>
            ) : gpsState === "denied" || gpsState === "unavailable" ? (
              <span className="rf-chip is-error">
                <Icon name="warning" size={14} />{" "}
                {gpsState === "denied"
                  ? "Allow location access"
                  : "GPS unavailable"}
              </span>
            ) : sharing ? (
              <span className="rf-chip is-live">
                <span className="rf-live-dot" /> Sharing with {sharing.count}{" "}
                {sharing.count === 1 ? "customer" : "customers"}
              </span>
            ) : null}
            {!online && (
              <span className="rf-chip is-warning">
                <Icon name="warning" size={14} /> Offline
              </span>
            )}
            <button
              type="button"
              className="rf-icon-btn rf-help"
              onClick={() => setMenuOpen(true)}
              aria-label="Help and shift tools"
            >
              <Icon name="help" size={20} />
            </button>
          </div>
        </header>

        <section
          className={`rf-sheet rf-nav-sheet ${sheetOpen ? "is-open" : ""}`}
          aria-label="Current stop"
        >
          <SheetHandle open={sheetOpen} onToggle={setSheetOpen} />
          <div className="rf-sheet-head">
            <div>
              <small>
                Stop {stopNumber(current)} of {route.stops.length} ·{" "}
                {pickup ? "Collect parcel" : "Deliver parcel"}
              </small>
              <h2>
                {pickup
                  ? `Collect ${current.tracking_code}`
                  : `Delivering to ${recipientLabel(current)}`}
              </h2>
            </div>
            <StatusBadge status={current.status} />
          </div>
          <p className="rf-address">{leg.address}</p>
          <div className="rf-meta">
            {etaText ? (
              <span className="rf-eta">
                <strong>{etaText}</strong> ETA
                {current.eta_confidence
                  ? ` · ${current.eta_confidence} confidence`
                  : ""}
              </span>
            ) : null}
            <span>
              <Icon name="navigation" size={15} />
              {formatDistance(legDistance)}
            </span>
            <span>
              <Icon name="box" size={15} />1 parcel
            </span>
            <CodBadge order={current} />
          </div>
          {current.traffic_delay_minutes > 0 && !pickup && (
            <Notice tone="warning" icon="history">
              Running about {current.traffic_delay_minutes} min late from
              verified road reports.
            </Notice>
          )}

          {sheetOpen && (
            <div className="rf-sheet-body">
              <div className="rf-detail">
                <h3>{pickup ? "Pickup" : "Address"}</h3>
                <p>{leg.address}</p>
                <button
                  type="button"
                  className="rf-link"
                  onClick={() =>
                    void navigator.clipboard?.writeText(leg.address)
                  }
                >
                  Copy address
                </button>
              </div>
              {!pickup && (
                <div className="rf-detail">
                  <h3>Recipient</h3>
                  <p>
                    {recipientLabel(current)}
                    {current.recipient_phone
                      ? ` · ${current.recipient_phone}`
                      : ""}
                  </p>
                  {current.recipient_phone ? (
                    <div className="rf-contact">
                      <a
                        className="rf-btn rf-btn-secondary"
                        href={`tel:${current.recipient_phone.replace(/\s+/g, "")}`}
                      >
                        <Icon name="phone" size={18} /> Call
                      </a>
                      <a
                        className="rf-btn rf-btn-secondary"
                        href={`sms:${current.recipient_phone.replace(/\s+/g, "")}`}
                      >
                        <Icon name="share" size={18} /> Message
                      </a>
                    </div>
                  ) : (
                    <p className="rf-muted">
                      No phone number on this order. Contact operations if you
                      can’t find the recipient.
                    </p>
                  )}
                </div>
              )}
              <div className="rf-detail">
                <h3>Parcel</h3>
                <p>
                  {current.tracking_code} ·{" "}
                  {current.parcel_description ?? "No description"}
                  {current.parcel_weight_kg
                    ? ` · ${current.parcel_weight_kg} kg`
                    : ""}
                </p>
              </div>
              {current.cod_amount > 0 && (
                <div className="rf-detail">
                  <h3>
                    <Icon name="coin" size={16} /> Payment
                  </h3>
                  <CodBadge order={current} />
                  <p className="rf-muted">
                    {pickup
                      ? "Collect this cash from the recipient at drop-off, not at pickup."
                      : "Collect the exact amount in cash. You’ll record what you received after delivery."}
                  </p>
                </div>
              )}
            </div>
          )}

          {errorBanner}
          <div className="rf-sheet-actions">
            {!hasArrived ? (
              <button
                type="button"
                className="rf-btn rf-btn-primary"
                onClick={() => {
                  setArrived((ids) => [...new Set([...ids, current.id])]);
                  setSheetOpen(true);
                }}
              >
                <Icon name="location" size={18} /> I’ve arrived
              </button>
            ) : pickup ? (
              <button
                type="button"
                className="rf-btn rf-btn-primary"
                disabled={busy != null}
                onClick={() => void confirmPickup()}
              >
                <Icon name="package" size={18} />
                {busy === "pickup"
                  ? "Saving…"
                  : "Parcel collected · start delivery"}
              </button>
            ) : (
              <button
                type="button"
                className="rf-btn rf-btn-primary"
                onClick={() => {
                  setActionError(null);
                  setScreen("outcome");
                }}
              >
                Report delivery outcome <Icon name="arrow-right" size={18} />
              </button>
            )}
            {!sheetOpen && (
              <button
                type="button"
                className="rf-btn rf-btn-quiet"
                onClick={() => setSheetOpen(true)}
              >
                View delivery details
              </button>
            )}
            {hasArrived && sheetOpen && (
              <button
                type="button"
                className="rf-btn rf-btn-quiet"
                onClick={() => {
                  setArrived((ids) => ids.filter((id) => id !== current.id));
                  setSheetOpen(false);
                }}
              >
                Back to navigation
              </button>
            )}
          </div>
        </section>
        {menu}
      </main>
    );
  }

  /* ----- Screens 1 + 2: task overview and start sheet ----- */
  const first = route.active[0] ?? null;
  const firstLeg = first ? legFor(first) : null;
  const lastEta = route.active
    .map((order) => order.estimated_delivery_at)
    .filter((value): value is string => value != null)
    .sort()
    .at(-1);

  return (
    <main className="rf-app rf-overview">
      <header className="rf-overview-head">
        <Brand href="/rider" />
        <span
          className={`rf-shift ${route.phase === "active" ? "is-live" : ""}`}
        >
          <span className="rf-live-dot" />{" "}
          {route.phase === "active" ? "On route" : "On shift"}
        </span>
        <button
          type="button"
          className="rf-icon-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Help and shift tools"
        >
          <Icon name="help" size={20} />
        </button>
      </header>
      <h1>Today’s deliveries</h1>
      {workspace.isDemo && (
        <Notice tone="neutral" icon="shield">
          Sample route. Nothing you do here is saved or shared.
        </Notice>
      )}
      {connectivityBanner}
      {errorBanner}

      {route.stops.length ? (
        <>
          <section className="rf-summary-strip" aria-label="Route summary">
            <div>
              <strong>{route.stops.length}</strong>
              <span>Assigned</span>
            </div>
            <div>
              <strong>{route.closedToday.length}</strong>
              <span>Done</span>
            </div>
            <div>
              <strong>{route.active.length}</strong>
              <span>Left</span>
            </div>
            <div>
              <strong>
                {remainingDistance == null
                  ? "—"
                  : formatDistance(remainingDistance)}
              </strong>
              <span>Direct distance</span>
            </div>
            <div>
              <strong>{lastEta ? formatTime(lastEta) : "—"}</strong>
              <span>Last ETA</span>
            </div>
          </section>

          {navStops.length > 0 && (
            <div className="rf-preview-map">
              <RiderNavMap
                driver={riderPoint}
                heading={null}
                target={null}
                stops={navStops}
                padding={{ x: 28, top: 28, bottom: 28 }}
                routeThroughStops
                interactive={false}
                label="Preview of today’s stops"
              />
            </div>
          )}

          <ol className="rf-stop-list">
            {route.stops.map((order, index) => {
              const stopLeg = legFor(order);
              return (
                <li
                  key={order.id}
                  className={order.id === current?.id ? "is-current" : ""}
                >
                  <span
                    className={`rf-stop-num ${order.status === "delivered" ? "is-done" : order.status === "failed" || order.status === "cancelled" ? "is-failed" : ""}`}
                  >
                    {order.status === "delivered" ? (
                      <Icon name="check" size={16} strokeWidth={2.6} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="rf-stop-copy">
                    <strong>{recipientLabel(order)}</strong>
                    <span>{order.delivery_address}</span>
                    {stopLeg.kind === "pickup" && (
                      <span className="rf-muted">
                        Collect first from {order.pickup_address}
                      </span>
                    )}
                    <div className="rf-meta">
                      <StatusBadge status={order.status} />
                      <span>
                        <Icon name="box" size={14} /> 1 parcel
                      </span>
                      <CodBadge order={order} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <section className="rf-empty">
          <span className="rf-result-mark is-neutral">
            <Icon name="package" size={26} />
          </span>
          <h2>No deliveries assigned</h2>
          <p>New assignments from operations appear here automatically.</p>
        </section>
      )}

      {route.phase !== "idle" && (
        <div className="rf-dock">
          {route.phase === "ready" && (
            <button
              type="button"
              className="rf-btn rf-btn-primary"
              onClick={() => setScreen("start")}
            >
              Start tasks <Icon name="arrow-right" size={18} />
            </button>
          )}
          {route.phase === "active" && (
            <button
              type="button"
              className="rf-btn rf-btn-primary"
              onClick={() => setScreen("navigate")}
            >
              Continue navigation <Icon name="arrow-right" size={18} />
            </button>
          )}
          {route.phase === "complete" && (
            <button
              type="button"
              className="rf-btn rf-btn-secondary"
              onClick={() => setScreen("complete")}
            >
              View route summary
            </button>
          )}
        </div>
      )}

      {activeScreen === "start" && first && firstLeg && (
        <div className="rf-scrim">
          <section
            className="rf-sheet rf-start"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rf-start-title"
          >
            <span className="rf-handle" aria-hidden="true" />
            <div className="rf-sheet-head">
              <h2 id="rf-start-title">Ready to start?</h2>
              <button
                type="button"
                className="rf-icon-btn"
                onClick={() => setScreen("overview")}
                aria-label="Not now"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <p className="rf-muted">
              {route.active.length}{" "}
              {route.active.length === 1 ? "stop" : "stops"} · operations and
              customers see that you’ve accepted them.
            </p>
            <div className="rf-first-stop">
              <span className="rf-stop-num">1</span>
              <div>
                <small>
                  {firstLeg.kind === "pickup"
                    ? "First, collect from"
                    : "First drop-off"}
                </small>
                <strong>{firstLeg.address}</strong>
                <span>
                  {riderPoint && firstLeg.point
                    ? `${formatDistance(distanceKm(riderPoint, firstLeg.point))} straight-line from you`
                    : "Distance shows once GPS is ready"}
                </span>
              </div>
            </div>
            <ul className="rf-checks">
              <ReadyItem
                ok={workspace.isDemo || gpsState === "live"}
                warn={gpsState === "waiting" || gpsState === "stale"}
                label={
                  workspace.isDemo
                    ? "GPS not used for the sample route"
                    : gpsState === "live"
                      ? `GPS ready${position?.accuracy ? ` · ±${Math.round(position.accuracy)} m` : ""}`
                      : gpsState === "waiting"
                        ? "Waiting for GPS…"
                        : gpsState === "denied"
                          ? "Location access is blocked. Allow it in browser settings."
                          : "GPS unavailable on this device"
                }
              />
              <ReadyItem
                ok={online}
                label={
                  online
                    ? "Connected"
                    : "Offline. Starting will wait for a connection."
                }
              />
              <ReadyItem
                ok={energy?.status === "sufficient"}
                warn={!vehicle || energy?.status !== "sufficient"}
                label={
                  vehicle
                    ? (energy?.message ?? "Range not set")
                    : "No vehicle linked to this route"
                }
              />
            </ul>
            {errorBanner}
            <button
              type="button"
              className="rf-btn rf-btn-primary"
              disabled={!online || busy != null}
              onClick={() => void startRoute()}
            >
              <Icon name="navigation" size={18} />
              {busy === "start" ? "Starting…" : "Start navigation"}
            </button>
          </section>
        </div>
      )}
      {menu}
    </main>
  );
}

function ReadyItem({
  ok,
  warn,
  label,
}: {
  ok: boolean;
  warn?: boolean;
  label: string;
}) {
  const tone = ok ? "is-ok" : warn ? "is-warn" : "is-bad";
  return (
    <li className={tone}>
      <Icon name={ok ? "check" : "warning"} size={16} strokeWidth={2.4} />
      {label}
    </li>
  );
}

function SheetHandle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const start = useRef<number | null>(null);
  const dragged = useRef(false);
  return (
    <button
      type="button"
      className="rf-handle-btn"
      aria-expanded={open}
      aria-label={
        open ? "Collapse delivery details" : "Expand delivery details"
      }
      onClick={() => {
        // A drag already toggled the sheet; ignore the click that follows it.
        if (dragged.current) dragged.current = false;
        else onToggle(!open);
      }}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        start.current = event.clientY;
        dragged.current = false;
      }}
      onPointerUp={(event: ReactPointerEvent<HTMLButtonElement>) => {
        if (start.current == null) return;
        const delta = event.clientY - start.current;
        start.current = null;
        if (Math.abs(delta) > 24) {
          dragged.current = true;
          onToggle(delta < 0);
        }
      }}
    >
      <span className="rf-handle" />
    </button>
  );
}
