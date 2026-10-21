"use client";

import ArrowBack from "@mui/icons-material/ArrowBack";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
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
import { type FormEvent, useEffect, useRef, useState } from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import { Icon } from "@/components/delivery/icons";
import { useMapboxMap } from "@/components/delivery/mapbox-kit";
import { useBackNavigation } from "@/components/delivery/use-back-navigation";
import type { MapPoint } from "@/lib/delivery/map-projection";
import { hasMapbox, reverseGeocode } from "@/lib/delivery/mapbox";
import { createSupportCase } from "@/lib/delivery/operations-actions";
import { createClient } from "@/lib/supabase/client";

const pickupWindows = ["Morning", "Afternoon", "Evening"] as const;
type PickupWindow = (typeof pickupWindows)[number];
type GpsState = "idle" | "locating" | "ready" | "denied" | "unavailable";

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
      <Box ref={container} style={{ position: "absolute", inset: 0 }} />
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

export function PickupRequestPage() {
  const router = useRouter();
  const goBack = useBackNavigation("/home");

  const [point, setPoint] = useState<MapPoint | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [address, setAddress] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [window, setWindow] = useState<PickupWindow>("Morning");
  const [state, setState] = useState<"editing" | "sending" | "sent">("editing");
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const ready = address.trim().length > 0 && dropoff.trim().length > 0;

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

  /**
   * Requests reach the operations team's support queue, which already lets
   * customers write and staff follow up. Nothing is shown as "received"
   * until that write succeeds.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || state === "sending") return;
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      // Everything typed stays on the page while the person signs in.
      setAuthOpen(true);
      return;
    }
    setState("sending");
    try {
      await createSupportCase(supabase, {
        requesterId: userId,
        subject: `Pickup request · ${window.toLowerCase()}`,
        description: [
          `Pickup: ${address.trim()}`,
          point
            ? `Pin: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`
            : null,
          `Deliver to: ${dropoff.trim()}`,
          `Preferred time: ${window}`,
          phone.trim() ? `Contact phone: ${phone.trim()}` : null,
          notes.trim() ? `Notes: ${notes.trim()}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        priority: "normal",
      });
      setState("sent");
    } catch (cause) {
      setState("editing");
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn’t send your request. Check your connection and try again.",
      );
    }
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
        <Toolbar disableGutters sx={{ minHeight: 72, px: 2, gap: 1 }}>
          <IconButton
            aria-label="Back"
            edge="start"
            onClick={goBack}
            sx={{ width: 48, height: 48, color: "text.primary" }}
          >
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h5"
            component="h1"
            noWrap
            sx={{ fontWeight: 750, lineHeight: "30px" }}
          >
            Request a pickup
          </Typography>
        </Toolbar>
      </AppBar>

      {state === "sent" ? (
        <Stack
          spacing={1.5}
          sx={{ px: 2, pt: 4, pb: 6, alignItems: "flex-start" }}
        >
          <CheckCircleOutlined sx={{ fontSize: 36, color: "success.main" }} />
          <Typography variant="h6" component="h2" sx={{ fontWeight: 750 }}>
            Request sent
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            The Oern team will call{" "}
            {phone.trim() || "the number on your account"} to confirm{" "}
            {/^[aeiou]/i.test(window) ? "an" : "a"} {window.toLowerCase()}{" "}
            pickup from {address.trim()}.
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

          <Box>
            <FieldLabel>Deliver to</FieldLabel>
            <OutlinedInput
              fullWidth
              required
              value={dropoff}
              onChange={(event) => setDropoff(event.target.value)}
              placeholder="Recipient’s address and township"
              inputProps={{ "aria-label": "Delivery address" }}
            />
          </Box>

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
            {error && (
              <Typography
                role="alert"
                variant="body2"
                sx={{ color: "error.main", mb: 1 }}
              >
                {error}
              </Typography>
            )}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={!ready || state === "sending"}
              sx={{ minHeight: 52 }}
            >
              {state === "sending" ? "Sending…" : "Request pickup"}
            </Button>
          </Box>
        </Box>
      )}
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
