"use client";

import StarsOutlined from "@mui/icons-material/StarsOutlined";
import Chip from "@mui/material/Chip";
import Link from "next/link";

import { usePointsBalance } from "@/components/delivery/use-points-balance";

/** The points balance on Home, opening the Rewards page. Hidden when unknown. */
export function PointsChip({ enabled }: { enabled: boolean }) {
  const balance = usePointsBalance(enabled);
  if (balance === null) return null;
  return (
    <Chip
      component={Link}
      href="/profile/rewards"
      clickable
      icon={<StarsOutlined />}
      label={`${balance.toLocaleString("en-US")} points`}
      aria-label={`${balance.toLocaleString("en-US")} points. Open coupons and points`}
      sx={{ minHeight: 48, borderRadius: 999, fontWeight: 700 }}
    />
  );
}
