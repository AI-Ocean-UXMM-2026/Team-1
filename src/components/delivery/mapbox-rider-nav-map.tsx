"use client";

import type { Marker as MapboxMarker } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import {
  drawLines,
  fitToPoints,
  lngLat,
  type MapboxGl,
  mapPalette,
  prefersDark,
  svgMarker,
  useMapboxMap,
} from "@/components/delivery/mapbox-kit";
import type {
  NavStop,
  RiderNavMapProps,
} from "@/components/delivery/rider-nav-map";
import type { MapPoint } from "@/lib/delivery/map-projection";

const MAX_ZOOM = 17;
const MIN_ZOOM = 11;

function stopMarker(stop: NavStop) {
  const inner =
    stop.state === "done"
      ? `<path d="m-5 0 3.5 3.5L5-3.5"/>`
      : stop.state === "failed"
        ? `<path d="m-4-4 8 8m0-8-8 8"/>`
        : `<text y="4.5">${stop.number}</text>`;
  return svgMarker(
    `<g class="rnav-stop rnav-stop-${stop.state}"><circle r="13"/>${inner}</g>`,
    32,
    "-16 -16 32 32",
  );
}

function originMarker() {
  return svgMarker(`<circle class="rnav-origin" r="7"/>`, 16, "-8 -8 16 16");
}

function targetMarker(kind: "pickup" | "dropoff") {
  const glyph =
    kind === "pickup"
      ? `<path class="rnav-target-glyph" d="M-5.5-27h11v8.5h-11zM-5.5-27l2-3h7l2 3"/>`
      : `<circle class="rnav-target-dot" cy="-23" r="4.2"/>`;
  return svgMarker(
    `<g class="rnav-target rnav-target-${kind}"><path class="rnav-target-pin" d="M0 0c-2.6-6.4-13-12.6-13-23a13 13 0 0 1 26 0C13-12.6 2.6-6.4 0 0Z"/>${glyph}</g>`,
    32,
    "-16 -32 32 32",
  );
}

function driverMarker(heading: number | null) {
  const cone =
    heading == null
      ? ""
      : `<path class="rnav-driver-cone" transform="rotate(${heading})" d="M0 0-15-36A39 39 0 0 1 15-36Z"/>`;
  const arrow =
    heading == null
      ? `<path class="rnav-driver-arrow" d="M0-5a5 5 0 1 1 0 10A5 5 0 0 1 0-5Z"/>`
      : `<path class="rnav-driver-arrow" transform="rotate(${heading})" d="M0-9.5 7 7.5 0 3.5-7 7.5Z"/>`;
  return svgMarker(
    `<g class="rnav-driver"><circle class="rnav-driver-halo" r="24"/>${cone}<circle class="rnav-driver-body" r="15"/>${arrow}</g>`,
    80,
    "-40 -40 80 80",
  );
}

/**
 * Full-bleed rider map on Mapbox GL. Draws the road route when Mapbox returns
 * one, and otherwise the same straight line the OSM fallback draws.
 */
export function MapboxRiderNavMap({
  driver,
  heading,
  target,
  stops,
  padding = { x: 48, top: 150, bottom: 300 },
  targetId = null,
  routeThroughStops = false,
  interactive = true,
  label,
  road = null,
}: RiderNavMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapState = useMapboxMap(container, interactive);
  const [moved, setMoved] = useState(false);
  const [zoom, setZoom] = useState(16);
  const map = mapState?.map ?? null;
  const gl: MapboxGl | null = mapState?.gl ?? null;

  const focus: MapPoint[] = [];
  if (driver) focus.push(driver);
  if (routeThroughStops)
    for (const stop of stops) if (stop.state !== "done") focus.push(stop.point);
  if (target) focus.push(target);
  if (!focus.length) for (const stop of stops) focus.push(stop.point);
  const focusKey = focus.map((point) => `${point.latitude},${point.longitude}`);

  const straightPath: MapPoint[] = [];
  if (driver) straightPath.push(driver);
  if (routeThroughStops) {
    for (const stop of stops)
      if (stop.state === "current" || stop.state === "queued")
        straightPath.push(stop.point);
  } else if (target) straightPath.push(target);
  const routeCoordinates = road
    ? road.coordinates
    : straightPath.map((point) => lngLat(point));

  useEffect(() => {
    if (!map) return;
    const onDrag = () => setMoved(true);
    const onUserZoom = (event: { type: string; originalEvent?: unknown }) => {
      if (event.originalEvent) setMoved(true);
    };
    const onZoomEnd = () => setZoom(map.getZoom());
    map.on("dragstart", onDrag);
    map.on("zoomstart", onUserZoom);
    map.on("zoomend", onZoomEnd);
    setZoom(map.getZoom());
    return () => {
      map.off("dragstart", onDrag);
      map.off("zoomstart", onUserZoom);
      map.off("zoomend", onZoomEnd);
    };
  }, [map]);

  // Keep the focus points in view until the rider takes manual control.
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusKey tracks focus
  useEffect(() => {
    if (!map || moved || !focusKey.length) return;
    fitToPoints(
      map,
      focus,
      { x: padding.x, top: padding.top, bottom: padding.bottom },
      MAX_ZOOM,
    );
    // `focus` is derived from the props above; `focusKey` carries its identity.
  }, [map, moved, focusKey.join("|"), padding.x, padding.top, padding.bottom]);

  useEffect(() => {
    if (!map || !gl) return;
    const markers: MapboxMarker[] = [];
    for (const stop of stops) {
      if (target && stop.id === targetId && stop.kind === target.kind) continue;
      const element =
        stop.kind === "pickup" ? originMarker() : stopMarker(stop);
      markers.push(
        new gl.Marker({ element, anchor: "center" })
          .setLngLat(lngLat(stop.point))
          .addTo(map),
      );
    }
    if (target)
      markers.push(
        new gl.Marker({ element: targetMarker(target.kind), anchor: "bottom" })
          .setLngLat(lngLat(target))
          .addTo(map),
      );
    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [map, gl, stops, target, targetId]);

  useEffect(() => {
    if (!map || !gl || !driver) return;
    const marker = new gl.Marker({
      element: driverMarker(heading),
      anchor: "center",
    })
      .setLngLat(lngLat(driver))
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, gl, driver, heading]);

  useEffect(() => {
    if (!map) return;
    const palette = mapPalette(prefersDark());
    drawLines(map, "rnav-route-casing", [routeCoordinates], {
      color: palette.casing,
      width: 11,
    });
    drawLines(map, "rnav-route", [routeCoordinates], {
      color: palette.route,
      width: 6,
    });
  }, [map, routeCoordinates]);

  function zoomBy(step: number) {
    if (!map) return;
    setMoved(true);
    if (step > 0) map.zoomIn();
    else map.zoomOut();
  }

  return (
    <div className="rnav-map" aria-label={label} role="img">
      <div
        ref={container}
        className={`rnav-viewport ${interactive ? "is-interactive" : ""}`}
      />
      {interactive && (
        <div className="rnav-zoom">
          <button
            type="button"
            className="rnav-fab"
            onClick={() => zoomBy(1)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <Icon name="plus" size={20} />
          </button>
          <button
            type="button"
            className="rnav-fab"
            onClick={() => zoomBy(-1)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className={`rnav-fab rnav-fab-large ${moved ? "is-off-centre" : ""}`}
            onClick={() => setMoved(false)}
            aria-label="Recenter map on your route"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="6.5" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
