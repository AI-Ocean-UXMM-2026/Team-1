"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import WarningAmber from "@mui/icons-material/WarningAmber";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import type { ReactNode } from "react";

import type { CustomerNotification } from "@/lib/delivery/customer-home";
import { relativeAgo } from "@/lib/delivery/format";

const notifyIcon: Record<CustomerNotification["kind"], ReactNode> = {
  missed: <WarningAmber />,
  cod_due: <PaymentsOutlined />,
  delivered: <CheckCircleOutlined />,
  assigned: <PersonOutlined />,
  arriving: <LocalShippingOutlined />,
  out_for_delivery: <LocalShippingOutlined />,
  collected: <LocalShippingOutlined />,
};

/** One compact line-and-a-half update that opens its parcel. */
export function NotificationRow({
  item,
  unread,
  now,
  onOpen,
}: {
  item: CustomerNotification;
  unread: boolean;
  now: number;
  onOpen: (id: string) => void;
}) {
  const attention = item.priority === "high";
  return (
    <ListItem disablePadding>
      <ListItemButton
        component={Link}
        href={`/track?order=${encodeURIComponent(item.orderId)}`}
        onClick={() => onOpen(item.id)}
        alignItems="flex-start"
        sx={{ gap: 1.5, px: 2, py: 1.5, minHeight: 64 }}
      >
        <Badge
          variant="dot"
          color="error"
          invisible={!unread}
          overlap="circular"
          sx={{
            flex: "none",
            mt: 0.25,
            color: attention ? "warning.dark" : "text.secondary",
          }}
        >
          {notifyIcon[item.kind]}
        </Badge>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: unread ? 750 : 600, flex: 1, minWidth: 0 }}
            >
              {item.title}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", flex: "none" }}
            >
              {relativeAgo(item.at, now)}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
          >
            {item.body}
          </Typography>
          {unread && <span className="visually-hidden">Unread</span>}
        </Box>
      </ListItemButton>
    </ListItem>
  );
}

export type NotificationsPageProps = {
  notifications: CustomerNotification[];
  isUnread: (item: CustomerNotification) => boolean;
  isAuthenticated: boolean;
  now: number;
  onOpen: (id: string) => void;
  onSignIn: () => void;
};

/** Notifications as a single timeline, newest first, with unread dots. */
export function NotificationsPage({
  notifications,
  isUnread,
  isAuthenticated,
  now,
  onOpen,
  onSignIn,
}: NotificationsPageProps) {
  if (!isAuthenticated)
    return (
      <Stack
        spacing={1.5}
        sx={{ alignItems: "center", px: 2, py: 6, textAlign: "center" }}
      >
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
          sx={{ minHeight: 48 }}
        >
          Sign in
        </Button>
      </Stack>
    );

  if (notifications.length === 0)
    return (
      <Stack
        spacing={1}
        sx={{ alignItems: "center", px: 3, py: 6, textAlign: "center" }}
      >
        <Typography variant="h6" component="h2" sx={{ fontWeight: 750 }}>
          You’re all caught up
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Delivery updates will appear here.
        </Typography>
      </Stack>
    );

  return (
    <List
      disablePadding
      aria-label="Notifications"
      sx={{
        pb: 3,
        "& > li + li": { borderTop: 1, borderColor: "divider" },
      }}
    >
      {notifications.map((item) => (
        <NotificationRow
          key={item.id}
          item={item}
          unread={isUnread(item)}
          now={now}
          onOpen={onOpen}
        />
      ))}
    </List>
  );
}
