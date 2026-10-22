"use client";

import ChevronRight from "@mui/icons-material/ChevronRight";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/delivery/customer-pages";
import { etaLabel, StatusChip } from "@/components/delivery/customer-ui-utils";
import {
  type HistoryOutcome,
  type OrdersTab,
  orderMatchesQuery,
  ordersHref,
  parseOrdersQuery,
  splitOrders,
} from "@/lib/delivery/customer-home";
import { currency, formatDateTime } from "@/lib/delivery/format";
import type { DeliveryOrder, StatusEvent } from "@/lib/delivery/types";

const OUTCOMES: { id: HistoryOutcome; label: string }[] = [
  { id: "all", label: "All" },
  { id: "delivered", label: "Delivered" },
  { id: "failed", label: "Not delivered" },
  { id: "cancelled", label: "Cancelled" },
];

/** COD is its own state: never folded into, or hidden by, the delivery status. */
export function codSummary(order: DeliveryOrder) {
  if (order.cod_amount <= 0) return null;
  const amount = currency.format(order.cod_amount);
  const paid =
    order.cod_status === "collected" || order.cod_status === "settled";
  if (paid) return { text: `COD paid · ${amount}`, tone: "ok" as const };
  if (order.status === "delivered")
    return { text: `COD still due · ${amount}`, tone: "warn" as const };
  if (order.status === "failed" || order.status === "cancelled")
    return { text: `COD not collected · ${amount}`, tone: "muted" as const };
  return { text: `COD due on arrival · ${amount}`, tone: "warn" as const };
}

const OrderRow = memo(function OrderRow({
  order,
  when,
  onOpen,
}: {
  order: DeliveryOrder;
  when: string;
  onOpen: () => void;
}) {
  const cod = codSummary(order);
  return (
    <ListItem disablePadding>
      <ListItemButton
        component={Link}
        href={`/track?order=${encodeURIComponent(order.id)}`}
        onClick={onOpen}
        sx={{
          gap: 1.5,
          minHeight: 72,
          px: 1.5,
          borderRadius: "16px",
          bgcolor: "grey.100",
          alignItems: "flex-start",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, overflowWrap: "anywhere" }}
          >
            {order.delivery_address}
          </Typography>
          <Typography
            variant="caption"
            sx={{ display: "block", color: "text.secondary" }}
          >
            {order.tracking_code} · {when}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              flexWrap: "wrap",
              rowGap: 0.5,
              mt: 0.75,
            }}
          >
            <StatusChip status={order.status} />
            {cod && (
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color:
                    cod.tone === "warn"
                      ? "warning.dark"
                      : cod.tone === "ok"
                        ? "success.dark"
                        : "text.secondary",
                }}
              >
                {cod.text}
              </Typography>
            )}
          </Stack>
        </Box>
        <ChevronRight color="disabled" sx={{ alignSelf: "center" }} />
      </ListItemButton>
    </ListItem>
  );
});

function activeWhen(order: DeliveryOrder) {
  if (order.status === "in_transit" || order.status === "picked_up")
    return etaLabel(order.estimated_delivery_at);
  return `Ordered ${formatDateTime(order.created_at)}`;
}

const STATUS_WORD: Record<string, string> = {
  delivered: "Delivered",
  failed: "Not delivered",
  cancelled: "Cancelled",
};

/**
 * Orders: what is still on its way (Active) and everything finished
 * (History). The tab, search and outcome live in the URL, so the view
 * survives opening a delivery and coming back, and can be linked to.
 */
export function OrdersPage({
  orders,
  events,
  isAuthenticated,
  onSignIn,
}: {
  orders: DeliveryOrder[];
  events: StatusEvent[];
  isAuthenticated: boolean;
  onSignIn: () => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const state = parseOrdersQuery(params);
  const here = ordersHref(state);

  const [draft, setDraft] = useState(state.q);
  // Keep the box in step when the URL changes underneath it (back/forward).
  useEffect(() => setDraft(state.q), [state.q]);
  // Write typing to the URL once it pauses, replacing rather than stacking history.
  useEffect(() => {
    if (draft.trim() === state.q.trim()) return;
    const timer = window.setTimeout(
      () =>
        router.replace(ordersHref({ ...state, q: draft }), { scroll: false }),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [draft, state, router]);

  const { active, history } = useMemo(
    () => splitOrders(orders, events),
    [orders, events],
  );
  const visible = useMemo(() => {
    if (state.tab === "history")
      return history
        .filter(
          (item) =>
            (state.outcome === "all" || item.order.status === state.outcome) &&
            orderMatchesQuery(item.order, state.q),
        )
        .map((item) => ({
          order: item.order,
          when: `${STATUS_WORD[item.order.status] ?? "Ended"} ${formatDateTime(item.endedAt)}`,
        }));
    return active
      .filter((order) => orderMatchesQuery(order, state.q))
      .map((order) => ({ order, when: activeWhen(order) }));
  }, [state.tab, state.outcome, state.q, active, history]);

  // Remember where the list was when a delivery is opened, and return there.
  const scrollKey = `oern.orders.scroll:${here}`;
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || orders.length === 0) return;
    restored.current = true;
    try {
      const saved = Number(window.sessionStorage.getItem(scrollKey));
      if (saved > 0) window.scrollTo(0, saved);
    } catch {
      // Scroll position is a nicety.
    }
  }, [scrollKey, orders.length]);
  const rememberScroll = () => {
    try {
      window.sessionStorage.setItem(scrollKey, String(window.scrollY));
    } catch {
      // Ignored.
    }
  };

  const go = (next: Partial<{ tab: OrdersTab; outcome: HistoryOutcome }>) =>
    router.replace(ordersHref({ ...state, q: draft, ...next }), {
      scroll: false,
    });

  if (!isAuthenticated || orders.length === 0)
    return (
      <EmptyState
        illustration="/icons/track-parcel.svg"
        title={
          isAuthenticated ? "No deliveries yet" : "Sign in to see your orders"
        }
        body={
          isAuthenticated
            ? "Request a pickup, or track a parcel sent to you."
            : "Or track any parcel with its code, no account needed."
        }
        action={
          isAuthenticated ? (
            <Stack direction="row" spacing={1}>
              <Button component={Link} href="/pickup" variant="contained">
                Request pickup
              </Button>
              <Button component={Link} href="/track" variant="outlined">
                Track a parcel
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1}>
              <Button variant="contained" color="secondary" onClick={onSignIn}>
                Sign in
              </Button>
              <Button component={Link} href="/track" variant="outlined">
                Track by code
              </Button>
            </Stack>
          )
        }
      />
    );

  return (
    <Box sx={{ pb: 2 }}>
      <Tabs
        value={state.tab}
        onChange={(_event, value: OrdersTab) => go({ tab: value })}
        variant="fullWidth"
        aria-label="Orders"
        sx={{ px: 2, minHeight: 48, "& .MuiTab-root": { minHeight: 48 } }}
      >
        <Tab
          value="active"
          label={`Active · ${active.length}`}
          id="orders-tab-active"
          aria-controls="orders-panel"
        />
        <Tab
          value="history"
          label={`History · ${history.length}`}
          id="orders-tab-history"
          aria-controls="orders-panel"
        />
      </Tabs>

      <Box sx={{ px: 2, mt: 1.5 }}>
        <OutlinedInput
          fullWidth
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            state.tab === "history"
              ? "Search history by code or address"
              : "Search by code or address"
          }
          inputProps={{
            "aria-label":
              state.tab === "history"
                ? "Search history"
                : "Search active deliveries",
            enterKeyHint: "search",
          }}
          startAdornment={
            <InputAdornment position="start">
              <SearchRounded />
            </InputAdornment>
          }
        />
      </Box>

      {state.tab === "history" && history.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          role="group"
          aria-label="Filter history by outcome"
          sx={{
            px: 2,
            mt: 1.5,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {OUTCOMES.map((item) => {
            const selected = state.outcome === item.id;
            return (
              <Chip
                key={item.id}
                clickable
                aria-pressed={selected}
                onClick={() => go({ outcome: item.id })}
                label={item.label}
                sx={{
                  flex: "none",
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
      )}

      <Box
        role="tabpanel"
        id="orders-panel"
        aria-labelledby={`orders-tab-${state.tab}`}
        sx={{ mt: 2 }}
      >
        {visible.length === 0 ? (
          <EmptyState
            illustration="/icons/arriving-today.svg"
            title={
              state.q.trim()
                ? "No deliveries match that search"
                : state.tab === "history"
                  ? "No finished deliveries yet"
                  : "No active deliveries"
            }
            body={
              state.q.trim()
                ? "Check the tracking code or try part of the address."
                : state.tab === "history"
                  ? "Delivered, undelivered and cancelled parcels are kept here."
                  : "Parcels on their way to you appear here."
            }
            action={
              state.q.trim() ? (
                <Button variant="outlined" onClick={() => setDraft("")}>
                  Clear search
                </Button>
              ) : state.tab === "active" ? (
                <Button component={Link} href="/pickup" variant="contained">
                  Request pickup
                </Button>
              ) : undefined
            }
          />
        ) : (
          <List
            disablePadding
            aria-label={
              state.tab === "history" ? "Delivery history" : "Active deliveries"
            }
            sx={{
              px: 2,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 1,
            }}
          >
            {visible.map(({ order, when }) => (
              <OrderRow
                key={order.id}
                order={order}
                when={when}
                onOpen={rememberScroll}
              />
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
