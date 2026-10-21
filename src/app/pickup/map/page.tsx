import type { Metadata } from "next";

import { PickupMapPage } from "@/components/delivery/pickup-map";

export const metadata: Metadata = {
  title: "Choose pickup spot — Oern",
  description: "Place the pin where the rider should collect your parcel.",
};

export default function PickupMapRoute() {
  return <PickupMapPage />;
}
