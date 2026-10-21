import type { DeliveryOrder, VehicleOption } from "@/lib/delivery/types";
import {
  YANGON_USER_INTERCEPTION_POINTS,
  type InterceptionPoint,
} from "./data/yangon-interception-points.ts";

export { YANGON_USER_INTERCEPTION_POINTS, type InterceptionPoint };

export type EnergyRouteOrder = Pick<
  DeliveryOrder,
  | "pickup_latitude"
  | "pickup_longitude"
  | "delivery_latitude"
  | "delivery_longitude"
  | "latest_location"
> & {
  parcel_weight_kg?: number | null;
};

export type RecommendedFuelStation = {
  name: string;
  brand: "Denko" | "Max Energy" | "PT Power" | "BOC" | "Apex";
  township: string;
  road: string;
  latitude: number;
  longitude: number;
  detourKm: number;
};

export type SignalBypassOpportunity = {
  signalName: string;
  township: string;
  estimatedRedDelayMin: number;
  bypassDetourKm: number;
  netTimeSavedMin: number;
  fuelSavedLitres: number;
  recommendedRotation: string;
};

export type EnergyRouteAssessment = {
  distanceKm: number | null;
  availableRangeKm: number | null;
  energyLevelPercent: number | null;
  requiredPercent: number | null;
  status: "unknown" | "sufficient" | "low" | "insufficient";
  message: string;
  fuelLitresEstimated?: number | null;
  payloadWeightKg?: number | null;
  signalsOnRoute?: number;
  interceptionsOnRoute?: number;
  idlingPenaltyLitres?: number;
  recommendedFuelStation?: RecommendedFuelStation | null;
  signalBypasses?: SignalBypassOpportunity[];
};

export type FuelStation = {
  name: string;
  brand: "Denko" | "Max Energy" | "PT Power" | "BOC" | "Apex";
  township: string;
  road: string;
  latitude: number;
  longitude: number;
};

export type TrafficSignal = {
  name: string;
  township: string;
  latitude: number;
  longitude: number;
  estimatedCycleSeconds: number;
};

/**
 * Curated dataset of major retail fuel stations across Yangon's key
 * transport corridors (Kamayut, Mayangone, Hlaing, Downtown, Bahan, Thaketa,
 * Thingangyun, North Dagon, and Hlaingtharyar).
 */
export const YANGON_FUEL_STATIONS: readonly FuelStation[] = [
  // Kamayut / Pyay Road Corridor
  {
    name: "Max Energy Hanthawaddy",
    brand: "Max Energy",
    township: "Kamayut",
    road: "Pyay Road & Hanthawaddy Rd",
    latitude: 16.816,
    longitude: 96.132,
  },
  {
    name: "BOC Kamayut",
    brand: "BOC",
    township: "Kamayut",
    road: "Pyay Road near University Ave",
    latitude: 16.832,
    longitude: 96.1305,
  },
  // Mayangone / 8 Mile / Airport Corridor
  {
    name: "Max Energy 8 Mile",
    brand: "Max Energy",
    township: "Mayangone",
    road: "Pyay Road & Kabar Aye Pagoda Rd",
    latitude: 16.873,
    longitude: 96.136,
  },
  {
    name: "PT Power Bayintnaung",
    brand: "PT Power",
    township: "Mayangone",
    road: "Bayintnaung Road",
    latitude: 16.861,
    longitude: 96.107,
  },
  {
    name: "Denko Insein No. 3",
    brand: "Denko",
    township: "Insein",
    road: "No. 3 Main Road",
    latitude: 16.892,
    longitude: 96.115,
  },
  // Hlaing & Parami
  {
    name: "PT Power Parami",
    brand: "PT Power",
    township: "Hlaing",
    road: "Parami Road",
    latitude: 16.848,
    longitude: 96.128,
  },
  // Downtown & Botataung / Strand Corridor
  {
    name: "Denko Botataung Strand",
    brand: "Denko",
    township: "Botataung",
    road: "Strand Road",
    latitude: 16.771,
    longitude: 96.171,
  },
  {
    name: "BOC Ahlone",
    brand: "BOC",
    township: "Ahlone",
    road: "Lower Kyimyindaing Road",
    latitude: 16.785,
    longitude: 96.123,
  },
  // Bahan & Shwegondaing
  {
    name: "Max Energy Shwegondaing",
    brand: "Max Energy",
    township: "Bahan",
    road: "Kabar Aye Pagoda Road",
    latitude: 16.809,
    longitude: 96.156,
  },
  // East Yangon / Thaketa / Dawbon
  {
    name: "Max Energy Thaketa",
    brand: "Max Energy",
    township: "Thaketa",
    road: "Min Nandar Road",
    latitude: 16.791,
    longitude: 96.196,
  },
  {
    name: "PT Power Shu Khin Thar",
    brand: "PT Power",
    township: "Thaketa",
    road: "Shu Khin Thar Hospital Road",
    latitude: 16.786,
    longitude: 96.194,
  },
  // South & North Okkalapa / Thingangyun
  {
    name: "Denko South Okkalapa",
    brand: "Denko",
    township: "South Okkalapa",
    road: "Thanthumar Road",
    latitude: 16.837,
    longitude: 96.189,
  },
  {
    name: "Denko Thingangyun",
    brand: "Denko",
    township: "Thingangyun",
    road: "Lay Daunt Kan Road",
    latitude: 16.829,
    longitude: 96.198,
  },
  // North Dagon / East Dagon Corridor
  {
    name: "BOC North Dagon",
    brand: "BOC",
    township: "North Dagon",
    road: "No. 2 Main Road",
    latitude: 16.855,
    longitude: 96.223,
  },
  {
    name: "Denko Pinlon North Dagon",
    brand: "Denko",
    township: "North Dagon",
    road: "Pinlon Road",
    latitude: 16.868,
    longitude: 96.215,
  },
  {
    name: "Max Energy Bo Ba Htoo",
    brand: "Max Energy",
    township: "North Dagon",
    road: "Bo Ba Htoo Road",
    latitude: 16.842,
    longitude: 96.228,
  },
  // Western Industrial / Hlaingtharyar
  {
    name: "Denko Hlaingtharyar",
    brand: "Denko",
    township: "Hlaingtharyar",
    road: "Tapinshwehtee Street",
    latitude: 16.862,
    longitude: 96.068,
  },
  {
    name: "Apex Hlaingtharyar",
    brand: "Apex",
    township: "Hlaingtharyar",
    road: "Yangon-Pathein Highway",
    latitude: 16.879,
    longitude: 96.054,
  },
];

/**
 * Major signalized intersections under the Yangon Traffic Control System (YTSC)
 * causing stop-and-go deceleration and idling fuel drain.
 */
export const YANGON_TRAFFIC_SIGNALS: readonly TrafficSignal[] = [
  {
    name: "Hledan Junction",
    township: "Kamayut",
    latitude: 16.8288,
    longitude: 96.129,
    estimatedCycleSeconds: 120,
  },
  {
    name: "Myaynigone Junction",
    township: "Sanchaung",
    latitude: 16.8055,
    longitude: 96.136,
    estimatedCycleSeconds: 110,
  },
  {
    name: "Hanthawaddy Roundabout Junction",
    township: "Kamayut",
    latitude: 16.8155,
    longitude: 96.1315,
    estimatedCycleSeconds: 90,
  },
  {
    name: "8 Mile Junction",
    township: "Mayangone",
    latitude: 16.871,
    longitude: 96.1375,
    estimatedCycleSeconds: 120,
  },
  {
    name: "Parami / Pyay Road Junction",
    township: "Hlaing",
    latitude: 16.848,
    longitude: 96.13,
    estimatedCycleSeconds: 100,
  },
  {
    name: "Thamine Junction",
    township: "Mayangone",
    latitude: 16.858,
    longitude: 96.121,
    estimatedCycleSeconds: 100,
  },
  {
    name: "Bayintnaung Junction",
    township: "Mayangone",
    latitude: 16.852,
    longitude: 96.108,
    estimatedCycleSeconds: 110,
  },
  {
    name: "Tamwe Ashey Junction",
    township: "Tamwe",
    latitude: 16.814,
    longitude: 96.173,
    estimatedCycleSeconds: 100,
  },
  {
    name: "Shwegondaing Junction",
    township: "Bahan",
    latitude: 16.808,
    longitude: 96.155,
    estimatedCycleSeconds: 95,
  },
  {
    name: "Kokkine Junction",
    township: "Bahan",
    latitude: 16.822,
    longitude: 96.155,
    estimatedCycleSeconds: 90,
  },
  {
    name: "Sule / Bogyoke Junction",
    township: "Kyauktada",
    latitude: 16.7788,
    longitude: 96.1585,
    estimatedCycleSeconds: 105,
  },
  {
    name: "Theingyizay / Strand Junction",
    township: "Latha",
    latitude: 16.772,
    longitude: 96.148,
    estimatedCycleSeconds: 90,
  },
  {
    name: "Dawbon Bridge Junction",
    township: "Dawbon",
    latitude: 16.784,
    longitude: 96.183,
    estimatedCycleSeconds: 95,
  },
  {
    name: "Kaba Aye / Parami Junction",
    township: "Mayangone",
    latitude: 16.851,
    longitude: 96.151,
    estimatedCycleSeconds: 100,
  },
];

const ROAD_DISTANCE_FACTOR = 1.18;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKm(
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

/** Perpendicular distance from point P to line segment AB in kilometers. */
export function distanceToSegmentKm(
  p: { latitude: number; longitude: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const abDist = distanceKm(a, b);
  if (abDist < 1e-6) return distanceKm(p, a);

  const cosLat = Math.cos(radians((a.latitude + b.latitude) / 2));
  const dx = (b.longitude - a.longitude) * cosLat;
  const dy = b.latitude - a.latitude;
  const px = (p.longitude - a.longitude) * cosLat;
  const py = p.latitude - a.latitude;

  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
  const proj = {
    latitude: a.latitude + t * dy,
    longitude: a.longitude + (t * dx) / (cosLat || 1),
  };
  return distanceKm(p, proj);
}

/**
 * Counts traffic signals located along the direct route corridor between two points.
 */
export function countTrafficSignalsBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  corridorThresholdKm = 0.5,
): { count: number; signals: TrafficSignal[] } {
  const matched: TrafficSignal[] = [];
  for (const signal of YANGON_TRAFFIC_SIGNALS) {
    const dist = distanceToSegmentKm(signal, from, to);
    if (dist <= corridorThresholdKm) {
      matched.push(signal);
    }
  }
  return { count: matched.length, signals: matched };
}

/**
 * Counts user-mapped interception points and corridor midpoints between two locations.
 */
export function countInterceptionPointsBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  corridorThresholdKm = 0.5,
): { count: number; points: readonly InterceptionPoint[] } {
  const matched = YANGON_USER_INTERCEPTION_POINTS.filter((pt) => {
    return distanceToSegmentKm(pt, from, to) <= corridorThresholdKm;
  });
  return { count: matched.length, points: matched };
}

/**
 * Finds the fuel station in Yangon that introduces the smallest marginal
 * detour between the route origin and destination.
 */
export function findOptimalFuelStation(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): RecommendedFuelStation | null {
  if (!YANGON_FUEL_STATIONS.length) return null;

  const directKm = distanceKm(origin, destination);
  let bestStation = YANGON_FUEL_STATIONS[0];
  let minDetour = Number.POSITIVE_INFINITY;

  for (const station of YANGON_FUEL_STATIONS) {
    const stationPoint = {
      latitude: station.latitude,
      longitude: station.longitude,
    };
    const leg1 = distanceKm(origin, stationPoint);
    const leg2 = distanceKm(stationPoint, destination);
    const detour = leg1 + leg2 - directKm;
    if (detour < minDetour) {
      minDetour = detour;
      bestStation = station;
    }
  }

  return {
    name: bestStation.name,
    brand: bestStation.brand,
    township: bestStation.township,
    road: bestStation.road,
    latitude: bestStation.latitude,
    longitude: bestStation.longitude,
    detourKm: Math.round(Math.max(0, minDetour) * 10) / 10,
  };
}

/**
 * Evaluates whether taking a minor side-street rotation around a congested
 * signalized junction (cycle >= 85s) saves time and fuel compared to waiting
 * in the red-light queue.
 */
export function detectSignalBypasses(
  signals: TrafficSignal[],
): SignalBypassOpportunity[] {
  return signals
    .filter((sig) => sig.estimatedCycleSeconds >= 85)
    .map((sig) => {
      const redDelayMin =
        Math.round(((sig.estimatedCycleSeconds * 0.55) / 60) * 10) / 10;
      const bypassDetourKm = 0.35;
      const bypassDriveTimeMin =
        Math.round(((bypassDetourKm / 25) * 60) * 10) / 10;
      const netTimeSavedMin = Math.max(
        0.2,
        Math.round((redDelayMin - bypassDriveTimeMin) * 10) / 10,
      );
      const fuelSavedLitres = 0.03;
      return {
        signalName: sig.name,
        township: sig.township,
        estimatedRedDelayMin: redDelayMin,
        bypassDetourKm,
        netTimeSavedMin,
        fuelSavedLitres,
        recommendedRotation: `Side-street rotation around ${sig.name} (${sig.township}) saves ~${netTimeSavedMin} min`,
      };
    });
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
  const currentPos = order.latest_location
    ? {
        latitude: order.latest_location.latitude,
        longitude: order.latest_location.longitude,
      }
    : null;
  const approachDistance = currentPos ? distanceKm(currentPos, pickup) : 0;
  const coreDistance = distanceKm(pickup, delivery);
  const estimatedDistance =
    (approachDistance + coreDistance) * ROAD_DISTANCE_FACTOR;

  // Signal detection along approach and delivery corridors
  const coreSignals = countTrafficSignalsBetween(pickup, delivery);
  const approachSignals = currentPos
    ? countTrafficSignalsBetween(currentPos, pickup)
    : { count: 0, signals: [] };
  const allMatchedSignals = [...coreSignals.signals, ...approachSignals.signals];
  const totalSignals = allMatchedSignals.length;
  const signalBypasses = detectSignalBypasses(allMatchedSignals);

  // User-plotted interception midpoints along corridors
  const coreInterceptions = countInterceptionPointsBetween(pickup, delivery);
  const approachInterceptions = currentPos
    ? countInterceptionPointsBetween(currentPos, pickup)
    : { count: 0, points: [] };
  const totalInterceptions =
    coreInterceptions.count + approachInterceptions.count;

  // Cargo payload weight and idling fuel calculation
  const payloadWeight = order.parcel_weight_kg ?? 0;
  // Weight factor: +3% fuel per 100 kg
  const weightFactor = 1 + Math.max(0, payloadWeight / 100) * 0.03;
  // Stop-and-go penalty: ~0.035 litres per major signal, ~0.012 litres per intermediate interception
  const idlingPenaltyLitres =
    Math.round(
      (totalSignals * 0.035 + totalInterceptions * 0.012) * 100,
    ) / 100;
  // Signal & interception idling range penalty: ~0.35 km per major signal, ~0.12 km per interception
  const signalRangeDrainKm =
    totalSignals * 0.35 + totalInterceptions * 0.12;

  // Fuel consumption rate by vehicle type
  const baseRateLPerKm =
    vehicle.vehicle_type === "motorcycle" || vehicle.vehicle_type === "e_bike"
      ? 0.03
      : vehicle.vehicle_type === "truck"
        ? 0.1
        : 0.075;
  const fuelLitresEstimated =
    Math.round(
      (estimatedDistance * baseRateLPerKm * weightFactor +
        idlingPenaltyLitres) *
        10,
    ) / 10;

  const usablePercent = Math.max(0, energyLevel - vehicle.reserve_percent);
  const availableRange = vehicle.range_km_at_full * (usablePercent / 100);
  const effectiveDistance = estimatedDistance + signalRangeDrainKm;
  const requiredPercent = (effectiveDistance / vehicle.range_km_at_full) * 100;
  const remainingAfterRoute = availableRange - effectiveDistance;

  const status =
    remainingAfterRoute < 0
      ? "insufficient"
      : remainingAfterRoute < Math.max(5, vehicle.range_km_at_full * 0.08)
        ? "low"
        : "sufficient";

  const recommendedStation =
    status === "insufficient" || status === "low"
      ? findOptimalFuelStation(currentPos ?? pickup, delivery)
      : null;

  const energyLabel = vehicle.energy_source === "electric" ? "battery" : "fuel";
  let message =
    status === "insufficient"
      ? `Add ${energyLabel} before starting this route.`
      : status === "low"
        ? `Route is possible, but plan a ${energyLabel} stop.`
        : `Route fits the configured ${energyLabel} reserve.`;

  if (recommendedStation && (status === "insufficient" || status === "low")) {
    const actionWord = status === "insufficient" ? "Nearest" : "Recommended";
    message += ` ${actionWord} fuel station: ${recommendedStation.name} (+${recommendedStation.detourKm} km detour).`;
  }

  return {
    distanceKm: Math.round(estimatedDistance * 10) / 10,
    availableRangeKm: Math.round(availableRange * 10) / 10,
    energyLevelPercent: energyLevel,
    requiredPercent: Math.round(requiredPercent * 10) / 10,
    status,
    message,
    fuelLitresEstimated,
    payloadWeightKg: payloadWeight,
    signalsOnRoute: totalSignals,
    interceptionsOnRoute: totalInterceptions,
    idlingPenaltyLitres,
    recommendedFuelStation: recommendedStation,
    signalBypasses,
  };
}
