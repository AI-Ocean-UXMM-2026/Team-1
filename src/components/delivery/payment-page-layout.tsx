"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useState } from "react";
import type { MapPoint } from "@/lib/delivery/map-projection";
import { currency } from "@/lib/delivery/format";
import {
  type PaymentMethod,
  isPrepaid,
  paymentMethodInfo,
} from "@/lib/delivery/payment-methods";
import type { FeeEstimate } from "@/lib/delivery/delivery-fee";
import { PickupAddressSummary } from "@/components/delivery/pickup-address-summary";
import { PaymentMethodPicker } from "@/components/delivery/payment-picker";
import { MMQRPaymentFlow } from "@/components/delivery/mmqr-payment-flow";

interface Address {
  text: string;
  point?: MapPoint;
}

interface PaymentPageLayoutProps {
  /** Pickup location */
  pickupAddress: Address | null;
  /** Delivery location */
  deliveryAddress: Address | null;
  /** Delivery fee estimate */
  feeEstimate: FeeEstimate | null;
  /** Selected payment method */
  paymentMethod: PaymentMethod;
  /** Handler for payment method change */
  onPaymentMethodChange: (method: PaymentMethod) => void;
  /** Handler for editing addresses */
  onEditAddresses?: () => void;
  /** Handler for viewing map */
  onViewMap?: () => void;
  /** Handler when payment is successful */
  onPaymentSuccess?: () => void;
  /** Handler for navigating back */
  onBack?: () => void;
  /** Show loading state */
  isLoading?: boolean;
  /** Merchant ID for MMQR payments */
  merchantId?: string;
  /** Merchant name for MMQR payments */
  merchantName?: string;
  /** Page title */
  title?: string;
}

/**
 * Payment page layout combining address summary, fee breakdown, and payment method selection.
 * Designed with Grab-inspired UI using Oern's design system.
 */
export function PaymentPageLayout({
  pickupAddress,
  deliveryAddress,
  feeEstimate,
  paymentMethod,
  onPaymentMethodChange,
  onEditAddresses,
  onViewMap,
  onPaymentSuccess,
  onBack,
  isLoading = false,
  merchantId = "oern-merchant",
  merchantName = "Oern",
  title = "Payment",
}: PaymentPageLayoutProps) {
  const [showMMQRFlow, setShowMMQRFlow] = useState(false);
  const isAddressComplete =
    pickupAddress?.text && deliveryAddress?.text && pickupAddress.point && deliveryAddress.point;
  const canPayWithMMQR =
    isAddressComplete && isPrepaid(paymentMethod) && feeEstimate;

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setShowMMQRFlow(false);
    onPaymentMethodChange(method);
  };

  const handleStartMMQRPayment = () => {
    if (canPayWithMMQR) {
      setShowMMQRFlow(true);
    }
  };

  const handlePaymentConfirmed = () => {
    setShowMMQRFlow(false);
    onPaymentSuccess?.();
  };

  const handlePaymentCancelled = () => {
    setShowMMQRFlow(false);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            p: 2,
            maxWidth: 800,
            mx: "auto",
          }}
        >
          {onBack && (
            <Button
              size="small"
              sx={{
                minWidth: 40,
                width: 40,
                height: 40,
                borderRadius: "50%",
                color: "#172b4d",
                "&:hover": {
                  backgroundColor: "#f1f5f9",
                },
              }}
              onClick={onBack}
            >
              <ArrowBackIcon />
            </Button>
          )}
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
            {title}
          </Typography>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box
        sx={{
          maxWidth: 800,
          mx: "auto",
          p: { xs: 2, sm: 3 },
        }}
      >
        <Stack spacing={3}>
          {/* Addresses Section */}
          <section aria-label="Pickup and delivery addresses">
            <PickupAddressSummary
              pickupAddress={pickupAddress}
              deliveryAddress={deliveryAddress}
              onEdit={onEditAddresses}
              onOpenMap={onViewMap}
              isLoading={isLoading}
              showEdit={!showMMQRFlow}
            />
          </section>

          {/* Fee Breakdown */}
          {feeEstimate && (
            <section aria-label="Delivery fee breakdown">
              <Paper
                sx={{
                  p: 3,
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 700,
                    mb: 2,
                  }}
                >
                  Delivery Fee
                </Typography>
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                  {feeEstimate.lines.map((line) => (
                    <Box
                      key={`${line.id}-${line.label}`}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: line.id === "discount" ? "#16a34a" : "#64748b",
                          fontWeight: line.id === "discount" ? 600 : 400,
                        }}
                      >
                        {line.label}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: line.id === "discount" ? "#16a34a" : "#172b4d",
                        }}
                      >
                        {line.id === "discount" ? "−" : ""}
                        {currency.format(line.amount)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                    }}
                  >
                    Total Fee
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      fontSize: "18px",
                    }}
                  >
                    {currency.format(feeEstimate.total)}
                  </Typography>
                </Box>

                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "12px",
                    color: "#64748b",
                    mt: 1.5,
                    display: "block",
                  }}
                >
                  About {feeEstimate.distanceKm.toFixed(1)} km. Estimate; the
                  final fee is confirmed when a rider is assigned.
                </Typography>
              </Paper>
            </section>
          )}

          {/* Show MMQR Flow if active */}
          {showMMQRFlow && feeEstimate && (
            <section aria-label="MMQR payment">
              <MMQRPaymentFlow
                amount={feeEstimate.total}
                reference={pickupAddress?.point ? "PKP-" + Date.now() : "TEMP"}
                merchantId={merchantId}
                merchantName={merchantName}
                onConfirmed={handlePaymentConfirmed}
                onCancel={handlePaymentCancelled}
              />
            </section>
          )}

          {/* Payment Method Selection - Only show if not in MMQR flow */}
          {!showMMQRFlow && (
            <section aria-label="Payment method">
              <Paper
                sx={{
                  p: 3,
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                }}
              >
                <PaymentMethodPicker
                  name="payment-method"
                  value={paymentMethod}
                  onChange={handlePaymentMethodChange}
                />
              </Paper>
            </section>
          )}

          {/* Action Buttons */}
          {!showMMQRFlow && (
            <Stack
              spacing={2}
              sx={{
                position: "sticky",
                bottom: 0,
                backgroundColor: "#f8fafc",
                p: 2,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              {isPrepaid(paymentMethod) && feeEstimate && (
                <Button
                  variant="contained"
                  size="large"
                  disabled={
                    !isAddressComplete ||
                    isLoading ||
                    !canPayWithMMQR
                  }
                  sx={{
                    backgroundColor: "#c2410c",
                    color: "#ffffff",
                    height: "56px",
                    borderRadius: "999px",
                    fontSize: "16px",
                    fontWeight: 600,
                    textTransform: "none",
                    "&:hover": {
                      backgroundColor: "#9a3412",
                    },
                    "&:disabled": {
                      backgroundColor: "#cbd5e1",
                      color: "#94a3b8",
                    },
                  }}
                  onClick={handleStartMMQRPayment}
                >
                  Pay {currency.format(feeEstimate.total)} Now
                </Button>
              )}
              <Button
                variant="outlined"
                size="large"
                disabled={isLoading}
                sx={{
                  borderColor: "#cbd5e1",
                  color: "#172b4d",
                  height: "56px",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: 600,
                  textTransform: "none",
                  backgroundColor: "#ffffff",
                  "&:hover": {
                    backgroundColor: "#f1f5f9",
                    borderColor: "#94a3b8",
                  },
                }}
                onClick={onBack}
              >
                {isPrepaid(paymentMethod)
                  ? "Pass to Receiver"
                  : "Continue to Review"}
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
