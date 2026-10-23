/**
 * Enhanced Payment Review Component
 * Mobbin-style fee breakdown with clear visual hierarchy
 * Shows breakdown, payment method selection, and sandbox/MMQR flow
 */

"use client";

import { Box, Button, Card, Chip, Stack, Typography } from "@mui/material";
import { ReactNode } from "react";

/** Fee breakdown card with visual hierarchy */
export function FeeReviewCard({
  baseAmount,
  distanceKm,
  distanceCharge,
  couponAmount,
  total,
  currency = "MMK",
}: {
  baseAmount: number;
  distanceKm: number;
  distanceCharge: number;
  couponAmount?: number;
  total: number;
  currency?: string;
}) {
  return (
    <Card
      sx={{
        p: 2,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      {/* Header */}
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 700,
          mb: 1.5,
          color: "text.primary",
          fontSize: "14px",
        }}
      >
        Fee Breakdown
      </Typography>

      {/* Fee items */}
      <Stack spacing={1} sx={{ mb: 1.5 }}>
        {/* Base fee */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Pickup & delivery
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "text.primary" }}
          >
            {currency} {baseAmount.toLocaleString()}
          </Typography>
        </Box>

        {/* Distance charge */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Distance ({distanceKm.toFixed(1)} km)
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "text.primary" }}
          >
            {currency} {distanceCharge.toLocaleString()}
          </Typography>
        </Box>

        {/* Coupon discount */}
        {couponAmount && couponAmount > 0 && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" sx={{ color: "success.main", fontWeight: 500 }}>
              Coupon discount
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: "success.main",
              }}
            >
              −{currency} {couponAmount.toLocaleString()}
            </Typography>
          </Box>
        )}
      </Stack>

      {/* Divider */}
      <Box sx={{ height: "1px", bgcolor: "divider", my: 1.5 }} />

      {/* Total */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            fontSize: "16px",
            color: "text.primary",
          }}
        >
          Total
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            fontSize: "20px",
            fontVariantNumeric: "tabular-nums",
            color: "primary.main",
          }}
        >
          {currency} {total.toLocaleString()}
        </Typography>
      </Box>
    </Card>
  );
}

/** Payment method selector with descriptions */
export function PaymentMethodSelector({
  selected,
  onChange,
  options,
}: {
  selected: string;
  onChange: (method: string) => void;
  options: Array<{
    id: string;
    name: string;
    description: string;
    icon?: ReactNode;
    badge?: string;
  }>;
}) {
  return (
    <Stack spacing={1}>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 700,
          mb: 0.5,
          fontSize: "14px",
        }}
      >
        Payment method
      </Typography>

      {options.map((option) => (
        <Box
          key={option.id}
          onClick={() => onChange(option.id)}
          sx={{
            p: 2,
            border: "2px solid",
            borderColor: selected === option.id ? "primary.main" : "divider",
            borderRadius: 1.5,
            cursor: "pointer",
            backgroundColor: selected === option.id ? "primary.lighter" : "background.paper",
            transition: "all 200ms ease-in-out",
            "&:hover": {
              borderColor: "primary.main",
              bgcolor: "primary.lighter",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            {/* Radio */}
            <Box
              sx={{
                mt: 0.5,
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "2px solid",
                borderColor: selected === option.id ? "primary.main" : "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {selected === option.id && (
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                  }}
                />
              )}
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: "text.primary",
                  }}
                >
                  {option.name}
                </Typography>
                {option.badge && (
                  <Chip
                    label={option.badge}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  />
                )}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  display: "block",
                }}
              >
                {option.description}
              </Typography>
            </Box>

            {/* Icon */}
            {option.icon && <Box sx={{ flexShrink: 0 }}>{option.icon}</Box>}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

/** Review summary with COD notification */
export function PaymentReviewSummary({
  pickupAddress,
  deliveryAddress,
  parcelDescription,
  codAmount,
  paymentMethod,
  total,
  onEdit,
}: {
  pickupAddress: string;
  deliveryAddress: string;
  parcelDescription: string;
  codAmount?: number;
  paymentMethod: string;
  total: number;
  onEdit?: () => void;
}) {
  return (
    <Stack spacing={2}>
      {/* COD Banner */}
      {codAmount && codAmount > 0 && (
        <Box
          sx={{
            p: 1.5,
            bgcolor: "warning.lighter",
            border: "1px solid",
            borderColor: "warning.light",
            borderRadius: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "warning.dark",
              fontWeight: 600,
              display: "block",
            }}
          >
            💵 Cash on Delivery: MMK {codAmount.toLocaleString()}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "warning.dark",
              display: "block",
              mt: 0.5,
              fontSize: "11px",
            }}
          >
            Rider will collect from recipient at delivery
          </Typography>
        </Box>
      )}

      {/* Summary Card */}
      <Card
        sx={{
          p: 2,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={1.5}>
          {/* From/To */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              From
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.25 }}>
              {pickupAddress}
            </Typography>
          </Box>

          <Box
            sx={{
              height: "1px",
              bgcolor: "divider",
              my: 0.5,
            }}
          />

          <Box>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              To
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.25 }}>
              {deliveryAddress}
            </Typography>
          </Box>

          <Box
            sx={{
              height: "1px",
              bgcolor: "divider",
              my: 0.5,
            }}
          />

          {/* Parcel */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Parcel
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.25 }}>
              {parcelDescription}
            </Typography>
          </Box>
        </Stack>

        {/* Edit Button */}
        {onEdit && (
          <Button
            size="small"
            onClick={onEdit}
            sx={{
              mt: 1.5,
              color: "primary.main",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            ✏️ Edit details
          </Button>
        )}
      </Card>
    </Stack>
  );
}

/** MMQR redirection card */
export function MMQRRedirectCard({
  total,
  onRedirect,
  loading = false,
}: {
  total: number;
  onRedirect: () => void;
  loading?: boolean;
}) {
  return (
    <Card
      sx={{
        p: 2,
        bgcolor: "info.lighter",
        border: "1px solid",
        borderColor: "info.light",
        borderRadius: 2,
        textAlign: "center",
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 700,
          mb: 0.5,
          color: "info.dark",
        }}
      >
        Next Step: Complete Payment
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: "info.dark",
          display: "block",
          mb: 1.5,
        }}
      >
        You'll be redirected to MMQR to complete payment of MMK {total.toLocaleString()}
      </Typography>
      <Button
        fullWidth
        variant="contained"
        onClick={onRedirect}
        disabled={loading}
        sx={{
          bgcolor: "primary.main",
          color: "white",
          fontWeight: 600,
          "&:hover": { bgcolor: "primary.dark" },
        }}
      >
        {loading ? "Redirecting..." : "Continue to Payment"}
      </Button>
    </Card>
  );
}

/** Sandbox test card disclosure */
export function SandboxTestCardInfo() {
  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: "success.lighter",
        border: "1px solid",
        borderColor: "success.light",
        borderRadius: 1,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: "success.dark",
          fontWeight: 600,
          display: "block",
        }}
      >
        🧪 Sandbox Mode
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: "success.dark",
          display: "block",
          mt: 0.5,
          fontSize: "11px",
        }}
      >
        Use test card: <code style={{ fontFamily: "monospace" }}>4242 4242 4242 4242</code>
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: "success.dark",
          display: "block",
          fontSize: "11px",
        }}
      >
        Exp: 12/25 | CVC: 123
      </Typography>
    </Box>
  );
}

/** Complete payment flow review */
export function PaymentReviewFlow({
  baseAmount,
  distanceKm,
  distanceCharge,
  couponAmount,
  total,
  pickupAddress,
  deliveryAddress,
  parcelDescription,
  codAmount,
  paymentMethod,
  sandbox = false,
  onEdit,
  onConfirm,
  loading = false,
}: {
  baseAmount: number;
  distanceKm: number;
  distanceCharge: number;
  couponAmount?: number;
  total: number;
  pickupAddress: string;
  deliveryAddress: string;
  parcelDescription: string;
  codAmount?: number;
  paymentMethod: string;
  sandbox?: boolean;
  onEdit?: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Stack spacing={2}>
      {/* Fee Breakdown */}
      <FeeReviewCard
        baseAmount={baseAmount}
        distanceKm={distanceKm}
        distanceCharge={distanceCharge}
        couponAmount={couponAmount}
        total={total}
      />

      {/* Order Summary */}
      <PaymentReviewSummary
        pickupAddress={pickupAddress}
        deliveryAddress={deliveryAddress}
        parcelDescription={parcelDescription}
        codAmount={codAmount}
        paymentMethod={paymentMethod}
        total={total}
        onEdit={onEdit}
      />

      {/* Sandbox Info */}
      {sandbox && <SandboxTestCardInfo />}

      {/* MMQR Redirect */}
      <MMQRRedirectCard total={total} onRedirect={onConfirm} loading={loading} />

      {/* Confirm Button */}
      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={onConfirm}
        disabled={loading}
        sx={{
          minHeight: 56,
          fontWeight: 700,
          fontSize: "16px",
          borderRadius: "12px",
        }}
      >
        {loading ? "Sending request..." : "Send pickup request"}
      </Button>
    </Stack>
  );
}
