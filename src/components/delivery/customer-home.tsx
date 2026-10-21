"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Close from "@mui/icons-material/Close";
import ContentPasteOutlined from "@mui/icons-material/ContentPasteOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import HistoryToggleOff from "@mui/icons-material/HistoryToggleOff";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import IosShare from "@mui/icons-material/IosShare";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import MyLocationOutlined from "@mui/icons-material/MyLocationOutlined";
import NavigationOutlined from "@mui/icons-material/NavigationOutlined";
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";
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
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import OutlinedInput from "@mui/material/OutlinedInput";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
  type ContextAction,
  type CustomerNotification,
  codDue,
  contextualActions,
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
import type {
  DeliveryOrder,
  DeliveryStatus,
  StatusEvent,
  WorkspaceProfile,
} from "@/lib/delivery/types";
import { STATUS_LABELS } from "@/lib/delivery/types";

/* ----------------------------------------------------------------- shared */

type Tone = "error" | "warning" | "info" | "success" | "neutral";

function toneSx(tone: Tone) {
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

function StatusChip({ status }: { status: DeliveryStatus }) {
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

export function CustomerTopBar({
  profile,
  isAuthenticated,
  unreadCount,
  onSignIn,
  onOpenNotifications,
}: {
  profile: WorkspaceProfile | null;
  isAuthenticated: boolean;
  unreadCount: number;
  onSignIn: () => void;
  onOpenNotifications: () => void;
}) {
  const firstName = profile?.full_name?.split(" ")[0];
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: "background.default", pt: "env(safe-area-inset-top)" }}
    >
      <Toolbar disableGutters sx={{ minHeight: 64, px: 2, gap: 1.5 }}>
        {isAuthenticated ? (
          <IconButton
            component={Link}
            href="/profile"
            aria-label="Your profile"
            sx={{ p: 0 }}
          >
            <Avatar
              sx={{
                width: 40,
                height: 40,
                fontSize: 16,
                fontWeight: 700,
                ...toneSx("info"),
              }}
            >
              <PersonOutlined />
            </Avatar>
          </IconButton>
        ) : (
          <Avatar sx={{ width: 40, height: 40, ...toneSx("neutral") }}>
            <PersonOutlined />
          </Avatar>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{ fontWeight: 750, lineHeight: "22px" }}
          >
            {isAuthenticated && firstName ? `Hi, ${firstName}` : "Welcome"}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.secondary",
              lineHeight: "16px",
            }}
          >
            {isAuthenticated
              ? "Where is your parcel?"
              : "Sign in to see your deliveries"}
          </Typography>
        </Box>
        {isAuthenticated ? (
          <IconButton
            color="inherit"
            onClick={onOpenNotifications}
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
            sx={{ width: 48, height: 48 }}
          >
            <Badge
              variant="dot"
              color="error"
              invisible={unreadCount === 0}
              overlap="circular"
            >
              <NotificationsNoneOutlined />
            </Badge>
          </IconButton>
        ) : (
          <Button
            variant="contained"
            color="secondary"
            onClick={onSignIn}
            sx={{ px: 2, minHeight: 40, flex: "none" }}
          >
            Sign in
          </Button>
        )}
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
  const delay = describeDelay(order, now);
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
    sub: `Estimated around ${formatTime(eta)}${delay.isDelayed ? ` · traffic adds about ${delay.minutes} min` : ""}`,
  };
}

function QuickAction({
  label,
  badge,
  illustration,
  ...rest
}: {
  label: string;
  badge?: number;
  illustration: string;
} & (
  | { component: typeof Link; href: string }
  | { component: "a"; href: string }
  | { component: "button"; onClick: () => void }
)) {
  return (
    <ButtonBase
      {...rest}
      sx={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.5,
        minHeight: 104,
        borderRadius: "16px",
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        px: 0.5,
        py: 1.25,
        typography: "caption",
        fontWeight: 650,
        lineHeight: "16px",
        textAlign: "center",
        color: "text.primary",
      }}
    >
      <Badge badgeContent={badge} color="error" max={9}>
        <Box
          component="img"
          src={illustration}
          alt=""
          sx={{ display: "block", width: 56, height: 56 }}
        />
      </Badge>
      {label}
    </ButtonBase>
  );
}

/** Primary job on Home: start a pickup. The whole card is the tap target. */
function PickupPrompt() {
  return (
    <Card
      elevation={0}
      sx={{
        mx: 2,
        mt: 2,
        borderRadius: "20px",
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <CardActionArea component={Link} href="/pickup" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ fontWeight: 750, lineHeight: 1.25 }}
            >
              Send a parcel
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              A rider collects it from your door.
            </Typography>
          </Box>
          <Box
            component="img"
            src="/icons/pickup.svg"
            alt=""
            sx={{ display: "block", width: 72, height: 72, flex: "none" }}
          />
        </Stack>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: "center",
            mt: 1.5,
            minHeight: 48,
            px: 1.5,
            borderRadius: "14px",
            bgcolor: "grey.100",
          }}
        >
          <MyLocationOutlined fontSize="small" color="info" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ display: "block", color: "text.secondary" }}
            >
              Pickup from
            </Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 650 }}>
              Current location
            </Typography>
          </Box>
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              minHeight: 36,
              px: 1.75,
              borderRadius: "999px",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              typography: "body2",
              fontWeight: 700,
            }}
          >
            Request <ArrowForward fontSize="small" />
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function QuickActions({
  isAuthenticated,
  arrivingCount,
  onSignIn,
  onOpenHelp,
}: {
  isAuthenticated: boolean;
  arrivingCount: number;
  onSignIn: () => void;
  onOpenHelp: () => void;
}) {
  return (
    <Box
      component="nav"
      aria-label="Common tasks"
      sx={{
        px: 2,
        mt: 1.5,
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 1,
      }}
    >
      {isAuthenticated ? (
        <QuickAction
          component="a"
          href="#arriving-today"
          label="Today's deliveries"
          badge={arrivingCount}
          illustration="/icons/arriving-today.svg"
        />
      ) : (
        <QuickAction
          component="button"
          onClick={onSignIn}
          label="Today's deliveries"
          illustration="/icons/arriving-today.svg"
        />
      )}
      <QuickAction
        component={Link}
        href="/orders"
        label="All orders"
        illustration="/icons/track-parcel.svg"
      />
      <QuickAction
        component="button"
        onClick={onOpenHelp}
        label="Report a problem"
        illustration="/icons/get-help.svg"
      />
    </Box>
  );
}

function ContextChips({
  actions,
  order,
  etaAt,
}: {
  actions: ContextAction[];
  order: DeliveryOrder;
  etaAt: string | null;
}) {
  const [note, setNote] = useState("");
  if (actions.length === 0) return null;

  async function share() {
    const text = `Parcel ${order.tracking_code} is on its way${etaAt ? `, arriving around ${formatTime(etaAt)}` : ""}.`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Oern delivery", text });
      } else {
        await navigator.clipboard.writeText(text);
        setNote("Tracking details copied.");
      }
    } catch {
      // Sharing was cancelled or is unavailable; nothing to recover.
    }
  }

  const chipSx = {
    flex: "none",
    height: 48,
    borderRadius: "999px",
    bgcolor: "background.paper",
    "& .MuiChip-label": { py: 0 },
  } as const;

  return (
    <Box sx={{ ...pageGutter, mt: 1.5 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mx: -2,
          px: 2,
          overflowX: "auto",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {actions.map((action) => {
          const label = (
            <Box sx={{ lineHeight: 1.2, textAlign: "left" }}>
              <Typography variant="body2" sx={{ fontWeight: 650 }}>
                {action.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "inherit", opacity: 0.8 }}
              >
                {action.detail}
              </Typography>
            </Box>
          );
          if (action.id === "cod")
            return (
              <Chip
                key={action.id}
                component={Link}
                href={`/track?order=${encodeURIComponent(action.orderId)}`}
                clickable
                icon={<PaymentsOutlined />}
                label={label}
                sx={{ ...chipSx, ...toneSx("warning") }}
              />
            );
          if (action.id === "driver")
            return (
              <Chip
                key={action.id}
                component="a"
                href={`tel:${action.phone}`}
                clickable
                variant="outlined"
                icon={<PhoneOutlined />}
                label={label}
                sx={chipSx}
              />
            );
          return (
            <Chip
              key={action.id}
              clickable
              variant="outlined"
              onClick={() => void share()}
              icon={<IosShare />}
              label={label}
              sx={chipSx}
            />
          );
        })}
      </Stack>
      {note && (
        <Typography
          component="output"
          variant="body2"
          sx={{ color: "text.secondary", display: "block", mt: 1 }}
        >
          {note}
        </Typography>
      )}
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
        mt: 2,
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
          border: 1,
          borderRadius: "16px",
          borderColor: missed ? "error.main" : "divider",
          bgcolor: missed ? "error.light" : "background.paper",
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
          placeholder="Tracking ID"
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
    <Paper variant="outlined" sx={{ mx: 2, mt: 2, borderRadius: "16px" }}>
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
  const nextToday = today.find((item) => item.order.id === next?.id);
  const actions = contextualActions(next).filter((item) => item.id !== "cod");
  const remaining = today.filter((item) => item.state !== "delivered").length;
  const codCount = codDue(orders).length;

  return (
    <>
      <Box component="h1" className="sr-only">
        Home
      </Box>

      <TrackingLookup />

      {isAuthenticated && next && <NextParcelCard order={next} now={now} />}

      <PickupPrompt />

      <QuickActions
        isAuthenticated={isAuthenticated}
        arrivingCount={remaining}
        onSignIn={onSignIn}
        onOpenHelp={onOpenHelp}
      />

      {isAuthenticated && codCount > 0 && (
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

      {next && (
        <ContextChips
          actions={actions}
          order={next}
          etaAt={nextToday?.etaAt ?? next.estimated_delivery_at}
        />
      )}

      {isAuthenticated ? (
        orders.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{ mx: 2, mt: 3, p: 2, borderRadius: "16px" }}
          >
            <Typography variant="h6" component="h2" sx={{ fontWeight: 750 }}>
              No deliveries yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Deliveries linked to this customer account will appear here.
            </Typography>
          </Paper>
        ) : (
          rest.length > 0 && (
            <Box
              component="section"
              id="arriving-today"
              aria-labelledby="arriving-today-title"
              sx={{ px: 2, mt: 3, scrollMarginTop: 72 }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography
                  id="arriving-today-title"
                  variant="h6"
                  component="h2"
                  sx={{ fontWeight: 750 }}
                >
                  Arriving today
                </Typography>
                <Chip
                  size="small"
                  label={remaining > 0 ? `${remaining} to go` : "All done"}
                  sx={toneSx("info")}
                />
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
            </Box>
          )
        )
      ) : (
        <SignedOutPrompt onSignIn={onSignIn} />
      )}
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

export function NotificationsSheet({
  open,
  notifications,
  unreadIds,
  isAuthenticated,
  onSignIn,
  onClose,
}: {
  open: boolean;
  notifications: CustomerNotification[];
  unreadIds: ReadonlySet<string>;
  isAuthenticated: boolean;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const visible =
    filter === "unread"
      ? notifications.filter((item) => unreadIds.has(item.id))
      : notifications;

  function close() {
    setFilter("all");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      titleId="notifications-title"
      title="Notifications"
      dock={
        isAuthenticated && notifications.length > 0 ? (
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={close}
            sx={{ minHeight: 52 }}
          >
            Done
          </Button>
        ) : undefined
      }
    >
      {isAuthenticated && unreadIds.size > 0 && (
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={filter}
          onChange={(_, value: "all" | "unread" | null) => {
            if (value) setFilter(value);
          }}
          aria-label="Filter notifications"
          sx={{ mb: 1, p: 0.5, borderRadius: "999px", bgcolor: "grey.100" }}
        >
          {(["all", "unread"] as const).map((value) => (
            <ToggleButton
              key={value}
              value={value}
              sx={{
                minHeight: 44,
                border: 0,
                borderRadius: "999px !important",
                "&.Mui-selected": { bgcolor: "background.paper", boxShadow: 1 },
              }}
            >
              {value === "all" ? "All" : `Unread · ${unreadIds.size}`}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      {!isAuthenticated ? (
        <Stack spacing={1.5} sx={{ alignItems: "flex-start", py: 1, pb: 2 }}>
          <Typography sx={{ color: "text.secondary" }}>
            Sign in to get updates about your deliveries.
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              close();
              onSignIn();
            }}
          >
            Sign in
          </Button>
        </Stack>
      ) : visible.length === 0 ? (
        <Stack spacing={1} sx={{ alignItems: "center", py: 2, pb: 3 }}>
          <Box
            component="img"
            src="/icons/notifications.svg"
            alt=""
            sx={{
              display: "block",
              width: 96,
              height: 96,
            }}
          />
          <Typography sx={{ color: "text.secondary", textAlign: "center" }}>
            {notifications.length === 0
              ? "You’re all caught up. Delivery updates will appear here."
              : "No unread notifications."}
          </Typography>
        </Stack>
      ) : (
        <List
          disablePadding
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 1,
          }}
        >
          {visible.map((item) => {
            const high = item.priority === "high";
            return (
              <ListItem disablePadding key={item.id}>
                <ListItemButton
                  component={Link}
                  href={`/track?order=${encodeURIComponent(item.orderId)}`}
                  onClick={close}
                  alignItems="flex-start"
                  sx={{
                    gap: 1.5,
                    border: 1,
                    borderRadius: "16px",
                    borderColor: high ? "warning.main" : "divider",
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 0 }}>
                    <Avatar sx={toneSx(high ? "warning" : "neutral")}>
                      {notifyIcon[item.kind]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={item.title}
                    secondary={
                      <>
                        {item.body}
                        <Typography
                          variant="caption"
                          sx={{ display: "block", color: "text.secondary" }}
                        >
                          {formatDateTime(item.at)}
                        </Typography>
                      </>
                    }
                    slotProps={{
                      primary: { sx: { fontWeight: 700 } },
                      secondary: { component: "span", variant: "body2" },
                    }}
                    sx={{ m: 0 }}
                  />
                  {unreadIds.has(item.id) && (
                    <Box
                      role="img"
                      aria-label="Unread"
                      sx={{
                        width: 10,
                        height: 10,
                        mt: 0.75,
                        flex: "none",
                        borderRadius: "50%",
                        bgcolor: "error.main",
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Sheet>
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

export function HelpSheet({
  open,
  order,
  onClose,
}: {
  open: boolean;
  order: DeliveryOrder | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      titleId="help-title"
      title="Report a problem"
    >
      {order && (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
          About parcel <strong>{order.tracking_code}</strong>
        </Typography>
      )}
      <List
        disablePadding
        sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1 }}
      >
        {order?.driver_phone && order.driver_id && (
          <ListItem disablePadding>
            <ListItemButton
              component="a"
              href={`tel:${order.driver_phone}`}
              sx={{
                minHeight: 60,
                gap: 1.5,
                border: 1,
                borderColor: "divider",
                borderRadius: "16px",
              }}
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
        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            href={
              order ? `/track?order=${encodeURIComponent(order.id)}` : "/track"
            }
            onClick={onClose}
            sx={{
              minHeight: 60,
              gap: 1.5,
              border: 1,
              borderColor: "divider",
              borderRadius: "16px",
            }}
          >
            <TrackChangesOutlined />
            <ListItemText
              primary="Check the latest status"
              secondary="Timeline, estimate and rider location"
              slotProps={{ primary: { sx: { fontWeight: 700 } } }}
            />
          </ListItemButton>
        </ListItem>
      </List>
      <Box sx={{ mt: 1.5, borderTop: 1, borderColor: "divider" }}>
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
      <Typography variant="body2" sx={{ color: "text.secondary", mt: 1.75 }}>
        In-app issue reports aren’t available yet. Contact the sender for order
        changes.
      </Typography>
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
          ? "Camera access was blocked. Allow it in your browser settings, or type the tracking number on Home."
          : "This browser can’t scan codes. Type or paste the tracking number on Home instead."}
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

export function TrackLookupNotice({
  code,
  isAuthenticated,
  onSignIn,
}: {
  code: string;
  isAuthenticated: boolean;
  onSignIn: () => void;
}) {
  return (
    <Box sx={{ px: 2, mt: 1.5 }}>
      <Alert
        icon={false}
        severity="info"
        sx={{ borderRadius: "12px", alignItems: "center" }}
        action={
          isAuthenticated ? (
            <Button color="inherit" size="small" component={Link} href="/home">
              Try again
            </Button>
          ) : (
            <Button color="inherit" size="small" onClick={onSignIn}>
              Sign in
            </Button>
          )
        }
      >
        {isAuthenticated
          ? `No delivery found for “${code}”. Check the number and try again.`
          : "Tracking by number needs an account for now. Sign in to track parcels linked to you."}
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
  if (orders.length < 2) return null;
  return (
    <Stack
      direction="row"
      spacing={1}
      component="nav"
      aria-label="Your parcels"
      sx={{
        mt: 1.5,
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
          color={order.id === selectedId ? "secondary" : "default"}
          variant={order.id === selectedId ? "filled" : "outlined"}
          sx={{ flex: "none", height: 40, borderRadius: "999px" }}
        />
      ))}
    </Stack>
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
      <Skeleton
        variant="rounded"
        height={148}
        sx={{ mt: 2, borderRadius: "20px" }}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          mt: 2,
          mb: 3,
        }}
      >
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} variant="rounded" height={104} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={64} sx={{ mb: 1 }} />
      <Skeleton variant="rounded" height={64} />
    </Box>
  );
}
