import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE = `http://localhost:${PORT}`;
process.env.BASE_URL = BASE;

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: BASE,
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `${BASE}/login`,
    timeout: 240_000,
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
  },
});
