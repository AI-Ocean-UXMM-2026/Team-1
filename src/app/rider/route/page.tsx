import { RiderThemeProvider } from "@/components/delivery/mui-provider";
import { RiderApp } from "@/components/delivery/rider-app";

export default function RiderRoutePage() {
  return (
    <RiderThemeProvider>
      <RiderApp />
    </RiderThemeProvider>
  );
}
