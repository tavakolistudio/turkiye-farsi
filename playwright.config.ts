import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv();

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E runs against the dev server over http. In production the session cookie
 * uses the `__Host-` prefix (Secure, https-only), which browsers refuse over
 * http — so a production build could not authenticate here. Dev mode uses the
 * plain cookie name and exercises the identical auth/authz code paths.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
