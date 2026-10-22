"use client";

import Chip from "@mui/material/Chip";
import { timeUntil } from "@/lib/delivery/format";
import type { DeliveryStatus } from "@/lib/delivery/types";
import { STATUS_LABELS } from "@/lib/delivery/types";

export type Tone = "error" | "warning" | "info" | "success" | "neutral";

export function toneSx(tone: Tone) {
  return tone === "neutral"
    ? {
        bgcolor: "background.paper",
        color: "text.secondary",
        border: "1px solid",
        borderColor: "divider",
      }
    : { bgcolor: `${tone}.light`, color: `${tone}.dark` };
}

export const statusTone: Record<DeliveryStatus, Tone> = {
  pending: "neutral",
  assigned: "warning",
  accepted: "warning",
  picked_up: "info",
  in_transit: "info",
  delivered: "success",
  failed: "error",
  cancelled: "error",
};

export function StatusChip({ status }: { status: DeliveryStatus }) {
  return (
    <Chip
      size="small"
      label={STATUS_LABELS[status]}
      sx={{ ...toneSx(statusTone[status]), height: 28 }}
    />
  );
}

/** "ETA 12 min", or plain "Running late" once the estimate has passed. */
export function etaLabel(estimate: string | null) {
  const until = timeUntil(estimate);
  return until === "Running late" ? until : `ETA ${until}`;
}
