"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { currency } from "@/lib/delivery/format";
import {
  confirmMMQRPayment,
  downloadQRCode,
  generateMMQRQRCode,
  type MMQRQRCode,
} from "@/lib/delivery/mmqr-sdk";

type FlowState = "ready" | "generating" | "qr-display" | "loading" | "confirmed";

interface MMQRPaymentFlowProps {
  /** Amount to charge in MMK */
  amount: number;
  /** Reference code (e.g., tracking/order code) */
  reference: string;
  /** Merchant ID for payment */
  merchantId: string;
  /** Merchant name to display */
  merchantName?: string;
  /** Called when payment is confirmed */
  onConfirmed?: () => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

/**
 * MMQR Payment Flow Component
 * Shows QR code for 2 minutes, then transitions to loading state.
 * User can save QR before timeout or wait for confirmation.
 */
export function MMQRPaymentFlow({
  amount,
  reference,
  merchantId,
  merchantName = "Oern",
  onConfirmed,
  onCancel,
}: MMQRPaymentFlowProps) {
  const [state, setState] = useState<FlowState>("ready");
  const [qrCode, setQrCode] = useState<MMQRQRCode | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Generate QR code when component mounts or amount changes
  useEffect(() => {
    if (state !== "ready") return;

    const generateQR = async () => {
      setState("generating");
      try {
        const qr = await generateMMQRQRCode({
          merchantId,
          amount,
          reference,
          merchantName,
        });
        setQrCode(qr);
        setState("qr-display");
        setTimeRemaining(120);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
        setState("ready");
      }
    };

    generateQR();
  }, [state, merchantId, amount, reference, merchantName]);

  // Countdown timer for QR display
  useEffect(() => {
    if (state !== "qr-display" || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setState("loading");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state, timeRemaining]);

  // Simulate payment confirmation when in loading state
  useEffect(() => {
    if (state !== "loading" || paymentConfirmed) return;

    const confirmPayment = async () => {
      try {
        const confirmed = await confirmMMQRPayment(reference);
        if (confirmed) {
          setPaymentConfirmed(true);
          setState("confirmed");
          onConfirmed?.();
        }
      } catch (error) {
        console.error("Payment confirmation error:", error);
      }
    };

    confirmPayment();
  }, [state, reference, onConfirmed, paymentConfirmed]);

  const handleStartPayment = () => {
    setState("generating");
  };

  const handleSaveQR = () => {
    if (qrCode) {
      downloadQRCode(qrCode);
    }
  };

  const handleCancel = () => {
    setState("ready");
    setQrCode(null);
    setPaymentConfirmed(false);
    setTimeRemaining(120);
    onCancel?.();
  };

  // Ready state: show start button
  if (state === "ready") {
    return (
      <Paper
        sx={{
          p: 3,
          textAlign: "center",
          backgroundColor: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: "12px",
        }}
      >
        <Stack spacing={3}>
          <div>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              Ready to pay {currency.format(amount)}?
            </Typography>
            <Typography variant="body1" sx={{ color: "#64748b" }}>
              Scan the QR code with your bank or wallet app that supports MMQR
            </Typography>
          </div>
          <Button
            variant="contained"
            sx={{
              backgroundColor: "#c2410c",
              color: "#ffffff",
              height: "56px",
              borderRadius: "999px",
              fontSize: "16px",
              fontWeight: 600,
              "&:hover": {
                backgroundColor: "#9a3412",
              },
            }}
            onClick={handleStartPayment}
          >
            {/* state will always be "ready" here, but check for consistency */}
            Start Payment
          </Button>
        </Stack>
      </Paper>
    );
  }

  // Generating state: show loading
  if (state === "generating" || !qrCode) {
    return (
      <Paper
        sx={{
          p: 3,
          textAlign: "center",
          borderRadius: "12px",
        }}
      >
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <CircularProgress size={48} />
          <Typography variant="body1">
            Generating MMQR code for {currency.format(amount)}...
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // QR display state
  if (state === "qr-display") {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    const isLowTime = timeRemaining < 30;

    return (
      <Paper
        sx={{
          p: 3,
          textAlign: "center",
          borderRadius: "12px",
          backgroundColor: "#172b4d",
          color: "#ffffff",
        }}
      >
        <Stack spacing={3}>
          {/* Header */}
          <div>
            <Typography
              variant="body2"
              sx={{ color: "#cbd5e1", fontSize: "14px", mb: 1 }}
            >
              Scan with your bank or wallet app
            </Typography>
            <Typography
              variant="h6"
              sx={{ color: "#ffffff", fontSize: "24px", fontWeight: 700 }}
            >
              {currency.format(amount)}
            </Typography>
          </div>

          {/* QR Code */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              backgroundColor: "#ffffff",
              p: 2,
              borderRadius: "8px",
              aspectRatio: "1",
              maxWidth: "300px",
              mx: "auto",
            }}
          >
            <img
              src={qrCode.dataUrl}
              alt="MMQR Code"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </Box>

          {/* Reference Code */}
          <div>
            <Typography
              variant="caption"
              sx={{ color: "#cbd5e1", fontSize: "12px", mb: 0.5, display: "block" }}
            >
              Reference
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                fontSize: "14px",
                color: "#ffffff",
                wordBreak: "break-all",
              }}
            >
              {qrCode.request.reference}
            </Typography>
          </div>

          {/* Timer */}
          <Box
            sx={{
              backgroundColor: isLowTime ? "#dc2626" : "#2563eb",
              p: 2,
              borderRadius: "8px",
              transition: "background-color 0.3s ease",
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: "#ffffff", fontSize: "14px", mb: 0.5 }}
            >
              {isLowTime ? "Expiring soon" : "Expires in"}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontSize: "32px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {timeDisplay}
            </Typography>
          </Box>

          {/* Actions */}
          <Stack spacing={2}>
            <Button
              variant="contained"
              sx={{
                backgroundColor: "#f97316",
                color: "#ffffff",
                height: "56px",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 600,
                "&:hover": {
                  backgroundColor: "#ea580c",
                },
              }}
              onClick={handleSaveQR}
            >
              Save QR Code
            </Button>
            <Button
              variant="outlined"
              sx={{
                borderColor: "#64748b",
                color: "#cbd5e1",
                height: "56px",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 600,
                backgroundColor: "transparent",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderColor: "#ffffff",
                },
              }}
              onClick={handleCancel}
            >
              Cancel & Go Back
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  // Loading state: waiting for payment confirmation
  if (state === "loading") {
    return (
      <Paper
        sx={{
          p: 3,
          textAlign: "center",
          borderRadius: "12px",
          backgroundColor: "#dbeafe",
          border: "1px solid #bfdbfe",
        }}
      >
        <Stack spacing={3} sx={{ alignItems: "center" }}>
          <CircularProgress size={48} sx={{ color: "#2563eb" }} />
          <div>
            <Typography variant="h6" sx={{ mb: 1, color: "#172b4d", fontWeight: 700 }}>
              Confirming payment...
            </Typography>
            <Typography variant="body1" sx={{ color: "#64748b" }}>
              Please wait while we confirm your {currency.format(amount)} payment
            </Typography>
          </div>
        </Stack>
      </Paper>
    );
  }

  // Confirmed state: payment successful
  if (state === "confirmed") {
    return (
      <Paper
        sx={{
          p: 3,
          textAlign: "center",
          borderRadius: "12px",
          backgroundColor: "#dcfce7",
          border: "1px solid #86efac",
        }}
      >
        <Stack spacing={3} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography sx={{ fontSize: 36 }}>✓</Typography>
          </Box>
          <div>
            <Typography variant="h6" sx={{ mb: 1, color: "#166534", fontWeight: 700 }}>
              Payment confirmed!
            </Typography>
            <Typography variant="body1" sx={{ color: "#166534" }}>
              {currency.format(amount)} has been received
            </Typography>
          </div>
          <Typography
            variant="caption"
            sx={{ color: "#64748b", fontSize: "12px" }}
          >
            Reference: {qrCode.request.reference}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return null;
}
