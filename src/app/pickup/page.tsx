import type { Metadata } from "next";

import { PickupRequestPage } from "@/components/delivery/pickup-request";

export const metadata: Metadata = {
  title: "Request a pickup — Oern",
  description:
    "Share your pickup location, a photo of the parcel, and when you're free so a rider can collect it.",
};

export default function PickupPage() {
  return <PickupRequestPage />;
}
