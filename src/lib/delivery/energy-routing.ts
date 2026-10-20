import type { DeliveryOrder, VehicleOption } from "@/lib/delivery/types";

type EnergyRouteOrder = Pick<
  DeliveryOrder,
  | "pickup_latitude"
  | "pickup_longitude"
  | "delivery_latitude"
  | "delivery_longitude"
  | "latest_location"
>;

export type EnergyRouteAssessment = {
  distanceKm: number | null;
  availableRangeKm: number | null;
  energyLevelPercent: number | null;
  requiredPercent: number | null;
  status: "unknown" | "sufficient" | "low" | "insufficient";
  message: string;
};

const ROAD_DISTANCE_FACTOR = 1.18;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const firstLatitude = radians(from.latitude);
  const secondLatitude = radians(to.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function assessEnergyRoute(
  order: EnergyRouteOrder,
  vehicle: VehicleOption | null,
): EnergyRouteAssessment {
  if (!vehicle) {
    return {
      distanceKm: null,
      availableRangeKm: null,
      energyLevelPercent: null,
      requiredPercent: null,
      status: "unknown",
      message: "Assign a vehicle to check route readiness.",
    };
  }

  const energyLevel =
    vehicle.energy_source === "electric"
      ? vehicle.battery_level_percent
      : vehicle.energy_source === "fuel"
        ? vehicle.fuel_level_percent
        : vehicle.fuel_level_percent == null &&
            vehicle.battery_level_percent == null
          ? null
          : Math.max(
              vehicle.fuel_level_percent ?? 0,
              vehicle.battery_level_percent ?? 0,
            );

  const hasCoordinates =
    order.pickup_latitude != null &&
    order.pickup_longitude != null &&
    order.delivery_latitude != null &&
    order.delivery_longitude != null;

  if (energyLevel == null || !vehicle.range_km_at_full || !hasCoordinates) {
    return {
      distanceKm: null,
      availableRangeKm: null,
      energyLevelPercent: energyLevel,
      requiredPercent: null,
      status: "unknown",
      message:
        "Add route pins, current energy level, and full-range distance to check readiness.",
    };
  }

  const pickup = {
    latitude: order.pickup_latitude as number,
    longitude: order.pickup_longitude as number,
  };
  const delivery = {
    latitude: order.delivery_latitude as number,
    longitude: order.delivery_longitude as number,
  };
  const approachDistance = order.latest_location
    ? distanceKm(
        {
          latitude: order.latest_location.latitude,
          longitude: order.latest_location.longitude,
        },
        pickup,
      )
    : 0;
  const estimatedDistance =
    (approachDistance + distanceKm(pickup, delivery)) * ROAD_DISTANCE_FACTOR;
  const usablePercent = Math.max(0, energyLevel - vehicle.reserve_percent);
  const availableRange = vehicle.range_km_at_full * (usablePercent / 100);
  const requiredPercent = (estimatedDistance / vehicle.range_km_at_full) * 100;
  const remainingAfterRoute = availableRange - estimatedDistance;
  const status =
    remainingAfterRoute < 0
      ? "insufficient"
      : remainingAfterRoute < Math.max(5, vehicle.range_km_at_full * 0.08)
        ? "low"
        : "sufficient";
  const energyLabel = vehicle.energy_source === "electric" ? "battery" : "fuel";
  const message =
    status === "insufficient"
      ? `Add ${energyLabel} before starting this route.`
      : status === "low"
        ? `Route is possible, but plan a ${energyLabel} stop.`
        : `Route fits the configured ${energyLabel} reserve.`;

  return {
    distanceKm: Math.round(estimatedDistance * 10) / 10,
    availableRangeKm: Math.round(availableRange * 10) / 10,
    energyLevelPercent: energyLevel,
    requiredPercent: Math.round(requiredPercent * 10) / 10,
    status,
    message,
  };
}
