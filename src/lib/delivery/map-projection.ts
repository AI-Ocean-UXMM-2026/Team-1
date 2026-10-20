export type MapPoint = { latitude: number; longitude: number };
export type MapTile = {
  x: number;
  y: number;
  src: string;
  left: number;
  top: number;
};

export const TILE_SIZE = 256;

export function toWorldPixel({ latitude, longitude }: MapPoint, zoom: number) {
  const latitudeRadians =
    (Math.max(Math.min(latitude, 85.0511), -85.0511) * Math.PI) / 180;
  const scale = TILE_SIZE * 2 ** zoom;
  return {
    x: ((longitude + 180) / 360) * scale,
    y: ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * scale,
  };
}

export function pointAt(
  point: MapPoint,
  center: MapPoint,
  size: { width: number; height: number },
  zoom: number,
) {
  const world = toWorldPixel(point, zoom);
  const centerWorld = toWorldPixel(center, zoom);
  return {
    x: world.x - centerWorld.x + size.width / 2,
    y: world.y - centerWorld.y + size.height / 2,
  };
}

/** OpenStreetMap tiles covering a viewport centred on a world pixel. */
export function tilesFor(
  centerWorld: { x: number; y: number },
  size: { width: number; height: number },
  zoom: number,
) {
  if (!size.width || !size.height) return [] as MapTile[];
  const leftEdge = centerWorld.x - size.width / 2;
  const topEdge = centerWorld.y - size.height / 2;
  const limit = 2 ** zoom;
  const tiles: MapTile[] = [];
  for (
    let x = Math.floor(leftEdge / TILE_SIZE);
    x <= Math.floor((leftEdge + size.width) / TILE_SIZE);
    x += 1
  ) {
    for (
      let y = Math.floor(topEdge / TILE_SIZE);
      y <= Math.floor((topEdge + size.height) / TILE_SIZE);
      y += 1
    ) {
      if (y < 0 || y >= limit) continue;
      tiles.push({
        x,
        y,
        src: `https://tile.openstreetmap.org/${zoom}/${((x % limit) + limit) % limit}/${y}.png`,
        left: Math.floor(x * TILE_SIZE - leftEdge),
        top: Math.floor(y * TILE_SIZE - topEdge),
      });
    }
  }
  return tiles;
}
