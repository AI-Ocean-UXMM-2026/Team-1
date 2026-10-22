"use client";

import type { MapLayerMouseEvent, Marker as MapboxMarker } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/delivery/icons";
import type { LocationMapProps } from "@/components/delivery/location-map";
import {
  type Coordinate,
  drawLines,
  drawPolygons,
  fitToPoints,
  labelElement,
  lngLat,
  mapPalette,
  prefersDark,
  removePolygonLayers,
  svgMarker,
  useMapboxMap,
} from "@/components/delivery/mapbox-kit";
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
  checkRouteFloodExposure,
  generateCirclePolygon,
  getYangonFloodZones,
} from "@/lib/delivery/flood-zones";
import {
  canShowParcelLocation,
  isRecentLocation,
  parcelLocationState,
} from "@/lib/delivery/location-state";
import type { MapPoint } from "@/lib/delivery/map-projection";
import {
  fetchRoadRoute,
  formatDriveMinutes,
  hasMapbox,
} from "@/lib/delivery/mapbox";
import type { DeliveryOrder, RoadReport } from "@/lib/delivery/types";
import { useRoadRoute } from "@/lib/delivery/use-road-route";

type Palette = ReturnType<typeof mapPalette>;

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function riderMarker(
  selected: boolean,
  palette: Palette,
  trackingCode: string,
  driverName?: string | null,
) {
  const el = svgMarker(
    `<circle class="rider-pulse" r="20" fill="${palette.route}" fill-opacity="0.35"/><circle r="${selected ? 18 : 16}" fill="${palette.route}" stroke="${palette.driverCasing}" stroke-width="3"/><path fill="#FFFFFF" d="M-7-3h9l3 4h2v5h-2a2.4 2.4 0 0 1-4.8 0h-4.4a2.4 2.4 0 0 1-4.8 0H-11V0h4l2-3Z"/>`,
    selected ? 52 : 46,
    "-26 -26 52 52",
    true,
    `Rider: ${driverName || "Assigned rider"} (${trackingCode})`,
  );
  el.classList.add("mapbox-rider-marker");
  el.append(labelElement(trackingCode));
  return el;
}

function hazardMarker(report: RoadReport) {
  const isSevere = report.severity === "high" || report.severity === "blocked";
  const color = isSevere ? "#DC2626" : "#D97706";
  const bg = isSevere ? "#FEF2F2" : "#FFFBEB";
  const icon = `<path d="M0 -6 L6 5 L-6 5 Z" fill="${color}"/><circle cx="0" cy="2.5" r="0.8" fill="#FFFFFF"/>`;
  const el = svgMarker(
    `<circle r="12" fill="${bg}" stroke="${color}" stroke-width="1.5"/>${icon}`,
    28,
    "-14 -14 28 28",
    true,
    `Road report: ${report.category} (${report.severity}) - ${report.description}`,
  );
  el.classList.add("mapbox-hazard-marker");
  return el;
}

function floodHazardMarker(report: RoadReport) {
  const isSevere = report.severity === "high" || report.severity === "blocked";
  const color = isSevere ? "#DC2626" : "#0284C7";
  const bg = isSevere ? "#FEF2F2" : "#F0F9FF";
  const halo = isSevere
    ? `<circle class="flood-pulse" r="22" fill="#DC2626" fill-opacity="0.25"/>`
    : `<circle class="flood-pulse" r="18" fill="#0284C7" fill-opacity="0.2"/>`;
  const el = svgMarker(
    `${halo}<circle r="13" fill="${bg}" stroke="${color}" stroke-width="1.8"/><path d="M-5 1 C-3 -1 -1 3 1 1 C3 -1 5 3 7 1" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M-5 -2 C-3 -4 -1 0 1 -2 C3 -4 5 0 7 -2" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    44,
    "-22 -22 44 44",
    true,
    `Flood hazard: ${report.description}`,
  );
  el.classList.add("mapbox-flood-marker");
  el.append(
    labelElement(isSevere ? "FLOOD (BLOCKED)" : "FLOOD HAZARD"),
  );
  return el;
}

function destinationMarker(palette: Palette, label: string | null) {
  const element = svgMarker(
    `<circle r="16" fill="${palette.destination}" fill-opacity="0.18"/><g transform="translate(0 3)"><path fill="${palette.destination}" stroke="#ffffff" stroke-width="2" d="M0-10c-5.5 0-9 4.2-9 9.2C-9 5-1 12 0 13c1-1 9-8 9-13.8C9-5.8 5.5-10 0-10Z"/></g>`,
    32,
    "-16 -16 32 32",
  );
  if (label) element.append(labelElement(label));
  return element;
}

function pickupMarker(palette: Palette) {
  const element = svgMarker(
    `<circle r="7" fill="#ffffff" stroke="${palette.origin}" stroke-width="3"/>`,
    16,
    "-8 -8 16 16",
  );
  element.append(labelElement("PICKUP"));
  return element;
}

/**
 * Dispatch map on Mapbox GL with live flood hazard visualization,
 * telemetry indicators, and road report overlays.
 */
export function MapboxLocationMap({
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
  const container = useRef<HTMLDivElement>(null);
  const mapState = useMapboxMap(container, true);
  const map = mapState?.map ?? null;
  const gl = mapState?.gl ?? null;
  const [moved, setMoved] = useState(false);
  const [now, setNow] = useState(0);
  const [showFlood, setShowFlood] = useState(initialShowFlood);
  const [liveFlood, setLiveFlood] = useState<LiveFloodConditions | null>(
    propLiveFlood ?? null,
  );
  const [activeRiderPopup, setActiveRiderPopup] = useState<{
    order: DeliveryOrder;
    point: MapPoint;
  } | null>(null);
  const [activeHazardPopup, setActiveHazardPopup] = useState<RoadReport | null>(
    null,
  );
  const [activeFloodZone, setActiveFloodZone] = useState<FloodZone | null>(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [otherRoutes, setOtherRoutes] = useState<Record<string, Coordinate[]>>({});
  const flownTo = useRef<string | null>(null);

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
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!map || !focusPoint) return;
    map.easeTo({
      center: lngLat(focusPoint),
      zoom: 15.5,
      duration: 800,
    });
  }, [map, focusPoint]);

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
  const selectedRow = markerRows.find((row) => row.order.id === order?.id);
  const road = useRoadRoute(
    selectedRow?.rider ?? null,
    selectedRow?.destination ? [selectedRow.destination] : [],
  );

  useEffect(() => {
    if (!hasMapbox) return;
    const unselected = markerRows.filter(
      (row) => row.order.id !== order?.id && row.destination != null,
    );
    for (const row of unselected) {
      if (!row.destination) continue;
      const key = `${row.rider.latitude.toFixed(4)},${row.rider.longitude.toFixed(4)};${row.destination.latitude.toFixed(4)},${row.destination.longitude.toFixed(4)}`;
      if (otherRoutes[row.order.id + key]) continue;
      fetchRoadRoute([row.rider, row.destination]).then((res) => {
        if (res && res.coordinates.length > 1) {
          setOtherRoutes((prev) => ({
            ...prev,
            [row.order.id]: res.coordinates,
            [row.order.id + key]: res.coordinates,
          }));
        }
      });
    }
  }, [markerRows, order?.id, otherRoutes]);

  const fitPoints: MapPoint[] = markerRows.length
    ? markerRows.flatMap((row) =>
        row.destination ? [row.rider, row.destination] : [row.rider],
      )
    : [pickupPoint, destinationPoint].filter(
        (point): point is MapPoint => point !== null,
      );
  const fitKey = fitPoints.map((p) => `${p.latitude},${p.longitude}`).join("|");

  useEffect(() => {
    if (!map) return;
    const onDrag = () => setMoved(true);
    const onUserZoom = (event: { type: string; originalEvent?: unknown }) => {
      if (event.originalEvent) setMoved(true);
    };
    map.on("dragstart", onDrag);
    map.on("zoomstart", onUserZoom);
    return () => {
      map.off("dragstart", onDrag);
      map.off("zoomstart", onUserZoom);
    };
  }, [map]);

  useEffect(() => {
    if (!map || moved || !fitPoints.length) return;
    fitToPoints(
      map,
      fitPoints,
      { x: 56, top: 92, bottom: 92 },
      mode === "customer" ? 14 : 15,
    );
  }, [map, moved, fitKey, mode]);

  useEffect(() => {
    if (!map || !selectedRow || flownTo.current === order?.id) return;
    flownTo.current = order?.id ?? null;
    map.easeTo({
      center: lngLat(selectedRow.rider),
      zoom: Math.max(map.getZoom(), 13.5),
      duration: 800,
    });
  }, [map, order?.id, selectedRow]);

  // Draw or update flood polygon layers in Mapbox
  useEffect(() => {
    if (!map || mode !== "manager") return;

    if (!showFlood) {
      removePolygonLayers(map, "flood-hazard-zones");
      removePolygonLayers(map, "flood-report-buffers");
      return;
    }

    const zonePolygons = floodZones.map((z) => ({
      coordinates: [z.coordinates as Coordinate[]],
      properties: {
        id: z.id,
        name: z.name,
        hazardClass: z.hazardClass,
      },
    }));

    drawPolygons(map, "flood-hazard-zones", zonePolygons, {
      fillColor: "#0284C7",
      fillOpacity: 0.28,
      lineColor: "#0369A1",
      lineWidth: 2,
      lineDash: [3, 2],
    });

    const bufferPolygons = activeFloodReports.map((report) => ({
      coordinates: [
        generateCirclePolygon(
          { latitude: report.latitude, longitude: report.longitude },
          0.4,
          24,
        ) as Coordinate[],
      ],
      properties: {
        id: report.id,
      },
    }));

    drawPolygons(map, "flood-report-buffers", bufferPolygons, {
      fillColor: "#0284C7",
      fillOpacity: 0.16,
      lineColor: "#0284C7",
      lineWidth: 1.5,
      lineDash: [2, 2],
    });
  }, [map, mode, showFlood, floodZones, activeFloodReports]);

  // Click on flood zone polygon layer to inspect
  useEffect(() => {
    if (!map || mode !== "manager") return;

    const onZoneClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0] as unknown as
        | { properties?: Record<string, unknown> }
        | undefined;
      const id = feature?.properties?.id;
      const zone = floodZones.find((z) => z.id === id);
      if (zone) {
        setActiveFloodZone(zone);
        setActiveRiderPopup(null);
        setActiveHazardPopup(null);
      }
    };

    map.on("click", "flood-hazard-zones-fill", onZoneClick);
    return () => {
      map.off("click", "flood-hazard-zones-fill", onZoneClick);
    };
  }, [map, mode, floodZones]);

  useEffect(() => {
    if (!map || !gl) return;
    const palette = mapPalette(prefersDark());
    const markers: MapboxMarker[] = [];
    const place = (
      element: HTMLElement,
      point: MapPoint,
      anchor: "center" | "bottom",
    ) => {
      markers.push(
        new gl.Marker({ element, anchor }).setLngLat(lngLat(point)).addTo(map),
      );
    };

    for (const row of markerRows) {
      const selected = row.order.id === order?.id;
      const rider = riderMarker(
        selected,
        palette,
        row.order.tracking_code,
        row.order.driver_name,
      );
      rider.title = `${row.order.driver_name || "Rider"} · ${row.order.tracking_code}`;
      rider.addEventListener("click", () => {
        onSelectOrder?.(row.order.id);
        setActiveRiderPopup({ order: row.order, point: row.rider });
        setActiveHazardPopup(null);
        setActiveFloodZone(null);
      });
      place(rider, row.rider, "center");
      if (row.destination)
        place(
          destinationMarker(palette, selected ? "DROP-OFF" : null),
          row.destination,
          "bottom",
        );
    }
    if (order && pickupPoint && !livePoint)
      place(pickupMarker(palette), pickupPoint, "center");
    if (destinationPoint && !markerRows.length)
      place(destinationMarker(palette, "DROP-OFF"), destinationPoint, "bottom");

    if (roadReports?.length) {
      for (const report of roadReports) {
        if (report.status === "rejected") continue;
        const isFlooding = report.category === "flooding";
        const hazard = isFlooding
          ? floodHazardMarker(report)
          : hazardMarker(report);

        hazard.addEventListener("click", () => {
          setActiveHazardPopup(report);
          setActiveRiderPopup(null);
          setActiveFloodZone(null);
        });
        place(
          hazard,
          { latitude: report.latitude, longitude: report.longitude },
          "center",
        );
      }
    }

    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [
    map,
    gl,
    markerRows,
    order,
    livePoint,
    pickupPoint,
    destinationPoint,
    onSelectOrder,
    roadReports,
  ]);

  const routeCoords: Coordinate[] = useMemo(() => {
    if (road && road.coordinates.length > 1) {
      return road.coordinates;
    }
    if (selectedRow?.rider && selectedRow?.destination) {
      return [lngLat(selectedRow.rider), lngLat(selectedRow.destination)];
    }
    return [];
  }, [road, selectedRow]);

  const routeFloodRisk = useMemo(
    () =>
      checkRouteFloodExposure(
        routeCoords,
        showFlood ? floodZones : [],
        showFlood ? activeFloodReports : [],
      ),
    [routeCoords, showFlood, floodZones, activeFloodReports],
  );

  useEffect(() => {
    if (!map) return;
    const palette = mapPalette(prefersDark());
    const connectors: Coordinate[][] = markerRows.flatMap((row) => {
      if (row.order.id === order?.id || !row.destination) return [];
      const coords = otherRoutes[row.order.id];
      return coords && coords.length > 1
        ? [coords]
        : [[lngLat(row.rider), lngLat(row.destination)]];
    });
    drawLines(map, "dispatch-connectors", connectors, {
      color: palette.origin,
      width: 2,
      dash: [2, 3],
    });
    const selectedLine: Coordinate[] = road
      ? road.coordinates
      : selectedRow?.destination
        ? [lngLat(selectedRow.rider), lngLat(selectedRow.destination)]
        : [];
    drawLines(map, "dispatch-route-casing", [selectedLine], {
      color: routeFloodRisk.hasFloodRisk ? "#F59E0B" : palette.casing,
      width: 9,
    });
    drawLines(map, "dispatch-route", [selectedLine], {
      color: palette.route,
      width: 5,
    });
  }, [map, markerRows, order?.id, road, selectedRow, otherRoutes, routeFloodRisk.hasFloodRisk]);

  const handleRecenter = () => {
    if (!map || !fitPoints.length) return;
    setMoved(false);
    setActiveRiderPopup(null);
    setActiveHazardPopup(null);
    setActiveFloodZone(null);
    fitToPoints(
      map,
      fitPoints,
      { x: 56, top: 92, bottom: 92 },
      mode === "customer" ? 14 : 15,
    );
  };

  const latestTimestamp = latestRecordedAt(
    trackedOrders,
    livePoint ? (order?.latest_location?.recorded_at ?? null) : null,
  );
  const locationText = locationStatusText({
    isDemo,
    latestTimestamp,
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

      <div className="map-viewport mapbox-viewport">
        <div ref={container} className="mapbox-canvas" />

        {mode === "manager" && (
          <div className="map-actions-cluster">
            <button
              type="button"
              className="map-action-btn"
              onClick={handleRecenter}
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
            <div className="map-zoom-group">
              <button
                type="button"
                className="map-action-btn map-zoom-btn"
                onClick={() => map?.zoomIn()}
                aria-label="Zoom in"
                title="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="map-action-btn map-zoom-btn"
                onClick={() => map?.zoomOut()}
                aria-label="Zoom out"
                title="Zoom out"
              >
                −
              </button>
            </div>
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

        {activeRiderPopup && (
          <div
            className="map-popover-card"
            role="dialog"
            aria-label="Rider details"
          >
            <div className="map-popover-header">
              <span className="map-popover-badge">
                <span className="live-dot" />
                {activeRiderPopup.order.status === "in_transit"
                  ? "In transit"
                  : activeRiderPopup.order.status}
              </span>
              <button
                type="button"
                className="map-popover-close"
                onClick={() => setActiveRiderPopup(null)}
                aria-label="Close rider details"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="map-popover-body">
              <strong>
                {activeRiderPopup.order.driver_name || "Assigned Rider"}
              </strong>
              {activeRiderPopup.order.vehicle_label && (
                <span className="map-popover-meta">
                  {activeRiderPopup.order.vehicle_label}
                </span>
              )}
              {activeRiderPopup.order.driver_phone && (
                <a
                  href={`tel:${activeRiderPopup.order.driver_phone}`}
                  className="map-popover-phone"
                >
                  <Icon name="phone" size={13} />
                  {activeRiderPopup.order.driver_phone}
                </a>
              )}
              <div className="map-popover-tracking">
                <span>
                  Parcel:{" "}
                  <strong>{activeRiderPopup.order.tracking_code}</strong>
                </span>
                <span>To: {activeRiderPopup.order.delivery_address}</span>
              </div>
            </div>
          </div>
        )}

        {/* Flood Hazard Zone Details Popover */}
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
                Reported by {activeHazardPopup.driver_name} ·{" "}
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
          {road ? ` · ${formatDriveMinutes(road.durationMin)} by road` : ""}
        </div>
      </div>
    </section>
  );
}
