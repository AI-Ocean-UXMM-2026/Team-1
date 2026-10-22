import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExceptionDraft } from "@/components/delivery/rider-handover";
import type { RoadReportDraft } from "@/components/delivery/rider-tools";
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
  type ExceptionReason,
  finishEstimate,
  type HandoverDraft,
  type PickupReasonOption,
  type RouteSession,
  snapshotRoute,
  stopParcels,
} from "@/lib/delivery/driver-route";
import {
  type FuelStation,
  findNearestFuelStation,
} from "@/lib/delivery/energy-routing";
import { currency } from "@/lib/delivery/format";
import {
  createOrdersForJob,
  type DeliveryJob,
  isLocalOrderId,
  isSampleJob,
} from "@/lib/delivery/jobs";
import {
  type Acknowledged,
  ALLOW_PREVIEW,
  EMPTY_JOB_MARK,
  EMPTY_LOCAL_JOB,
  friendlyError,
  type JobMark,
  type LocalJobData,
  newRequestId,
  pickLocalJob,
  withLocalJob,
  yangonDate,
} from "@/lib/delivery/rider-helpers";
import {
  isPreviewScenario,
  PREVIEW_DRIVER_ID,
  type PreviewScenario,
  type PreviewState,
  previewCollect,
  previewSetStatus,
  previewState,
} from "@/lib/delivery/rider-preview";
import { type GeoPoint, isClosed } from "@/lib/delivery/rider-route";
import type {
  DeliveryOrder,
  DeliveryStatus,
  RiderRequest,
  RiderRequestCategory,
  WorkspaceData,
} from "@/lib/delivery/types";
import { useStoredState } from "@/lib/delivery/use-stored-state";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import { createClient } from "@/lib/supabase/client";

export type Panel = "menu" | "cautions" | "problem" | "location" | "exception";

export function useRiderWorkspace() {
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
  const [arrived, setArrived] = useStoredState<string[]>(
    `${storeKey}.arrived`,
    [],
  );
  const [jobMark, setJobMark] = useStoredState<JobMark>(
    `${storeKey}.job`,
    EMPTY_JOB_MARK,
  );
  const [deferred, setDeferred] = useStoredState<string[]>(
    `${storeKey}.deferred`,
    [],
  );
  const [drafts, setDrafts] = useStoredState<Record<string, HandoverDraft>>(
    `${storeKey}.drafts`,
    {},
  );
  const [handoverKey, setHandoverKey] = useStoredState<string | null>(
    `${storeKey}.handover`,
    null,
  );
  const [acknowledged, setAcknowledged] = useStoredState<Acknowledged | null>(
    `${storeKey}.ack`,
    null,
  );
  const [localSession, setLocalSession] = useStoredState<RouteSession | null>(
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
      .then((sess) => {
        if (active) setServerSession(sess);
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

  /* ---------------- writes & actions ---------------- */

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 7000);
    return () => window.clearTimeout(id);
  }, [flash]);

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
        | "accepted"
        | "picked_up"
        | "in_transit"
        | "delivered"
        | "failed",
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
        if (started && status === "picked_up")
          await moveParcel({ ...order, status }, "in_transit");
      }
      if (started) setResnapshot(true);
    });

  const tellOperationsMissing = async (
    orderIds: string[],
    riderPoint: GeoPoint | null,
  ) => {
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

  const startWithLoad = (
    loadIds: string[],
    missingIds: string[],
    riderPoint: GeoPoint | null,
  ) =>
    run("start", async () => {
      if (missingIds.length)
        await tellOperationsMissing(missingIds, riderPoint);
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

  const onJobTaken = useCallback(
    (job: DeliveryJob, onNavRoute: () => void) => {
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
            ...previous.routeStops.filter((st) => !isOld(st.order_id)),
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
      onNavRoute();
    },
    [
      data.orders,
      driverId,
      isPreview,
      live,
      session?.status,
      setAcknowledged,
      setArrived,
      setDeferred,
      setJobMark,
      updateData,
    ],
  );

  const markArrived = (target: DeliveryStop) => {
    setArrived([target.key]);
    const orderIds = (target.kind === "pickup" ? target.collect : target.open)
      .map((order) => order.id)
      .filter((id) => !isLocalOrderId(id));
    if (!isPreview && live.canUseLiveData && orderIds.length > 0)
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

  const collectStop = () =>
    run("collect", async () => {
      if (!stop || stop.kind !== "pickup") return;
      const target = stop;
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

  const [activePitStop, setActivePitStop] = useState<
    (FuelStation & { distanceKm: number }) | null
  >(null);

  const requestHelp = (
    category: RiderRequestCategory,
    note: string,
    riderPoint: GeoPoint | null,
    levelPercent: number | null,
  ) =>
    run("request", async () => {
      if (!driverId) return;
      const isEnergy = category === "refuel" || category === "recharge";

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
        energy_level_percent: levelPercent,
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

  const sendRoadReport = (
    report: RoadReportDraft,
    riderPoint: GeoPoint | null,
  ) =>
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

  return {
    live,
    preview,
    setPreview,
    previewChecked,
    previewData,
    setPreviewData,
    previewOffline,
    setPreviewOffline,
    previewGpsDenied,
    setPreviewGpsDenied,
    loseNextResponse,
    setLoseNextResponse,
    previewRequests,
    isPreview,
    data,
    driverId,
    profileName,
    updateData,
    now,
    online,
    today,
    viewHeight,
    sheetPx,
    setSheetPx,
    arrived,
    jobMark,
    deferred,
    drafts,
    handoverKey,
    setHandoverKey,
    acknowledged,
    setAcknowledged,
    session,
    sessionAvailable,
    route,
    shiftRoute,
    stop,
    draft,
    vehicle,
    started,
    revision,
    revisionOpen,
    setRevisionOpen,
    setResnapshot,
    busy,
    actionError,
    setActionError,
    flash,
    setFlash,
    acknowledge,
    loadParcels,
    startWithLoad,
    startRoute,
    pauseRoute,
    resumeRoute,
    closeRoute,
    onJobTaken,
    markArrived,
    updateDraft,
    completeStop,
    collectStop,
    cannotCollect,
    recordException,
    exceptionReason,
    setExceptionReason,
    panel,
    setPanel,
    panelDone,
    setPanelDone,
    expanded,
    setExpanded,
    openPanel,
    activePitStop,
    setActivePitStop,
    requestHelp,
    sendRoadReport,
  };
}
