"use client";

import type { Marker as MapboxMarker } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/delivery/icons";
import type { LocationMapProps } from "@/components/delivery/location-map";
import {
  type Coordinate,
  drawLines,
  fitToPoints,
  labelElement,
  lngLat,
  mapPalette,
  prefersDark,
  svgMarker,
  useMapboxMap,
} from "@/components/delivery/mapbox-kit";
import {
  dispatchRows,
  latestRecordedAt,
  locationStatusText,
} from "@/lib/delivery/dispatch-rows";
import {
  canShowParcelLocation,
  parcelLocationState,
} from "@/lib/delivery/location-state";
import type { MapPoint } from "@/lib/delivery/map-projection";
import { formatDriveMinutes } from "@/lib/delivery/mapbox";
import { useRoadRoute } from "@/lib/delivery/use-road-route";

type Palette = ReturnType<typeof mapPalette>;

function riderMarker(selected: boolean, palette: Palette) {
  const halo = selected
    ? `<circle r="20" fill="${palette.route}" fill-opacity="0.2"/>`
    : "";
  return svgMarker(
    `${halo}<circle r="13" fill="${palette.driver}" stroke="${palette.driverCasing}" stroke-width="2"/><path fill="${palette.driverCasing}" d="M-6-2h8l3 4h2v4h-2a2.2 2.2 0 0 1-4.4 0h-4.2a2.2 2.2 0 0 1-4.4 0H-10V0h4l2-2Z"/>`,
    selected ? 44 : 34,
    "-22 -22 44 44",
  );
}

function destinationMarker(palette: Palette, label: string | null) {
  // The pin's tip sits at y=13; the 3px shift puts it on the box's bottom edge.
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
 * Dispatch map on Mapbox GL. Every rider with a live location gets a marker;
 * clicking one selects its order. The selected order's road route is drawn,
 * and the other riders show a faint straight connector to their drop-off.
 */
export function MapboxLocationMap({
  order,
  orders,
  mode = "customer",
  isDemo,
  tall = false,
  compact = false,
  onSelectOrder,
}: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapState = useMapboxMap(container, true);
  const map = mapState?.map ?? null;
  const gl = mapState?.gl ?? null;
  const [moved, setMoved] = useState(false);
  const [now, setNow] = useState(0);
  const flownTo = useRef<string | null>(null);

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
  const selectedRow = markerRows.find((row) => row.order.id === order?.id);
  const road = useRoadRoute(
    selectedRow?.rider ?? null,
    selectedRow?.destination ? [selectedRow.destination] : [],
  );

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

  // Keep every visible rider in view until the user pans or zooms.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fitKey tracks fitPoints
  useEffect(() => {
    if (!map || moved || !fitPoints.length) return;
    fitToPoints(
      map,
      fitPoints,
      { x: 56, top: 92, bottom: 92 },
      mode === "customer" ? 14 : 15,
    );
    // `fitPoints` is derived from the props above; `fitKey` carries its identity.
  }, [map, moved, fitKey, mode]);

  // A new selection flies to that rider once; GPS ticks do not re-fly.
  useEffect(() => {
    if (!map || !selectedRow || flownTo.current === order?.id) return;
    flownTo.current = order?.id ?? null;
    map.easeTo({
      center: lngLat(selectedRow.rider),
      zoom: Math.max(map.getZoom(), 13.5),
      duration: 800,
    });
  }, [map, order?.id, selectedRow]);

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
      const rider = riderMarker(selected, palette);
      rider.title = row.order.tracking_code;
      rider.addEventListener("click", () => onSelectOrder?.(row.order.id));
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

    return () => {
      for (const marker of markers) marker.remove();
    };
    // Points are recreated on each render, so they are read from the props above.
  }, [
    map,
    gl,
    markerRows,
    order,
    livePoint,
    pickupPoint,
    destinationPoint,
    onSelectOrder,
  ]);

  useEffect(() => {
    if (!map) return;
    const palette = mapPalette(prefersDark());
    const connectors: Coordinate[][] = markerRows.flatMap((row) =>
      row.order.id === order?.id || !row.destination
        ? []
        : [[lngLat(row.rider), lngLat(row.destination)]],
    );
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
      color: palette.casing,
      width: 9,
    });
    drawLines(map, "dispatch-route", [selectedLine], {
      color: palette.route,
      width: 5,
    });
  }, [map, markerRows, order?.id, road, selectedRow]);

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
                      ? "Last known location"
                      : "Location pending"}
          </div>
        </div>
      )}

      <div className="map-viewport mapbox-viewport">
        <div ref={container} className="mapbox-canvas" />

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
