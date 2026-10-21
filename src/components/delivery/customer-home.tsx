"use client";

import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Close from "@mui/icons-material/Close";
import ContentPasteOutlined from "@mui/icons-material/ContentPasteOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import HistoryToggleOff from "@mui/icons-material/HistoryToggleOff";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import NavigationOutlined from "@mui/icons-material/NavigationOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import Search from "@mui/icons-material/Search";
import TrackChangesOutlined from "@mui/icons-material/TrackChangesOutlined";
import WarningAmber from "@mui/icons-material/WarningAmber";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import OutlinedInput from "@mui/material/OutlinedInput";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import {
  buildTodayItems,
  type CustomerNotification,
  codDue,
  describeDelay,
  normaliseCode,
  pickNextParcel,
  progressPercent,
  readRecentCodes,
  type TodayItem,
  type TodayState,
} from "@/lib/delivery/customer-home";
import {
  currency,
  formatDateTime,
  formatTime,
  nextCustomerAction,
  timeUntil,
} from "@/lib/delivery/format";
import { createSupportCase } from "@/lib/delivery/operations-actions";
import type {
  DeliveryOrder,
  DeliveryStatus,
  StatusEvent,
} from "@/lib/delivery/types";
import { STATUS_LABELS } from "@/lib/delivery/types";
import { createClient } from "@/lib/supabase/client";

/* ----------------------------------------------------------------- shared */

export type Tone = "error" | "warning" | "info" | "success" | "neutral";

export function toneSx(tone: Tone) {
  return tone === "neutral"
    ? { bgcolor: "grey.100", color: "text.secondary" }
    : { bgcolor: `${tone}.light`, color: `${tone}.dark` };
}

const statusTone: Record<DeliveryStatus, Tone> = {
  pending: "neutral",
  assigned: "warning",
  accepted: "warning",
  picked_up: "info",
  in_transit: "info",
  delivered: "success",
  failed: "error",
  cancelled: "error",
};

export function StatusChip({ status }: { status: DeliveryStatus }) {
  return (
    <Chip
      size="small"
      label={STATUS_LABELS[status]}
      sx={{ ...toneSx(statusTone[status]), height: 28 }}
    />
  );
}

const pageGutter = { px: 2 } as const;

/* ---------------------------------------------------------------- top bar */

/**
 * Shared header for every customer page: a large title with an optional
 * supporting line and the notifications bell. Pages one level deep get a
 * back button instead of the bell. Sign-in lives in each page body, next to
 * what it unlocks, so the header never repeats it.
 */
export function CustomerHeader({
  title,
  subtitle,
  isAuthenticated,
  unreadCount,
  onBack,
  action,
  showBell = true,
}: {
  title: string;
  subtitle?: string;
  isAuthenticated: boolean;
  unreadCount: number;
  /** Shows a back button instead of the bell. */
  onBack?: () => void;
  /** Replaces the bell, e.g. "Mark all read" on Notifications. */
  action?: ReactNode;
  /** Off where the page body already links to notifications. */
  showBell?: boolean;
}) {
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: "background.default", pt: "env(safe-area-inset-top)" }}
    >
      <Toolbar
        disableGutters
        sx={{ minHeight: 72, px: 2, gap: 1, alignItems: "center" }}
      >
        {onBack && (
          <IconButton
            onClick={onBack}
            aria-label="Back"
            edge="start"
            sx={{ width: 48, height: 48, color: "text.primary" }}
          >
            <ArrowBack />
          </IconButton>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h5"
            component="h1"
            noWrap
            sx={{ fontWeight: 750, lineHeight: "30px" }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              noWrap
              sx={{ color: "text.secondary", lineHeight: "20px" }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {action ??
          (!onBack && showBell && isAuthenticated ? (
            <IconButton
              component={Link}
              href="/notifications"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              sx={{ width: 48, height: 48 }}
            >
              <Badge badgeContent={unreadCount} color="error" max={9}>
                <Box
                  component="img"
                  src="/icons/notifications.svg"
                  alt=""
                  sx={{ display: "block", width: 32, height: 32 }}
                />
              </Badge>
            </IconButton>
          ) : null)}
      </Toolbar>
    </AppBar>
  );
}

export function DemoChip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Box sx={{ ...pageGutter, mt: 1.5 }}>
      <Chip
        label="Sample data · preview only, not your deliveries"
        onDelete={onDismiss}
        deleteIcon={<Close aria-label="Dismiss notice" />}
        sx={{
          ...toneSx("warning"),
          maxWidth: "100%",
          height: "auto",
          minHeight: 36,
          "& .MuiChip-label": { whiteSpace: "normal", py: 0.75 },
          "& .MuiChip-deleteIcon": { color: "inherit" },
        }}
      />
    </Box>
  );
}

/* ------------------------------------------------------------------- home */

const todayLabels: Record<TodayState, string> = {
  missed: "Missed",
  delayed: "Delayed",
  arriving: "Arriving now",
  on_the_way: "On the way",
  scheduled: "Scheduled",
  delivered: "Delivered",
};

const todayTone: Record<TodayState, Tone> = {
  missed: "error",
  delayed: "warning",
  arriving: "info",
  on_the_way: "info",
  scheduled: "neutral",
  delivered: "success",
};

const todayIcons: Record<TodayState, ReactElement> = {
  missed: <WarningAmber />,
  delayed: <HistoryToggleOff />,
  arriving: <NavigationOutlined />,
  on_the_way: <LocalShippingOutlined />,
  scheduled: <Inventory2Outlined />,
  delivered: <CheckCircleOutlined />,
};

function heroCopy(order: DeliveryOrder, now: number) {
  const eta = order.estimated_delivery_at;
  const outNow = order.status === "picked_up" || order.status === "in_transit";
  if (!outNow) {
    return {
      main: "Being collected by your rider",
      sub: eta
        ? `Estimated arrival around ${formatTime(eta)}`
        : "An estimate appears after pickup.",
    };
  }
  if (!eta) {
    return {
      main: "Arrival time being estimated",
      sub: "We’ll show a time as soon as the route updates.",
    };
  }
  if (now - Date.parse(eta) > 5 * 60_000) {
    return {
      main: "Running late",
      sub: `Was estimated around ${formatTime(eta)}`,
    };
  }
  const until = timeUntil(eta);
  return {
    main: until === "Arriving now" ? until : `Arriving in ${until}`,
    sub: `Estimated around ${formatTime(eta)}`,
  };
}

/** Secondary shortcut: a quiet filled row, no outline, so the next parcel stays primary. */
function ShortcutRow({
  illustration,
  title,
  detail,
  ...rest
}: {
  illustration: string;
  title: string;
  detail: string;
} & ({ component: typeof Link; href: string } | { onClick: () => void })) {
  return (
    <ListItemButton
      {...rest}
      sx={{ gap: 1.5, minHeight: 72, px: 1.5, borderRadius: "16px" }}
    >
      <Box
        component="img"
        src={illustration}
        alt=""
        sx={{ display: "block", width: 48, height: 48, flex: "none" }}
      />
      <ListItemText
        primary={title}
        secondary={detail}
        slotProps={{ primary: { sx: { fontWeight: 700, fontSize: 14 } } }}
        sx={{ m: 0 }}
      />
      <ChevronRight color="disabled" />
    </ListItemButton>
  );
}

/** Home's primary action: one full-width card, the whole surface opens /pickup. */
function PickupHero() {
  return (
    <Card
      elevation={0}
      sx={{
        mx: 2,
        mt: 1,
        borderRadius: "24px",
        bgcolor: "#FFF7ED",
        border: 1,
        borderColor: "#FED7AA",
      }}
    >
      <CardActionArea component={Link} href="/pickup" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h5"
              component="h2"
              sx={{ fontWeight: 750, lineHeight: 1.2 }}
            >
              Request a pickup
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", mt: 0.75 }}
            >
              A rider collects your parcel from your door, anywhere in Yangon.
            </Typography>
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                mt: 2,
                minHeight: 44,
                px: 2.25,
                borderRadius: "999px",
                bgcolor: "primary.main",
                color: "primary.contrastText",
                typography: "body2",
                fontWeight: 700,
              }}
            >
              Request pickup <ArrowForward fontSize="small" />
            </Box>
          </Box>
          <Box
            component="img"
            src="/icons/pickup.svg"
            alt=""
            sx={{ display: "block", width: 88, height: 88, flex: "none" }}
          />
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function MoreShortcuts({ onOpenHelp }: { onOpenHelp: () => void }) {
  return (
    <Box
      component="nav"
      aria-label="More"
      sx={{
        mx: 2,
        mt: 3,
        borderRadius: "16px",
        bgcolor: "grey.100",
        overflow: "hidden",
      }}
    >
      <ShortcutRow
        component={Link}
        href="/track"
        illustration="/icons/track-parcel.svg"
        title="Track a parcel"
        detail="Enter a tracking code or scan it."
      />
      <ShortcutRow
        onClick={onOpenHelp}
        illustration="/icons/get-help.svg"
        title="Help and support"
        detail="Delivery questions and issues."
      />
    </Box>
  );
}

function NextParcelCard({ order, now }: { order: DeliveryOrder; now: number }) {
  const copy = heroCopy(order, now);
  const delay = describeDelay(order, now);
  const primaryAction = nextCustomerAction(order.status, delay.isDelayed);
  return (
    <Card
      elevation={0}
      sx={{
        mx: 2,
        mt: 1.5,
        borderRadius: "20px",
        bgcolor: "secondary.main",
        color: "secondary.contrastText",
      }}
    >
      <CardActionArea
        component={Link}
        href={`/track?order=${encodeURIComponent(order.id)}`}
        sx={{ p: 2 }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography
            variant="overline"
            sx={{ opacity: 0.8, fontWeight: 650, lineHeight: 1.5 }}
          >
            Next arriving
          </Typography>
          <StatusChip status={order.status} />
        </Stack>
        <Typography
          variant="h5"
          component="strong"
          sx={{ display: "block", mt: 1.25, fontWeight: 750 }}
        >
          {copy.main}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.86 }}>
          {copy.sub}
        </Typography>
        {delay.isDelayed && (
          <Chip
            size="small"
            icon={<WarningAmber />}
            label={`Delayed about ${delay.minutes} min`}
            sx={{ ...toneSx("warning"), mt: 1.25 }}
          />
        )}
        {order.cod_amount > 0 && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mt: 1.5 }}
          >
            <PaymentsOutlined fontSize="small" />
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
              Cash on delivery · {currency.format(order.cod_amount)}
            </Typography>
            <Chip
              size="small"
              label={
                order.cod_status === "collected" ||
                order.cod_status === "settled"
                  ? "Paid"
                  : "Due on arrival"
              }
              sx={toneSx(
                order.cod_status === "collected" ||
                  order.cod_status === "settled"
                  ? "success"
                  : "warning",
              )}
            />
          </Stack>
        )}
        <LinearProgress
          variant="determinate"
          value={progressPercent(order)}
          aria-label="Delivery progress"
          sx={{
            mt: 2,
            height: 6,
            borderRadius: "999px",
            bgcolor: "rgb(255 255 255 / 0.2)",
            "& .MuiLinearProgress-bar": {
              borderRadius: "999px",
              bgcolor: "var(--color-brand-orange)",
            },
          }}
        />
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            mt: 1.75,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ display: "block", opacity: 0.75 }}
            >
              {order.tracking_code}
            </Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {order.driver_name ?? "Rider being assigned"}
              {order.vehicle_label ? ` · ${order.vehicle_label}` : ""}
            </Typography>
          </Box>
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              minHeight: 48,
              px: 2.25,
              borderRadius: "999px",
              bgcolor: "background.paper",
              color: "secondary.main",
              typography: "body2",
              fontWeight: 700,
            }}
          >
            {primaryAction} <ArrowForward fontSize="small" />
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function TodayRow({ item }: { item: TodayItem }) {
  const label =
    item.state === "delayed" && item.delayMinutes > 0
      ? `Delayed · ${item.delayMinutes} min`
      : todayLabels[item.state];
  const missed = item.state === "missed";
  return (
    <ListItem disablePadding>
      <ListItemButton
        component={Link}
        href={`/track?order=${encodeURIComponent(item.order.id)}`}
        sx={{
          gap: 1.25,
          minHeight: 64,
          px: 1.5,
          borderRadius: "16px",
          border: missed ? 1 : 0,
          borderColor: "error.main",
          bgcolor: missed ? "error.light" : "grey.100",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontWeight: 650,
            width: 64,
            flex: "none",
            lineHeight: 1.2,
          }}
        >
          {item.etaAt
            ? formatTime(item.etaAt)
            : item.state === "delivered" || item.state === "missed"
              ? "—"
              : "ETA pending"}
        </Typography>
        <ListItemText
          sx={{ minWidth: 0, m: 0 }}
          primary={item.order.tracking_code}
          secondary={item.order.delivery_address}
          slotProps={{
            primary: { sx: { fontWeight: 700, fontSize: 14 } },
            secondary: { noWrap: true, sx: { fontSize: 12 } },
          }}
        />
        <Chip
          size="small"
          icon={todayIcons[item.state]}
          label={label}
          sx={{
            ...toneSx(todayTone[item.state]),
            height: 28,
            "& .MuiChip-icon": { color: "inherit", fontSize: 16 },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}

function TrackingField({
  value,
  onChange,
  onClear,
  onPaste,
  onScan,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onPaste?: () => void;
  onScan?: () => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <OutlinedInput
      fullWidth
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{
        "aria-label": ariaLabel,
        autoCapitalize: "characters",
        autoComplete: "off",
        spellCheck: false,
        style: { fontSize: 16, fontWeight: 560 },
      }}
      startAdornment={
        <InputAdornment position="start">
          <Search />
        </InputAdornment>
      }
      endAdornment={
        <InputAdornment position="end" sx={{ gap: 0.25 }}>
          {value && onClear && (
            <IconButton size="small" aria-label="Clear" onClick={onClear}>
              <Close fontSize="small" />
            </IconButton>
          )}
          {!value && onPaste && (
            <IconButton
              size="small"
              aria-label="Paste tracking number"
              onClick={onPaste}
            >
              <ContentPasteOutlined fontSize="small" />
            </IconButton>
          )}
          {!value && onScan && (
            <IconButton
              size="small"
              aria-label="Scan parcel code"
              onClick={onScan}
            >
              <QrCodeScannerOutlined fontSize="small" />
            </IconButton>
          )}
          <Button
            type="submit"
            variant="contained"
            sx={{
              px: 2,
              height: 40,
              minHeight: 40,
              minWidth: 0,
              ml: 0.5,
              flex: "none",
              borderRadius: "999px",
            }}
          >
            Track
          </Button>
        </InputAdornment>
      }
      sx={{
        bgcolor: "background.paper",
        pr: 0.5,
        pl: 1.5,
      }}
    />
  );
}

/**
 * Tracking entry point. On Home it opens the Track page; on Track it looks up in place.
 */
export function TrackingLookup({
  onLookup,
  onOpenScan,
}: {
  onLookup?: (code: string) => void;
  onOpenScan?: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readRecentCodes());
  }, []);

  function go(value: string) {
    const clean = value.trim();
    if (!normaliseCode(clean)) return;
    if (onLookup) {
      onLookup(clean);
      setRecent(readRecentCodes());
    } else {
      router.push(`/track?code=${encodeURIComponent(clean)}`);
    }
    setCode("");
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setCode(text.trim());
    } catch {
      // Clipboard permission denied; the field stays editable by hand.
    }
  }

  return (
    <Box sx={{ px: 2, mt: 1.5 }}>
      <Box
        component="form"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          go(code);
        }}
      >
        <TrackingField
          value={code}
          onChange={setCode}
          onClear={() => setCode("")}
          onPaste={() => void paste()}
          onScan={onOpenScan}
          placeholder="Tracking code"
          ariaLabel="Tracking number"
        />
      </Box>
      {!code && recent.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          role="group"
          aria-label="Recent tracking numbers"
          sx={{
            mt: 1.25,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {recent.map((item) => (
            <Chip
              key={item}
              clickable
              variant="outlined"
              label={item}
              onClick={() => go(item)}
              sx={{ flex: "none", height: 36, borderRadius: "999px" }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function SignedOutPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Paper
      elevation={0}
      sx={{ mx: 2, mt: 1.5, borderRadius: "16px", bgcolor: "grey.100" }}
    >
      <ListItemButton
        onClick={onSignIn}
        sx={{ gap: 1.5, minHeight: 64, borderRadius: "16px" }}
      >
        <Avatar sx={{ ...toneSx("info"), width: 40, height: 40 }}>
          <TrackChangesOutlined />
        </Avatar>
        <ListItemText
          primary="Sign in to see your deliveries"
          secondary="Your live orders, ETA, COD, and tracking will appear here."
          slotProps={{ primary: { sx: { fontWeight: 700, fontSize: 14 } } }}
          sx={{ m: 0 }}
        />
        <ChevronRight color="disabled" />
      </ListItemButton>
    </Paper>
  );
}

export function CustomerHome({
  orders,
  statusEvents,
  isAuthenticated,
  now,
  onSignIn,
  onOpenCod,
  onOpenHelp,
}: {
  /** Real orders only. Sample records must never be passed in. */
  orders: DeliveryOrder[];
  statusEvents: StatusEvent[];
  isAuthenticated: boolean;
  now: number;
  onSignIn: () => void;
  onOpenCod: () => void;
  onOpenHelp: () => void;
}) {
  const next = pickNextParcel(orders);
  const today = buildTodayItems(orders, statusEvents, now);
  const rest = today.filter((item) => item.order.id !== next?.id);
  const codOrders = codDue(orders);
  const codCount = codOrders.length;
  // The next parcel's card already shows its own COD, so the summary chip
  // only earns its place when more than that one payment is due.
  const showCodChip =
    codCount > 1 || (codCount === 1 && codOrders[0]?.id !== next?.id);

  const activeCount = orders.filter((order) =>
    ["pending", "assigned", "accepted", "picked_up", "in_transit"].includes(
      order.status,
    ),
  ).length;
  const latest = [...orders].sort((x, y) =>
    y.created_at.localeCompare(x.created_at),
  )[0];

  return (
    <>
      <PickupHero />

      {isAuthenticated && showCodChip && (
        <Box sx={{ px: 2, mt: 1.5 }}>
          <Chip
            clickable
            onClick={onOpenCod}
            icon={<PaymentsOutlined />}
            label={`${codCount} COD ${codCount === 1 ? "payment" : "payments"} due`}
            sx={{ ...toneSx("warning"), height: 36, borderRadius: "999px" }}
          />
        </Box>
      )}

      <Box
        component="section"
        id="active-deliveries"
        aria-labelledby="active-deliveries-title"
        sx={{ mt: 3, scrollMarginTop: 72 }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", px: 2, minHeight: 40 }}
        >
          <Typography
            id="active-deliveries-title"
            variant="h6"
            component="h2"
            sx={{ fontWeight: 750 }}
          >
            Active deliveries
          </Typography>
          {isAuthenticated && activeCount > 0 && (
            <Chip size="small" label={activeCount} sx={toneSx("info")} />
          )}
          {isAuthenticated && orders.length > 0 && (
            <Button
              component={Link}
              href="/orders"
              color="secondary"
              endIcon={<ArrowForward />}
              sx={{ ml: "auto", minHeight: 40, fontWeight: 700 }}
            >
              See all
            </Button>
          )}
        </Stack>

        {!isAuthenticated ? (
          <SignedOutPrompt onSignIn={onSignIn} />
        ) : next ? (
          <>
            <NextParcelCard order={next} now={now} />
            {rest.length > 0 && (
              <List
                disablePadding
                aria-label="Also arriving today"
                sx={{
                  px: 2,
                  mt: 1.5,
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  gap: 1,
                }}
              >
                {rest.map((item) => (
                  <TodayRow key={item.order.id} item={item} />
                ))}
              </List>
            )}
          </>
        ) : latest ? (
          <Box sx={{ px: 2, mt: 1 }}>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
              Nothing on the way right now. Your latest delivery:
            </Typography>
            <ListItemButton
              component={Link}
              href={`/track?order=${encodeURIComponent(latest.id)}`}
              sx={{
                gap: 1.5,
                minHeight: 64,
                px: 1.5,
                borderRadius: "16px",
                bgcolor: "grey.100",
              }}
            >
              <ListItemText
                sx={{ m: 0, minWidth: 0 }}
                primary={latest.delivery_address}
                secondary={`${latest.tracking_code} · ${formatDateTime(latest.created_at)}`}
                slotProps={{
                  primary: {
                    noWrap: true,
                    sx: { fontWeight: 700, fontSize: 14 },
                  },
                  secondary: { noWrap: true, sx: { fontSize: 12 } },
                }}
              />
              <StatusChip status={latest.status} />
            </ListItemButton>
          </Box>
        ) : (
          <Box sx={{ px: 2, mt: 1 }}>
            <ListItemButton
              component={Link}
              href="/track"
              sx={{
                gap: 1.5,
                minHeight: 72,
                px: 1.5,
                borderRadius: "16px",
                bgcolor: "grey.100",
              }}
            >
              <Box
                component="img"
                src="/icons/arriving-today.svg"
                alt=""
                sx={{ display: "block", width: 48, height: 48, flex: "none" }}
              />
              <ListItemText
                primary="No active deliveries"
                secondary="Parcels on their way to you appear here. Have a code? Track it."
                slotProps={{
                  primary: { sx: { fontWeight: 700, fontSize: 14 } },
                }}
                sx={{ m: 0 }}
              />
              <ChevronRight color="disabled" />
            </ListItemButton>
          </Box>
        )}
      </Box>

      <MoreShortcuts onOpenHelp={onOpenHelp} />
    </>
  );
}

/* ----------------------------------------------------------------- sheets */

function Sheet({
  open,
  onClose,
  titleId,
  title,
  children,
  dock,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
  dock?: ReactNode;
}) {
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => undefined}
      disableSwipeToOpen
      disableDiscovery
      slotProps={{
        paper: {
          "aria-labelledby": titleId,
          sx: {
            maxWidth: 430,
            mx: "auto",
            maxHeight: "88dvh",
            borderRadius: "28px 28px 0 0",
            overscrollBehavior: "contain",
          },
        },
      }}
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.paper",
          px: 2,
          pt: 1,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 5,
            mx: "auto",
            borderRadius: "999px",
            bgcolor: "text.secondary",
            opacity: 0.4,
          }}
        />
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            py: 0.5,
          }}
        >
          <Typography
            id={titleId}
            variant="h6"
            component="h2"
            sx={{ fontWeight: 750 }}
          >
            {title}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Close"
            sx={{ bgcolor: "grey.100" }}
          >
            <Close />
          </IconButton>
        </Stack>
      </Box>
      <Box
        sx={{
          px: 2,
          pb: dock ? 0 : "calc(20px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </Box>
      {dock && (
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            px: 2,
            pt: 1.5,
            pb: "calc(16px + env(safe-area-inset-bottom))",
            background:
              "linear-gradient(to bottom, rgb(255 255 255 / 0), #fff 28%)",
          }}
        >
          {dock}
        </Box>
      )}
    </SwipeableDrawer>
  );
}

const notifyIcon: Record<CustomerNotification["kind"], ReactNode> = {
  missed: <WarningAmber />,
  cod_due: <PaymentsOutlined />,
  delivered: <CheckCircleOutlined />,
  assigned: <PersonOutlined />,
  arriving: <LocalShippingOutlined />,
  out_for_delivery: <LocalShippingOutlined />,
  collected: <LocalShippingOutlined />,
};

const notifyLabel: Record<CustomerNotification["kind"], string> = {
  missed: "Delivery issue",
  cod_due: "Payment",
  delivered: "Delivered",
  assigned: "Rider assigned",
  arriving: "Arriving",
  out_for_delivery: "On the way",
  collected: "Collected",
};

function NotificationRow({
  item,
  unread,
  onOpen,
}: {
  item: CustomerNotification;
  unread: boolean;
  onOpen: (id: string) => void;
}) {
  const high = item.priority === "high";
  return (
    <ListItem disablePadding>
      <ListItemButton
        component={Link}
        href={`/track?order=${encodeURIComponent(item.orderId)}`}
        onClick={() => onOpen(item.id)}
        alignItems="flex-start"
        sx={{
          gap: 1.5,
          px: 1.5,
          py: 1.5,
          borderRadius: "16px",
          bgcolor: unread ? "background.paper" : "grey.100",
          boxShadow: unread ? 1 : 0,
        }}
      >
        <Badge
          variant="dot"
          color="error"
          invisible={!unread}
          overlap="circular"
          sx={{ flex: "none" }}
        >
          <Avatar
            sx={{
              ...toneSx(high ? "warning" : "neutral"),
              width: 40,
              height: 40,
            }}
          >
            {notifyIcon[item.kind]}
          </Avatar>
        </Badge>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Chip
              size="small"
              label={notifyLabel[item.kind]}
              sx={{
                ...toneSx(high ? "warning" : "neutral"),
                height: 22,
                fontWeight: 650,
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", ml: "auto !important" }}
            >
              {formatTime(item.at)}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            sx={{ fontWeight: unread ? 750 : 650, mt: 0.75 }}
          >
            {item.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mt: 0.25 }}
          >
            {item.body}
          </Typography>
        </Box>
      </ListItemButton>
    </ListItem>
  );
}

type NotificationFilter = "all" | "unread" | "important";

/** Full-page notification inbox with unread and category badges. */
export function NotificationsPage({
  notifications,
  isUnread,
  isAuthenticated,
  now,
  onOpen,
  onSignIn,
}: {
  notifications: CustomerNotification[];
  isUnread: (item: CustomerNotification) => boolean;
  isAuthenticated: boolean;
  now: number;
  onOpen: (id: string) => void;
  onSignIn: () => void;
}) {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const unreadCount = notifications.filter(isUnread).length;
  const importantCount = notifications.filter(
    (item) => item.priority === "high",
  ).length;
  const visible = notifications.filter((item) =>
    filter === "unread"
      ? isUnread(item)
      : filter === "important"
        ? item.priority === "high"
        : true,
  );
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const groups = [
    {
      id: "today",
      title: "Today",
      items: visible.filter(
        (item) => Date.parse(item.at) >= startOfToday.getTime(),
      ),
    },
    {
      id: "earlier",
      title: "Earlier",
      items: visible.filter(
        (item) => Date.parse(item.at) < startOfToday.getTime(),
      ),
    },
  ].filter((group) => group.items.length > 0);

  if (!isAuthenticated)
    return (
      <Stack
        spacing={1.5}
        sx={{ alignItems: "center", px: 2, py: 6, textAlign: "center" }}
      >
        <Box
          component="img"
          src="/icons/notifications.svg"
          alt=""
          sx={{ display: "block", width: 96, height: 96 }}
        />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 750 }}>
          Sign in for delivery updates
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Arrivals, payments and delivery issues show up here.
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          onClick={onSignIn}
          sx={{ minHeight: 44 }}
        >
          Sign in
        </Button>
      </Stack>
    );

  const filters: { id: NotificationFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: 0 },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "important", label: "Important", count: importantCount },
  ];

  return (
    <Box sx={{ px: 2, pb: 3 }}>
      <Stack
        direction="row"
        spacing={1}
        role="group"
        aria-label="Filter notifications"
        sx={{ mt: 0.5 }}
      >
        {filters.map((item) => {
          const selected = filter === item.id;
          return (
            <Chip
              key={item.id}
              clickable
              onClick={() => setFilter(item.id)}
              aria-pressed={selected}
              label={
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: "center" }}
                >
                  <span>{item.label}</span>
                  {item.count > 0 && (
                    <Box
                      component="span"
                      sx={{
                        minWidth: 20,
                        height: 20,
                        px: 0.5,
                        borderRadius: "999px",
                        display: "inline-grid",
                        placeItems: "center",
                        typography: "caption",
                        fontWeight: 750,
                        bgcolor: selected ? "background.paper" : "error.main",
                        color: selected
                          ? "secondary.main"
                          : "error.contrastText",
                      }}
                    >
                      {item.count > 9 ? "9+" : item.count}
                    </Box>
                  )}
                </Stack>
              }
              sx={{
                height: 40,
                borderRadius: "999px",
                fontWeight: 650,
                bgcolor: selected ? "secondary.main" : "grey.100",
                color: selected ? "secondary.contrastText" : "text.primary",
                "&:hover": {
                  bgcolor: selected ? "secondary.main" : "grey.200",
                },
              }}
            />
          );
        })}
      </Stack>

      {groups.length === 0 ? (
        <Stack
          spacing={1}
          sx={{ alignItems: "center", py: 6, textAlign: "center" }}
        >
          <Box
            component="img"
            src="/icons/notifications.svg"
            alt=""
            sx={{ display: "block", width: 96, height: 96 }}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {notifications.length === 0
              ? "You’re all caught up. Delivery updates will appear here."
              : filter === "unread"
                ? "No unread notifications."
                : "Nothing needs your attention."}
          </Typography>
        </Stack>
      ) : (
        groups.map((group) => (
          <Box
            component="section"
            key={group.id}
            aria-labelledby={`notifications-${group.id}`}
            sx={{ mt: 2.5 }}
          >
            <Typography
              id={`notifications-${group.id}`}
              variant="subtitle2"
              component="h2"
              sx={{ color: "text.secondary", fontWeight: 700, mb: 1 }}
            >
              {group.title}
            </Typography>
            <List
              disablePadding
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr)",
                gap: 1,
              }}
            >
              {group.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  unread={isUnread(item)}
                  onOpen={onOpen}
                />
              ))}
            </List>
          </Box>
        ))
      )}
    </Box>
  );
}

const faqs = [
  {
    q: "Why can’t I see my rider’s location?",
    a: "Live location starts after your rider collects the parcel. If the signal drops, the map shows the last known point.",
  },
  {
    q: "What if I miss the delivery?",
    a: "The parcel is marked “Delivery issue” and you’ll see it under Notifications. Open the parcel for the latest status.",
  },
  {
    q: "How does cash on delivery work?",
    a: "Have the exact amount ready. Your rider records the payment when they hand over the parcel.",
  },
];

const HELP_TOPICS = [
  "Late or missing parcel",
  "Wrong address or landmark",
  "Damaged parcel",
  "Cash on delivery",
  "Something else",
] as const;

/**
 * One place for help: quick fixes first (call the rider, check status), then
 * a request that reaches the support team's case queue with the parcel
 * attached, so nobody has to retype the tracking code.
 */
export function HelpSheet({
  open,
  order,
  requesterId,
  showStatusLink = true,
  onSignIn,
  onClose,
}: {
  open: boolean;
  order: DeliveryOrder | null;
  /** Signed-in customer's id; requests need an account to follow up on. */
  requesterId: string | null;
  /** Off on the parcel's own Track page, where the status is already shown. */
  showStatusLink?: boolean;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState<(typeof HELP_TOPICS)[number] | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const realOrder = order && !order.id.startsWith("demo-") ? order : null;
  const canCall =
    !!order?.driver_phone &&
    !!order.driver_id &&
    !["delivered", "failed", "cancelled"].includes(order.status);

  function close() {
    if (state === "sent") {
      setTopic(null);
      setDetails("");
      setState("idle");
    }
    setError(null);
    onClose();
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requesterId || !topic || !details.trim()) return;
    setState("sending");
    setError(null);
    try {
      await createSupportCase(createClient(), {
        requesterId,
        orderId: realOrder?.id,
        subject: realOrder ? `${topic} · ${realOrder.tracking_code}` : topic,
        description: details,
        priority: topic === "Late or missing parcel" ? "high" : "normal",
      });
      setState("sent");
    } catch (cause) {
      setState("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn’t send your request. Try again.",
      );
    }
  }

  const rowSx = {
    minHeight: 60,
    gap: 1.5,
    border: 1,
    borderColor: "divider",
    borderRadius: "16px",
  } as const;

  return (
    <Sheet open={open} onClose={close} titleId="help-title" title="Get help">
      {order && (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
          About parcel <strong>{order.tracking_code}</strong>
        </Typography>
      )}
      {(canCall || (order && showStatusLink)) && (
        <List
          disablePadding
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 1,
            mb: 2,
          }}
        >
          {canCall && order?.driver_phone && (
            <ListItem disablePadding>
              <ListItemButton
                component="a"
                href={`tel:${order.driver_phone}`}
                sx={rowSx}
              >
                <PhoneOutlined />
                <ListItemText
                  primary="Call your rider"
                  secondary={order.driver_name ?? "Assigned rider"}
                  slotProps={{ primary: { sx: { fontWeight: 700 } } }}
                />
              </ListItemButton>
            </ListItem>
          )}
          {order && showStatusLink && (
            <ListItem disablePadding>
              <ListItemButton
                component={Link}
                href={`/track?order=${encodeURIComponent(order.id)}`}
                onClick={close}
                sx={rowSx}
              >
                <TrackChangesOutlined />
                <ListItemText
                  primary="Check the latest status"
                  secondary="Timeline, estimate and rider location"
                  slotProps={{ primary: { sx: { fontWeight: 700 } } }}
                />
              </ListItemButton>
            </ListItem>
          )}
        </List>
      )}

      {state === "sent" ? (
        <Alert
          severity="success"
          icon={<CheckCircleOutlined />}
          sx={{ borderRadius: "12px" }}
        >
          Request sent. Our support team will follow up on your account
          {realOrder ? ` about ${realOrder.tracking_code}` : ""}.
        </Alert>
      ) : (
        <Box component="form" onSubmit={send}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ fontWeight: 750 }}
          >
            Contact support
          </Typography>
          <Stack
            direction="row"
            role="radiogroup"
            aria-label="What’s the problem?"
            sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}
          >
            {HELP_TOPICS.map((item) => {
              const selected = topic === item;
              return (
                <Chip
                  key={item}
                  role="radio"
                  aria-checked={selected}
                  clickable
                  label={item}
                  onClick={() => setTopic(item)}
                  icon={selected ? <CheckCircleOutlined /> : undefined}
                  sx={{
                    height: 40,
                    borderRadius: "999px",
                    fontWeight: 650,
                    bgcolor: selected ? "secondary.main" : "grey.100",
                    color: selected ? "secondary.contrastText" : "text.primary",
                    "& .MuiChip-icon": { color: "inherit" },
                    "&:hover": {
                      bgcolor: selected ? "secondary.main" : "grey.200",
                    },
                  }}
                />
              );
            })}
          </Stack>
          <OutlinedInput
            fullWidth
            multiline
            minRows={3}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="What happened? Add anything the rider or support should know."
            inputProps={{
              "aria-label": "Describe the problem",
              maxLength: 1000,
            }}
            sx={{ mt: 1.5, bgcolor: "background.paper" }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 1.5, borderRadius: "12px" }}>
              {error}
            </Alert>
          )}
          {requesterId ? (
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={!topic || !details.trim() || state === "sending"}
              sx={{ mt: 1.5, minHeight: 52 }}
            >
              {state === "sending" ? "Sending…" : "Send to support"}
            </Button>
          ) : (
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              size="large"
              onClick={onSignIn}
              sx={{ mt: 1.5, minHeight: 52 }}
            >
              Sign in to contact support
            </Button>
          )}
        </Box>
      )}

      <Box sx={{ mt: 2.5, borderTop: 1, borderColor: "divider" }}>
        {faqs.map((faq) => (
          <Accordion
            key={faq.q}
            disableGutters
            square
            elevation={0}
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              "&::before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{ minHeight: 48, px: 0 }}
            >
              <Typography sx={{ fontWeight: 600 }}>{faq.q}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {faq.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Sheet>
  );
}

/* ------------------------------------------------------------ track search */

/* ------------------------------------------------------------- scan sheet */

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

/** Pulls a tracking number out of a scanned QR code or barcode. */
export function codeFromScan(raw: string) {
  const value = raw.trim();
  try {
    const url = new URL(value);
    return (
      url.searchParams.get("code") ??
      url.pathname.split("/").filter(Boolean).at(-1) ??
      value
    );
  } catch {
    return value;
  }
}

function ScanView({ onDetected }: { onDetected: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const handleDetected = useEffectEvent(onDetected);
  const [status, setStatus] = useState<
    "starting" | "scanning" | "blocked" | "unsupported"
  >("starting");

  useEffect(() => {
    const Detector = (
      window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    let stream: MediaStream | null = null;
    let timer = 0;
    let cancelled = false;
    let finished = false;
    const detector = new Detector({
      formats: ["qr_code", "code_128", "code_39", "ean_13", "data_matrix"],
    });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (media) => {
        if (cancelled) {
          for (const track of media.getTracks()) track.stop();
          return;
        }
        stream = media;
        const element = video.current;
        if (!element) return;
        element.srcObject = media;
        await element.play();
        setStatus("scanning");
        timer = window.setInterval(async () => {
          try {
            const found = await detector.detect(element);
            const value = found[0]?.rawValue;
            if (value && !finished) {
              finished = true;
              handleDetected(codeFromScan(value));
            }
          } catch {
            // A frame can fail to decode; the next one usually works.
          }
        }, 350);
      })
      .catch(() => setStatus("blocked"));

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, []);

  if (status === "unsupported" || status === "blocked")
    return (
      <Alert severity="info" icon={false} sx={{ borderRadius: "12px", mb: 2 }}>
        {status === "blocked"
          ? "Camera access was blocked. Allow it in your browser settings, or type the tracking number instead."
          : "This browser can’t scan codes. Type or paste the tracking number instead."}
      </Alert>
    );

  return (
    <Box sx={{ pb: "calc(20px + env(safe-area-inset-bottom))" }}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "20px",
          bgcolor: "secondary.main",
          aspectRatio: "4 / 3",
        }}
      >
        <video
          ref={video}
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: "18% 14%",
            border: "3px solid #fff",
            borderRadius: "16px",
            boxShadow: "0 0 0 999px rgb(23 43 77 / 0.35)",
          }}
        />
      </Box>
      <Typography
        variant="body2"
        sx={{ mt: 1.5, textAlign: "center", color: "text.secondary" }}
      >
        {status === "starting"
          ? "Starting camera…"
          : "Point the camera at the parcel’s QR code or barcode."}
      </Typography>
    </Box>
  );
}

export function ScanSheet({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  // The camera stays off until the person asks for it.
  const [cameraOn, setCameraOn] = useState(false);

  function close() {
    setCameraOn(false);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} titleId="scan-title" title="Scan parcel">
      {cameraOn ? (
        <ScanView onDetected={onDetected} />
      ) : (
        <Stack
          spacing={1.5}
          sx={{ pb: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          <Typography sx={{ color: "text.secondary" }}>
            Your camera is off. Turn it on only when you want to scan a parcel’s
            QR code or barcode.
          </Typography>
          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<QrCodeScannerOutlined />}
            onClick={() => setCameraOn(true)}
            sx={{ minHeight: 52 }}
          >
            Turn on camera to scan
          </Button>
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            onClick={close}
            sx={{ minHeight: 48 }}
          >
            Type the number instead
          </Button>
        </Stack>
      )}
    </Sheet>
  );
}

/* --------------------------------------------------------------- cod sheet */

export function CodSheet({
  open,
  orders,
  onClose,
}: {
  open: boolean;
  orders: DeliveryOrder[];
  onClose: () => void;
}) {
  const total = orders.reduce((sum, order) => sum + order.cod_amount, 0);
  return (
    <Sheet open={open} onClose={onClose} titleId="cod-title" title="COD due">
      {orders.length === 0 ? (
        <Typography sx={{ pb: 2, color: "text.secondary" }}>
          No cash payments are due right now.
        </Typography>
      ) : (
        <>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 1.5,
              borderRadius: "16px",
              bgcolor: "warning.light",
            }}
          >
            <Typography variant="body2" sx={{ color: "warning.dark" }}>
              Total payable on delivery
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontWeight: 750, color: "warning.dark" }}
            >
              {currency.format(total)}
            </Typography>
            <Typography variant="caption" sx={{ color: "warning.dark" }}>
              Pay your rider when each parcel arrives.
            </Typography>
          </Paper>
          <List
            disablePadding
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 1,
              pb: "calc(20px + env(safe-area-inset-bottom))",
            }}
          >
            {orders.map((order) => (
              <ListItem disablePadding key={order.id}>
                <ListItemButton
                  component={Link}
                  href={`/track?order=${encodeURIComponent(order.id)}`}
                  onClick={onClose}
                  sx={{
                    gap: 1.5,
                    minHeight: 64,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: "16px",
                  }}
                >
                  <ListItemText
                    primary={order.tracking_code}
                    secondary={currency.format(order.cod_amount)}
                    slotProps={{
                      primary: { sx: { fontWeight: 700, fontSize: 14 } },
                      secondary: { sx: { fontSize: 13 } },
                    }}
                    sx={{ m: 0 }}
                  />
                  <StatusChip status={order.status} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------- track extras */

export function TrackLookupNotice({ code }: { code: string }) {
  return (
    <Box sx={{ px: 2, mt: 1.5 }}>
      <Alert icon={false} severity="info" sx={{ borderRadius: "12px" }}>
        No delivery found for “{code}”. Check the code on your receipt or
        message and try again.
      </Alert>
    </Box>
  );
}

export function ParcelSwitcher({
  orders,
  selectedId,
  onSelect,
}: {
  orders: DeliveryOrder[];
  selectedId: string;
  onSelect: (order: DeliveryOrder) => void;
}) {
  if (orders.length === 0) return null;
  return (
    <Box component="nav" aria-labelledby="your-parcels" sx={{ mt: 2 }}>
      <Typography
        id="your-parcels"
        variant="subtitle2"
        component="h2"
        sx={{ px: 2, color: "text.secondary", fontWeight: 700 }}
      >
        Your parcels
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mt: 1,
          px: 2,
          overflowX: "auto",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {orders.slice(0, 8).map((order) => (
          <Chip
            key={order.id}
            clickable
            label={order.tracking_code}
            onClick={() => onSelect(order)}
            aria-pressed={order.id === selectedId}
            color={order.id === selectedId ? "secondary" : "default"}
            variant={order.id === selectedId ? "filled" : "outlined"}
            sx={{ flex: "none", height: 40, borderRadius: "999px" }}
          />
        ))}
      </Stack>
    </Box>
  );
}

/* --------------------------------------------------------------- skeleton */

export function HomeSkeleton() {
  return (
    <Box aria-busy="true" sx={pageGutter}>
      <span className="sr-only">Loading your deliveries…</span>
      <Skeleton
        variant="rounded"
        height={188}
        sx={{ mt: 2, borderRadius: "20px" }}
      />
      <Skeleton variant="rounded" height={64} sx={{ mt: 3, mb: 1 }} />
      <Skeleton variant="rounded" height={64} />
    </Box>
  );
}
