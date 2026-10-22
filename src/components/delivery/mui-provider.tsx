"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { ReactNode } from "react";

// Material UI theme mapped to the Oern design tokens in DESIGN.md.
const lightPalette = {
  primary: {
    main: "#c2410c",
    light: "#fb923c",
    dark: "#9a3412",
    contrastText: "#ffffff",
  },
  secondary: { main: "#172b4d", contrastText: "#ffffff" },
  error: { main: "#dc2626", light: "#fee2e2", dark: "#b91c1c" },
  warning: { main: "#d97706", light: "#fef3c7", dark: "#92400e" },
  info: { main: "#2563eb", light: "#dbeafe", dark: "#1d4ed8" },
  success: { main: "#16a34a", light: "#dcfce7", dark: "#166534" },
  background: { default: "#f8fafc", paper: "#ffffff" },
  text: { primary: "#172b4d", secondary: "#475569" },
  divider: "#e2e8f0",
  grey: { 100: "#f1f5f9", 200: "#e2e8f0" },
};

const themeOptions = {
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "inherit",
    button: { textTransform: "none", fontWeight: 650 },
  },
  components: {
    // Focus ripples start a pulsing ripple on whatever control receives focus
    // in code (sheet open/close, page transitions restoring focus), so a tap on
    // one control appears to ripple another. Touch ripples stay on the pressed
    // control; keyboard focus uses the outline below instead. The pulsate
    // override is the only way to cover components that hard-code
    // focusRipple: true (BottomNavigationAction does not accept
    // disableFocusRipple); normal touch ripples never use the pulsate class.
    MuiButtonBase: {
      defaultProps: { focusRipple: false },
      styleOverrides: {
        root: {
          "& .MuiTouchRipple-ripplePulsate": { display: "none" },
          "&.Mui-focusVisible": {
            outline: "3px solid #2563eb",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableFocusRipple: true },
      styleOverrides: { root: { minHeight: 48, borderRadius: 999 } },
    },
    MuiIconButton: {
      defaultProps: { disableFocusRipple: true },
      styleOverrides: { root: { minWidth: 48, minHeight: 48 } },
    },
    MuiToggleButton: {
      defaultProps: { disableFocusRipple: true },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { "&.Mui-focusVisible": { backgroundColor: "transparent" } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 650,
          "&.MuiChip-clickable.Mui-focusVisible": {
            backgroundColor: "transparent",
          },
        },
      },
    },
    // Outlined inputs match the native field spec in src/app/form-fields.css.
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 52,
          borderRadius: 12,
          background: "var(--color-surface, #ffffff)",
          fontSize: 16,
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--color-info, #2563eb)",
            borderWidth: 2,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--color-error, #dc2626)",
            borderWidth: 2,
          },
        },
        // The field box is 52px tall, so the input itself must fill it or the
        // tappable area shrinks to the text line.
        input: {
          "&:not(textarea)": {
            boxSizing: "border-box",
            height: 52,
            paddingTop: 0,
            paddingBottom: 0,
          },
        },
        notchedOutline: { borderColor: "var(--color-border-control, #64748b)" },
      },
    },
  },
};

const appTheme = createTheme({ ...themeOptions, palette: lightPalette });

export function RiderThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={appTheme}>{children}</ThemeProvider>;
}

export function MuiProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={appTheme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
