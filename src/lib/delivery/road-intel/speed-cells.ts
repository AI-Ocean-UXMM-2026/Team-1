import type { SpeedCell } from "./types.ts";

const CELL_DEG = 0.001;
const KM_PER_DEG_LAT = 111.32;
/** Length of road a cell stands for, roughly its width. */
const CELL_LENGTH_KM = 0.11;
/** Below this, riders are crawling rather than driving. */
export const CRAWL_KMH = 12;
/** What a free-running Yangon street allows. */
const FREE_FLOW_KMH = 28;

const keyOf = (latitude: number, longitude: number) =>
  `${Math.round(latitude / CELL_DEG)},${Math.round(longitude / CELL_DEG)}`;

export type SpeedGrid = Map<string, SpeedCell>;

export function buildSpeedGrid(cells: readonly SpeedCell[]): SpeedGrid {
  const grid: SpeedGrid = new Map();
  for (const cell of cells) {
    if (!Number.isFinite(cell.medianSpeedKmh) || cell.samples <= 0) continue;
    grid.set(keyOf(cell.latitude, cell.longitude), cell);
  }
  return grid;
}

/** Cells within `radiusKm` of a point, nearest first. */
export function speedCellsNear(
  grid: SpeedGrid,
  point: { latitude: number; longitude: number },
  radiusKm: number,
): SpeedCell[] {
  const reach = Math.ceil(radiusKm / (CELL_DEG * KM_PER_DEG_LAT)) + 1;
  const cx = Math.round(point.latitude / CELL_DEG);
  const cy = Math.round(point.longitude / CELL_DEG);
  const cosLat = Math.cos((point.latitude * Math.PI) / 180);
  const found: { cell: SpeedCell; km: number }[] = [];
  for (let x = cx - reach; x <= cx + reach; x++) {
    for (let y = cy - reach; y <= cy + reach; y++) {
      const cell = grid.get(`${x},${y}`);
      if (!cell) continue;
      const km = Math.hypot(
        (cell.latitude - point.latitude) * KM_PER_DEG_LAT,
        (cell.longitude - point.longitude) * KM_PER_DEG_LAT * cosLat,
      );
      if (km <= radiusKm) found.push({ cell, km });
    }
  }
  return found.sort((a, b) => a.km - b.km).map((entry) => entry.cell);
}

export type SlowdownSummary = {
  cells: number;
  samples: number;
  drivers: number;
  /** Sample-weighted median speed, or null when nobody drove there. */
  speedKmh: number | null;
};

/** What riders actually did near a point lately. */
export function observedSpeedNear(
  grid: SpeedGrid,
  point: { latitude: number; longitude: number },
  radiusKm: number,
): SlowdownSummary {
  const cells = speedCellsNear(grid, point, radiusKm);
  if (!cells.length)
    return { cells: 0, samples: 0, drivers: 0, speedKmh: null };
  const samples = cells.reduce((sum, cell) => sum + cell.samples, 0);
  const drivers = Math.max(...cells.map((cell) => cell.drivers));
  const speedKmh =
    cells.reduce((sum, cell) => sum + cell.medianSpeedKmh * cell.samples, 0) /
    samples;
  return {
    cells: cells.length,
    samples,
    drivers,
    speedKmh: Math.round(speedKmh * 10) / 10,
  };
}

/**
 * Extra minutes a route should expect because riders have been crawling along
 * it. Only cells where at least two riders agree count, so one rider waiting
 * at a customer's door is not mistaken for a jam.
 */
export function telemetryDelayAlongPath(
  grid: SpeedGrid,
  coordinates: readonly (readonly [number, number])[],
): { delayMin: number; slowCells: number } {
  if (grid.size === 0) return { delayMin: 0, slowCells: 0 };
  const seen = new Set<string>();
  let delayMin = 0;
  const check = (longitude: number, latitude: number) => {
    const key = keyOf(latitude, longitude);
    if (seen.has(key)) return;
    seen.add(key);
    const cell = grid.get(key);
    if (!cell || cell.drivers < 2 || cell.medianSpeedKmh >= FREE_FLOW_KMH * 0.6)
      return;
    const speed = Math.max(3, cell.medianSpeedKmh);
    delayMin += (CELL_LENGTH_KM / speed - CELL_LENGTH_KM / FREE_FLOW_KMH) * 60;
  };
  for (let i = 0; i < coordinates.length; i++) {
    const [lng, lat] = coordinates[i];
    check(lng, lat);
    const next = coordinates[i + 1];
    // Long vertex gaps would skip whole cells
    if (
      next &&
      Math.abs(next[0] - lng) + Math.abs(next[1] - lat) > CELL_DEG * 1.5
    ) {
      const steps = Math.ceil(
        (Math.abs(next[0] - lng) + Math.abs(next[1] - lat)) / CELL_DEG,
      );
      for (let s = 1; s < steps; s++) {
        check(
          lng + ((next[0] - lng) * s) / steps,
          lat + ((next[1] - lat) * s) / steps,
        );
      }
    }
  }
  const slowCells = [...seen].filter((key) => {
    const cell = grid.get(key);
    return (
      cell && cell.drivers >= 2 && cell.medianSpeedKmh < FREE_FLOW_KMH * 0.6
    );
  }).length;
  return { delayMin: Math.min(30, Math.round(delayMin * 10) / 10), slowCells };
}
