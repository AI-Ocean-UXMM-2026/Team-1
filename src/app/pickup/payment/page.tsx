import type { Metadata } from "next";

import { PickupRequestPage } from "@/components/delivery/pickup-request";

export const metadata: Metadata = {
  title: "Pickup payment — Oern",
  description: "See the delivery fee and choose who pays and how.",
};

export default function PickupPaymentPage() {
  return <PickupRequestPage step="payment" />;
}
