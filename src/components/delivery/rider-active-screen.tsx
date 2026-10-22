import type { ReactNode } from "react";
import { Icon } from "@/components/delivery/icons";
import {
  ActiveDelivery,
  type GpsState,
  type Instruction,
} from "@/components/delivery/rider-active";
import { HandoverPanel } from "@/components/delivery/rider-handover";
import {
  type NavCaution,
  type NavStop,
  RiderNavMap,
} from "@/components/delivery/rider-nav-map";
import { PickupPanel } from "@/components/delivery/rider-pickup";
import type {
  DeliveryStop,
  DriverRoute,
  HandoverDraft,
  PickupReasonOption,
} from "@/lib/delivery/driver-route";
import type { FuelStation } from "@/lib/delivery/energy-routing";
import {
  formatDriveMinutes,
  type RoadRoute,
  speedLimitAt,
} from "@/lib/delivery/mapbox";
import {
  cautionCopy,
  compassDirection,
  formatDistance,
  type GeoPoint,
  type RoadCaution,
  resolveTurnSymbol,
} from "@/lib/delivery/rider-route";
import type { Panel } from "@/lib/delivery/use-rider-workspace";

export function RiderActiveScreen({
  route,
  stop,
  riderPoint,
  currentTargetPoint,
  activePitStop,
  queuedPitStop,
  legDistance,
  legBearing,
  atTarget,
  legRoute,
  routeRoad,
  upcomingRoad,
  heading,
  navStops,
  navCautions,
  legCautions,
  gpsState,
  online,
  busy,
  revisionNotice,
  expanded,
  setExpanded,
  handoverKey,
  draft,
  updateDraft,
  errorBanner,
  collectStop,
  cannotCollect,
  completeStop,
  onCannotDeliver,
  markArrived,
  setHandoverKey,
  setActionError,
  openPanel,
  viewHeight,
  sheetPx,
  setSheetPx,
  now,
  position,
  setActivePitStop,
  setFlash,
  onResumeRoute,
  onPauseRoute,
  sheets,
  previewBar,
}: {
  route: DriverRoute;
  stop: DeliveryStop;
  riderPoint: GeoPoint | null;
  currentTargetPoint: GeoPoint | null;
  activePitStop: (FuelStation & { distanceKm: number }) | null;
  queuedPitStop?: (FuelStation & { distanceKm: number }) | null;
  legDistance: number | null;
  legBearing: number | null;
  atTarget: boolean;
  legRoute: RoadRoute | null;
  routeRoad: RoadRoute | null;
  upcomingRoad: RoadRoute | null;
  heading: number | null;
  navStops: NavStop[];
  navCautions: NavCaution[];
  legCautions: RoadCaution[];
  gpsState: GpsState;
  online: boolean;
  busy: string | null;
  revisionNotice: ReactNode;
  expanded: boolean;
  setExpanded: (val: boolean) => void;
  handoverKey: string | null;
  draft: HandoverDraft;
  updateDraft: (patch: Partial<HandoverDraft>) => void;
  errorBanner: ReactNode;
  collectStop: () => void;
  cannotCollect: (reason: PickupReasonOption["id"], note: string) => void;
  completeStop: () => void;
  onCannotDeliver: () => void;
  markArrived: (stop: DeliveryStop) => void;
  setHandoverKey: (key: string | null) => void;
  setActionError: (err: string | null) => void;
  openPanel: (panel: Panel) => void;
  viewHeight: number;
  sheetPx: number;
  setSheetPx: (px: number) => void;
  now: number;
  position: { speedKmh: number | null } | null;
  setActivePitStop: (val: null) => void;
  setFlash: (msg: string | null) => void;
  onResumeRoute?: () => void;
  onPauseRoute?: () => void;
  sheets: ReactNode;
  previewBar: ReactNode;
}) {
  const arrivedHere =
    stop.state === "ARRIVED" || stop.state === "HANDOVER_IN_PROGRESS";
  const isPaused = route.state === "PAUSED";

  const instruction: Instruction = isPaused
    ? {
        title: "Route paused",
        sub: "Take a break. Tap Resume route when you’re ready to continue.",
        arrow: null,
        turnSymbol: "location",
      }
    : activePitStop
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
              onCannotDeliver={onCannotDeliver}
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
        onResumeRoute={onResumeRoute}
        onPauseRoute={onPauseRoute}
        queuedPitStop={queuedPitStop}
        liveEtaAt={liveEtaAt}
        speed={
          riderPoint && !arrivedHere
            ? {
                currentKmh: position?.speedKmh ?? null,
                limitKmh: legRoute ? speedLimitAt(legRoute, riderPoint) : null,
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
