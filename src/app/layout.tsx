import type { Metadata } from "next";
import "./globals.css";
import "./globals-late.css";

export const metadata: Metadata = {
  title: "Oern — Delivery, in full view",
  description:
    "Follow your parcel from rider pickup to arrival with live location, delivery updates, and clear handoffs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
