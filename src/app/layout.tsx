import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./globals-late.css";
import "./form-fields.css";
import "./audit-fixes.css";
import { MuiProvider } from "@/components/delivery/mui-provider";

export const metadata: Metadata = {
  title: "Oern — Delivery, in full view",
  description:
    "Follow your parcel from rider pickup to arrival with live location, delivery updates, and clear handoffs.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <MuiProvider>{children}</MuiProvider>
      </body>
    </html>
  );
}
