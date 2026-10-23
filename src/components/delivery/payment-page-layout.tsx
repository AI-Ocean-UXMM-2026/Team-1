"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Modal from "@mui/material/Modal";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { PaymentMethodPicker } from "@/components/delivery/payment-picker";
import { PickupAddressSummary } from "@/components/delivery/pickup-address-summary";
import type { FeeEstimate } from "@/lib/delivery/delivery-fee";
import { currency } from "@/lib/delivery/format";
import type { MapPoint } from "@/lib/delivery/map-projection";
import { isPrepaid, type PaymentMethod } from "@/lib/delivery/payment-methods";

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
  onPaymentSuccess: _onPaymentSuccess,
  onBack,
  isLoading = false,
  merchantId: _merchantId = "oern-merchant",
  merchantName: _merchantName = "Oern",
  title = "Payment",
}: PaymentPageLayoutProps) {
  const [showCouponModal, setShowCouponModal] = useState(false);
  const _isAddressComplete =
    pickupAddress?.text &&
    deliveryAddress?.text &&
    pickupAddress.point &&
    deliveryAddress.point;

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    onPaymentMethodChange(method);
  };
  const handleCloseCouponModal = () => {
    setShowCouponModal(false);
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
              showEdit={true}
            />
          </section>

          {/* Big Centered Price */}
          {feeEstimate && (
            <Box
              sx={{
                textAlign: "center",
                py: 4,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: "14px",
                  color: "#64748b",
                  display: "block",
                  mb: 1,
                }}
              >
                Delivery fee estimate
              </Typography>
              <Typography
                sx={{
                  fontSize: "56px",
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  color: "#172b4d",
                  mb: 1,
                }}
              >
                {currency.format(feeEstimate.total)}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                About {feeEstimate.distanceKm.toFixed(1)} km. Estimate; the
                final fee is confirmed when a rider is assigned.
              </Typography>

              {/* Coupon & Points Button */}
              <Button
                onClick={() => setShowCouponModal(true)}
                sx={{
                  mt: 2,
                  textTransform: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#172b4d",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  py: 1.5,
                  px: 2,
                  "&:hover": {
                    backgroundColor: "#e2e8f0",
                    borderColor: "#cbd5e1",
                  },
                }}
              >
                💳 Coupon and points
              </Button>
            </Box>
          )}

          {/* Payment Method Selection */}
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

          {/* Action Buttons */}
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
        </Stack>
      </Box>

      {/* Coupon Modal */}
      <Modal
        open={showCouponModal}
        onClose={handleCloseCouponModal}
        components={{
          Backdrop: Backdrop,
        }}
        componentsProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        }}
        sx={{
          "& .MuiModal-backdrop": {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          },
        }}
      >
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#ffffff",
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.12)",
            p: 3,
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
              }}
            >
              Coupon and points
            </Typography>
            <Button
              onClick={handleCloseCouponModal}
              sx={{
                minWidth: 40,
                width: 40,
                height: 40,
                borderRadius: "50%",
                color: "#64748b",
                "&:hover": {
                  backgroundColor: "#f1f5f9",
                },
              }}
            >
              ✕
            </Button>
          </Box>

          {feeEstimate && (
            <Stack spacing={3}>
              {/* Price Summary in Modal */}
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "#f8fafc",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    mb: 2,
                  }}
                >
                  Price summary
                </Typography>
                <Stack spacing={1}>
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
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                    }}
                  >
                    Total fee
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      fontSize: "18px",
                    }}
                  >
                    {currency.format(feeEstimate.total)}
                  </Typography>
                </Box>
              </Box>

              {/* Coupon Code Input */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    mb: 1,
                  }}
                >
                  Coupon code
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Box
                    component="input"
                    type="text"
                    placeholder="Enter coupon code"
                    sx={{
                      flex: 1,
                      p: "12px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      "&:focus": {
                        outline: "none",
                        borderColor: "#172b4d",
                        boxShadow: "0 0 0 3px rgba(23, 43, 77, 0.1)",
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    sx={{
                      backgroundColor: "#e2e8f0",
                      color: "#172b4d",
                      fontWeight: 600,
                      textTransform: "none",
                      borderRadius: "8px",
                      px: 3,
                      "&:hover": {
                        backgroundColor: "#cbd5e1",
                      },
                    }}
                  >
                    Apply
                  </Button>
                </Stack>
              </Box>

              {/* Points Info */}
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "#f0fdf4",
                  borderRadius: "8px",
                  border: "1px solid #dcfce7",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: "#16a34a",
                    mb: 1,
                  }}
                >
                  ⭐ Earn points
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: "#15803d",
                    display: "block",
                  }}
                >
                  Earn 1 point for every 1,000 MMK of delivery fee once an order
                  is delivered.
                </Typography>
              </Box>

              {/* Close Button */}
              <Button
                variant="outlined"
                fullWidth
                onClick={handleCloseCouponModal}
                sx={{
                  borderColor: "#e2e8f0",
                  color: "#172b4d",
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: "8px",
                  py: 1.5,
                  "&:hover": {
                    backgroundColor: "#f1f5f9",
                    borderColor: "#cbd5e1",
                  },
                }}
              >
                Done
              </Button>
            </Stack>
          )}
        </Box>
      </Modal>
    </Box>
  );
}
