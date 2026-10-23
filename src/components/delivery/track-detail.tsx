"use client";

import CheckRounded from "@mui/icons-material/CheckRounded";
import ExpandMore from "@mui/icons-material/ExpandMore";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import IosShare from "@mui/icons-material/IosShare";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRounded from "@mui/icons-material/KeyboardArrowUpRounded";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import TwoWheelerOutlined from "@mui/icons-material/TwoWheelerOutlined";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toneSx } from "@/components/delivery/customer-home";
import { LocationMap } from "@/components/delivery/location-map";
import { PaymentLogo } from "@/components/delivery/payment-logos";
import { RewardsControl } from "@/components/delivery/payment-picker";
import { usePickupRewards } from "@/components/delivery/use-pickup-rewards";
import {
  fetchPaymentSandbox,
  redeemOrderRewards,
  sandboxPayOrder,
} from "@/lib/delivery/actions";
import { currency, formatDateTime } from "@/lib/delivery/format";
import { normalizeCouponCode } from "@/lib/delivery/rewards";
import { describeTracking } from "@/lib/delivery/track-state";
import type { DeliveryOrder, StatusEvent } from "@/lib/delivery/types";
import { STATUS_LABELS, STATUS_STEPS } from "@/lib/delivery/types";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ track */

const journey = [
  { label: "Placed", icon: Inventory2Outlined },
  { label: "Rider", icon: PersonOutlined },
  { label: "On the way", icon: TwoWheelerOutlined },
  { label: "Delivered", icon: HomeOutlined },
] as const;

/** Where the parcel is on the four-step journey (0 = just placed). */
function journeyIndex(status: DeliveryOrder["status"]) {
  switch (status) {
    case "assigned":
    case "accepted":
      return 1;
    case "picked_up":
    case "in_transit":
      return 2;
    case "delivered":
      return 3;
    default:
      return 0;
  }
}

const NODE = 24;

/**
 * Four icon nodes on one rail, so the customer sees the whole journey and
 * their place in it at a glance. Navy is done, blue is where the parcel is.
 * The leg the parcel is travelling right now loads toward its node, so the
 * rail reads as movement rather than a stale snapshot.
 */
function JourneyRail({ status }: { status: DeliveryOrder["status"] }) {
  const current = journeyIndex(status);
  const finished = status === "delivered";
  return (
    <Box
      component="ol"
      aria-label="Delivery journey"
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${journey.length}, minmax(0, 1fr))`,
        m: 0,
        mt: 1.5,
        p: 0,
        listStyle: "none",
        width: "100%",
      }}
    >
      {journey.map((step, index) => {
        const done = index < current || finished;
        const here = index === current && !finished;
        const loading = here && index > 0;
        const StepIcon = step.icon;
        return (
          <Box
            component="li"
            key={step.label}
            aria-current={here ? "step" : undefined}
            sx={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
              width: "100%",
              minWidth: 0,
              px: 0.25,
            }}
          >
            {index > 0 && (
              <Box
                aria-hidden="true"
                className={loading ? "track-rail-loading" : undefined}
                sx={{
                  position: "absolute",
                  top: NODE / 2 - 1,
                  right: "50%",
                  width: "100%",
                  height: 2,
                  borderRadius: "999px",
                  overflow: "hidden",
                  // The live leg takes its colour (and its sweep) from CSS.
                  bgcolor: loading
                    ? undefined
                    : index < current || finished
                      ? "secondary.main"
                      : "grey.200",
                }}
              />
            )}
            <Box
              className={here ? "track-rail-here" : undefined}
              sx={{
                position: "relative",
                zIndex: 1,
                width: NODE,
                height: NODE,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: done
                  ? "secondary.main"
                  : here
                    ? "info.main"
                    : "background.paper",
                color: done || here ? "common.white" : "text.disabled",
                border: done || here ? 0 : 2,
                borderColor: "grey.200",
              }}
            >
              {done ? (
                <CheckRounded sx={{ fontSize: 14 }} />
              ) : (
                <StepIcon sx={{ fontSize: 13 }} />
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontSize: "11px",
                fontWeight: here ? 750 : 500,
                color: done || here ? "text.primary" : "text.secondary",
                textAlign: "center",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
                display: "block",
              }}
            >
              {step.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

const payFlagKey = (orderId: string) => `oern.sandbox-pay.${orderId}`;
/** A payment flag with cash still due this long after starting is abandoned. */
const PAY_FLAG_TTL_MS = 60_000;

type PayFlag = { amount: number; at: number };

/**
 * A payment this browser session started. A live update can remount the Track
 * screen mid-payment, so the flag, together with the order's cash due, tells
 * the new screen whether to show loading or Paid.
 */
function readPayFlag(order: {
  id: string;
  cod_amount: number;
}): PayFlag | null {
  try {
    const raw = window.sessionStorage.getItem(payFlagKey(order.id));
    if (!raw) return null;
    const flag = JSON.parse(raw) as PayFlag;
    const stale = Date.now() - flag.at > PAY_FLAG_TTL_MS;
    return order.cod_amount > 0 && stale ? null : flag;
  } catch {
    return null;
  }
}

function writePayFlag(orderId: string, amount: number) {
  try {
    window.sessionStorage.setItem(
      payFlagKey(orderId),
      JSON.stringify({ amount, at: Date.now() }),
    );
  } catch {
    // Storage can be blocked; a remount then loses the loading state only.
  }
}

function clearPayFlag(orderId: string) {
  try {
    window.sessionStorage.removeItem(payFlagKey(orderId));
  } catch {
    // Nothing to clear.
  }
}

/** Apps that read an MMQR code; CTZPay is one of them, not a separate scheme. */
const MMQR_APPS = ["CTZPay", "KBZPay", "Wave Pay", "AYA Pay", "CB Pay"];

/** Orders accept a coupon or points until the rider has the parcel. */
const REWARD_STATUSES = ["pending", "assigned", "accepted"];

/**
 * Settle the COD balance from anywhere: with a coupon or points first, then
 * MMQR (CTZPay included) or cash to the rider. The receiver can do it as easily
 * as the sender, so the link can be passed on. Staff mark the order Paid once
 * the money arrives, and the rider's cash due drops then.
 */
function PayBalanceOnline({
  order,
  canApply,
  onApplied,
  onPaid,
}: {
  order: DeliveryOrder;
  canApply: boolean;
  onApplied?: () => void;
  /** The parent keeps this section on screen once a payment has gone through. */
  onPaid?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState<"mmqr" | "cash">("mmqr");
  const [code, setCode] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [payState, setPayState] = useState<
    "idle" | "paying" | "paid" | "error"
  >(() => {
    const flag = readPayFlag(order);
    return !flag ? "idle" : order.cod_amount === 0 ? "paid" : "paying";
  });
  const [paidAmount, setPaidAmount] = useState(
    () => readPayFlag(order)?.amount ?? 0,
  );

  // A live update while paying can remount this screen; the order's cash due
  // reaching zero is what says the payment went through.
  useEffect(() => {
    const flag = readPayFlag(order);
    if (flag && order.cod_amount === 0) {
      setPaidAmount(flag.amount);
      setPayState("paid");
    } else if (!flag) {
      // The payment that was in flight failed or was abandoned.
      setPayState((state) => (state === "paying" ? "idle" : state));
    }
  }, [order]);
  const amount = currency.format(order.cod_amount);

  useEffect(() => {
    let live = true;
    void fetchPaymentSandbox(createClient())
      .then((on) => live && setSandbox(on))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  /** Sandbox only: simulate the confirmation a connected MMQR provider sends. */
  async function payNow(due = order.cod_amount) {
    if (payState === "paying") return;
    setPayState("paying");
    writePayFlag(order.id, due);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1300));
      const result = await sandboxPayOrder(
        createClient(),
        order.tracking_code,
        "mmqr",
      );
      writePayFlag(order.id, result.paid);
      onPaid?.();
      setPaidAmount(result.paid);
      setPayState("paid");
      // Leave the confirmation up a moment before the screen refreshes.
      window.setTimeout(() => onApplied?.(), 2200);
    } catch {
      clearPayFlag(order.id);
      setPayState("error");
    }
  }
  const fee = order.delivery_fee ?? null;
  const discounted = (order.discount_amount ?? 0) > 0;
  const open =
    canApply &&
    !discounted &&
    fee !== null &&
    fee > 0 &&
    REWARD_STATUSES.includes(order.status);
  const rewards = usePickupRewards({ couponCode: code, usePoints }, fee, open);
  const owner = rewards.userId !== null && rewards.userId === order.customer_id;
  const saving = rewards.applied.discount;
  // A previewed discount must be applied before paying, so the amount is right.
  const discountPending = open && owner && saving > 0;

  async function apply() {
    if (applying || fee === null) return;
    setApplying(true);
    setApplyError(null);
    try {
      await redeemOrderRewards(createClient(), {
        orderId: order.id,
        fee,
        couponCode:
          rewards.couponStatus.state === "valid"
            ? normalizeCouponCode(code)
            : undefined,
        points: rewards.applied.pointsUsed,
      });
      setCode("");
      setUsePoints(false);
      onApplied?.();
    } catch {
      setApplyError(
        "Could not apply this to the order. It may already have a discount or the rider has the parcel.",
      );
    } finally {
      setApplying(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/track?code=${encodeURIComponent(order.tracking_code)}&pay=1`;
    const text = `Pay ${amount} for parcel ${order.tracking_code} on Oern (MMQR, CTZPay included)`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Pay for a delivery", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}: ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sharing was cancelled or is unavailable; nothing to recover.
    }
  }

  if (payState === "paid")
    return (
      <Box
        role="status"
        sx={{
          mt: 1.5,
          p: 2,
          borderRadius: "16px",
          bgcolor: "success.light",
          color: "success.dark",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <CheckRounded />
        <Box>
          <Typography sx={{ fontWeight: 800 }}>
            Paid · {currency.format(paidAmount)}
          </Typography>
          <Typography variant="caption">
            The rider sees this right away and collects no cash.
          </Typography>
        </Box>
      </Box>
    );

  return (
    <Box
      sx={{
        mt: 1.5,
        pt: 1.5,
        borderTop: 1,
        borderColor: "divider",
        display: "grid",
        gap: 1.5,
      }}
    >
      {discounted && (
        <Typography
          role="status"
          variant="body2"
          sx={{ color: "success.dark", fontWeight: 700 }}
        >
          Discount applied · −{currency.format(order.discount_amount ?? 0)}
        </Typography>
      )}
      {open && owner && (
        <>
          <RewardsControl
            id="track-coupon"
            appliedCode={normalizeCouponCode(code)}
            status={rewards.couponStatus}
            balance={rewards.balance}
            usePoints={usePoints}
            pointsUsed={rewards.applied.pointsUsed}
            pointsDiscount={rewards.applied.pointsDiscount}
            onApply={(next) => setCode(normalizeCouponCode(next))}
            onRemove={() => setCode("")}
            onUsePointsChange={setUsePoints}
          />
          {saving > 0 && (
            <Button
              variant="contained"
              onClick={() => void apply()}
              disabled={applying}
              sx={{ minHeight: 48 }}
            >
              {applying
                ? "Applying…"
                : `Apply discount · ${currency.format(Math.max(0, order.cod_amount - saving))} to pay`}
            </Button>
          )}
          {applyError && (
            <Typography role="alert" variant="body2" color="error">
              {applyError}
            </Typography>
          )}
        </>
      )}
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        How would you like to pay {amount}?
      </Typography>
      <RadioGroup
        aria-label="Payment option"
        value={method}
        onChange={(event) => setMethod(event.target.value as "mmqr" | "cash")}
      >
        <FormControlLabel
          value="mmqr"
          control={<Radio />}
          sx={{ alignItems: "flex-start", m: 0, minHeight: 48 }}
          label={
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
              <PaymentLogo method="mmqr" size={32} />
              <Box>
                <Typography sx={{ fontWeight: 700 }}>MMQR</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Any bank or wallet app: {MMQR_APPS.join(", ")}
                </Typography>
              </Box>
            </Box>
          }
        />
        <FormControlLabel
          value="cash"
          control={<Radio />}
          sx={{ alignItems: "flex-start", m: 0, minHeight: 48 }}
          label={
            <Box>
              <Typography sx={{ fontWeight: 700 }}>
                Cash to the rider
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Have exact cash ready on arrival
              </Typography>
            </Box>
          }
        />
      </RadioGroup>
      {method === "mmqr" ? (
        <>
          <Box
            aria-label="MMQR payment details"
            sx={{
              display: "grid",
              gap: 1.25,
              p: 2,
              borderRadius: "12px",
              bgcolor: "background.default",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <PaymentLogo method="mmqr" size={44} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }}>
                  Scan an MMQR to pay
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  CTZPay or any participating bank and wallet app
                </Typography>
              </Box>
            </Box>
            <Box
              component="dl"
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 0.75,
                m: 0,
                fontSize: 14,
                "& dt": { color: "text.secondary" },
                "& dd": {
                  m: 0,
                  fontWeight: 750,
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                },
              }}
            >
              <dt>Amount</dt>
              <dd>{amount}</dd>
              <dt>Reference</dt>
              <dd>{order.tracking_code}</dd>
            </Box>
          </Box>
          <Box
            component="ol"
            sx={{ m: 0, pl: 2.5, fontSize: 14, lineHeight: "20px" }}
          >
            <li>
              On another phone, open CTZPay or another MMQR-enabled app and tap
              Scan.
            </li>
            <li>
              Scan the merchant MMQR supplied by Oern, then check the merchant,
              amount, and reference before entering your PIN.
            </li>
            <li>
              Return here. The order changes to Paid only after the provider
              confirms the transaction.
            </li>
          </Box>
          {sandbox ? (
            <>
              {!discountPending && (
                <Button
                  variant="contained"
                  onClick={() => void payNow()}
                  disabled={payState === "paying"}
                  startIcon={
                    payState === "paying" ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : undefined
                  }
                  sx={{ minHeight: 52 }}
                >
                  {payState === "paying"
                    ? "Waiting for provider…"
                    : "Simulate provider confirmation"}
                </Button>
              )}
              {payState === "error" && (
                <Typography role="alert" variant="body2" color="error">
                  The payment did not go through. Try again.
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Demo mode: no QR is generated and no money is charged. This
                simulates the provider callback after a successful scan.
              </Typography>
            </>
          ) : (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              A scannable merchant MMQR appears here after a payment provider is
              connected. Until then, staff confirm transfers by hand.
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="body2">
          Pay {amount} to the rider when the parcel arrives.
        </Typography>
      )}
      <Button
        variant="outlined"
        color="secondary"
        onClick={() => void share()}
        startIcon={copied ? <CheckRounded /> : <IosShare />}
        sx={{ minHeight: 48 }}
      >
        {copied ? "Link copied" : "Share pay link"}
      </Button>
    </Box>
  );
}

/**
 * Share a link anyone can open: tracking by code works without an account,
 * so the recipient's family or a colleague can follow the same parcel.
 */
function ShareTrackingButton({ order }: { order: DeliveryOrder }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/track?code=${encodeURIComponent(order.tracking_code)}`;
    const text = `Follow parcel ${order.tracking_code} on Oern`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Oern delivery", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}: ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sharing was cancelled or is unavailable; nothing to recover.
    }
  }

  return (
    <IconButton
      onClick={() => void share()}
      aria-label={copied ? "Link copied" : "Share tracking"}
      title={copied ? "Link copied" : "Share tracking"}
      sx={{ width: 48, height: 48, color: "secondary.main" }}
    >
      {copied ? <CheckRounded /> : <IosShare />}
    </IconButton>
  );
}

/**
 * Cash due is a payment signal and never part of delivery state, so it keeps
 * its own chip wherever the summary shows it. One chip per screen: it sits in
 * the rider block while that block is on screen, and in the summary row when
 * it is not. On a tinted rider card the chip is white-filled so the pill
 * keeps an edge without repeating the card's own wash.
 */
function CodChip({
  amount,
  paid,
  state,
  size = "summary",
}: {
  amount: number;
  paid: boolean;
  /** Plain-language due state, read out with the amount. */
  state: string;
  size?: "summary" | "inline";
}) {
  const value = currency.format(amount);
  const tone = paid ? "success" : "warning";
  return (
    <Chip
      size="small"
      icon={<PaymentsOutlined sx={{ fontSize: "14px !important" }} />}
      label={paid ? `COD paid · ${value}` : `COD · ${value}`}
      aria-label={`Cash on delivery ${value} · ${state}`}
      sx={{
        ...toneSx(tone),
        ...(size === "inline"
          ? {
              bgcolor: "background.paper",
              color: `${tone}.dark`,
              border: 1,
              borderColor:
                tone === "success"
                  ? "var(--color-success, #16a34a)"
                  : "var(--color-warning, #d97706)",
            }
          : {}),
        "& .MuiChip-icon": { color: "inherit" },
        fontWeight: 750,
        height: size === "inline" ? 22 : 26,
        fontSize: size === "inline" ? "11px" : "12px",
      }}
    />
  );
}

/** A labelled disclosure row inside the details group: title + glanceable hint. */
function Disclosure({
  id,
  title,
  hint,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Accordion
      disableGutters
      square
      elevation={0}
      expanded={expanded}
      onChange={(_event, next) => onToggle(next)}
      slotProps={{ heading: { component: "h2" } }}
      sx={{
        bgcolor: "transparent",
        borderTop: 1,
        borderColor: "divider",
        "&:first-of-type": { borderTop: 0 },
        "&::before": { display: "none" },
      }}
    >
      <AccordionSummary
        id={`${id}-header`}
        aria-controls={`${id}-panel`}
        aria-label={title}
        expandIcon={<ExpandMore />}
        sx={{
          minHeight: 52,
          px: 2,
          "& .MuiAccordionSummary-content": {
            my: 1,
            minWidth: 0,
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 1.5,
          },
        }}
      >
        <Typography sx={{ fontWeight: 700, flex: "none" }}>{title}</Typography>
        {hint && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", minWidth: 0, textAlign: "right" }}
            noWrap
          >
            {hint}
          </Typography>
        )}
      </AccordionSummary>
      <AccordionDetails id={`${id}-panel`} sx={{ px: 2, pt: 0, pb: 2 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

export function TrackDetail({
  order,
  events,
  isDemo,
  now,
  onOpenHelp,
  onRefresh,
  refreshing: _refreshing = false,
  onTrackAnother,
}: {
  order: DeliveryOrder;
  events: StatusEvent[];
  isDemo: boolean;
  now: number;
  onOpenHelp: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onTrackAnother?: () => void;
}) {
  const view = describeTracking(order, events, now);
  /** Paying empties the balance; keep the section up to show it was paid. */
  const [paidInSession, setPaidInSession] = useState(
    () => readPayFlag(order) !== null,
  );
  useEffect(() => {
    if (readPayFlag(order)) setPaidInSession(true);
  }, [order]);
  const orderEvents = events.filter((event) => event.order_id === order.id);
  const activeIndex = STATUS_STEPS.indexOf(
    order.status as (typeof STATUS_STEPS)[number],
  );
  const closed = view.stage === "delivered" || view.stage === "stopped";
  const stopped = view.stage === "stopped";
  const onTheWay = view.stage === "on_the_way";
  const stopEvent =
    orderEvents
      .filter((event) => event.status === order.status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  const codPaid =
    order.cod_status === "collected" || order.cod_status === "settled";

  // Colour carries state: blue live, green done, red stopped, navy default.
  const headlineColor = stopped
    ? "error.dark"
    : view.stage === "delivered"
      ? "success.dark"
      : onTheWay
        ? "info.dark"
        : "text.primary";

  const callable = Boolean(order.driver_phone) && !closed;
  // The rider card is the one place the parcel's rider, vehicle and cash due
  // read together, so COD lives there whenever the card is on screen.
  const refunded = order.refunded_amount ?? 0;
  const paidOnline = paidInSession && order.cod_amount === 0 && refunded === 0;
  const codLabel =
    refunded > 0
      ? "Refunded"
      : codPaid || paidOnline
        ? "Paid"
        : view.stage === "delivered"
          ? "Still due"
          : "Due on arrival";
  const latestEvent = [...orderEvents].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];

  // Interactive Bottom Sheet states: "peek" | "half" | "full"
  const [snapState, setSnapState] = useState<"peek" | "half" | "full">(
    stopped || paidInSession ? "half" : "peek",
  );
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [peekHeight, setPeekHeight] = useState(348);
  const [openSection, setOpenSection] = useState<string | null>(null);
  // A shared pay link (?pay=1) lands with the cash-on-delivery section open,
  // and so does a screen remounted after a payment, to show it went through.
  useEffect(() => {
    if (
      paidInSession ||
      new URLSearchParams(window.location.search).get("pay") === "1"
    ) {
      setOpenSection("cod");
      // The section sits in the sheet, so a pay link opens the sheet too.
      setSnapState((state) => (state === "peek" ? "half" : state));
    }
  }, [paidInSession]);
  const sheetRef = useRef<HTMLElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // The peek hugs its content: no dead white space, no clipped rider row on
  // short phones. The measured height also defines the map's clear area.
  useEffect(() => {
    const node = peekRef.current;
    if (!node) return;
    const measure = () => {
      const raw = Math.ceil(node.getBoundingClientRect().height);
      const ceiling = Math.round(window.innerHeight * 0.66);
      setPeekHeight(Math.min(Math.max(raw, 300), ceiling));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const getSnapHeight = useCallback(
    (snap: "peek" | "half" | "full") => {
      if (typeof window === "undefined") return 348;
      const vh = window.innerHeight;
      switch (snap) {
        case "peek":
          return peekHeight;
        case "half":
          // Opening details must leave room to read them: keep the pinned
          // summary plus at least ~220px of body, and never exceed full.
          return Math.min(
            Math.round(vh * 0.9),
            Math.max(Math.round(vh * 0.75), peekHeight + 220),
          );
        case "full":
          return Math.round(vh * 0.9);
      }
    },
    [peekHeight],
  );

  const cycleSnap = useCallback(() => {
    setSnapState((prev) => (prev === "peek" ? "half" : "peek"));
  }, []);

  const handlePointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    const currentH =
      sheetRef.current?.getBoundingClientRect().height ??
      getSnapHeight(snapState);
    dragStartHeight.current = currentH;
    setDragHeight(currentH);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!isDragging) return;
    const deltaY = dragStartY.current - e.clientY;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const minH = 200;
    const maxH = Math.round(vh * 0.92);
    const newH = Math.min(
      Math.max(dragStartHeight.current + deltaY, minH),
      maxH,
    );
    setDragHeight(newH);
  };

  const handlePointerUp = (e: ReactPointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const deltaY = dragStartY.current - e.clientY;
    const currentH = dragHeight ?? dragStartHeight.current;
    setDragHeight(null);

    // A tap on the handle cycles instead of snapping to a near-identical size.
    if (Math.abs(deltaY) < 8) return;

    const peekH = getSnapHeight("peek");
    const halfH = getSnapHeight("half");
    const fullH = getSnapHeight("full");
    const biasedH = currentH + (deltaY > 0 ? 35 : -35);

    if (biasedH < (peekH + halfH) / 2) {
      setSnapState("peek");
    } else if (biasedH < (halfH + fullH) / 2) {
      setSnapState("half");
    } else {
      setSnapState("full");
    }
  };

  const sheetHeightStyle = useMemo(() => {
    if (dragHeight != null) {
      return { height: `${dragHeight}px` };
    }
    switch (snapState) {
      case "peek":
        return { height: `${peekHeight}px` };
      case "half":
        return {
          height: `min(90dvh, max(75dvh, ${peekHeight + 220}px))`,
        };
      case "full":
        return { height: "90dvh" };
    }
  }, [dragHeight, peekHeight, snapState]);

  const expanded = snapState !== "peek";

  return (
    <Box
      component="section"
      aria-label="Selected delivery"
      className="track-viewport"
    >
      {/* 1. Full-Bleed Map in Background */}
      <Box className="track-map-fullbleed">
        <LocationMap
          order={order}
          mode="customer"
          isDemo={isDemo}
          tall
          compact
          sheetInset={peekHeight}
          showControls={!expanded}
        />
      </Box>

      {/* 2. Interactive Expandable Bottom Sheet */}
      <Box
        ref={sheetRef}
        component="section"
        aria-label={`Tracking details for ${order.tracking_code}`}
        className={`track-bottom-sheet is-${snapState} ${isDragging ? "is-dragging" : ""}`}
        style={sheetHeightStyle}
      >
        <Box ref={peekRef} className="track-peek">
          {/* Grab Handle */}
          <Box
            className="track-sheet-handle-bar"
            role="button"
            tabIndex={0}
            aria-label={
              expanded ? "Collapse tracking details" : "Expand tracking details"
            }
            aria-expanded={expanded}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={(e) => {
              if (
                e.target === e.currentTarget ||
                (e.target as HTMLElement).classList.contains(
                  "track-sheet-handle",
                )
              ) {
                cycleSnap();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                cycleSnap();
              }
            }}
          >
            <div className="track-sheet-handle" />
          </Box>

          <Box sx={{ px: 2, pt: 0.25, pb: 0.5, flexShrink: 0 }}>
            {/* COD only when the rider block is not on screen to carry it */}
            {order.cod_amount > 0 && (
              <Box sx={{ mb: 0.5 }}>
                <CodChip
                  amount={order.cod_amount}
                  paid={codPaid}
                  state={codLabel}
                />
              </Box>
            )}

            {/* Headline with tabular figures, coloured by state. Share rides
                on this row so no line sits empty above the heading. */}
            <Stack
              direction="row"
              sx={{ alignItems: "center", gap: 0.5, minHeight: 48 }}
            >
              <Typography
                variant="h5"
                component="p"
                className="track-num"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 22,
                  lineHeight: "26px",
                  fontWeight: 750,
                  letterSpacing: "-0.02em",
                  color: headlineColor,
                  fontFeatureSettings: '"tnum"',
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {view.headline}
              </Typography>

              {isDemo ? (
                <Typography
                  variant="caption"
                  sx={{
                    flex: "none",
                    color: "text.secondary",
                    bgcolor: "grey.100",
                    px: 1,
                    py: 0.25,
                    borderRadius: "999px",
                    fontWeight: 600,
                  }}
                >
                  Sample
                </Typography>
              ) : (
                <ShareTrackingButton order={order} />
              )}
            </Stack>

            {/* Subtitle wraps instead of truncating the only copy of a fact */}
            <Typography
              variant="body2"
              sx={{
                mt: 0.25,
                color: "text.secondary",
                fontSize: "13px",
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {view.detail}
              {view.stage !== "preparing"
                ? ` · To ${order.delivery_address}`
                : ""}
            </Typography>
          </Box>

          {/* Peek actions: journey, rider, one clear action, details control */}
          <Box
            sx={{
              px: 2,
              pb: "calc(12px + env(safe-area-inset-bottom))",
              flexShrink: 0,
            }}
          >
            {!stopped && <JourneyRail status={order.status} />}

            {callable && (
              <Button
                component="a"
                href={`tel:${order.driver_phone}`}
                fullWidth
                variant="contained"
                color="secondary"
                startIcon={<PhoneOutlined />}
                sx={{
                  mt: 1.25,
                  minHeight: 46,
                  borderRadius: "999px",
                  fontWeight: 700,
                  fontSize: 14,
                  boxShadow: "none",
                  "&:hover": { boxShadow: "none" },
                }}
              >
                Call rider {order.driver_name ? `(${order.driver_name})` : ""}
              </Button>
            )}

            {closed && onTrackAnother && (
              <Button
                fullWidth
                variant="text"
                color="inherit"
                onClick={onTrackAnother}
                sx={{
                  mt: 0.5,
                  minHeight: 40,
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 650,
                  color: "text.secondary",
                }}
              >
                Track another parcel
              </Button>
            )}

            <Button
              fullWidth
              variant="text"
              color="inherit"
              onClick={cycleSnap}
              aria-expanded={expanded}
              aria-controls="track-details-body"
              endIcon={
                expanded ? (
                  <KeyboardArrowDownRounded />
                ) : (
                  <KeyboardArrowUpRounded />
                )
              }
              sx={{
                mt: 0.5,
                minHeight: 44,
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 700,
                color: "text.primary",
              }}
            >
              {expanded ? "Hide delivery details" : "View delivery details"}
            </Button>
          </Box>
        </Box>

        {/* Scrollable expanded body: labelled groups, not one long card stack */}
        <Box
          id="track-details-body"
          className="track-sheet-body"
          sx={{
            px: 2,
            pt: 1,
            pb: "calc(24px + env(safe-area-inset-bottom))",
            display: expanded ? "block" : "none",
          }}
        >
          <Stack spacing={2}>
            {onTheWay && order.route_progress_percent != null && (
              <Box>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", mb: 0.5 }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 600 }}
                  >
                    Route completed
                  </Typography>
                  <Typography
                    variant="caption"
                    className="track-num"
                    sx={{ fontWeight: 750 }}
                  >
                    {Math.round(order.route_progress_percent)}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={order.route_progress_percent}
                  aria-label="Route progress"
                  sx={{
                    height: 6,
                    borderRadius: "999px",
                    bgcolor: "grey.200",
                    "& .MuiLinearProgress-bar": {
                      bgcolor: "info.main",
                      borderRadius: "999px",
                    },
                  }}
                />
              </Box>
            )}

            {stopped && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: "12px",
                  bgcolor: "error.light",
                  color: "error.dark",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 750 }}>
                  {STATUS_LABELS[order.status]}
                </Typography>
                <Typography variant="body2">
                  {stopEvent?.note || "This delivery did not complete."}
                </Typography>
                {stopEvent && (
                  <Typography
                    variant="caption"
                    className="track-num"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {formatDateTime(stopEvent.created_at)}
                  </Typography>
                )}
              </Box>
            )}

            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: "16px",
                overflow: "hidden",
                bgcolor: "background.paper",
              }}
            >
              <Disclosure
                id="route"
                title="Route and addresses"
                hint="Pickup and drop-off"
                expanded={openSection === "route"}
                onToggle={(next) => setOpenSection(next ? "route" : null)}
              >
                <Stack direction="row" spacing={1.5}>
                  <Stack sx={{ alignItems: "center", pt: "6px" }}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        border: 3,
                        borderColor: "secondary.main",
                      }}
                    />
                    <Box
                      aria-hidden="true"
                      sx={{
                        flex: 1,
                        my: 0.5,
                        borderLeft: 2,
                        borderStyle: "dashed",
                        borderColor: "divider",
                        minHeight: 28,
                      }}
                    />
                    <LocationOnOutlined
                      aria-hidden="true"
                      sx={{ fontSize: 18, color: "primary.dark", ml: "-4px" }}
                    />
                  </Stack>
                  <Stack spacing={1.75} sx={{ minWidth: 0, flex: 1 }}>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        Pickup
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 650, overflowWrap: "anywhere" }}
                      >
                        {order.pickup_address}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", display: "block" }}
                      >
                        Drop-off
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 650, overflowWrap: "anywhere" }}
                      >
                        {order.delivery_address}
                      </Typography>
                      {(order.delivery_latitude == null ||
                        order.delivery_longitude == null) && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            display: "block",
                            mt: 0.5,
                          }}
                        >
                          The drop-off map pin was not shared for this delivery.
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Stack>
              </Disclosure>

              <Disclosure
                id="updates"
                title="Delivery updates"
                hint={
                  latestEvent
                    ? STATUS_LABELS[latestEvent.status]
                    : "No updates yet"
                }
                expanded={openSection === "updates"}
                onToggle={(next) => setOpenSection(next ? "updates" : null)}
              >
                <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none" }}>
                  {STATUS_STEPS.map((step, index) => {
                    const event = orderEvents.find(
                      (item) => item.status === step,
                    );
                    const done = stopped
                      ? Boolean(event)
                      : order.status === "delivered" ||
                        (activeIndex >= 0 && index <= activeIndex);
                    const current = order.status === step;
                    const last = index === STATUS_STEPS.length - 1;
                    return (
                      <Box
                        component="li"
                        key={step}
                        aria-current={current ? "step" : undefined}
                        sx={{ display: "flex", gap: 1.5 }}
                      >
                        <Stack sx={{ alignItems: "center" }}>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              display: "grid",
                              placeItems: "center",
                              bgcolor: done
                                ? "secondary.main"
                                : "background.paper",
                              color: "secondary.contrastText",
                              border: done ? 0 : 2,
                              borderColor: "divider",
                            }}
                          >
                            {done ? (
                              <CheckRounded sx={{ fontSize: 16 }} />
                            ) : null}
                          </Box>
                          {!last && (
                            <Box
                              sx={{
                                width: 2,
                                flex: 1,
                                minHeight: 18,
                                bgcolor: done ? "secondary.main" : "divider",
                              }}
                            />
                          )}
                        </Stack>
                        <Box sx={{ pb: last ? 0 : 1.5, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: current ? 750 : 650,
                              color: done ? "text.primary" : "text.secondary",
                              lineHeight: "24px",
                            }}
                          >
                            {STATUS_LABELS[step]}
                          </Typography>
                          <Typography
                            variant="caption"
                            className="track-num"
                            sx={{ color: "text.secondary" }}
                          >
                            {event
                              ? formatDateTime(event.created_at)
                              : done
                                ? "Completed"
                                : stopped
                                  ? "Not reached"
                                  : "Up next"}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Disclosure>

              {(order.cod_amount > 0 || paidInSession || refunded > 0) && (
                <Disclosure
                  id="cod"
                  title="Cash on delivery"
                  hint={`${currency.format(order.cod_amount)} · ${codLabel}`}
                  expanded={openSection === "cod"}
                  onToggle={(next) => setOpenSection(next ? "cod" : null)}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center" }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: codPaid ? "success.light" : "warning.light",
                        color: codPaid ? "success.dark" : "warning.dark",
                        width: 40,
                        height: 40,
                      }}
                    >
                      <PaymentsOutlined />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: codPaid ? "success.dark" : "warning.dark",
                          fontWeight: 600,
                        }}
                      >
                        Cash on delivery · {codLabel}
                      </Typography>
                      <Typography
                        variant="subtitle1"
                        className="track-num"
                        sx={{
                          fontWeight: 800,
                          lineHeight: 1.2,
                          color: codPaid ? "success.dark" : "warning.dark",
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {currency.format(order.cod_amount)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      mt: 1,
                      color: codPaid ? "success.dark" : "warning.dark",
                    }}
                  >
                    {refunded > 0
                      ? "You paid in the app; it has been refunded. Nothing is due."
                      : paidOnline
                        ? "Paid online. Nothing is due on arrival."
                        : codPaid
                          ? "Payment collected and confirmed."
                          : closed
                            ? "Cash was not collected for this order."
                            : "Have exact cash ready on arrival, or pay online now."}
                  </Typography>
                  {refunded > 0 && (
                    <Box
                      role="status"
                      sx={{
                        mt: 1.5,
                        p: 2,
                        borderRadius: "16px",
                        bgcolor: "success.light",
                        color: "success.dark",
                      }}
                    >
                      <Typography sx={{ fontWeight: 800 }}>
                        Refunded · {currency.format(refunded)}
                      </Typography>
                      <Typography variant="caption">
                        This order was cancelled, so what you paid is going back
                        to the account you paid from.
                      </Typography>
                    </Box>
                  )}
                  {!codPaid && !closed && refunded === 0 && (
                    <PayBalanceOnline
                      order={order}
                      canApply={!isDemo}
                      onApplied={onRefresh}
                      onPaid={() => setPaidInSession(true)}
                    />
                  )}
                </Disclosure>
              )}

              <Disclosure
                id="parcel"
                title="Parcel details"
                hint={order.parcel_description || "Standard parcel"}
                expanded={openSection === "parcel"}
                onToggle={(next) => setOpenSection(next ? "parcel" : null)}
              >
                <Typography variant="body2" sx={{ fontWeight: 650 }}>
                  {order.parcel_description || "Standard parcel"}
                  {order.parcel_weight_kg
                    ? ` · ${order.parcel_weight_kg} kg`
                    : ""}
                </Typography>
                <Typography
                  variant="caption"
                  className="track-num"
                  sx={{ color: "text.secondary", display: "block", mt: 0.5 }}
                >
                  Tracking: {order.tracking_code}
                </Typography>
              </Disclosure>
            </Box>

            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              startIcon={<HelpOutlineRounded />}
              onClick={onOpenHelp}
              sx={{
                minHeight: 48,
                borderRadius: "999px",
                borderColor: "divider",
                color: "text.primary",
                fontWeight: 650,
              }}
            >
              Report an issue or get help
            </Button>

            {onTrackAnother && !closed && (
              <Button
                fullWidth
                variant="text"
                color="inherit"
                onClick={onTrackAnother}
                sx={{
                  minHeight: 44,
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 650,
                  color: "text.secondary",
                }}
              >
                Track another parcel
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
