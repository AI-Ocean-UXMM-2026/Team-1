import type { ReactNode } from "react";
import { signOut } from "@/components/delivery/common";
import type { GpsState } from "@/components/delivery/rider-active";
import {
  type ExceptionDraft,
  ExceptionPanel,
} from "@/components/delivery/rider-handover";
import {
  CautionsPanel,
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
          onOpen={onOpenPanel}
          onRequestFuel={onRequestFuel}
          onPause={onPauseRoute}
          onResume={onResumeRoute}
          onSignOut={() => void signOut()}
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
