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
import { type ReactNode, useEffect, useRef, useState } from "react";

import { CustomerHeader } from "@/components/delivery/customer-home";
import { CustomerBottomNav } from "@/components/delivery/customer-pages";
import { Loader } from "@/components/delivery/loader";
import {
  FeeBreakdown,
  PayAfterRequest,
  PayerChoice,
  PaymentMethodPicker,
  PayNowField,
  RewardsControl,
} from "@/components/delivery/payment-picker";
import { useBackNavigation } from "@/components/delivery/use-back-navigation";
import { usePickupDraft } from "@/components/delivery/use-pickup-draft";
import {
  type PickupRewards,
  usePickupRewards,
} from "@/components/delivery/use-pickup-rewards";
import {
  createCustomerPickupOrder,
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
  isPrepaid,
  type PaymentMethod,
  paymentMethodInfo,
  planPickupPayment,
} from "@/lib/delivery/payment-methods";
import {
  availableWindows,
  describeParcel,
  foodPresets,
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
  { id: "payment", title: "Payment", href: "/pickup/payment" },
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
  autoComplete?: string;
  type?: string;
  maxLength?: number;
}) {
  const { inputMode, autoComplete, type, maxLength, ...input } = rest;
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

function AddressesStep({
  draft,
  update,
  errors,
  next,
  onBack,
}: {
  draft: PickupDraft;
  update: (patch: Partial<PickupDraft>) => void;
  errors: PickupErrors;
  next: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [gps, setGps] = useState<GpsState>("idle");
  const [touched, setTouched] = useState({ pickup: false, delivery: false });
  const [attempted, setAttempted] = useState(false);
  const show = (key: "pickup" | "delivery") => attempted || touched[key];

  function locate() {
    if (!("geolocation" in navigator)) {
      setGps("unavailable");
      return;
    }
    setGps("locating");
    navigator.geolocation.getCurrentPosition(
      async (fix) => {
        const point = {
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
        };
        update({ pickupPoint: point });
        setGps("ready");
        // Only fill the address when the person has not typed one.
        if (!draft.pickupAddress.trim()) {
          const name = await reverseGeocode(point);
          if (name) update({ pickupAddress: name });
        }
      },
      (error) =>
        setGps(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        ),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  usePermissionRecovery({
    permission: "geolocation",
    enabled: gps === "denied",
    onGranted: locate,
  });

  function submit() {
    setAttempted(true);
    if (Object.keys(errors).length === 0) next();
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
        sx={{ display: "grid", gap: 2 }}
      >
        <Field
          id="pickup-address"
          label="Pickup address"
          error={show("pickup") ? errors.pickupAddress : undefined}
        >
          <TextInput
            id="pickup-address"
            value={draft.pickupAddress}
            onChange={(value) => update({ pickupAddress: value })}
            onBlur={() => setTouched((t) => ({ ...t, pickup: true }))}
            placeholder="e.g. 42 Pyay Road, Kamayut"
            autoComplete="street-address"
            maxLength={300}
            error={show("pickup") ? errors.pickupAddress : undefined}
          />
        </Field>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {hasMapbox && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<MapOutlined />}
              onClick={() => router.push("/pickup/map")}
              sx={{ minHeight: 48 }}
            >
              Pickup on map
            </Button>
          )}
          <Button
            variant="outlined"
            color="secondary"
            onClick={locate}
            disabled={gps === "locating"}
            startIcon={
              gps === "locating" ? (
                <Loader compact label="Finding your location…" />
              ) : (
                <MyLocationOutlined fontSize="small" />
              )
            }
            sx={{ minHeight: 48 }}
          >
            {gps === "locating" ? "Finding you…" : "Use my location"}
          </Button>
        </Stack>
        {draft.pickupPoint && (
          <Box sx={{ mt: -1 }}>
            <PinChip
              label="Pickup pin set"
              removeLabel="Remove pickup pin"
              onDelete={() => update({ pickupPoint: null })}
            />
          </Box>
        )}
        {gps === "denied" && (
          <Alert
            severity="warning"
            sx={{ borderRadius: "12px" }}
            action={
              <Button
                color="inherit"
                size="small"
                startIcon={<RefreshOutlined />}
                onClick={locate}
              >
                Try again
              </Button>
            }
          >
            Location is blocked for this site. Allow it in your browser
            settings, or type the address above.
          </Alert>
        )}
        {gps === "unavailable" && (
          <Alert severity="info" sx={{ borderRadius: "12px" }}>
            GPS isn’t available right now. Type the pickup address above.
          </Alert>
        )}

        <Field
          id="delivery-address"
          label="Delivery address"
          error={show("delivery") ? errors.deliveryAddress : undefined}
        >
          <TextInput
            id="delivery-address"
            value={draft.deliveryAddress}
            onChange={(value) => update({ deliveryAddress: value })}
            onBlur={() => setTouched((t) => ({ ...t, delivery: true }))}
            placeholder="e.g. 12 Baho Road, Sanchaung"
            maxLength={300}
            error={show("delivery") ? errors.deliveryAddress : undefined}
          />
        </Field>
        {hasMapbox && (
          <Box sx={{ mt: -1 }}>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<MapOutlined />}
              onClick={() => router.push("/pickup/map/delivery")}
              sx={{ minHeight: 48 }}
            >
              Delivery on map
            </Button>
            {draft.deliveryPoint && (
              <Box>
                <PinChip
                  label="Delivery pin set"
                  removeLabel="Remove delivery pin"
                  onDelete={() => update({ deliveryPoint: null })}
                />
              </Box>
            )}
          </Box>
        )}
      </Box>
    </PickupShell>
  );
}

function DetailsStep({
  draft,
  update,
  errors,
  next,
  onBack,
}: {
  draft: PickupDraft;
  update: (patch: Partial<PickupDraft>) => void;
  errors: PickupErrors;
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
      <Field
        id="recipient-name"
        label="Recipient name"
        error={show("recipientName")}
      >
        <TextInput
          id="recipient-name"
          value={draft.recipientName}
          onChange={(value) => update({ recipientName: value })}
          onBlur={() => touch("recipientName")}
          placeholder="Who should receive it?"
          autoComplete="name"
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
          onBlur={() => touch("recipientPhone")}
          placeholder="09 xxx xxx xxx"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
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
              onBlur={() => touch("contactPhone")}
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
              onBlur={() => touch("codAmount")}
              placeholder="0"
              inputMode="numeric"
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
      <DeliveryFeeHint draft={draft} />
    </PickupShell>
  );
}

/** The fee is known from the two pins, so say so before the review step. */
function DeliveryFeeHint({ draft }: { draft: PickupDraft }) {
  const estimate = draftEstimate(draft);
  if (!estimate) return null;
  return (
    <Typography
      variant="body2"
      sx={{ color: "text.secondary" }}
      aria-live="polite"
    >
      Delivery fee about <strong>{currency.format(estimate.total)}</strong> for{" "}
      {estimate.distanceKm.toFixed(1)} km. You’ll choose who pays on the next
      step.
    </Typography>
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
      sx={{ alignItems: "flex-start", py: 1.25 }}
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
        size="small"
        color="secondary"
        aria-label={`Edit ${label.toLowerCase()}`}
        sx={{ minHeight: 48, minWidth: 48, fontWeight: 700 }}
      >
        Edit
      </Button>
    </Stack>
  );
}

/** The method the customer chose, else cash on delivery by default. */
function resolvePayment(draft: PickupDraft): PaymentMethod {
  if (draft.payer === "other") return "cod";
  return draft.paymentMethod ?? "cod";
}

function draftEstimate(draft: PickupDraft) {
  const distanceKm = roadDistanceKm(draft.pickupPoint, draft.deliveryPoint);
  return distanceKm === null
    ? null
    : estimateDeliveryFee({
        distanceKm,
        weightKg: PARCEL_WEIGHT_KG[draft.parcelSize],
        method: resolvePayment(draft),
      });
}

/**
 * What the order is sent with: the delivery fee plus goods are owed at the
 * door until payment is recorded. Paying online now happens on the next
 * screen, once the tracking code exists to use as the reference.
 */
function resolveSplit(draft: PickupDraft, fee: number) {
  return planPickupPayment({
    fee,
    goods: parseCod(draft.codAmount) ?? 0,
    method: draft.paymentMethod ?? "cod",
    payer: draft.payer,
    payNow: draft.payNow,
  });
}

/** One line for the review step: who pays, how, and what is left for the door. */
function paymentSummary(
  draft: PickupDraft,
  split: ReturnType<typeof resolveSplit>,
) {
  if (draft.payer === "other")
    return `Someone else pays · ${currency.format(split.owed)} at the door or online with a pay link`;
  if (split.payOnline <= 0)
    return `Cash at the door · ${currency.format(split.owed)}`;
  const label = paymentMethodInfo(split.method).label;
  const rest = split.owed - split.payOnline;
  return rest > 0
    ? `${currency.format(split.payOnline)} with ${label} now · ${currency.format(rest)} cash at the door`
    : `${currency.format(split.payOnline)} with ${label} now`;
}

function PaymentStep({
  draft,
  update,
  estimate,
  rewards,
  onBack,
  next,
}: {
  draft: PickupDraft;
  update: (patch: Partial<PickupDraft>) => void;
  estimate: FeeEstimate | null;
  rewards: PickupRewards;
  onBack: () => void;
  next: () => void;
}) {
  const cod = parseCod(draft.codAmount) ?? 0;
  const method = resolvePayment(draft);
  const split = resolveSplit(draft, estimate?.total ?? 0);
  const payingNow = draft.payer === "me" && isPrepaid(method);
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
      <FeeBreakdown
        estimate={estimate}
        method={method}
        itemCash={cod}
        paidNow={split.payOnline}
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
      <PayerChoice
        name="pickup-payer"
        value={draft.payer}
        onChange={(payer) => update({ payer })}
      />
      {draft.payer === "other" ? (
        <p className="pay-note">
          They can pay the rider {currency.format(split.owed)} in cash at the
          door, or online with a pay link you’ll get once the request is sent.
        </p>
      ) : (
        <PaymentMethodPicker
          name="pickup-payment"
          value={draft.paymentMethod ?? "cod"}
          onChange={(next) => update({ paymentMethod: next })}
        />
      )}
      {estimate && payingNow && (
        <PayNowField
          id="pickup-pay-now"
          total={split.owed}
          fee={estimate.total}
          value={draft.payNow}
          onChange={(next) => update({ payNow: next })}
        />
      )}
    </PickupShell>
  );
}

function ReviewStep({
  draft,
  estimate,
  submit,
  state,
  error,
  signedIn,
  onBack,
}: {
  draft: PickupDraft;
  estimate: FeeEstimate | null;
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
          >
            {state === "sending"
              ? "Sending…"
              : signedIn === false
                ? "Sign in to request pickup"
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
          value={describeParcel(draft).replace(
            / · Pickup (today|tomorrow), \w+/i,
            "",
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
      <SummaryRow
        label="Delivery fee"
        value={estimate ? currency.format(estimate.total) : "Not calculated"}
        href="/pickup/payment"
      />
      <SummaryRow
        label="Payment"
        value={paymentSummary(draft, split)}
        href="/pickup/payment"
      />
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
  const grossEstimate = draftEstimate(draft);
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
            sx={{ mt: 1 }}
          >
            View order
          </Button>
          <Button
            component={Link}
            href="/home"
            variant="outlined"
            color="secondary"
            size="large"
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
        next={() => router.push("/pickup/details")}
        onBack={goBack}
      />
    ) : step === "details" ? (
      <DetailsStep
        draft={draft}
        update={update}
        errors={detailErrors}
        next={() => router.push("/pickup/payment")}
        onBack={goBack}
      />
    ) : step === "payment" ? (
      <PaymentStep
        draft={draft}
        update={update}
        estimate={estimate}
        rewards={rewards}
        next={() => router.push("/pickup/review")}
        onBack={goBack}
      />
    ) : (
      <ReviewStep
        draft={draft}
        estimate={estimate}
        submit={() => void submit()}
        state={state === "sending" ? "sending" : "editing"}
        error={error}
        signedIn={signedIn}
        onBack={goBack}
      />
    );

  return content;
}
