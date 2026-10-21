"use client";

import "./rider-flow.css";
import "./rider-delivery.css";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import { Brand, LoadingBlock, signOut } from "@/components/delivery/common";
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
import { type NavStop, RiderNavMap } from "@/components/delivery/rider-nav-map";
import {
  type RouteMetrics,
  RouteOverview,
} from "@/components/delivery/rider-overview";
import {
  CautionsPanel,
  EnergyPanel,
  Notice,
  type ProblemChoice,
  ProblemPanel,
  type RoadReportDraft,
  Sheet,
  ShiftMenu,
  type ToolPanel,
} from "@/components/delivery/rider-tools";
import {
  completeDelivery,
  type DeliveryOutcomeInput,
  type DeliveryOutcomeResult,
  loadRouteSession,
  markStopArrived,
  RouteSessionUnavailable,
  requestRiderAssistance,
  sendDriverLocation,
  setOrderStatus,
  setRouteState,
  submitRoadReport,
  updateVehicleEnergy,
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
  type RouteSession,
  type RouteSnapshot,
  snapshotRoute,
} from "@/lib/delivery/driver-route";
import { currency, formatTime } from "@/lib/delivery/format";
import { formatDriveMinutes } from "@/lib/delivery/mapbox";
import { watchRiderLocations } from "@/lib/delivery/rider-location";
import {
  isPreviewScenario,
  PREVIEW_DEPOT,
  PREVIEW_DRIVER_ID,
  PREVIEW_SCENARIOS,
  type PreviewScenario,
  type PreviewState,
  previewAddStop,
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
} from "@/lib/delivery/rider-route";
import type {
  DeliveryOrder,
  DeliveryStatus,
  RiderRequest,
  RiderRequestCategory,
  WorkspaceData,
} from "@/lib/delivery/types";
import { useRoadRoute } from "@/lib/delivery/use-road-route";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

type DevicePosition = GeoPoint & {
  heading: number | null;
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
    // Storage can be unavailable in private browsing; state then lives in memory only.
  }
}

/** State kept on this phone so a reload or dropped connection loses nothing. */
function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    setValue(readStore(key, fallbackRef.current));
  }, [key]);
  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof next === "function"
            ? (next as (previous: T) => T)(previous)
            : next;
        writeStore(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, update] as const;
}

function friendlyError(cause: unknown, fallback: string) {
  if (cause instanceof TypeError || /fetch|network/i.test(String(cause)))
    return "Couldn’t reach the server. Nothing was lost — your entries are kept. Try again.";
  return cause instanceof Error ? cause.message : fallback;
}

function directionsUrl(stop: DeliveryStop) {
  const destination = stop.point
    ? `${stop.point.latitude},${stop.point.longitude}`
    : stop.address;
  return `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: "1",
    destination,
    dir_action: "navigate",
  })}`;
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
  const data: WorkspaceData = isPreview ? previewData.data : live.data;
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
      else live.updateData(updater);
    },
    [preview, live.updateData],
  );

  /* ---------------- clock, connectivity, viewport ---------------- */

  const [now, setNow] = useState(0);
  const [deviceOnline, setDeviceOnline] = useState(true);
  const [viewHeight, setViewHeight] = useState(844);
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

  const [serverSession, setServerSession] = useState<RouteSession | null>(
    null,
  );
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

  const route = useMemo(
    () =>
      buildDriverRoute({
        orders: data.orders,
        events: data.statusEvents,
        routeStops: data.routeStops,
        driverId,
        now,
        session,
        arrived,
        handover: handoverKey,
        deferred,
      }),
    [data, driverId, now, session, arrived, handoverKey, deferred],
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
  }, [wantsGps, gpsAttempt]);

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
  const [sharing, setSharing] = useState<number | null>(null);
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
      send: (orderId, point) =>
        sendDriverLocation(
          createClient(),
          orderId,
          driverId,
          point.latitude,
          point.longitude,
          point.accuracy,
        ),
      onSent: (sentIds) => setSharing(sentIds.length),
      onError: () => setSharing(null),
    });
  }, [onBoardKey, isPreview, live.canUseLiveData, driverId, route.state]);

  /* ---------------- distances, road routes, cautions ---------------- */

  const openPoints = useMemo(
    () =>
      [stop, ...route.upcoming].flatMap((item) =>
        item?.point ? [item.point] : [],
      ),
    [stop, route.upcoming],
  );
  const legRoute = useRoadRoute(
    riderPoint,
    stop?.point && riderPoint ? [stop.point] : [],
  );
  const routeOrigin = riderPoint ?? openPoints[0] ?? null;
  const routeRoad = useRoadRoute(
    routeOrigin,
    riderPoint ? openPoints : openPoints.slice(1),
  );
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
    riderPoint && stop?.point ? distanceKm(riderPoint, stop.point) : null;
  const legBearing =
    riderPoint && stop?.point ? bearingDegrees(riderPoint, stop.point) : null;
  const atTarget = legDistance != null && legDistance <= ARRIVAL_RADIUS_KM;

  const legPath = useMemo<GeoPoint[]>(() => {
    if (legRoute)
      return legRoute.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      }));
    return [riderPoint, stop?.point ?? null].filter(
      (item): item is GeoPoint => item != null,
    );
  }, [legRoute, riderPoint, stop?.point]);
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
      setActionError("Your session needs refreshing. Sign in again to continue.");
      return false;
    }
    busyRef.current = true;
    setBusy(label);
    setActionError(null);
    try {
      await task();
      return true;
    } catch (cause) {
      setActionError(friendlyError(cause, "That update did not save. Try again."));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(null);
      if (!isPreview) void live.refresh(true);
    }
  }

  const applyStatus = useCallback(
    (orderId: string, status: DeliveryStatus, extra: Partial<DeliveryOrder> = {}) =>
      updateData((previous) => ({
        ...previous,
        orders: previous.orders.map((order) =>
          order.id === orderId ? { ...order, status, ...extra } : order,
        ),
        statusEvents: [
          ...previous.statusEvents,
          {
            id: Math.max(0, ...previous.statusEvents.map((event) => event.id)) + 1,
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
          ? { ...previous, data: previewSetStatus(previous.data, order.id, status) }
          : previous,
      );
      return;
    }
    await setOrderStatus(
      createClient(),
      order.id,
      status as "accepted" | "picked_up" | "in_transit" | "delivered" | "failed",
    );
    applyStatus(order.id, status);
  }

  async function sendOutcome(
    input: DeliveryOutcomeInput,
  ): Promise<DeliveryOutcomeResult> {
    if (!isPreview) return completeDelivery(createClient(), input);
    const seen = previewRequests.current.get(input.requestId);
    if (seen) return { ...seen, duplicate: true };
    const order = previewData.data.orders.find((item) => item.id === input.orderId);
    if (!order) throw new Error("This parcel is not assigned to you");
    if (order.status === "delivered" || order.status === "failed")
      throw new Error(`This parcel already has an outcome: ${order.status}`);
    if (input.outcome === "delivered" && !input.parcelVerified)
      throw new Error("Check the parcel against the manifest before handing it over");
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
                        ? { ...item, status: input.outcome, cod_status: codStatus }
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

  const startRoute = () =>
    run("start", async () => {
      for (const order of route.onBoard)
        if (order.status === "picked_up") await moveParcel(order, "in_transit");
      await saveSession("in_progress");
      setAcknowledged(null);
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

  const markArrived = (target: DeliveryStop) => {
    setArrived((keys) => [...new Set([...keys, target.key])]);
    if (!isPreview && live.canUseLiveData)
      // Best effort: only routes created by dispatch have stop rows to mark.
      void markStopArrived(
        createClient(),
        target.open.map((order) => order.id),
      ).catch(() => undefined);
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
      const current = { ...draft, requestIds };
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
            due > 0 ? (allocation ? (allocation.get(order.id) ?? 0) : due) : null,
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
      const collected = allocation
        ? Number(current.codAmount)
        : target.codDue;
      finishStop(target);
      setFlash(
        `Stop ${target.number} delivered · ${target.open.length} ${target.open.length === 1 ? "parcel" : "parcels"}${target.codDue > 0 ? ` · ${currency.format(collected)} COD recorded` : ""}${duplicates ? " · already saved on the first try" : ""}.`,
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
        [target.key]: { ...(previous[target.key] ?? EMPTY_HANDOVER), requestIds },
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
      const record: RiderRequest = {
        id: `local-${Date.now()}`,
        driver_id: driverId,
        driver_name: profileName,
        order_id: stop?.open[0]?.id ?? null,
        vehicle_id: vehicle?.id ?? null,
        kind: category === "refuel" || category === "recharge" ? "energy" : "issue",
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
      if (!isPreview)
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
      updateData((previous) => ({
        ...previous,
        riderRequests: [record, ...previous.riderRequests],
      }));
      setPanelDone(
        category === "refuel" || category === "recharge"
          ? "Operations has your request and your location. Keep driving only if it’s safe."
          : "Sent to operations with your location and current stop. They’ll contact you.",
      );
    });

  const reportMissing = (orderIds: string[]) => {
    const codes = route.parcels
      .filter((order) => orderIds.includes(order.id))
      .map((order) => order.tracking_code)
      .join(", ");
    return run("request", async () => {
      if (!driverId) return;
      const note = `Not on the truck at loading: ${codes}`.slice(0, 500);
      if (!isPreview)
        await requestRiderAssistance(createClient(), {
          driverId,
          orderId: orderIds[0] ?? null,
          vehicleId: vehicle?.id ?? null,
          category: "other",
          note,
          energyLevelPercent: null,
          latitude: riderPoint?.latitude ?? null,
          longitude: riderPoint?.longitude ?? null,
        });
      setFlash(`Operations told: ${codes} missing at loading.`);
    });
  };

  const saveEnergy = (level: number) =>
    run("energy", async () => {
      if (!vehicle) return;
      if (!isPreview)
        await updateVehicleEnergy(createClient(), {
          vehicleId: vehicle.id,
          energySource: vehicle.energy_source,
          levelPercent: level,
        });
      updateData((previous) => ({
        ...previous,
        vehicles: previous.vehicles.map((item) =>
          item.id === vehicle.id
            ? {
                ...item,
                fuel_level_percent:
                  item.energy_source === "electric" ? item.fuel_level_percent : level,
                battery_level_percent:
                  item.energy_source === "fuel" ? item.battery_level_percent : level,
              }
            : item,
        ),
      }));
    });

  const sendRoadReport = (report: RoadReportDraft) =>
    run("road", async () => {
      if (!driverId) return;
      if (!riderPoint)
        throw new Error("Your location is needed to place a road report.");
      if (!isPreview)
        await submitRoadReport(createClient(), {
          driverId,
          orderId: stop?.open[0]?.id ?? null,
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

  if (!isPreview && !live.isAuthenticated)
    return <SignInGate />;

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
            kind: "dropoff" as const,
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

  const revisionNotice = renderRevision();
  const sheets = renderSheets();
  const previewBar = isPreview ? renderPreviewBar() : null;

  if (route.state === "IN_PROGRESS" && stop) {
    const arrivedHere =
      stop.state === "ARRIVED" || stop.state === "HANDOVER_IN_PROGRESS";
    const instruction: Instruction = !stop.point
      ? {
          title: "No map pin for this address",
          sub: "Use the address below, or call the recipient",
          arrow: null,
        }
      : arrivedHere
        ? { title: `At stop ${stop.number}`, sub: "Park safely, then start the handover", arrow: null }
        : !riderPoint
          ? {
              title:
                gpsState === "denied" || gpsState === "unavailable"
                  ? "Live position unavailable"
                  : "Finding your location…",
              sub: "Route shown from stop pins. Use Directions to navigate.",
              arrow: null,
            }
          : atTarget
            ? { title: "You’re at the stop", sub: "Park safely, then tap I’ve arrived", arrow: null }
            : legRoute?.firstStep
              ? {
                  title: legRoute.firstStep.instruction,
                  sub: `${formatDistance(legRoute.distanceKm)} · ${formatDriveMinutes(legRoute.durationMin)} by road to stop ${stop.number}`,
                  arrow: null,
                }
              : {
                  title: `Head ${compassDirection(legBearing ?? 0)}`,
                  sub: `${formatDistance(legDistance)} straight-line to stop ${stop.number}`,
                  arrow: 0,
                };
    const heading = isPreview ? legBearing : (position?.heading ?? legBearing);
    if (instruction.arrow != null)
      instruction.arrow = (legBearing ?? 0) - (heading ?? 0);
    const nextCaution = legCautions[0] ?? null;
    const sheetHeight = handoverKey
      ? Math.round(viewHeight * 0.88)
      : expanded
        ? Math.round(viewHeight * 0.72)
        : 330;

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
              target={stop.point ? { ...stop.point, kind: "dropoff" } : null}
              targetId={stop.key}
              stops={navStops}
              upcoming={route.upcoming.flatMap((item) =>
                item.point ? [item.point] : [],
              )}
              cautions={navCautions}
              routeThroughStops={riderPoint == null}
              padding={{ x: 48, top: nextCaution ? 250 : 190, bottom: sheetHeight + 16 }}
              road={riderPoint ? legRoute : null}
              label={`Map to stop ${stop.number} of ${route.stops.length}: ${stop.address}`}
            />
          }
          instruction={instruction}
          gps={gpsState}
          online={online}
          syncing={busy != null}
          sharingCount={sharing}
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
            handoverKey === stop.key ? (
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
          directionsHref={directionsUrl(stop)}
          error={errorBanner}
          busy={busy != null}
          onArrived={() => {
            markArrived(stop);
            setExpanded(false);
          }}
          onUndoArrived={() =>
            setArrived((keys) => keys.filter((key) => key !== stop.key))
          }
          onStartHandover={() => {
            setActionError(null);
            setHandoverKey(stop.key);
          }}
          onCloseHandover={() => setHandoverKey(null)}
          onCannotDeliver={() => {
            setExceptionReason(null);
            openPanel("exception");
          }}
          onMenu={() => openPanel("menu")}
          onCautions={() => openPanel("cautions")}
          onLocationHelp={() => openPanel("location")}
          cautionBanner={
            nextCaution ? (
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
              label="Today’s stops in delivery order"
            />
          ) : null
        }
        notices={
          <>
            {isPreview && (
              <Notice tone="neutral" icon="shield">
                Preview route for development. Nothing here is saved to
                Supabase or shared.
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
            {flash && (
              <Notice tone="success" icon="check">
                {flash}
              </Notice>
            )}
            {route.state === "PAUSED" && revisionNotice}
          </>
        }
        online={online}
        busy={busy}
        error={errorBanner}
        sessionSaved={isPreview || sessionAvailable}
        closedAt={session?.closed_at ?? null}
        declaredCod={session?.cod_declared ?? null}
        onMenu={() => openPanel("menu")}
        onAcknowledge={() => void acknowledge()}
        onLoad={(ids) => void loadParcels(ids)}
        onReportMissing={(ids) => void reportMissing(ids)}
        onStart={() => void startRoute()}
        onResume={() => void resumeRoute()}
        onCloseRoute={(declared) => void closeRoute(declared)}
      />
      {sheets}
      {previewBar}
    </>
  );

  /* ---------------- render helpers ---------------- */

  function renderRevision(): ReactNode {
    const waitingToLoad = started ? route.toLoad : [];
    const unacknowledged = started ? route.unacknowledged : [];
    if (!revision && !waitingToLoad.length && !unacknowledged.length)
      return null;
    const added = revision?.addedParcels ?? unacknowledged;
    const addedStops = route.stops.filter((item) =>
      item.parcels.some((order) => added.some((other) => other.id === order.id)),
    );
    const finishNow = finishEstimate(route);
    const summary = [
      added.length
        ? `${addedStops.length} ${addedStops.length === 1 ? "stop" : "stops"} added`
        : null,
      revision?.removedParcels.length
        ? `${revision.removedParcels.length} ${revision.removedParcels.length === 1 ? "parcel" : "parcels"} removed`
        : null,
      revision?.reordered ? "order changed" : null,
      !added.length && waitingToLoad.length
        ? `${waitingToLoad.length} to load`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const needsAck = unacknowledged.length > 0;
    if (!revisionOpen)
      return (
        <button
          type="button"
          className={`dv-revision ${revision?.currentChanged ? "is-urgent" : ""}`}
          onClick={() => setRevisionOpen(true)}
          aria-expanded="false"
        >
          <Icon name="bell" size={18} />
          <span>
            <strong>Route updated by dispatch</strong>
            <small>{summary}</small>
          </span>
          <span className="dv-revision-cta">
            {needsAck ? "Review" : "View"}
          </span>
        </button>
      );
    return (
      <section className="dv-revision is-open" aria-label="Route update">
        <div className="dv-revision-head">
          <Icon name="bell" size={18} />
          <strong>Route updated by dispatch</strong>
          <button
            type="button"
            className="rf-icon-btn"
            aria-label="Hide route update"
            onClick={() => setRevisionOpen(false)}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <ul>
          {addedStops.map((item) => (
            <li key={item.key}>
              <strong>
                + Stop {item.number} · {item.recipient}
              </strong>
              <span>
                {item.address} · {item.parcels.length}{" "}
                {item.parcels.length === 1 ? "parcel" : "parcels"}
                {item.codDue > 0 ? ` · COD ${currency.format(item.codDue)}` : ""}
              </span>
            </li>
          ))}
          {revision?.reordered && (
            <li>
              <strong>Delivery order changed</strong>
              <span>The stop list below shows the new order.</span>
            </li>
          )}
          {revision?.removedParcels.length ? (
            <li>
              <strong>
                {revision.removedParcels.length}{" "}
                {revision.removedParcels.length === 1 ? "parcel" : "parcels"}{" "}
                taken off your route
              </strong>
              <span>Keep them on the truck until operations says otherwise.</span>
            </li>
          ) : null}
          <li>
            <strong>
              {revision?.currentChanged && stop
                ? `Your next stop is now stop ${stop.number} · ${stop.recipient}`
                : "Your current stop hasn’t changed"}
            </strong>
            <span>
              {finishNow
                ? `Finish by ${formatTime(finishNow)}${acknowledged?.finishBy && acknowledged.finishBy !== finishNow ? ` (was ${formatTime(acknowledged.finishBy)})` : ""}`
                : "No finish time from dispatch"}
            </span>
          </li>
          {waitingToLoad.length > 0 && (
            <li>
              <strong>
                {waitingToLoad.length}{" "}
                {waitingToLoad.length === 1 ? "parcel isn’t" : "parcels aren’t"}{" "}
                on your truck yet
              </strong>
              <span>
                Collect from {waitingToLoad[0].pickup_address} as dispatch
                arranges, then mark it loaded.
              </span>
            </li>
          )}
        </ul>
        {errorBanner}
        {needsAck ? (
          <button
            type="button"
            className="rf-btn rf-btn-primary"
            disabled={busy != null || !online}
            onClick={() => void acknowledge()}
          >
            {busy === "acknowledge" ? "Saving…" : "Acknowledge changes"}
          </button>
        ) : waitingToLoad.length ? (
          <button
            type="button"
            className="rf-btn rf-btn-primary"
            disabled={busy != null || !online}
            onClick={() =>
              void loadParcels(waitingToLoad.map((order) => order.id))
            }
          >
            {busy === "load"
              ? "Saving…"
              : `Mark ${waitingToLoad.length} loaded`}
          </button>
        ) : (
          <button
            type="button"
            className="rf-btn rf-btn-secondary"
            onClick={() => {
              setResnapshot(true);
              setRevisionOpen(false);
            }}
          >
            Got it
          </button>
        )}
      </section>
    );
  }

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
            requests={myRequests}
            canPause={canPause}
            paused={route.state === "PAUSED"}
            onOpen={openPanel}
            onPause={() => void pauseRoute()}
            onResume={() => void resumeRoute()}
            onSignOut={() => void signOut()}
            onClose={close}
          />
        );
      case "energy":
        return (
          <EnergyPanel
            vehicle={vehicle}
            energy={routeEnergy}
            openRequest={openEnergyRequest}
            busy={busy != null}
            error={errorBanner}
            done={panelDone}
            onSaveLevel={saveEnergy}
            onRequest={(note) =>
              void requestHelp(
                routeEnergy.source === "battery" ? "recharge" : "refuel",
                note,
              )
            }
            onClose={close}
          />
        );
      case "cautions":
        return (
          <CautionsPanel
            legCautions={legCautions}
            laterCautions={routeCautions.filter((item) => !legIds.has(item.report.id))}
            now={now}
            canLocate={riderPoint != null}
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
            onSend={(category: ProblemChoice, note) => void requestHelp(category, note)}
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
          <Sheet
            title={gpsState === "stale" ? "GPS signal is old" : "Location is off"}
            onClose={close}
          >
            <p>
              {gpsState === "stale"
                ? "Your phone hasn’t sent a fresh position for over a minute. The map shows where you were last seen."
                : "Oern can’t read your location, so the map shows your stops without your position, and customers won’t see you live."}
            </p>
            <ol className="dv-steps">
              <li>Open your browser’s site settings for Oern.</li>
              <li>Set Location to Allow.</li>
              <li>Come back and tap Try again.</li>
            </ol>
            <p className="rf-muted">
              Deliveries, COD and proof still work without location.
            </p>
            <button
              type="button"
              className="rf-btn rf-btn-primary"
              onClick={() => {
                if (isPreview) setPreviewGpsDenied(false);
                setGpsAttempt((value) => value + 1);
                close();
              }}
            >
              Try again
            </button>
            <button type="button" className="rf-btn rf-btn-quiet" onClick={close}>
              Continue without live location
            </button>
          </Sheet>
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
                  ? { ...previous, data: previewAddStop(previous.data, Date.now()) }
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
            {route.parcels.filter((order) => hasParcelOnBoard(order.status)).length}{" "}
            on truck
          </small>
        </div>
      </details>
    );
  }
}

function SignInGate() {
  const [open, setOpen] = useState(false);
  return (
    <main className="rf-app rf-gate">
      <Brand href="/rider" />
      <div className="rf-route-art" aria-hidden="true">
        <svg viewBox="0 0 360 180" role="presentation">
          <path
            className="rf-route-road"
            d="M22 144C78 48 126 156 178 91S268 34 338 54"
          />
          <path
            className="rf-route-line"
            d="M22 144C78 48 126 156 178 91S268 34 338 54"
          />
          <circle className="rf-route-pulse" cx="338" cy="54" r="12" />
          <circle
            className="rf-route-pulse rf-route-pulse-delay"
            cx="338"
            cy="54"
            r="12"
          />
          <circle className="rf-route-pickup" cx="22" cy="144" r="10" />
          <circle className="rf-route-destination" cx="338" cy="54" r="10" />
          <circle className="rf-route-rider" cx="178" cy="91" r="7">
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              path="M-156 53 C-100 -43 -52 65 0 0 S90 -57 160 -37"
            />
          </circle>
        </svg>
      </div>
      <h1>Sign in to see today’s route</h1>
      <p>Driver accounts are set up by your operations team.</p>
      <button
        type="button"
        className="rf-btn rf-btn-primary"
        onClick={() => setOpen(true)}
      >
        Sign in <Icon name="arrow-right" size={18} />
      </button>
      <AuthDialog open={open} audience="team" onClose={() => setOpen(false)} />
    </main>
  );
}
