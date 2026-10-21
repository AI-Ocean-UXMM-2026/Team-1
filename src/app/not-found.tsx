import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/delivery/common";

export const metadata: Metadata = {
  title: "Page Not Found — Oern",
  description: "The page you are looking for could not be found.",
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-800">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center flex flex-col items-center">
        <Link href="/" aria-label="Oern home" className="mb-3">
          <BrandMark size={56} />
        </Link>
        <h1 className="text-5xl font-black text-slate-900 mb-2 tracking-tight">
          404
        </h1>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Page not found
        </h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          The page you are looking for doesn&apos;t exist, has been removed, or
          is temporarily unavailable.
        </p>
        <Link
          href="/welcome"
          className="w-full inline-flex items-center justify-center px-4 py-3 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 active:bg-orange-800 transition shadow-xs"
        >
          Back to Welcome
        </Link>
      </div>
    </main>
  );
}
