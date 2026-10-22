import { ALL_YANGON_INTERCEPTION_POINTS } from "./data/yangon-interception-points.ts";
import { YANGON_TRAFFIC_SIGNALS } from "./energy-routing.ts";

/** A signalised junction a vehicle may have to stop at. */
export type SignalNode = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  estimatedCycleSeconds: number;
};

export type SignalHit = {
  node: SignalNode;
  /** Closest approach of the path to the signal, in kilometres. */
  distanceKm: number;
  /** Distance travelled along the path when it passes the signal. */
  alongKm: number;
};

export type SignalIndex = {
  cellDeg: number;
  cells: Map<string, SignalNode[]>;
};

const KM_PER_DEG_LAT = 111.32;
/** A hand-mapped light this close to an arterial signal is the same junction. */
const SAME_JUNCTION_KM = 0.12;
/** Matches how far a route may pass from a light and still wait at it. */
export const SIGNAL_MATCH_KM = 0.045;

const cellKey = (x: number, y: number) => `${x},${y}`;

export function buildSignalIndex(
  nodes: readonly SignalNode[],
  cellDeg = 0.002,
): SignalIndex {
  const cells = new Map<string, SignalNode[]>();
  for (const node of nodes) {
    const key = cellKey(
      Math.floor(node.longitude / cellDeg),
      Math.floor(node.latitude / cellDeg),
    );
    const bucket = cells.get(key);
    if (bucket) bucket.push(node);
    else cells.set(key, [node]);
  }
  return { cellDeg, cells };
}

/** Red-light wait plus slow-down and pull-away, in minutes. */
export function signalDelayMin(estimatedCycleSeconds: number) {
  return Math.max(0.5, (estimatedCycleSeconds * 0.55) / 60 + 0.2);
}

/**
 * Hand-mapped traffic lights plus the arterial signal list, with junctions
 * that appear in both counted once (the hand-mapped position wins).
 */
export function mergeSignalNodes(
  lights: readonly {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    estimatedCycleSeconds: number;
    type?: string;
  }[],
  signals: readonly {
    name: string;
    latitude: number;
    longitude: number;
    estimatedCycleSeconds: number;
  }[],
): SignalNode[] {
  const nodes: SignalNode[] = lights
    .filter(
      (light) => light.type === undefined || light.type === "traffic_light",
    )
    .map(({ id, name, latitude, longitude, estimatedCycleSeconds }) => ({
      id,
      name,
      latitude,
      longitude,
      estimatedCycleSeconds,
    }));
  const lightIndex = buildSignalIndex(nodes);
  for (const signal of signals) {
    const duplicate = nearestInIndex(lightIndex, signal, SAME_JUNCTION_KM);
    if (duplicate) continue;
    nodes.push({ id: `sig:${signal.name}`, ...signal });
  }
  return nodes;
}

function nearestInIndex(
  index: SignalIndex,
  point: { latitude: number; longitude: number },
  radiusKm: number,
): SignalNode | null {
  const cosLat = Math.cos((point.latitude * Math.PI) / 180);
  const radiusLat = radiusKm / KM_PER_DEG_LAT;
  const radiusLng = radiusKm / (KM_PER_DEG_LAT * cosLat);
  const { cellDeg } = index;
  let best: SignalNode | null = null;
  let bestKm = radiusKm;
  for (
    let x = Math.floor((point.longitude - radiusLng) / cellDeg);
    x <= Math.floor((point.longitude + radiusLng) / cellDeg);
    x++
  ) {
    for (
      let y = Math.floor((point.latitude - radiusLat) / cellDeg);
      y <= Math.floor((point.latitude + radiusLat) / cellDeg);
      y++
    ) {
      for (const node of index.cells.get(cellKey(x, y)) ?? []) {
        const dx = (node.longitude - point.longitude) * cosLat * KM_PER_DEG_LAT;
        const dy = (node.latitude - point.latitude) * KM_PER_DEG_LAT;
        const km = Math.hypot(dx, dy);
        if (km <= bestKm) {
          bestKm = km;
          best = node;
        }
      }
    }
  }
  return best;
}

let defaultNodes: SignalNode[] | null = null;
let defaultIndex: SignalIndex | null = null;

/** Every known signal in Yangon with duplicates merged. */
export function defaultSignalNodes(): readonly SignalNode[] {
  defaultNodes ??= mergeSignalNodes(
    ALL_YANGON_INTERCEPTION_POINTS,
    YANGON_TRAFFIC_SIGNALS,
  );
  return defaultNodes;
}
const customIndexes = new WeakMap<object, WeakMap<object, SignalIndex>>();

/** Index of every known signal in Yangon, built once. */
export function defaultSignalIndex(): SignalIndex {
  defaultIndex ??= buildSignalIndex([...defaultSignalNodes()]);
  return defaultIndex;
}

/** Index for caller-supplied lists, cached per pair of array identities. */
export function signalIndexFor(
  lights: readonly object[] | undefined,
  signals: readonly object[] | undefined,
): SignalIndex {
  if (!lights && !signals) return defaultSignalIndex();
  const lightKey = lights ?? ALL_YANGON_INTERCEPTION_POINTS;
  const signalKey = signals ?? YANGON_TRAFFIC_SIGNALS;
  let bySignal = customIndexes.get(lightKey);
  if (!bySignal) {
    bySignal = new WeakMap();
    customIndexes.set(lightKey, bySignal);
  }
  let index = bySignal.get(signalKey);
  if (!index) {
    index = buildSignalIndex(
      mergeSignalNodes(
        lightKey as Parameters<typeof mergeSignalNodes>[0],
        signalKey as Parameters<typeof mergeSignalNodes>[1],
      ),
    );
    bySignal.set(signalKey, index);
  }
  return index;
}

/**
 * Every signal within `radiusKm` of a polyline of [longitude, latitude] pairs,
 * in the order the path reaches them. Checks each segment, not just the
 * vertices, so sparse geometry cannot slip past a light; a grid keeps the
 * work proportional to the path length instead of the number of signals.
 */
export function signalsAlongPath(
  index: SignalIndex,
  coordinates: readonly (readonly [number, number])[],
  radiusKm = SIGNAL_MATCH_KM,
): SignalHit[] {
  if (coordinates.length === 0 || index.cells.size === 0) return [];
  const { cellDeg } = index;
  const cosLat = Math.cos((coordinates[0][1] * Math.PI) / 180);
  const kmPerDegLng = KM_PER_DEG_LAT * cosLat;
  const padLat = radiusKm / KM_PER_DEG_LAT;
  const padLng = radiusKm / kmPerDegLng;
  const best = new Map<SignalNode, SignalHit>();
  let travelled = 0;

  const visit = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    segmentStartKm: number,
  ) => {
    const dxKm = (bx - ax) * kmPerDegLng;
    const dyKm = (by - ay) * KM_PER_DEG_LAT;
    const lengthSq = dxKm * dxKm + dyKm * dyKm;
    const x0 = Math.floor((Math.min(ax, bx) - padLng) / cellDeg);
    const x1 = Math.floor((Math.max(ax, bx) + padLng) / cellDeg);
    const y0 = Math.floor((Math.min(ay, by) - padLat) / cellDeg);
    const y1 = Math.floor((Math.max(ay, by) + padLat) / cellDeg);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const bucket = index.cells.get(cellKey(x, y));
        if (!bucket) continue;
        for (const node of bucket) {
          const pxKm = (node.longitude - ax) * kmPerDegLng;
          const pyKm = (node.latitude - ay) * KM_PER_DEG_LAT;
          const t =
            lengthSq === 0
              ? 0
              : Math.max(
                  0,
                  Math.min(1, (pxKm * dxKm + pyKm * dyKm) / lengthSq),
                );
          const distanceKm = Math.hypot(pxKm - t * dxKm, pyKm - t * dyKm);
          if (distanceKm > radiusKm) continue;
          const known = best.get(node);
          if (!known || distanceKm < known.distanceKm) {
            best.set(node, {
              node,
              distanceKm,
              alongKm: segmentStartKm + t * Math.sqrt(lengthSq),
            });
          }
        }
      }
    }
  };

  if (coordinates.length === 1) {
    visit(
      coordinates[0][0],
      coordinates[0][1],
      coordinates[0][0],
      coordinates[0][1],
      0,
    );
  }
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [ax, ay] = coordinates[i];
    const [bx, by] = coordinates[i + 1];
    visit(ax, ay, bx, by, travelled);
    travelled += Math.hypot(
      (bx - ax) * kmPerDegLng,
      (by - ay) * KM_PER_DEG_LAT,
    );
  }
  return [...best.values()].sort((a, b) => a.alongKm - b.alongKm);
}

/**
 * Shortest distance from a point to a polyline of [longitude, latitude]
 * pairs, in kilometres, checking every segment rather than only the vertices.
 */
export function distanceToPathKm(
  coordinates: readonly (readonly [number, number])[],
  point: { latitude: number; longitude: number },
): number {
  if (coordinates.length === 0) return Number.POSITIVE_INFINITY;
  const kmPerDegLng =
    KM_PER_DEG_LAT * Math.cos((point.latitude * Math.PI) / 180);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < Math.max(1, coordinates.length - 1); i++) {
    const [ax, ay] = coordinates[i];
    const [bx, by] = coordinates[Math.min(i + 1, coordinates.length - 1)];
    const dx = (bx - ax) * kmPerDegLng;
    const dy = (by - ay) * KM_PER_DEG_LAT;
    const px = (point.longitude - ax) * kmPerDegLng;
    const py = (point.latitude - ay) * KM_PER_DEG_LAT;
    const lengthSq = dx * dx + dy * dy;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSq));
    best = Math.min(best, Math.hypot(px - t * dx, py - t * dy));
  }
  return best;
}
