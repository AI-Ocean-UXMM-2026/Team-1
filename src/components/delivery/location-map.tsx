"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { MapboxLocationMap } from "@/components/delivery/mapbox-location-map";
import {
  type LiveFloodConditions,
  fetchLiveFloodConditions,
} from "@/lib/delivery/dispatch/open-meteo";
import {
  dispatchRows,
  latestRecordedAt,
  locationStatusText,
} from "@/lib/delivery/dispatch-rows";
import {
  type FloodZone,
  calculateRadiusPixels,
  checkRouteFloodExposure,
  getYangonFloodZones,
} from "@/lib/delivery/flood-zones";
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

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

export type LocationMapProps = {
  order: DeliveryOrder | null;
  orders?: DeliveryOrder[];
  mode?: "customer" | "rider" | "manager";
  isDemo: boolean;
  tall?: boolean;
  compact?: boolean;
  onSelectOrder?: (orderId: string) => void;
  roadReports?: RoadReport[];
  focusPoint?: Point | null;
  floodZones?: FloodZone[];
  liveFlood?: LiveFloodConditions | null;
  initialShowFlood?: boolean;
};

/** Mapbox when a token is configured; the OSM tile map otherwise. */
export function LocationMap({
  onSelectOrder,
  roadReports,
  focusPoint,
  floodZones,
  liveFlood,
  initialShowFlood,
  ...props
}: LocationMapProps) {
  return hasMapbox ? (
    <MapboxLocationMap
      {...props}
      onSelectOrder={onSelectOrder}
      roadReports={roadReports}
      focusPoint={focusPoint}
      floodZones={floodZones}
      liveFlood={liveFlood}
      initialShowFlood={initialShowFlood}
    />
  ) : (
    <OsmLocationMap
      {...props}
      onSelectOrder={onSelectOrder}
      roadReports={roadReports}
      focusPoint={focusPoint}
      floodZones={floodZones}
      liveFlood={liveFlood}
      initialShowFlood={initialShowFlood}
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
  floodZones: propFloodZones,
  liveFlood: propLiveFlood,
  initialShowFlood = true,
}: LocationMapProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [now, setNow] = useState(0);
  const [manualCenter, setManualCenter] = useState<Point | null>(null);
  const [showFlood, setShowFlood] = useState(initialShowFlood);
  const [liveFlood, setLiveFlood] = useState<LiveFloodConditions | null>(
    propLiveFlood ?? null,
  );
  const [activeFloodZone, setActiveFloodZone] = useState<FloodZone | null>(null);
  const [activeHazardPopup, setActiveHazardPopup] = useState<RoadReport | null>(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);

  useEffect(() => {
    if (focusPoint) setManualCenter(focusPoint);
  }, [focusPoint]);

  useEffect(() => {
    if (propLiveFlood) {
      setLiveFlood(propLiveFlood);
    }
  }, [propLiveFlood]);

  useEffect(() => {
    if (mode !== "manager" || propLiveFlood) return;
    let cancelled = false;
    fetchLiveFloodConditions({ lat: 16.8007, lng: 96.15 })
      .then((conditions) => {
        if (!cancelled && conditions) setLiveFlood(conditions);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, propLiveFlood]);

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

  const floodZones = useMemo(
    () => propFloodZones ?? getYangonFloodZones(),
    [propFloodZones],
  );

  const activeFloodReports = useMemo(
    () =>
      roadReports?.filter(
        (r) =>
          r.status !== "rejected" &&
          (r.category === "flooding" || r.severity === "blocked"),
      ) ?? [],
    [roadReports],
  );

  const floodAlertCount = floodZones.length + activeFloodReports.length;

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

  const routeCoords: [number, number][] = useMemo(() => {
    if (livePoint && destinationPoint) {
      return [
        [livePoint.longitude, livePoint.latitude],
        [destinationPoint.longitude, destinationPoint.latitude],
      ];
    }
    if (pickupPoint && destinationPoint) {
      return [
        [pickupPoint.longitude, pickupPoint.latitude],
        [destinationPoint.longitude, destinationPoint.latitude],
      ];
    }
    return [];
  }, [livePoint, destinationPoint, pickupPoint]);

  const routeFloodRisk = useMemo(
    () =>
      checkRouteFloodExposure(
        routeCoords,
        showFlood ? floodZones : [],
        showFlood ? activeFloodReports : [],
      ),
    [routeCoords, showFlood, floodZones, activeFloodReports],
  );

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
          <div className="map-toolbar-pills">
            {mode === "manager" && liveFlood && (
              <button
                type="button"
                className={`map-weather-pill weather-severity-${liveFlood.severity}`}
                onClick={() => setShowWeatherModal((v) => !v)}
                title="Open-Meteo live hydrology & rain conditions"
                aria-label="Live weather & flood telemetry"
              >
                <span className={`live-weather-dot dot-${liveFlood.severity}`} />
                <span className="live-weather-text">
                  {liveFlood.precipitationMm > 0
                    ? `${liveFlood.precipitationMm} mm/h rain`
                    : "Clear weather"}
                  {liveFlood.riverDischargeM3s != null
                    ? ` · River ${liveFlood.riverDischargeM3s} m³/s`
                    : ""}
                </span>
                <span className={`live-weather-tag tag-${liveFlood.severity}`}>
                  {liveFlood.severity === "flood_risk"
                    ? "Flood Risk"
                    : liveFlood.severity === "heavy_rain"
                      ? "Heavy Rain"
                      : liveFlood.severity === "light_rain"
                        ? "Rain"
                        : "Normal"}
                </span>
              </button>
            )}
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
              onClick={() => {
                setManualCenter(null);
                setActiveFloodZone(null);
                setActiveHazardPopup(null);
              }}
              aria-label="Recenter all vehicles"
              title="Recenter fleet"
            >
              <Icon name="navigation" size={14} />
              <span>Recenter</span>
            </button>
            <button
              type="button"
              className={`map-action-btn map-flood-toggle ${showFlood ? "is-active" : ""}`}
              onClick={() => setShowFlood((v) => !v)}
              aria-pressed={showFlood}
              aria-label="Toggle flood hazard overlay"
              title="Toggle flood hazard visualization"
            >
              <Icon name="flood" size={14} />
              <span>Flood</span>
              {floodAlertCount > 0 && (
                <span className="map-flood-count-tag">{floodAlertCount}</span>
              )}
            </button>
          </div>
        )}

        {routeFloodRisk?.hasFloodRisk && (
          <div className="map-flood-warning-banner" role="alert">
            <Icon name="warning" size={15} />
            <span>
              <strong>Monsoon Caution:</strong> {routeFloodRisk.warningMessage}
              {routeFloodRisk.suggestedSlowdownPercent > 0 &&
                ` (+${routeFloodRisk.suggestedSlowdownPercent}% delay risk)`}
            </span>
          </div>
        )}

        {size.width > 0 && size.height > 0 && (
          <svg
            className="map-overlay"
            viewBox={`0 0 ${size.width} ${size.height}`}
            aria-hidden="true"
          >
            {/* Flood Hazard Zones Layer */}
            {showFlood && mode === "manager" && (
              <g className="flood-zones-group">
                {floodZones.map((zone) => {
                  const pointsStr = zone.coordinates
                    .map(([lng, lat]) => {
                      const p = pointAt(
                        { latitude: lat, longitude: lng },
                        center,
                        size,
                        zoom,
                      );
                      return `${p.x},${p.y}`;
                    })
                    .join(" ");
                  const centerPx = pointAt(zone.center, center, size, zoom);
                  return (
                    <g
                      key={zone.id}
                      className={`flood-zone-group hazard-class-${zone.hazardClass}`}
                      onClick={() => {
                        setActiveFloodZone(zone);
                        setActiveHazardPopup(null);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Flood hazard zone: ${zone.name}`}
                      style={{ cursor: "pointer" }}
                    >
                      <polygon points={pointsStr} className="flood-polygon-shape" />
                      <text
                        x={centerPx.x}
                        y={centerPx.y}
                        className="flood-zone-label"
                        textAnchor="middle"
                      >
                        🌊 {zone.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Circular buffers around flood reports */}
            {showFlood &&
              mode === "manager" &&
              activeFloodReports.map((report) => {
                const pos = pointAt(
                  { latitude: report.latitude, longitude: report.longitude },
                  center,
                  size,
                  zoom,
                );
                const rPx = calculateRadiusPixels(400, report.latitude, zoom);
                return (
                  <g key={`flood-buf-${report.id}`} className="flood-report-buffer">
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={rPx}
                      className="flood-hazard-radius"
                    />
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={rPx * 0.65}
                      className="flood-hazard-ripple"
                    />
                  </g>
                );
              })}

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
                        className={`route-line ${routeFloodRisk.hasFloodRisk && row.order.id === order?.id ? "route-flood-caution" : ""}`}
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

            {/* Road Reports & Flood Incidents */}
            {roadReports
              ?.filter((r) => r.status !== "rejected")
              .map((report) => {
                const pos = pointAt(
                  { latitude: report.latitude, longitude: report.longitude },
                  center,
                  size,
                  zoom,
                );
                const isSevere =
                  report.severity === "high" || report.severity === "blocked";

                if (report.category === "flooding") {
                  return (
                    <g
                      key={report.id}
                      transform={`translate(${pos.x} ${pos.y})`}
                      className={`flood-hazard-marker severity-${report.severity}`}
                      onClick={() => {
                        setActiveHazardPopup(report);
                        setActiveFloodZone(null);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Flooding report: ${report.description}`}
                      style={{ cursor: "pointer" }}
                    >
                      {isSevere && <circle className="flood-pulse-ring" r="24" />}
                      <circle
                        r="13"
                        fill={isSevere ? "#FEF2F2" : "#F0F9FF"}
                        stroke={isSevere ? "#DC2626" : "#0284C7"}
                        strokeWidth="1.8"
                      />
                      <path
                        d="M-5 1 C-3 -1 -1 3 1 1 C3 -1 5 3 7 1"
                        stroke={isSevere ? "#DC2626" : "#0284C7"}
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinecap="round"
                      />
                      <path
                        d="M-5 -2 C-3 -4 -1 0 1 -2 C3 -4 5 0 7 -2"
                        stroke={isSevere ? "#DC2626" : "#0284C7"}
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinecap="round"
                      />
                      <text className="map-marker-label flood-badge-label" x="15" y="4">
                        {isSevere ? "FLOOD (BLOCKED)" : "FLOOD HAZARD"}
                      </text>
                    </g>
                  );
                }

                return (
                  <g
                    key={report.id}
                    transform={`translate(${pos.x} ${pos.y})`}
                    className="hazard-marker"
                    onClick={() => {
                      setActiveHazardPopup(report);
                      setActiveFloodZone(null);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Hazard: ${report.category} (${report.severity})`}
                    style={{ cursor: "pointer" }}
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

        {/* Flood Legend for Manager Map */}
        {showFlood && mode === "manager" && (
          <div className="map-flood-legend" aria-label="Flood risk legend">
            <div className="flood-legend-header">
              <span className="flood-legend-title">
                <Icon name="flood" size={13} />
                Flood Risk
              </span>
              <span className="flood-legend-count">
                {floodAlertCount} monitored
              </span>
            </div>
            <div className="flood-legend-items">
              <span className="legend-item">
                <i className="legend-swatch class-1" /> Class 1 (10–25cm)
              </span>
              <span className="legend-item">
                <i className="legend-swatch class-2" /> Class 2 (25–50cm)
              </span>
              <span className="legend-item">
                <i className="legend-swatch class-3" /> Class 3 (&gt;50cm)
              </span>
            </div>
          </div>
        )}

        {/* Flood Zone Details Popover */}
        {activeFloodZone && (
          <div
            className="map-popover-card flood-zone-popover"
            role="dialog"
            aria-label="Flood hazard zone details"
          >
            <div className="map-popover-header">
              <span
                className={`flood-severity-badge hazard-class-${activeFloodZone.hazardClass}`}
              >
                <Icon name="flood" size={13} />
                CLASS {activeFloodZone.hazardClass} ·{" "}
                {activeFloodZone.severity.toUpperCase()} HAZARD
              </span>
              <button
                type="button"
                className="map-popover-close"
                onClick={() => setActiveFloodZone(null)}
                aria-label="Close flood details"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="map-popover-body">
              <strong>{activeFloodZone.name}</strong>
              <p className="hazard-description">{activeFloodZone.description}</p>
              <div className="flood-popover-meta">
                <span>
                  Est. depth:{" "}
                  <strong>~{activeFloodZone.waterDepthEstimateCm} cm</strong>
                </span>
                <span>
                  Flow: <strong>{activeFloodZone.flowRisk}</strong>
                </span>
              </div>
              <div className="flood-advisory-box">
                <strong>Dispatch Advisory:</strong> {activeFloodZone.advisory}
              </div>
            </div>
          </div>
        )}

        {/* Hazard / Flood Report Popover */}
        {activeHazardPopup && (
          <div
            className="map-popover-card hazard-popover"
            role="dialog"
            aria-label="Road hazard details"
          >
            <div className="map-popover-header">
              <span
                className={`road-severity road-severity-${activeHazardPopup.severity}`}
              >
                {activeHazardPopup.category === "flooding" ? "🌊 " : ""}
                {activeHazardPopup.category.toUpperCase()} ·{" "}
                {activeHazardPopup.severity}
              </span>
              <button
                type="button"
                className="map-popover-close"
                onClick={() => setActiveHazardPopup(null)}
                aria-label="Close hazard details"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="map-popover-body">
              <p className="hazard-description">
                {activeHazardPopup.description}
              </p>
              <span className="map-popover-meta">
                Reported by {activeHazardPopup.driver_name || "Assigned rider"} ·{" "}
                {formatTime(activeHazardPopup.reported_at)}
              </span>
              {activeHazardPopup.category === "flooding" && (
                <div className="flood-advisory-box">
                  <strong>Flood Caution:</strong>{" "}
                  {activeHazardPopup.severity === "blocked"
                    ? "Road blocked by standing water. Mandatory detour."
                    : "Water on road surface. High-clearance vehicles advised."}
                </div>
              )}
              <span className="hazard-status-tag">
                Status: {activeHazardPopup.status}
              </span>
            </div>
          </div>
        )}

        {/* Open-Meteo Weather Modal Popover */}
        {showWeatherModal && liveFlood && (
          <div
            className="map-popover-card weather-popover"
            role="dialog"
            aria-label="Open-Meteo weather details"
          >
            <div className="map-popover-header">
              <span className={`weather-badge-pill weather-${liveFlood.severity}`}>
                <span className="live-weather-dot" />
                LIVE HYDROLOGY · OPEN-METEO
              </span>
              <button
                type="button"
                className="map-popover-close"
                onClick={() => setShowWeatherModal(false)}
                aria-label="Close weather details"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="map-popover-body">
              <div className="weather-metrics-grid">
                <div className="weather-metric-item">
                  <span>Precipitation</span>
                  <strong>{liveFlood.precipitationMm} mm/h</strong>
                </div>
                <div className="weather-metric-item">
                  <span>River Discharge</span>
                  <strong>
                    {liveFlood.riverDischargeM3s != null
                      ? `${liveFlood.riverDischargeM3s} m³/s`
                      : "Normal"}
                  </strong>
                </div>
                <div className="weather-metric-item">
                  <span>Flood Risk</span>
                  <strong className={`risk-text-${liveFlood.severity}`}>
                    {liveFlood.severity.replace("_", " ").toUpperCase()}
                  </strong>
                </div>
                <div className="weather-metric-item">
                  <span>ETA Slowdown</span>
                  <strong>+{Math.round(liveFlood.suggestedSlowdown * 100)}%</strong>
                </div>
              </div>
              <p className="weather-source-note">
                Live open data from Copernicus GloFAS & Open-Meteo. Automatically
                factored into route feasibility and dispatch planning.
              </p>
            </div>
          </div>
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
