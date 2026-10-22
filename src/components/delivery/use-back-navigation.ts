"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const KEY = "oern.customer.in-app";

/**
 * Back that stays inside Oern. History back is only used when an earlier
 * screen of this session was an Oern screen; a deep link, a shared URL or a
 * sign-in redirect goes to the screen's own parent instead of leaving the app.
 */
export function useBackNavigation(fallback: string) {
  const router = useRouter();
  const cameFromApp = useRef(false);

  useEffect(() => {
    try {
      cameFromApp.current = window.sessionStorage.getItem(KEY) === "1";
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      cameFromApp.current = false;
    }
  }, []);

  return useCallback(() => {
    if (cameFromApp.current && window.history.length > 1) router.back();
    else router.push(fallback);
  }, [router, fallback]);
}
