"use client";

import ArrowBack from "@mui/icons-material/ArrowBack";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import MapOutlined from "@mui/icons-material/MapOutlined";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { AuthDialog } from "@/components/delivery/auth-dialog";
import { useBackNavigation } from "@/components/delivery/use-back-navigation";
import { createCustomerPickupOrder } from "@/lib/delivery/actions";
import {
  fetchRoadRoute,
  formatDriveMinutes,
  hasMapbox,
  MAP_STYLE,
  MAPBOX_TOKEN,
  type PlaceSuggestion,
  reverseGeocode,
  searchPlaces,
} from "@/lib/delivery/mapbox";
import {
  clearDraft,
  describeParcel,
  emptyDraft,
  isMyanmarPhone,
  loadDraft,
  type PickupDraft,
  parcelKinds,
  parcelSizes,
  pickupDays,
  pickupWindows,
  saveDraft,
} from "@/lib/delivery/pickup-draft";
import { createClient } from "@/lib/supabase/client";

type Recipient = {
  name: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};
type Errors = Partial<
  Record<
    | "pickupAddress"
    | "deliveryAddress"
    | "recipientName"
    | "recipientPhone"
    | "contactPhone"
    | "parcelDetails"
    | "codAmount",
    string
  >
>;

const fieldOrder: (keyof Errors)[] = [
  "pickupAddress",
  "contactPhone",
  "deliveryAddress",
  "recipientName",
  "recipientPhone",
  "parcelDetails",
  "codAmount",
];
const fieldId: Record<keyof Errors, string> = {
  pickupAddress: "pickup-address",
  contactPhone: "pickup-phone",
  deliveryAddress: "delivery-address",
  recipientName: "recipient-name",
  recipientPhone: "recipient-phone",
  parcelDetails: "parcel-details",
  codAmount: "cod-amount",
};

function validate(draft: PickupDraft): Errors {
  const errors: Errors = {};
  if (!draft.pickupAddress.trim())
    errors.pickupAddress =
      "Pin the pickup spot on the map or type the address.";
  if (draft.contactPhone.trim() && !isMyanmarPhone(draft.contactPhone))
    errors.contactPhone = "Use a Myanmar mobile number, like 09 123 456 789.";
  if (!draft.deliveryAddress.trim())
    errors.deliveryAddress = "Enter where the parcel should be delivered.";
  if (!draft.recipientName.trim())
    errors.recipientName = "Enter who will receive the parcel.";
  if (!draft.recipientPhone.trim())
    errors.recipientPhone = "Enter a number the rider can call at the door.";
  else if (!isMyanmarPhone(draft.recipientPhone))
    errors.recipientPhone = "Use a Myanmar mobile number, like 09 123 456 789.";
  if (draft.parcelKind === "Other" && !draft.parcelDetails.trim())
    errors.parcelDetails = "Say what is in the parcel.";
  if (draft.codAmount.trim() && !/^\d+$/.test(draft.codAmount.trim()))
    errors.codAmount = "Enter whole kyats only, with no commas or decimals.";
  return errors;
}

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={{ display: "grid", gap: 2 }}
    >
      <Box>
        <Typography
          id={id}
          variant="subtitle1"
          component="h2"
          sx={{ fontWeight: 750 }}
        >
          {title}
        </Typography>
        {hint && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {hint}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
  );
}

function Field({
  id,
  label,
  optional,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <Box>
      <Typography
        component="label"
        htmlFor={id}
        variant="subtitle2"
        sx={{ display: "block", fontWeight: 700, mb: 0.5 }}
      >
        {label}
        {optional && (
          <Box
            component="span"
            sx={{ fontWeight: 400, color: "text.secondary" }}
          >
            {" "}
            (optional)
          </Box>
        )}
      </Typography>
      {children}
      {error ? (
        <FormHelperText id={`${id}-note`} error role="alert">
          {error}
        </FormHelperText>
      ) : help ? (
        <FormHelperText id={`${id}-note`}>{help}</FormHelperText>
      ) : null}
    </Box>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; caption?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      aria-label={label}
      value={value}
      onChange={(_, next: T | null) => {
        if (next) onChange(next);
      }}
      sx={{ p: 0.5, borderRadius: "999px", bgcolor: "grey.100", gap: 0.5 }}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          value={option.value}
          sx={{
            minHeight: 48,
            border: 0,
            borderRadius: "999px !important",
            flexDirection: "column",
            lineHeight: 1.2,
            textTransform: "none",
            fontWeight: 650,
            "&.Mui-selected": { bgcolor: "background.paper", boxShadow: 1 },
          }}
        >
          {option.value}
          {option.caption && (
            <Box
              component="span"
              sx={{ fontSize: 12, fontWeight: 400, color: "text.secondary" }}
            >
              {option.caption}
            </Box>
          )}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function mapThumbnailUrl(point: { latitude: number; longitude: number }) {
  const style = MAP_STYLE.replace("mapbox://styles/", "");
  const at = `${point.longitude},${point.latitude}`;
  return `https://api.mapbox.com/styles/v1/${style}/static/pin-l+c2410c(${at})/${at},15.5,0/640x240@2x?access_token=${MAPBOX_TOKEN}&logo=false&attribution=false`;
}

const routeFields: (keyof Errors)[] = [
  "pickupAddress",
  "contactPhone",
  "deliveryAddress",
  "recipientName",
  "recipientPhone",
];

/**
 * Two pages share one saved draft: "route" collects where the parcel goes and
 * who gets it, "details" collects the parcel, the time, and sends the request.
 */
function MapTile({
  href,
  point,
  label,
}: {
  href: string;
  point: { latitude: number; longitude: number } | null;
  label: string;
}) {
  return (
    <Box
      component={Link}
      href={href}
      aria-label={
        point
          ? `Change the ${label} on the map`
          : `Choose the ${label} on the map`
      }
      sx={{
        position: "relative",
        display: "block",
        height: 132,
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "grey.100",
        backgroundImage:
          hasMapbox && point ? `url("${mapThumbnailUrl(point)}")` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: "text.primary",
        textDecoration: "none",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          right: 8,
          bottom: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          minHeight: 40,
          px: 1.5,
          borderRadius: "999px",
          bgcolor: "background.paper",
          boxShadow: "0 2px 8px rgb(15 23 42 / 0.2)",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        <MapOutlined fontSize="small" />
        {point ? "Change on map" : "Pin on map"}
      </Box>
    </Box>
  );
}

export function PickupRequestPage({
  step = "route",
}: {
  step?: "route" | "details";
}) {
  const router = useRouter();
  const goHome = useBackNavigation("/home");
  const goBack = () => (step === "details" ? router.push("/pickup") : goHome());

  const [draft, setDraft] = useState<PickupDraft>(() => emptyDraft());
  const [hydrated, setHydrated] = useState(false);
  const [recents, setRecents] = useState<Recipient[]>([]);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [touched, setTouched] = useState<Set<keyof Errors>>(new Set());
  const [trip, setTrip] = useState<string | null>(null);
  const [state, setState] = useState<"editing" | "sending" | "sent">("editing");
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [sentSummary, setSentSummary] = useState("");
  const deliveryPicked = useRef(false);

  const patch = useCallback((changes: Partial<PickupDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  }, []);

  // Restore what was typed or pinned before, then fill in what we can know.
  useEffect(() => {
    const saved = loadDraft();
    setDraft(saved);
    setHydrated(true);
    deliveryPicked.current = saved.deliveryPoint != null;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || cancelled) return;

      const [profile, orders] = await Promise.all([
        supabase
          .from("profiles")
          .select("phone")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("delivery_orders")
          .select(
            "recipient_name, recipient_phone, delivery_address, delivery_latitude, delivery_longitude",
          )
          .eq("customer_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled) return;

      const accountPhone = profile.data?.phone?.trim();
      if (accountPhone) {
        setDraft((current) =>
          current.contactPhone
            ? current
            : { ...current, contactPhone: accountPhone },
        );
      }
      const seen = new Set<string>();
      const people: Recipient[] = [];
      for (const row of orders.data ?? []) {
        const phone = row.recipient_phone?.trim();
        const name = row.recipient_name?.trim();
        if (!phone || !name || seen.has(phone)) continue;
        seen.add(phone);
        people.push({
          name,
          phone,
          address: row.delivery_address,
          latitude: row.delivery_latitude,
          longitude: row.delivery_longitude,
        });
        if (people.length === 3) break;
      }
      setRecents(people);
    })();

    // With location already allowed, start from where the person is. We never
    // trigger the permission prompt from here; that waits for the map page.
    if (!saved.pickupPoint && "permissions" in navigator) {
      navigator.permissions
        ?.query({ name: "geolocation" })
        .then((status) => {
          if (status.state !== "granted" || cancelled) return;
          navigator.geolocation.getCurrentPosition(async (fix) => {
            const point = {
              latitude: fix.coords.latitude,
              longitude: fix.coords.longitude,
            };
            const name = await reverseGeocode(point);
            if (cancelled) return;
            setDraft((current) =>
              current.pickupPoint
                ? current
                : {
                    ...current,
                    pickupPoint: point,
                    pickupAddress: current.pickupAddress || name || "",
                  },
            );
          });
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated && state !== "sent") saveDraft(draft);
  }, [draft, hydrated, state]);

  // Suggest destination addresses as the person types.
  useEffect(() => {
    const text = draft.deliveryAddress.trim();
    if (deliveryPicked.current || text.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchPlaces(text, draft.pickupPoint, controller.signal).then((list) => {
        if (!controller.signal.aborted) setSuggestions(list);
      });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft.deliveryAddress, draft.pickupPoint]);

  // Once both ends are pinned, tell the sender roughly how far the trip is.
  const pickupPoint = draft.pickupPoint;
  const deliveryPoint = draft.deliveryPoint;
  useEffect(() => {
    if (!pickupPoint || !deliveryPoint) {
      setTrip(null);
      return;
    }
    const controller = new AbortController();
    fetchRoadRoute([pickupPoint, deliveryPoint], controller.signal).then(
      (route) => {
        if (controller.signal.aborted) return;
        setTrip(
          route
            ? `About ${route.distanceKm.toFixed(1)} km, ${formatDriveMinutes(route.durationMin)} by road`
            : null,
        );
      },
    );
    return () => controller.abort();
  }, [pickupPoint, deliveryPoint]);

  function touch(field: keyof Errors) {
    setTouched((current) => new Set(current).add(field));
  }
  const shown = (field: keyof Errors) =>
    touched.has(field) ? validate(draft)[field] : undefined;
  const aria = (field: keyof Errors) => ({
    "aria-invalid": shown(field) ? true : undefined,
    "aria-describedby": shown(field) ? `${fieldId[field]}-note` : undefined,
  });

  function chooseDelivery(place: PlaceSuggestion) {
    deliveryPicked.current = true;
    patch({
      deliveryAddress: [place.name, place.detail].filter(Boolean).join(", "),
      deliveryPoint: place.point,
    });
    setSuggestions([]);
    setSuggestOpen(false);
  }

  function applyRecipient(person: Recipient) {
    deliveryPicked.current = true;
    patch({
      recipientName: person.name,
      recipientPhone: person.phone,
      deliveryAddress: person.address,
      deliveryPoint:
        person.latitude != null && person.longitude != null
          ? { latitude: person.latitude, longitude: person.longitude }
          : null,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    const found = validate(draft);
    const checked = step === "route" ? routeFields : fieldOrder;
    setTouched(new Set(checked));
    const first = checked.find((field) => found[field]);
    if (first) {
      const element = document.getElementById(fieldId[first]);
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      element?.focus({ preventScroll: true });
      return;
    }
    setError(null);
    if (step === "route") {
      router.push("/pickup/details");
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user.id) {
      // Everything entered stays saved while the person signs in.
      setAuthOpen(true);
      return;
    }
    setState("sending");
    try {
      const result = await createCustomerPickupOrder(supabase, {
        pickupAddress: draft.pickupAddress,
        pickupLatitude: draft.pickupPoint?.latitude,
        pickupLongitude: draft.pickupPoint?.longitude,
        pickupContactPhone: draft.contactPhone,
        deliveryAddress: draft.deliveryAddress,
        deliveryLatitude: draft.deliveryPoint?.latitude,
        deliveryLongitude: draft.deliveryPoint?.longitude,
        recipientName: draft.recipientName,
        recipientPhone: draft.recipientPhone,
        parcelDescription: describeParcel(draft),
        codAmount: Number(draft.codAmount.trim() || 0),
      });
      setTrackingCode(result.tracking_code);
      setSentSummary(
        `${draft.day} ${draft.window.toLowerCase()} from ${draft.pickupAddress.trim()}`,
      );
      clearDraft();
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

  // The details page is only useful once the route is filled in.
  useEffect(() => {
    if (step !== "details" || !hydrated || state === "sent") return;
    const found = validate(draft);
    if (routeFields.some((field) => found[field])) router.replace("/pickup");
  }, [step, hydrated, draft, state, router]);

  const cod = Number(draft.codAmount.trim() || 0);

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
            {step === "route" ? "Request a pickup" : "Parcel and time"}
          </Typography>
          {state !== "sent" && (
            <Typography
              variant="body2"
              sx={{ ml: "auto", color: "text.secondary", whiteSpace: "nowrap" }}
            >
              {step === "route" ? "1 of 2" : "2 of 2"}
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      {state === "sent" ? (
        <Stack
          spacing={1.5}
          sx={{ px: 2, pt: 4, pb: 6, alignItems: "flex-start" }}
        >
          <CheckCircleOutlined sx={{ fontSize: 36, color: "success.main" }} />
          <Typography variant="h6" component="h2" sx={{ fontWeight: 750 }}>
            Pickup requested
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {trackingCode ? `Order ${trackingCode} is` : "Your order is"}{" "}
            waiting for a rider. We’ll confirm: {sentSummary}. You can follow it
            from your orders once a rider picks it up.
          </Typography>
          <Button
            fullWidth
            variant="contained"
            size="large"
            component={Link}
            href="/orders"
            sx={{ minHeight: 52, mt: 2 }}
          >
            View my orders
          </Button>
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            size="large"
            onClick={() => router.push("/home")}
            sx={{ minHeight: 52 }}
          >
            Back to home
          </Button>
        </Stack>
      ) : (
        <Box
          component="form"
          noValidate
          onSubmit={handleSubmit}
          sx={{
            px: 2,
            pt: 2.5,
            pb: "calc(120px + env(safe-area-inset-bottom))",
            display: "grid",
            gap: 4,
          }}
        >
          {step === "route" && (
            <>
              <Section id="heading-pickup" title="Pickup">
                <MapTile
                  href="/pickup/map"
                  point={draft.pickupPoint}
                  label="pickup spot"
                />

                <Field
                  id="pickup-address"
                  label="Pickup address"
                  error={shown("pickupAddress")}
                  help="Add the floor, unit or a landmark so the rider finds you."
                >
                  <OutlinedInput
                    id="pickup-address"
                    fullWidth
                    required
                    autoComplete="street-address"
                    value={draft.pickupAddress}
                    onChange={(event) =>
                      patch({ pickupAddress: event.target.value })
                    }
                    onBlur={() => touch("pickupAddress")}
                    error={Boolean(shown("pickupAddress"))}
                    inputProps={aria("pickupAddress")}
                    placeholder="House, street, township"
                  />
                </Field>

                <Field
                  id="pickup-phone"
                  label="Phone for the rider"
                  optional
                  error={shown("contactPhone")}
                  help="The rider calls this number on arrival."
                >
                  <OutlinedInput
                    id="pickup-phone"
                    fullWidth
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={draft.contactPhone}
                    onChange={(event) =>
                      patch({ contactPhone: event.target.value })
                    }
                    onBlur={() => touch("contactPhone")}
                    error={Boolean(shown("contactPhone"))}
                    inputProps={aria("contactPhone")}
                    placeholder="09 123 456 789"
                  />
                </Field>
              </Section>

              <Section id="heading-delivery" title="Deliver to">
                {recents.length > 0 && (
                  <Box
                    role="group"
                    aria-label="Recent recipients"
                    sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
                  >
                    {recents.map((person) => (
                      <Button
                        key={person.phone}
                        variant="outlined"
                        color="secondary"
                        onClick={() => applyRecipient(person)}
                        sx={{
                          minHeight: 44,
                          borderRadius: "999px",
                          textTransform: "none",
                        }}
                      >
                        {person.name}
                      </Button>
                    ))}
                  </Box>
                )}

                <MapTile
                  href="/pickup/map/delivery"
                  point={draft.deliveryPoint}
                  label="delivery spot"
                />

                <Field
                  id="delivery-address"
                  label="Delivery address"
                  error={shown("deliveryAddress")}
                >
                  <Box sx={{ position: "relative" }}>
                    <OutlinedInput
                      id="delivery-address"
                      fullWidth
                      required
                      autoComplete="off"
                      value={draft.deliveryAddress}
                      onChange={(event) => {
                        deliveryPicked.current = false;
                        setSuggestOpen(true);
                        patch({
                          deliveryAddress: event.target.value,
                          deliveryPoint: null,
                        });
                      }}
                      onFocus={() => setSuggestOpen(true)}
                      onBlur={() => {
                        touch("deliveryAddress");
                        window.setTimeout(() => setSuggestOpen(false), 150);
                      }}
                      error={Boolean(shown("deliveryAddress"))}
                      inputProps={aria("deliveryAddress")}
                      placeholder="Recipient’s street and township"
                    />
                    {suggestOpen && suggestions.length > 0 && (
                      <Box
                        component="ul"
                        aria-label="Matching addresses"
                        sx={{
                          position: "absolute",
                          zIndex: 5,
                          left: 0,
                          right: 0,
                          top: "calc(100% + 4px)",
                          m: 0,
                          p: 0,
                          listStyle: "none",
                          bgcolor: "background.paper",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: "12px",
                          boxShadow: "0 8px 24px rgb(15 23 42 / 0.16)",
                          overflow: "hidden",
                        }}
                      >
                        {suggestions.map((place) => (
                          <li key={place.id}>
                            <Box
                              component="button"
                              type="button"
                              onPointerDown={(event) => event.preventDefault()}
                              onClick={() => chooseDelivery(place)}
                              sx={{
                                all: "unset",
                                boxSizing: "border-box",
                                display: "block",
                                width: "100%",
                                minHeight: 52,
                                px: 2,
                                py: 1,
                                cursor: "pointer",
                                "&:focus-visible": {
                                  outline: "2px solid",
                                  outlineColor: "primary.main",
                                  outlineOffset: -2,
                                },
                              }}
                            >
                              <Typography sx={{ fontWeight: 650 }}>
                                {place.name}
                              </Typography>
                              <Typography
                                variant="body2"
                                noWrap
                                sx={{ color: "text.secondary" }}
                              >
                                {place.detail}
                              </Typography>
                            </Box>
                          </li>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Field>

                <Field
                  id="recipient-name"
                  label="Recipient name"
                  error={shown("recipientName")}
                >
                  <OutlinedInput
                    id="recipient-name"
                    fullWidth
                    required
                    autoComplete="off"
                    value={draft.recipientName}
                    onChange={(event) =>
                      patch({ recipientName: event.target.value })
                    }
                    onBlur={() => touch("recipientName")}
                    error={Boolean(shown("recipientName"))}
                    inputProps={aria("recipientName")}
                    placeholder="Who receives it?"
                  />
                </Field>

                <Field
                  id="recipient-phone"
                  label="Recipient phone"
                  error={shown("recipientPhone")}
                  help="The rider calls this number at the door."
                >
                  <OutlinedInput
                    id="recipient-phone"
                    fullWidth
                    required
                    type="tel"
                    autoComplete="off"
                    inputMode="tel"
                    value={draft.recipientPhone}
                    onChange={(event) =>
                      patch({ recipientPhone: event.target.value })
                    }
                    onBlur={() => touch("recipientPhone")}
                    error={Boolean(shown("recipientPhone"))}
                    inputProps={aria("recipientPhone")}
                    placeholder="09 123 456 789"
                  />
                </Field>
              </Section>
            </>
          )}
          {step === "details" && (
            <>
              <Section id="heading-parcel" title="Parcel">
                <Box>
                  <Typography
                    id="parcel-kind-label"
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 1 }}
                  >
                    What are you sending?
                  </Typography>
                  <Box
                    role="group"
                    aria-labelledby="parcel-kind-label"
                    sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
                  >
                    {parcelKinds.map((kind) => (
                      <Button
                        key={kind}
                        aria-pressed={draft.parcelKind === kind}
                        variant={
                          draft.parcelKind === kind ? "contained" : "outlined"
                        }
                        color={
                          draft.parcelKind === kind ? "primary" : "secondary"
                        }
                        onClick={() => patch({ parcelKind: kind })}
                        sx={{
                          minHeight: 44,
                          borderRadius: "999px",
                          textTransform: "none",
                        }}
                      >
                        {kind}
                      </Button>
                    ))}
                  </Box>
                </Box>

                <Box>
                  <Typography
                    id="parcel-size-label"
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 1 }}
                  >
                    Size
                  </Typography>
                  <Choice
                    label="Parcel size"
                    value={draft.parcelSize}
                    options={parcelSizes.map((size) => ({
                      value: size.value,
                      caption: size.hint,
                    }))}
                    onChange={(parcelSize) => patch({ parcelSize })}
                  />
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography id="fragile-label" sx={{ fontWeight: 700 }}>
                      Handle with care
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Glass, electronics or anything that breaks.
                    </Typography>
                  </Box>
                  <Switch
                    checked={draft.fragile}
                    onChange={(event) =>
                      patch({ fragile: event.target.checked })
                    }
                    slotProps={{
                      input: { "aria-labelledby": "fragile-label" },
                    }}
                  />
                </Box>

                <Field
                  id="parcel-details"
                  label="Details"
                  optional={draft.parcelKind !== "Other"}
                  error={shown("parcelDetails")}
                >
                  <OutlinedInput
                    id="parcel-details"
                    fullWidth
                    multiline
                    minRows={2}
                    value={draft.parcelDetails}
                    onChange={(event) =>
                      patch({ parcelDetails: event.target.value })
                    }
                    onBlur={() => touch("parcelDetails")}
                    error={Boolean(shown("parcelDetails"))}
                    inputProps={aria("parcelDetails")}
                    placeholder="Two shirts and a phone case"
                  />
                </Field>

                <Field
                  id="cod-amount"
                  label="Cash to collect on delivery (MMK)"
                  optional
                  error={shown("codAmount")}
                  help={
                    cod > 0
                      ? `The rider collects ${cod.toLocaleString("en-US")} MMK from the recipient.`
                      : "Leave empty if the recipient pays nothing."
                  }
                >
                  <OutlinedInput
                    id="cod-amount"
                    fullWidth
                    inputMode="numeric"
                    value={draft.codAmount}
                    onChange={(event) =>
                      patch({
                        codAmount: event.target.value.replace(/[,\s]/g, ""),
                      })
                    }
                    onBlur={() => touch("codAmount")}
                    error={Boolean(shown("codAmount"))}
                    inputProps={aria("codAmount")}
                    placeholder="0"
                  />
                </Field>
              </Section>

              <Section id="heading-time" title="Pickup time">
                <Choice
                  label="Pickup day"
                  value={draft.day}
                  options={pickupDays.map((value) => ({ value }))}
                  onChange={(day) => patch({ day })}
                />
                <Choice
                  label="Pickup window"
                  value={draft.window}
                  options={pickupWindows.map((item) => ({
                    value: item.value,
                    caption: item.hours,
                  }))}
                  onChange={(window) => patch({ window })}
                />
                <Field id="pickup-notes" label="Note for the rider" optional>
                  <OutlinedInput
                    id="pickup-notes"
                    fullWidth
                    multiline
                    minRows={2}
                    value={draft.notes}
                    onChange={(event) => patch({ notes: event.target.value })}
                    placeholder="Gate code, ring twice, ask for U Mya"
                  />
                </Field>
              </Section>
            </>
          )}

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
            {trip && !error && (
              <Typography
                variant="body2"
                sx={{ mb: 1, color: "text.secondary" }}
              >
                {trip}
              </Typography>
            )}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={state === "sending"}
              sx={{ minHeight: 52 }}
            >
              {step === "route"
                ? "Continue"
                : state === "sending"
                  ? "Sending request…"
                  : "Request pickup"}
            </Button>
          </Box>
        </Box>
      )}
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
