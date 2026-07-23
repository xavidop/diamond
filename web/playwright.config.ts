import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    // The mini viewer trigger is `hidden lg:inline-flex`, so the viewport must
    // be at least Tailwind's lg breakpoint (1024px) for it to exist at all.
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // dev:web only — the mini viewer talks to statsapi.mlb.com directly and
    // never touches the Express server behind the /api proxy.
    command: "npm run dev:web",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
