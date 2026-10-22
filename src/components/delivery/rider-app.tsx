"use client";

import "./rider-flow.css";

import { usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import { LoadingBlock } from "@/components/delivery/common";
import { RiderActiveScreen } from "@/components/delivery/rider-active-screen";
import { RiderJobsScreen } from "@/components/delivery/rider-jobs-screen";
import { RiderOverviewScreen } from "@/components/delivery/rider-overview-screen";
import { RiderPreviewBar } from "@/components/delivery/rider-preview-bar";
import { RouteRevisionNotice } from "@/components/delivery/rider-revision";
import { RiderSheets } from "@/components/delivery/rider-sheets";
import { Notice } from "@/components/delivery/rider-tools";
import { finishEstimate } from "@/lib/delivery/driver-route";
import type { DeliveryJob } from "@/lib/delivery/jobs";
import type { RiderRequest } from "@/lib/delivery/types";
import { useRiderLocation } from "@/lib/delivery/use-rider-location";
import { useRiderRouteNav } from "@/lib/delivery/use-rider-route-nav";
import { useRiderWorkspace } from "@/lib/delivery/use-rider-workspace";

export function RiderApp() {
  const ws = useRiderWorkspace();

  /* ---------------- pages: job board and route ---------------- */

  const pathname = usePathname();
  const page: "jobs" | "route" = pathname?.endsWith("/jobs") ? "jobs" : "route";
  const go = useCallback((next: "jobs" | "route") => {
    window.history.pushState(
      null,
      "",
      `/rider/${next}${window.location.search}`,
    );
    window.scrollTo(0, 0);
  }, []);

  const onJobTakenHandler = useCallback(
    (job: DeliveryJob) => {
      ws.onJobTaken(job, () => go("route"));
    },
    [ws.onJobTaken, go],
  );

  /* ---------------- location ---------------- */

  const wantsGps =
    !ws.isPreview &&
    ws.live.isAuthenticated &&
    ws.route.state !== "NONE" &&
    ws.route.state !== "CLOSED";

  const onBoardOrderIds = useMemo(
    () => ws.route.onBoard.map((order) => order.id),
    [ws.route.onBoard],
  );

  const loc = useRiderLocation({
    wantsGps,
    isPreview: ws.isPreview,
    previewGpsDenied: ws.previewGpsDenied,
    canUseLiveData: ws.live.canUseLiveData,
    driverId: ws.driverId,
    onBoardOrderIds,
    routeState: ws.route.state,
    stop: ws.stop,
    routeStops: ws.route.stops,
    now: ws.now,
  });

  /* ---------------- distances, road routes, cautions ---------------- */

  const nav = useRiderRouteNav({
    riderPoint: loc.riderPoint,
    stop: ws.stop,
    route: ws.route,
    vehicle: ws.vehicle,
    data: ws.data,
    activePitStop: ws.activePitStop,
    canUseLiveData: ws.live.canUseLiveData,
    isPreview: ws.isPreview,
    now: ws.now,
  });

  const heading = ws.isPreview
    ? nav.legBearing
    : (loc.position?.heading ?? nav.legBearing);

  /* ---------------- render checks ---------------- */

  if (!ws.now || !ws.previewChecked || (!ws.isPreview && ws.live.isLoading))
    return <LoadingBlock title="Opening your route…" />;

  if (!ws.isPreview && !ws.live.isAuthenticated) return <SignInGate />;

  const errorText = ws.actionError ?? (ws.isPreview ? null : ws.live.error);
  const errorBanner = errorText ? (
    <Notice
      tone="error"
      icon="warning"
      action={
        <button
          type="button"
          className="rf-link"
          onClick={() =>
            ws.actionError ? ws.setActionError(null) : void ws.live.refresh()
          }
        >
          {ws.actionError ? "Dismiss" : "Retry"}
        </button>
      }
    >
      {errorText}
    </Notice>
  ) : ws.live.isStale ? (
    <Notice tone="warning" icon="warning">
      <strong>Showing your saved route.</strong> We couldn’t reach the server.
      It will refresh when the connection returns.
    </Notice>
  ) : null;

  const revisionNotice = (
    <RouteRevisionNotice
      route={ws.route}
      started={ws.started}
      revision={ws.revision}
      revisionOpen={ws.revisionOpen}
      onOpenChange={ws.setRevisionOpen}
      stop={ws.stop}
      finishEstimate={finishEstimate}
      acknowledged={ws.acknowledged}
      errorBanner={errorBanner}
      busy={ws.busy}
      online={ws.online}
      onAcknowledge={() => void ws.acknowledge()}
      onLoadParcels={(ids) => void ws.loadParcels(ids)}
      onDismiss={() => {
        ws.setResnapshot(true);
        ws.setRevisionOpen(false);
      }}
    />
  );

  const myRequests = ws.data.riderRequests.filter(
    (request: RiderRequest) => request.driver_id === ws.driverId,
  );
  const openEnergyRequest =
    myRequests.find(
      (request: RiderRequest) =>
        request.kind === "energy" && request.status !== "resolved",
    ) ?? null;

  const sheets = (
    <RiderSheets
      panel={ws.panel}
      onClose={() => ws.setPanel(null)}
      route={ws.route}
      profileName={ws.profileName}
      vehicle={ws.vehicle}
      routeEnergy={nav.routeEnergy}
      routeCautions={nav.routeCautions}
      legCautions={nav.legCautions}
      openEnergyRequest={openEnergyRequest}
      busy={ws.busy}
      panelDone={ws.panelDone}
      onOpenPanel={ws.openPanel}
      onRequestFuel={() =>
        void ws.requestHelp(
          nav.routeEnergy.source === "battery" ? "recharge" : "refuel",
          "",
          loc.riderPoint,
          nav.routeEnergy.levelPercent,
        )
      }
      onPauseRoute={() => void ws.pauseRoute()}
      onResumeRoute={() => void ws.resumeRoute()}
      now={ws.now}
      riderPoint={loc.riderPoint}
      errorBanner={errorBanner}
      onSendRoadReport={(report) =>
        void ws.sendRoadReport(report, loc.riderPoint)
      }
      stop={ws.stop}
      exceptionReason={ws.exceptionReason}
      online={ws.online}
      onRecordException={(draft) => void ws.recordException(draft)}
      gpsState={loc.gpsState}
      onRetryGps={() => {
        if (ws.isPreview) ws.setPreviewGpsDenied(false);
        loc.retryGps();
      }}
      onLocationHelp={() => ws.openPanel("location")}
      onRequestProblem={(category, note) =>
        void ws.requestHelp(
          category,
          note,
          loc.riderPoint,
          nav.routeEnergy.levelPercent,
        )
      }
    />
  );

  const previewBar = ws.isPreview ? (
    <RiderPreviewBar
      preview={ws.preview}
      setPreview={ws.setPreview}
      setPreviewData={ws.setPreviewData}
      previewOffline={ws.previewOffline}
      setPreviewOffline={ws.setPreviewOffline}
      previewGpsDenied={ws.previewGpsDenied}
      setPreviewGpsDenied={ws.setPreviewGpsDenied}
      loseNextResponse={ws.loseNextResponse}
      setLoseNextResponse={ws.setLoseNextResponse}
      setAcknowledged={ws.setAcknowledged}
      previewRequests={ws.previewRequests}
      route={ws.route}
    />
  ) : null;

  if (page === "jobs") {
    const activeJob = !["NONE", "COMPLETED", "CLOSED"].includes(ws.route.state);
    return (
      <RiderJobsScreen
        vehicles={ws.data.vehicles}
        activeJob={activeJob}
        isPreview={ws.isPreview}
        onJobTaken={onJobTakenHandler}
        onOpenMenu={() => ws.openPanel("menu")}
        onGoRoute={() => go("route")}
        flash={ws.flash}
        sheets={sheets}
        previewBar={previewBar}
      />
    );
  }

  if (ws.route.state === "IN_PROGRESS" && ws.stop) {
    return (
      <RiderActiveScreen
        route={ws.route}
        stop={ws.stop}
        riderPoint={loc.riderPoint}
        currentTargetPoint={nav.currentTargetPoint}
        activePitStop={ws.activePitStop}
        legDistance={nav.legDistance}
        legBearing={nav.legBearing}
        atTarget={nav.atTarget}
        legRoute={nav.legRoute}
        routeRoad={nav.routeRoad}
        upcomingRoad={nav.upcomingRoad}
        heading={heading}
        navStops={nav.navStops}
        navCautions={nav.navCautions}
        legCautions={nav.legCautions}
        gpsState={loc.gpsState}
        online={ws.online}
        busy={ws.busy}
        flash={ws.flash}
        revisionNotice={revisionNotice}
        expanded={ws.expanded}
        setExpanded={ws.setExpanded}
        handoverKey={ws.handoverKey}
        draft={ws.draft}
        updateDraft={ws.updateDraft}
        errorBanner={errorBanner}
        collectStop={() => void ws.collectStop()}
        cannotCollect={(reason, note) => void ws.cannotCollect(reason, note)}
        completeStop={() => void ws.completeStop()}
        onCannotDeliver={() => {
          ws.setExceptionReason(null);
          ws.openPanel("exception");
        }}
        markArrived={ws.markArrived}
        setHandoverKey={ws.setHandoverKey}
        setActionError={ws.setActionError}
        openPanel={ws.openPanel}
        viewHeight={ws.viewHeight}
        sheetPx={ws.sheetPx}
        setSheetPx={ws.setSheetPx}
        now={ws.now}
        position={loc.position}
        setActivePitStop={ws.setActivePitStop}
        setFlash={ws.setFlash}
        sheets={sheets}
        previewBar={previewBar}
      />
    );
  }

  return (
    <RiderOverviewScreen
      route={ws.route}
      shiftRoute={ws.shiftRoute}
      vehicle={ws.vehicle}
      dayLabel={nav.dayLabel}
      metrics={nav.metrics}
      navStops={nav.navStops}
      navCautions={nav.navCautions}
      riderPoint={loc.riderPoint}
      routeRoad={nav.routeRoad}
      isPreview={ws.isPreview}
      online={ws.online}
      gpsState={loc.gpsState}
      flash={ws.flash}
      revisionNotice={revisionNotice}
      busy={ws.busy}
      errorBanner={errorBanner}
      sessionSaved={ws.isPreview || ws.sessionAvailable}
      closedAt={ws.session?.closed_at ?? null}
      declaredCod={ws.session?.cod_declared ?? null}
      onFindJob={() => go("jobs")}
      onMenu={() => ws.openPanel("menu")}
      onAcknowledge={() => void ws.acknowledge()}
      onStart={() => void ws.startRoute()}
      onStartWithLoad={(loadIds, missingIds) =>
        void ws.startWithLoad(loadIds, missingIds, loc.riderPoint)
      }
      onResume={() => void ws.resumeRoute()}
      onCloseRoute={(declared) => void ws.closeRoute(declared)}
      onOpenLocationHelp={() => ws.openPanel("location")}
      sheets={sheets}
      previewBar={previewBar}
    />
  );
}

function SignInGate() {
  return (
    <>
      <LoadingBlock title="Opening sign in…" />
      <AuthDialog open audience="team" onClose={() => undefined} />
    </>
  );
}
