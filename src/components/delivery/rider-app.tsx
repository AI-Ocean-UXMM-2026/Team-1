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
import {
  type NavCaution,
  type NavStop,
  RiderNavMap,
} from "@/components/delivery/rider-nav-map";
import {
  collectCod,
  type FailureReason,
  recordDeliveryOutcome,
  requestRiderAssistance,
  sendDriverLocation,
  setOrderStatus,
  submitRoadReport,
  updateVehicleEnergy,
} from "@/lib/delivery/actions";
import { currency, formatTime } from "@/lib/delivery/format";
import { formatDriveMinutes } from "@/lib/delivery/mapbox";
import { watchRiderLocations } from "@/lib/delivery/rider-location";
import {
  bearingDegrees,
  buildRiderRoute,
  buildRoutePoints,
  cautionCopy,
  cautionsAlong,
  codDueFor,
  compassDirection,
  currentPickupOrders,
  distanceKm,
  energyForRoute,
  formatDistance,
  formatDuration,
  type GeoPoint,
  hasParcelOnBoard,
  legFor,
  type RoadCaution,
  type RoutePoint,
  routeCodDue,
  summariseRoute,
} from "@/lib/delivery/rider-route";
import type {
  DeliveryOrder,
  DeliveryStatus,
  RiderRequest,
  RiderRequestCategory,
  RoadReport,
  WorkspaceData,
} from "@/lib/delivery/types";
import { useRoadRoute } from "@/lib/delivery/use-road-route";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

type Screen = "overview" | "navigate" | "outcome" | "result" | "complete";

/** Sheets over the map: road cautions, fuel or charge, and the issue flow. */
type Panel = "cautions" | "energy" | "issue";

type IssueChoice =
  | "cannot_deliver"
  | "road"
  | Exclude<RiderRequestCategory, "refuel" | "recharge">;

const ISSUE_CHOICES: { id: IssueChoice; label: string; detail: string }[] = [
  {
    id: "cannot_deliver",
    label: "Can’t deliver this parcel",
    detail: "Recipient not there, wrong address or refused",
  },
  {
    id: "road",
    label: "Road blocked or unsafe road",
    detail: "Flooding, closure, roadwork or a hazard",
  },
  {
    id: "vehicle_problem",
    label: "Vehicle problem",
    detail: "Breakdown, flat tyre, won’t start",
  },
  {
    id: "accident",
    label: "Accident",
    detail: "You or someone else needs help",
  },
  {
    id: "parcel_damaged",
    label: "Parcel damaged",
    detail: "Torn, wet or broken",
  },
  {
    id: "unsafe_area",
    label: "I don’t feel safe here",
    detail: "Operations can reroute or send help",
  },
  { id: "other", label: "Something else", detail: "Tell operations in a note" },
];

const ROAD_CATEGORIES: { id: RoadReport["category"]; label: string }[] = [
  { id: "flooding", label: "Flooding" },
  { id: "closure", label: "Road closed" },
  { id: "roadwork", label: "Roadwork" },
  { id: "congestion", label: "Heavy traffic" },
  { id: "hazard", label: "Hazard" },
];

const ROAD_SEVERITIES: { id: RoadReport["severity"]; label: string }[] = [
  { id: "low", label: "Minor" },
  { id: "medium", label: "Slow" },
  { id: "high", label: "Major" },
  { id: "blocked", label: "Blocked" },
];

const REQUEST_LABELS: Record<RiderRequestCategory, string> = {
  refuel: "Fuel stop",
  recharge: "Charging stop",
  vehicle_problem: "Vehicle problem",
  accident: "Accident",
  parcel_damaged: "Parcel damaged",
  unsafe_area: "Unsafe area",
  other: "Issue",
};

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

/** What the rider does at a point, in the words used across the flow. */
function pointTitle(
  point: RoutePoint,
  stopNumber: (order: DeliveryOrder | null) => number,
) {
  if (point.kind === "pickup")
    return point.orders.length > 1
      ? `Pickup · ${point.orders.length} parcels`
      : `Pickup · ${point.orders[0].tracking_code}`;
  return `${stopNumber(point.orders[0])} · ${recipientLabel(point.orders[0])}`;
}

function PointRow({
  point,
  title,
  number,
}: {
  point: RoutePoint;
  title: string;
  number: number;
}) {
  const order = point.orders[0];
  const pickup = point.kind === "pickup";
  return (
    <li className={`rf-point is-${point.state} is-${point.kind}`}>
      <span className="rf-point-mark" aria-hidden="true">
        {point.state === "done" ? (
          <Icon name="check" size={16} strokeWidth={2.6} />
        ) : point.state === "failed" ? (
          <Icon name="close" size={16} strokeWidth={2.6} />
        ) : pickup ? (
          <Icon name="package" size={16} />
        ) : (
          number
        )}
      </span>
      <div className="rf-point-copy">
        <small>
          {point.state === "current" ? "Now · " : ""}
          {pickup ? "Pickup" : "Drop-off"}
          {!pickup && point.etaAt && point.state !== "done"
            ? ` · ETA ${formatTime(point.etaAt)}`
            : ""}
        </small>
        <strong>
          {pickup
            ? title.replace("Pickup · ", "Collect ")
            : recipientLabel(order)}
        </strong>
        <span>{point.address}</span>
        <div className="rf-meta">
          {point.state === "done" || point.state === "failed" ? (
            <StatusBadge status={order.status} />
          ) : pickup ? (
            <span>
              <Icon name="box" size={14} />
              {point.orders.map((item) => item.tracking_code).join(" · ")}
            </span>
          ) : point.codDue > 0 ? (
            <span className="rf-cod is-due">
              <Icon name="coin" size={14} strokeWidth={2.1} />
              Collect {currency.format(point.codDue)}
            </span>
          ) : (
            <span>
              <Icon name="check" size={14} /> No cash to collect
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function CautionItem({ caution, now }: { caution: RoadCaution; now: number }) {
  const copy = cautionCopy(caution.report);
  const minutes = Math.max(
    0,
    Math.round((now - Date.parse(caution.report.reported_at)) / 60_000),
  );
  return (
    <article className={`rf-caution-item is-${caution.report.severity}`}>
      <span className="rf-caution-icon" aria-hidden="true">
        <Icon name="warning" size={18} />
      </span>
      <div>
        <strong>
          {copy.title} · {copy.impact}
        </strong>
        <p>{caution.report.description}</p>
        <p className="rf-caution-advice">{copy.advice}</p>
        <small>
          {caution.aheadKm < 0.05
            ? "Where you are"
            : `${formatDistance(caution.aheadKm)} ahead`}{" "}
          · reported {minutes < 1 ? "just now" : `${minutes} min ago`} ·{" "}
          {copy.confirmed ? "confirmed by operations" : "not yet confirmed"}
        </small>
      </div>
    </article>
  );
}

function RequestStatus({ request }: { request: RiderRequest }) {
  const label =
    request.status === "resolved"
      ? "Resolved"
      : request.status === "acknowledged"
        ? "Operations is on it"
        : "Waiting for operations";
  return (
    <span className={`rf-request-status is-${request.status}`}>{label}</span>
  );
}

function energyStatusLabel(
  status: ReturnType<typeof energyForRoute>["status"],
) {
  return status === "enough"
    ? "Enough for today"
    : status === "tight"
      ? "Plan a stop"
      : status === "short"
        ? "Not enough"
        : "Range unknown";
}

function energyAdvice(
  energy: ReturnType<typeof energyForRoute>,
  word: "fuel" | "charging",
) {
  if (energy.status === "unknown")
    return energy.levelPercent == null
      ? "Set your current level to check today’s range."
      : "Range shows once the route distance is known.";
  const usable = formatDistance(energy.usableKm);
  const needed = formatDistance(energy.neededKm);
  if (energy.status === "enough")
    return `About ${usable} usable after your reserve, for ${needed} left today.`;
  if (energy.status === "tight")
    return `About ${usable} usable for ${needed} left. Plan a ${word} stop.`;
  return `Only about ${usable} usable for ${needed} left. Get ${word === "fuel" ? "fuel" : "a charge"} before your next drop.`;
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
  const [outcomeStep, setOutcomeStep] = useState<1 | 2 | 3>(1);
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
  // Every place the rider must reach today, worked through one at a time.
  const points = useMemo(() => buildRoutePoints(route), [route]);
  const dropoffPoints = points.filter((point) => point.kind === "dropoff");
  const stopNumber = (order: DeliveryOrder | null) =>
    order
      ? dropoffPoints.findIndex((point) => point.orders[0].id === order.id) + 1
      : 0;
  const currentPoint = points.find((point) => point.state === "current");
  const pointIndex = currentPoint ? points.indexOf(currentPoint) : -1;
  const nextPoint = pointIndex >= 0 ? (points[pointIndex + 1] ?? null) : null;
  const pickupOrders = currentPickupOrders(points);
  const leg = current ? legFor(current) : null;
  const vehicleId =
    current?.vehicle_id ??
    route.active.find((order) => order.vehicle_id)?.vehicle_id ??
    null;
  const vehicle = vehicleId
    ? (workspace.data.vehicles.find((item) => item.id === vehicleId) ?? null)
    : null;
  const codTotal = routeCodDue(route);
  const newTasks = route.active.filter((order) => order.status === "assigned");

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
    setOutcomeStep(1);
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
    (route.phase === "ready" ||
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
  const [shareFailed, setShareFailed] = useState(false);
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
      setShareFailed(false);
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
      onSent: (sentIds, point) => {
        setShareFailed(false);
        setSharing({ count: sentIds.length, at: point.recordedAt });
      },
      // Keep the last good share so the chip can say it has stopped.
      onError: () => setShareFailed(true),
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

  const routeLegs = route.active.flatMap((order) => {
    const point = legFor(order).point;
    return point ? [point] : [];
  });
  // Road routes for the active leg (navigation header) and the whole route (overview).
  const legRoute = useRoadRoute(riderPoint, leg?.point ? [leg.point] : []);
  const routeSummary = useRoadRoute(riderPoint, routeLegs);

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

  // Pickups (until collected) and numbered drop-offs, matching the task list.
  const navStops: NavStop[] = useMemo(() => {
    let dropNumber = 0;
    return points.flatMap((item) => {
      if (item.kind === "dropoff") dropNumber += 1;
      if (!item.point) return [];
      return [
        {
          id: item.orders[0].id,
          number: dropNumber,
          kind: item.kind,
          state:
            item.state === "upcoming"
              ? ("queued" as const)
              : item.state === "current"
                ? ("current" as const)
                : item.state,
          point: item.point,
        },
      ];
    });
  }, [points]);
  const upcomingPoints = useMemo(
    () =>
      points
        .slice(pointIndex + 1)
        .flatMap((item) =>
          item.state === "upcoming" && item.point ? [item.point] : [],
        ),
    [points, pointIndex],
  );

  // Road reports along the way: the current leg drives the banner, the
  // rest of the route feeds the overview and the map markers.
  const legPath: GeoPoint[] = useMemo(() => {
    if (legRoute)
      return legRoute.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      }));
    return [riderPoint, leg?.point ?? null].filter(
      (item): item is GeoPoint => item != null,
    );
  }, [legRoute, riderPoint, leg?.point]);
  const legCautions = useMemo(
    () => cautionsAlong(legPath, workspace.data.roadReports, now),
    [legPath, workspace.data.roadReports, now],
  );
  const routeCautions = useMemo(() => {
    const path = [
      riderPoint,
      ...points
        .filter((item) => item.state === "current" || item.state === "upcoming")
        .map((item) => item.point),
    ].filter((item): item is GeoPoint => item != null);
    return cautionsAlong(path, workspace.data.roadReports, now);
  }, [riderPoint, points, workspace.data.roadReports, now]);
  const navCautions: NavCaution[] = useMemo(
    () =>
      routeCautions.map(({ report }) => ({
        id: report.id,
        point: { latitude: report.latitude, longitude: report.longitude },
        severity: report.severity,
      })),
    [routeCautions],
  );

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
      if (!workspace.isDemo && navigator.onLine) void workspace.refresh(true);
    }
  }

  /** Accepts every newly assigned task; starting the day also opens the map. */
  const acceptTasks = (openMap: boolean) =>
    run("start", async () => {
      for (const order of route.active)
        if (order.status === "assigned") await changeStatus(order, "accepted");
      setSheetOpen(false);
      if (openMap) setScreen("navigate");
    });

  // Every parcel waiting at this pickup is collected in one step.
  const confirmPickup = () =>
    run("pickup", async () => {
      const batch = pickupOrders.length
        ? pickupOrders
        : current
          ? [current]
          : [];
      for (const order of batch) {
        if (order.status === "assigned") await changeStatus(order, "accepted");
        if (order.status === "assigned" || order.status === "accepted")
          await changeStatus({ ...order, status: "accepted" }, "picked_up");
        await changeStatus({ ...order, status: "picked_up" }, "in_transit");
      }
      setArrived((ids) =>
        ids.filter((id) => !batch.some((order) => order.id === id)),
      );
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

  /* ---------------- fuel, issues and road reports ---------------- */

  const [panel, setPanel] = useState<Panel | null>(null);
  const [panelDone, setPanelDone] = useState<string | null>(null);
  const [energyLevel, setEnergyLevel] = useState("");
  const [energyNote, setEnergyNote] = useState("");
  const [issue, setIssue] = useState<IssueChoice | null>(null);
  const [issueNote, setIssueNote] = useState("");
  const [roadCategory, setRoadCategory] =
    useState<RoadReport["category"]>("flooding");
  const [roadSeverity, setRoadSeverity] =
    useState<RoadReport["severity"]>("medium");
  const routeEnergy = energyForRoute(
    vehicle,
    routeSummary?.distanceKm ?? remainingDistance,
    routeSummary != null,
  );
  const myRequests = workspace.data.riderRequests.filter(
    (request) => request.driver_id === driverId,
  );
  const openEnergyRequest = myRequests.find(
    (request) => request.kind === "energy" && request.status !== "resolved",
  );

  const openPanel = (next: Panel) => {
    setActionError(null);
    setPanelDone(null);
    setIssue(null);
    setIssueNote("");
    setPanel(next);
  };

  useEffect(() => {
    if (!panel && !menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanel(null);
      setMenuOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [panel, menuOpen]);

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
    });

  /** Sends a fuel, charging or issue request to dispatch with where the rider is. */
  const requestHelp = (category: RiderRequestCategory, note: string) =>
    run("request", async () => {
      if (!driverId) return;
      const record: RiderRequest = {
        id: `local-${Date.now()}`,
        driver_id: driverId,
        driver_name: workspace.profile?.full_name ?? "Rider",
        order_id: current?.id ?? null,
        vehicle_id: vehicle?.id ?? null,
        kind:
          category === "refuel" || category === "recharge" ? "energy" : "issue",
        category,
        note: note.trim() || null,
        energy_level_percent: routeEnergy.levelPercent,
        latitude: riderPoint?.latitude ?? null,
        longitude: riderPoint?.longitude ?? null,
        status: "open",
        created_at: new Date().toISOString(),
        acknowledged_at: null,
        resolved_at: null,
      };
      if (!workspace.isDemo)
        await requestRiderAssistance(createClient(), {
          driverId,
          orderId: record.order_id,
          vehicleId: record.vehicle_id,
          category,
          note,
          energyLevelPercent: record.energy_level_percent,
          latitude: record.latitude,
          longitude: record.longitude,
        });
      workspace.updateData((previous) => ({
        ...previous,
        riderRequests: [record, ...previous.riderRequests],
      }));
      setEnergyNote("");
      setIssueNote("");
      setPanelDone(
        category === "refuel" || category === "recharge"
          ? "Operations has your request and your location. Keep riding only if it’s safe."
          : "Sent to operations with your location and this stop. They’ll contact you.",
      );
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
          description: issueNote,
          latitude: point.latitude,
          longitude: point.longitude,
        });
      setIssueNote("");
      setPanelDone(
        "Road report sent. Operations checks it before it changes anyone’s ETA.",
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
  ) : workspace.isStale ? (
    <Notice tone="warning" icon="warning">
      <strong>Showing your saved route.</strong> We couldn’t reach the server.
      It will refresh when the connection returns.
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
                ? `${vehicle.registration_number} · ${vehicle.vehicle_type.replace("_", "-")}`
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
        <div className="rf-menu-block">
          <h3>Your requests to operations</h3>
          {myRequests.length ? (
            <ul className="rf-request-list">
              {myRequests.slice(0, 5).map((request) => (
                <li key={request.id}>
                  <span>
                    <strong>{REQUEST_LABELS[request.category]}</strong>
                    <small>{formatTime(request.created_at)}</small>
                  </span>
                  <RequestStatus request={request} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rf-muted">
              Fuel, charging and issue requests you send appear here.
            </p>
          )}
        </div>
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

  const closePanel = () => setPanel(null);
  const panelSheet = (title: string, body: ReactNode, subtitle?: string) => (
    <div className="rf-scrim">
      <section
        className="rf-sheet rf-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rf-panel-title"
      >
        <span className="rf-handle" aria-hidden="true" />
        <div className="rf-sheet-head">
          <div>
            <h2 id="rf-panel-title">{title}</h2>
            {subtitle && <p className="rf-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="rf-icon-btn"
            onClick={closePanel}
            aria-label={`Close ${title.toLowerCase()}`}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {body}
      </section>
    </div>
  );

  const legIds = new Set(legCautions.map((item) => item.report.id));
  const laterCautions = routeCautions.filter(
    (item) => !legIds.has(item.report.id),
  );
  const cautionsSheet =
    panel === "cautions"
      ? panelSheet(
          "Road cautions",
          <div className="rf-panel-body">
            {legCautions.length > 0 && (
              <section className="rf-caution-group">
                <h3>On the way to this stop</h3>
                {legCautions.map((item) => (
                  <CautionItem key={item.report.id} caution={item} now={now} />
                ))}
              </section>
            )}
            {laterCautions.length > 0 && (
              <section className="rf-caution-group">
                <h3>Later on today’s route</h3>
                {laterCautions.map((item) => (
                  <CautionItem key={item.report.id} caution={item} now={now} />
                ))}
              </section>
            )}
            {!routeCautions.length && (
              <p className="rf-muted">
                No road reports near your route right now.
              </p>
            )}
            <button
              type="button"
              className="rf-btn rf-btn-secondary"
              onClick={() => {
                openPanel("issue");
                setIssue("road");
              }}
            >
              <Icon name="warning" size={18} /> Report a road condition
            </button>
          </div>,
          "Reports from riders near your route. Confirmed ones already count in your ETA.",
        )
      : null;

  const energyWord = routeEnergy.source === "battery" ? "charging" : "fuel";
  const energySheet =
    panel === "energy"
      ? panelSheet(
          routeEnergy.source === "battery" ? "Battery" : "Fuel",
          <div className="rf-panel-body">
            <div className={`rf-gauge is-${routeEnergy.status}`}>
              <div className="rf-gauge-row">
                <strong>
                  {routeEnergy.levelPercent == null
                    ? "—"
                    : `${routeEnergy.levelPercent}%`}
                </strong>
                <span>{energyStatusLabel(routeEnergy.status)}</span>
              </div>
              <span className="rf-gauge-bar" aria-hidden="true">
                <span style={{ width: `${routeEnergy.levelPercent ?? 0}%` }} />
              </span>
              <p>{energyAdvice(routeEnergy, energyWord)}</p>
            </div>
            {vehicle && (
              <div className="rf-inline-field">
                <label className="rf-field">
                  <span>Update current level (%)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={energyLevel}
                    placeholder={String(routeEnergy.levelPercent ?? "")}
                    onChange={(event) => setEnergyLevel(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="rf-btn rf-btn-secondary"
                  disabled={energyLevel === "" || busy != null}
                  onClick={() => void saveEnergy()}
                >
                  {busy === "energy" ? "Saving…" : "Save"}
                </button>
              </div>
            )}
            {openEnergyRequest ? (
              <>
                {panelDone && (
                  <Notice tone="success" icon="check">
                    {panelDone}
                  </Notice>
                )}
                <div className="rf-request-card">
                  <span>
                    <strong>
                      {REQUEST_LABELS[openEnergyRequest.category]}
                    </strong>
                    <small>
                      Requested {formatTime(openEnergyRequest.created_at)}
                    </small>
                  </span>
                  <RequestStatus request={openEnergyRequest} />
                </div>
              </>
            ) : panelDone ? (
              <Notice tone="success" icon="check">
                {panelDone}
              </Notice>
            ) : (
              <>
                <label className="rf-field">
                  <span>Note for operations (optional)</span>
                  <textarea
                    value={energyNote}
                    maxLength={500}
                    placeholder={
                      routeEnergy.source === "battery"
                        ? "Battery at 20%, 3 drops left"
                        : "Fuel light on, 3 drops left"
                    }
                    onChange={(event) => setEnergyNote(event.target.value)}
                  />
                </label>
                {errorBanner}
                <button
                  type="button"
                  className="rf-btn rf-btn-primary"
                  disabled={busy != null}
                  onClick={() =>
                    void requestHelp(
                      routeEnergy.source === "battery" ? "recharge" : "refuel",
                      energyNote,
                    )
                  }
                >
                  <Icon
                    name={routeEnergy.source === "battery" ? "battery" : "fuel"}
                    size={18}
                  />
                  {busy === "request"
                    ? "Sending…"
                    : routeEnergy.source === "battery"
                      ? "Request a charging stop"
                      : "Request a fuel stop"}
                </button>
              </>
            )}
          </div>,
          vehicle
            ? `${vehicle.registration_number} · ${vehicle.vehicle_type.replace("_", "-")}`
            : "No vehicle is linked to your route",
        )
      : null;

  const issueChoice = ISSUE_CHOICES.find((item) => item.id === issue);
  const issueSheet =
    panel === "issue"
      ? panelSheet(
          issue === "road"
            ? "Report a road condition"
            : (issueChoice?.label ?? "Report an issue"),
          <div className="rf-panel-body">
            {panelDone ? (
              <>
                <Notice tone="success" icon="check">
                  {panelDone}
                </Notice>
                <button
                  type="button"
                  className="rf-btn rf-btn-primary"
                  onClick={closePanel}
                >
                  Back to the map
                </button>
              </>
            ) : issue == null ? (
              <ul className="rf-issue-list">
                {ISSUE_CHOICES.filter(
                  (item) =>
                    item.id !== "cannot_deliver" ||
                    (currentPoint?.kind === "dropoff" && current != null),
                ).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.id === "cannot_deliver") {
                          closePanel();
                          updateDraft({ outcome: "failed" });
                          setOutcomeStep(2);
                          setScreen("outcome");
                          return;
                        }
                        setIssue(item.id);
                      }}
                    >
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <Icon name="arrow-right" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : issue === "road" ? (
              <form
                className="rf-form"
                onSubmit={(event) => void sendRoadReport(event)}
              >
                <p className="rf-muted">
                  Send only when you’ve stopped safely. Operations checks
                  reports before they change ETAs.
                </p>
                <fieldset className="rf-option-group">
                  <legend>What’s on the road?</legend>
                  {ROAD_CATEGORIES.map((item) => (
                    <label
                      key={item.id}
                      className={`rf-option ${roadCategory === item.id ? "is-selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="road-category"
                        checked={roadCategory === item.id}
                        onChange={() => setRoadCategory(item.id)}
                      />
                      {item.label}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="rf-option-group">
                  <legend>How bad is it?</legend>
                  {ROAD_SEVERITIES.map((item) => (
                    <label
                      key={item.id}
                      className={`rf-option ${roadSeverity === item.id ? "is-selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="road-severity"
                        checked={roadSeverity === item.id}
                        onChange={() => setRoadSeverity(item.id)}
                      />
                      {item.label}
                    </label>
                  ))}
                </fieldset>
                <label className="rf-field">
                  <span>What did you see?</span>
                  <textarea
                    value={issueNote}
                    minLength={3}
                    maxLength={240}
                    required
                    placeholder="Water over the road after the bridge"
                    onChange={(event) => setIssueNote(event.target.value)}
                  />
                </label>
                {errorBanner}
                <button
                  type="submit"
                  className="rf-btn rf-btn-primary"
                  disabled={issueNote.trim().length < 3 || busy != null}
                >
                  <Icon name="location" size={18} />
                  {busy === "road" ? "Sending…" : "Send with my location"}
                </button>
              </form>
            ) : (
              <form
                className="rf-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void requestHelp(issue as RiderRequestCategory, issueNote);
                }}
              >
                {issue === "accident" && (
                  <Notice tone="error" icon="warning">
                    <strong>If anyone is hurt, get help first.</strong> Call
                    emergency services, then send this so operations can cover
                    your deliveries.
                  </Notice>
                )}
                <p className="rf-muted">
                  Operations gets your location
                  {current ? `, stop ${stopNumber(current)}` : ""} and vehicle
                  with this.
                </p>
                <label className="rf-field">
                  <span>
                    {issue === "other"
                      ? "What happened?"
                      : "Anything they should know? (optional)"}
                  </span>
                  <textarea
                    value={issueNote}
                    maxLength={500}
                    required={issue === "other"}
                    placeholder={
                      issue === "vehicle_problem"
                        ? "Rear tyre flat, can walk it 200 m"
                        : issue === "parcel_damaged"
                          ? "Box wet from rain, item looks fine"
                          : "Short note for the dispatcher"
                    }
                    onChange={(event) => setIssueNote(event.target.value)}
                  />
                </label>
                {errorBanner}
                <button
                  type="submit"
                  className="rf-btn rf-btn-primary"
                  disabled={
                    busy != null ||
                    (issue === "other" && issueNote.trim().length < 3)
                  }
                >
                  {busy === "request" ? "Sending…" : "Send to operations"}
                </button>
              </form>
            )}
            {issue != null && !panelDone && (
              <button
                type="button"
                className="rf-btn rf-btn-quiet"
                onClick={() => setIssue(null)}
              >
                Choose a different problem
              </button>
            )}
          </div>,
          issue == null
            ? currentPoint
              ? `${currentPoint.kind === "pickup" ? "Pickup" : `Stop ${stopNumber(current)}`} · ${currentPoint.address}`
              : undefined
            : undefined,
        )
      : null;

  const sheets = (
    <>
      {cautionsSheet}
      {energySheet}
      {issueSheet}
      {menu}
    </>
  );

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
        {next && nextLeg && currentPoint ? (
          <section className="rf-next-card">
            <span
              className={`rf-stop-num ${currentPoint.kind === "pickup" ? "is-pickup" : ""}`}
            >
              {currentPoint.kind === "pickup" ? (
                <Icon name="package" size={16} />
              ) : (
                stopNumber(next)
              )}
            </span>
            <div>
              <small>
                {currentPoint.kind === "pickup"
                  ? "Next · pickup"
                  : "Next · deliver to"}
              </small>
              <strong>
                {currentPoint.kind === "pickup"
                  ? currentPoint.orders.length > 1
                    ? `Collect ${currentPoint.orders.length} parcels`
                    : `Collect ${next.tracking_code}`
                  : recipientLabel(next)}
              </strong>
              <p>{currentPoint.address}</p>
              <div className="rf-meta">
                <span>
                  <Icon name="navigation" size={15} />
                  {formatDistance(nextDistance)} direct
                </span>
                {currentPoint.kind === "dropoff" && currentPoint.etaAt && (
                  <span>
                    <Icon name="history" size={15} />
                    ETA {formatTime(currentPoint.etaAt)}
                  </span>
                )}
              </div>
              {currentPoint.kind === "dropoff" && currentPoint.codDue > 0 ? (
                <span className="rf-cod is-due">
                  <Icon name="coin" size={14} strokeWidth={2.1} />
                  Collect {currency.format(currentPoint.codDue)}
                </span>
              ) : (
                <span className="rf-muted">
                  {currentPoint.kind === "pickup"
                    ? "No cash at pickup"
                    : "No cash to collect"}
                </span>
              )}
            </div>
          </section>
        ) : null}
        <div className="rf-dock">
          <button
            type="button"
            className="rf-btn rf-btn-primary"
            onClick={() => {
              setSheetOpen(false);
              // Unaccepted tasks go back to the list, where the rider slides to start.
              setScreen(
                route.phase === "ready"
                  ? "overview"
                  : next
                    ? "navigate"
                    : "complete",
              );
            }}
          >
            {route.phase === "ready"
              ? "Review next tasks"
              : next
                ? "Navigate to next stop"
                : "See route summary"}
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
        {sheets}
      </main>
    );
  }

  /* ----- Screen 5: report outcome (stepped: result → details → confirm) ----- */
  if (activeScreen === "outcome" && current) {
    const stepLabels = [
      "Result",
      draft.outcome === "failed" ? "Reason" : "Details",
      "Confirm",
    ];
    const goBack = () => {
      if (outcomeStep > 1)
        setOutcomeStep((step) => (step === 3 ? 2 : 1) as 1 | 2 | 3);
      else setScreen("navigate");
    };
    return (
      <main className="rf-app rf-outcome">
        <header className="rf-topbar">
          <button
            type="button"
            className="rf-icon-btn"
            onClick={goBack}
            aria-label={outcomeStep > 1 ? "Previous step" : "Back to the map"}
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
        <ol className="rf-step-dots" aria-label={`Step ${outcomeStep} of 3`}>
          {stepLabels.map((label, index) => {
            const step = index + 1;
            return (
              <li
                key={label}
                className={
                  step === outcomeStep
                    ? "is-current"
                    : step < outcomeStep
                      ? "is-done"
                      : ""
                }
              >
                <span aria-hidden="true" />
                {label}
              </li>
            );
          })}
        </ol>
        {connectivityBanner}

        {outcomeStep === 1 && (
          <>
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
                  onChange={() => {
                    updateDraft({ outcome: "delivered" });
                    setOutcomeStep(2);
                  }}
                  onClick={() => {
                    // onChange never fires for the choice that is already
                    // selected (after going back or a reload).
                    updateDraft({ outcome: "delivered" });
                    setOutcomeStep(2);
                  }}
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
                  onChange={() => {
                    updateDraft({ outcome: "failed" });
                    setOutcomeStep(2);
                  }}
                  onClick={() => {
                    // onChange never fires for the choice that is already
                    // selected (after going back or a reload).
                    updateDraft({ outcome: "failed" });
                    setOutcomeStep(2);
                  }}
                />
                <span className="rf-choice-mark">
                  <Icon name="close" size={22} strokeWidth={2.4} />
                </span>
                Unable to deliver
              </label>
            </fieldset>
          </>
        )}

        {outcomeStep === 2 && draft.outcome === "delivered" && (
          <>
            <h1>Delivery details</h1>
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
                      updateDraft({
                        recipientName: current.recipient_name ?? "",
                      })
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
                  onChange={(event) =>
                    updateDraft({ note: event.target.value })
                  }
                />
              </label>
            </div>
            {errorBanner}
            <div className="rf-dock">
              <button
                type="button"
                className="rf-btn rf-btn-primary"
                disabled={!outcomeReady}
                onClick={() => setOutcomeStep(3)}
              >
                Continue <Icon name="arrow-right" size={18} />
              </button>
            </div>
          </>
        )}

        {outcomeStep === 2 && draft.outcome === "failed" && (
          <>
            <h1>What happened?</h1>
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
                  onChange={(event) =>
                    updateDraft({ note: event.target.value })
                  }
                />
              </label>
            </div>
            {errorBanner}
            <div className="rf-dock">
              <button
                type="button"
                className="rf-btn rf-btn-primary"
                disabled={!outcomeReady}
                onClick={() => setOutcomeStep(3)}
              >
                Continue <Icon name="arrow-right" size={18} />
              </button>
            </div>
          </>
        )}

        {outcomeStep === 3 && (
          <>
            <h1>
              {draft.outcome === "delivered"
                ? "Confirm delivery"
                : "Confirm outcome"}
            </h1>
            <section className="rf-review-card">
              <div className="rf-review-row">
                <span>Outcome</span>
                <strong
                  className={
                    draft.outcome === "delivered" ? "is-success" : "is-failed"
                  }
                >
                  {draft.outcome === "delivered"
                    ? "Delivered"
                    : "Not delivered"}
                </strong>
              </div>
              {draft.outcome === "delivered" && (
                <div className="rf-review-row">
                  <span>Received by</span>
                  <strong>{draft.recipientName || "Not noted"}</strong>
                </div>
              )}
              {draft.outcome === "delivered" && codNeeded && (
                <div className="rf-review-row">
                  <span>Cash on delivery</span>
                  <strong>
                    {draft.codConfirmed
                      ? `${currency.format(codValue ?? 0)} collected`
                      : "Not collected"}
                  </strong>
                </div>
              )}
              {draft.outcome === "failed" && (
                <div className="rf-review-row">
                  <span>Reason</span>
                  <strong>
                    {
                      FAILURE_REASONS.find(
                        (reason) => reason.id === draft.failureReason,
                      )?.label
                    }
                  </strong>
                </div>
              )}
              {draft.note.trim() && (
                <div className="rf-review-row">
                  <span>Note</span>
                  <strong>{draft.note}</strong>
                </div>
              )}
            </section>
            <p className="rf-muted">
              {draft.outcome === "delivered"
                ? `${recipientLabel(current)} will see the parcel as delivered.`
                : `${recipientLabel(current)} and operations will see a delivery issue.`}
              {codNeeded && draft.outcome === "delivered"
                ? draft.codConfirmed && !codMismatch
                  ? ` COD ${currency.format(codExpected)} will be recorded as collected.`
                  : " COD will stay open with your note."
                : ""}{" "}
              This can’t be undone from the app.
            </p>
            {errorBanner}
            <div className="rf-dock">
              <div className="rf-confirm-actions">
                <button
                  type="button"
                  className="rf-btn rf-btn-quiet"
                  onClick={() => setOutcomeStep(2)}
                  disabled={busy != null}
                >
                  Edit details
                </button>
                <SlideToConfirm
                  label={
                    draft.outcome === "failed"
                      ? "Slide to submit"
                      : "Slide to confirm delivery"
                  }
                  busyLabel="Saving…"
                  busy={busy === "outcome"}
                  disabled={!online}
                  onConfirm={() => void submitOutcome()}
                />
              </div>
              {!online && (
                <p className="rf-dock-note">
                  Waiting for a connection. Your entries are kept.
                </p>
              )}
            </div>
          </>
        )}
      </main>
    );
  }

  /* ----- Screens 3 + 4: full-screen navigation, one point at a time ----- */
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
          : legRoute?.firstStep
            ? {
                title: legRoute.firstStep.instruction,
                sub: `${formatDistance(legRoute.distanceKm)} · ${formatDriveMinutes(legRoute.durationMin)} by road to ${pickup ? "pickup" : "drop-off"}`,
              }
            : {
                title: `Head ${compassDirection(legBearing ?? 0)}`,
                sub: `${formatDistance(legDistance)} straight-line to ${pickup ? "pickup" : "drop-off"}`,
              };
    const etaText =
      !pickup && current.estimated_delivery_at
        ? formatTime(current.estimated_delivery_at)
        : null;
    // While moving, the phone's heading; at the start (or standing still) the
    // way to the next point, so the map opens already turned the right way.
    const navHeading = workspace.isDemo
      ? legBearing
      : (position?.heading ?? legBearing);
    const parcelsHere = pickupOrders.length ? pickupOrders : [current];
    const dropsDone = dropoffPoints.filter(
      (item) => item.state === "done" || item.state === "failed",
    ).length;
    const codHere = currentPoint?.codDue ?? 0;
    const codLater = pickup
      ? parcelsHere.reduce((sum, order) => sum + codDueFor(order), 0)
      : 0;
    const nextCaution = legCautions[0] ?? null;
    const nextCautionCopy = nextCaution
      ? cautionCopy(nextCaution.report)
      : null;
    const confirmedOnLeg = legCautions.filter(
      (item) => item.report.status === "verified",
    ).length;
    const nextLabel = nextPoint ? pointTitle(nextPoint, stopNumber) : null;
    const nextDistance =
      nextPoint?.point && leg.point
        ? distanceKm(leg.point, nextPoint.point)
        : null;

    return (
      <main className="rf-app rf-nav">
        <RiderNavMap
          driver={riderPoint}
          heading={navHeading}
          follow
          target={leg.point ? { ...leg.point, kind: leg.kind } : null}
          targetId={current.id}
          stops={navStops}
          upcoming={upcomingPoints}
          cautions={navCautions}
          padding={{
            x: 56,
            top: nextCaution ? 236 : 168,
            bottom: sheetOpen ? Math.round(viewHeight * 0.6) + 16 : 300,
          }}
          road={legRoute}
          label={`Map to ${pickup ? "pickup" : `drop-off ${stopNumber(current)} of ${dropoffPoints.length}`}: ${leg.address}`}
        />

        <header className="rf-nav-top">
          <div
            className="rf-route-progress"
            role="progressbar"
            aria-label="Drop-offs completed"
            aria-valuemin={0}
            aria-valuemax={dropoffPoints.length}
            aria-valuenow={dropsDone}
          >
            <span
              style={{
                width: `${(dropsDone / Math.max(1, dropoffPoints.length)) * 100}%`,
              }}
            />
          </div>
          <div className="rf-nav-instruction">
            <span className="rf-turn" aria-hidden="true">
              {leg.point && riderPoint && !atTarget ? (
                <svg
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                  style={{
                    transform: `rotate(${(legBearing ?? 0) - (navHeading ?? 0)}deg)`,
                  }}
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
          </div>
          {nextCaution && nextCautionCopy && (
            <button
              type="button"
              className={`rf-caution-banner is-${nextCaution.report.severity}`}
              onClick={() => openPanel("cautions")}
            >
              <Icon name="warning" size={20} />
              <span>
                <strong>
                  {nextCautionCopy.title} ·{" "}
                  {nextCaution.aheadKm < 0.05
                    ? "here"
                    : `${formatDistance(nextCaution.aheadKm)} ahead`}
                </strong>
                <small>{nextCautionCopy.advice}</small>
              </span>
              {legCautions.length > 1 && (
                <span className="rf-caution-count">
                  +{legCautions.length - 1}
                </span>
              )}
            </button>
          )}
          <div className="rf-nav-chips">
            <button
              type="button"
              className={`rf-chip-btn is-energy is-${routeEnergy.status}`}
              onClick={() => openPanel("energy")}
              aria-label={`${routeEnergy.source === "battery" ? "Battery" : "Fuel"} ${routeEnergy.levelPercent ?? "unknown"}%: check range or request a stop`}
            >
              <Icon
                name={routeEnergy.source === "battery" ? "battery" : "fuel"}
                size={16}
              />
              {routeEnergy.levelPercent == null
                ? routeEnergy.source === "battery"
                  ? "Battery"
                  : "Fuel"
                : `${routeEnergy.levelPercent}%`}
            </button>
            <button
              type="button"
              className="rf-chip-btn is-issue"
              onClick={() => openPanel("issue")}
              aria-label="Report an issue"
            >
              <Icon name="warning" size={16} /> Issue
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
            ) : shareFailed ||
              (sharing &&
                now - Date.parse(sharing.at) > STALE_AFTER_MS * 2) ? (
              <span className="rf-chip is-error">
                <Icon name="warning" size={14} /> Customers can’t see your
                location
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
              aria-label="Shift tools"
            >
              <Icon name="menu" size={20} />
            </button>
          </div>
        </header>

        <section
          className={`rf-sheet rf-nav-sheet ${sheetOpen ? "is-open" : ""}`}
          aria-label="Current point"
        >
          <SheetHandle open={sheetOpen} onToggle={setSheetOpen} />
          {/* Grab Driver's layout: stop count, coloured step title, a round
              Navigate button, then the money, three quick actions and one big
              action. */}
          <div className="rg-head">
            <div className="rg-count">
              <strong>
                {pickup ? parcelsHere.length : stopNumber(current)}
              </strong>
              <span>{pickup ? "Parcels" : "Stop"}</span>
            </div>
            <div className="rg-title">
              <h2>
                {pickup
                  ? "Collect parcels"
                  : `${stopNumber(current)}. Hand over parcel`}
              </h2>
              <span>
                {pickup
                  ? parcelsHere.map((order) => order.tracking_code).join(" · ")
                  : recipientLabel(current)}
              </span>
            </div>
            <a
              className="rg-navigate"
              href={mapsUrl(legDestination(current))}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open turn-by-turn directions in Google Maps"
            >
              <Icon name="navigation" size={22} />
              <span>Navigate</span>
            </a>
          </div>
          <p className="rf-address">{leg.address}</p>

          <div className="rg-money">
            {pickup ? (
              <>
                <strong>No cash here</strong>
                {codLater > 0 && (
                  <span className="rg-badge">
                    {currency.format(codLater)} at drop-offs
                  </span>
                )}
              </>
            ) : codHere > 0 ? (
              <>
                <strong>{currency.format(codHere)}</strong>
                <span className="rg-badge is-cod">Collect cash</span>
              </>
            ) : (
              <>
                <strong>No cash to collect</strong>
                <span className="rg-badge">
                  {current.cod_amount > 0 ? "Already recorded" : "Prepaid"}
                </span>
              </>
            )}
            <span className="rg-eta">
              {etaText ? `${etaText} · ` : ""}
              {formatDistance(legDistance)}
            </span>
          </div>

          <fieldset className="rg-actions">
            <legend className="rf-sr-only">Quick actions for this point</legend>
            {!pickup && current.recipient_phone ? (
              <a href={`tel:${current.recipient_phone.replace(/\s+/g, "")}`}>
                <Icon name="phone" size={20} />
                <span>Call</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(leg.address)}
              >
                <Icon name="copy" size={20} />
                <span>Copy address</span>
              </button>
            )}
            {!pickup && current.recipient_phone ? (
              <a href={`sms:${current.recipient_phone.replace(/\s+/g, "")}`}>
                <Icon name="message" size={20} />
                <span>Message</span>
              </a>
            ) : (
              <button type="button" onClick={() => setSheetOpen(!sheetOpen)}>
                <Icon name="box" size={20} />
                <span>{pickup ? "Parcels" : "Details"}</span>
              </button>
            )}
            <button type="button" onClick={() => openPanel("issue")}>
              <Icon name="help" size={20} />
              <span>Help</span>
            </button>
          </fieldset>

          {sheetOpen && (
            <div className="rf-sheet-body">
              {!pickup && current.traffic_delay_minutes > 0 && (
                <Notice tone="warning" icon="history">
                  ETA includes about {current.traffic_delay_minutes} min for{" "}
                  {confirmedOnLeg > 1
                    ? `${confirmedOnLeg} confirmed road reports`
                    : "confirmed road reports"}{" "}
                  on this trip.
                </Notice>
              )}
              {!pickup && (
                <div className="rf-detail">
                  <h3>Recipient</h3>
                  <p>
                    {recipientLabel(current)}
                    {current.recipient_phone
                      ? ` · ${current.recipient_phone}`
                      : ""}
                  </p>
                  {!current.recipient_phone && (
                    <p className="rf-muted">
                      No phone number on this order. Use Help if you can’t find
                      the recipient.
                    </p>
                  )}
                </div>
              )}
              <div className="rf-detail">
                <h3>{parcelsHere.length > 1 ? "Parcels" : "Parcel"}</h3>
                {parcelsHere.map((order) => (
                  <p key={order.id}>
                    {order.tracking_code} ·{" "}
                    {order.parcel_description ?? "No description"}
                    {order.parcel_weight_kg
                      ? ` · ${order.parcel_weight_kg} kg`
                      : ""}
                    {order.parcel_weight_kg != null &&
                    order.parcel_weight_kg >= 5
                      ? " · heavy"
                      : ""}
                  </p>
                ))}
              </div>
              {nextPoint && nextLabel && (
                <div className="rf-detail">
                  <h3>Then</h3>
                  <p>
                    {nextLabel} · {nextPoint.address}
                    {nextDistance != null
                      ? ` · ${formatDistance(nextDistance)} from here`
                      : ""}
                  </p>
                </div>
              )}
            </div>
          )}

          {errorBanner}
          <div className="rg-primary">
            {!hasArrived ? (
              <button
                type="button"
                className="rf-btn rf-btn-primary"
                onClick={() => {
                  setArrived((ids) => [...new Set([...ids, current.id])]);
                  setSheetOpen(true);
                }}
              >
                I’ve arrived
              </button>
            ) : pickup ? (
              <button
                type="button"
                className="rf-btn rf-btn-primary"
                disabled={busy != null}
                onClick={() => void confirmPickup()}
              >
                {busy === "pickup"
                  ? "Saving…"
                  : parcelsHere.length > 1
                    ? `${parcelsHere.length} parcels collected`
                    : "Parcel collected"}
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
                Hand over parcel
              </button>
            )}
            <button
              type="button"
              className="rg-round"
              onClick={() => setScreen("overview")}
              aria-label="All points and today’s tasks"
            >
              <Icon name="list" size={22} />
            </button>
          </div>
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
        </section>
        {sheets}
      </main>
    );
  }

  /* ----- Screens 1 + 2: today's task list and slide to start ----- */
  const remainingPoints = points.filter(
    (item) => item.state === "current" || item.state === "upcoming",
  );
  const dropsLeft = remainingPoints.filter(
    (item) => item.kind === "dropoff",
  ).length;
  const pickupsLeft = remainingPoints.length - dropsLeft;
  const lastEta = route.active
    .map((order) => order.estimated_delivery_at)
    .filter((value): value is string => value != null)
    .sort()
    .at(-1);
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Yangon",
  }).format(now || Date.now());
  const firstCaution = routeCautions[0] ?? null;
  const readiness = (
    <ul className="rf-checks is-inline" aria-label="Ready to ride">
      <ReadyItem
        ok={workspace.isDemo || gpsState === "live"}
        warn={gpsState === "waiting" || gpsState === "stale"}
        label={
          workspace.isDemo
            ? "Sample GPS"
            : gpsState === "live"
              ? "GPS ready"
              : gpsState === "waiting"
                ? "Finding GPS…"
                : gpsState === "denied"
                  ? "Allow location"
                  : "No GPS"
        }
      />
      <ReadyItem ok={online} label={online ? "Online" : "Offline"} />
      <ReadyItem
        ok={routeEnergy.status === "enough"}
        warn={routeEnergy.status !== "short"}
        label={
          routeEnergy.levelPercent == null
            ? "Set fuel level"
            : `${routeEnergy.source === "battery" ? "Battery" : "Fuel"} ${routeEnergy.levelPercent}%`
        }
      />
    </ul>
  );

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
          aria-label="Shift tools"
        >
          <Icon name="menu" size={20} />
        </button>
      </header>
      <h1>Today’s tasks</h1>
      <p className="rf-muted rf-subtitle">
        {dayLabel}
        {remainingPoints.length
          ? ` · ${dropsLeft} ${dropsLeft === 1 ? "drop-off" : "drop-offs"}${pickupsLeft ? ` · ${pickupsLeft} ${pickupsLeft === 1 ? "pickup" : "pickups"}` : ""} left`
          : ""}
      </p>
      {workspace.isDemo && (
        <Notice tone="neutral" icon="shield">
          Sample route. Nothing you do here is saved or shared.
        </Notice>
      )}
      {connectivityBanner}
      {errorBanner}

      {route.stops.length ? (
        <>
          <section className="rf-task-summary" aria-label="Route summary">
            <div className="rf-task-cash">
              <Icon name="coin" size={22} />
              <span>
                <small>Cash to collect today</small>
                <strong>{currency.format(codTotal)}</strong>
              </span>
            </div>
            <dl>
              <div>
                <dt>Points left</dt>
                <dd>{remainingPoints.length}</dd>
              </div>
              <div>
                <dt>{routeSummary ? "By road" : "Direct"}</dt>
                <dd>
                  {formatDistance(
                    routeSummary?.distanceKm ?? remainingDistance,
                  )}
                </dd>
              </div>
              <div>
                <dt>{routeSummary ? "Ride time" : "Last ETA"}</dt>
                <dd>
                  {routeSummary
                    ? formatDriveMinutes(routeSummary.durationMin)
                    : lastEta
                      ? formatTime(lastEta)
                      : "—"}
                </dd>
              </div>
            </dl>
          </section>

          {firstCaution && (
            <button
              type="button"
              className={`rf-caution-banner is-${firstCaution.report.severity} is-inline`}
              onClick={() => openPanel("cautions")}
            >
              <Icon name="warning" size={20} />
              <span>
                <strong>
                  {routeCautions.length}{" "}
                  {routeCautions.length === 1
                    ? "road caution"
                    : "road cautions"}{" "}
                  on your route
                </strong>
                <small>
                  {cautionCopy(firstCaution.report).title} ·{" "}
                  {cautionCopy(firstCaution.report).impact} ·{" "}
                  {firstCaution.report.description}
                </small>
              </span>
            </button>
          )}

          {route.phase === "active" && newTasks.length > 0 && (
            <Notice tone="info" icon="plus">
              <strong>
                {newTasks.length} new {newTasks.length === 1 ? "task" : "tasks"}
              </strong>{" "}
              added to your route. Slide below to accept.
            </Notice>
          )}

          {navStops.length > 0 && (
            <div className="rf-preview-map">
              <RiderNavMap
                driver={riderPoint}
                heading={null}
                target={null}
                stops={navStops}
                cautions={navCautions}
                padding={{ x: 28, top: 28, bottom: 28 }}
                routeThroughStops
                road={routeSummary}
                interactive={false}
                label="Preview of today’s points"
              />
            </div>
          )}

          <ol className="rf-point-list">
            {points.map((item) => (
              <PointRow
                key={item.key}
                point={item}
                title={pointTitle(item, stopNumber)}
                number={stopNumber(item.orders[0])}
              />
            ))}
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
            <div className="rf-confirm-actions">
              {readiness}
              <SlideToConfirm
                label={`Slide to start · ${remainingPoints.length} ${remainingPoints.length === 1 ? "point" : "points"}`}
                busyLabel="Starting your route…"
                busy={busy === "start"}
                disabled={!online}
                onConfirm={() => void acceptTasks(true)}
              />
              {!online && (
                <p className="rf-dock-note">
                  Waiting for a connection to start.
                </p>
              )}
            </div>
          )}
          {route.phase === "active" && newTasks.length > 0 && (
            <div className="rf-confirm-actions">
              <SlideToConfirm
                label={`Slide to accept ${newTasks.length} new ${newTasks.length === 1 ? "task" : "tasks"}`}
                busyLabel="Accepting…"
                busy={busy === "start"}
                disabled={!online}
                onConfirm={() => void acceptTasks(false)}
              />
              <button
                type="button"
                className="rf-btn rf-btn-quiet"
                onClick={() => setScreen("navigate")}
              >
                Back to navigation
              </button>
            </div>
          )}
          {route.phase === "active" && newTasks.length === 0 && (
            <button
              type="button"
              className="rf-btn rf-btn-primary"
              onClick={() => setScreen("navigate")}
            >
              {currentPoint?.kind === "pickup"
                ? "Continue to pickup"
                : `Continue to drop-off ${stopNumber(current)}`}{" "}
              <Icon name="arrow-right" size={18} />
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
      {sheets}
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

function SlideToConfirm({
  label,
  busyLabel,
  busy,
  disabled,
  onConfirm,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const maxX = useRef(0);
  const startX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const THUMB = 52;

  // Reset the thumb once a submit finishes (success moves to another screen;
  // a failure leaves the rider free to try again).
  useEffect(() => {
    if (!busy) setDragX(0);
  }, [busy]);

  const locked = disabled || busy;

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (locked) return;
    const track = trackRef.current;
    if (!track) return;
    maxX.current = Math.max(0, track.getBoundingClientRect().width - THUMB);
    startX.current = event.clientX - dragX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (startX.current == null) return;
    const next = Math.min(
      Math.max(0, event.clientX - startX.current),
      maxX.current,
    );
    setDragX(next);
  };
  const handlePointerUp = () => {
    if (startX.current == null) return;
    startX.current = null;
    setDragging(false);
    if (maxX.current > 0 && dragX >= maxX.current * 0.82) {
      setDragX(maxX.current);
      onConfirm();
    } else {
      setDragX(0);
    }
  };

  return (
    <div
      className={`rf-slide-track ${dragging ? "is-dragging" : ""} ${locked ? "is-disabled" : ""}`}
      ref={trackRef}
    >
      <span
        className="rf-slide-fill"
        style={{ width: dragX + THUMB / 2 }}
        aria-hidden="true"
      />
      <span className="rf-slide-label">{busy ? busyLabel : label}</span>
      <button
        type="button"
        className="rf-slide-thumb"
        disabled={locked}
        aria-label={label}
        style={{ transform: `translateX(${dragX}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(event) => {
          // Pointer taps (detail > 0) must not confirm; keyboard and screen
          // reader activation report detail 0.
          if (!locked && event.detail === 0) onConfirm();
        }}
      >
        <Icon
          name={busy ? "history" : "arrow-right"}
          size={20}
          strokeWidth={2.4}
        />
      </button>
    </div>
  );
}
