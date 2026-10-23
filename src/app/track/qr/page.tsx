"use client";

import ArrowBack from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PaymentLogo } from "@/components/delivery/payment-logos";
import { currency } from "@/lib/delivery/format";
import {
  downloadQRCode,
  generateMMQRQRCode,
  type MMQRQRCode,
} from "@/lib/delivery/mmqr-sdk";

export default function TrackQrPage() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") ?? "";
  const amount = Number(params.get("amount") ?? 0);
  const [qr, setQr] = useState<MMQRQRCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(15 * 60);
  const [success, setSuccess] = useState(false);
  const [qrLoading, setQrLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await generateMMQRQRCode({
          merchantId: "oern-merchant",
          amount,
          reference: code,
          merchantName: "Oern",
        });
        if (!cancelled) {
          setQr(result);
          // Simulate QR loading time
          setTimeout(() => {
            if (!cancelled) setQrLoading(false);
          }, 2000);
        }
      } catch {
        if (!cancelled) setError("Could not generate the QR code.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount, code]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Wait 2s after QR finishes loading, then redirect and set as confirmed
  useEffect(() => {
    if (!qrLoading && qr) {
      const t = setTimeout(() => {
        setSuccess(true);
        // Redirect back after confirmation
        setTimeout(() => {
          router.back();
        }, 1500);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [qrLoading, qr, router]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  if (success) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
          px: 2,
          py: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 360,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <IconButton onClick={() => router.back()} aria-label="Back">
            <ArrowBack />
          </IconButton>
        </Box>
        <Typography
          variant="h6"
          sx={{ fontWeight: 750, color: "success.dark" }}
        >
          Payment successful
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {currency.format(amount)} received · {code}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        px: 2,
        py: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <IconButton onClick={() => router.back()} aria-label="Back">
          <ArrowBack />
        </IconButton>
      </Box>

      {/* MMQR Icon - centered above title */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: "50%",
          backgroundColor: "#dbeafe",
          color: "#2563eb",
        }}
      >
        <QrCodeScannerOutlined sx={{ fontSize: 36 }} />
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 750 }}>
        Scan to pay {currency.format(amount)}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", textAlign: "center" }}
      >
        Reference: {code}
      </Typography>

      <Typography
        variant="h4"
        sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
      >
        {timeDisplay}
      </Typography>

      {loading && <CircularProgress />}

      {error && (
        <Typography role="alert" color="error">
          {error}
        </Typography>
      )}

      {qr && qrLoading && (
        <Stack
          spacing={2}
          sx={{ alignItems: "center", width: "100%", maxWidth: 360 }}
        >
          <CircularProgress size={64} sx={{ color: "#2563eb" }} />
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", textAlign: "center" }}
          >
            Loading QR code...
          </Typography>
        </Stack>
      )}

      {qr && !qrLoading && (
        <Stack
          spacing={2}
          sx={{ alignItems: "center", width: "100%", maxWidth: 360 }}
        >
          <Box
            sx={{
              backgroundColor: "#ffffff",
              p: 2,
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <Image
              src={qr.dataUrl}
              alt="MMQR code"
              width={280}
              height={280}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </Box>
        </Stack>
      )}

      {qr && !qrLoading && (
        <Button
          variant="contained"
          fullWidth
          onClick={() => downloadQRCode(qr, `mmqr-${code}.png`)}
          sx={{ textTransform: "none", maxWidth: 360 }}
        >
          Save QR
        </Button>
      )}
    </Box>
  );
}
