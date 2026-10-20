"use client";

import AddAPhotoOutlined from "@mui/icons-material/AddAPhotoOutlined";
import ArrowBackIosNew from "@mui/icons-material/ArrowBackIosNew";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import MyLocationOutlined from "@mui/icons-material/MyLocationOutlined";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Icon } from "@/components/delivery/icons";
import { useMapboxMap } from "@/components/delivery/mapbox-kit";
import type { MapPoint } from "@/lib/delivery/map-projection";
import { hasMapbox, reverseGeocode } from "@/lib/delivery/mapbox";

const pickupWindows = ["Morning", "Afternoon", "Evening"] as const;
type PickupWindow = (typeof pickupWindows)[number];
type GpsState = "idle" | "locating" | "ready" | "denied" | "unavailable";

const MAX_PHOTOS = 3;

function FieldLabel({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
      {children}
    </Typography>
  );
}

/**
 * Pans a Mapbox map with a pin fixed at its centre — panning IS picking.
 * "Use my location" flies the map there instead of requiring a separate
 * drag-the-marker interaction. Without a Mapbox token there's nothing to
 * render here; the page falls back to GPS-only capture.
 */
function MapPointPicker({
  point,
  onChange,
}: {
  point: MapPoint | null;
  onChange: (point: MapPoint) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapState = useMapboxMap(container, true);
  const map = mapState?.map ?? null;
  const flewToInitial = useRef(false);

  useEffect(() => {
    if (!map) return;
    const report = () => {
      const center = map.getCenter();
      onChange({ latitude: center.lat, longitude: center.lng });
    };
    map.on("moveend", report);
    return () => {
      map.off("moveend", report);
    };
  }, [map, onChange]);

  useEffect(() => {
    if (!map || !point || flewToInitial.current) return;
    flewToInitial.current = true;
    map.jumpTo({ center: [point.longitude, point.latitude], zoom: 16 });
  }, [map, point]);

  return (
    <Box
      sx={{
        position: "relative",
        height: 200,
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box ref={container} sx={{ position: "absolute", inset: 0 }} />
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -100%)",
          color: "primary.main",
          filter: "drop-shadow(0 2px 3px rgb(0 0 0 / 0.35))",
          pointerEvents: "none",
        }}
      >
        <Icon name="location" size={34} strokeWidth={2.2} />
      </Box>
    </Box>
  );
}

function PhotoAttach({
  photos,
  onAdd,
  onRemove,
}: {
  photos: { file: File; url: string }[];
  onAdd: (files: FileList) => void;
  onRemove: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Box>
      <FieldLabel>Photo (optional)</FieldLabel>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
        {photos.map((photo) => (
          <Box
            key={photo.url}
            sx={{
              position: "relative",
              width: 84,
              height: 84,
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: local blob preview, never optimized by next/image */}
            <img
              src={photo.url}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            <IconButton
              size="small"
              aria-label="Remove photo"
              onClick={() => onRemove(photo.url)}
              sx={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 24,
                height: 24,
                minHeight: 24,
                bgcolor: "rgba(15, 23, 42, 0.55)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(15, 23, 42, 0.75)" },
              }}
            >
              <CloseOutlined sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>
        ))}
        {photos.length < MAX_PHOTOS && (
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => inputRef.current?.click()}
            sx={{
              width: 84,
              height: 84,
              minHeight: 84,
              minWidth: 84,
              flexDirection: "column",
              gap: 0.5,
              borderRadius: "12px",
              borderStyle: "dashed",
            }}
          >
            <AddAPhotoOutlined fontSize="small" />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Add
            </Typography>
          </Button>
        )}
      </Stack>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          if (event.target.files?.length) onAdd(event.target.files);
          event.target.value = "";
        }}
      />
    </Box>
  );
}

export function PickupRequestPage() {
  const router = useRouter();

  const [point, setPoint] = useState<MapPoint | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [address, setAddress] = useState("");
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [window, setWindow] = useState<PickupWindow>("Morning");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Revoke any still-held blob URLs when the page unmounts; removePhoto
  // already revokes its own, so this only mops up what's left.
  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
    };
  }, []);

  useEffect(() => {
    if (!point) return;
    const controller = new AbortController();
    reverseGeocode(point, controller.signal).then((name) => {
      if (name) {
        setPlaceName(name);
        setAddress((current) => current || name);
      }
    });
    return () => controller.abort();
  }, [point]);

  function locate() {
    if (!("geolocation" in navigator)) {
      setGpsState("unavailable");
      return;
    }
    setGpsState("locating");
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        setPoint({
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
        });
        setGpsState("ready");
      },
      (error) => {
        setGpsState(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function addPhotos(files: FileList) {
    const room = MAX_PHOTOS - photos.length;
    const next = Array.from(files)
      .slice(0, room)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPhotos((current) => [...current, ...next]);
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url);
    setPhotos((current) => current.filter((photo) => photo.url !== url));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.trim()) return;
    setSubmitted(true);
  }

  return (
    <main className="customer-app">
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          bgcolor: "background.default",
          pt: "env(safe-area-inset-top)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar disableGutters sx={{ minHeight: 64, px: 1, gap: 1 }}>
          <IconButton
            aria-label="Back"
            onClick={() => router.back()}
            sx={{ ml: 0.5 }}
          >
            <ArrowBackIosNew sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 750, fontSize: 18 }}>
            Request a pickup
          </Typography>
        </Toolbar>
      </AppBar>

      {submitted ? (
        <Stack
          spacing={1.5}
          sx={{ px: 2, pt: 4, pb: 6, alignItems: "flex-start" }}
        >
          <CheckCircleOutlined sx={{ fontSize: 36, color: "success.main" }} />
          <Typography variant="h6" sx={{ fontWeight: 750 }}>
            Request received
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            Our team will confirm {/^[aeiou]/i.test(window) ? "an" : "a"}{" "}
            {window.toLowerCase()} pickup window for {address} and reach you at{" "}
            {phone || "the number on your account"}.
          </Typography>
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={() => router.push("/home")}
            sx={{ minHeight: 52, mt: 2 }}
          >
            Back to home
          </Button>
        </Stack>
      ) : (
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            px: 2,
            pt: 2,
            pb: "calc(96px + env(safe-area-inset-bottom))",
            display: "grid",
            gap: 2,
          }}
        >
          <Box>
            <FieldLabel>Pickup location</FieldLabel>
            {hasMapbox && (
              <Box sx={{ mb: 1 }}>
                <MapPointPicker point={point} onChange={setPoint} />
                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
                >
                  Drag the map so the pin sits on your pickup spot.
                </Typography>
              </Box>
            )}
            <Button
              variant="outlined"
              color="secondary"
              onClick={locate}
              disabled={gpsState === "locating"}
              startIcon={
                gpsState === "locating" ? (
                  <CircularProgress size={16} />
                ) : (
                  <MyLocationOutlined fontSize="small" />
                )
              }
              sx={{ mb: 1 }}
            >
              {gpsState === "locating" ? "Finding you…" : "Use my location"}
            </Button>
            {gpsState === "denied" && (
              <Typography
                variant="caption"
                sx={{ display: "block", mb: 1, color: "error.main" }}
              >
                Location access is blocked. Allow it in your browser settings,
                or enter the address below.
              </Typography>
            )}
            {gpsState === "unavailable" && (
              <Typography
                variant="caption"
                sx={{ display: "block", mb: 1, color: "error.main" }}
              >
                GPS isn't available on this device. Enter the address below.
              </Typography>
            )}
            {placeName && (
              <Typography
                variant="caption"
                sx={{ display: "block", mb: 1, color: "text.secondary" }}
              >
                Matched: {placeName}
              </Typography>
            )}
            <OutlinedInput
              fullWidth
              required
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="House, street, township"
              inputProps={{ "aria-label": "Pickup address" }}
            />
          </Box>

          <PhotoAttach
            photos={photos}
            onAdd={addPhotos}
            onRemove={removePhoto}
          />

          <Box>
            <FieldLabel>Contact phone (optional)</FieldLabel>
            <OutlinedInput
              fullWidth
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="09xxxxxxxxx"
              inputProps={{ "aria-label": "Contact phone" }}
            />
          </Box>

          <Box>
            <FieldLabel>Preferred time</FieldLabel>
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={window}
              onChange={(_, value: PickupWindow | null) => {
                if (value) setWindow(value);
              }}
              aria-label="Preferred pickup time"
              sx={{ p: 0.5, borderRadius: "999px", bgcolor: "grey.100" }}
            >
              {pickupWindows.map((value) => (
                <ToggleButton
                  key={value}
                  value={value}
                  sx={{
                    minHeight: 44,
                    border: 0,
                    borderRadius: "999px !important",
                    "&.Mui-selected": {
                      bgcolor: "background.paper",
                      boxShadow: 1,
                    },
                  }}
                >
                  {value}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box>
            <FieldLabel>What are we picking up? (optional)</FieldLabel>
            <OutlinedInput
              fullWidth
              multiline
              minRows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Parcel size, fragile items, landmark…"
              inputProps={{ "aria-label": "Pickup notes" }}
            />
          </Box>

          <Box
            sx={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              px: 2,
              pt: 1.5,
              pb: "calc(16px + env(safe-area-inset-bottom))",
              bgcolor: "background.default",
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={!address.trim()}
              sx={{ minHeight: 52 }}
            >
              Request pickup
            </Button>
          </Box>
        </Box>
      )}
    </main>
  );
}
