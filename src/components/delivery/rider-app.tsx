"use client";

import "./rider-flow.css";
import "./rider-delivery.css";

import IconButton from "@mui/material/IconButton";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import { LoadingBlock, signOut } from "@/components/delivery/common";
import { Icon } from "@/components/delivery/icons";
import {
  ActiveDelivery,
  type GpsState,
  type Instruction,
} from "@/components/delivery/rider-active";
import {
  type ExceptionDraft,
  ExceptionPanel,
  HandoverPanel,
} from "@/components/delivery/rider-handover";
import { RiderJobBoard } from "@/components/delivery/rider-job-board";
import { type NavStop, RiderNavMap } from "@/components/delivery/rider-nav-map";
import {
  type RouteMetrics,
  RouteOverview,
} from "@/components/delivery/rider-overview";
import { PickupPanel } from "@/components/delivery/rider-pickup";
import { RouteRevisionNotice } from "@/components/delivery/rider-revision";
import {
  CautionsPanel,
  LocationHelpSheet,
  Notice,
  type ProblemChoice,
  ProblemPanel,
  type RoadReportDraft,
  ShiftMenu,
  type ToolPanel,
} from "@/components/delivery/rider-tools";
import {
  completeDelivery,
  completePickup,
  type DeliveryOutcomeInput,
  type DeliveryOutcomeResult,
  loadRouteSession,
  markStopArrived,
  type PickupInput,
  type PickupResult,
  RouteSessionUnavailable,
  requestRiderAssistance,
  sendDriverLocation,
  setOrderStatus,
  setRouteState,
  submitRoadReport,
} from "@/lib/delivery/actions";
import {
  allocateCod,
  buildDriverRoute,
  codDue,
  type DeliveryStop,
  diffRoute,
  EMPTY_HANDOVER,
  EXCEPTION_OPTIONS,
  type ExceptionReason,
  finishEstimate,
  type HandoverDraft,
  type PickupReasonOption,
  type RouteSession,
  type RouteSnapshot,
  snapshotRoute,
  stopParcels,
} from "@/lib/delivery/driver-route";
import {
  type FuelStation,
  findNearestFuelStation,
} from "@/lib/delivery/energy-routing";
import { currency } from "@/lib/delivery/format";
import {
  type DeliveryJob,
  createOrdersForJob,
  isLocalOrderId,
  isSampleJob,
} from "@/lib/delivery/jobs";
import { formatDriveMinutes, speedLimitAt } from "@/lib/delivery/mapbox";
import { watchRiderLocations } from "@/lib/delivery/rider-location";
import {
  isPreviewScenario,
  PREVIEW_DEPOT,
  PREVIEW_DRIVER_ID,
  PREVIEW_SCENARIOS,
  type PreviewScenario,
  type PreviewState,
  previewAddStop,
  previewCollect,
  previewReorder,
  previewSetStatus,
  previewState,
} from "@/lib/delivery/rider-preview";
import {
  bearingDegrees,
  cautionCopy,
  cautionsAlong,
  compassDirection,
  distanceKm,
  energyForRoute,
  formatDistance,
  type GeoPoint,
  hasParcelOnBoard,
  isClosed,
  resolveTurnSymbol,
} from "@/lib/delivery/rider-route";
import { useRoadSpeedCells } from "@/lib/delivery/road-intel/use-road-intel";
import type {
  DeliveryOrder,
  DeliveryStatus,
  RiderRequest,
  RiderRequestCategory,
  RouteStop,
  StatusEvent,
  WorkspaceData,
} from "@/lib/delivery/types";
import { usePermissionRecovery } from "@/lib/delivery/use-permission-recovery";
import { useRoadRoute } from "@/lib/delivery/use-road-route";
import { useStoredState } from "@/lib/delivery/use-stored-state";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

type DevicePosition = GeoPoint & {
  heading: number | null;
  /** Ground speed in km/h from the device, when it reports one. */
  speedKmh: number | null;
  accuracy: number | null;
  at: number;
};

type Panel = ToolPanel | "location" | "exception";

/** What the driver last saw of the route, so dispatcher changes can be shown. */
type Acknowledged = {
  snapshot: RouteSnapshot;
  current: string | null;
  finishBy: string | null;
};

const STALE_AFTER_MS = 60_000;
const ARRIVAL_RADIUS_KM = 0.08;
const ALLOW_PREVIEW = process.env.NODE_ENV !== "production";

const useStored = useStoredState;

/** Orders, stops and events of a sample job, which only exist on this phone. */
type LocalJobData = {
  orders: DeliveryOrder[];
  routeStops: RouteStop[];
  statusEvents: StatusEvent[];
};

const EMPTY_LOCAL_JOB: LocalJobData = {
  orders: [],
  routeStops: [],
  statusEvents: [],
};

// createOrdersForJob names every sample parcel "job-…".
const isLocalJobId = (id: string) => id.startsWith("job-");

function withLocalJob(data: WorkspaceData, local: LocalJobData): WorkspaceData {
  return {
    ...data,
    orders: [
      ...data.orders.filter((order) => !isLocalJobId(order.id)),
      ...local.orders,
    ],
    routeStops: [
      ...data.routeStops.filter((stop) => !isLocalJobId(stop.order_id)),
      ...local.routeStops,
    ],
    statusEvents: [
      ...data.statusEvents.filter((event) => !isLocalJobId(event.order_id)),
      ...local.statusEvents,
    ],
  };
}

function pickLocalJob(data: WorkspaceData): LocalJobData {
  return {
    orders: data.orders.filter((order) => isLocalJobId(order.id)),
    routeStops: data.routeStops.filter((stop) => isLocalJobId(stop.order_id)),
    statusEvents: data.statusEvents.filter((event) =>
      isLocalJobId(event.order_id),
    ),
  };
}

/** Where the current job starts within the day's shift. */
type JobMark = { hidden: string[]; awaitingStart: boolean };
const EMPTY_JOB_MARK: JobMark = { hidden: [], awaitingStart: false };

function friendlyError(cause: unknown, fallback: string) {
  if (cause instanceof TypeError || /fetch|network/i.test(String(cause)))
    return "Couldn’t reach the server. Nothing was lost — your entries are kept. Try again.";
  return cause instanceof Error ? cause.message : fallback;
}

function yangonDate(now: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Yangon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function RiderApp() {
  /* ---------------- data source: live Supabase or dev preview ---------------- */

  const live = useWorkspace("driver");
  const [preview, setPreview] = useState<PreviewScenario | null>(null);
  const [previewChecked, setPreviewChecked] = useState(!ALLOW_PREVIEW);
  const [previewData, setPreviewData] = useState<PreviewState | null>(null);
  const [previewOffline, setPreviewOffline] = useState(false);
  const [previewGpsDenied, setPreviewGpsDenied] = useState(false);
  const [loseNextResponse, setLoseNextResponse] = useState(false);
  const previewRequests = useRef(new Map<string, DeliveryOutcomeResult>());

  useEffect(() => {
    if (!ALLOW_PREVIEW) return;
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("preview");
    if (isPreviewScenario(scenario)) {
      setPreview(scenario);
      setPreviewData(previewState(scenario, Date.now()));
      setPreviewGpsDenied(params.get("gps") === "denied");
      setPreviewOffline(params.get("offline") === "1");
    }
    setPreviewChecked(true);
  }, []);

  const isPreview = preview != null && previewData != null;
  // Parcels of a sample job exist only on this phone. They sit beside the
  // server data so a refresh after every tap can't wipe the route.
  const [localJob, setLocalJob] = useStoredState<LocalJobData>(
    `oern.driver.${live.profile?.id ?? "anon"}.local-job`,
    EMPTY_LOCAL_JOB,
  );
  const localJobRef = useRef(localJob);
  localJobRef.current = localJob;
  const liveData = useMemo(
    () => withLocalJob(live.data, localJob),
    [live.data, localJob],
  );
  const data: WorkspaceData = isPreview ? previewData.data : liveData;
  const driverId = isPreview ? PREVIEW_DRIVER_ID : (live.profile?.id ?? null);
  const profileName = isPreview
    ? "Preview driver"
    : live.profile?.full_name || "Oern driver";
  const updateData = useCallback(
    (updater: (previous: WorkspaceData) => WorkspaceData) => {
      if (preview)
        setPreviewData((previous) =>
          previous ? { ...previous, data: updater(previous.data) } : previous,
        );
      else
        live.updateData((previous) => {
          const next = updater(withLocalJob(previous, localJobRef.current));
          const local = pickLocalJob(next);
          localJobRef.current = local;
          setLocalJob(local);
          return withLocalJob(next, EMPTY_LOCAL_JOB);
        });
    },
    [preview, live.updateData, setLocalJob],
  );

  /* ---------------- pages: job board and route ---------------- */

  const pathname = usePathname();
  const page: "jobs" | "route" = pathname?.endsWith("/jobs") ? "jobs" : "route";
  // Same app on both URLs, so switching keeps every bit of state in memory.
  const go = useCallback((next: "jobs" | "route") => {
    window.history.pushState(
      null,
      "",
      `/rider/${next}${window.location.search}`,
    );
    window.scrollTo(0, 0);
  }, []);

  /* ---------------- clock, connectivity, viewport ---------------- */

  const [now, setNow] = useState(0);
  const [deviceOnline, setDeviceOnline] = useState(true);
  const [viewHeight, setViewHeight] = useState(844);
  const [sheetPx, setSheetPx] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const measure = () => setViewHeight(window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    const sync = () => setDeviceOnline(navigator.onLine);
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
  const online = deviceOnline && !(isPreview && previewOffline);
  const today = yangonDate(now);

  /* ---------------- state kept on this phone ---------------- */

  const storeKey = `oern.driver.${driverId ?? "anon"}.${today}${isPreview ? `.preview-${preview}` : ""}`;
  const [arrived, setArrived] = useStored<string[]>(`${storeKey}.arrived`, []);
  // Each job is its own route: earlier jobs' parcels are hidden from it, and a
  // shift already running still waits for this job's own "Start route".
  const [jobMark, setJobMark] = useStored<JobMark>(
    `${storeKey}.job`,
    EMPTY_JOB_MARK,
  );
  const [deferred, setDeferred] = useStored<string[]>(
    `${storeKey}.deferred`,
    [],
  );
  const [drafts, setDrafts] = useStored<Record<string, HandoverDraft>>(
    `${storeKey}.drafts`,
    {},
  );
  const [handoverKey, setHandoverKey] = useStored<string | null>(
    `${storeKey}.handover`,
    null,
  );
  const [acknowledged, setAcknowledged] = useStored<Acknowledged | null>(
    `${storeKey}.ack`,
    null,
  );
  // Used only when the route session table isn't on the server yet.
  const [localSession, setLocalSession] = useStored<RouteSession | null>(
    `${storeKey}.session`,
    null,
  );

  /* ---------------- route session ---------------- */

  const [serverSession, setServerSession] = useState<RouteSession | null>(null);
  const [sessionAvailable, setSessionAvailable] = useState(true);
  useEffect(() => {
    if (isPreview || !driverId || !live.canUseLiveData) return;
    let active = true;
    loadRouteSession(createClient(), driverId, today)
      .then((session) => {
        if (active) setServerSession(session);
      })
      .catch((cause) => {
        if (active && cause instanceof RouteSessionUnavailable)
          setSessionAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [isPreview, driverId, live.canUseLiveData, today]);
  const session: RouteSession | null = isPreview
    ? previewData.session
    : sessionAvailable
      ? serverSession
      : localSession;

  /* ---------------- the route ---------------- */

  const routeSession =
    jobMark.awaitingStart && session?.status === "in_progress" ? null : session;
  const route = useMemo(
    () =>
      buildDriverRoute({
        orders: jobMark.hidden.length
          ? data.orders.filter((order) => !jobMark.hidden.includes(order.id))
          : data.orders,
        events: data.statusEvents,
        routeStops: data.routeStops,
        driverId,
        now,
        session: routeSession,
        arrived,
        handover: handoverKey,
        deferred,
      }),
    [
      data,
      driverId,
      now,
      routeSession,
      arrived,
      handoverKey,
      deferred,
      jobMark.hidden,
    ],
  );
  // Ending the shift settles every job today, not just the last one.
  const shiftRoute = useMemo(
    () =>
      jobMark.hidden.length
        ? buildDriverRoute({
            orders: data.orders,
            events: data.statusEvents,
            routeStops: data.routeStops,
            driverId,
            now,
            session,
            arrived: [],
            handover: null,
            deferred: [],
          })
        : route,
    [data, driverId, now, session, jobMark.hidden.length, route],
  );
  const stop = route.current;
  const draft = stop ? (drafts[stop.key] ?? EMPTY_HANDOVER) : EMPTY_HANDOVER;
  const vehicleId =
    route.parcels.find((order) => order.vehicle_id)?.vehicle_id ?? null;
  const vehicle = vehicleId
    ? (data.vehicles.find((item) => item.id === vehicleId) ?? null)
    : null;

  /* ---------------- location ---------------- */

  const [position, setPosition] = useState<DevicePosition | null>(null);
  const [gps, setGps] = useState<GpsState>("off");
  const [gpsAttempt, setGpsAttempt] = useState(0);
  const wantsGps =
    !isPreview &&
    live.isAuthenticated &&
    route.state !== "NONE" &&
    route.state !== "CLOSED";
  // biome-ignore lint/correctness/useExhaustiveDependencies: gpsAttempt re-triggers watchPosition on user retry
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
          speedKmh:
            fix.coords.speed != null && Number.isFinite(fix.coords.speed)
              ? Math.max(0, Math.round(fix.coords.speed * 3.6))
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
  }, [wantsGps, gpsAttempt]);

  // Auto-recover when location permission is granted in browser settings
  usePermissionRecovery({
    permission: "geolocation",
    enabled: wantsGps,
    onGranted: () => {
      setGpsAttempt((attempt) => attempt + 1);
    },
    onDenied: () => {
      setGps("denied");
    },
  });

  // In preview the truck sits 600 m short of the current stop, or at the depot.
  const previewPoint = useMemo<GeoPoint | null>(() => {
    if (!isPreview || previewGpsDenied) return null;
    if (!stop?.point) return PREVIEW_DEPOT;
    const index = route.stops.indexOf(stop);
    const from =
      route.stops
        .slice(0, index)
        .reverse()
        .find((item) => item.point)?.point ?? PREVIEW_DEPOT;
    if (stop.state === "ARRIVED" || stop.state === "HANDOVER_IN_PROGRESS")
      return stop.point;
    const total = distanceKm(from, stop.point);
    const t = total > 0.6 ? 1 - 0.6 / total : 0;
    return {
      latitude: from.latitude + (stop.point.latitude - from.latitude) * t,
      longitude: from.longitude + (stop.point.longitude - from.longitude) * t,
    };
  }, [isPreview, previewGpsDenied, stop, route.stops]);

  const gpsState: GpsState = isPreview
    ? previewGpsDenied
      ? "denied"
      : "live"
    : gps === "live" && position && now - position.at > STALE_AFTER_MS
      ? "stale"
      : gps;
  // A stale fix is still shown, labelled as old; a denied one never is.
  const riderPoint: GeoPoint | null = isPreview
    ? previewPoint
    : gpsState === "live" || gpsState === "stale"
      ? position
      : null;

  // Share location for every parcel on board, as customer tracking requires.
  const onBoardKey = JSON.stringify(
    route.onBoard.map((order) => order.id).sort(),
  );
  const [, setSharing] = useState<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: gpsAttempt re-triggers watchRiderLocations on retry
  useEffect(() => {
    const orderIds = JSON.parse(onBoardKey) as string[];
    if (
      isPreview ||
      !live.canUseLiveData ||
      !driverId ||
      !orderIds.length ||
      route.state === "PAUSED" ||
      !("geolocation" in navigator)
    ) {
      setSharing(null);
      return;
    }
    return watchRiderLocations({
      geolocation: navigator.geolocation,
      orderIds,
      send: async (orderId, point) => {
        if (isLocalOrderId(orderId)) return;
        await sendDriverLocation(
          createClient(),
          orderId,
          driverId,
          point.latitude,
          point.longitude,
          point.accuracy,
          { speedMps: point.speedMps, headingDegrees: point.headingDegrees },
        );
      },
      onSent: (sentIds) => setSharing(sentIds.length),
      onError: (_msg, permissionDenied) => {
        setSharing(null);
        if (permissionDenied) setGps("denied");
      },
    });
  }, [
    onBoardKey,
    isPreview,
    live.canUseLiveData,
    driverId,
    route.state,
    gpsAttempt,
  ]);

  /* ---------------- distances, road routes, cautions ---------------- */

  const [activePitStop, setActivePitStop] = useState<
    (FuelStation & { distanceKm: number }) | null
  >(null);

  const currentTargetPoint = useMemo(
    () =>
      activePitStop
        ? {
            latitude: activePitStop.latitude,
            longitude: activePitStop.longitude,
          }
        : (stop?.point ?? null),
    [activePitStop, stop?.point],
  );

  const openPoints = useMemo(
    () =>
      // Mapbox Directions takes at most 25 coordinates, so the road route
      // covers the next 24 stops; later ones join as the route advances.
      [stop, ...route.upcoming]
        .flatMap((item) => (item?.point ? [item.point] : []))
        .slice(0, 24),
    [stop, route.upcoming],
  );
  const speedCells = useRoadSpeedCells(live.canUseLiveData && !isPreview);
  const routeOptions = useMemo(
    () => ({ roadReports: data.roadReports, speedCells, now }),
    [data.roadReports, speedCells, now],
  );
  const legRoute = useRoadRoute(
    riderPoint,
    currentTargetPoint && riderPoint ? [currentTargetPoint] : [],
    routeOptions,
  );
  const routeOrigin = riderPoint ?? openPoints[0] ?? null;
  const routeRoad = useRoadRoute(
    routeOrigin,
    riderPoint ? openPoints : openPoints.slice(1),
    routeOptions,
  );
  const upcomingDestinations = useMemo(
    () => [
      ...(activePitStop && stop?.point ? [stop.point] : []),
      ...route.upcoming.flatMap((item) => (item?.point ? [item.point] : [])),
    ],
    [activePitStop, stop?.point, route.upcoming],
  );
  const upcomingRoad = useRoadRoute(currentTargetPoint, upcomingDestinations);
  const straightKm = useMemo(() => {
    let from = routeOrigin;
    let total = 0;
    for (const point of riderPoint ? openPoints : openPoints.slice(1)) {
      if (from) total += distanceKm(from, point);
      from = point;
    }
    return openPoints.length ? total : null;
  }, [routeOrigin, riderPoint, openPoints]);
  const legDistance =
    riderPoint && currentTargetPoint
      ? distanceKm(riderPoint, currentTargetPoint)
      : null;
  const legBearing =
    riderPoint && currentTargetPoint
      ? bearingDegrees(riderPoint, currentTargetPoint)
      : null;
  const atTarget = legDistance != null && legDistance <= ARRIVAL_RADIUS_KM;

  const legPath = useMemo<GeoPoint[]>(() => {
    if (legRoute)
      return legRoute.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      }));
    return [riderPoint, currentTargetPoint].filter(
      (item): item is GeoPoint => item != null,
    );
  }, [legRoute, riderPoint, currentTargetPoint]);
  const legCautions = useMemo(
    () => cautionsAlong(legPath, data.roadReports, now),
    [legPath, data.roadReports, now],
  );
  const routeCautions = useMemo(
    () =>
      cautionsAlong(
        [riderPoint, ...openPoints].filter(
          (item): item is GeoPoint => item != null,
        ),
        data.roadReports,
        now,
      ),
    [riderPoint, openPoints, data.roadReports, now],
  );

  const routeEnergy = energyForRoute(
    vehicle,
    routeRoad?.distanceKm ?? straightKm,
    routeRoad != null,
  );
  const metrics: RouteMetrics = {
    distance:
      routeRoad != null
        ? `${formatDistance(routeRoad.distanceKm)} by road`
        : straightKm != null
          ? `${formatDistance(straightKm)} straight-line`
          : null,
    driveTime: routeRoad ? formatDriveMinutes(routeRoad.durationMin) : null,
    finishBy: finishEstimate(route),
  };

  /* ---------------- dispatcher revisions ---------------- */

  const started = route.state === "IN_PROGRESS" || route.state === "PAUSED";
  const [resnapshot, setResnapshot] = useState(false);
  useEffect(() => {
    if (!started) return;
    if (acknowledged && !resnapshot) return;
    setAcknowledged({
      snapshot: snapshotRoute(route),
      current: route.current?.key ?? null,
      finishBy: finishEstimate(route),
    });
    setResnapshot(false);
  }, [started, acknowledged, resnapshot, route, setAcknowledged]);
  const revision =
    started && acknowledged
      ? diffRoute(acknowledged.snapshot, route, acknowledged.current)
      : null;
  const [revisionOpen, setRevisionOpen] = useState(false);

  /* ---------------- writes ---------------- */

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 7000);
    return () => window.clearTimeout(id);
  }, [flash]);

  /** One write at a time; a second tap while saving does nothing. */
  async function run(label: string, task: () => Promise<void>) {
    if (busyRef.current) return false;
    if (!isPreview && !live.canUseLiveData) {
      setActionError(
        "Your session needs refreshing. Sign in again to continue.",
      );
      return false;
    }
    busyRef.current = true;
    setBusy(label);
    setActionError(null);
    try {
      await task();
      return true;
    } catch (cause) {
      setActionError(
        friendlyError(cause, "That update did not save. Try again."),
      );
      return false;
    } finally {
      busyRef.current = false;
      setBusy(null);
      if (!isPreview) void live.refresh(true);
    }
  }

  const applyStatus = useCallback(
    (
      orderId: string,
      status: DeliveryStatus,
      extra: Partial<DeliveryOrder> = {},
    ) =>
      updateData((previous) => ({
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
      })),
    [updateData],
  );

  /** Server-confirmed status change; the screen moves only after it succeeds. */
  async function moveParcel(order: DeliveryOrder, status: DeliveryStatus) {
    if (isPreview) {
      setPreviewData((previous) =>
        previous
          ? {
              ...previous,
              data: previewSetStatus(previous.data, order.id, status),
            }
          : previous,
      );
      return;
    }
    if (isLocalOrderId(order.id)) {
      applyStatus(order.id, status);
      return;
    }
    await setOrderStatus(
      createClient(),
      order.id,
      status as
        "accepted" | "picked_up" | "in_transit" | "delivered" | "failed",
    );
    applyStatus(order.id, status);
  }

  async function sendOutcome(
    input: DeliveryOutcomeInput,
  ): Promise<DeliveryOutcomeResult> {
    if (isLocalOrderId(input.orderId)) {
      const order = data.orders.find((item) => item.id === input.orderId);
      return {
        status: input.outcome,
        codStatus:
          input.outcome === "delivered" && order && codDue(order) > 0
            ? "collected"
            : (order?.cod_status ?? "not_required"),
        duplicate: false,
      };
    }
    if (!isPreview) return completeDelivery(createClient(), input);
    const seen = previewRequests.current.get(input.requestId);
    if (seen) return { ...seen, duplicate: true };
    const order = previewData.data.orders.find(
      (item) => item.id === input.orderId,
    );
    if (!order) throw new Error("This parcel is not assigned to you");
    if (order.status === "delivered" || order.status === "failed")
      throw new Error(`This parcel already has an outcome: ${order.status}`);
    if (input.outcome === "delivered" && !input.parcelVerified)
      throw new Error(
        "Check the parcel against the manifest before handing it over",
      );
    const codStatus =
      input.outcome === "delivered" &&
      codDue(order) > 0 &&
      input.codReceived === order.cod_amount
        ? "collected"
        : order.cod_status;
    const result: DeliveryOutcomeResult = {
      status: input.outcome,
      codStatus,
      duplicate: false,
    };
    previewRequests.current.set(input.requestId, result);
    if (loseNextResponse) {
      // The server saved it, but the reply never arrives: the screen must not move.
      setLoseNextResponse(false);
      setTimeout(
        () =>
          setPreviewData((previous) =>
            previous
              ? {
                  ...previous,
                  data: {
                    ...previous.data,
                    orders: previous.data.orders.map((item) =>
                      item.id === order.id
                        ? {
                            ...item,
                            status: input.outcome,
                            cod_status: codStatus,
                          }
                        : item,
                    ),
                  },
                }
              : previous,
          ),
        0,
      );
      throw new TypeError("Network request failed");
    }
    return result;
  }

  const previewPickups = useRef(new Map<string, PickupResult>());

  /** Records one door pickup; the preview applies the same rules as the database. */
  async function sendPickup(input: PickupInput): Promise<PickupResult> {
    if (isLocalOrderId(input.orderId))
      return {
        status: input.outcome === "collected" ? "picked_up" : "failed",
        duplicate: false,
        weightKg: input.outcome === "collected" ? input.weighedKg : null,
        variancePct: null,
        warnings: [],
      };
    if (!isPreview) return completePickup(createClient(), input);
    const seen = previewPickups.current.get(input.requestId);
    if (seen) return { ...seen, duplicate: true };
    if (input.outcome === "collected" && !input.parcelChecked)
      throw new Error("Check the parcel before taking it");
    if (input.outcome === "failed" && !input.reason)
      throw new Error("Choose why the parcel was not collected");
    const next = previewCollect(previewData.data, input.orderId, {
      outcome: input.outcome,
      weighedKg: input.weighedKg,
      routeStarted: started,
    });
    setPreviewData((previous) =>
      previous ? { ...previous, data: next } : previous,
    );
    const order = next.orders.find((item) => item.id === input.orderId);
    const result: PickupResult = {
      status: (order?.status ?? "picked_up") as DeliveryStatus,
      duplicate: false,
      weightKg: input.outcome === "collected" ? input.weighedKg : null,
      variancePct: null,
      warnings: [],
    };
    previewPickups.current.set(input.requestId, result);
    return result;
  }

  async function saveSession(
    state: "in_progress" | "paused" | "closed",
    extra: { reason?: string; declaredCod?: number } = {},
  ) {
    const stamp = new Date().toISOString();
    const next = (previous: RouteSession | null): RouteSession => ({
      status: state,
      started_at: previous?.started_at ?? stamp,
      paused_at: state === "paused" ? stamp : null,
      closed_at: state === "closed" ? stamp : null,
      cod_declared: state === "closed" ? (extra.declaredCod ?? null) : null,
    });
    if (isPreview) {
      setPreviewData((previous) =>
        previous ? { ...previous, session: next(previous.session) } : previous,
      );
      return;
    }
    if (sessionAvailable) {
      try {
        const saved = await setRouteState(createClient(), {
          state,
          reason: extra.reason,
          declaredCod: extra.declaredCod,
        });
        setServerSession(saved);
        return;
      } catch (cause) {
        if (!(cause instanceof RouteSessionUnavailable)) throw cause;
        setSessionAvailable(false);
      }
    }
    if (state === "closed")
      throw new Error("Route closing isn’t set up on the server yet.");
    setLocalSession(next(localSession));
  }

  const acknowledge = () =>
    run("acknowledge", async () => {
      for (const order of route.unacknowledged)
        await moveParcel(order, "accepted");
      setResnapshot(true);
      setRevisionOpen(false);
    });

  /** Mid-route: parcels added at the depot go on the truck. */
  const loadParcels = (orderIds: string[]) =>
    run("load", async () => {
      for (const id of orderIds) {
        const order = route.parcels.find((item) => item.id === id);
        if (!order) continue;
        let status = order.status;
        if (status === "assigned") {
          await moveParcel(order, "accepted");
          status = "accepted";
        }
        if (status === "accepted") {
          await moveParcel({ ...order, status }, "picked_up");
          status = "picked_up";
        }
        // Mid-route additions go straight out for delivery once loaded.
        if (started && status === "picked_up")
          await moveParcel({ ...order, status }, "in_transit");
      }
      if (started) setResnapshot(true);
    });

  /**
   * One swipe from the load check: parcels not reported missing go on the truck
   * and the route starts. Parcels reported missing are sent to operations.
   */
  const startWithLoad = (loadIds: string[], missingIds: string[]) =>
    run("start", async () => {
      if (missingIds.length) await tellOperationsMissing(missingIds);
      for (const order of route.parcels) {
        if (loadIds.includes(order.id) && order.status === "accepted") {
          await moveParcel(order, "picked_up");
          await moveParcel({ ...order, status: "picked_up" }, "in_transit");
        } else if (order.status === "picked_up") {
          await moveParcel(order, "in_transit");
        }
      }
      await saveSession("in_progress");
      setAcknowledged(null);
      setJobMark((mark) => ({ ...mark, awaitingStart: false }));
    });

  const startRoute = () =>
    run("start", async () => {
      for (const order of route.onBoard)
        if (order.status === "picked_up") await moveParcel(order, "in_transit");
      await saveSession("in_progress");
      setAcknowledged(null);
      setJobMark((mark) => ({ ...mark, awaitingStart: false }));
    });

  const pauseRoute = () =>
    run("pause", async () => {
      await saveSession("paused");
      setPanel(null);
    });
  const resumeRoute = () =>
    run("resume", async () => {
      await saveSession("in_progress");
      setPanel(null);
    });
  const closeRoute = (declared: number) =>
    run("close", async () => {
      await saveSession("closed", { declaredCod: declared });
    });

  /** A job was taken on the board: set up its route and open the route page. */
  const onJobTaken = useCallback(
    (job: DeliveryJob) => {
      const currentDriver =
        driverId ?? (isPreview ? PREVIEW_DRIVER_ID : "driver-live");
      const finished = data.orders
        .filter(
          (order) =>
            order.driver_id === currentDriver && isClosed(order.status),
        )
        .map((order) => order.id);
      setJobMark({
        hidden: finished,
        awaitingStart: session?.status === "in_progress",
      });
      if (isSampleJob(job)) {
        const generated = createOrdersForJob(job, currentDriver, Date.now());
        const isOld = (id: string) => id.startsWith("job-");
        updateData((previous) => ({
          ...previous,
          orders: [
            ...previous.orders.filter((order) => !isOld(order.id)),
            ...generated.orders,
          ],
          routeStops: [
            ...previous.routeStops.filter((stop) => !isOld(stop.order_id)),
            ...generated.routeStops,
          ],
          statusEvents: previous.statusEvents.filter(
            (event) => !isOld(event.order_id),
          ),
        }));
      }
      setAcknowledged(null);
      setArrived([]);
      setDeferred([]);
      setFlash(
        `You took ${job.area_label ?? job.label}. Check the load, then start the route.`,
      );
      if (!isPreview && live.canUseLiveData) void live.refresh();
      go("route");
    },
    [
      data.orders,
      driverId,
      go,
      isPreview,
      live,
      session?.status,
      setAcknowledged,
      setArrived,
      setDeferred,
      setFlash,
      setJobMark,
      updateData,
    ],
  );

  const markArrived = (target: DeliveryStop) => {
    // Arriving marks this stop only; any earlier arrival mark is dropped.
    setArrived([target.key]);
    const orderIds = (target.kind === "pickup" ? target.collect : target.open)
      .map((order) => order.id)
      .filter((id) => !isLocalOrderId(id));
    if (!isPreview && live.canUseLiveData && orderIds.length > 0)
      // Best effort: only routes created by dispatch have stop rows to mark.
      void markStopArrived(createClient(), orderIds, target.kind).catch(
        () => undefined,
      );
  };

  const updateDraft = (patch: Partial<HandoverDraft>) => {
    if (!stop) return;
    setDrafts((previous) => ({
      ...previous,
      [stop.key]: { ...(previous[stop.key] ?? EMPTY_HANDOVER), ...patch },
    }));
  };

  const finishStop = (target: DeliveryStop) => {
    setDrafts((previous) => {
      const { [target.key]: _, ...rest } = previous;
      return rest;
    });
    setArrived((keys) => keys.filter((key) => key !== target.key));
    setHandoverKey(null);
    setExpanded(false);
  };

  const completeStop = () =>
    run("complete", async () => {
      if (!stop || !driverId) return;
      const target = stop;
      // Request ids are saved before sending so a retry repeats, not duplicates.
      const requestIds = { ...draft.requestIds };
      for (const order of target.open) requestIds[order.id] ??= newRequestId();
      const current = {
        ...draft,
        requestIds,
        codMode: draft.codMode ?? "full",
        codAmount: draft.codAmount || String(target.codDue),
        verified:
          draft.verified.length > 0
            ? draft.verified
            : target.open.map((o) => o.id),
        receivedBy: draft.receivedBy.trim() || target.recipient,
      };
      setDrafts((previous) => ({ ...previous, [target.key]: current }));
      const allocation =
        current.codMode === "different"
          ? allocateCod(target.open, Number(current.codAmount))
          : null;
      let duplicates = 0;
      for (const order of target.open) {
        const due = codDue(order);
        const result = await sendOutcome({
          orderId: order.id,
          driverId,
          requestId: requestIds[order.id],
          outcome: "delivered",
          parcelVerified: current.verified.includes(order.id),
          receivedBy: current.receivedBy,
          failureReason: null,
          nextAction: "none",
          note: current.note,
          codExpected: order.cod_amount,
          codReceived:
            due > 0
              ? allocation
                ? (allocation.get(order.id) ?? 0)
                : due
              : null,
          codReason:
            due > 0 && allocation && allocation.get(order.id) !== due
              ? current.codReason
              : null,
        });
        if (result.duplicate) duplicates += 1;
        applyStatus(order.id, result.status as DeliveryStatus, {
          cod_status: result.codStatus as DeliveryOrder["cod_status"],
        });
      }
      const collected = allocation ? Number(current.codAmount) : target.codDue;
      finishStop(target);
      setFlash(
        `Stop ${target.number} delivered · ${target.open.length} ${target.open.length === 1 ? "parcel" : "parcels"}${target.codDue > 0 ? ` · ${currency.format(collected)} COD recorded` : ""}${duplicates ? " · already saved on the first try" : ""}.`,
      );
    });

  /** Collects every parcel at the current pickup stop. */
  const collectStop = () =>
    run("collect", async () => {
      if (!stop || stop.kind !== "pickup") return;
      const target = stop;
      // Request ids are saved before sending so a retry repeats, not duplicates.
      const requestIds = { ...draft.requestIds };
      for (const order of target.collect)
        requestIds[`pickup:${order.id}`] ??= newRequestId();
      setDrafts((previous) => ({
        ...previous,
        [target.key]: { ...draft, requestIds },
      }));
      let duplicates = 0;
      let overweight: string | null = null;
      for (const order of target.collect) {
        const typed = (draft.weights?.[order.id] ?? "").trim();
        const result = await sendPickup({
          orderId: order.id,
          requestId: requestIds[`pickup:${order.id}`],
          outcome: "collected",
          parcelChecked: draft.verified.includes(order.id),
          weighedKg: typed === "" ? null : Number(typed),
          reason: null,
          note: draft.note.trim() || null,
        });
        if (result.duplicate) duplicates += 1;
        applyStatus(
          order.id,
          result.status,
          result.weightKg != null ? { parcel_weight_kg: result.weightKg } : {},
        );
        const warning = result.warnings.find(
          (item) => item.code === "overweight",
        );
        if (warning)
          overweight = `The truck now carries ${warning.onBoardKg} kg, over its ${warning.capacityKg} kg capacity. Tell operations.`;
      }
      finishStop(target);
      const count = target.collect.length;
      setFlash(
        `Pickup ${target.number} collected · ${count} ${count === 1 ? "parcel" : "parcels"}${overweight ? ` · ${overweight}` : ""}${duplicates ? " · already saved on the first try" : ""}.`,
      );
    });

  /** Records that the parcels at the current pickup could not be collected. */
  const cannotCollect = (reason: PickupReasonOption["id"], note: string) =>
    run("collect", async () => {
      if (!stop || stop.kind !== "pickup") return;
      const target = stop;
      const requestIds = { ...draft.requestIds };
      for (const order of target.collect)
        requestIds[`pickup-fail:${order.id}`] ??= newRequestId();
      setDrafts((previous) => ({
        ...previous,
        [target.key]: { ...draft, requestIds },
      }));
      for (const order of target.collect) {
        const result = await sendPickup({
          orderId: order.id,
          requestId: requestIds[`pickup-fail:${order.id}`],
          outcome: "failed",
          parcelChecked: false,
          weighedKg: null,
          reason,
          note: note.trim() || null,
        });
        applyStatus(order.id, result.status);
      }
      finishStop(target);
      setFlash(
        `Pickup ${target.number} recorded as not collected. Those parcels come off your route; operations will rebook them.`,
      );
    });

  const [exceptionReason, setExceptionReason] =
    useState<ExceptionReason | null>(null);
  const recordException = (exception: ExceptionDraft) =>
    run("exception", async () => {
      if (!stop || !driverId) return;
      const target = stop;
      if (exception.nextAction === "retry_later") {
        setDeferred((keys) => [...new Set([...keys, target.key])]);
        finishStop(target);
        setResnapshot(true);
        setPanel(null);
        setFlash(`Stop ${target.number} moved to the end of your route.`);
        return;
      }
      const requestIds = { ...draft.requestIds };
      for (const id of exception.parcelIds)
        requestIds[`fail:${id}`] ??= newRequestId();
      setDrafts((previous) => ({
        ...previous,
        [target.key]: {
          ...(previous[target.key] ?? EMPTY_HANDOVER),
          requestIds,
        },
      }));
      for (const id of exception.parcelIds) {
        const order = target.open.find((item) => item.id === id);
        if (!order) continue;
        const result = await sendOutcome({
          orderId: id,
          driverId,
          requestId: requestIds[`fail:${id}`],
          outcome: "failed",
          parcelVerified: false,
          receivedBy: null,
          failureReason: exception.reason,
          nextAction: exception.nextAction,
          note: exception.note,
          codExpected: order.cod_amount,
          codReceived: null,
          codReason: null,
        });
        applyStatus(id, result.status as DeliveryStatus);
      }
      const whole = exception.parcelIds.length === target.open.length;
      if (whole) finishStop(target);
      setPanel(null);
      setFlash(
        whole
          ? `Stop ${target.number} recorded as not delivered · ${exception.nextAction === "return_to_depot" ? "return the parcels to the depot" : "operations will reschedule"}.`
          : `${exception.parcelIds.length} ${exception.parcelIds.length === 1 ? "parcel" : "parcels"} recorded as not delivered. Hand over the rest.`,
      );
    });

  /* ---------------- tools: fuel, road reports, problems ---------------- */

  const [panel, setPanel] = useState<Panel | null>(null);
  const [panelDone, setPanelDone] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const openPanel = (next: Panel) => {
    setActionError(null);
    setPanelDone(null);
    setPanel(next);
  };
  const myRequests = data.riderRequests.filter(
    (request) => request.driver_id === driverId,
  );
  const openEnergyRequest =
    myRequests.find(
      (request) => request.kind === "energy" && request.status !== "resolved",
    ) ?? null;

  const requestHelp = (category: RiderRequestCategory, note: string) =>
    run("request", async () => {
      if (!driverId) return;
      const isEnergy = category === "refuel" || category === "recharge";

      // If fuel or recharge requested: immediately route to nearest station!
      let nearestStation: (FuelStation & { distanceKm: number }) | null = null;
      if (isEnergy) {
        const driverPos =
          riderPoint ??
          (stop?.point
            ? { latitude: stop.point.latitude, longitude: stop.point.longitude }
            : null);
        if (driverPos) {
          nearestStation = findNearestFuelStation(driverPos);
          if (nearestStation) {
            setActivePitStop(nearestStation);
          }
        }
      }

      const telemetryNote =
        isEnergy && nearestStation
          ? `[Telemetry] Auto-routed to ${nearestStation.name} (${nearestStation.distanceKm} km away). ${note}`.trim()
          : note.trim() || null;

      const record: RiderRequest = {
        id: `local-${Date.now()}`,
        driver_id: driverId,
        driver_name: profileName,
        order_id: (stop ? stopParcels(stop)[0]?.id : undefined) ?? null,
        vehicle_id: vehicle?.id ?? null,
        kind: isEnergy ? "energy" : "issue",
        category,
        note: telemetryNote,
        energy_level_percent: routeEnergy.levelPercent,
        latitude: riderPoint?.latitude ?? null,
        longitude: riderPoint?.longitude ?? null,
        status: isEnergy ? "resolved" : "open",
        created_at: new Date().toISOString(),
        acknowledged_at: isEnergy ? new Date().toISOString() : null,
        resolved_at: isEnergy ? new Date().toISOString() : null,
      };
      if (!isPreview)
        await requestRiderAssistance(createClient(), {
          driverId,
          orderId: isLocalOrderId(record.order_id) ? null : record.order_id,
          vehicleId: record.vehicle_id,
          category,
          note: record.note ?? "",
          energyLevelPercent: record.energy_level_percent,
          latitude: record.latitude,
          longitude: record.longitude,
        });
      updateData((previous) => ({
        ...previous,
        riderRequests: [record, ...previous.riderRequests],
      }));
      setPanelDone(
        isEnergy && nearestStation
          ? `Destination updated to nearest station: ${nearestStation.name} (${nearestStation.distanceKm} km away). Telemetry logged.`
          : isEnergy
            ? "Fuel telemetry logged. Safe driving."
            : "Sent to operations with your location and current stop. They’ll contact you.",
      );
    });

  /** Tells operations which parcels are not on the truck; runs inside another action. */
  const tellOperationsMissing = async (orderIds: string[]) => {
    if (!driverId) return;
    const codes = route.parcels
      .filter((order) => orderIds.includes(order.id))
      .map((order) => order.tracking_code)
      .join(", ");
    const note = `Not on the truck at loading: ${codes}`.slice(0, 500);
    if (!isPreview)
      await requestRiderAssistance(createClient(), {
        driverId,
        orderId: isLocalOrderId(orderIds[0]) ? null : (orderIds[0] ?? null),
        vehicleId: vehicle?.id ?? null,
        category: "other",
        note,
        energyLevelPercent: null,
        latitude: riderPoint?.latitude ?? null,
        longitude: riderPoint?.longitude ?? null,
      });
    setFlash(`Operations told: ${codes} missing at loading.`);
  };

  const sendRoadReport = (report: RoadReportDraft) =>
    run("road", async () => {
      if (!driverId) return;
      if (!riderPoint)
        throw new Error("Your location is needed to place a road report.");
      if (!isPreview)
        await submitRoadReport(createClient(), {
          driverId,
          orderId: (stop ? stopParcels(stop)[0]?.id : undefined) ?? null,
          category: report.category,
          severity: report.severity,
          description: report.description,
          latitude: riderPoint.latitude,
          longitude: riderPoint.longitude,
        });
      setPanelDone(
        "Road report sent. It stays unconfirmed until operations checks it, and won’t reroute anyone on its own.",
      );
    });

  /* ---------------- render ---------------- */

  if (!now || !previewChecked || (!isPreview && live.isLoading))
    return <LoadingBlock title="Opening your route…" />;

  if (!isPreview && !live.isAuthenticated) return <SignInGate />;

  const errorText = actionError ?? (isPreview ? null : live.error);
  const errorBanner = errorText ? (
    <Notice
      tone="error"
      icon="warning"
      action={
        <button
          type="button"
          className="rf-link"
          onClick={() =>
            actionError ? setActionError(null) : void live.refresh()
          }
        >
          {actionError ? "Dismiss" : "Retry"}
        </button>
      }
    >
      {errorText}
    </Notice>
  ) : live.isStale ? (
    <Notice tone="warning" icon="warning">
      <strong>Showing your saved route.</strong> We couldn’t reach the server.
      It will refresh when the connection returns.
    </Notice>
  ) : null;

  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Yangon",
  }).format(now);

  const navStops: NavStop[] = route.stops.flatMap((item) =>
    item.point
      ? [
          {
            id: item.key,
            number: item.number,
            kind:
              item.kind === "pickup"
                ? ("pickup" as const)
                : ("dropoff" as const),
            point: item.point,
            state:
              item.state === "COMPLETED"
                ? ("done" as const)
                : item.state === "FAILED"
                  ? ("failed" as const)
                  : item === stop
                    ? ("current" as const)
                    : ("queued" as const),
          },
        ]
      : [],
  );
  const navCautions = routeCautions.map(({ report }) => ({
    id: report.id,
    point: { latitude: report.latitude, longitude: report.longitude },
    severity: report.severity,
  }));

  const revisionNotice = (
    <RouteRevisionNotice
      route={route}
      started={started}
      revision={revision}
      revisionOpen={revisionOpen}
      onOpenChange={setRevisionOpen}
      stop={stop}
      finishEstimate={finishEstimate}
      acknowledged={acknowledged}
      errorBanner={errorBanner}
      busy={busy}
      online={online}
      onAcknowledge={() => void acknowledge()}
      onLoadParcels={(ids) => void loadParcels(ids)}
      onDismiss={() => {
        setResnapshot(true);
        setRevisionOpen(false);
      }}
    />
  );
  const sheets = renderSheets();
  const previewBar = isPreview ? renderPreviewBar() : null;

  if (page === "jobs") {
    const activeJob = !["NONE", "COMPLETED", "CLOSED"].includes(route.state);
    const blocked = activeJob ? "Finish your current job first" : null;
    return (
      <>
        <main className="rf-app dv-overview">
          <RiderJobBoard
            vehicles={data.vehicles}
            blocked={blocked}
            sampleJobs={isPreview}
            onTaken={onJobTaken}
            menu={
              <IconButton
                onClick={() => openPanel("menu")}
                aria-label="Shift tools"
                sx={{ width: 44, height: 44, color: "text.primary" }}
              >
                <Icon name="menu" size={20} />
              </IconButton>
            }
            notices={
              <>
                {activeJob && (
                  <Notice
                    tone="info"
                    icon="truck"
                    action={
                      <button
                        type="button"
                        className="rf-link"
                        onClick={() => go("route")}
                      >
                        Open route
                      </button>
                    }
                  >
                    <strong>You have a job in progress.</strong> Finish it
                    before taking another.
                  </Notice>
                )}
                {flash && (
                  <Notice tone="success" icon="check">
                    {flash}
                  </Notice>
                )}
              </>
            }
          />
        </main>
        {sheets}
        {previewBar}
      </>
    );
  }

  if (route.state === "IN_PROGRESS" && stop) {
    const arrivedHere =
      stop.state === "ARRIVED" || stop.state === "HANDOVER_IN_PROGRESS";
    const instruction: Instruction = activePitStop
      ? {
          title: `Pitstop: ${activePitStop.name}`,
          sub: `${legDistance != null ? `${formatDistance(legDistance)} · ` : ""}${activePitStop.road}, ${activePitStop.township}`,
          arrow: null,
          turnSymbol: "turn-right",
        }
      : !stop.point
        ? {
            title: "No map pin for this address",
            sub: "Use the address below, or call the recipient",
            arrow: null,
            turnSymbol: "location",
          }
        : arrivedHere
          ? {
              title: `At stop ${stop.number}`,
              sub: "Park safely, then confirm arrival",
              arrow: null,
              turnSymbol: "arrive",
            }
          : !riderPoint
            ? {
                title:
                  gpsState === "denied" || gpsState === "unavailable"
                    ? "Live position unavailable"
                    : "Finding your location…",
                sub: "Route shown from stop pins. Check the address below.",
                arrow: null,
                turnSymbol: "straight",
              }
            : atTarget
              ? {
                  title: "You’re at the stop",
                  sub: "Park safely, then tap I’ve arrived",
                  arrow: null,
                  turnSymbol: "arrive",
                }
              : legRoute?.firstStep
                ? {
                    title: legRoute.firstStep.instruction,
                    sub: `${formatDistance(legRoute.distanceKm)} · ${formatDriveMinutes(legRoute.durationMin)} by road to stop ${stop.number}`,
                    arrow: null,
                    turnSymbol: resolveTurnSymbol(
                      legRoute.firstStep.instruction,
                      legRoute.firstStep.maneuverModifier,
                      legRoute.firstStep.maneuverType,
                    ),
                  }
                : {
                    title: `Head ${compassDirection(legBearing ?? 0)}`,
                    sub: `${formatDistance(legDistance)} straight-line to stop ${stop.number}`,
                    arrow: 0,
                    turnSymbol: "straight",
                  };
    const heading = isPreview ? legBearing : (position?.heading ?? legBearing);
    if (instruction.arrow != null)
      instruction.arrow = (legBearing ?? 0) - (heading ?? 0);
    const nextCaution = legCautions[0] ?? null;
    const sheetHeight =
      sheetPx ||
      (handoverKey
        ? Math.round(viewHeight * 0.88)
        : expanded
          ? Math.round(viewHeight * 0.62)
          : 330);
    const liveEtaAt =
      riderPoint && legRoute && now
        ? new Date(now + legRoute.durationMin * 60_000).toISOString()
        : null;

    return (
      <>
        <ActiveDelivery
          route={route}
          stop={stop}
          map={
            <RiderNavMap
              driver={riderPoint}
              heading={riderPoint ? heading : null}
              follow={riderPoint != null}
              target={
                currentTargetPoint
                  ? {
                      ...currentTargetPoint,
                      kind:
                        activePitStop || stop.kind === "pickup"
                          ? "pickup"
                          : "dropoff",
                    }
                  : null
              }
              targetId={activePitStop ? "pitstop" : stop.key}
              stops={navStops}
              upcoming={route.upcoming.flatMap((item) =>
                item.point ? [item.point] : [],
              )}
              upcomingRoad={upcomingRoad}
              cautions={navCautions}
              routeThroughStops={riderPoint == null}
              padding={{
                x: 48,
                top: nextCaution || activePitStop ? 250 : 190,
                bottom: sheetHeight + 16,
              }}
              road={riderPoint ? legRoute : routeRoad}
              label={
                activePitStop
                  ? `Map to fuel station: ${activePitStop.name}, ${activePitStop.road}`
                  : `Map to stop ${stop.number} of ${route.stops.length}: ${stop.address}`
              }
            />
          }
          instruction={instruction}
          gps={gpsState}
          online={online}
          syncing={busy != null}
          revision={
            <>
              {flash && (
                <Notice tone="success" icon="check">
                  {flash}
                </Notice>
              )}
              {revisionNotice}
            </>
          }
          expanded={expanded}
          onExpand={setExpanded}
          handover={
            handoverKey === stop.key && stop.kind === "pickup" ? (
              <PickupPanel
                stop={stop}
                draft={draft}
                onChange={updateDraft}
                busy={busy === "collect"}
                online={online}
                error={errorBanner}
                onCollect={() => void collectStop()}
                onCannotCollect={(reason, note) =>
                  void cannotCollect(reason, note)
                }
              />
            ) : handoverKey === stop.key ? (
              <HandoverPanel
                stop={stop}
                draft={draft}
                onChange={updateDraft}
                busy={busy === "complete"}
                online={online}
                error={errorBanner}
                onComplete={() => void completeStop()}
                onCannotDeliver={() => {
                  setExceptionReason(null);
                  openPanel("exception");
                }}
              />
            ) : null
          }
          error={errorBanner}
          busy={busy != null}
          onArrived={() => {
            markArrived(stop);
            setExpanded(false);
            setActionError(null);
            setHandoverKey(stop.key);
          }}
          onCloseHandover={() => setHandoverKey(null)}
          onMenu={() => openPanel("menu")}
          onLocationHelp={() => openPanel("location")}
          liveEtaAt={liveEtaAt}
          speed={
            riderPoint && !arrivedHere
              ? {
                  currentKmh: position?.speedKmh ?? null,
                  limitKmh: legRoute
                    ? speedLimitAt(legRoute, riderPoint)
                    : null,
                }
              : null
          }
          distanceKm={atTarget ? 0 : legDistance}
          onSheetHeight={setSheetPx}
          cautionBanner={
            activePitStop ? (
              <aside
                className="rf-pitstop-active-bar"
                aria-label="Pitstop navigation"
              >
                <div className="rf-pitstop-main">
                  <div className="rf-pitstop-title-row">
                    <span className="rf-pitstop-pill">
                      <Icon name="fuel" size={14} />
                      Pitstop
                    </span>
                    <strong>{activePitStop.name}</strong>
                  </div>
                  <span className="rf-pitstop-sub">
                    {activePitStop.road}, {activePitStop.township}
                    {legDistance != null
                      ? ` · ${formatDistance(legDistance)} away`
                      : ""}
                  </span>
                </div>
                <div className="rf-pitstop-bar-actions">
                  <a
                    className="rf-pitstop-btn is-maps"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activePitStop.latitude},${activePitStop.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="navigation" size={14} />
                    Maps
                  </a>
                  <button
                    type="button"
                    className="rf-pitstop-btn is-resume"
                    onClick={() => {
                      setActivePitStop(null);
                      setFlash("Refueled! Resumed route to delivery stop.");
                    }}
                  >
                    <Icon name="check" size={14} />
                    Done
                  </button>
                </div>
              </aside>
            ) : nextCaution ? (
              <button
                type="button"
                className={`rf-caution-banner is-${nextCaution.report.severity}`}
                onClick={() => openPanel("cautions")}
              >
                <Icon name="warning" size={20} />
                <span>
                  <strong>
                    {cautionCopy(nextCaution.report).title} ·{" "}
                    {nextCaution.aheadKm < 0.05
                      ? "here"
                      : `${formatDistance(nextCaution.aheadKm)} ahead`}
                  </strong>
                  <small>{cautionCopy(nextCaution.report).advice}</small>
                </span>
              </button>
            ) : null
          }
        />
        {sheets}
        {previewBar}
      </>
    );
  }

  return (
    <>
      <RouteOverview
        route={route}
        vehicle={vehicle}
        dayLabel={dayLabel}
        metrics={metrics}
        map={
          navStops.length ? (
            <RiderNavMap
              driver={riderPoint}
              heading={null}
              target={null}
              stops={navStops}
              cautions={navCautions}
              padding={{ x: 28, top: 28, bottom: 28 }}
              routeThroughStops
              road={routeRoad}
              interactive={false}
              label="Today’s stops in order"
            />
          ) : null
        }
        notices={
          <>
            {isPreview && (
              <Notice tone="neutral" icon="shield">
                Preview route for development. Nothing here is saved to Supabase
                or shared.
              </Notice>
            )}
            {!online && (
              <Notice tone="warning" icon="warning">
                <strong>You’re offline.</strong> Your route stays on screen.
                Changes need a connection to save.
              </Notice>
            )}
            {(gpsState === "denied" || gpsState === "unavailable") &&
              route.state !== "NONE" &&
              route.state !== "CLOSED" && (
                <Notice
                  tone="warning"
                  icon="location"
                  action={
                    <button
                      type="button"
                      className="rf-link"
                      onClick={() => openPanel("location")}
                    >
                      Fix
                    </button>
                  }
                >
                  Location is off. You can still deliver, but customers won’t
                  see you live.
                </Notice>
              )}
            {flash && route.state !== "CLOSED" && (
              <Notice tone="success" icon="check">
                {flash}
              </Notice>
            )}
            {route.state === "PAUSED" && revisionNotice}
          </>
        }
        shiftRoute={shiftRoute}
        onFindJob={() => go("jobs")}
        online={online}
        busy={busy}
        error={errorBanner}
        sessionSaved={isPreview || sessionAvailable}
        closedAt={session?.closed_at ?? null}
        declaredCod={session?.cod_declared ?? null}
        onMenu={() => openPanel("menu")}
        onAcknowledge={() => void acknowledge()}
        onStart={() => void startRoute()}
        onStartWithLoad={(loadIds, missingIds) =>
          void startWithLoad(loadIds, missingIds)
        }
        onResume={() => void resumeRoute()}
        onCloseRoute={(declared) => void closeRoute(declared)}
      />
      {sheets}
      {previewBar}
    </>
  );

  /* ---------------- render helpers ---------------- */

  function renderSheets(): ReactNode {
    const close = () => setPanel(null);
    const canPause = route.state === "IN_PROGRESS";
    const legIds = new Set(legCautions.map((item) => item.report.id));
    switch (panel) {
      case "menu":
        return (
          <ShiftMenu
            name={profileName}
            vehicle={vehicle}
            energy={routeEnergy}
            cautionCount={routeCautions.length}
            fuelRequest={openEnergyRequest}
            fuelBusy={busy === "request"}
            fuelDone={panelDone}
            canPause={canPause}
            paused={route.state === "PAUSED"}
            onOpen={openPanel}
            onRequestFuel={() =>
              void requestHelp(
                routeEnergy.source === "battery" ? "recharge" : "refuel",
                "",
              )
            }
            onPause={() => void pauseRoute()}
            onResume={() => void resumeRoute()}
            onSignOut={() => void signOut()}
            onClose={close}
          />
        );
      case "cautions":
        return (
          <CautionsPanel
            legCautions={legCautions}
            laterCautions={routeCautions.filter(
              (item) => !legIds.has(item.report.id),
            )}
            now={now}
            canLocate={riderPoint != null}
            onLocationHelp={() => openPanel("location")}
            busy={busy === "road"}
            error={errorBanner}
            done={panelDone}
            onReport={(report) => void sendRoadReport(report)}
            onClose={close}
          />
        );
      case "problem":
        return (
          <ProblemPanel
            stopLabel={stop ? `stop ${stop.number}` : null}
            busy={busy === "request"}
            error={errorBanner}
            done={panelDone}
            canPause={canPause}
            onSend={(category: ProblemChoice, note) =>
              void requestHelp(category, note)
            }
            onPause={() => void pauseRoute()}
            onClose={close}
          />
        );
      case "exception":
        return stop ? (
          <ExceptionPanel
            stop={stop}
            initialReason={exceptionReason}
            busy={busy === "exception"}
            online={online}
            error={errorBanner}
            onSubmit={(exception) => void recordException(exception)}
            onClose={close}
          />
        ) : null;
      case "location":
        return (
          <LocationHelpSheet
            gpsState={gpsState}
            onRetry={() => {
              if (isPreview) setPreviewGpsDenied(false);
              setGpsAttempt((value) => value + 1);
            }}
            onClose={close}
          />
        );
      default:
        return null;
    }
  }

  function renderPreviewBar(): ReactNode {
    return (
      <details className="dv-preview-bar">
        <summary>Preview controls</summary>
        <div>
          <label>
            Scenario
            <select
              value={preview ?? ""}
              onChange={(event) => {
                const next = event.target.value as PreviewScenario;
                const url = new URL(window.location.href);
                url.searchParams.set("preview", next);
                window.history.replaceState(null, "", url);
                previewRequests.current.clear();
                setPreview(next);
                setPreviewData(previewState(next, Date.now()));
                setAcknowledged(null);
              }}
            >
              {PREVIEW_SCENARIOS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              setPreviewData((previous) =>
                previous
                  ? {
                      ...previous,
                      data: previewAddStop(previous.data, Date.now()),
                    }
                  : previous,
              )
            }
          >
            Dispatcher adds a stop
          </button>
          <button
            type="button"
            onClick={() =>
              setPreviewData((previous) =>
                previous
                  ? { ...previous, data: previewReorder(previous.data) }
                  : previous,
              )
            }
          >
            Dispatcher reorders
          </button>
          <label>
            <input
              type="checkbox"
              checked={previewOffline}
              onChange={(event) => setPreviewOffline(event.target.checked)}
            />{" "}
            Offline
          </label>
          <label>
            <input
              type="checkbox"
              checked={previewGpsDenied}
              onChange={(event) => setPreviewGpsDenied(event.target.checked)}
            />{" "}
            Location denied
          </label>
          <label>
            <input
              type="checkbox"
              checked={loseNextResponse}
              onChange={(event) => setLoseNextResponse(event.target.checked)}
            />{" "}
            Lose next save’s response
          </label>
          <small>
            {EXCEPTION_OPTIONS.length} exception reasons ·{" "}
            {
              route.parcels.filter((order) => hasParcelOnBoard(order.status))
                .length
            }{" "}
            on truck
          </small>
        </div>
      </details>
    );
  }
}

/** Drivers sign in on the shared sign-in page, then return to the screen they came from. */
function SignInGate() {
  return (
    <>
      <LoadingBlock title="Opening sign in…" />
      <AuthDialog open audience="team" onClose={() => undefined} />
    </>
  );
}
