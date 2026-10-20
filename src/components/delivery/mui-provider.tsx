"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import type { ReactNode } from "react";

// Material UI theme mapped to the Oern design tokens in DESIGN.md.
const theme = createTheme({
  palette: {
    primary: { main: "#c2410c", dark: "#9a3412", contrastText: "#ffffff" },
    secondary: { main: "#172b4d", contrastText: "#ffffff" },
    error: { main: "#dc2626", light: "#fee2e2", dark: "#b91c1c" },
    warning: { main: "#d97706", light: "#fef3c7", dark: "#92400e" },
    info: { main: "#2563eb", light: "#dbeafe", dark: "#1d4ed8" },
    success: { main: "#16a34a", light: "#dcfce7", dark: "#166534" },
    background: { default: "#f8fafc", paper: "#ffffff" },
    text: { primary: "#172b4d", secondary: "#475569" },
    divider: "#e2e8f0",
    grey: { 100: "#f1f5f9", 200: "#e2e8f0" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "inherit",
    button: { textTransform: "none", fontWeight: 650 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 48, borderRadius: 999 } },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: 48, minHeight: 48 } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 650 } } },
  },
});

export function MuiProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
