import type { Metadata } from "next";

import { PickupRequestPage } from "@/components/delivery/pickup-request";

export const metadata: Metadata = {
  title: "Request a pickup — Oern",
  description:
    "Create a delivery order from your pickup location to a destination.",
};

export default function PickupPage() {
  return <PickupRequestPage />;
}
