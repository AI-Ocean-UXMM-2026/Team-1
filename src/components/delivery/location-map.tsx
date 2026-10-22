"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { MapboxLocationMap } from "@/components/delivery/mapbox-location-map";
import {
  dispatchRows,
  latestRecordedAt,
  locationStatusText,
} from "@/lib/delivery/dispatch-rows";
import {
  canShowParcelLocation,
  isRecentLocation,
  parcelLocationState,
} from "@/lib/delivery/location-state";
import { hasMapbox } from "@/lib/delivery/mapbox";
import type { DeliveryOrder, RoadReport } from "@/lib/delivery/types";

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

export type LocationMapProps = Parameters<typeof OsmLocationMap>[0] & {
  /** Selects a rider's order from the Mapbox dispatch markers. */
  onSelectOrder?: (orderId: string) => void;
  roadReports?: RoadReport[];
  focusPoint?: Point | null;
};

/** Mapbox when a token is configured; the OSM tile map otherwise. */
export function LocationMap({
  onSelectOrder,
  roadReports,
  focusPoint,
  ...props
}: LocationMapProps) {
  return hasMapbox ? (
    <MapboxLocationMap
      {...props}
      onSelectOrder={onSelectOrder}
      roadReports={roadReports}
      focusPoint={focusPoint}
    />
  ) : (
    <OsmLocationMap
      {...props}
      onSelectOrder={onSelectOrder}
      roadReports={roadReports}
      focusPoint={focusPoint}
    />
  );
}

function OsmLocationMap({
  order,
  orders,
  mode = "customer",
  isDemo,
  tall = false,
  compact = false,
  onSelectOrder,
  roadReports,
  focusPoint,
}: {
  order: DeliveryOrder | null;
  orders?: DeliveryOrder[];
  mode?: "customer" | "rider" | "manager";
  isDemo: boolean;
  tall?: boolean;
  compact?: boolean;
  onSelectOrder?: (orderId: string) => void;
  roadReports?: RoadReport[];
  focusPoint?: Point | null;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [now, setNow] = useState(0);
  const [manualCenter, setManualCenter] = useState<Point | null>(null);

  useEffect(() => {
    if (focusPoint) setManualCenter(focusPoint);
  }, [focusPoint]);

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
  const markerRows = dispatchRows(sourceOrders, mode, order);
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
    manualCenter ??
    (mode === "manager" && averagePoint
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
          destinationPoint ?? { latitude: 16.8007, longitude: 96.15 }));
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
  const locationText = locationStatusText({
    isDemo,
    latestTimestamp: latestRecordedAt(
      trackedOrders,
      livePoint ? (order?.latest_location?.recorded_at ?? null) : null,
    ),
    now,
    order,
  });

  return (
    <section
      className={`map-card ${tall ? "map-card-tall" : ""} ${compact ? "map-card-compact" : ""}`}
      aria-label="Delivery location map"
    >
      {!compact && (
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
              ? "Simulated tracking"
              : mode === "manager" && liveRiderCount
                ? `${liveRiderCount} ${liveRiderCount === 1 ? "rider" : "riders"} live`
                : mode !== "manager" &&
                    parcelLocationState(order, now) === "closed"
                  ? "Tracking ended"
                  : liveRiderCount
                    ? "Live GPS"
                    : trackedOrders.length
                      ? isRecentLocation(order, now)
                        ? "Refreshing"
                        : "Last known location"
                      : "Location pending"}
          </div>
        </div>
      )}

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

        {mode === "manager" && (
          <div className="map-actions-cluster">
            <button
              type="button"
              className="map-action-btn"
              onClick={() => setManualCenter(null)}
              aria-label="Recenter all vehicles"
              title="Recenter fleet"
            >
              <Icon name="navigation" size={14} />
              <span>Recenter</span>
            </button>
          </div>
        )}

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
                  <g
                    transform={`translate(${rider.x} ${rider.y})`}
                    onClick={() => onSelectOrder?.(row.order.id)}
                    role={onSelectOrder ? "button" : undefined}
                    tabIndex={onSelectOrder ? 0 : undefined}
                    aria-label={`Rider: ${row.order.driver_name || row.order.tracking_code}`}
                    style={{ cursor: onSelectOrder ? "pointer" : "default" }}
                  >
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
            {roadReports?.filter((r) => r.status !== "rejected").map((report) => {
              const pos = pointAt(
                { latitude: report.latitude, longitude: report.longitude },
                center,
                size,
                zoom,
              );
              const isSevere =
                report.severity === "high" || report.severity === "blocked";
              return (
                <g
                  key={report.id}
                  transform={`translate(${pos.x} ${pos.y})`}
                  className="hazard-marker"
                  aria-label={`Hazard: ${report.category} (${report.severity})`}
                >
                  <circle
                    r="12"
                    fill={isSevere ? "#FEF2F2" : "#FFFBEB"}
                    stroke={isSevere ? "#DC2626" : "#D97706"}
                    strokeWidth="1.5"
                  />
                  <path
                    d="M0 -6 L6 5 L-6 5 Z"
                    fill={isSevere ? "#DC2626" : "#D97706"}
                  />
                  <circle cx="0" cy="3" r="0.8" fill="#FFFFFF" />
                  <text className="map-marker-label" x="14" y="4">
                    {report.category}
                  </text>
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
