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

// DESIGN.md §6.4: dark theme for driver and night use. Surfaces separate by
// lightness, not by inverting the light palette.
const darkPalette = {
  primary: {
    main: "#f97316",
    light: "#fb923c",
    dark: "#c2410c",
    contrastText: "#0f172a",
  },
  secondary: { main: "#334155", contrastText: "#f8fafc" },
  error: { main: "#f87171", light: "#450a0a", dark: "#fca5a5" },
  warning: { main: "#fbbf24", light: "#422006", dark: "#fcd34d" },
  info: { main: "#60a5fa", light: "#172554", dark: "#93c5fd" },
  success: { main: "#4ade80", light: "#052e16", dark: "#86efac" },
  background: { default: "#0f172a", paper: "#1e293b" },
  text: { primary: "#f8fafc", secondary: "#cbd5e1" },
  divider: "#334155",
  grey: { 100: "#273449", 200: "#334155" },
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
            outline: "3px solid #f3a38d",
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
          background: "var(--mui-palette-background-paper, #ffffff)",
          fontSize: 16,
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#2563eb",
            borderWidth: 2,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: "#dc2626",
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
        notchedOutline: { borderColor: "#64748b" },
      },
    },
  },
};

const theme = createTheme({ ...themeOptions, palette: lightPalette });

// The rider flow follows the OS colour scheme through CSS variables, so a
// night-shift phone switches without a re-render or a flash of light theme.
const riderTheme = createTheme({
  ...themeOptions,
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: { palette: lightPalette },
    dark: { palette: darkPalette },
  },
});

export function RiderThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={riderTheme}>{children}</ThemeProvider>;
}

export function MuiProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
