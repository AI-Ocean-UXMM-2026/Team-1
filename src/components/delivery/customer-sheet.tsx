"use client";

import Close from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export type CustomerSheetProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
  dock?: ReactNode;
};

export function CustomerSheet({
  open,
  onClose,
  titleId,
  title,
  children,
  dock,
}: CustomerSheetProps) {
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
            background: (theme) =>
              `linear-gradient(to bottom, ${alpha(theme.palette.background.paper, 0)}, ${theme.palette.background.paper} 28%)`,
          }}
        >
          {dock}
        </Box>
      )}
    </SwipeableDrawer>
  );
}

export { CustomerSheet as Sheet };
