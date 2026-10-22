import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const phone = { isMobile: true, hasTouch: true, deviceScaleFactor: 1 };

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: `bun run dev -- --port ${port}`,
    url: `http://localhost:${port}/welcome`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      // Browser tests never reach a real project: every Supabase request is
      // answered by e2e/support/supabase-mock.ts.
      NEXT_PUBLIC_SUPABASE_URL: "https://oern-e2e.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
  projects: [
    {
      name: "mobile-360",
      use: { ...phone, viewport: { width: 360, height: 640 } },
    },
    {
      name: "mobile-390",
      use: { ...phone, viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-430",
      use: { ...phone, viewport: { width: 430, height: 932 } },
    },
    {
      name: "tablet-768",
      use: { ...phone, viewport: { width: 768, height: 1024 } },
    },
  ],
});
