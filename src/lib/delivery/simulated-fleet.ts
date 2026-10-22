"use client";

import { useEffect, useMemo, useState } from "react";

import type { DeliveryOrder } from "@/lib/delivery/types";

/**
 * Fake cars driving around Yangon, kept in memory only: nothing is written to
 * Supabase. Each car loops a fixed road-like path at a steady speed, so its
 * position is a pure function of time and needs no stored state.
 */

type LatLng = [latitude: number, longitude: number];

type SimCar = {
  id: string;
  plate: string;
  type: string;
  driver: string;
  /** Closed loop of waypoints the car drives forever. */
  path: LatLng[];
  speedKmh: number;
  /** Fraction of the loop to start from, so cars are spread out. */
  offset: number;
  destination: { address: string; point: LatLng };
};

const SIM_CARS: SimCar[] = [
  {
    id: "sim-car-1",
    plate: "YGN 2A-4471",
    type: "Car",
    driver: "Min Thu",
    speedKmh: 28,
    offset: 0,
    path: [
      [16.8409, 96.1287],
      [16.8318, 96.1298],
      [16.8235, 96.1331],
      [16.8153, 96.1366],
      [16.8094, 96.1417],
      [16.8032, 96.1478],
      [16.8094, 96.1417],
      [16.8153, 96.1366],
      [16.8235, 96.1331],
      [16.8318, 96.1298],
    ],
    destination: { address: "Pyay Road, Kamayut", point: [16.8032, 96.1478] },
  },
  {
    id: "sim-car-2",
    plate: "YGN 5C-9023",
    type: "Car",
    driver: "Kyaw Zin",
    speedKmh: 24,
    offset: 0.35,
    path: [
      [16.8176, 96.1737],
      [16.8148, 96.1659],
      [16.8123, 96.158],
      [16.8068, 96.1522],
      [16.7986, 96.149],
      [16.7921, 96.1553],
      [16.7968, 96.1632],
      [16.804, 96.1704],
    ],
    destination: { address: "Mingalar Taung Nyunt", point: [16.7986, 96.149] },
  },
  {
    id: "sim-car-3",
    plate: "YGN 7B-3318",
    type: "Van",
    driver: "Hla Myo",
    speedKmh: 22,
    offset: 0.6,
    path: [
      [16.7791, 96.1561],
      [16.7826, 96.1473],
      [16.7869, 96.1389],
      [16.7921, 96.1325],
      [16.7976, 96.1268],
      [16.793, 96.1214],
      [16.7868, 96.1281],
      [16.7819, 96.1388],
      [16.7775, 96.148],
    ],
    destination: { address: "Downtown Strand", point: [16.7976, 96.1268] },
  },
  {
    id: "sim-car-4",
    plate: "YGN 1K-6602",
    type: "Car",
    driver: "Thiha Aung",
    speedKmh: 32,
    offset: 0.2,
    path: [
      [16.8738, 96.1262],
      [16.8641, 96.1301],
      [16.8559, 96.1352],
      [16.8472, 96.1404],
      [16.8398, 96.1471],
      [16.8472, 96.1404],
      [16.8559, 96.1352],
      [16.8641, 96.1301],
    ],
    destination: { address: "Mayangone, Pyay Road", point: [16.8398, 96.1471] },
  },
  {
    id: "sim-car-5",
    plate: "YGN 3H-1457",
    type: "Motorbike",
    driver: "Su Hlaing",
    speedKmh: 30,
    offset: 0.8,
    path: [
      [16.8281, 96.1595],
      [16.8206, 96.1631],
      [16.8142, 96.1692],
      [16.8101, 96.1771],
      [16.8043, 96.182],
      [16.798, 96.1768],
      [16.8036, 96.1689],
      [16.8105, 96.1618],
      [16.8189, 96.1573],
    ],
    destination: { address: "Yankin Township", point: [16.8043, 96.182] },
  },
  {
    id: "sim-car-6",
    plate: "YGN 9E-8815",
    type: "Car",
    driver: "Zaw Htet",
    speedKmh: 26,
    offset: 0.5,
    path: [
      [16.8052, 96.1362],
      [16.8012, 96.1438],
      [16.7961, 96.1503],
      [16.7893, 96.153],
      [16.7842, 96.1462],
      [16.7881, 96.1387],
      [16.7948, 96.1349],
    ],
    destination: { address: "Sanchaung, Yangon", point: [16.7893, 96.153] },
  },
  {
    id: "sim-car-7",
    plate: "YGN 8T-2040",
    type: "Truck",
    driver: "Aung Kyaw",
    speedKmh: 20,
    offset: 0.1,
    path: [
      [16.8566, 96.1893],
      [16.8479, 96.1812],
      [16.8394, 96.1749],
      [16.8302, 96.1702],
      [16.8219, 96.1768],
      [16.8307, 96.1841],
      [16.8409, 96.1904],
      [16.8498, 96.1951],
    ],
    destination: {
      address: "Thingangyun Industrial Zone",
      point: [16.8302, 96.1702],
    },
  },
];

const EARTH_KM = 6371;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

function legKm(a: LatLng, b: LatLng) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Position `km` along the closed loop (the last waypoint joins back to the first). */
function pointAlong(path: LatLng[], km: number): LatLng {
  const legs = path.map((from, index) => {
    const to = path[(index + 1) % path.length];
    return { from, to, length: legKm(from, to) };
  });
  const total = legs.reduce((sum, leg) => sum + leg.length, 0);
  let remaining = ((km % total) + total) % total;
  for (const leg of legs) {
    if (remaining <= leg.length) {
      const t = leg.length ? remaining / leg.length : 0;
      return [
        leg.from[0] + (leg.to[0] - leg.from[0]) * t,
        leg.from[1] + (leg.to[1] - leg.from[1]) * t,
      ];
    }
    remaining -= leg.length;
  }
  return path[0];
}

function loopKm(path: LatLng[]) {
  return path.reduce(
    (sum, from, index) => sum + legKm(from, path[(index + 1) % path.length]),
    0,
  );
}

/**
 * Simulated cars as moving orders, so every map that draws `movingOrders` shows
 * them. Turned off, it returns nothing and runs no timer.
 */
export function useSimulatedFleet(enabled: boolean, tickMs = 2000) {
  const [now, setNow] = useState(() => Date.now());
  const loops = useMemo(
    () => new Map(SIM_CARS.map((car) => [car.id, loopKm(car.path)])),
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(timer);
  }, [enabled, tickMs]);

  return useMemo<DeliveryOrder[]>(() => {
    if (!enabled) return [];
    const recorded = new Date(now).toISOString();
    return SIM_CARS.map((car, index) => {
      const lap = loops.get(car.id) ?? 1;
      const km = (now / 3_600_000) * car.speedKmh + car.offset * lap;
      const [latitude, longitude] = pointAlong(car.path, km);
      const [destLat, destLng] = car.destination.point;
      const remainingKm = legKm([latitude, longitude], car.destination.point);
      return {
        id: car.id,
        tracking_code: `SIM-C${String(index + 1).padStart(2, "0")}`,
        customer_id: null,
        customer_name: "Simulated delivery",
        status: "in_transit",
        pickup_address: "Simulated depot",
        delivery_address: car.destination.address,
        pickup_latitude: null,
        pickup_longitude: null,
        delivery_latitude: destLat,
        delivery_longitude: destLng,
        recipient_name: null,
        recipient_phone: null,
        parcel_description: null,
        parcel_weight_kg: null,
        cod_amount: 0,
        cod_status: "not_required",
        estimated_delivery_at: new Date(
          now + (remainingKm / car.speedKmh) * 3_600_000,
        ).toISOString(),
        route_progress_percent: null,
        traffic_delay_minutes: 0,
        eta_confidence: null,
        eta_updated_at: null,
        created_at: recorded,
        driver_id: `${car.id}-driver`,
        driver_name: car.driver,
        driver_phone: null,
        vehicle_id: `${car.id}-vehicle`,
        vehicle_label: `${car.plate} · ${car.type}`,
        latest_location: {
          latitude,
          longitude,
          accuracy_meters: 8,
          recorded_at: recorded,
        },
      };
    });
  }, [enabled, now, loops]);
}
