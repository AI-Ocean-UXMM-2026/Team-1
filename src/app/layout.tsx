import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./loader.css";
import "./globals-late.css";
import "./form-fields.css";
import "./audit-fixes.css";
import "./auth-screen.css";
import "./manager-polish.css";
import "./manager-track-polish.css";
import "./manager-aws.css";
import "./track-polish.css";
import { MuiProvider } from "@/components/delivery/mui-provider";

// Self-hosted so essential text never depends on a remote font or on the
// device having Burmese glyph coverage.
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});
const notoSansMyanmar = localFont({
  src: [
    {
      path: "./fonts/noto-sans-myanmar-myanmar-400-normal.woff2",
      weight: "400",
    },
    {
      path: "./fonts/noto-sans-myanmar-myanmar-600-normal.woff2",
      weight: "600",
    },
    {
      path: "./fonts/noto-sans-myanmar-myanmar-700-normal.woff2",
      weight: "700",
    },
  ],
  variable: "--font-myanmar",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Oern — Delivery, in full view",
  description:
    "Follow your parcel from rider pickup to arrival with live location, delivery updates, and clear handoffs.",
  icons: { icon: "/brand/oern-logo.png", apple: "/brand/oern-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#F8FAFC",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSansMyanmar.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MuiProvider>{children}</MuiProvider>
      </body>
    </html>
  );
}
