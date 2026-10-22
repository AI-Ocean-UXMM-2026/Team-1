import type { ReactNode } from "react";
import type { GpsState } from "@/components/delivery/rider-active";
import {
  type NavCaution,
  type NavStop,
  RiderNavMap,
} from "@/components/delivery/rider-nav-map";
import {
  type RouteMetrics,
  RouteOverview,
} from "@/components/delivery/rider-overview";
import { Notice } from "@/components/delivery/rider-tools";
import type { DriverRoute } from "@/lib/delivery/driver-route";
import type { RoadRoute } from "@/lib/delivery/mapbox";
import type { GeoPoint } from "@/lib/delivery/rider-route";
import type { VehicleOption } from "@/lib/delivery/types";

export function RiderOverviewScreen({
  route,
  shiftRoute,
  vehicle,
  dayLabel,
  metrics,
  navStops,
  navCautions,
  riderPoint,
  routeRoad,
  isPreview,
  online,
  gpsState,
  flash,
  revisionNotice,
  busy,
  errorBanner,
  sessionSaved,
  closedAt,
  declaredCod,
  onFindJob,
  onMenu,
  onAcknowledge,
  onStart,
  onStartWithLoad,
  onResume,
  onCloseRoute,
  onOpenLocationHelp,
  sheets,
  previewBar,
}: {
  route: DriverRoute;
  shiftRoute: DriverRoute;
  vehicle: VehicleOption | null;
  dayLabel: string;
  metrics: RouteMetrics;
  navStops: NavStop[];
  navCautions: NavCaution[];
  riderPoint: GeoPoint | null;
  routeRoad: RoadRoute | null;
  isPreview: boolean;
  online: boolean;
  gpsState: GpsState;
  flash: string | null;
  revisionNotice: ReactNode;
  busy: string | null;
  errorBanner: ReactNode;
  sessionSaved: boolean;
  closedAt: string | null;
  declaredCod: number | null;
  onFindJob: () => void;
  onMenu: () => void;
  onAcknowledge: () => void;
  onStart: () => void;
  onStartWithLoad: (loadIds: string[], missingIds: string[]) => void;
  onResume: () => void;
  onCloseRoute: (declared: number) => void;
  onOpenLocationHelp: () => void;
  sheets: ReactNode;
  previewBar: ReactNode;
}) {
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
                      onClick={onOpenLocationHelp}
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
        onFindJob={onFindJob}
        online={online}
        busy={busy}
        error={errorBanner}
        sessionSaved={sessionSaved}
        closedAt={closedAt}
        declaredCod={declaredCod}
        onMenu={onMenu}
        onAcknowledge={onAcknowledge}
        onStart={onStart}
        onStartWithLoad={onStartWithLoad}
        onResume={onResume}
        onCloseRoute={onCloseRoute}
      />
      {sheets}
      {previewBar}
    </>
  );
}
