"use client";

import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import TrackChangesOutlined from "@mui/icons-material/TrackChangesOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Mascot } from "@/components/delivery/mascot";

const highlights: { icon: ReactNode; text: string }[] = [
  {
    icon: <TrackChangesOutlined fontSize="small" />,
    text: "Follow your parcel live from pickup to your door",
  },
  {
    icon: <LocalShippingOutlined fontSize="small" />,
    text: "See clear handoffs between you, the rider, and the seller",
  },
  {
    icon: <PaymentsOutlined fontSize="small" />,
    text: "Cash on delivery and status updates in one place",
  },
];

export function WelcomeScreen() {
  const router = useRouter();

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        px: 3,
        py: 6,
        background:
          "radial-gradient(120% 120% at 50% 0%, #fff7ed 0%, #f8fafc 55%)",
      }}
    >
      <Stack
        spacing={3}
        sx={{
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
          alignItems: "center",
        }}
      >
        <Mascot size={220} />

        <Stack spacing={1}>
          <Typography
            variant="overline"
            sx={{ color: "primary.main", fontWeight: 700, letterSpacing: 1.2 }}
          >
            Welcome
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Delivery, in full view
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Follow your parcel from rider pickup to arrival, with live location,
            delivery updates, and clear handoffs along the way.
          </Typography>
        </Stack>

        <Stack spacing={1.5} sx={{ width: "100%", textAlign: "left" }}>
          {highlights.map((item) => (
            <Stack
              key={item.text}
              direction="row"
              spacing={1.5}
              sx={{
                alignItems: "center",
                p: 1.5,
                borderRadius: 3,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  bgcolor: "#fff7ed",
                  color: "primary.main",
                  flex: "none",
                }}
              >
                {item.icon}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.text}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Stack spacing={1.5} sx={{ width: "100%" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>
            Get started
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => router.push("/home")}
            sx={{ minHeight: 52 }}
          >
            Get started
          </Button>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            You can look around first — signing in is only needed to see your
            own orders. Operations team?{" "}
            <Link href="/rider" style={{ color: "inherit" }}>
              Rider
            </Link>
            ,{" "}
            <Link href="/manager" style={{ color: "inherit" }}>
              manager
            </Link>
            ,{" "}
            <Link href="/seller" style={{ color: "inherit" }}>
              seller
            </Link>
            , and{" "}
            <Link href="/support" style={{ color: "inherit" }}>
              support
            </Link>{" "}
            all have their own sign-in.
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
