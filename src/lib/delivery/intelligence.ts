import { countTrafficSignalsBetween } from "./energy-routing.ts";
import type {
  AssignmentRecommendation,
  DeliveryLocation,
  DeliveryOrder,
  DriverOption,
  VehicleOption,
} from "./types.ts";

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
  /** How many suggestions to return; managers can ask for every candidate. */
  limit = 3,
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

      // Traffic signal bottlenecks and corridor alignment between driver and pickup
      const signalCount =
        pickup && driverLocation
          ? countTrafficSignalsBetween(driverLocation, pickup).count
          : 0;

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
      if (vehicles.length > 0 && rankedVehicles.length === 0) return [];

      const chosenVehicle = rankedVehicles[0] ?? null;
      const availabilityScore = driver.availability === "available" ? 28 : 12;

      // Corridor-adjusted distance with signal bottleneck penalty
      const roadDistanceKm = distance != null ? distance * 1.22 : null;
      const signalPenalty = Math.min(5, signalCount * 1.2);
      const proximityScore =
        roadDistanceKm == null
          ? 8
          : Math.max(0, 30 - roadDistanceKm * 3.3 - signalPenalty);

      const workloadScore = Math.max(0, 24 - activeOrders.length * 10);

      // On-the-way detour bonus for busy riders when pickup aligns with active drops
      let detourBonus = 0;
      let onTheWay = false;
      if (driverLocation && pickup && activeOrders.length > 0) {
        const nextOrder = activeOrders[0];
        if (
          nextOrder.delivery_latitude != null &&
          nextOrder.delivery_longitude != null
        ) {
          const dest = {
            latitude: nextOrder.delivery_latitude,
            longitude: nextOrder.delivery_longitude,
          };
          const direct = haversineKilometers(driverLocation, dest);
          const viaPickup =
            haversineKilometers(driverLocation, pickup) +
            haversineKilometers(pickup, dest);
          const detourKm = viaPickup - direct;
          if (detourKm < 1.5) {
            detourBonus = 4;
            onTheWay = true;
          }
        }
      }

      const score = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            availabilityScore +
              proximityScore +
              workloadScore +
              detourBonus +
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

      if (onTheWay) {
        reasons.push("On-the-way for current delivery route");
      }
      if (signalCount > 0) {
        reasons.push(
          `${signalCount} traffic ${signalCount === 1 ? "signal" : "signals"} on corridor`,
        );
      }

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
    .slice(0, limit);
}
