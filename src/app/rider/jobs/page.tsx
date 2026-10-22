import { RiderThemeProvider } from "@/components/delivery/mui-provider";
import { RiderApp } from "@/components/delivery/rider-app";

export default function RiderJobsPage() {
  return (
    <RiderThemeProvider>
      <RiderApp />
    </RiderThemeProvider>
  );
}
