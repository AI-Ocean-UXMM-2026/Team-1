"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import WarningAmber from "@mui/icons-material/WarningAmber";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { toneSx } from "@/components/delivery/customer-ui-utils";
import type { CustomerNotification } from "@/lib/delivery/customer-home";
import { formatTime } from "@/lib/delivery/format";

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

export function NotificationRow({
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

export type NotificationFilter = "all" | "unread" | "important";

export type NotificationsPageProps = {
  notifications: CustomerNotification[];
  isUnread: (item: CustomerNotification) => boolean;
  isAuthenticated: boolean;
  now: number;
  onOpen: (id: string) => void;
  onSignIn: () => void;
};

/** Full-page notification inbox with unread and category badges. */
export function NotificationsPage({
  notifications,
  isUnread,
  isAuthenticated,
  now,
  onOpen,
  onSignIn,
}: NotificationsPageProps) {
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
