import type {
  AssignmentRecommendation,
  DeliveryLocation,
  DeliveryOrder,
  DriverOption,
  VehicleOption,
} from "@/lib/delivery/types";

const ACTIVE_STATUSES = new Set([
  "assigned",
  "accepted",
  "picked_up",
  "in_transit",
]);

export function haversineKilometers(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function latestDriverLocation(driverId: string, orders: DeliveryOrder[]) {
  return orders.reduce<DeliveryLocation | null>((latest, order) => {
    if (order.driver_id !== driverId || !order.latest_location) return latest;
    if (!latest || order.latest_location.recorded_at > latest.recorded_at)
      return order.latest_location;
    return latest;
  }, null);
}

function vehicleScore(
  vehicle: VehicleOption,
  parcelWeight: number,
  isCurrent: boolean,
) {
  const capacity = vehicle.capacity_kg;
  if (capacity != null && capacity < parcelWeight)
    return Number.NEGATIVE_INFINITY;
  let score = isCurrent ? 12 : vehicle.status === "available" ? 8 : 0;
  if (capacity != null) {
    const unusedCapacity = Math.max(0, capacity - parcelWeight);
    score += Math.max(0, 10 - Math.min(10, unusedCapacity / 5));
  }
  if (
    parcelWeight <= 5 &&
    ["motorcycle", "e_bike"].includes(vehicle.vehicle_type)
  )
    score += 6;
  if (parcelWeight > 20 && ["car", "truck"].includes(vehicle.vehicle_type))
    score += 8;
  return score;
}

export function recommendAssignments(
  order: DeliveryOrder | null,
  drivers: DriverOption[],
  vehicles: VehicleOption[],
  orders: DeliveryOrder[],
): AssignmentRecommendation[] {
  if (!order) return [];
  const pickup =
    order.pickup_latitude != null && order.pickup_longitude != null
      ? { latitude: order.pickup_latitude, longitude: order.pickup_longitude }
      : null;
  const parcelWeight = order.parcel_weight_kg ?? 0;

  return drivers
    .filter((driver) => driver.availability !== "off_duty")
    .flatMap((driver) => {
      const activeOrders = orders.filter(
        (candidate) =>
          candidate.id !== order.id &&
          candidate.driver_id === driver.id &&
          ACTIVE_STATUSES.has(candidate.status),
      );
      const activeVehicleIds = new Set(
        activeOrders.map((candidate) => candidate.vehicle_id).filter(Boolean),
      );
      const driverLocation = latestDriverLocation(driver.id, orders);
      const distance =
        pickup && driverLocation
          ? haversineKilometers(driverLocation, pickup)
          : null;
      const availableVehicles = vehicles.filter((vehicle) => {
        if (vehicle.status === "available") return true;
        return vehicle.status === "in_use" && activeVehicleIds.has(vehicle.id);
      });
      const rankedVehicles = availableVehicles
        .map((vehicle) => ({
          vehicle,
          score: vehicleScore(
            vehicle,
            parcelWeight,
            activeVehicleIds.has(vehicle.id),
          ),
        }))
        .filter((candidate) => Number.isFinite(candidate.score))
        .sort((a, b) => b.score - a.score);

      const chosenVehicle = rankedVehicles[0] ?? null;
      const availabilityScore = driver.availability === "available" ? 28 : 12;
      const proximityScore =
        distance == null ? 8 : Math.max(0, 30 - distance * 4);
      const workloadScore = Math.max(0, 24 - activeOrders.length * 10);
      const score = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            availabilityScore +
              proximityScore +
              workloadScore +
              (chosenVehicle?.score ?? 4),
          ),
        ),
      );
      const reasons = [
        driver.availability === "available"
          ? "Available now"
          : "Can join current route",
        activeOrders.length === 0
          ? "No active deliveries"
          : `${activeOrders.length} active ${activeOrders.length === 1 ? "delivery" : "deliveries"}`,
        distance == null
          ? "Pickup distance unavailable"
          : `${distance.toFixed(1)} km from pickup`,
        chosenVehicle
          ? `${chosenVehicle.vehicle.registration_number} fits ${parcelWeight || "unknown"} kg parcel`
          : "No vehicle required",
      ];
      return [
        {
          driverId: driver.id,
          vehicleId: chosenVehicle?.vehicle.id ?? null,
          score,
          distanceToPickupKm: distance,
          activeDeliveries: activeOrders.length,
          reasons,
        },
      ];
    })
    .sort(
      (a, b) => b.score - a.score || a.activeDeliveries - b.activeDeliveries,
    )
    .slice(0, 3);
}
