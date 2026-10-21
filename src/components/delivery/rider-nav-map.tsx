"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { MapboxRiderNavMap } from "@/components/delivery/mapbox-rider-nav-map";
import {
  type MapPoint,
  pointAt,
  TILE_SIZE,
  tilesFor,
  toWorldPixel,
} from "@/lib/delivery/map-projection";
import { hasMapbox, type RoadRoute } from "@/lib/delivery/mapbox";

export type NavStop = {
  id: string;
  number: number;
  point: MapPoint;
  state: "done" | "failed" | "current" | "queued";
  kind: "pickup" | "dropoff";
};

/** A road report drawn on the map; shape and "!" carry it, not colour alone. */
export type NavCaution = {
  id: string;
  point: MapPoint;
  severity: "low" | "medium" | "high" | "blocked";
};

/** Warning triangle centred on its point; shared by both map renderers. */
export const CAUTION_PATH = "M0-13 12 8H-12Z";

const MAX_ZOOM = 17;
const MIN_ZOOM = 11;
const YANGON = { latitude: 16.8007, longitude: 96.15 };

export type RiderNavMapProps = Parameters<typeof OsmRiderNavMap>[0] & {
  /** Mapbox road route. When absent, the straight-line fallback is drawn. */
  road?: RoadRoute | null;
};

/** Mapbox when a token is configured; the OSM tile map otherwise. */
export function RiderNavMap({ road = null, ...props }: RiderNavMapProps) {
  return hasMapbox ? (
    <MapboxRiderNavMap {...props} road={road} />
  ) : (
    <OsmRiderNavMap {...props} />
  );
}

function fitZoom(
  points: MapPoint[],
  size: { width: number; height: number },
  padding: { x: number; top: number; bottom: number },
) {
  if (points.length < 2 || !size.width || !size.height) return 16;
  const base = 16;
  const projected = points.map((point) => toWorldPixel(point, base));
  const width =
    Math.max(...projected.map((p) => p.x)) -
    Math.min(...projected.map((p) => p.x));
  const height =
    Math.max(...projected.map((p) => p.y)) -
    Math.min(...projected.map((p) => p.y));
  const fit = Math.min(
    (size.width - padding.x * 2) / Math.max(1, width),
    (size.height - padding.top - padding.bottom) / Math.max(1, height),
  );
  return Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, Math.floor(base + Math.log2(fit))),
  );
}

/**
 * Full-bleed rider map. Draws a direct line from the rider to the next target —
 * Oern has no street-routing service yet, so the line is never presented as a road route.
 */
function OsmRiderNavMap({
  driver,
  heading,
  target,
  stops,
  padding = { x: 48, top: 150, bottom: 300 },
  targetId = null,
  routeThroughStops = false,
  interactive = true,
  label,
  upcoming = [],
  cautions = [],
}: {
  driver: MapPoint | null;
  heading: number | null;
  target: (MapPoint & { kind: "pickup" | "dropoff" }) | null;
  stops: NavStop[];
  /** Points after the target, drawn lighter so the current leg stays the focus. */
  upcoming?: MapPoint[];
  cautions?: NavCaution[];
  padding?: { x: number; top: number; bottom: number };
  /** Order whose leg is the target; its matching stop marker is replaced by the target pin. */
  targetId?: string | null;
  routeThroughStops?: boolean;
  interactive?: boolean;
  label: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoomShift, setZoomShift] = useState(0);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const focusPoints = useMemo(() => {
    const points: MapPoint[] = [];
    if (driver) points.push(driver);
    if (routeThroughStops)
      for (const stop of stops)
        if (stop.state !== "done") points.push(stop.point);
    if (target) points.push(target);
    if (!points.length) for (const stop of stops) points.push(stop.point);
    return points;
  }, [driver, routeThroughStops, stops, target]);

  const fittedZoom = fitZoom(focusPoints, size, padding);
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fittedZoom + zoomShift));
  const isRecentred = pan.x === 0 && pan.y === 0 && zoomShift === 0;

  // Centre on the fitted points, nudged so they sit in the visible band between overlays.
  const center = useMemo(() => {
    if (!focusPoints.length) return YANGON;
    const projected = focusPoints.map((point) => toWorldPixel(point, 20));
    const x =
      (Math.min(...projected.map((p) => p.x)) +
        Math.max(...projected.map((p) => p.x))) /
      2;
    const y =
      (Math.min(...projected.map((p) => p.y)) +
        Math.max(...projected.map((p) => p.y))) /
      2;
    const scale = TILE_SIZE * 2 ** 20;
    return {
      longitude: (x / scale) * 360 - 180,
      latitude:
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI,
    };
  }, [focusPoints]);

  const bandShift = (padding.bottom - padding.top) / 2;
  const centerWorld = toWorldPixel(center, zoom);
  const viewWorld = {
    x: centerWorld.x - pan.x,
    y: centerWorld.y + bandShift - pan.y,
  };
  const tiles = tilesFor(viewWorld, size, zoom);
  const project = (point: MapPoint) => {
    const p = pointAt(point, center, size, zoom);
    return { x: p.x + pan.x, y: p.y - bandShift + pan.y };
  };

  const driverPos = driver ? project(driver) : null;
  const targetPos = target ? project(target) : null;
  const routePoints = [
    ...(driverPos ? [driverPos] : []),
    ...(routeThroughStops
      ? stops
          .filter((stop) => stop.state === "current" || stop.state === "queued")
          .map((stop) => project(stop.point))
      : targetPos
        ? [targetPos]
        : []),
  ];
  const routePath =
    routePoints.length > 1
      ? routePoints
          .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" ")
      : null;

  const upcomingPath =
    targetPos && upcoming.length
      ? [targetPos, ...upcoming.map((point) => project(point))]
          .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" ")
      : null;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    drag.current = { ...start, x: event.clientX, y: event.clientY };
    setPan((previous) => ({ x: previous.x + dx, y: previous.y + dy }));
  }
  function endDrag() {
    drag.current = null;
  }
  function changeZoom(step: number) {
    // Keep the point under the viewport centre fixed while zooming.
    setPan((previous) => ({
      x: previous.x * 2 ** step,
      y: previous.y * 2 ** step,
    }));
    setZoomShift((previous) => previous + step);
  }

  return (
    <div className="rnav-map" aria-label={label} role="img">
      <div
        ref={viewport}
        className={`rnav-viewport ${interactive ? "is-interactive" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="rnav-tiles" aria-hidden="true">
          {tiles.map((tile) => (
            <div
              key={`${zoom}-${tile.x}-${tile.y}`}
              className="rnav-tile"
              style={{
                transform: `translate(${tile.left}px, ${tile.top}px)`,
                backgroundImage: `url(${tile.src})`,
              }}
            />
          ))}
        </div>
        {size.width > 0 && (
          <svg
            className="rnav-overlay"
            viewBox={`0 0 ${size.width} ${size.height}`}
            aria-hidden="true"
          >
            {upcomingPath && (
              <path className="rnav-route-upcoming" d={upcomingPath} />
            )}
            {routePath && (
              <>
                <path className="rnav-route-casing" d={routePath} />
                <path className="rnav-route" d={routePath} />
              </>
            )}
            {cautions.map((caution) => {
              const p = project(caution.point);
              return (
                <g
                  key={caution.id}
                  className={`rnav-caution rnav-caution-${caution.severity}`}
                  transform={`translate(${p.x} ${p.y})`}
                >
                  <path d={CAUTION_PATH} />
                  <text y="5">!</text>
                </g>
              );
            })}
            {stops.map((stop) => {
              if (
                targetPos &&
                target &&
                stop.id === targetId &&
                stop.kind === target.kind
              )
                return null;
              const p = project(stop.point);
              if (stop.kind === "pickup")
                return (
                  <circle
                    key={`${stop.id}-pickup`}
                    className="rnav-origin"
                    cx={p.x}
                    cy={p.y}
                    r="7"
                  />
                );
              return (
                <g
                  key={`${stop.id}-${stop.kind}`}
                  className={`rnav-stop rnav-stop-${stop.state}`}
                  transform={`translate(${p.x} ${p.y})`}
                >
                  <circle r="13" />
                  {stop.state === "done" ? (
                    <path d="m-5 0 3.5 3.5L5-3.5" />
                  ) : stop.state === "failed" ? (
                    <path d="m-4-4 8 8m0-8-8 8" />
                  ) : (
                    <text y="4.5">{stop.number}</text>
                  )}
                </g>
              );
            })}
            {target && targetPos && (
              <g
                className={`rnav-target rnav-target-${target.kind}`}
                transform={`translate(${targetPos.x} ${targetPos.y})`}
              >
                <path
                  className="rnav-target-pin"
                  d="M0 0c-2.6-6.4-13-12.6-13-23a13 13 0 0 1 26 0C13-12.6 2.6-6.4 0 0Z"
                />
                {target.kind === "pickup" ? (
                  <path
                    className="rnav-target-glyph"
                    d="M-5.5-27h11v8.5h-11zM-5.5-27l2-3h7l2 3"
                  />
                ) : (
                  <circle className="rnav-target-dot" cy="-23" r="4.2" />
                )}
              </g>
            )}
            {driverPos && (
              <g
                className="rnav-driver"
                transform={`translate(${driverPos.x} ${driverPos.y})`}
              >
                <circle className="rnav-driver-halo" r="24" />
                {heading != null && (
                  <path
                    className="rnav-driver-cone"
                    transform={`rotate(${heading})`}
                    d="M0 0-15-36A39 39 0 0 1 15-36Z"
                  />
                )}
                <circle className="rnav-driver-body" r="15" />
                <path
                  className="rnav-driver-arrow"
                  transform={`rotate(${heading ?? 0})`}
                  d={
                    heading == null
                      ? "M0-5a5 5 0 1 1 0 10A5 5 0 0 1 0-5Z"
                      : "M0-9.5 7 7.5 0 3.5-7 7.5Z"
                  }
                />
              </g>
            )}
          </svg>
        )}
      </div>
      {interactive && (
        <div className="rnav-zoom">
          <button
            type="button"
            className="rnav-fab"
            onClick={() => changeZoom(1)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <Icon name="plus" size={20} />
          </button>
          <button
            type="button"
            className="rnav-fab"
            onClick={() => changeZoom(-1)}
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
            className={`rnav-fab rnav-fab-large ${isRecentred ? "" : "is-off-centre"}`}
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setZoomShift(0);
            }}
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
      <span className="rnav-attribution">© OpenStreetMap</span>
    </div>
  );
}
