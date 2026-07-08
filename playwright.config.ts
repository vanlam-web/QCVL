import { defineConfig, devices } from "@playwright/test";

process.env.E2E_ADMIN_EMAIL ??= "admin@qc.local";
process.env.E2E_ADMIN_PASSWORD ??= "123456";

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3100";
const webServerEnv = {
  ...process.env,
  VITE_API_BASE_URL: apiBaseUrl,
  VITE_APP_ENV: "e2e",
  QC_OMS_ALLOWED_ORIGINS: "http://127.0.0.1:5174",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run api:dev",
      url: `${apiBaseUrl}/api/v1/health`,
      env: webServerEnv,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174",
      url: "http://127.0.0.1:5174",
      env: webServerEnv,
      reuseExistingServer: false,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
