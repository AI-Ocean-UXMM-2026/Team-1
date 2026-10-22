"use client";

import { Icon } from "@/components/delivery/icons";
import { MapboxRiderNavMap } from "@/components/delivery/mapbox-rider-nav-map";
import type { MapPoint } from "@/lib/delivery/map-projection";
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

/** Warning triangle centred on its point. */
export const CAUTION_PATH = "M0-13 12 8H-12Z";

export type RiderNavMapProps = {
  driver: MapPoint | null;
  /** Compass heading in degrees; the map turns to it while following. */
  heading: number | null;
  target: (MapPoint & { kind: "pickup" | "dropoff" }) | null;
  stops: NavStop[];
  /** Points after the target, drawn lighter so the current leg stays the focus. */
  upcoming?: MapPoint[];
  cautions?: NavCaution[];
  /** Room kept clear of the cards over the map. */
  padding?: { x: number; top: number; bottom: number };
  /** Order whose leg is the target; its stop marker is replaced by the pin. */
  targetId?: string | null;
  routeThroughStops?: boolean;
  interactive?: boolean;
  /**
   * Navigation mode: the camera follows the rider, tilted, with the map turned
   * so their heading points up once a trip starts.
   */
  follow?: boolean;
  label: string;
  /** Mapbox road route. When absent, a straight line to the target is drawn. */
  road?: RoadRoute | null;
};

/** The rider map runs on Mapbox only; without a token it says so plainly. */
export function RiderNavMap(props: RiderNavMapProps) {
  return hasMapbox ? (
    <MapboxRiderNavMap {...props} />
  ) : (
    <div
      className="rnav-map rnav-unavailable"
      role="img"
      aria-label={props.label}
    >
      <Icon name="location" size={28} />
      <strong>Map isn’t set up yet</strong>
      <span>Check the address below or call the recipient.</span>
      <small>Operations: add NEXT_PUBLIC_MAPBOX_TOKEN.</small>
    </div>
  );
}
