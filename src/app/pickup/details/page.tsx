import type { Metadata } from "next";

import { PickupRequestPage } from "@/components/delivery/pickup-request";

export const metadata: Metadata = {
  title: "Parcel and time — Oern",
  description:
    "Describe the parcel and choose when the rider should collect it.",
};

export default function PickupDetailsPage() {
  return <PickupRequestPage step="details" />;
}
