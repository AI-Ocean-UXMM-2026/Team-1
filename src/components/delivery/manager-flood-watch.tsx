"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import {
  fetchLiveFloodConditions,
  type LiveFloodConditions,
} from "@/lib/delivery/dispatch/open-meteo";
import {
  type FloodHazardClass,
  type FloodZone,
  pointInPolygon,
} from "@/lib/delivery/flood-zones";
import "./manager-flood-watch.css";

export type FloodPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: "request" | "task";
};

const HAZARD_LABELS: Record<FloodHazardClass, string> = {
  1: "Class 1 · 10–25 cm",
  2: "Class 2 · 25–50 cm",
  3: "Class 3 · over 50 cm",
};

const CONDITION_LABELS: Record<string, string> = {
  clear: "Clear",
  light_rain: "Light rain",
  heavy_rain: "Heavy rain",
  flood_risk: "Flood risk",
};

/** Highest-hazard zone containing the point, if any. */
export function floodZoneAt(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  zones: FloodZone[],
): FloodZone | null {
  if (latitude == null || longitude == null) return null;
  let found: FloodZone | null = null;
  for (const zone of zones) {
    if (
      pointInPolygon(latitude, longitude, zone.coordinates) &&
      (!found || zone.hazardClass > found.hazardClass)
    ) {
      found = zone;
    }
  }
  return found;
}

const WIDTH = 520;
const HEIGHT = 300;
const PAD = 16;

export function FloodWatch({
  zones,
  points,
}: {
  zones: FloodZone[];
  points: FloodPoint[];
}) {
  const [live, setLive] = useState<LiveFloodConditions | null>(null);
  const [liveFailed, setLiveFailed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLiveFloodConditions({ lat: 16.8007, lng: 96.15 })
      .then((conditions) => {
        if (cancelled) return;
        if (conditions) setLive(conditions);
        else setLiveFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLiveFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => {
    const all: [number, number][] = [
      ...zones.flatMap((zone) => zone.coordinates),
      ...points.map(
        (point) => [point.longitude, point.latitude] as [number, number],
      ),
    ];
    const lngs = all.map(([lng]) => lng);
    const lats = all.map(([, lat]) => lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    // Keep real proportions: one degree of longitude is shorter than one of latitude.
    const lngScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = Math.max((maxLng - minLng) * lngScale, 0.001);
    const spanY = Math.max(maxLat - minLat, 0.001);
    const scale = Math.min(
      (WIDTH - PAD * 2) / spanX,
      (HEIGHT - PAD * 2) / spanY,
    );
    const offsetX = (WIDTH - spanX * scale) / 2;
    const offsetY = (HEIGHT - spanY * scale) / 2;
    return {
      x: (lng: number) => offsetX + (lng - minLng) * lngScale * scale,
      y: (lat: number) => HEIGHT - offsetY - (lat - minLat) * scale,
    };
  }, [zones, points]);

  const hit = useMemo(
    () =>
      points.map((point) => ({
        point,
        zone: floodZoneAt(point.latitude, point.longitude, zones),
      })),
    [points, zones],
  );
  const exposed = hit.filter((item) => item.zone);
  const active = zones.find((zone) => zone.id === activeId) ?? null;
  const severity = live
    ? (CONDITION_LABELS[live.severity] ?? live.severity)
    : null;

  return (
    <section className="flood-watch" aria-labelledby="flood-watch-title">
      <header className="flood-watch-head">
        <h2 id="flood-watch-title">Flood watch</h2>
        <p
          className="flood-live"
          data-severity={live?.severity ?? "unknown"}
          aria-live="polite"
        >
          {live ? (
            <>
              <strong>{severity}</strong>
              <span>
                {live.rainMm.toFixed(1)} mm rain
                {live.riverDischargeM3s != null
                  ? ` · river ${live.riverDischargeM3s.toFixed(1)} m³/s`
                  : ""}
                {live.suggestedSlowdown > 0
                  ? ` · add ${Math.round(live.suggestedSlowdown * 100)}% travel time`
                  : ""}
              </span>
            </>
          ) : (
            <span>
              {liveFailed
                ? "Live conditions unavailable. Showing mapped zones only."
                : "Checking live conditions…"}
            </span>
          )}
        </p>
      </header>

      <div className="flood-watch-body">
        <figure className="flood-map">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Flood zones with ${exposed.length} of ${points.length} drop-offs inside a mapped zone`}
          >
            {[...zones]
              .sort((a, b) => a.hazardClass - b.hazardClass)
              .map((zone) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: SVG polygon hover highlight
                <polygon
                  key={zone.id}
                  className="flood-zone"
                  data-class={zone.hazardClass}
                  data-active={zone.id === activeId || undefined}
                  points={zone.coordinates
                    .map(([lng, lat]) => `${view.x(lng)},${view.y(lat)}`)
                    .join(" ")}
                  onMouseEnter={() => setActiveId(zone.id)}
                  onMouseLeave={() => setActiveId(null)}
                />
              ))}
            {hit.map(({ point, zone }) => (
              <g
                key={`${point.kind}-${point.id}`}
                transform={`translate(${view.x(point.longitude)} ${view.y(point.latitude)})`}
                className="flood-point"
                data-kind={point.kind}
                data-exposed={zone ? "true" : undefined}
              >
                <title>
                  {point.label}
                  {zone ? ` · inside ${zone.name}` : ""}
                </title>
                {zone && <circle className="flood-point-ring" r="11" />}
                {point.kind === "request" ? (
                  <circle r="5" />
                ) : (
                  <rect x="-5" y="-5" width="10" height="10" rx="2" />
                )}
              </g>
            ))}
          </svg>
          <figcaption>
            <ul className="flood-legend">
              {([1, 2, 3] as FloodHazardClass[]).map((level) => (
                <li key={level} data-class={level}>
                  {HAZARD_LABELS[level]}
                </li>
              ))}
              <li className="flood-legend-point">
                <svg width="10" height="10" aria-hidden="true">
                  <circle cx="5" cy="5" r="5" />
                </svg>
                Request
              </li>
              <li className="flood-legend-point" data-kind="task">
                <svg width="10" height="10" aria-hidden="true">
                  <rect width="10" height="10" rx="2" />
                </svg>
                Task
              </li>
            </ul>
            <span className="flood-zone-readout">
              {active
                ? `${active.name} · ${active.waterDepthEstimateCm} cm est. · ${active.advisory}`
                : "Hover a zone for its advisory."}
            </span>
          </figcaption>
        </figure>

        <div className="flood-exposure">
          <h3>
            {exposed.length
              ? `${exposed.length} of ${points.length} in flood zones`
              : "Nothing in a flood zone"}
          </h3>
          {exposed.length ? (
            <ul>
              {exposed.map(({ point, zone }) => (
                <li
                  key={`${point.kind}-${point.id}`}
                  data-class={zone?.hazardClass}
                >
                  <Icon name="flood" size={16} />
                  <span>
                    <strong>{point.label}</strong>
                    {zone?.name}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Requests and tasks with a mapped drop-off are checked against{" "}
              {zones.length} monitored zones.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
