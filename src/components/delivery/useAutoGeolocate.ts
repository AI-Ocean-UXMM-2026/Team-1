import { useEffect, useState } from "react";
import type { MapPoint } from "@/lib/delivery/map-projection";
import { reverseGeocode } from "@/lib/delivery/mapbox";

export type GeolocateState = "idle" | "locating" | "ready" | "denied" | "unavailable" | "error";

export type GeolocateResult = {
  point: MapPoint | null;
  address: string | null;
  accuracy: number | null;
  state: GeolocateState;
  error: string | null;
  retry: () => void;
};

/**
 * Hook that automatically geolocates the user on mount and reverse geocodes
 * the location to get a human-readable address.
 *
 * GPS is treated as the source of truth for the pickup location.
 * Accuracy indicates how precise the location is in meters.
 */
export function useAutoGeolocate(
  enabled: boolean = true,
  highAccuracy: boolean = true,
): GeolocateResult {
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [state, setState] = useState<GeolocateState>("idle");
  const [error, setError] = useState<string | null>(null);

  const geolocate = (useHighAccuracy: boolean = true) => {
    if (!enabled) {
      setState("unavailable");
      return;
    }

    if (!("geolocation" in navigator)) {
      setState("unavailable");
      setError("Geolocation is not available in your browser");
      return;
    }

    setState("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const here: MapPoint = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          const acc = Math.round(position.coords.accuracy);
          setPoint(here);
          setAccuracy(acc);

          // Immediately set state to ready so UI can respond
          setState("ready");

          // Try to get address name via reverse geocoding
          try {
            const name = await reverseGeocode(here);
            if (name) {
              setAddress(name);
            }
          } catch (err) {
            // Reverse geocoding failure is not critical; we have the GPS point
            console.warn("Reverse geocoding failed:", err);
          }
        } catch (err) {
          setState("error");
          setError("Failed to process location data");
          console.error("Geolocate error:", err);
        }
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setState("denied");
          setError("Location permission denied. Please enable it in your browser settings.");
        } else if (geoError.code === geoError.TIMEOUT) {
          setState("error");
          setError("Location request timed out. Please try again.");
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setState("unavailable");
          setError("Location is unavailable. Please try again.");
        } else {
          setState("error");
          setError("Unable to get your location. Please try again or type an address.");
        }

        // Retry with lower accuracy if high accuracy fails
        if (useHighAccuracy && geoError.code !== geoError.PERMISSION_DENIED) {
          setTimeout(() => geolocate(false), 100);
        }
      },
      {
        enableHighAccuracy: useHighAccuracy,
        timeout: 10_000,
        maximumAge: 30_000,
      },
    );
  };

  // Auto-geolocate on mount if enabled
  useEffect(() => {
    if (enabled && state === "idle") {
      geolocate(highAccuracy);
    }
  }, [enabled]);

  const retry = () => {
    setPoint(null);
    setAddress(null);
    setAccuracy(null);
    setState("idle");
    setError(null);
    geolocate(highAccuracy);
  };

  return {
    point,
    address,
    accuracy,
    state,
    error,
    retry,
  };
}
