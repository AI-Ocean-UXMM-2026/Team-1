"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { currency } from "@/lib/delivery/format";
import {
  downloadQRCode,
  generateMMQRQRCode,
  type MMQRQRCode,
} from "@/lib/delivery/mmqr-sdk";

export default function TrackQrPage() {
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  const amount = Number(params.get("amount") ?? 0);
  const [qr, setQr] = useState<MMQRQRCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (!cancelled) setQr(result);
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
      <Typography variant="h6" sx={{ fontWeight: 750 }}>
        Scan to pay {currency.format(amount)}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", textAlign: "center" }}
      >
        Reference: {code}
      </Typography>

      {loading && <CircularProgress />}

      {error && (
        <Typography role="alert" color="error">
          {error}
        </Typography>
      )}

      {qr && (
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

      {qr && (
        <Button
          size="small"
          variant="text"
          onClick={() => downloadQRCode(qr, `mmqr-${code}.png`)}
          sx={{ textTransform: "none", mt: "auto" }}
        >
          Save QR
        </Button>
      )}
    </Box>
  );
}
