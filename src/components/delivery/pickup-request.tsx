"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import Close from "@mui/icons-material/Close";
import ExpandMore from "@mui/icons-material/ExpandMore";
import MapOutlined from "@mui/icons-material/MapOutlined";
import MyLocationOutlined from "@mui/icons-material/MyLocationOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { CustomerHeader } from "@/components/delivery/customer-home";
import { CustomerBottomNav } from "@/components/delivery/customer-pages";
import { Loader } from "@/components/delivery/loader";
import {
  FeeBreakdown,
  PayAfterRequest,
  PayerChoice,
  PayWhenChoice,
  RewardsControl,
} from "@/components/delivery/payment-picker";
import { AddressField } from "@/components/delivery/pickup-address-field";
import { useBackNavigation } from "@/components/delivery/use-back-navigation";
import { usePickupDraft } from "@/components/delivery/use-pickup-draft";
import {
  type PickupRewards,
  usePickupRewards,
} from "@/components/delivery/use-pickup-rewards";
import { useRoadDistance } from "@/components/delivery/use-road-distance";
import {
  createCustomerPickupOrder,
  fetchPaymentSandbox,
  recordOrderFee,
  redeemOrderRewards,
} from "@/lib/delivery/actions";
import {
  estimateDeliveryFee,
  type FeeEstimate,
  PARCEL_WEIGHT_KG,
  roadDistanceKm,
} from "@/lib/delivery/delivery-fee";
import { currency } from "@/lib/delivery/format";
import { hasMapbox, reverseGeocode } from "@/lib/delivery/mapbox";
import {
  type PaymentMethod,
  paymentMethodInfo,
  planPickupPayment,
} from "@/lib/delivery/payment-methods";
import {
  availableWindows,
  describeParcel,
  foodPresets,
  formatKyat,
  formatMyanmarPhone,
  type PickupDraft,
  type PickupErrors,
  parcelKinds,
  parcelSizes,
  parseCod,
  pickupDays,
  scheduleLabel,
  validateAddresses,
  validateDetails,
} from "@/lib/delivery/pickup-draft";
import { signInHref } from "@/lib/delivery/return-to";
import { normalizeCouponCode, withRewards } from "@/lib/delivery/rewards";
import { usePermissionRecovery } from "@/lib/delivery/use-permission-recovery";
import { createClient } from "@/lib/supabase/client";

export type PickupStep = "route" | "details" | "payment" | "review";
type GpsState = "idle" | "locating" | "ready" | "denied" | "unavailable";

const STEPS: { id: PickupStep; title: string; href: string }[] = [
  { id: "route", title: "Pickup and delivery", href: "/pickup" },
  { id: "details", title: "Parcel and contacts", href: "/pickup/details" },
  { id: "payment", title: "Delivery fee", href: "/pickup/payment" },
  { id: "review", title: "Review and request", href: "/pickup/review" },
];

/** The step-1 form; the fixed Next button submits it by id. */
const ADDRESSES_FORM_ID = "pickup-addresses-form";

/** DESIGN.md: the chosen segment is Dispatch Navy, not MUI's grey fill. */
const selectedSegmentSx = {
  "& .MuiToggleButton-root.Mui-selected": {
    bgcolor: "secondary.main",
    color: "secondary.contrastText",
    "&:hover": { bgcolor: "secondary.main" },
  },
};

/** Plain-language reasons a request can fail, never a raw database message. */
export function friendlyPickupError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  if (/only customer accounts/i.test(message))
    return "Pickup requests are for customer accounts. Sign in with a customer account to continue.";
  if (/sign in/i.test(message) || /42501|jwt|not authenticated/i.test(message))
    return "Your session has ended. Sign in again and your request will still be here.";
  if (/22023|required|blank|invalid/i.test(message))
    return "Some details are missing or not valid. Check each step and try again.";
  if (/fetch|network|load failed|timeout|offline/i.test(message))
    return "We couldn’t reach Oern. Check your connection and try again; your details are saved.";
  return "We couldn’t send your request. Your details are saved; try again in a moment.";
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
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
      </Typography>
      {children}
      {error ? (
        <Typography
          id={`${id}-error`}
          role="alert"
          variant="caption"
          sx={{
            display: "block",
            mt: 0.5,
            color: "error.main",
            fontWeight: 600,
          }}
        >
          {error}
        </Typography>
      ) : hint ? (
        <Typography
          id={`${id}-hint`}
          variant="caption"
          sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
        >
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

function TextInput({
  id,
  value,
  onChange,
  onBlur,
  error,
  hint,
  ...rest
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  minRows?: number;
  inputMode?: "text" | "tel" | "numeric";
  enterKeyHint?: "next" | "done" | "go";
  autoComplete?: string;
  type?: string;
  maxLength?: number;
}) {
  const { inputMode, enterKeyHint, autoComplete, type, maxLength, ...input } =
    rest;
  return (
    <OutlinedInput
      fullWidth
      id={id}
      value={value}
      error={Boolean(error)}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      inputProps={{
        inputMode,
        enterKeyHint,
        autoComplete,
        type,
        maxLength,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error
          ? `${id}-error`
          : hint
            ? `${id}-hint`
            : undefined,
      }}
      {...input}
    />
  );
}

/** Chrome shared by every step: header, content, one bottom action. */
function PickupShell({
  step,
  onBack,
  tabBar,
  action,
  children,
}: {
  step: PickupStep;
  onBack: () => void;
  tabBar?: boolean;
  action: ReactNode;
  children: ReactNode;
}) {
  const index = STEPS.findIndex((item) => item.id === step);
  return (
    <main className="customer-app pickup-app">
      <CustomerHeader
        title={STEPS[index]?.title ?? "Request a pickup"}
        subtitle={`Step ${index + 1} of ${STEPS.length}`}
        isAuthenticated={false}
        unreadCount={0}
        showBell={false}
        onBack={onBack}
      />
      <Box
        sx={{
          px: 2,
          pt: 1,
          // Clear the fixed action, and the tab bar when this step is a tab root.
          pb: tabBar
            ? "calc(var(--customer-nav-height, 80px) + 81px + 24px + env(safe-area-inset-bottom))"
            : "calc(120px + env(safe-area-inset-bottom))",
          display: "grid",
          gap: 2,
        }}
      >
        {children}
      </Box>
      <Box
        className="pickup-action"
        sx={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          // Above the tab bar on the first step, at the bottom on the rest.
          bottom: tabBar
            ? "calc(var(--customer-nav-height, 80px) + env(safe-area-inset-bottom))"
            : 0,
          width: "min(100%, var(--customer-canvas, 480px))",
          px: 2,
          pt: 1.5,
          pb: tabBar ? 2 : "calc(16px + env(safe-area-inset-bottom))",
          bgcolor: "background.default",
          borderTop: "1px solid",
          borderColor: "divider",
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        {action}
      </Box>
      {tabBar && <CustomerBottomNav activeId="pickup" />}
    </main>
  );
}

function PinChip({
  label,
  removeLabel,
  onDelete,
}: {
  label: string;
  removeLabel: string;
  onDelete: () => void;
}) {
  return (
    <Chip
      icon={<CheckCircleOutlined />}
      label={label}
      onDelete={onDelete}
      deleteIcon={<Close titleAccess={removeLabel} />}
      variant="outlined"
      sx={{
        mt: 1,
        bgcolor: "grey.100",
        color: "text.primary",
        borderColor: "transparent",
        "& .MuiChip-icon": { color: "text.primary" },
        "& .MuiChip-deleteIcon": {
          color: "text.secondary",
          "&:hover": { color: "text.primary" },
        },
      }}
    />
  );
}

type Side = "pickup" | "delivery";

const SIDE_COPY: Record<
  Side,
  {
    label: string;
    placeholder: string;
    pinLabel: string;
    removeLabel: string;
    mapHref: string;
  }
> = {
  pickup: {
    label: "Pickup address",
    placeholder: "e.g. 42 Pyay Road, Kamayut",
    pinLabel: "Pickup pin set",
    removeLabel: "Remove pickup pin",
    mapHref: "/pickup/map",
  },
  delivery: {
    label: "Delivery address",
    placeholder: "e.g. 12 Baho Road, Sanchaung",
    pinLabel: "Delivery pin set",
    removeLabel: "Remove delivery pin",
    mapHref: "/pickup/map/delivery",
  },
};

/** What a fix is good enough for: a pin within this many metres needs no nudge. */
const GOOD_FIX_METRES = 150;

/** The price so far, so nobody reaches step 3 to learn what the trip costs. */
function FeePreview({
  estimate,
  roadKm,
  pinned,
}: {
  estimate: FeeEstimate | null;
  /** True once the distance is a driving distance rather than a straight-line guess. */
  roadKm: boolean;
  pinned: boolean;
}) {
  return (
    <Box
      component="section"
      aria-label="Delivery fee estimate"
      sx={{
        p: 2,
        borderRadius: "16px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Delivery fee estimate
      </Typography>
      {estimate ? (
        <>
          <Typography
            sx={{
              fontSize: 24,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {currency.format(estimate.total)}
          </Typography>
          {estimate.zones && estimate.zones.label !== "Base fee" && (
            <Typography variant="caption" sx={{ display: "block" }}>
              {estimate.zones.local
                ? `Within ${estimate.zones.pickup.zone}`
                : `${estimate.zones.pickup.zone} to ${estimate.zones.delivery.zone}`}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {roadKm ? "By road" : "About"} {estimate.distanceKm.toFixed(1)} km
            {roadKm ? "" : " in a straight line, adjusted for roads"}. Coupons
            and points come off at the next step.
          </Typography>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {pinned
            ? "Working out the distance…"
            : "Pick a suggestion, use your location or choose a spot on the map for both addresses and the price shows here."}
        </Typography>
      )}
    </Box>
  );
}

function AddressesStep({
  draft,
  update,
  errors,
  estimate,
  roadKm,
  next,
  onBack,
}: {
  draft: PickupDraft;
  update: (patch: Partial<PickupDraft>) => void;
  errors: PickupErrors;
  estimate: FeeEstimate | null;
  roadKm: boolean;
  next: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [gps, setGps] = useState<Record<Side, GpsState>>({
    pickup: "idle",
    delivery: "idle",
  });
  const [accuracy, setAccuracy] = useState<Record<Side, number | null>>({
    pickup: null,
    delivery: null,
  });
  const [touched, setTouched] = useState({ pickup: false, delivery: false });
  const [attempted, setAttempted] = useState(false);
  /**
   * The address text each pin was set for. Editing the text afterwards leaves
   * the pin where it is, so the price survives, and this remembers that the
   * two may no longer describe the same spot.
   */
  const [pinText, setPinText] = useState<Record<Side, string | null>>({
    pickup: null,
    delivery: null,
  });
  const show = (key: Side) => attempted || touched[key];
  const point = (side: Side) =>
    side === "pickup" ? draft.pickupPoint : draft.deliveryPoint;
  const address = (side: Side) =>
    side === "pickup" ? draft.pickupAddress : draft.deliveryAddress;
  const patch = (side: Side, text: string, pin: PickupDraft["pickupPoint"]) =>
    update(
      side === "pickup"
        ? { pickupAddress: text, pickupPoint: pin }
        : { deliveryAddress: text, deliveryPoint: pin },
    );
  /** Move a pin and remember the words it was placed for. */
  const setPin = (
    side: Side,
    text: string,
    pin: PickupDraft["pickupPoint"],
  ) => {
    patch(side, text, pin);
    setPinText((current) => ({ ...current, [side]: pin ? text : null }));
  };
  /** True when the address has been edited since its pin was placed. */
  const pinStale = (side: Side) =>
    Boolean(point(side)) &&
    pinText[side] !== null &&
    pinText[side] !== address(side).trim();
  const setGpsFor = (side: Side, state: GpsState) =>
    setGps((current) => ({ ...current, [side]: state }));

  /**
   * Pin the person's current position. They asked for it, so the address
   * follows the pin even when something was typed: text that names another
   * place would otherwise price the wrong trip.
   */
  function locate(side: Side, highAccuracy = true) {
    if (!("geolocation" in navigator)) {
      setGpsFor(side, "unavailable");
      return;
    }
    setGpsFor(side, "locating");
    navigator.geolocation.getCurrentPosition(
      async (fix) => {
        const here = {
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
        };
        setAccuracy((current) => ({
          ...current,
          [side]: Math.round(fix.coords.accuracy),
        }));
        // Pin at once so the price can start; the name follows when it arrives.
        setPin(side, address(side).trim() || "Current location", here);
        setGpsFor(side, "ready");
        const name = await reverseGeocode(here);
        if (name) setPin(side, name, here);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setGpsFor(side, "denied");
        else if (highAccuracy) locate(side, false);
        else setGpsFor(side, "unavailable");
      },
      { enableHighAccuracy: highAccuracy, timeout: 12_000, maximumAge: 30_000 },
    );
  }

  usePermissionRecovery({
    permission: "geolocation",
    enabled: gps.pickup === "denied" || gps.delivery === "denied",
    onGranted: () => {
      if (gps.pickup === "denied") locate("pickup");
      if (gps.delivery === "denied") locate("delivery");
    },
  });

  function submit() {
    setAttempted(true);
    if (Object.keys(errors).length === 0) next();
  }

  const pinned = Boolean(draft.pickupPoint && draft.deliveryPoint);

  function renderSide(side: Side) {
    const copy = SIDE_COPY[side];
    const pin = point(side);
    const state = gps[side];
    const err = show(side)
      ? side === "pickup"
        ? errors.pickupAddress
        : errors.deliveryAddress
      : undefined;
    const other = point(side === "pickup" ? "delivery" : "pickup");
    return (
      <Box sx={{ display: "grid", gap: 1 }}>
        <Field id={`${side}-address`} label={copy.label} error={err}>
          <AddressField
            id={`${side}-address`}
            value={address(side)}
            placeholder={copy.placeholder}
            near={pin ?? other}
            error={err}
            autoComplete={side === "pickup" ? "street-address" : undefined}
            // Typing changes the wording, not the spot. Keep the pin so the
            // price survives, and mark it for a check on the map below.
            onText={(text) => patch(side, text, pin)}
            onPick={(place) => setPin(side, place.address, place.point)}
            onBlur={() => setTouched((t) => ({ ...t, [side]: true }))}
          />
        </Field>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => locate(side)}
            disabled={state === "locating"}
            startIcon={
              state === "locating" ? (
                <Loader compact label="Finding your location…" />
              ) : (
                <MyLocationOutlined fontSize="small" />
              )
            }
            sx={{ minHeight: 48 }}
          >
            {state === "locating" ? "Finding you…" : "Use my location"}
          </Button>
          {hasMapbox && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<MapOutlined />}
              onClick={() => router.push(copy.mapHref)}
              sx={{ minHeight: 48 }}
            >
              {side === "pickup" ? "Pickup on map" : "Delivery on map"}
            </Button>
          )}
        </Stack>
        {pin ? (
          <Box>
            <PinChip
              label={copy.pinLabel}
              removeLabel={copy.removeLabel}
              onDelete={() => setPin(side, address(side), null)}
            />
            {pinStale(side) && (
              <Alert
                severity="warning"
                sx={{ mt: 0.5, borderRadius: "12px" }}
                action={
                  hasMapbox ? (
                    <Button
                      color="inherit"
                      size="small"
                      startIcon={<MapOutlined />}
                      onClick={() => router.push(copy.mapHref)}
                    >
                      Check
                    </Button>
                  ) : undefined
                }
              >
                The address changed, but the pin is still where it was. Check
                the pin so the price matches the address.
              </Alert>
            )}
            {state === "ready" && accuracy[side] !== null && (
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 0.5 }}
                color={
                  (accuracy[side] ?? 0) > GOOD_FIX_METRES
                    ? "warning.main"
                    : "text.secondary"
                }
              >
                {(accuracy[side] ?? 0) > GOOD_FIX_METRES
                  ? `Your location is only accurate to about ${accuracy[side]} m. Check the pin on the map.`
                  : `Located to within about ${accuracy[side]} m.`}
              </Typography>
            )}
          </Box>
        ) : (
          address(side).trim() && (
            <Typography variant="caption" color="text.secondary">
              Not pinned yet. Pick a suggestion or use the map so the price is
              exact.
            </Typography>
          )
        )}
        {state === "denied" && (
          <Alert
            severity="warning"
            sx={{ borderRadius: "12px" }}
            action={
              <Button
                color="inherit"
                size="small"
                startIcon={<RefreshOutlined />}
                onClick={() => locate(side)}
              >
                Try again
              </Button>
            }
          >
            Location is blocked for this site. Allow it in your browser
            settings, or type the address above.
          </Alert>
        )}
        {state === "unavailable" && (
          <Alert severity="info" sx={{ borderRadius: "12px" }}>
            We couldn’t get your location. Type the address, or choose it on the
            map.
          </Alert>
        )}
      </Box>
    );
  }

  return (
    <PickupShell
      step="route"
      onBack={onBack}
      tabBar
      action={
        <Button
          type="submit"
          form={ADDRESSES_FORM_ID}
          fullWidth
          variant="contained"
          size="large"
        >
          Next: parcel and contacts
        </Button>
      }
    >
      <Box
        component="form"
        id={ADDRESSES_FORM_ID}
        aria-label="Where to collect and deliver"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        sx={{ display: "grid", gap: 2.5 }}
      >
        {renderSide("pickup")}
        {renderSide("delivery")}
        <FeePreview estimate={estimate} roadKm={roadKm} pinned={pinned} />
      </Box>
    </PickupShell>
  );
}

function DetailsStep({
  draft,
  update,
  errors,
  estimate,
  roadKm,
  next,
  onBack,
}: {
  draft: PickupDraft;
  update: (patch: Partial<PickupDraft>) => void;
  errors: PickupErrors;
  estimate: FeeEstimate | null;
  roadKm: boolean;
  next: () => void;
  onBack: () => void;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const show = (key: keyof PickupErrors) =>
    attempted || touched[key] ? errors[key] : undefined;
  const touch = (key: string) => setTouched((t) => ({ ...t, [key]: true }));
  const windows = availableWindows(draft.day);

  /** Enter moves to the next visible field, and sends the step from the last. */
  function advance(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      target.tagName !== "INPUT"
    )
      return;
    event.preventDefault();
    const fields = Array.from(
      event.currentTarget.querySelectorAll<HTMLInputElement>(
        "input:not([type=hidden]):not([disabled])",
      ),
    ).filter((field) => field.getClientRects().length > 0);
    const following = fields[fields.indexOf(target as HTMLInputElement) + 1];
    if (following) following.focus();
    else submit();
  }

  function submit() {
    setAttempted(true);
    // Optional fields hide behind the disclosure; open it when one is wrong.
    if (errors.contactPhone || errors.codAmount) setMoreOpen(true);
    if (Object.keys(errors).length === 0) next();
  }

  return (
    <PickupShell
      step="details"
      onBack={onBack}
      action={
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={submit}
          sx={{ minHeight: 52 }}
        >
          Next: payment
        </Button>
      }
    >
      <Box onKeyDown={advance} sx={{ display: "contents" }}>
        <Field
          id="recipient-name"
          label="Recipient name"
          error={show("recipientName")}
        >
          <TextInput
            id="recipient-name"
            value={draft.recipientName}
            onChange={(value) => update({ recipientName: value })}
            onBlur={() => {
              touch("recipientName");
              update({ recipientName: draft.recipientName.trim() });
            }}
            placeholder="Who should receive it?"
            autoComplete="name"
            enterKeyHint="next"
            maxLength={120}
            error={show("recipientName")}
          />
        </Field>
        <Field
          id="recipient-phone"
          label="Recipient phone"
          error={show("recipientPhone")}
        >
          <TextInput
            id="recipient-phone"
            value={draft.recipientPhone}
            onChange={(value) => update({ recipientPhone: value })}
            onBlur={() => {
              touch("recipientPhone");
              update({
                recipientPhone: formatMyanmarPhone(draft.recipientPhone),
              });
            }}
            placeholder="09 xxx xxx xxx"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            maxLength={30}
            error={show("recipientPhone")}
          />
        </Field>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Pickup time
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={draft.day}
            onChange={(_, value) => {
              if (!value) return;
              const open = availableWindows(value);
              update({
                day: value,
                window: open.some((w) => w.value === draft.window)
                  ? draft.window
                  : (open[0]?.value ?? "Morning"),
              });
            }}
            aria-label="Pickup day"
            sx={{ mb: 1, ...selectedSegmentSx }}
          >
            {pickupDays.map((day) => (
              <ToggleButton key={day} value={day} sx={{ minHeight: 48 }}>
                {day}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={draft.window}
            onChange={(_, value) => value && update({ window: value })}
            aria-label="Pickup window"
            sx={selectedSegmentSx}
          >
            {windows.map((window) => (
              <ToggleButton
                key={window.value}
                value={window.value}
                sx={{ minHeight: 48, flexDirection: "column", lineHeight: 1.2 }}
              >
                {window.value}
                <Typography variant="caption" sx={{ color: "inherit" }}>
                  {window.hours}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 0.75, color: "text.secondary" }}
          >
            Times are Yangon time. We confirm your requested window once a rider
            is assigned.
          </Typography>
          {errors.window && (
            <Typography
              role="alert"
              variant="caption"
              sx={{ color: "error.main" }}
            >
              {errors.window}
            </Typography>
          )}
        </Box>

        <Accordion
          disableGutters
          elevation={0}
          expanded={moreOpen}
          onChange={(_e, open) => setMoreOpen(open)}
          sx={{
            bgcolor: "grey.100",
            borderRadius: "16px !important",
            "&::before": { display: "none" },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            aria-controls="pickup-more-panel"
            id="pickup-more-header"
            sx={{ minHeight: 56, px: 2 }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              More details (optional)
            </Typography>
          </AccordionSummary>
          <AccordionDetails
            id="pickup-more-panel"
            sx={{ px: 2, pt: 0, pb: 2, display: "grid", gap: 2 }}
          >
            <Field
              id="contact-phone"
              label="Your phone for the rider"
              error={show("contactPhone")}
              hint="Defaults to the number on your account."
            >
              <TextInput
                id="contact-phone"
                value={draft.contactPhone}
                onChange={(value) => update({ contactPhone: value })}
                onBlur={() => {
                  touch("contactPhone");
                  update({
                    contactPhone: formatMyanmarPhone(draft.contactPhone),
                  });
                }}
                placeholder="09 xxx xxx xxx"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={30}
                error={show("contactPhone")}
              />
            </Field>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                What is it?
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {parcelKinds.map((kind) => (
                  <Chip
                    key={kind}
                    clickable
                    role="radio"
                    aria-checked={draft.parcelKind === kind}
                    label={kind}
                    onClick={() =>
                      update({
                        parcelKind: draft.parcelKind === kind ? null : kind,
                      })
                    }
                    color={draft.parcelKind === kind ? "secondary" : "default"}
                  />
                ))}
              </Stack>
              {draft.parcelKind === "Food" && (
                <Box
                  sx={{
                    mt: 1.25,
                    p: 1.25,
                    borderRadius: "12px",
                    bgcolor: "grey.50",
                    border: 1,
                    borderColor: "grey.200",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 650,
                      color: "text.secondary",
                      display: "block",
                      mb: 0.75,
                    }}
                  >
                    Quick food suggestions:
                  </Typography>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                    {foodPresets.map((preset) => {
                      const isSelected = draft.parcelDetails === preset.details;
                      return (
                        <Chip
                          key={preset.label}
                          size="small"
                          clickable
                          variant={isSelected ? "filled" : "outlined"}
                          color={isSelected ? "secondary" : "default"}
                          label={preset.label}
                          onClick={() =>
                            update({
                              parcelDetails: preset.details,
                              parcelSize: preset.size,
                              fragile: preset.fragile,
                            })
                          }
                        />
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Size
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={draft.parcelSize}
                onChange={(_, value) => value && update({ parcelSize: value })}
                aria-label="Parcel size"
                sx={selectedSegmentSx}
              >
                {parcelSizes.map((size) => (
                  <ToggleButton
                    key={size.value}
                    value={size.value}
                    sx={{
                      minHeight: 48,
                      flexDirection: "column",
                      lineHeight: 1.2,
                    }}
                  >
                    {size.value}
                    <Typography variant="caption" sx={{ color: "inherit" }}>
                      {size.hint}
                    </Typography>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <FormControlLabel
                sx={{ mt: 0.5, minHeight: 48 }}
                control={
                  <Checkbox
                    checked={draft.fragile}
                    onChange={(event) =>
                      update({ fragile: event.target.checked })
                    }
                  />
                }
                label="Fragile, handle with care"
              />
            </Box>
            <Field id="parcel-details" label="Parcel details">
              <TextInput
                id="parcel-details"
                multiline
                minRows={2}
                value={draft.parcelDetails}
                onChange={(value) => update({ parcelDetails: value })}
                placeholder="Contents, brand, anything the rider should know"
                maxLength={300}
              />
            </Field>
            <Field
              id="cod-amount"
              label="Cash on delivery (MMK)"
              error={show("codAmount")}
              hint="Leave blank if the recipient pays nothing on delivery."
            >
              <TextInput
                id="cod-amount"
                value={draft.codAmount}
                onChange={(value) => update({ codAmount: value })}
                onBlur={() => {
                  touch("codAmount");
                  update({ codAmount: formatKyat(draft.codAmount) });
                }}
                placeholder="0"
                inputMode="numeric"
                enterKeyHint="done"
                maxLength={12}
                error={show("codAmount")}
              />
            </Field>
            <Field id="pickup-notes" label="Note for the rider">
              <TextInput
                id="pickup-notes"
                multiline
                minRows={2}
                value={draft.notes}
                onChange={(value) => update({ notes: value })}
                placeholder="Landmark, gate code, who to ask for"
                maxLength={300}
              />
            </Field>
          </AccordionDetails>
        </Accordion>
        <FeePreview
          estimate={estimate}
          roadKm={roadKm}
          pinned={Boolean(draft.pickupPoint && draft.deliveryPoint)}
        />
      </Box>
    </PickupShell>
  );
}

function SummaryRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "center", py: 1.25 }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 650, overflowWrap: "anywhere" }}
        >
          {value}
        </Typography>
      </Box>
      <Button
        component={Link}
        href={href}
        color="secondary"
        aria-label={`Edit ${label.toLowerCase()}`}
        sx={{
          minHeight: 48,
          minWidth: 48,
          fontWeight: 700,
          fontSize: 14,
          textDecoration: "underline",
          textUnderlineOffset: "3px",
          "&:hover": { textDecoration: "underline" },
        }}
      >
        Edit
      </Button>
    </Stack>
  );
}

function draftEstimate(draft: PickupDraft, routedKm: number | null = null) {
  const distanceKm =
    routedKm ?? roadDistanceKm(draft.pickupPoint, draft.deliveryPoint);
  return distanceKm === null
    ? null
    : estimateDeliveryFee({
        distanceKm,
        weightKg: PARCEL_WEIGHT_KG[draft.parcelSize],
        method: "cod",
        // Both ends set the base fee: where the parcel is collected and where
        // it is going. The pins decide; the addresses settle which township an
        // overlap belongs to.
        pickupPoint: draft.pickupPoint,
        pickupAddress: draft.pickupAddress,
        deliveryPoint: draft.deliveryPoint,
        deliveryAddress: draft.deliveryAddress,
        // How it is paid is not chosen here, so no cash handling is added.
        cashHandling: false,
      });
}

/** The method the customer chose, else cash at the door. */
function resolvePayment(draft: PickupDraft): PaymentMethod {
  // MMQR is the payment rail; CTZPay is one of the apps that can scan it.
  // Anything not explicitly paid now stays open for MMQR or cash on Track.
  return draft.payer === "me" && draft.payChoice === "now" ? "mmqr" : "cod";
}

/**
 * What the order is sent with: the delivery fee plus goods are owed until
 * payment is recorded. The sender says who pays and how; the money itself
 * moves after the request is sent, once there is a tracking code to pay
 * against.
 */
function resolveSplit(draft: PickupDraft, fee: number) {
  const method = resolvePayment(draft);
  return planPickupPayment({
    fee,
    goods: parseCod(draft.codAmount) ?? 0,
    method,
    payer: draft.payer,
    // Paying online happens on the next screen, so nothing is settled here.
    payNow: "",
  });
}

/** The fee for the review step, with any coupon or points taken off named. */
function feeSummary(estimate: FeeEstimate | null) {
  if (!estimate) return "Not calculated";
  const taken = estimate.lines.filter((line) => line.id === "discount");
  if (taken.length === 0) return currency.format(estimate.total);
  const saved = taken.reduce((sum, line) => sum - line.amount, 0);
  return `${currency.format(estimate.total)} · ${taken
    .map((line) => line.label)
    .join(" and ")} saves ${currency.format(saved)}`;
}

/** One line for the review step: who pays, how, and what is left for the door. */
function paymentSummary(
  draft: PickupDraft,
  split: ReturnType<typeof resolveSplit>,
) {
  if (draft.payer === "other")
    return `Someone else pays · ${currency.format(split.owed)} at the door or online with a pay link`;
  const label = paymentMethodInfo(resolvePayment(draft)).label;
  return `${currency.format(split.owed)} with ${label}`;
}

function PaymentStep({
  draft,
  update,
  estimate,
  rewards,
  sandbox,
  onBack,
  next,
}: {
  draft: PickupDraft;
  update: (patch: Partial<PickupDraft>) => void;
  estimate: FeeEstimate | null;
  rewards: PickupRewards;
  /** Paying in the app is available (sandbox), so the choice is shown. */
  sandbox: boolean;
  onBack: () => void;
  next: () => void;
}) {
  const cod = parseCod(draft.codAmount) ?? 0;
  const method = resolvePayment(draft);
  const split = resolveSplit(draft, estimate?.total ?? 0);
  const mine = draft.payer === "me";
  return (
    <PickupShell
      step="payment"
      onBack={onBack}
      action={
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={next}
          sx={{ minHeight: 52 }}
        >
          Next: review
        </Button>
      }
    >
      <PayerChoice
        name="pickup-payer"
        value={draft.payer}
        onChange={(payer) => update({ payer })}
        amount={split.owed}
      />
      <FeeBreakdown
        estimate={estimate}
        method={mine ? method : "cod"}
        itemCash={cod}
        flexiblePayment={!mine}
      />
      {estimate && (
        <RewardsControl
          id="pickup-coupon"
          appliedCode={normalizeCouponCode(draft.couponCode)}
          status={rewards.couponStatus}
          balance={rewards.balance}
          usePoints={draft.usePoints}
          pointsUsed={rewards.applied.pointsUsed}
          pointsDiscount={rewards.applied.pointsDiscount}
          onApply={(code) => update({ couponCode: normalizeCouponCode(code) })}
          onRemove={() => update({ couponCode: "" })}
          onUsePointsChange={(usePoints) => update({ usePoints })}
        />
      )}
      {mine ? (
        <>
          {sandbox && estimate && (
            <PayWhenChoice
              name="pickup-pay-when"
              value={draft.payChoice}
              total={split.owed}
              onChange={(payChoice) =>
                update({
                  payChoice,
                  paymentMethod: payChoice === "now" ? "mmqr" : "cod",
                })
              }
            />
          )}
          {!sandbox && (
            <p className="pay-note">
              You’ll pay after the request is sent: we send a tracking code you
              can pay against from Track, or hand cash to the rider.
            </p>
          )}
        </>
      ) : (
        <p className="pay-note">
          They can pay with a pay link you’ll get once the request is sent, or
          hand cash to the rider.
        </p>
      )}
    </PickupShell>
  );
}

function ReviewStep({
  draft,
  estimate,
  payNow,
  stage,
  submit,
  state,
  error,
  signedIn,
  onBack,
}: {
  draft: PickupDraft;
  estimate: FeeEstimate | null;
  /** The request will continue to MMQR after its tracking code is created. */
  payNow: boolean;
  /** What the button says while the request is going through. */
  stage: string;
  onBack: () => void;
  submit: () => void;
  state: "editing" | "sending";
  error: string | null;
  signedIn: boolean | null;
}) {
  const cod = parseCod(draft.codAmount) ?? 0;
  const split = resolveSplit(draft, estimate?.total ?? 0);
  return (
    <PickupShell
      step="review"
      onBack={onBack}
      action={
        <>
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
            variant="contained"
            size="large"
            disabled={state === "sending"}
            onClick={submit}
            sx={{ minHeight: 52 }}
          >
            {state === "sending"
              ? stage
              : signedIn === false
                ? "Sign in to request pickup"
                : payNow
                  ? "Request pickup and continue"
                  : "Request pickup"}
          </Button>
        </>
      }
    >
      {signedIn === false && (
        <Alert severity="info" sx={{ borderRadius: "12px" }}>
          Sign in to send this request. Everything you entered is saved and will
          be here when you come back.
        </Alert>
      )}
      <Box sx={{ "& > * + *": { borderTop: 1, borderColor: "divider" } }}>
        <SummaryRow
          label="Pickup address"
          value={draft.pickupAddress}
          href="/pickup"
        />
        <SummaryRow
          label="Delivery address"
          value={draft.deliveryAddress}
          href="/pickup"
        />
        <SummaryRow
          label="Recipient"
          value={`${draft.recipientName} · ${draft.recipientPhone}`}
          href="/pickup/details"
        />
        <SummaryRow
          label="Parcel"
          value={describeParcel(draft)
            .replace(/ · Pickup (today|tomorrow), \w+/i, "")
            // Shown as read aloud; the stored text keeps its parseable form.
            .replace(
              /^Parcel, (\w)(\w*) size/,
              (_, first: string, rest: string) =>
                `${first.toUpperCase()}${rest} parcel`,
            )}
          href="/pickup/details"
        />
        <SummaryRow
          label="Requested pickup"
          value={scheduleLabel(draft.day, draft.window)}
          href="/pickup/details"
        />
        <SummaryRow
          label="Goods to collect"
          value={cod > 0 ? currency.format(cod) : "None"}
          href="/pickup/details"
        />
      </Box>
      <Box sx={{ "& > * + *": { borderTop: 1, borderColor: "divider" } }}>
        <SummaryRow
          label="Delivery fee"
          value={feeSummary(estimate)}
          href="/pickup/payment"
        />
        <SummaryRow
          label="Payment"
          value={
            payNow
              ? `After the request is created, scan its MMQR to pay ${currency.format(split.owed)} with CTZPay or another participating app.`
              : paymentSummary(draft, split)
          }
          href="/pickup/payment"
        />
      </Box>
    </PickupShell>
  );
}

/**
 * Request a pickup in four steps: addresses, parcel and contacts, payment,
 * review.
 * The draft lives in storage, so the map screens, a sign-in or a reload never
 * cost the customer what they typed.
 */
export function PickupRequestPage({ step = "route" }: { step?: PickupStep }) {
  const router = useRouter();
  const { draft, hydrated, update, reset } = usePickupDraft();
  const [state, setState] = useState<"editing" | "sending" | "sent">("editing");
  const [stage, setStage] = useState("Sending request…");
  const [sandbox, setSandbox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [sent, setSent] = useState<{
    id: string;
    code: string;
    summary: string;
    /** Everything still owed, and how much of it the sender will pay online. */
    balance: number;
    payOnline: number;
    method: PaymentMethod;
    /** Set when the order went through but a coupon or points did not apply. */
    notice: string | null;
  } | null>(null);
  const inFlight = useRef(false);
  // Only the sender can pay as the request goes out; when someone else pays,
  // the order is sent unpaid and they settle it from the pay link.
  const payNow = sandbox && draft.payer === "me" && draft.payChoice === "now";

  // Paying in the app is offered while payments are in sandbox.
  useEffect(() => {
    if (step !== "payment" && step !== "review") return;
    let live = true;
    void fetchPaymentSandbox(createClient())
      .then((on) => {
        if (!live) return;
        setSandbox(on);
        // A saved demo choice must never leak into a live flow that has no
        // provider connection. The order stays payable from Track or in cash.
        if (!on) update({ payChoice: "later", paymentMethod: "cod" });
      })
      .catch(() => {
        if (live) update({ payChoice: "later", paymentMethod: "cod" });
      });
    return () => {
      live = false;
    };
  }, [step, update]);
  const routedKm = useRoadDistance(draft.pickupPoint, draft.deliveryPoint);
  const grossEstimate = draftEstimate(draft, routedKm);
  const rewards = usePickupRewards(
    draft,
    grossEstimate?.total ?? null,
    step === "payment" || step === "review",
  );
  const estimate = grossEstimate
    ? withRewards(
        grossEstimate,
        rewards.applied,
        normalizeCouponCode(draft.couponCode),
      )
    : null;
  const successHeading = useRef<HTMLHeadingElement | null>(null);

  const index = STEPS.findIndex((item) => item.id === step);
  const previous = STEPS[index - 1]?.href ?? "/home";
  const stepBack = useBackNavigation(previous);
  // The first step is a tab root: Back always lands on Home.
  const goBack = step === "route" ? () => router.push("/home") : stepBack;
  const addressErrors = validateAddresses(draft);
  const detailErrors = validateDetails(draft);

  // A step is only reachable once the ones before it are complete.
  useEffect(() => {
    if (!hydrated || state === "sent") return;
    if (step !== "route" && Object.keys(addressErrors).length > 0)
      router.replace("/pickup");
    else if (
      (step === "payment" || step === "review") &&
      Object.keys(detailErrors).length > 0
    )
      router.replace("/pickup/details");
  }, [hydrated, state, step, addressErrors, detailErrors, router]);

  useEffect(() => {
    if (step !== "review") return;
    let live = true;
    void createClient()
      .auth.getSession()
      .then(({ data }) => live && setSignedIn(Boolean(data.session?.user.id)));
    return () => {
      live = false;
    };
  }, [step]);

  // The success view replaces the form in place, so move focus to its heading.
  useEffect(() => {
    if (state === "sent") successHeading.current?.focus();
  }, [state]);

  async function submit() {
    if (inFlight.current) return;
    if (signedIn === false) {
      router.push(signInHref("/pickup/review"));
      return;
    }
    inFlight.current = true;
    setError(null);
    setStage("Sending request…");
    setState("sending");
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user.id) {
        setSignedIn(false);
        setState("editing");
        router.push(signInHref("/pickup/review"));
        return;
      }
      const grossFee = grossEstimate?.total ?? 0;
      const split = resolveSplit(draft, estimate?.total ?? 0);
      const result = await createCustomerPickupOrder(supabase, {
        pickupAddress: draft.pickupAddress.trim(),
        pickupLatitude: draft.pickupPoint?.latitude,
        pickupLongitude: draft.pickupPoint?.longitude,
        pickupContactPhone: draft.contactPhone,
        deliveryAddress: draft.deliveryAddress.trim(),
        deliveryLatitude: draft.deliveryPoint?.latitude,
        deliveryLongitude: draft.deliveryPoint?.longitude,
        recipientName: draft.recipientName.trim(),
        recipientPhone: draft.recipientPhone.trim(),
        // The window is written in the form the database turns into a stored
        // pickup window, so it is a real request rather than a promise.
        parcelDescription: `${describeParcel(draft)} · ${split.note}`,
        // Sent at the full fee; the discount is applied to the order next.
        codAmount: resolveSplit(draft, grossFee).codAmount,
      });
      // Lets rewards be applied later from Track; the order stands without it.
      if (grossFee > 0)
        await recordOrderFee(supabase, result.id, grossFee).catch(
          () => undefined,
        );
      let notice: string | null = null;
      let redeemed = rewards.applied.discount <= 0;
      if (!redeemed)
        try {
          await redeemOrderRewards(supabase, {
            orderId: result.id,
            fee: grossFee,
            couponCode:
              rewards.couponStatus.state === "valid"
                ? normalizeCouponCode(draft.couponCode)
                : undefined,
            points: rewards.applied.pointsUsed,
          });
          redeemed = true;
        } catch {
          notice =
            "Your request is in, but the coupon or points could not be applied. The full amount is due; contact support to fix it.";
        }
      // A real MMQR payment needs the tracking code as its transaction
      // reference. Creating the request therefore finishes first; the next
      // screen presents the payment handoff and waits for confirmation.
      const owed = redeemed ? split.owed : resolveSplit(draft, grossFee).owed;
      setSent({
        id: result.id,
        code: result.tracking_code,
        summary: scheduleLabel(draft.day, draft.window),
        balance: owed,
        payOnline: redeemed ? split.payOnline : 0,
        method: split.method,
        notice,
      });
      setState("sent");
      reset();
    } catch (cause) {
      // The draft stays; only a success clears it.
      setError(friendlyPickupError(cause));
      setState("editing");
    } finally {
      inFlight.current = false;
    }
  }

  if (state === "sent" && sent)
    return (
      <main className="customer-app pickup-app">
        <CustomerHeader
          title="Request sent"
          isAuthenticated={false}
          unreadCount={0}
          showBell={false}
        />
        <Stack spacing={1.5} sx={{ px: 2, pt: 3, pb: 6 }}>
          <CheckCircleOutlined sx={{ fontSize: 40, color: "success.main" }} />
          <Typography
            ref={successHeading}
            tabIndex={-1}
            variant="h5"
            component="h2"
            sx={{ fontWeight: 750 }}
          >
            Your tracking code is {sent.code}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            We’ve received your request for pickup {sent.summary.toLowerCase()}.
            We’ll assign a rider next; follow the order to see when.
          </Typography>
          {sent.notice && <Alert severity="warning">{sent.notice}</Alert>}
          <PayAfterRequest
            orderId={sent.id}
            code={sent.code}
            balance={sent.balance}
            payOnline={sent.payOnline}
            method={sent.method}
          />
          <Button
            component={Link}
            href={`/track?order=${encodeURIComponent(sent.id)}`}
            variant="contained"
            size="large"
            fullWidth
            sx={{ minHeight: 52 }}
          >
            View order
          </Button>
          <Button
            component={Link}
            href="/home"
            variant="outlined"
            color="secondary"
            size="large"
            fullWidth
            sx={{ minHeight: 52 }}
          >
            Back to home
          </Button>
        </Stack>
      </main>
    );

  const content =
    step === "route" ? (
      <AddressesStep
        draft={draft}
        update={update}
        errors={addressErrors}
        estimate={grossEstimate}
        roadKm={routedKm !== null}
        next={() => router.push("/pickup/details")}
        onBack={goBack}
      />
    ) : step === "details" ? (
      <DetailsStep
        draft={draft}
        update={update}
        errors={detailErrors}
        estimate={grossEstimate}
        roadKm={routedKm !== null}
        next={() => router.push("/pickup/payment")}
        onBack={goBack}
      />
    ) : step === "payment" ? (
      <PaymentStep
        draft={draft}
        update={update}
        estimate={estimate}
        rewards={rewards}
        sandbox={sandbox}
        next={() => router.push("/pickup/review")}
        onBack={goBack}
      />
    ) : (
      <ReviewStep
        draft={draft}
        estimate={estimate}
        payNow={payNow}
        stage={stage}
        submit={() => void submit()}
        state={state === "sending" ? "sending" : "editing"}
        error={error}
        signedIn={signedIn}
        onBack={goBack}
      />
    );

  return content;
}
