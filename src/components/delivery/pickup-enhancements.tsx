/**
 * Pickup Flow Enhancements: Progress Bar, Help System, Error Recovery
 * Fixes for P0 (Error Recovery, Help System) and P1 (Progress Indicator)
 */

import HelpOutlined from "@mui/icons-material/HelpOutlined";
import LinearProgress from "@mui/material/LinearProgress";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { ReactNode } from "react";

/** Progress bar showing user's position through 4-step pickup flow */
export function PickupProgressBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  const theme = useTheme();
  const progress = ((step - 1) / 3) * 100; // 0-100% across 4 steps

  return (
    <Box sx={{ pt: 1, pb: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 500, fontSize: "11px" }}>
          Step {step} of 4
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "11px" }}>
          {Math.round(progress)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 8,
          borderRadius: "12px",
          backgroundColor: "rgba(23, 43, 77, 0.1)",
          "& .MuiLinearProgress-bar": {
            backgroundColor: theme.palette.primary.main,
            borderRadius: "12px",
          },
        }}
      />
    </Box>
  );
}

/** Help icon with tooltip for explaining key concepts */
export function HelpIcon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Tooltip
      title={
        <Box sx={{ maxWidth: "200px" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ lineHeight: 1.4 }}>
            {description}
          </Typography>
        </Box>
      }
      arrow
      placement="top"
    >
      <IconButton
        size="small"
        sx={{
          width: 20,
          height: 20,
          ml: 0.5,
          color: "text.secondary",
          "&:hover": { color: "primary.main" },
        }}
      >
        <HelpOutlined sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}

/** Field with inline help icon */
export function FieldWithHelp({
  label,
  helpTitle,
  helpDescription,
  children,
}: {
  label: string;
  helpTitle: string;
  helpDescription: string;
  children: ReactNode;
}) {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Typography
          component="label"
          variant="subtitle2"
          sx={{ fontWeight: 700, display: "block" }}
        >
          {label}
        </Typography>
        <HelpIcon title={helpTitle} description={helpDescription} />
      </Box>
      {children}
    </Box>
  );
}

/** Error recovery component with suggestions */
export function ErrorRecovery({
  error,
  suggestions,
  onRetry,
}: {
  error: string;
  suggestions?: string[];
  onRetry?: () => void;
}) {
  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "error.lighter",
        border: "1px solid",
        borderColor: "error.light",
        borderRadius: 1,
        mb: 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ color: "error.dark", fontWeight: 600, mb: 0.5 }}>
        ⚠️ {error}
      </Typography>
      
      {suggestions && suggestions.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: "error.dark", display: "block", mb: 0.5 }}>
            Try one of these:
          </Typography>
          <ul style={{ margin: "0 0 0 1.2em", paddingLeft: 0 }}>
            {suggestions.map((suggestion, idx) => (
              <li key={idx}>
                <Typography variant="caption" sx={{ color: "error.dark", fontSize: "12px" }}>
                  {suggestion}
                </Typography>
              </li>
            ))}
          </ul>
        </Box>
      )}

      {onRetry && (
        <Typography
          component="button"
          onClick={onRetry}
          sx={{
            mt: 1,
            color: "primary.main",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            border: "none",
            bg: "transparent",
            p: 0,
            "&:hover": { textDecoration: "underline" },
          }}
        >
          🔄 Try again
        </Typography>
      )}
    </Box>
  );
}

/** Payment method with help icon explaining each option */
export function PaymentMethodWithHelp({
  label,
  icon,
  helpTitle,
  helpDescription,
}: {
  label: string;
  icon: ReactNode;
  helpTitle: string;
  helpDescription: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
        {icon}
        <Typography variant="body2" sx={{ flex: 1 }}>
          {label}
        </Typography>
      </Box>
      <HelpIcon title={helpTitle} description={helpDescription} />
    </Box>
  );
}

/** Help callout for Sandbox mode */
export function SandboxModeNotice() {
  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: "info.lighter",
        border: "1px solid",
        borderColor: "info.light",
        borderRadius: 1,
        mb: 2,
      }}
    >
      <Typography variant="caption" sx={{ color: "info.dark", fontWeight: 600 }}>
        ℹ️ Using test card? That's normal for development.
      </Typography>
      <Typography variant="caption" sx={{ color: "info.dark", display: "block", fontSize: "11px", mt: 0.5 }}>
        Use card: 4242 4242 4242 4242 | Exp: 12/25 | CVC: 123
      </Typography>
    </Box>
  );
}

/** COD explanation component */
export function CODExplanation() {
  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: "warning.lighter",
        border: "1px solid",
        borderColor: "warning.light",
        borderRadius: 1,
        mb: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ color: "warning.dark", fontWeight: 600, flex: 1 }}>
          💵 Cash on Delivery (COD)
        </Typography>
        <HelpIcon
          title="What is COD?"
          description="The rider will collect payment in cash when delivering your package to the recipient."
        />
      </Box>
      <Typography variant="caption" sx={{ color: "warning.dark", display: "block", mt: 0.5, fontSize: "12px" }}>
        Recipient pays the driver in cash. No card needed.
      </Typography>
    </Box>
  );
}

/** Network timeout with retry option */
export function NetworkTimeout({ onRetry }: { onRetry: () => void }) {
  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "error.lighter",
        border: "1px solid",
        borderColor: "error.light",
        borderRadius: 1,
        textAlign: "center",
      }}
    >
      <Typography variant="subtitle2" sx={{ color: "error.dark", fontWeight: 600, mb: 1 }}>
        Connection Timeout
      </Typography>
      <Typography variant="body2" sx={{ color: "error.dark", mb: 2 }}>
        Your request took too long. Please check your connection and try again.
      </Typography>
      <Typography
        component="button"
        onClick={onRetry}
        sx={{
          px: 3,
          py: 1,
          bgcolor: "primary.main",
          color: "white",
          border: "none",
          borderRadius: "999px",
          cursor: "pointer",
          fontWeight: 600,
          "&:hover": { bgcolor: "primary.dark" },
        }}
      >
        Retry Submission
      </Typography>
    </Box>
  );
}

/** Fee explanation component */
export function FeeExplanation({
  baseAmount,
  distanceKm,
  distanceCharge,
  total,
}: {
  baseAmount: number;
  distanceKm: number;
  distanceCharge: number;
  total: number;
}) {
  return (
    <Box sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="caption">Base delivery fee</Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          MMK {baseAmount.toLocaleString()}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="caption">
          Distance charge ({distanceKm.toFixed(1)} km)
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          MMK {distanceCharge.toLocaleString()}
        </Typography>
      </Box>
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1, display: "flex", justifyContent: "space-between" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Total
        </Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          MMK {total.toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
}
