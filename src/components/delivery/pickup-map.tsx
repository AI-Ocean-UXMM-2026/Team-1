"use client";

import ArrowBack from "@mui/icons-material/ArrowBack";
import MyLocationOutlined from "@mui/icons-material/MyLocationOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { useMapboxMap } from "@/components/delivery/mapbox-kit";
import type { MapPoint } from "@/lib/delivery/map-projection";
import {
  hasMapbox,
  type PlaceSuggestion,
  reverseGeocode,
  searchPlaces,
} from "@/lib/delivery/mapbox";
import { loadDraft, saveDraft } from "@/lib/delivery/pickup-draft";
import { usePermissionRecovery } from "@/lib/delivery/use-permission-recovery";

type GpsState = "idle" | "locating" | "denied" | "unavailable";

/**
 * Full-screen pickup picker. The pin stays at the centre of the screen and the
 * map moves under it, so panning is picking. Confirming writes the spot into
 * the shared pickup draft and returns to the form.
 */
export function PickupMapPage({
  target = "pickup",
}: {
  target?: "pickup" | "delivery";
}) {
  const isDelivery = target === "delivery";
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const mapState = useMapboxMap(container, true);
  const map = mapState?.map ?? null;

  const [point, setPoint] = useState<MapPoint | null>(null);
  const [address, setAddress] = useState("");
  const [resolving, setResolving] = useState(false);
  const [gps, setGps] = useState<GpsState>("idle");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const started = useRef(false);
  // The spot restored from the draft; its first move must not clear the saved address.
  const restored = useRef<MapPoint | null>(null);
  const pointRef = useRef<MapPoint | null>(null);

  useEffect(() => {
    pointRef.current = point;
  }, [point]);

  const flyTo = useCallback(
    (target: MapPoint, zoom = 17) => {
      map?.flyTo({
        center: [target.longitude, target.latitude],
        zoom,
        duration: 700,
      });
    },
    [map],
  );

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGps("unavailable");
      return;
    }
    setGps("locating");
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        setGps("idle");
        flyTo({
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
        });
      },
      (error) =>
        setGps(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        ),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }, [flyTo]);

  usePermissionRecovery({
    permission: "geolocation",
    enabled: gps === "denied",
    onGranted: locate,
  });

  // Start from the spot already chosen, else from the pickup, else from GPS.
  // The point is known before the map loads, so Confirm never waits on tiles.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = loadDraft();
    const own = isDelivery ? saved.deliveryPoint : saved.pickupPoint;
    const nearby = own ?? (isDelivery ? saved.pickupPoint : null);
    if (own) {
      restored.current = own;
      setAddress(isDelivery ? saved.deliveryAddress : saved.pickupAddress);
    }
    if (nearby) setPoint(nearby);
    else locate();
  }, [locate, isDelivery]);

  // Once the map exists, move the camera to the point we already know.
  useEffect(() => {
    if (!map || !pointRef.current) return;
    map.jumpTo({
      center: [pointRef.current.longitude, pointRef.current.latitude],
      zoom: 17,
    });
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const onMoveEnd = () => {
      const center = map.getCenter();
      setPoint({ latitude: center.lat, longitude: center.lng });
    };
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [map]);

  useEffect(() => {
    if (!point) return;
    const saved = restored.current;
    restored.current = null;
    if (
      saved &&
      Math.abs(saved.latitude - point.latitude) < 1e-6 &&
      Math.abs(saved.longitude - point.longitude) < 1e-6
    ) {
      return;
    }
    const controller = new AbortController();
    setResolving(true);
    reverseGeocode(point, controller.signal).then((name) => {
      if (controller.signal.aborted) return;
      setResolving(false);
      setAddress(name ?? "");
    });
    return () => controller.abort();
  }, [point]);

  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchPlaces(query, pointRef.current, controller.signal).then((list) => {
        if (controller.signal.aborted) return;
        setSuggestions(list);
        setSearching(false);
      });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(place: PlaceSuggestion) {
    setQuery("");
    setSuggestions([]);
    flyTo(place.point);
  }

  function confirm() {
    if (!point) return;
    const current = loadDraft();
    saveDraft(
      isDelivery
        ? {
            ...current,
            deliveryPoint: point,
            deliveryAddress: address.trim() || current.deliveryAddress,
          }
        : {
            ...current,
            pickupPoint: point,
            pickupAddress: address.trim() || current.pickupAddress,
          },
    );
    // Replace, not push: the form remounts and reads the draft just saved.
    router.replace("/pickup");
  }

  const showResults = query.trim().length >= 3;

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-surface)",
      }}
    >
      <Box ref={container} sx={{ position: "absolute", inset: 0 }} />

      {hasMapbox && (
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -100%)",
            color: "primary.main",
            filter: "drop-shadow(0 3px 4px rgb(15 23 42 / 0.35))",
            pointerEvents: "none",
          }}
        >
          <Icon name="location" size={44} strokeWidth={2.2} />
        </Box>
      )}

      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          p: 2,
          pt: "calc(12px + env(safe-area-inset-top))",
          display: "grid",
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            pr: 2,
            minHeight: 56,
            bgcolor: "background.paper",
            borderRadius: "16px",
            boxShadow: "0 4px 16px rgb(15 23 42 / 0.16)",
          }}
        >
          <IconButton
            aria-label="Back to the form"
            onClick={() => router.replace("/pickup")}
            sx={{ width: 48, height: 48, color: "text.primary" }}
          >
            <ArrowBack />
          </IconButton>
          <InputBase
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a street, shop or landmark"
            inputProps={{
              "aria-label": isDelivery
                ? "Search for a delivery place"
                : "Search for a pickup place",
              style: { fontSize: 16 },
            }}
          />
          {searching ? (
            <CircularProgress size={18} />
          ) : (
            <SearchOutlined sx={{ color: "text.secondary" }} />
          )}
        </Box>

        {showResults && (
          <Box
            component="ul"
            aria-label="Matching places"
            sx={{
              m: 0,
              p: 0,
              listStyle: "none",
              bgcolor: "background.paper",
              borderRadius: "16px",
              boxShadow: "0 4px 16px rgb(15 23 42 / 0.16)",
              overflow: "hidden",
              maxHeight: "40dvh",
              overflowY: "auto",
            }}
          >
            {suggestions.length === 0 && !searching && (
              <Typography
                component="li"
                variant="body2"
                sx={{ p: 2, color: "text.secondary" }}
              >
                No places match “{query.trim()}”. Pan the map to the spot
                instead.
              </Typography>
            )}
            {suggestions.map((place) => (
              <li key={place.id}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => choose(place)}
                  sx={{
                    all: "unset",
                    boxSizing: "border-box",
                    display: "block",
                    width: "100%",
                    minHeight: 56,
                    px: 2,
                    py: 1.25,
                    cursor: "pointer",
                    borderTop: "1px solid",
                    borderColor: "divider",
                    "li:first-of-type > &": { borderTop: 0 },
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Typography sx={{ fontWeight: 650 }}>{place.name}</Typography>
                  {place.detail && (
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {place.detail}
                    </Typography>
                  )}
                </Box>
              </li>
            ))}
          </Box>
        )}
      </Box>

      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          px: 2,
          pt: 2,
          pb: "calc(16px + env(safe-area-inset-bottom))",
          bgcolor: "background.paper",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -4px 24px rgb(15 23 42 / 0.14)",
          display: "grid",
          gap: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {isDelivery ? "Delivery spot" : "Pickup spot"}
            </Typography>
            <Typography
              aria-live="polite"
              sx={{ fontWeight: 700, lineHeight: 1.35, minHeight: 44 }}
            >
              {resolving
                ? "Finding the address…"
                : address || "No address here. Move the pin or search."}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="secondary"
            onClick={locate}
            disabled={gps === "locating"}
            aria-label="Use my location"
            sx={{ minWidth: 48, width: 48, height: 48, p: 0, flexShrink: 0 }}
          >
            {gps === "locating" ? (
              <CircularProgress size={18} />
            ) : (
              <MyLocationOutlined />
            )}
          </Button>
        </Box>

        {gps === "denied" && (
          <Typography variant="body2" role="alert" sx={{ color: "error.main" }}>
            Location is blocked for this site. Allow it in your browser
            settings, or search for the spot above.
          </Typography>
        )}
        {gps === "unavailable" && (
          <Typography variant="body2" role="alert" sx={{ color: "error.main" }}>
            We couldn’t get your location. Search for the spot above or move the
            pin.
          </Typography>
        )}
        {!hasMapbox && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            The map isn’t available. Go back and type the address.
          </Typography>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={confirm}
          disabled={!point || resolving || !hasMapbox}
          sx={{ minHeight: 52 }}
        >
          {isDelivery ? "Confirm delivery spot" : "Confirm pickup spot"}
        </Button>
      </Box>
    </main>
  );
}
