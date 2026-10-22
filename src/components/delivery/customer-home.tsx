"use client";

import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Close from "@mui/icons-material/Close";
import ContentPasteOutlined from "@mui/icons-material/ContentPasteOutlined";
import HistoryToggleOff from "@mui/icons-material/HistoryToggleOff";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import NavigationOutlined from "@mui/icons-material/NavigationOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import Search from "@mui/icons-material/Search";
import TrackChangesOutlined from "@mui/icons-material/TrackChangesOutlined";
import WarningAmber from "@mui/icons-material/WarningAmber";
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
import { alpha } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  memo,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { Loader } from "@/components/delivery/loader";

import {
  buildTodayItems,
  codDue,
  describeDelay,
  displayTrackingCode,
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
import type { DeliveryOrder, StatusEvent } from "@/lib/delivery/types";

/* ----------------------------------------------------------------- shared */

import {
  StatusChip,
  statusTone,
  type Tone,
  toneSx,
} from "@/components/delivery/customer-ui-utils";

export { StatusChip, statusTone, toneSx, type Tone };

const pageGutter = { px: 2 } as const;

/* ---------------------------------------------------------------- top bar */

/**
 * Shared header for every customer page: a large title with an optional
 * supporting line and the notifications bell. Pages one level deep get a
 * back button instead of the bell. Sign-in lives in each page body, next to
 * what it unlocks, so the header never repeats it.
 */
export const CustomerHeader = memo(function CustomerHeader({
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
});

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

/** Home's primary action: the whole surface opens /pickup. */
const PickupHero = memo(function PickupHero() {
  return (
    <Card
      elevation={0}
      sx={{
        mx: 2,
        mt: 1,
        borderRadius: "24px",
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(theme.palette.primary.main, 0.16)
            : alpha(theme.palette.primary.main, 0.08),
        border: 1,
        borderColor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(theme.palette.primary.main, 0.32)
            : alpha(theme.palette.primary.main, 0.2),
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
              Book a rider to collect your parcel in Yangon.
            </Typography>
          </Box>
          <Box
            component="img"
            src="/icons/pickup.svg"
            alt=""
            sx={{
              display: "block",
              width: { xs: 72, sm: 88 },
              height: { xs: 72, sm: 88 },
              flex: "none",
            }}
          />
        </Stack>
      </CardActionArea>
    </Card>
  );
});

/** Once a parcel is on the way, booking another is a quiet row under it. */
const PickupRow = memo(function PickupRow() {
  return (
    <Box sx={{ px: 2, mt: 3 }}>
      <ListItemButton
        component={Link}
        href="/pickup"
        sx={{
          gap: 1.5,
          minHeight: 64,
          px: 1.5,
          borderRadius: "16px",
          bgcolor: "grey.100",
        }}
      >
        <Box
          component="img"
          src="/icons/pickup.svg"
          alt=""
          sx={{ display: "block", width: 40, height: 40, flex: "none" }}
        />
        <ListItemText
          primary="Request a pickup"
          secondary="Book a rider to collect a parcel in Yangon."
          slotProps={{ primary: { sx: { fontWeight: 700, fontSize: 14 } } }}
          sx={{ m: 0 }}
        />
        <ChevronRight color="disabled" />
      </ListItemButton>
    </Box>
  );
});

const MoreShortcuts = memo(function MoreShortcuts({
  onOpenHelp,
}: {
  onOpenHelp: () => void;
}) {
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
      <List disablePadding>
        <ListItem disablePadding>
          <ShortcutRow
            component={Link}
            href="/track"
            illustration="/icons/track-parcel.svg"
            title="Track a parcel"
            detail="Enter a tracking code or scan it."
          />
        </ListItem>
        <ListItem disablePadding>
          <ShortcutRow
            onClick={onOpenHelp}
            illustration="/icons/get-help.svg"
            title="Help and support"
            detail="Delivery questions and issues."
          />
        </ListItem>
      </List>
    </Box>
  );
});

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
            bgcolor: (theme) => alpha(theme.palette.common.white, 0.2),
            "& .MuiLinearProgress-bar": {
              borderRadius: "999px",
              bgcolor: "primary.light",
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
              {displayTrackingCode(order.tracking_code)}
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
          primary={displayTrackingCode(item.order.tracking_code)}
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
  const inputId = useId();
  return (
    <>
      <Box component="label" htmlFor={inputId} sx={visuallyHidden}>
        {ariaLabel}
      </Box>
      <OutlinedInput
        id={inputId}
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
              <IconButton
                aria-label="Clear"
                onClick={onClear}
                sx={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
              >
                <Close fontSize="small" />
              </IconButton>
            )}
            {!value && onPaste && (
              <IconButton
                aria-label="Paste tracking code"
                onClick={onPaste}
                sx={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
              >
                <ContentPasteOutlined fontSize="small" />
              </IconButton>
            )}
            {!value && onScan && (
              <IconButton
                aria-label="Scan tracking code"
                onClick={onScan}
                sx={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
              >
                <QrCodeScannerOutlined fontSize="small" />
              </IconButton>
            )}
            <Button
              type="submit"
              variant="contained"
              sx={{
                px: 2,
                height: 44,
                minHeight: 44,
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
    </>
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
          ariaLabel="Tracking code"
        />
      </Box>
      {!code && recent.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          role="group"
          aria-label="Recent tracking codes"
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
  const activeOrders = orders.filter((order) =>
    ["pending", "assigned", "accepted", "picked_up", "in_transit"].includes(
      order.status,
    ),
  );
  const historyOrders = orders
    .filter((order) =>
      ["delivered", "failed", "cancelled"].includes(order.status),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const next = pickNextParcel(activeOrders);
  const today = buildTodayItems(activeOrders, statusEvents, now);
  const rest = today.filter((item) => item.order.id !== next?.id);
  const codOrders = codDue(orders);
  const codCount = codOrders.length;
  // The next parcel's card already shows its own COD, so the summary chip
  // only earns its place when more than that one payment is due.
  const showCodChip =
    codCount > 1 || (codCount === 1 && codOrders[0]?.id !== next?.id);

  const activeCount = activeOrders.length;

  // A parcel on the way leads the page; booking another waits underneath.
  const hasLive = isAuthenticated && next != null;

  return (
    <>
      {!hasLive && <PickupHero />}

      <Box
        component="section"
        id="active-deliveries"
        aria-labelledby="active-deliveries-title"
        sx={{ mt: hasLive ? 1 : 3, scrollMarginTop: 72 }}
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
            Your deliveries
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
        ) : (
          <Stack
            direction="row"
            sx={{
              mx: 2,
              mt: 1,
              gap: 1.5,
              minHeight: 72,
              px: 1.5,
              alignItems: "center",
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
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                Nothing on the way
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Parcels heading to you will show up here.
              </Typography>
            </Box>
          </Stack>
        )}
      </Box>

      {isAuthenticated && historyOrders.length > 0 && (
        <Box
          component="section"
          aria-labelledby="delivery-history-title"
          sx={{ mt: 2 }}
        >
          <Stack
            direction="row"
            sx={{ alignItems: "center", px: 2, minHeight: 40 }}
          >
            <Typography
              id="delivery-history-title"
              variant="h6"
              component="h2"
              sx={{ fontWeight: 750 }}
            >
              History
            </Typography>
            <Button
              component={Link}
              href="/orders"
              color="secondary"
              endIcon={<ArrowForward />}
              sx={{ ml: "auto", minHeight: 40, fontWeight: 700 }}
            >
              See all
            </Button>
          </Stack>
          <List
            disablePadding
            sx={{
              px: 2,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 1,
            }}
          >
            {historyOrders.slice(0, 3).map((order) => (
              <ListItem key={order.id} disablePadding>
                <ListItemButton
                  component={Link}
                  href={`/track?order=${encodeURIComponent(order.id)}`}
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
                    primary={order.delivery_address}
                    secondary={`${displayTrackingCode(order.tracking_code)} · ${formatDateTime(order.created_at)}`}
                    slotProps={{
                      primary: {
                        noWrap: true,
                        sx: { fontWeight: 700, fontSize: 14 },
                      },
                      secondary: { noWrap: true, sx: { fontSize: 12 } },
                    }}
                  />
                  <StatusChip status={order.status} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {isAuthenticated && showCodChip && (
        <Box sx={{ px: 2, mt: 2 }}>
          <Chip
            clickable
            onClick={onOpenCod}
            icon={<PaymentsOutlined />}
            label={`${codCount} COD ${codCount === 1 ? "payment" : "payments"} due`}
            sx={{ ...toneSx("warning"), height: 36, borderRadius: "999px" }}
          />
        </Box>
      )}

      {hasLive && <PickupRow />}

      <MoreShortcuts onOpenHelp={onOpenHelp} />
    </>
  );
}

/* ----------------------------------------------------------------- sheets */

export { CodSheet, type CodSheetProps } from "@/components/delivery/cod-sheet";
export {
  CustomerSheet,
  type CustomerSheetProps,
  Sheet,
} from "@/components/delivery/customer-sheet";
export {
  faqs,
  HELP_TOPICS,
  HelpSheet,
  type HelpSheetProps,
  type HelpTopic,
} from "@/components/delivery/help-sheet";
export {
  type NotificationFilter,
  NotificationRow,
  NotificationsPage,
  type NotificationsPageProps,
} from "@/components/delivery/notifications-page";
export {
  codeFromScan,
  ScanSheet,
  type ScanSheetProps,
  ScanView,
} from "@/components/delivery/scan-sheet";

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
            label={displayTrackingCode(order.tracking_code)}
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
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <Loader label="Loading your deliveries…" />
      </Box>
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
