import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    storageState: "e2e/.auth/state.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // The golden path must also work on a phone-sized screen.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // CI builds and serves the production bundle. Locally, reuse `npm run dev`.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Pass the port explicitly so parallel checkouts (git worktrees) can
        // each run their own server via E2E_PORT without reusing another's.
        command: isCI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
