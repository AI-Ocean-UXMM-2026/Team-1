"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import ChevronRight from "@mui/icons-material/ChevronRight";
import HistoryToggleOff from "@mui/icons-material/HistoryToggleOff";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import NotificationsNone from "@mui/icons-material/NotificationsNone";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import SupportAgent from "@mui/icons-material/SupportAgent";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import ListItemButton from "@mui/material/ListItemButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import type { ReactElement } from "react";

import { toneSx } from "@/components/delivery/customer-ui-utils";
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

/**
 * Who is signed in. The block is the one navy surface in the app, so the
 * account reads as identity rather than as another settings row.
 */
function IdentityHero({
  name,
  phone,
  isAuthenticated,
}: {
  name: string | null;
  phone: string | null;
  isAuthenticated: boolean;
}) {
  return (
    <Box
      sx={{
        borderRadius: "20px",
        bgcolor: "secondary.main",
        color: "secondary.contrastText",
        p: 2,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 56,
          height: 56,
          flex: "none",
          borderRadius: "16px",
          bgcolor: "rgba(255, 255, 255, 0.14)",
          display: "grid",
          placeItems: "center",
          fontSize: 20,
          fontWeight: 750,
          lineHeight: 1,
        }}
      >
        {isAuthenticated ? (
          initialsOf(name)
        ) : (
          <PersonOutlined sx={{ fontSize: 28 }} />
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="h6"
          component="p"
          sx={{
            fontWeight: 750,
            fontSize: 20,
            lineHeight: "26px",
            color: "#ffffff",
            overflowWrap: "anywhere",
          }}
        >
          {isAuthenticated ? name || "Customer" : "Guest"}
        </Typography>
        <Typography
          variant="body2"
          component="p"
          sx={{
            mt: 0.25,
            fontSize: 14,
            lineHeight: "20px",
            color: "rgba(255, 255, 255, 0.82)",
            overflowWrap: "anywhere",
          }}
        >
          {isAuthenticated
            ? (phone ?? "No phone number on file")
            : "Sign in to see your deliveries and updates."}
        </Typography>
      </Box>
    </Box>
  );
}

/** One row of the account list: an icon, the row, and where it leads. */
const rowSx = {
  gap: 1.5,
  minHeight: 72,
  px: 1.5,
  py: 1.25,
  alignItems: "center",
  borderRadius: "16px",
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
  "&:hover": { bgcolor: "grey.100" },
};

function AccountRow({
  icon,
  title,
  detail,
  unread,
  ...rest
}: {
  /** A flat glyph; the row carries the meaning, not the artwork. */
  icon: ReactElement;
  title: string;
  detail: string;
  /** Unread notifications, called out beside the title. */
  unread?: number;
} & ({ href: string } | { onClick: () => void })) {
  const content = (
    <>
      <Box
        aria-hidden="true"
        sx={{
          width: 40,
          height: 40,
          flex: "none",
          borderRadius: "12px",
          bgcolor: "grey.100",
          color: "text.secondary",
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: 16,
              lineHeight: "22px",
              fontWeight: 700,
              color: "text.primary",
            }}
          >
            {title}
          </Typography>
          {unread !== undefined && unread > 0 && (
            <Chip
              size="small"
              label={`${unread} unread`}
              sx={{
                ...toneSx("info"),
                height: 22,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: "999px",
                "& .MuiChip-label": { px: 1 },
              }}
            />
          )}
        </Stack>
        <Typography
          component="span"
          sx={{
            display: "block",
            mt: 0.25,
            fontSize: 13,
            lineHeight: "18px",
            color: "text.secondary",
          }}
        >
          {detail}
        </Typography>
      </Box>
      <ChevronRight sx={{ fontSize: 24, color: "#64748B", flex: "none" }} />
    </>
  );
  return "href" in rest ? (
    <ListItemButton component={Link} href={rest.href} sx={rowSx}>
      {content}
    </ListItemButton>
  ) : (
    <ListItemButton onClick={rest.onClick} sx={rowSx}>
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
      <Box sx={{ px: 2, mt: 1 }}>
        <IdentityHero
          name={name}
          phone={phone}
          isAuthenticated={isAuthenticated}
        />
      </Box>

      {!isAuthenticated && (
        <Box sx={{ px: 2, mt: 2 }}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={onSignIn}
            endIcon={<ArrowForward />}
            sx={{ minHeight: 52 }}
          >
            Sign in
          </Button>
          {/* One login serves every role; the account opens the right
              workspace, so staff do not need a separate link. */}
          <Typography
            variant="caption"
            component="p"
            sx={{ display: "block", mt: 1, textAlign: "center" }}
          >
            Riders and Oern staff use this sign-in too. Your account opens the
            right workspace.
          </Typography>
        </Box>
      )}

      <Box
        component="nav"
        aria-label="Account"
        sx={{
          px: 2,
          mt: 2,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 1.5,
        }}
      >
        {isAuthenticated && (
          <AccountRow
            href={ordersHref({ tab: "history" })}
            icon={<HistoryToggleOff sx={{ fontSize: 22 }} />}
            title="Delivery history"
            detail={
              historyCount > 0
                ? `${historyCount} finished ${historyCount === 1 ? "delivery" : "deliveries"}`
                : "Delivered and past parcels"
            }
          />
        )}
        {isAuthenticated ? (
          <AccountRow
            href="/notifications"
            icon={<NotificationsNone sx={{ fontSize: 22 }} />}
            title="Notifications"
            detail="Delivery updates and alerts"
            unread={unreadCount}
          />
        ) : (
          <AccountRow
            href="/track"
            icon={<LocalShippingOutlined sx={{ fontSize: 22 }} />}
            title="Track a parcel"
            detail="Enter a tracking code or scan it."
          />
        )}

        <AccountRow
          onClick={onOpenHelp}
          icon={<SupportAgent sx={{ fontSize: 22 }} />}
          title="Help and support"
          detail="Report a problem with a parcel"
        />
      </Box>

      {isAuthenticated && (
        <Box sx={{ px: 2, mt: 3 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            onClick={onSignOut}
            /* A solid red edge keeps the destructive control's boundary
               readable; the default half-opacity border is too faint. */
            sx={{ minHeight: 48, borderColor: "error.main" }}
          >
            Sign out
          </Button>
        </Box>
      )}
    </Box>
  );
}
