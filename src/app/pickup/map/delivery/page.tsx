import type { Metadata } from "next";

import { PickupMapPage } from "@/components/delivery/pickup-map";

export const metadata: Metadata = {
  title: "Choose delivery spot — Oern",
  description: "Place the pin where the recipient should receive the parcel.",
};

export default function DeliveryMapRoute() {
  return <PickupMapPage target="delivery" />;
}
