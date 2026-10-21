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
import {
  CAUTION_PATH,
  type NavCaution,
  type NavStop,
  type RiderNavMapProps,
} from "@/components/delivery/rider-nav-map";
import { haversineKilometers } from "@/lib/delivery/intelligence";
import type { MapPoint } from "@/lib/delivery/map-projection";

const MAX_ZOOM = 17;
/** Navigation view: close enough to read the next turn, tilted ahead. */
const FOLLOW_ZOOM = 16.6;
const FOLLOW_PITCH = 55;
/** Driver auto-recenter timeout: resets to turn guidance if untouched for 7s. */
const AUTO_RECENTER_TIMEOUT_MS = 7000;
/** Vehicle movement threshold: if driver moves > 35m while browsing, auto-recenter immediately. */
const AUTO_RECENTER_MOVEMENT_KM = 0.035;

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

function cautionMarker(severity: NavCaution["severity"]) {
  return svgMarker(
    `<g class="rnav-caution rnav-caution-${severity}"><path d="${CAUTION_PATH}"/><text y="5">!</text></g>`,
    30,
    "-15 -15 30 30",
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

/**
 * The rider's own marker always points "up" in its own frame; the marker is
 * rotated to the heading in map space, so it keeps pointing the right way
 * whether the map is north-up or turned to the rider's direction.
 */
function driverMarker() {
  return svgMarker(
    `<g class="rnav-driver"><circle class="rnav-driver-halo" r="24"/><path class="rnav-driver-cone" d="M0 0-15-36A39 39 0 0 1 15-36Z"/><circle class="rnav-driver-body" r="15"/><path class="rnav-driver-arrow" d="M0-9.5 7 7.5 0 3.5-7 7.5Z"/></g>`,
    80,
    "-40 -40 80 80",
  );
}

/**
 * Rider map on Mapbox GL. In `follow` mode the camera trails the rider with
 * the map turned to their heading and tilted for active navigation;
 * dragging or rotating hands control back until "Re-centre" is pressed.
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
  follow = false,
  label,
  road = null,
  upcoming = [],
  cautions = [],
}: RiderNavMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapState = useMapboxMap(container, interactive);
  const [moved, setMoved] = useState(false);
  const driverMarkerRef = useRef<MapboxMarker | null>(null);
  const followedOnce = useRef(false);
  const recenteringRef = useRef(false);
  const panStartDriverPos = useRef<MapPoint | null>(null);
  const lastInteractionTime = useRef<number>(0);
  const map = mapState?.map ?? null;
  const gl: MapboxGl | null = mapState?.gl ?? null;
  const following = follow && driver != null;

  const focus: MapPoint[] = [];
  if (driver) focus.push(driver);
  if (routeThroughStops)
    for (const stop of stops) if (stop.state !== "done") focus.push(stop.point);
  if (target) focus.push(target);
  if (!focus.length) for (const stop of stops) focus.push(stop.point);
  const focusKey = focus.map((point) => `${point.longitude},${point.latitude}`);

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

  // Taking over the map (drag, rotate, tilt, zoom) stops the camera following.
  useEffect(() => {
    if (!map) return;
    // Only gestures carry an originalEvent; the camera's own easing does not.
    const onUser = (event: object) => {
      if ("originalEvent" in event && event.originalEvent) {
        lastInteractionTime.current = Date.now();
        setMoved(true);
      }
    };
    map.on("dragstart", onUser);
    map.on("rotatestart", onUser);
    map.on("pitchstart", onUser);
    map.on("zoomstart", onUser);
    map.on("drag", onUser);
    return () => {
      map.off("dragstart", onUser);
      map.off("rotatestart", onUser);
      map.off("pitchstart", onUser);
      map.off("zoomstart", onUser);
      map.off("drag", onUser);
    };
  }, [map]);

  // Auto-recenter timer: if the rider leaves the map alone while in follow
  // mode, smoothly restore turn guidance after 7 seconds of inactivity.
  useEffect(() => {
    if (!following || !moved) return;
    const interval = setInterval(() => {
      if (Date.now() - lastInteractionTime.current >= AUTO_RECENTER_TIMEOUT_MS) {
        recenteringRef.current = true;
        setMoved(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [following, moved]);

  // Record driver location when manual map panning begins.
  useEffect(() => {
    if (moved) {
      if (!panStartDriverPos.current && driver) {
        panStartDriverPos.current = {
          latitude: driver.latitude,
          longitude: driver.longitude,
        };
      }
    } else {
      panStartDriverPos.current = null;
    }
  }, [moved, driver]);

  // Vehicle movement threshold: if the rider starts traveling again while
  // browsing, immediately snap back to navigation guidance so they don't ride unguided.
  useEffect(() => {
    if (!following || !moved || !driver || !panStartDriverPos.current) return;
    const distKm = haversineKilometers(panStartDriverPos.current, driver);
    if (distKm >= AUTO_RECENTER_MOVEMENT_KM) {
      recenteringRef.current = true;
      setMoved(false);
    }
  }, [following, moved, driver]);

  // Overview: north-up, flat, everything in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusKey tracks focus
  useEffect(() => {
    if (!map || following || moved || !focusKey.length) return;
    followedOnce.current = false;
    map.easeTo({ bearing: 0, pitch: 0, duration: 0 });
    fitToPoints(
      map,
      focus,
      { x: padding.x, top: padding.top, bottom: padding.bottom },
      MAX_ZOOM,
    );
  }, [
    map,
    following,
    moved,
    focusKey.join("|"),
    padding.x,
    padding.top,
    padding.bottom,
  ]);

  // Navigation: keep the rider in the open band between the cards, turn the
  // map to their heading, and tilt it so the road ahead fills the screen.
  const driverLng = driver?.longitude;
  const driverLat = driver?.latitude;
  const turn = heading == null ? null : Math.round(heading / 4) * 4;
  useEffect(() => {
    if (!map || !following || moved) return;
    if (driverLng == null || driverLat == null) return;
    const isRecentering = recenteringRef.current;
    map.easeTo({
      center: [driverLng, driverLat],
      bearing: turn ?? map.getBearing(),
      pitch: FOLLOW_PITCH,
      ...(!followedOnce.current || isRecentering ? { zoom: FOLLOW_ZOOM } : {}),
      padding: {
        top: padding.top,
        bottom: padding.bottom,
        left: padding.x,
        right: padding.x,
      },
      duration: isRecentering ? 1000 : followedOnce.current ? 900 : 1400,
      essential: true,
    });
    followedOnce.current = true;
    recenteringRef.current = false;
  }, [
    map,
    following,
    moved,
    driverLng,
    driverLat,
    turn,
    padding.top,
    padding.bottom,
    padding.x,
  ]);

  // Back to the overview (or off to another screen) clears manual control.
  useEffect(() => {
    if (!follow) {
      setMoved(false);
      recenteringRef.current = false;
      panStartDriverPos.current = null;
    }
  }, [follow]);

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
    if (!map || !gl) return;
    const markers = cautions.map((caution) =>
      new gl.Marker({
        element: cautionMarker(caution.severity),
        anchor: "center",
      })
        .setLngLat(lngLat(caution.point))
        .addTo(map),
    );
    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [map, gl, cautions]);

  // One rider marker, moved and turned in place so it glides with the camera.
  useEffect(() => {
    if (!map || !gl || driverLng == null || driverLat == null) return;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new gl.Marker({
        element: driverMarker(),
        anchor: "center",
        rotationAlignment: "map",
        pitchAlignment: "map",
      })
        .setLngLat([driverLng, driverLat])
        .addTo(map);
    }
    driverMarkerRef.current
      .setLngLat([driverLng, driverLat])
      .setRotation(heading ?? 0);
  }, [map, gl, driverLng, driverLat, heading]);
  useEffect(
    () => () => {
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;
    },
    [],
  );

  const upcomingCoordinates =
    target && upcoming.length
      ? [lngLat(target), ...upcoming.map((point) => lngLat(point))]
      : [];

  useEffect(() => {
    if (!map) return;
    const palette = mapPalette(prefersDark());
    // Later legs first, so the current leg draws on top of them.
    drawLines(map, "rnav-route-upcoming", [upcomingCoordinates], {
      color: palette.origin,
      width: 4,
      dash: [1.5, 1.5],
    });
    drawLines(map, "rnav-route-casing", road ? [routeCoordinates] : [], {
      color: palette.casing,
      width: 11,
    });
    drawLines(
      map,
      "rnav-route",
      [routeCoordinates],
      road
        ? { color: palette.route, width: 6 }
        : { color: palette.origin, width: 4, dash: [1.5, 1.5] },
    );
  }, [map, routeCoordinates, upcomingCoordinates, road]);

  const handleRecenter = () => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(12);
      }
    } catch {
      // Haptics optional on unsupported hardware
    }
    recenteringRef.current = true;
    setMoved(false);
  };

  return (
    <div className="rnav-map" aria-label={label} role="img">
      <div
        ref={container}
        className={`rnav-viewport ${interactive ? "is-interactive" : ""}`}
      />
      {interactive && moved && (
        <button
          type="button"
          className="rnav-recenter"
          onClick={handleRecenter}
          aria-label="Re-centre navigation on your location"
        >
          <Icon name="navigation" size={18} /> Re-centre
        </button>
      )}
    </div>
  );
}
