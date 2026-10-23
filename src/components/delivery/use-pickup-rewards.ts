"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchPointsBalance, validateCoupon } from "@/lib/delivery/actions";
import {
  applyServerRewards,
  normalizeCouponCode,
  type RewardsApplied,
} from "@/lib/delivery/rewards";
import { createClient } from "@/lib/supabase/client";

export type CouponStatus =
  | { state: "none" }
  | { state: "checking" }
  | { state: "valid"; discount: number }
  | { state: "invalid"; reason: string };

export type PickupRewards = {
  signedIn: boolean | null;
  /** The signed-in account, to tell the order's owner from anyone else. */
  userId: string | null;
  balance: number;
  couponStatus: CouponStatus;
  applied: RewardsApplied;
};

/**
 * The customer's points balance and the coupon in the draft, checked against
 * the database for the current fee. A coupon that cannot be checked never
 * counts toward the total.
 */
export function usePickupRewards(
  draft: { couponCode: string; usePoints: boolean },
  fee: number | null,
  enabled: boolean,
): PickupRewards {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    status: CouponStatus;
  } | null>(null);
  const code = normalizeCouponCode(draft.couponCode);
  const key = `${code}:${fee ?? "none"}`;

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const supabase = createClient();
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const id = data.session?.user.id;
        if (!live) return;
        setSignedIn(Boolean(id));
        setUserId(id ?? null);
        if (id) {
          const points = await fetchPointsBalance(supabase, id);
          if (live) setBalance(points);
        }
      })
      .catch(() => live && setBalance(0));
    return () => {
      live = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !code || fee === null || signedIn !== true) return;
    let live = true;
    void validateCoupon(createClient(), code, fee)
      .then((check) => {
        if (!live) return;
        setResult({
          key,
          status: check.couponId
            ? { state: "valid", discount: check.discount }
            : {
                state: "invalid",
                reason: check.reason ?? "This coupon cannot be used.",
              },
        });
      })
      .catch(() => {
        if (live)
          setResult({
            key,
            status: {
              state: "invalid",
              reason: "We could not check this coupon. Try again.",
            },
          });
      });
    return () => {
      live = false;
    };
  }, [enabled, code, fee, key, signedIn]);

  const couponStatus: CouponStatus = !code
    ? { state: "none" }
    : signedIn === false
      ? { state: "invalid", reason: "Sign in to use a coupon." }
      : result?.key === key
        ? result.status
        : { state: "checking" };

  const applied = useMemo(
    () =>
      applyServerRewards(fee ?? 0, {
        couponDiscount:
          couponStatus.state === "valid" ? couponStatus.discount : 0,
        usePoints: draft.usePoints,
        balance,
      }),
    [fee, couponStatus, draft.usePoints, balance],
  );

  return { signedIn, userId, balance, couponStatus, applied };
}
