import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { type RefObject, useEffect, useState } from "react";

import type { MapPoint } from "@/lib/delivery/map-projection";
import { MAPBOX_TOKEN, mapStyle } from "@/lib/delivery/mapbox";

import "./mapbox-map.css";

export type Coordinate = [number, number];
export type MapboxGl = Awaited<ReturnType<typeof loadMapbox>>;

const YANGON = { latitude: 16.8007, longitude: 96.15 };

/** mapbox-gl is large, so it loads only in the browser, on first map mount. */
export async function loadMapbox() {
  const { default: mapboxgl } = await import("mapbox-gl");
  mapboxgl.accessToken = MAPBOX_TOKEN;
  return mapboxgl;
}

/** Route colours from DESIGN.md §6.3 (map tokens). */
export function mapPalette() {
  return {
    route: "#2563EB",
    casing: "#FFFFFF",
    driver: "#172B4D",
    driverCasing: "#FFFFFF",
    destination: "#C2410C",
    origin: "#64748B",
    completed: "#16A34A",
    alert: "#DC2626",
  };
}

export function lngLat(point: MapPoint): Coordinate {
  return [point.longitude, point.latitude];
}

/**
 * Creates the map once and reports it when the style has loaded.
 * `null` until then; callers draw nothing before that.
 */
export function useMapboxMap(
  container: RefObject<HTMLDivElement | null>,
  interactive: boolean,
) {
  const [state, setState] = useState<{
    map: MapboxMap;
    gl: MapboxGl;
  } | null>(null);

  useEffect(() => {
    let map: MapboxMap | null = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;
    loadMapbox().then((gl) => {
      if (cancelled || !container.current) return;
      map = new gl.Map({
        container: container.current,
        style: mapStyle(),
        center: lngLat(YANGON),
        zoom: 14,
        interactive,
        attributionControl: true,
      });
      const created = map;
      // The container often settles after the map is created (full-screen
      // layouts, sheets); without this the canvas keeps its first size.
      observer = new ResizeObserver(() => created.resize());
      observer.observe(container.current);
      created.on("load", () => {
        if (!cancelled) setState({ map: created, gl });
      });
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      setState(null);
    };
  }, [container, interactive]);

  return state;
}

/** Fits the view to `points`, keeping room for the overlay bands. */
export function fitToPoints(
  map: MapboxMap,
  points: MapPoint[],
  padding: { x: number; top: number; bottom: number },
  maxZoom: number,
) {
  if (!points.length) return;
  if (points.length === 1) {
    map.easeTo({
      center: lngLat(points[0]),
      zoom: Math.min(maxZoom, 16),
      duration: 600,
    });
    return;
  }
  const longitudes = points.map((point) => point.longitude);
  const latitudes = points.map((point) => point.latitude);
  map.fitBounds(
    [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ],
    {
      padding: {
        top: padding.top,
        bottom: padding.bottom,
        left: padding.x,
        right: padding.x,
      },
      maxZoom,
      duration: 600,
    },
  );
}

type LineStyle = { color: string; width: number; dash?: number[] };

/**
 * Draws (or replaces) one GeoJSON line layer. Call only after the map has
 * loaded. Layers added later sit above earlier ones, so draw casings first.
 */
export function drawLines(
  map: MapboxMap,
  id: string,
  lines: Coordinate[][],
  style: LineStyle,
) {
  const data = {
    type: "FeatureCollection" as const,
    features: lines
      .filter((coordinates) => coordinates.length > 1)
      .map((coordinates) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates },
      })),
  };
  const source = map.getSource<GeoJSONSource>(id);
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(id, { type: "geojson", data });
  map.addLayer({
    id,
    type: "line",
    source: id,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": style.color,
      "line-width": style.width,
      ...(style.dash ? { "line-dasharray": style.dash } : {}),
    },
  });
}

export type PolygonFeature = {
  coordinates: Coordinate[][];
  properties?: Record<string, unknown>;
};

export type PolygonStyle = {
  fillColor: string;
  fillOpacity: number;
  lineColor?: string;
  lineWidth?: number;
  lineDash?: number[];
};

/**
 * Draws (or updates) a GeoJSON polygon fill and outline layer on the map.
 */
export function drawPolygons(
  map: MapboxMap,
  id: string,
  polygons: PolygonFeature[],
  style: PolygonStyle,
) {
  const data = {
    type: "FeatureCollection" as const,
    features: polygons.map((poly) => ({
      type: "Feature" as const,
      properties: poly.properties ?? {},
      geometry: {
        type: "Polygon" as const,
        coordinates: poly.coordinates,
      },
    })),
  };
  const source = map.getSource<GeoJSONSource>(id);
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(id, { type: "geojson", data });
  map.addLayer({
    id: `${id}-fill`,
    type: "fill",
    source: id,
    paint: {
      "fill-color": style.fillColor,
      "fill-opacity": style.fillOpacity,
    },
  });
  map.addLayer({
    id: `${id}-line`,
    type: "line",
    source: id,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": style.lineColor ?? style.fillColor,
      "line-width": style.lineWidth ?? 1.5,
      ...(style.lineDash ? { "line-dasharray": style.lineDash } : {}),
    },
  });
}

export function removePolygonLayers(map: MapboxMap, id: string) {
  if (map.getLayer(`${id}-fill`)) map.removeLayer(`${id}-fill`);
  if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
  if (map.getSource(id)) map.removeSource(id);
}

/**
 * A marker element holding a static SVG. Only pass literal markup or numbers
 * here; text from data goes in through `textContent` or attributes.
 */
export function svgMarker(
  inner: string,
  size: number,
  viewBox: string,
  asButton = false,
  ariaLabel?: string,
) {
  const element = document.createElement(asButton ? "button" : "div");
  if (asButton) {
    (element as HTMLButtonElement).type = "button";
    if (ariaLabel) {
      element.setAttribute("aria-label", ariaLabel);
    }
  }
  element.className = "mapbox-marker";
  element.innerHTML = `<svg width="${size}" height="${size}" viewBox="${viewBox}" aria-hidden="true" overflow="visible">${inner}</svg>`;
  return element;
}

/** A label that shows data safely as text, styled to read over the map. */
export function labelElement(text: string) {
  const label = document.createElement("span");
  label.className = "mapbox-marker-label";
  label.textContent = text;
  return label;
}
