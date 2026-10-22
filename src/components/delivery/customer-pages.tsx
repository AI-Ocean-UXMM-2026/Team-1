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
import CheckRounded from "@mui/icons-material/CheckRounded";
import ExpandMore from "@mui/icons-material/ExpandMore";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import IosShare from "@mui/icons-material/IosShare";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import TwoWheelerOutlined from "@mui/icons-material/TwoWheelerOutlined";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Avatar from "@mui/material/Avatar";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { memo, type ReactNode, useState } from "react";

import { StatusChip, toneSx } from "@/components/delivery/customer-home";
import { LocationMap } from "@/components/delivery/location-map";
import {
  currency,
  formatDateTime,
  relativeUpdatedAt,
} from "@/lib/delivery/format";
import { describeTracking } from "@/lib/delivery/track-state";
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
function _Panel({
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

const noticeTone = {
  info: { bg: "info.light", fg: "info.dark" },
  warning: { bg: "warning.light", fg: "warning.dark" },
  error: { bg: "error.light", fg: "error.dark" },
  success: { bg: "success.light", fg: "success.dark" },
  neutral: { bg: "grey.100", fg: "text.primary" },
} as const;

/** One collapsible section: a labelled heading that opens its details. */
function Section({
  id,
  title,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={(_event, next) => onToggle(next)}
      slotProps={{ heading: { component: "h2" } }}
      sx={{
        bgcolor: "grey.100",
        borderRadius: "16px !important",
        "&::before": { display: "none" },
        "& + &": { mt: 1 },
      }}
    >
      <AccordionSummary
        id={`${id}-header`}
        aria-controls={`${id}-panel`}
        expandIcon={<ExpandMore />}
        sx={{ minHeight: 56, px: 2 }}
      >
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails id={`${id}-panel`} sx={{ px: 2, pt: 0, pb: 2 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

function AddressRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      <Avatar
        sx={{
          ...toneSx("neutral"),
          bgcolor: "background.paper",
          width: 32,
          height: 32,
        }}
      >
        {icon}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", display: "block" }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 650, overflowWrap: "anywhere" }}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

const journey = [
  { label: "Placed", icon: Inventory2Outlined },
  { label: "Rider", icon: PersonOutlined },
  { label: "On the way", icon: TwoWheelerOutlined },
  { label: "Delivered", icon: HomeOutlined },
] as const;

/** Where the parcel is on the four-step journey (0 = just placed). */
export function journeyIndex(status: DeliveryOrder["status"]) {
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

/**
 * Four icon nodes on one rail, so the customer sees the whole journey and
 * their place in it at a glance. Navy is done, blue is where the parcel is.
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
        gridTemplateColumns: `repeat(${journey.length}, 1fr)`,
        m: 0,
        mt: 2,
        p: 0,
        listStyle: "none",
      }}
    >
      {journey.map((step, index) => {
        const done = index < current || finished;
        const here = index === current && !finished;
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
              gap: 0.75,
            }}
          >
            {index > 0 && (
              <Box
                aria-hidden="true"
                sx={{
                  position: "absolute",
                  top: 17,
                  right: "50%",
                  width: "100%",
                  height: 3,
                  borderRadius: "999px",
                  bgcolor:
                    index <= current || finished
                      ? "secondary.main"
                      : "grey.200",
                }}
              />
            )}
            <Box
              sx={{
                position: "relative",
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: done
                  ? "secondary.main"
                  : here
                    ? "info.main"
                    : "grey.100",
                color: done || here ? "common.white" : "text.disabled",
                boxShadow: here
                  ? (theme) =>
                      `0 0 0 4px ${alpha(theme.palette.info.main, 0.18)}`
                  : "none",
              }}
            >
              {done ? (
                <CheckRounded sx={{ fontSize: 20 }} />
              ) : (
                <StepIcon sx={{ fontSize: 20 }} />
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontWeight: here ? 750 : 600,
                color: done || here ? "text.primary" : "text.secondary",
                textAlign: "center",
                lineHeight: 1.2,
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
  onOpenHelp,
}: {
  order: DeliveryOrder;
  events: StatusEvent[];
  isDemo: boolean;
  now: number;
  onOpenHelp: () => void;
}) {
  const view = describeTracking(order, events, now);
  const orderEvents = events.filter((event) => event.order_id === order.id);
  const activeIndex = STATUS_STEPS.indexOf(
    order.status as (typeof STATUS_STEPS)[number],
  );
  const closed = view.stage === "delivered" || view.stage === "stopped";
  const stopped = view.stage === "stopped";
  const stopEvent =
    orderEvents
      .filter((event) => event.status === order.status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  const codPaid =
    order.cod_status === "collected" || order.cod_status === "settled";
  // Open what this state needs: why it stopped, or cash that is still owed.
  const [expanded, setExpanded] = useState({
    route: false,
    progress: stopped,
    parcel: order.cod_amount > 0 && !codPaid && view.stage === "delivered",
  });
  const toggle = (key: keyof typeof expanded) => (next: boolean) =>
    setExpanded((current) => ({ ...current, [key]: next }));

  const tone = noticeTone[view.location.tone];
  const callable = Boolean(order.driver_phone) && !closed;

  const map = (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: "grey.100",
      }}
    >
      <LocationMap order={order} mode="customer" isDemo={isDemo} tall />
    </Box>
  );

  // Before pickup there is no rider to plot, so the map would be an empty
  // tile. Show the two ends of the trip instead; the map arrives at pickup.
  const routePreview = (
    <Box sx={{ px: 2, pb: 1 }}>
      <Box
        sx={{
          p: 2,
          borderRadius: "16px",
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack direction="row" spacing={1.5}>
          <Stack sx={{ alignItems: "center", pt: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: 3,
                borderColor: "secondary.main",
              }}
            />
            <Box
              sx={{
                flex: 1,
                my: 0.5,
                borderLeft: 2,
                borderStyle: "dashed",
                borderColor: "grey.300",
              }}
            />
            <LocationOnOutlined
              sx={{ fontSize: 18, color: "primary.dark", ml: "-3px" }}
            />
          </Stack>
          <Stack spacing={2} sx={{ minWidth: 0, flex: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
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
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Drop-off
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 650, overflowWrap: "anywhere" }}
              >
                {order.delivery_address}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );

  const summary = (
    <Box
      sx={{
        position: "relative",
        mt: view.stage === "on_the_way" ? "-20px" : 0,
        px: 2,
        pt: 2,
        pb: 2,
        borderRadius: view.stage === "on_the_way" ? "20px 20px 0 0" : 0,
        bgcolor: "background.paper",
        boxShadow:
          view.stage === "on_the_way"
            ? "0 -6px 18px rgb(23 43 77 / 10%)"
            : "none",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 650, minWidth: 0 }}
          noWrap
        >
          {order.tracking_code}
          {isDemo ? " · sample" : ""}
        </Typography>
        {!closed && <StatusChip status={order.status} />}
      </Stack>
      <Typography
        variant="h5"
        component="p"
        sx={{
          mt: 0.75,
          fontWeight: 750,
          color: view.delayed ? "warning.dark" : "text.primary",
        }}
      >
        {view.headline}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
        {view.detail}
      </Typography>
      {view.stage !== "preparing" && (
        <Typography
          variant="body2"
          sx={{ mt: 1, fontWeight: 650, overflowWrap: "anywhere" }}
        >
          To {order.delivery_address}
        </Typography>
      )}

      {!stopped && <JourneyRail status={order.status} />}

      {/* Real progress only; nothing is drawn without a route percentage. */}
      {!closed && order.route_progress_percent != null && (
        <LinearProgress
          variant="determinate"
          value={order.route_progress_percent}
          aria-label="Route progress"
          sx={{ mt: 1.5, height: 6, borderRadius: "999px" }}
        />
      )}

      <Box
        role="status"
        sx={{
          mt: 1.5,
          px: 1.5,
          py: 1.25,
          borderRadius: "12px",
          bgcolor: tone.bg,
          color: tone.fg,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {view.location.title}
        </Typography>
        <Typography variant="body2">{view.location.body}</Typography>
        {view.stage === "on_the_way" && view.location.kind !== "none" && (
          <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
            {relativeUpdatedAt(
              order.latest_location?.recorded_at ?? order.eta_updated_at,
              now,
            )}
          </Typography>
        )}
      </Box>

      {order.cod_amount > 0 && (
        <Box
          sx={{
            mt: 1.5,
            p: 1.5,
            borderRadius: "12px",
            bgcolor: codPaid ? "success.light" : "warning.light",
            border: 1,
            borderColor: codPaid ? "success.main" : "warning.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            <Avatar
              sx={{
                ...toneSx(codPaid ? "success" : "warning"),
                width: 36,
                height: 36,
              }}
            >
              <PaymentsOutlined sx={{ fontSize: 20 }} />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  color: codPaid ? "success.dark" : "warning.dark",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontSize: 11,
                  display: "block",
                }}
              >
                Cash on Delivery
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  color: codPaid ? "success.dark" : "warning.dark",
                  lineHeight: 1.2,
                }}
              >
                {currency.format(order.cod_amount)}
              </Typography>
            </Box>
          </Stack>
          <Chip
            size="small"
            label={
              codPaid
                ? "Paid"
                : view.stage === "delivered"
                  ? "Still due"
                  : "Due on arrival"
            }
            sx={{
              ...toneSx(codPaid ? "success" : "warning"),
              fontWeight: 700,
              fontSize: 12,
            }}
          />
        </Box>
      )}

      {(!closed || order.driver_name) && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: "center",
            mt: 2,
            p: 1.5,
            borderRadius: "16px",
            bgcolor: "grey.100",
          }}
        >
          <Avatar
            sx={{
              ...toneSx("neutral"),
              bgcolor: "background.paper",
              width: 44,
              height: 44,
            }}
          >
            <PersonOutlined />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {order.driver_name ? "Your rider" : "Rider"}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
              {order.driver_name ?? "Finding your rider"}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block" }}
              noWrap
            >
              {order.vehicle_label ??
                (order.driver_name
                  ? "On a delivery route"
                  : "We’ll show them here once matched")}
            </Typography>
          </Box>
          {callable && (
            <IconButton
              component="a"
              href={`tel:${order.driver_phone}`}
              aria-label="Call rider"
              sx={{
                width: 48,
                height: 48,
                bgcolor: "background.paper",
                color: "secondary.main",
                border: 1,
                borderColor: "divider",
              }}
            >
              <PhoneOutlined />
            </IconButton>
          )}
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        {!closed && !isDemo && <ShareTrackingButton order={order} />}
        <Button
          fullWidth
          variant="contained"
          color="secondary"
          startIcon={<HelpOutlineRounded />}
          onClick={onOpenHelp}
          sx={{ minHeight: 48 }}
        >
          Get help
        </Button>
      </Stack>
    </Box>
  );

  return (
    <Box component="section" aria-label="Selected delivery" sx={{ pb: 3 }}>
      {view.stage === "on_the_way" ? (
        <>
          {map}
          {summary}
        </>
      ) : view.stage === "preparing" ? (
        <>
          {summary}
          {routePreview}
        </>
      ) : (
        <>
          {summary}
          {map}
        </>
      )}

      <Box sx={{ px: 2, mt: 2 }}>
        {view.stage !== "preparing" && (
          <Section
            id="track-route"
            title="Route and addresses"
            expanded={expanded.route}
            onToggle={toggle("route")}
          >
            <Stack spacing={1.5}>
              <AddressRow
                label="From"
                value={order.pickup_address}
                icon={<Inventory2Outlined fontSize="small" />}
              />
              <AddressRow
                label="To"
                value={order.delivery_address}
                icon={<LocationOnOutlined fontSize="small" />}
              />
            </Stack>
          </Section>
        )}

        <Section
          id="track-progress"
          title="Progress"
          expanded={expanded.progress}
          onToggle={toggle("progress")}
        >
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
        </Section>

        <Section
          id="track-parcel"
          title="Parcel and payment"
          expanded={expanded.parcel}
          onToggle={toggle("parcel")}
        >
          <Stack spacing={1.5}>
            <Box>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", display: "block" }}
              >
                Parcel
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 650, overflowWrap: "anywhere" }}
              >
                {order.parcel_description || "No description"}
                {order.parcel_weight_kg
                  ? ` · ${order.parcel_weight_kg} kg`
                  : ""}
              </Typography>
            </Box>
            {order.cod_amount > 0 ? (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
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
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    COD
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 750 }}>
                    {currency.format(order.cod_amount)}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={
                    codPaid
                      ? "Paid"
                      : view.stage === "delivered"
                        ? "Still due"
                        : "Due on arrival"
                  }
                  sx={toneSx(codPaid ? "success" : "warning")}
                />
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No cash on delivery.
              </Typography>
            )}
          </Stack>
        </Section>
      </Box>
    </Box>
  );
}
