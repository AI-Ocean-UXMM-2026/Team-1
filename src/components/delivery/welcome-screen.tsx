"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";

import { Mascot } from "@/components/delivery/mascot";

export function WelcomeScreen() {
  const router = useRouter();

  return (
    <Box
      sx={{
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
        }}
      >
        <Mascot size={240} />
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
          onClick={() => router.push("/home?signin=1")}
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
          Rider or Oern staff? Sign in with your team account above.
        </Typography>
      </Stack>
    </Box>
  );
}
