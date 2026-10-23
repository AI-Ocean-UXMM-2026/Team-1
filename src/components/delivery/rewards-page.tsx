"use client";

import ConfirmationNumberOutlined from "@mui/icons-material/ConfirmationNumberOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CustomerHeader } from "@/components/delivery/customer-home";
import { CustomerBottomNav } from "@/components/delivery/customer-pages";
import { Loader } from "@/components/delivery/loader";
import { useBackNavigation } from "@/components/delivery/use-back-navigation";
import { usePickupDraft } from "@/components/delivery/use-pickup-draft";
import {
  fetchAvailableCoupons,
  fetchLoyaltyLedger,
  fetchPointsBalance,
} from "@/lib/delivery/actions";
import { currency } from "@/lib/delivery/format";
import { signInHref } from "@/lib/delivery/return-to";
import {
  couponHeadline,
  type LedgerTab,
  ledgerForTab,
  ledgerLabel,
  REWARD_RULES,
} from "@/lib/delivery/rewards";
import { createClient } from "@/lib/supabase/client";

type LedgerRow = Awaited<ReturnType<typeof fetchLoyaltyLedger>>[number];
type CouponRow = Awaited<ReturnType<typeof fetchAvailableCoupons>>[number];

type Data = {
  balance: number;
  ledger: LedgerRow[];
  coupons: CouponRow[];
};

const day = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function CouponCard({
  coupon,
  onUse,
}: {
  coupon: CouponRow;
  onUse: (code: string) => void;
}) {
  const notes = [
    coupon.min_fee > 0
      ? `Fee of ${currency.format(coupon.min_fee)} or more`
      : null,
    coupon.ends_at ? `Expires ${day.format(new Date(coupon.ends_at))}` : null,
  ].filter(Boolean);
  return (
    <Box
      component="li"
      sx={{
        listStyle: "none",
        display: "flex",
        gap: 1.5,
        alignItems: "center",
        p: 2,
        borderRadius: "16px",
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 40,
          height: 40,
          flex: "none",
          display: "grid",
          placeItems: "center",
          borderRadius: "12px",
          bgcolor: "grey.100",
          color: "text.secondary",
        }}
      >
        <ConfirmationNumberOutlined />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>
          {couponHeadline({
            kind: coupon.kind as "percent" | "fixed" | "free_delivery",
            value: coupon.value,
            maxDiscount: coupon.max_discount,
          })}
        </Typography>
        <Chip
          label={coupon.code}
          size="small"
          sx={{ mt: 0.5, fontWeight: 700, letterSpacing: "0.04em" }}
        />
        {notes.length > 0 && (
          <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
            {notes.join(" · ")}
          </Typography>
        )}
      </Box>
      <Button
        variant="outlined"
        color="secondary"
        onClick={() => onUse(coupon.code)}
        aria-label={`Use ${coupon.code} at checkout`}
        sx={{ minHeight: 48, flex: "none" }}
      >
        Use
      </Button>
    </Box>
  );
}

/** Points balance, coupons and points history for a signed-in customer. */
export function RewardsPage() {
  const router = useRouter();
  const goBack = useBackNavigation("/profile");
  const { update } = usePickupDraft();
  const [state, setState] = useState<
    "loading" | "signed-out" | "error" | "ready"
  >("loading");
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<LedgerTab>("all");
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt re-runs the load
  useEffect(() => {
    let live = true;
    setState("loading");
    const supabase = createClient();
    void supabase.auth
      .getSession()
      .then(async ({ data: session }) => {
        const userId = session.session?.user.id;
        if (!userId) return live && setState("signed-out");
        const [balance, ledger, coupons] = await Promise.all([
          fetchPointsBalance(supabase, userId),
          fetchLoyaltyLedger(supabase, userId),
          fetchAvailableCoupons(supabase),
        ]);
        if (!live) return;
        setData({ balance, ledger, coupons });
        setState("ready");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [attempt]);

  const rows = data ? ledgerForTab(data.ledger, tab) : [];

  return (
    <main className="customer-app">
      <CustomerHeader
        title="Coupons and points"
        isAuthenticated={state === "ready"}
        unreadCount={0}
        showBell={false}
        onBack={goBack}
      />
      <Box
        sx={{
          px: 2,
          pt: 1,
          pb: "calc(var(--customer-nav-height, 80px) + 24px)",
        }}
      >
        {state === "loading" && <Loader />}
        {state === "signed-out" && (
          <Stack spacing={1.5}>
            <Typography>Sign in to see your points and coupons.</Typography>
            <Button
              component={Link}
              href={signInHref("/profile/rewards")}
              variant="contained"
              size="large"
            >
              Sign in
            </Button>
          </Stack>
        )}
        {state === "error" && (
          <Stack spacing={1.5}>
            <Alert severity="error">
              We could not load your points. Check your connection and try
              again.
            </Alert>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => setAttempt((count) => count + 1)}
            >
              Try again
            </Button>
          </Stack>
        )}
        {state === "ready" && data && (
          <Stack spacing={3}>
            <Box
              component="section"
              aria-label="Points balance"
              sx={{
                p: 2,
                borderRadius: "20px",
                bgcolor: "secondary.main",
                color: "secondary.contrastText",
              }}
            >
              <Typography variant="caption" component="p">
                Points available
              </Typography>
              <Typography
                component="p"
                sx={{
                  fontSize: 40,
                  lineHeight: "48px",
                  fontWeight: 750,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {data.balance.toLocaleString("en-US")}
              </Typography>
              <Typography variant="body2">
                1 point = {REWARD_RULES.mmkPerPoint} MMK off a delivery fee, up
                to half the fee. Earn 1 point per{" "}
                {REWARD_RULES.mmkPerEarnedPoint.toLocaleString("en-US")} MMK of
                fee on delivered orders.
              </Typography>
            </Box>

            <Box component="section" aria-labelledby="coupons-title">
              <Typography
                id="coupons-title"
                variant="h6"
                component="h2"
                sx={{ fontWeight: 750, mb: 1 }}
              >
                Coupons
              </Typography>
              {data.coupons.length === 0 ? (
                <Typography color="text.secondary">
                  No coupons right now. Codes you receive can be typed in at
                  checkout.
                </Typography>
              ) : (
                <Stack
                  component="ul"
                  spacing={1.5}
                  sx={{ p: 0, m: 0 }}
                  aria-label="Available coupons"
                >
                  {data.coupons.map((coupon) => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
                      onUse={(code) => {
                        update({ couponCode: code });
                        router.push("/pickup");
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            <Box component="section" aria-labelledby="history-title">
              <Typography
                id="history-title"
                variant="h6"
                component="h2"
                sx={{ fontWeight: 750 }}
              >
                Points history
              </Typography>
              <Tabs
                value={tab}
                onChange={(_event, value: LedgerTab) => setTab(value)}
                aria-label="Points history filter"
                variant="fullWidth"
              >
                <Tab value="all" label="All" sx={{ minHeight: 48 }} />
                <Tab value="earned" label="Earned" sx={{ minHeight: 48 }} />
                <Tab value="used" label="Used" sx={{ minHeight: 48 }} />
              </Tabs>
              {rows.length === 0 ? (
                <Typography color="text.secondary" sx={{ pt: 2 }}>
                  {tab === "all"
                    ? "No points yet. They arrive once a delivery is completed."
                    : `No ${tab} points yet.`}
                </Typography>
              ) : (
                <Stack component="ul" sx={{ p: 0, m: 0 }}>
                  {rows.map((row) => (
                    <Box
                      component="li"
                      key={row.id}
                      sx={{
                        listStyle: "none",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        py: 1.5,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>
                          {ledgerLabel(row.reason)}
                        </Typography>
                        <Typography variant="caption">
                          {day.format(new Date(row.created_at))}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          color:
                            row.delta > 0 ? "success.dark" : "text.primary",
                        }}
                      >
                        {row.delta > 0 ? "+" : "−"}
                        {Math.abs(row.delta).toLocaleString("en-US")} points
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        )}
      </Box>
      <CustomerBottomNav activeId="profile" />
    </main>
  );
}
