"use client";

import { useRouter } from "next/navigation";

/** History back when there is somewhere to go, otherwise a sensible parent. */
export function useBackNavigation(fallback: string) {
  const router = useRouter();
  return () => {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  };
}
