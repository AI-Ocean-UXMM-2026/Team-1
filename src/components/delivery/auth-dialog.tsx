"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { signInHref } from "@/lib/delivery/return-to";

/**
 * Sends the customer to sign in and brings them back to the screen they were
 * on, so asking for sign-in never costs them their place.
 */
export function AuthDialog({
  open,
  returnTo,
}: {
  open: boolean;
  onClose: () => void;
  /** Where to land after signing in; defaults to the current screen. */
  returnTo?: string;
  audience?: "customer" | "team";
}) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const here = `${window.location.pathname}${window.location.search}`;
    router.push(signInHref(returnTo ?? here));
  }, [open, returnTo, router]);

  return null;
}
