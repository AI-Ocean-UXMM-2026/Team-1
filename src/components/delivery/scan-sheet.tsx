"use client";

import QrCodeScannerOutlined from "@mui/icons-material/QrCodeScannerOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { CustomerSheet as Sheet } from "@/components/delivery/customer-sheet";
import { usePermissionRecovery } from "@/lib/delivery/use-permission-recovery";

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

/** Pulls a tracking number out of a scanned QR code or barcode. */
export function codeFromScan(raw: string) {
  const value = raw.trim();
  try {
    const url = new URL(value);
    return (
      url.searchParams.get("code") ??
      url.pathname.split("/").filter(Boolean).at(-1) ??
      value
    );
  } catch {
    return value;
  }
}

export function ScanView({
  onDetected,
}: {
  onDetected: (code: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const handleDetected = useEffectEvent(onDetected);
  const [status, setStatus] = useState<
    "starting" | "scanning" | "blocked" | "not_found" | "in_use" | "unsupported"
  >("starting");
  const [retryCount, setRetryCount] = useState(0);

  usePermissionRecovery({
    permission: "camera",
    enabled: status === "blocked",
    onGranted: () => setRetryCount((prev) => prev + 1),
  });

  useEffect(() => {
    void retryCount;
    setStatus("starting");
    const Detector = (
      window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    let stream: MediaStream | null = null;
    let timer = 0;
    let cancelled = false;
    let finished = false;
    const detector = new Detector({
      formats: ["qr_code", "code_128", "code_39", "ean_13", "data_matrix"],
    });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (media) => {
        if (cancelled) {
          for (const track of media.getTracks()) track.stop();
          return;
        }
        stream = media;
        const element = video.current;
        if (!element) return;
        element.srcObject = media;
        await element.play();
        setStatus("scanning");
        timer = window.setInterval(async () => {
          try {
            const found = await detector.detect(element);
            const value = found[0]?.rawValue;
            if (value && !finished) {
              finished = true;
              handleDetected(codeFromScan(value));
            }
          } catch {
            // A frame can fail to decode; the next one usually works.
          }
        }, 350);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const err = error as { name?: string };
        if (
          err?.name === "NotAllowedError" ||
          err?.name === "PermissionDeniedError"
        ) {
          setStatus("blocked");
        } else if (
          err?.name === "NotFoundError" ||
          err?.name === "DevicesNotFoundError"
        ) {
          setStatus("not_found");
        } else if (
          err?.name === "NotReadableError" ||
          err?.name === "TrackStartError"
        ) {
          setStatus("in_use");
        } else {
          setStatus("blocked");
        }
      });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, [retryCount]);

  if (status === "unsupported" || status === "not_found")
    return (
      <Alert severity="info" icon={false} sx={{ borderRadius: "12px", mb: 2 }}>
        {status === "not_found"
          ? "No camera was found on this device. Type or paste the tracking code instead."
          : "This browser can’t scan codes. Type or paste the tracking code instead."}
      </Alert>
    );

  if (status === "in_use" || status === "blocked")
    return (
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <Alert
          severity="warning"
          sx={{ borderRadius: "12px" }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshOutlined />}
              onClick={() => setRetryCount((c) => c + 1)}
            >
              Try again
            </Button>
          }
        >
          {status === "in_use"
            ? "Camera is in use by another app."
            : "Camera access was blocked."}
        </Alert>
        <Box sx={{ px: 1 }}>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block" }}
          >
            {status === "in_use"
              ? "Close other apps using the camera, then tap Try again."
              : "Allow camera access in your browser settings, then tap Try again:"}
          </Typography>
          {status === "blocked" && (
            <Box
              component="ul"
              sx={{
                m: 0,
                pl: 2.5,
                mt: 0.5,
                typography: "caption",
                color: "text.secondary",
              }}
            >
              <li>
                <strong>Safari (iPhone):</strong> Tap the <em>aA</em> icon in
                the address bar → Website Settings → Camera → Allow.
              </li>
              <li>
                <strong>Chrome / Android:</strong> Tap the lock or tune icon in
                the address bar → Permissions → Camera → Allow.
              </li>
            </Box>
          )}
        </Box>
      </Stack>
    );

  return (
    <Box sx={{ pb: "calc(20px + env(safe-area-inset-bottom))" }}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "20px",
          bgcolor: "secondary.main",
          aspectRatio: "4 / 3",
        }}
      >
        <video
          ref={video}
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: "18% 14%",
            border: "3px solid #fff",
            borderRadius: "16px",
            boxShadow: "0 0 0 999px rgb(23 43 77 / 0.35)",
          }}
        />
      </Box>
      <Typography
        variant="body2"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{ mt: 1.5, textAlign: "center", color: "text.secondary" }}
      >
        {status === "starting"
          ? "Starting camera…"
          : "Point the camera at the parcel’s QR code or barcode."}
      </Typography>
    </Box>
  );
}

export type ScanSheetProps = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
};

export function ScanSheet({ open, onClose, onDetected }: ScanSheetProps) {
  // The camera stays off until the person asks for it.
  const [cameraOn, setCameraOn] = useState(false);

  function close() {
    setCameraOn(false);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} titleId="scan-title" title="Scan parcel">
      {cameraOn ? (
        <ScanView onDetected={onDetected} />
      ) : (
        <Stack
          spacing={1.5}
          sx={{ pb: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          <Typography sx={{ color: "text.secondary" }}>
            Your camera is off. Turn it on only when you want to scan a parcel’s
            QR code or barcode.
          </Typography>
          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<QrCodeScannerOutlined />}
            onClick={() => setCameraOn(true)}
            sx={{ minHeight: 52 }}
          >
            Turn on camera to scan
          </Button>
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            onClick={close}
            sx={{ minHeight: 48 }}
          >
            Type the number instead
          </Button>
        </Stack>
      )}
    </Sheet>
  );
}
