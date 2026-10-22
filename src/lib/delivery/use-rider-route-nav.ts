import { useMemo } from "react";
import type { NavCaution, NavStop } from "@/components/delivery/rider-nav-map";
import type { RouteMetrics } from "@/components/delivery/rider-overview";
import {
  type DeliveryStop,
  type DriverRoute,
  finishEstimate,
} from "@/lib/delivery/driver-route";
import type { FuelStation } from "@/lib/delivery/energy-routing";
import { formatDriveMinutes } from "@/lib/delivery/mapbox";
import { ARRIVAL_RADIUS_KM } from "@/lib/delivery/rider-helpers";
import {
  bearingDegrees,
  cautionsAlong,
  distanceKm,
  energyForRoute,
  formatDistance,
  type GeoPoint,
  type RoadCaution,
} from "@/lib/delivery/rider-route";
import { useRoadSpeedCells } from "@/lib/delivery/road-intel/use-road-intel";
import type { VehicleOption, WorkspaceData } from "@/lib/delivery/types";
import { useRoadRoute } from "@/lib/delivery/use-road-route";

export function useRiderRouteNav({
  riderPoint,
  stop,
  route,
  vehicle,
  data,
  activePitStop,
  canUseLiveData,
  isPreview,
  now,
}: {
  riderPoint: GeoPoint | null;
  stop: DeliveryStop | null;
  route: DriverRoute;
  vehicle: VehicleOption | null;
  data: WorkspaceData;
  activePitStop: (FuelStation & { distanceKm: number }) | null;
  canUseLiveData: boolean;
  isPreview: boolean;
  now: number;
}) {
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
      [stop, ...route.upcoming]
        .flatMap((item) => (item?.point ? [item.point] : []))
        .slice(0, 24),
    [stop, route.upcoming],
  );

  const speedCells = useRoadSpeedCells(canUseLiveData && !isPreview);
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

  const legCautions: RoadCaution[] = useMemo(
    () => cautionsAlong(legPath, data.roadReports, now),
    [legPath, data.roadReports, now],
  );

  const routeCautions: RoadCaution[] = useMemo(
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

  const navCautions: NavCaution[] = routeCautions.map(({ report }) => ({
    id: String(report.id),
    point: { latitude: report.latitude, longitude: report.longitude },
    severity: report.severity as NavCaution["severity"],
  }));

  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Yangon",
  }).format(now);

  return {
    currentTargetPoint,
    openPoints,
    legRoute,
    routeRoad,
    upcomingRoad,
    straightKm,
    legDistance,
    legBearing,
    atTarget,
    legPath,
    legCautions,
    routeCautions,
    routeEnergy,
    metrics,
    navStops,
    navCautions,
    dayLabel,
  };
}
