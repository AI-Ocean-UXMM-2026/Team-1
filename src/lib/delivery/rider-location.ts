export type RiderLocationPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** Ground speed from the device, when it reports one. */
  speedMps: number | null;
  /** Direction of travel in degrees clockwise from north, when known. */
  headingDegrees: number | null;
  recordedAt: string;
};

const finiteOrNull = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

type LocationWatchOptions = {
  geolocation: Pick<Geolocation, "watchPosition" | "clearWatch">;
  orderIds: string[];
  send: (orderId: string, point: RiderLocationPoint) => Promise<void>;
  onSent: (orderIds: string[], point: RiderLocationPoint) => void;
  onError: (message: string, permissionDenied: boolean) => void;
  now?: () => number;
};

/** One GPS watch updates every parcel on board, independently of the open task. */
export function watchRiderLocations({
  geolocation,
  orderIds,
  send,
  onSent,
  onError,
  now = Date.now,
}: LocationWatchOptions) {
  let active = true;
  let sending = false;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  const targets = [...new Set(orderIds)];
  if (!targets.length) return () => {};

  const watchId = geolocation.watchPosition(
    async (position) => {
      if (!active || sending) return;
      const timestamp = now();
      if (timestamp - lastSentAt < 10_000) return;
      const { latitude, longitude, accuracy, speed, heading } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      lastSentAt = timestamp;
      sending = true;
      try {
        const point: RiderLocationPoint = {
          latitude,
          longitude,
          accuracy: Number.isFinite(accuracy) ? accuracy : null,
          speedMps:
            finiteOrNull(speed) == null ? null : Math.max(0, speed ?? 0),
          headingDegrees: finiteOrNull(heading),
          recordedAt: new Date(timestamp).toISOString(),
        };
        const results = await Promise.allSettled(
          targets.map(async (orderId) => send(orderId, point)),
        );
        if (!active) return;
        const sent = targets.filter(
          (_, index) => results[index].status === "fulfilled",
        );
        if (sent.length) onSent(sent, point);
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") {
          onError(
            failure.reason instanceof Error
              ? failure.reason.message
              : "Could not update every parcel location. Keep this app open to retry.",
            false,
          );
        }
      } finally {
        sending = false;
      }
    },
    (cause) => {
      if (!active) return;
      const permissionDenied = cause.code === cause.PERMISSION_DENIED;
      onError(
        permissionDenied
          ? "Location permission is off. Enable it in your browser settings, then share your location."
          : "GPS could not find your location. Keep this app open while GPS retries.",
        permissionDenied,
      );
    },
    { enableHighAccuracy: true, maximumAge: 4_000, timeout: 20_000 },
  );

  return () => {
    active = false;
    geolocation.clearWatch(watchId);
  };
}
