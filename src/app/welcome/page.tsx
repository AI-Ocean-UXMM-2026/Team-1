import type { Metadata } from "next";

import { WelcomeScreen } from "@/components/delivery/welcome-screen";

export const metadata: Metadata = {
  title: "Welcome — Oern",
  description:
    "Follow your parcel from rider pickup to arrival with live location, delivery updates, and clear handoffs.",
};

export default function WelcomePage() {
  return <WelcomeScreen />;
}
