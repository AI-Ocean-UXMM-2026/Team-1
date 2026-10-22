import type { ReactNode } from "react";
import { signOut } from "@/components/delivery/common";
import type { GpsState } from "@/components/delivery/rider-active";
import {
  type ExceptionDraft,
  ExceptionPanel,
} from "@/components/delivery/rider-handover";
import {
  CautionsPanel,
  FuelStopPanel,
  LocationHelpSheet,
  type ProblemChoice,
  ProblemPanel,
  type RoadReportDraft,
  ShiftMenu,
} from "@/components/delivery/rider-tools";
import type {
  DeliveryStop,
  DriverRoute,
  ExceptionReason,
} from "@/lib/delivery/driver-route";
import type { FuelStation } from "@/lib/delivery/energy-routing";
import type {
  GeoPoint,
  RoadCaution,
  RouteEnergy,
} from "@/lib/delivery/rider-route";
import type { RiderRequest, VehicleOption } from "@/lib/delivery/types";
import type { Panel } from "@/lib/delivery/use-rider-workspace";

export function RiderSheets({
  panel,
  onClose,
  route,
  profileName,
  vehicle,
  routeEnergy,
  routeCautions,
  legCautions,
  openEnergyRequest,
  busy,
  panelDone,
  nearestFuelStation,
  activePitStop,
  queuedPitStop,
  onRouteToPitStop,
  onClearPitStop,
  onOpenPanel,
  onRequestFuel,
  onPauseRoute,
  onResumeRoute,
  now,
  riderPoint,
  errorBanner,
  onSendRoadReport,
  stop,
  exceptionReason,
  online,
  onRecordException,
  gpsState,
  onRetryGps,
  onLocationHelp,
  onRequestProblem,
}: {
  panel: Panel | null;
  onClose: () => void;
  route: DriverRoute;
  profileName: string;
  vehicle: VehicleOption | null;
  routeEnergy: RouteEnergy;
  routeCautions: RoadCaution[];
  legCautions: RoadCaution[];
  openEnergyRequest: RiderRequest | null;
  busy: string | null;
  panelDone: string | null;
  nearestFuelStation?: (FuelStation & { distanceKm: number }) | null;
  activePitStop?: (FuelStation & { distanceKm: number }) | null;
  queuedPitStop?: (FuelStation & { distanceKm: number }) | null;
  onRouteToPitStop?: (
    station: FuelStation & { distanceKm: number },
    mode: "urgent" | "after_stop",
  ) => void;
  onClearPitStop?: () => void;
  onOpenPanel: (next: Panel) => void;
  onRequestFuel: () => void;
  onPauseRoute: () => void;
  onResumeRoute: () => void;
  now: number;
  riderPoint: GeoPoint | null;
  errorBanner: ReactNode;
  onSendRoadReport: (report: RoadReportDraft) => void;
  stop: DeliveryStop | null;
  exceptionReason: ExceptionReason | null;
  online: boolean;
  onRecordException: (draft: ExceptionDraft) => void;
  gpsState: GpsState;
  onRetryGps: () => void;
  onLocationHelp: () => void;
  onRequestProblem: (category: ProblemChoice, note: string) => void;
}): ReactNode {
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
          activePitStop={activePitStop}
          queuedPitStop={queuedPitStop}
          onOpen={onOpenPanel}
          onRequestFuel={onRequestFuel}
          onPause={onPauseRoute}
          onResume={onResumeRoute}
          onSignOut={() => void signOut()}
          onClose={onClose}
        />
      );
    case "fuel":
      return (
        <FuelStopPanel
          energy={routeEnergy}
          vehicle={vehicle}
          nearestStation={nearestFuelStation ?? null}
          activePitStop={activePitStop ?? null}
          queuedPitStop={queuedPitStop ?? null}
          stopNumber={stop?.number ?? null}
          onDirectNow={(st) => onRouteToPitStop?.(st, "urgent")}
          onDirectAfterStop={(st) => onRouteToPitStop?.(st, "after_stop")}
          onClearPitStop={() => onClearPitStop?.()}
          onClose={onClose}
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
          onLocationHelp={onLocationHelp}
          busy={busy === "road"}
          error={errorBanner}
          done={panelDone}
          onReport={onSendRoadReport}
          onClose={onClose}
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
          onSend={onRequestProblem}
          onPause={onPauseRoute}
          onClose={onClose}
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
          onSubmit={onRecordException}
          onClose={onClose}
        />
      ) : null;
    case "location":
      return (
        <LocationHelpSheet
          gpsState={gpsState}
          onRetry={onRetryGps}
          onClose={onClose}
        />
      );
    default:
      return null;
  }
}
