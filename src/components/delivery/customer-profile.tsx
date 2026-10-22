"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { ordersHref } from "@/lib/delivery/customer-home";

/** First letters of the first two words; code points, so Myanmar names work too. */
export function initialsOf(name: string | null | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
    .join("");
}

function AccountRow({
  illustration,
  title,
  detail,
  badge,
  ...rest
}: {
  /** One of the app's own illustrations in `/public/icons`. */
  illustration: string;
  title: string;
  detail?: string;
  badge?: number;
} & ({ href: string } | { onClick: () => void })) {
  const content = (
    <>
      <Badge badgeContent={badge} color="error" max={9} overlap="circular">
        <Box
          component="img"
          src={illustration}
          alt=""
          sx={{ display: "block", width: 48, height: 48 }}
        />
      </Badge>
      <ListItemText
        primary={title}
        secondary={detail}
        slotProps={{ primary: { sx: { fontWeight: 700, fontSize: 15 } } }}
        sx={{ m: 0 }}
      />
      <ChevronRight color="disabled" />
    </>
  );
  const sx = { gap: 1.5, minHeight: 72, px: 2 } as const;
  return "href" in rest ? (
    <ListItemButton component={Link} href={rest.href} sx={sx}>
      {content}
    </ListItemButton>
  ) : (
    <ListItemButton onClick={rest.onClick} sx={sx}>
      {content}
    </ListItemButton>
  );
}

/** Account: who is signed in and the three places that belong to the account. */
export function ProfilePage({
  name,
  phone,
  isAuthenticated,
  unreadCount,
  historyCount,
  onSignIn,
  onSignOut,
  onOpenHelp,
}: {
  name: string | null;
  phone: string | null;
  isAuthenticated: boolean;
  unreadCount: number;
  historyCount: number;
  onSignIn: () => void;
  /** Asks to sign out; the screen owns the confirmation. */
  onSignOut: () => void;
  onOpenHelp: () => void;
}) {
  return (
    <Box sx={{ pb: 3 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", px: 2, py: 2 }}
      >
        <Avatar
          aria-hidden="true"
          sx={{
            width: 56,
            height: 56,
            bgcolor: "secondary.main",
            color: "secondary.contrastText",
            fontWeight: 750,
          }}
        >
          {isAuthenticated ? initialsOf(name) : "?"}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h6"
            component="p"
            sx={{ fontWeight: 750, overflowWrap: "anywhere" }}
          >
            {isAuthenticated ? name || "Customer" : "Not signed in"}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
          >
            {isAuthenticated
              ? (phone ?? "No phone number on file")
              : "Sign in to see your deliveries and updates."}
          </Typography>
        </Box>
      </Stack>

      {!isAuthenticated && (
        <Box sx={{ px: 2, mb: 2 }}>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            onClick={onSignIn}
            endIcon={<ArrowForward />}
            sx={{ minHeight: 52 }}
          >
            Sign in
          </Button>
        </Box>
      )}

      <Divider />
      <Box component="nav" aria-label="Account">
        <List
          disablePadding
          sx={{ "& > li + li": { borderTop: 1, borderColor: "divider" } }}
        >
          {isAuthenticated && (
            <ListItem disablePadding>
              <AccountRow
                href={ordersHref({ tab: "history" })}
                illustration="/icons/arriving-today.svg"
                title="Delivery history"
                detail={
                  historyCount > 0
                    ? `${historyCount} finished ${historyCount === 1 ? "delivery" : "deliveries"}`
                    : "Delivered and past parcels"
                }
              />
            </ListItem>
          )}
          {isAuthenticated && (
            <ListItem disablePadding>
              <AccountRow
                href="/notifications"
                illustration="/icons/notifications.svg"
                title="Notifications"
                detail={
                  unreadCount > 0
                    ? `${unreadCount} unread`
                    : "Delivery updates and alerts"
                }
                badge={unreadCount}
              />
            </ListItem>
          )}

          <ListItem disablePadding>
            <AccountRow
              onClick={onOpenHelp}
              illustration="/icons/get-help.svg"
              title="Help and support"
              detail="Report a problem with a parcel"
            />
          </ListItem>
        </List>
      </Box>
      <Divider />

      {isAuthenticated && (
        <Box sx={{ display: "flex", justifyContent: "center", px: 2, mt: 3 }}>
          <Button
            variant="outlined"
            color="error"
            onClick={onSignOut}
            sx={{ minHeight: 48, minWidth: 200 }}
          >
            Sign out
          </Button>
        </Box>
      )}
    </Box>
  );
}
