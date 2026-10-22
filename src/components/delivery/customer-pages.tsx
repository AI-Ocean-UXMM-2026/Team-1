"use client";

import { Home, HomeFill } from "@material-symbols-svg/react/rounded/icons/home";
import {
  Person,
  PersonFill,
} from "@material-symbols-svg/react/rounded/icons/person";
import {
  ReceiptLong,
  ReceiptLongFill,
} from "@material-symbols-svg/react/rounded/icons/receipt-long";
import ArrowForward from "@mui/icons-material/ArrowForward";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ChevronRight from "@mui/icons-material/ChevronRight";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import IosShare from "@mui/icons-material/IosShare";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import SearchRounded from "@mui/icons-material/SearchRounded";
import WarningAmber from "@mui/icons-material/WarningAmber";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { memo, type ReactNode, useState } from "react";

import { StatusChip, toneSx } from "@/components/delivery/customer-home";
import { etaLabel } from "@/components/delivery/customer-ui-utils";
import { LocationMap } from "@/components/delivery/location-map";
import { progressPercent } from "@/lib/delivery/customer-home";
import {
  currency,
  formatDateTime,
  relativeUpdatedAt,
  timeUntil,
} from "@/lib/delivery/format";
import { hasCollectedParcel } from "@/lib/delivery/location-state";
import type { DeliveryOrder, StatusEvent } from "@/lib/delivery/types";
import { STATUS_LABELS, STATUS_STEPS } from "@/lib/delivery/types";

/* ------------------------------------------------------------- bottom nav */

const navItems = [
  {
    id: "home",
    label: "Home",
    href: "/home",
    icon: Home,
    activeIcon: HomeFill,
  },
  {
    id: "orders",
    label: "Orders",
    href: "/orders",
    icon: ReceiptLong,
    activeIcon: ReceiptLongFill,
  },
  {
    id: "pickup",
    label: "Pickup",
    href: "/pickup",
    icon: Inventory2Outlined,
    activeIcon: Inventory2Outlined,
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    icon: Person,
    activeIcon: PersonFill,
  },
] as const;

/**
 * Material 3 navigation bar: 80dp tall, filled icon inside a pill-shaped
 * active indicator for the current destination, outlined icons otherwise.
 */
export const CustomerBottomNav = memo(function CustomerBottomNav({
  activeId,
}: {
  activeId: string;
}) {
  return (
    <BottomNavigation
      showLabels
      value={activeId}
      component="nav"
      aria-label="Customer app"
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        marginInline: "auto",
        maxWidth: "var(--customer-canvas, 480px)",
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        height: "calc(80px + env(safe-area-inset-bottom))",
        pb: "env(safe-area-inset-bottom)",
        bgcolor: "background.paper",
        borderTop: 1,
        borderColor: "divider",
        "& .MuiBottomNavigationAction-root": {
          minWidth: 0,
          maxWidth: "none",
          gap: 0.5,
          pt: 1.5,
          pb: 2,
          color: "text.secondary",
        },
        "& .MuiBottomNavigationAction-label": {
          fontSize: 12,
          fontWeight: 600,
          "&.Mui-selected": { fontSize: 12, fontWeight: 700 },
        },
        "& .Mui-selected": { color: "text.primary" },
      }}
    >
      {navItems.map((item) => {
        const active = activeId === item.id;
        const NavIcon = active ? item.activeIcon : item.icon;
        return (
          <BottomNavigationAction
            key={item.id}
            component={Link}
            href={item.href}
            value={item.id}
            label={item.label}
            aria-current={active ? "page" : undefined}
            icon={
              <Box
                component="span"
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 64,
                  height: 32,
                  borderRadius: "999px",
                  bgcolor: (theme) =>
                    active
                      ? alpha(theme.palette.primary.main, 0.12)
                      : "transparent",
                  color: active ? "primary.dark" : "inherit",
                  transition: "background-color 150ms ease",
                }}
              >
                <NavIcon size={24} />
              </Box>
            }
          />
        );
      })}
    </BottomNavigation>
  );
});

/* ----------------------------------------------------------------- shared */

/** Quiet grouped surface used for secondary content on every customer page. */
function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="section" aria-label={title} sx={{ mx: 2, mt: 2 }}>
      {(title || action) && (
        <Stack
          direction="row"
          sx={{ alignItems: "center", minHeight: 40, mb: 0.5 }}
        >
          {title && (
            <Typography
              variant="subtitle1"
              component="h2"
              sx={{ fontWeight: 750, flex: 1 }}
            >
              {title}
            </Typography>
          )}
          {action}
        </Stack>
      )}
      <Box sx={{ borderRadius: "16px", bgcolor: "grey.100", p: 1.5 }}>
        {children}
      </Box>
    </Box>
  );
}

export function EmptyState({
  illustration,
  title,
  body,
  action,
}: {
  illustration: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      spacing={1}
      sx={{ alignItems: "center", textAlign: "center", px: 3, py: 5 }}
    >
      <Box
        component="img"
        src={illustration}
        alt=""
        sx={{ display: "block", width: 88, height: 88 }}
      />
      <Typography variant="h6" component="h2" sx={{ fontWeight: 750 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {body}
      </Typography>
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}

/* ------------------------------------------------------------------ track */

function etaHeadline(order: DeliveryOrder) {
  if (order.status === "delivered") return "Delivered";
  if (order.status === "failed") return "Delivery issue";
  if (order.status === "cancelled") return "Delivery cancelled";
  if (!hasCollectedParcel(order.status)) return "Waiting for pickup";
  const until = timeUntil(order.estimated_delivery_at);
  return until === "Arriving now" || until === "Running late"
    ? until
    : `Arriving in ${until}`;
}

function etaDetail(order: DeliveryOrder, deliveredAt: string | null) {
  if (order.status === "delivered")
    return deliveredAt
      ? `Delivered ${formatDateTime(deliveredAt)}`
      : "Delivery confirmed";
  if (order.status === "failed" || order.status === "cancelled")
    return "See the delivery progress below.";
  return order.estimated_delivery_at
    ? `Estimated around ${formatDateTime(order.estimated_delivery_at)}`
    : "An arrival estimate appears after pickup.";
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
    <Button
      fullWidth
      variant="outlined"
      color="secondary"
      startIcon={copied ? <CheckRounded /> : <IosShare />}
      onClick={() => void share()}
      sx={{ minHeight: 48 }}
    >
      {copied ? "Link copied" : "Share tracking"}
    </Button>
  );
}

export function TrackDetail({
  order,
  events,
  isDemo,
  now,
  locationHeading,
  locationDescription,
  onOpenHelp,
}: {
  order: DeliveryOrder;
  events: StatusEvent[];
  isDemo: boolean;
  now: number;
  locationHeading: string;
  locationDescription: string;
  onOpenHelp: () => void;
}) {
  const orderEvents = events.filter((event) => event.order_id === order.id);
  const deliveredAt =
    orderEvents
      .filter((event) => event.status === "delivered")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      ?.created_at ?? null;
  const activeIndex = STATUS_STEPS.indexOf(
    order.status as (typeof STATUS_STEPS)[number],
  );
  const closed = ["delivered", "failed", "cancelled"].includes(order.status);
  // A stopped delivery keeps the steps it reached and explains why it ended.
  const stopped = order.status === "failed" || order.status === "cancelled";
  const stopEvent =
    orderEvents
      .filter((event) => event.status === order.status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  const codPaid =
    order.cod_status === "collected" || order.cod_status === "settled";

  return (
    <Box component="section" aria-label="Selected delivery" sx={{ pb: 3 }}>
      <Box
        sx={{
          mx: 2,
          mt: 2,
          p: 2,
          borderRadius: "20px",
          bgcolor: "secondary.main",
          color: "secondary.contrastText",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Typography
            variant="caption"
            sx={{ opacity: 0.8, fontWeight: 650, minWidth: 0 }}
            noWrap
          >
            {order.tracking_code}
          </Typography>
          {!closed && <StatusChip status={order.status} />}
        </Stack>
        <Typography
          variant="h5"
          component="p"
          sx={{ mt: 1.25, fontWeight: 750 }}
        >
          {etaHeadline(order)}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.86 }}>
          {etaDetail(order, deliveredAt)}
          {isDemo ? " · sample" : ""}
        </Typography>
        {!closed && order.traffic_delay_minutes > 0 && (
          <Chip
            size="small"
            icon={<WarningAmber />}
            label={`Traffic adds about ${order.traffic_delay_minutes} min`}
            sx={{ ...toneSx("warning"), mt: 1.25 }}
          />
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
          sx={{ justifyContent: "space-between", mt: 0.75, opacity: 0.75 }}
        >
          <Typography variant="caption">Collected</Typography>
          <Typography variant="caption">At your door</Typography>
        </Stack>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 1.5,
            pt: 1.5,
            borderTop: "1px solid rgb(255 255 255 / 0.16)",
            opacity: 0.8,
          }}
        >
          {relativeUpdatedAt(
            order.latest_location?.recorded_at ?? order.eta_updated_at,
            now,
          )}
        </Typography>
      </Box>

      <Box
        sx={{
          mx: 2,
          mt: 1.5,
          borderRadius: "20px",
          overflow: "hidden",
          bgcolor: "grey.100",
        }}
      >
        <LocationMap order={order} mode="customer" isDemo={isDemo} tall />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {locationHeading}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {locationDescription}
          </Typography>
        </Box>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mx: 2, mt: 1.5 }}>
        {!closed && !isDemo && <ShareTrackingButton order={order} />}
        <Button
          fullWidth
          variant={
            order.status === "failed" || order.status === "cancelled"
              ? "contained"
              : "outlined"
          }
          color="secondary"
          startIcon={<HelpOutlineRounded />}
          onClick={onOpenHelp}
          sx={{ minHeight: 48 }}
        >
          Get help
        </Button>
      </Stack>

      <Panel title="Route">
        <Stack spacing={1.5}>
          {[
            {
              label: "From",
              value: order.pickup_address,
              icon: <Inventory2Outlined fontSize="small" />,
            },
            {
              label: "To",
              value: order.delivery_address,
              icon: <LocationOnOutlined fontSize="small" />,
            },
          ].map((row) => (
            <Stack
              key={row.label}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "flex-start" }}
            >
              <Avatar
                sx={{
                  ...toneSx("neutral"),
                  bgcolor: "background.paper",
                  width: 32,
                  height: 32,
                }}
              >
                {row.icon}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", display: "block" }}
                >
                  {row.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 650 }}>
                  {row.value}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Panel>

      <Panel title="Progress">
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none" }}>
          {STATUS_STEPS.map((step, index) => {
            const event = orderEvents.find((item) => item.status === step);
            const done = stopped
              ? !!event
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
                      bgcolor: done ? "secondary.main" : "background.paper",
                      color: "secondary.contrastText",
                      border: done ? 0 : 2,
                      borderColor: "grey.300",
                    }}
                  >
                    {done && <CheckRounded sx={{ fontSize: 16 }} />}
                  </Box>
                  {!last && (
                    <Box
                      sx={{
                        width: 2,
                        flex: 1,
                        minHeight: 16,
                        bgcolor: done ? "secondary.main" : "grey.300",
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
          {stopped && (
            <Box
              component="li"
              aria-current="step"
              sx={{ display: "flex", gap: 1.5, pt: 1.5 }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "error.main",
                  color: "error.contrastText",
                  fontWeight: 800,
                  fontSize: 14,
                }}
                aria-hidden="true"
              >
                !
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 750, lineHeight: "24px" }}
                >
                  {STATUS_LABELS[order.status]}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", display: "block" }}
                >
                  {stopEvent
                    ? formatDateTime(stopEvent.created_at)
                    : "Latest status"}
                </Typography>
                {stopEvent?.note && (
                  <Typography variant="body2" sx={{ mt: 0.25 }}>
                    {stopEvent.note}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Panel>

      <Panel title="Rider">
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Avatar
            sx={{
              ...toneSx("neutral"),
              bgcolor: "background.paper",
              width: 40,
              height: 40,
            }}
          >
            <PersonOutlined />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {order.driver_name ?? "Finding your rider"}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {order.vehicle_label ??
                (order.driver_name
                  ? "On a delivery route"
                  : "Assigned before pickup")}
            </Typography>
          </Box>
          {order.driver_phone && !closed && (
            <IconButton
              component="a"
              href={`tel:${order.driver_phone}`}
              aria-label="Call your rider"
              sx={{
                width: 44,
                height: 44,
                bgcolor: "background.paper",
                color: "secondary.main",
              }}
            >
              <PhoneOutlined />
            </IconButton>
          )}
        </Stack>
      </Panel>

      {order.cod_amount > 0 && (
        <Panel title="Payment">
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Avatar
              sx={{
                ...toneSx(codPaid ? "success" : "warning"),
                width: 40,
                height: 40,
              }}
            >
              <PaymentsOutlined />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Cash on delivery
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 750 }}>
                {currency.format(order.cod_amount)}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={codPaid ? "Paid" : "Due on arrival"}
              sx={toneSx(codPaid ? "success" : "warning")}
            />
          </Stack>
        </Panel>
      )}
    </Box>
  );
}
