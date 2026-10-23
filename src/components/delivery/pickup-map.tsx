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
import {
  labelElement,
  svgMarker,
  useMapboxMap,
} from "@/components/delivery/mapbox-kit";
import { useRoadDistance } from "@/components/delivery/use-road-distance";
import {
  estimateDeliveryFee,
  matchCities,
  PARCEL_WEIGHT_KG,
  roadDistanceKm,
  zoneFor,
} from "@/lib/delivery/delivery-fee";
import { currency } from "@/lib/delivery/format";
import { haversineKilometers } from "@/lib/delivery/intelligence";
import type { MapPoint } from "@/lib/delivery/map-projection";
import {
  hasMapbox,
  type PlaceSuggestion,
  reverseGeocode,
  searchPlaces,
} from "@/lib/delivery/mapbox";
import {
  loadDraft,
  type ParcelSize,
  saveDraft,
} from "@/lib/delivery/pickup-draft";
import { tidyLabel } from "@/lib/delivery/places";
import { usePermissionRecovery } from "@/lib/delivery/use-permission-recovery";

type GpsState = "idle" | "locating" | "denied" | "unavailable";

/** Closer than this to the other end and the two ends read as the same place. */
const SAME_SPOT_KM = 0.1;

/** What the picker knows about the other end of the trip. */
type OtherEnd = { point: MapPoint | null; address: string; size: ParcelSize };

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
  const [other, setOther] = useState<OtherEnd>({
    point: null,
    address: "",
    size: "Small",
  });
  const [resolving, setResolving] = useState(false);
  const [gps, setGps] = useState<GpsState>("idle");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const started = useRef(false);
  // Whether the pin has been placed on purpose. Until it has, panning the map
  // around the other end must not read as choosing a spot.
  const placed = useRef(false);
  // The spot restored from the draft; its first move must not clear the saved address.
  const restored = useRef<MapPoint | null>(null);
  const pointRef = useRef<MapPoint | null>(null);

  const otherRef = useRef<OtherEnd>(other);

  useEffect(() => {
    pointRef.current = point;
  }, [point]);

  useEffect(() => {
    otherRef.current = other;
  }, [other]);

  // The trip as it stands with the pin where it is: what it costs and how far.
  const pickupPoint = isDelivery ? other.point : point;
  const deliveryPoint = isDelivery ? point : other.point;
  const routedKm = useRoadDistance(pickupPoint, deliveryPoint);
  const tripKm = routedKm ?? roadDistanceKm(pickupPoint, deliveryPoint);
  const trip =
    tripKm === null
      ? null
      : estimateDeliveryFee({
          distanceKm: tripKm,
          weightKg: PARCEL_WEIGHT_KG[other.size],
          method: "cod",
          cashHandling: false,
          pickupPoint,
          pickupAddress: isDelivery ? other.address : address,
          deliveryPoint,
          deliveryAddress: isDelivery ? address : other.address,
        });

  // The other end stays on the map, so the customer can see where the trip
  // runs to and from while choosing this end.
  const gl = mapState?.gl ?? null;
  useEffect(() => {
    if (!map || !gl || !other.point) return;
    const element = svgMarker(
      '<circle cx="12" cy="12" r="8" fill="#64748B" stroke="#FFFFFF" stroke-width="3"/>',
      24,
      "0 0 24 24",
    );
    element.append(labelElement(isDelivery ? "Pickup" : "Delivery"));
    const marker = new gl.Marker({ element })
      .setLngLat([other.point.longitude, other.point.latitude])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, gl, other.point, isDelivery]);

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
        const here = {
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
        };
        // Move the pin, not just the camera: the address and the fee both
        // follow the pin, so a camera move alone would leave them behind.
        placed.current = true;
        setPoint(here);
        flyTo(here);
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
    const otherPoint = isDelivery ? saved.pickupPoint : saved.deliveryPoint;
    setOther({
      point: otherPoint,
      address: isDelivery ? saved.pickupAddress : saved.deliveryAddress,
      size: saved.parcelSize,
    });
    if (own) {
      restored.current = own;
      placed.current = true;
      setAddress(isDelivery ? saved.deliveryAddress : saved.pickupAddress);
      setPoint(own);
      return;
    }
    // Nothing chosen for this end yet. The camera opens near the other end,
    // but the pin stays unset until it is moved on purpose: starting a
    // delivery pin on the pickup spot would make "Confirm" a trap.
    setPoint(null);
    if (!otherPoint) locate();
  }, [locate, isDelivery]);

  /**
   * Put the camera on the spot we already know, once the map and the point are
   * both ready. Until then the map would otherwise sit on its default centre,
   * several kilometres from the address the customer can see on the form.
   */
  useEffect(() => {
    if (!map) return;
    const known = pointRef.current;
    if (known) {
      map.jumpTo({
        center: [known.longitude, known.latitude],
        zoom: 17,
      });
      // A jump does not fire moveend, so adopt the restored point as-is.
      setPoint(known);
      return;
    }
    // No spot chosen yet: open on the other end at street level, so the
    // customer pans from somewhere that makes sense.
    if (otherRef.current.point) {
      const base = otherRef.current.point;
      map.jumpTo({ center: [base.longitude, base.latitude], zoom: 14 });
    }
  }, [map]);

  useEffect(() => {
    if (!map) return;
    // A move the person made by hand places the pin. Mapbox marks those on the
    // event, which tells them apart from the camera moves this page makes.
    const onMoveEnd = (event: object) => {
      if ((event as { originalEvent?: unknown }).originalEvent)
        placed.current = true;
      if (!placed.current) return;
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
      setAddress(name ? tidyLabel(name) : "");
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
    // Townships answer at once and still do when the map service is off, so a
    // customer can always reach the priced parts of the city by name.
    const local = matchCities(query).map((entry) => ({
      id: `city-${entry.city}`,
      name: entry.city,
      detail: "Township · pins the centre",
      point: { ...entry.point },
    }));
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchPlaces(query, pointRef.current, controller.signal).then((list) => {
        if (controller.signal.aborted) return;
        const taken = new Set(local.map((place) => place.name.toLowerCase()));
        setSuggestions([
          ...local,
          ...list.filter((place) => !taken.has(place.name.toLowerCase())),
        ]);
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
    // Move the pin, not only the camera. The camera move fires moveend, which
    // lands on the same point, but setting it here keeps the pin right even if
    // the map is still loading or its tiles never arrive.
    placed.current = true;
    setPoint(place.point);
    setAddress(
      tidyLabel(place.detail ? `${place.name}, ${place.detail}` : place.name),
    );
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
  // The fee zone the pin is in, so panning shows what it costs as it moves.
  const zone = point ? zoneFor({ point, address }) : null;
  const apartKm =
    point && other.point ? haversineKilometers(point, other.point) : null;
  const sameSpot = apartKm !== null && apartKm < SAME_SPOT_KM;

  /**
   * Zoom out until the other end is in view, without moving the pin: the pin is
   * the centre of the map, so the view is widened around it, never re-centred.
   */
  function showOtherEnd() {
    if (!map || !point || !other.point) return;
    const dLat = Math.abs(other.point.latitude - point.latitude);
    const dLng = Math.abs(other.point.longitude - point.longitude);
    map.fitBounds(
      [
        [point.longitude - dLng, point.latitude - dLat],
        [point.longitude + dLng, point.latitude + dLat],
      ],
      { padding: { top: 150, bottom: 340, left: 56, right: 56 }, maxZoom: 16 },
    );
  }

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
            // Dimmed until the spot is chosen, so it never reads as already set.
            opacity: point ? 1 : 0.55,
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
              {!point
                ? `Drag the map until the pin is on the ${isDelivery ? "delivery" : "pickup"} spot, or search above.`
                : resolving
                  ? "Finding the address…"
                  : address || "No address here. Move the pin or search."}
            </Typography>
            {sameSpot && (
              <Typography
                variant="body2"
                role="alert"
                sx={{ color: "error.main", fontWeight: 600 }}
              >
                That is the {isDelivery ? "pickup" : "delivery"} spot. Move the
                pin to where the parcel should {isDelivery ? "go" : "start"}.
              </Typography>
            )}
            {point && trip && !sameSpot && (
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
              >
                {currency.format(trip.total)} ·{" "}
                {routedKm !== null ? "" : "about "}
                {trip.distanceKm.toFixed(1)} km
              </Typography>
            )}
            {zone && (
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary" }}
              >
                {trip?.zones && !sameSpot
                  ? trip.zones.label
                  : (zone.zone ?? "Outside the priced townships")}
              </Typography>
            )}
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

        {point && other.point && !sameSpot && (
          <Button
            variant="text"
            color="secondary"
            onClick={showOtherEnd}
            sx={{ justifySelf: "start", minHeight: 40, px: 0.5 }}
          >
            Show the {isDelivery ? "pickup" : "delivery"} spot on the map
          </Button>
        )}
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
          disabled={!point || resolving || !hasMapbox || sameSpot}
          sx={{ minHeight: 52 }}
        >
          {isDelivery ? "Confirm delivery spot" : "Confirm pickup spot"}
        </Button>
      </Box>
    </main>
  );
}
