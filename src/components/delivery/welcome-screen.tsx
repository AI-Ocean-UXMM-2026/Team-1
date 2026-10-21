"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";

import { BrandMark } from "@/components/delivery/common";

export function WelcomeScreen() {
  const router = useRouter();

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: 3,
        pt: 8,
        pb: 4,
        background:
          "radial-gradient(120% 90% at 50% 0%, #fff7ed 0%, #f8fafc 60%)",
      }}
    >
      <Stack
        spacing={2.5}
        sx={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box className="welcome-route-art" aria-hidden="true">
          <svg viewBox="0 0 360 180" role="presentation">
            <path
              className="welcome-route-road"
              d="M22 144C78 48 126 156 178 91S268 34 338 54"
            />
            <path
              className="welcome-route-line"
              d="M22 144C78 48 126 156 178 91S268 34 338 54"
            />
            <circle className="welcome-route-pulse" cx="338" cy="54" r="12" />
            <circle
              className="welcome-route-pulse welcome-route-pulse-delay"
              cx="338"
              cy="54"
              r="12"
            />
            <circle className="welcome-route-pickup" cx="22" cy="144" r="10" />
            <circle
              className="welcome-route-destination"
              cx="338"
              cy="54"
              r="10"
            />
            <circle className="welcome-route-rider" cx="178" cy="91" r="7">
              <animateMotion
                dur="5s"
                repeatCount="indefinite"
                path="M-156 53 C-100 -43 -52 65 0 0 S90 -57 160 -37"
              />
            </circle>
          </svg>
        </Box>
        <BrandMark size={200} />
        <Typography
          component="h1"
          sx={{
            fontWeight: 800,
            fontSize: 44,
            lineHeight: 1,
            color: "secondary.main",
          }}
        >
          Oern
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", maxWidth: 300 }}
        >
          Delivery, in full view. Follow your parcel from pickup to your door.
        </Typography>
      </Stack>

      <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => router.push("/home")}
          sx={{ minHeight: 56 }}
        >
          Get started
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="large"
          onClick={() => router.push("/signin")}
          sx={{ minHeight: 56, borderWidth: 1.5 }}
        >
          I already have an account
        </Button>
        {/* One sign-in serves every role; the account's role decides which
            workspace opens, so team members don't need their own links. */}
        <Typography
          variant="caption"
          sx={{ textAlign: "center", color: "text.secondary", pt: 0.5 }}
        >
          Riders and Oern staff: use “I already have an account” with your team
          login.
        </Typography>
      </Stack>
    </Box>
  );
}
