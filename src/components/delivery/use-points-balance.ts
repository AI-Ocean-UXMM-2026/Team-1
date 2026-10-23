"use client";

import { useEffect, useState } from "react";

import { fetchPointsBalance } from "@/lib/delivery/actions";
import { createClient } from "@/lib/supabase/client";

/** The signed-in customer's points, or null until known or when signed out. */
export function usePointsBalance(enabled = true) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const supabase = createClient();
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const userId = data.session?.user.id;
        if (!userId) return;
        const points = await fetchPointsBalance(supabase, userId);
        if (live) setBalance(points);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [enabled]);

  return balance;
}
