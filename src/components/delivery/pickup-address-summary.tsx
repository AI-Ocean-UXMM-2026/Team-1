"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import type { MapPoint } from "@/lib/delivery/map-projection";

interface Address {
  text: string;
  point?: MapPoint;
}

interface PickupAddressSummaryProps {
  /** The pickup address */
  pickupAddress: Address | null;
  /** The delivery address */
  deliveryAddress: Address | null;
  /** Called when user wants to edit addresses */
  onEdit?: () => void;
  /** Called when user wants to open map */
  onOpenMap?: () => void;
  /** Show loading state */
  isLoading?: boolean;
  /** Show edit button */
  showEdit?: boolean;
}

/**
 * Display pickup and delivery addresses in a compact, read-only format.
 * Useful for payment confirmation screens or order reviews.
 */
export function PickupAddressSummary({
  pickupAddress,
  deliveryAddress,
  onEdit,
  onOpenMap,
  isLoading = false,
  showEdit = true,
}: PickupAddressSummaryProps) {
  const isEmpty = !pickupAddress?.text && !deliveryAddress?.text;

  if (isEmpty) {
    return (
      <Paper
        sx={{
          p: 3,
          backgroundColor: "#f1f5f9",
          border: "1px dashed #cbd5e1",
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <Typography variant="body1" sx={{ color: "#64748b" }}>
          Add both pickup and delivery addresses to continue
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
      }}
    >
      <Stack spacing={3}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Addresses
          </Typography>
          {showEdit && !isLoading && (
            <Button
              size="small"
              startIcon={<EditOutlinedIcon />}
              sx={{
                color: "#2563eb",
                textTransform: "none",
                fontSize: "14px",
                "&:hover": {
                  backgroundColor: "#dbeafe",
                },
              }}
              onClick={onEdit}
            >
              Edit
            </Button>
          )}
        </Box>

        {/* Pickup Address */}
        {pickupAddress?.text && (
          <Box
            sx={{
              display: "flex",
              gap: 2,
              p: 2,
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "#f97316",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#ffffff",
              }}
            >
              <LocationOnOutlinedIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "12px",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  mb: 0.5,
                  display: "block",
                }}
              >
                Pickup
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: "#172b4d",
                  wordBreak: "break-word",
                  lineHeight: 1.5,
                }}
              >
                {pickupAddress.text}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Arrow / Divider */}
        {pickupAddress?.text && deliveryAddress?.text && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              color: "#cbd5e1",
              py: 1,
            }}
          >
            <Typography variant="h6">↓</Typography>
          </Box>
        )}

        {/* Delivery Address */}
        {deliveryAddress?.text && (
          <Box
            sx={{
              display: "flex",
              gap: 2,
              p: 2,
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#ffffff",
              }}
            >
              <LocationOnOutlinedIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "12px",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  mb: 0.5,
                  display: "block",
                }}
              >
                Delivery
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: "#172b4d",
                  wordBreak: "break-word",
                  lineHeight: 1.5,
                }}
              >
                {deliveryAddress.text}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Map button - only show if both addresses have coordinates */}
        {pickupAddress?.point &&
          deliveryAddress?.point &&
          onOpenMap &&
          !isLoading && (
            <Button
              variant="outlined"
              startIcon={<MapOutlinedIcon />}
              sx={{
                borderColor: "#cbd5e1",
                color: "#172b4d",
                height: "44px",
                borderRadius: "8px",
                textTransform: "none",
                fontSize: "14px",
                fontWeight: 600,
                backgroundColor: "#ffffff",
                "&:hover": {
                  backgroundColor: "#f1f5f9",
                  borderColor: "#94a3b8",
                },
              }}
              onClick={onOpenMap}
            >
              View on Map
            </Button>
          )}
      </Stack>
    </Paper>
  );
}
