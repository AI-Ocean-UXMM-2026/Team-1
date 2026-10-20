"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import {
  canShowParcelLocation,
  hasCollectedParcel,
  parcelLocationState,
} from "@/lib/delivery/location-state";
import type { DeliveryOrder } from "@/lib/delivery/types";

type Point = { latitude: number; longitude: number };
type Tile = { x: number; y: number; src: string; left: number; top: number };

const ZOOM = 15;
const TILE_SIZE = 256;

function toWorldPixel({ latitude, longitude }: Point, zoom = ZOOM) {
  const latitudeRadians =
    (Math.max(Math.min(latitude, 85.0511), -85.0511) * Math.PI) / 180;
  const scale = TILE_SIZE * 2 ** zoom;
  return {
    x: ((longitude + 180) / 360) * scale,
    y: ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * scale,
  };
}

function pointAt(
  point: Point,
  center: Point,
  size: { width: number; height: number },
  zoom: number,
) {
  const world = toWorldPixel(point, zoom);
  const centerWorld = toWorldPixel(center, zoom);
  return {
    x: world.x - centerWorld.x + size.width / 2,
    y: world.y - centerWorld.y + size.height / 2,
  };
}

export function LocationMap({
  order,
  orders,
  mode = "customer",
  isDemo,
  tall = false,
}: {
  order: DeliveryOrder | null;
  orders?: DeliveryOrder[];
  mode?: "customer" | "rider" | "manager";
  isDemo: boolean;
  tall?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [now, setNow] = useState(0);

  useEffect(() => {
    const node = document.querySelector<HTMLElement>(`[data-map-id="${mode}"]`);
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const livePoint =
    order?.latest_location && canShowParcelLocation(order.status)
      ? {
          latitude: order.latest_location.latitude,
          longitude: order.latest_location.longitude,
        }
      : null;
  const pickupPoint =
    order?.pickup_latitude != null && order.pickup_longitude != null
      ? { latitude: order.pickup_latitude, longitude: order.pickup_longitude }
      : null;
  const destinationPoint =
    order?.delivery_latitude != null && order.delivery_longitude != null
      ? {
          latitude: order.delivery_latitude,
          longitude: order.delivery_longitude,
        }
      : null;
  const sourceOrders =
    mode === "manager" ? (orders ?? []) : order ? [order] : [];
  const candidateRows = sourceOrders.flatMap((item) => {
    const latestLocation = item.latest_location;
    if (!latestLocation || !canShowParcelLocation(item.status)) return [];
    return [
      {
        order: item,
        rider: {
          latitude: latestLocation.latitude,
          longitude: latestLocation.longitude,
        },
        destination:
          item.delivery_latitude != null && item.delivery_longitude != null
            ? {
                latitude: item.delivery_latitude,
                longitude: item.delivery_longitude,
              }
            : null,
      },
    ];
  });
  const markerRows =
    mode === "manager"
      ? Array.from(
          candidateRows
            .reduce((rows, row) => {
              const key = row.order.driver_id ?? row.order.id;
              const previous = rows.get(key);
              if (
                !previous ||
                row.order.id === order?.id ||
                (previous.order.id !== order?.id &&
                  (row.order.latest_location?.recorded_at ?? "") >
                    (previous.order.latest_location?.recorded_at ?? ""))
              )
                rows.set(key, row);
              return rows;
            }, new Map<string, (typeof candidateRows)[number]>())
            .values(),
        )
      : candidateRows;
  const trackedOrders = markerRows.map((row) => row.order);
  const liveRiderCount = trackedOrders.filter(
    (item) => parcelLocationState(item, now) === "live",
  ).length;
  const pointsForView = markerRows.length
    ? markerRows.flatMap((row) =>
        row.destination ? [row.rider, row.destination] : [row.rider],
      )
    : [pickupPoint, destinationPoint].filter(
        (point): point is Point => point !== null,
      );
  const averagePoint =
    pointsForView.length > 0
      ? {
          latitude:
            pointsForView.reduce((sum, point) => sum + point.latitude, 0) /
            pointsForView.length,
          longitude:
            pointsForView.reduce((sum, point) => sum + point.longitude, 0) /
            pointsForView.length,
        }
      : null;
  const livePointWeight = mode === "customer" ? 0.82 : 0.65;
  const center =
    mode === "manager" && averagePoint
      ? averagePoint
      : livePoint && destinationPoint
        ? {
            latitude:
              livePoint.latitude * livePointWeight +
              destinationPoint.latitude * (1 - livePointWeight),
            longitude:
              livePoint.longitude * livePointWeight +
              destinationPoint.longitude * (1 - livePointWeight),
          }
        : (livePoint ??
          pickupPoint ??
          destinationPoint ?? { latitude: 16.8007, longitude: 96.15 });
  const zoom = useMemo(() => {
    if (!size.width || !size.height || pointsForView.length < 2) return ZOOM;
    const projected = pointsForView.map((point) => toWorldPixel(point));
    const projectedCenter = toWorldPixel(center);
    const horizontalRange =
      2 *
      Math.max(
        ...projected.map((point) => Math.abs(point.x - projectedCenter.x)),
      );
    const verticalRange =
      2 *
      Math.max(
        ...projected.map((point) => Math.abs(point.y - projectedCenter.y)),
      );
    const horizontalFit = (size.width - 84) / Math.max(1, horizontalRange);
    const verticalFit = (size.height - 94) / Math.max(1, verticalRange);
    const fit = Math.min(1, horizontalFit, verticalFit);
    const zoomForFit = Math.max(1, Math.floor(ZOOM + Math.log2(fit)));
    return Math.min(mode === "customer" ? 14 : ZOOM, zoomForFit);
  }, [center, mode, pointsForView, size.height, size.width]);

  const tiles = useMemo(() => {
    if (!size.width || !size.height) return [] as Tile[];
    const world = toWorldPixel(center, zoom);
    const leftEdge = world.x - size.width / 2;
    const topEdge = world.y - size.height / 2;
    const minTileX = Math.floor(leftEdge / TILE_SIZE);
    const maxTileX = Math.floor((leftEdge + size.width) / TILE_SIZE);
    const minTileY = Math.floor(topEdge / TILE_SIZE);
    const maxTileY = Math.floor((topEdge + size.height) / TILE_SIZE);
    const limit = 2 ** zoom;
    const next: Tile[] = [];

    for (let x = minTileX; x <= maxTileX; x += 1) {
      for (let y = minTileY; y <= maxTileY; y += 1) {
        if (y < 0 || y >= limit) continue;
        next.push({
          x,
          y,
          src: `https://tile.openstreetmap.org/${zoom}/${((x % limit) + limit) % limit}/${y}.png`,
          left: Math.floor(x * TILE_SIZE - leftEdge),
          top: Math.floor(y * TILE_SIZE - topEdge),
        });
      }
    }
    return next;
  }, [center, size.height, size.width, zoom]);

  const riderPosition = livePoint
    ? pointAt(livePoint, center, size, zoom)
    : null;
  const destinationPosition = destinationPoint
    ? pointAt(destinationPoint, center, size, zoom)
    : null;
  const pickupPosition = pickupPoint
    ? pointAt(pickupPoint, center, size, zoom)
    : null;
  const latestTimestamp = trackedOrders.reduce<string | null>(
    (latest, item) => {
      const current = item.latest_location?.recorded_at;
      return current && (!latest || current > latest) ? current : latest;
    },
    livePoint ? (order?.latest_location?.recorded_at ?? null) : null,
  );
  const locationTime = latestTimestamp
    ? Math.max(
        0,
        Math.floor((now - new Date(latestTimestamp).getTime()) / 60_000),
      )
    : null;
  const locationText = isDemo
    ? "Sample location"
    : locationTime === null
      ? order && hasCollectedParcel(order.status)
        ? "Waiting for GPS"
        : "Available after pickup"
      : locationTime < 1
        ? "Just updated"
        : `Updated ${locationTime}m ago`;

  return (
    <section
      className={`map-card ${tall ? "map-card-tall" : ""}`}
      aria-label="Delivery location map"
    >
      <div className="map-toolbar">
        <div className="map-toolbar-copy">
          <span className="map-toolbar-eyebrow">
            {mode === "manager" ? "Dispatch map" : "Delivery map"}
          </span>
          <span className="map-toolbar-title">
            {order?.tracking_code ?? "Yangon operations"}
          </span>
        </div>
        <div
          className={`map-live-pill ${liveRiderCount && !isDemo ? "is-connected" : ""}`}
        >
          <span className="live-dot" />
          {isDemo
            ? "DEMO LOCATION"
            : mode === "manager" && liveRiderCount
              ? `${liveRiderCount} ${liveRiderCount === 1 ? "RIDER" : "RIDERS"} LIVE`
              : mode !== "manager" &&
                  parcelLocationState(order, now) === "closed"
                ? "TRACKING ENDED"
                : liveRiderCount
                  ? "LIVE GPS"
                  : trackedOrders.length
                    ? "LAST KNOWN LOCATION"
                    : "LOCATION PENDING"}
        </div>
      </div>

      <div data-map-id={mode} className="map-viewport">
        {tiles.length ? (
          <div className="map-tiles" aria-hidden="true">
            {tiles.map((tile) => (
              <div
                key={`${tile.x}-${tile.y}`}
                className="map-tile"
                style={{
                  left: tile.left,
                  top: tile.top,
                  backgroundImage: `url(${tile.src})`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="map-placeholder-grid" />
        )}
        <div className="map-wash" />

        {size.width > 0 && size.height > 0 && (
          <svg
            className="map-overlay"
            viewBox={`0 0 ${size.width} ${size.height}`}
            aria-hidden="true"
          >
            {markerRows.map((row) => {
              const rider = pointAt(row.rider, center, size, zoom);
              const destination = row.destination
                ? pointAt(row.destination, center, size, zoom)
                : null;
              return (
                <g key={row.order.id}>
                  {destination && (
                    <>
                      <path
                        className="route-shadow"
                        d={`M ${rider.x} ${rider.y} Q ${(rider.x + destination.x) / 2 + 30} ${(rider.y + destination.y) / 2 - 24} ${destination.x} ${destination.y}`}
                      />
                      <path
                        className="route-line"
                        d={`M ${rider.x} ${rider.y} Q ${(rider.x + destination.x) / 2 + 30} ${(rider.y + destination.y) / 2 - 24} ${destination.x} ${destination.y}`}
                      />
                      <g
                        transform={`translate(${destination.x} ${destination.y})`}
                      >
                        <circle className="destination-halo" r="16" />
                        <path
                          className="destination-pin"
                          d="M0-10c-5.5 0-9 4.2-9 9.2C-9 5-1 12 0 13c1-1 9-8 9-13.8C9-5.8 5.5-10 0-10Zm0 12.8A3.2 3.2 0 1 1 0-3.6a3.2 3.2 0 0 1 0 6.4Z"
                        />
                        <text className="map-marker-label" x="15" y="4">
                          {row.order.id === order?.id ? "DROP-OFF" : ""}
                        </text>
                      </g>
                    </>
                  )}
                  <g transform={`translate(${rider.x} ${rider.y})`}>
                    {(isDemo ||
                      parcelLocationState(row.order, now) === "live") && (
                      <circle className="rider-pulse" r="25" />
                    )}
                    <circle className="rider-halo" r="15" />
                    <g className="rider-marker">
                      <circle r="13" />
                      <path d="M-6-2h8l3 4h2v4h-2a2.2 2.2 0 0 1-4.4 0h-4.2a2.2 2.2 0 0 1-4.4 0H-10V0h4l2-2Z" />
                      <circle cx="-4" cy="6" r="1.7" />
                      <circle cx="3" cy="6" r="1.7" />
                    </g>
                  </g>
                </g>
              );
            })}
            {pickupPosition && !livePoint && (
              <g
                transform={`translate(${pickupPosition.x} ${pickupPosition.y})`}
              >
                <circle className="map-halo pickup-halo" r="22" />
                <circle className="pickup-pin" r="7" />
                <text className="map-marker-label" x="16" y="4">
                  PICKUP
                </text>
              </g>
            )}
            {destinationPosition && !markerRows.length && (
              <g
                transform={`translate(${destinationPosition.x} ${destinationPosition.y})`}
              >
                <circle className="destination-halo" r="16" />
                <path
                  className="destination-pin"
                  d="M0-10c-5.5 0-9 4.2-9 9.2C-9 5-1 12 0 13c1-1 9-8 9-13.8C9-5.8 5.5-10 0-10Zm0 12.8A3.2 3.2 0 1 1 0-3.6a3.2 3.2 0 0 1 0 6.4Z"
                />
                <text className="map-marker-label" x="15" y="4">
                  DROP-OFF
                </text>
              </g>
            )}
            {riderPosition && !markerRows.length && (
              <g transform={`translate(${riderPosition.x} ${riderPosition.y})`}>
                <circle className="rider-pulse" r="25" />
                <circle className="rider-halo" r="15" />
                <g className="rider-marker">
                  <circle r="13" />
                  <path d="M-6-2h8l3 4h2v4h-2a2.2 2.2 0 0 1-4.4 0h-4.2a2.2 2.2 0 0 1-4.4 0H-10V0h4l2-2Z" />
                  <circle cx="-4" cy="6" r="1.7" />
                  <circle cx="3" cy="6" r="1.7" />
                </g>
              </g>
            )}
          </svg>
        )}

        <div className="map-location-chip">
          <span className="map-location-icon">
            <Icon name="location" size={15} />
          </span>
          <span>
            {mode === "manager" && trackedOrders.length
              ? `${trackedOrders.length} riders visible · Yangon`
              : order?.status === "in_transit"
                ? "Yangon · en route"
                : order?.status === "picked_up"
                  ? "Yangon · parcel collected"
                  : "Yangon, Myanmar"}
          </span>
        </div>
        <div className="map-updated-chip">
          {trackedOrders.length || livePoint ? (
            <Icon name="track" size={14} />
          ) : (
            <Icon name="history" size={14} />
          )}
          {locationText}
        </div>
        <div className="map-attribution">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap
          </a>
        </div>
      </div>
    </section>
  );
}
