"use client";

import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Close from "@mui/icons-material/Close";
import ContentPasteOutlined from "@mui/icons-material/ContentPasteOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import Search from "@mui/icons-material/Search";
import TrackChangesOutlined from "@mui/icons-material/TrackChangesOutlined";
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
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";

import {
  buildTodayItems,
  normaliseCode,
  ordersHref,
  readRecentCodes,
  splitOrders,
  type TodayItem,
} from "@/lib/delivery/customer-home";
import { currency } from "@/lib/delivery/format";
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
        sx={{ minHeight: 56, px: 2, gap: 1, alignItems: "center" }}
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
            variant="h6"
            component="h1"
            noWrap
            sx={{ fontWeight: 750, lineHeight: "26px", fontSize: 20 }}
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
const _PickupHero = memo(function PickupHero() {
  return (
    <Card
      elevation={0}
      sx={{
        mx: 2,
        mt: 1,
        borderRadius: "24px",
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
        border: 1,
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
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
const _PickupRow = memo(function PickupRow() {
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

/** Quick actions at the top of Home: the three things a customer does most. */
const QUICK_ACTIONS = [
  { label: "Request pickup", icon: "/icons/pickup.svg", href: "/pickup" },
  { label: "Track parcel", icon: "/icons/track-parcel.svg", href: "/track" },
  { label: "Help & support", icon: "/icons/get-help.svg", href: null },
] as const;

const QuickActions = memo(function QuickActions({
  onOpenHelp,
}: {
  onOpenHelp: () => void;
}) {
  return (
    <Box
      component="nav"
      aria-label="Quick actions"
      sx={{
        px: 2,
        mt: 1.5,
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 1.25,
      }}
    >
      {QUICK_ACTIONS.map((action) => (
        <ListItemButton
          key={action.label}
          {...(action.href
            ? { component: Link, href: action.href }
            : { onClick: onOpenHelp })}
          sx={{
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            textAlign: "center",
            px: 1,
            py: 2,
            borderRadius: "16px",
            border: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            gap: 1,
            minHeight: 112,
            "&:active": { bgcolor: "grey.100" },
          }}
        >
          <Box
            component="img"
            src={action.icon}
            alt=""
            sx={{
              display: "block",
              width: 40,
              height: 40,
              flex: "none",
            }}
          />
          <Typography
            component="span"
            sx={{
              fontWeight: 600,
              fontSize: 15,
              lineHeight: 1.25,
              color: "text.primary",
              overflowWrap: "anywhere",
            }}
          >
            {action.label}
          </Typography>
        </ListItemButton>
      ))}
    </Box>
  );
});

const _MoreShortcuts = memo(function MoreShortcuts({
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

function TodayRow({ item }: { item: TodayItem }) {
  const missed = item.state === "missed";
  const hasCodDue =
    item.order.cod_amount > 0 &&
    item.order.cod_status === "pending" &&
    item.state !== "delivered" &&
    item.state !== "missed";
  return (
    <ListItem disablePadding>
      <ListItemButton
        component={Link}
        href={`/track?order=${encodeURIComponent(item.order.id)}`}
        sx={{
          display: "grid",
          gap: 0.5,
          minHeight: 64,
          px: 2,
          py: 1.5,
          borderRadius: "16px",
          border: missed ? 1 : 0,
          borderColor: "error.main",
          bgcolor: missed ? "error.light" : "grey.100",
        }}
      >
        <ListItemText
          sx={{ m: 0, minWidth: 0 }}
          primary={item.order.tracking_code}
          secondary={item.order.delivery_address}
          slotProps={{
            primary: {
              noWrap: true,
              sx: { fontWeight: 700, fontSize: 14, letterSpacing: "0.01em" },
            },
            secondary: { noWrap: true, sx: { fontSize: 12 } },
          }}
        />
        {hasCodDue && (
          <Chip
            size="small"
            icon={<PaymentsOutlined sx={{ fontSize: 14 }} />}
            label={`COD ${currency.format(item.order.cod_amount)}`}
            sx={{
              ...toneSx("warning"),
              justifySelf: "start",
              height: 28,
              fontWeight: 700,
              fontSize: 11,
              "& .MuiChip-icon": { color: "inherit", fontSize: 14 },
            }}
          />
        )}
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
  onOpenCod: _onOpenCod,
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
  const { active: activeOrders, history: historyOrders } = splitOrders(
    orders,
    statusEvents,
  );
  const today = buildTodayItems(activeOrders, statusEvents, now);
  const activeCount = activeOrders.length;

  // Keep booking secondary while any delivery is still active, even if its
  // scheduled day is later than today.
  const _hasLive = isAuthenticated && activeCount > 0;

  return (
    <>
      <QuickActions onOpenHelp={onOpenHelp} />

      {isAuthenticated && historyOrders.length > 0 && (
        <Box sx={{ px: 2, mt: 2 }}>
          <ListItemButton
            component={Link}
            href={ordersHref({ tab: "history" })}
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
              src="/icons/delivery-history.svg"
              alt=""
              sx={{ display: "block", width: 48, height: 48, flex: "none" }}
            />
            <ListItemText
              primary="Delivery history"
              secondary={`${historyOrders.length} finished ${historyOrders.length === 1 ? "delivery" : "deliveries"}`}
              slotProps={{
                primary: { sx: { fontWeight: 700, fontSize: 14 } },
              }}
              sx={{ m: 0 }}
            />
            <ChevronRight color="disabled" />
          </ListItemButton>
        </Box>
      )}

      <Box
        component="section"
        id="active-deliveries"
        aria-labelledby="active-deliveries-title"
        sx={{ mt: 2.5, scrollMarginTop: 72 }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            minHeight: 40,
            width: "100%",
          }}
        >
          <Typography
            id="active-deliveries-title"
            variant="h6"
            component="h2"
            sx={{ fontWeight: 750 }}
          >
            Today&apos;s deliveries
          </Typography>
          {isAuthenticated && orders.length > 0 && (
            <Button
              component={Link}
              href="/orders"
              color="secondary"
              endIcon={<ArrowForward />}
              sx={{ minHeight: 40, fontWeight: 700, p: 0 }}
            >
              See all
            </Button>
          )}
        </Box>

        {!isAuthenticated ? (
          <SignedOutPrompt onSignIn={onSignIn} />
        ) : today.length > 0 ? (
          <List
            disablePadding
            aria-label="Today's deliveries"
            sx={{
              px: 2,
              mt: 1,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 1,
            }}
          >
            {today.map((item) => (
              <TodayRow key={item.order.id} item={item} />
            ))}
          </List>
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
                primary="No deliveries today"
                secondary={
                  activeCount > 0
                    ? "Your upcoming deliveries are available in Orders."
                    : "Parcels due today will appear here. Have a code? Track it."
                }
                slotProps={{
                  primary: { sx: { fontWeight: 700, fontSize: 14 } },
                }}
              />
              <ChevronRight color="disabled" />
            </ListItemButton>
          </Box>
        )}
      </Box>
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
    <Box
      aria-busy="true"
      aria-label="Loading your deliveries"
      role="status"
      sx={pageGutter}
    >
      <Skeleton
        variant="rounded"
        height={188}
        sx={{ mt: 1, borderRadius: "20px" }}
      />
      <Skeleton variant="rounded" height={64} sx={{ mt: 3, mb: 1 }} />
      <Skeleton variant="rounded" height={64} />
      <Skeleton variant="rounded" height={64} sx={{ mt: 1 }} />
    </Box>
  );
}
