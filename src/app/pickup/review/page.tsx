import type { Metadata } from "next";

import { PickupRequestPage } from "@/components/delivery/pickup-request";

export const metadata: Metadata = {
  title: "Review pickup — Oern",
  description: "Check your pickup request before you send it.",
};

export default function PickupReviewPage() {
  return <PickupRequestPage step="review" />;
}
