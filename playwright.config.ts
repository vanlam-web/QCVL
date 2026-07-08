import { defineConfig, devices } from "@playwright/test";
import { loadPlaywrightConfigSupabaseEnv, resolveE2eApiBaseUrl } from "./tests/e2e/supabase-env";

process.env.E2E_ADMIN_EMAIL ??= "admin@qc.local";
process.env.E2E_ADMIN_PASSWORD ??= "123456";

const supabase = loadPlaywrightConfigSupabaseEnv();
const apiBaseUrl = resolveE2eApiBaseUrl(supabase);
const webServerEnv = {
  ...process.env,
  SUPABASE_URL: supabase.SUPABASE_URL,
  SUPABASE_ANON_KEY: supabase.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: supabase.SUPABASE_SERVICE_ROLE_KEY,
  VITE_SUPABASE_URL: supabase.SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: supabase.SUPABASE_ANON_KEY,
  VITE_API_BASE_URL: apiBaseUrl,
  VITE_APP_ENV: "e2e",
  QC_OMS_ALLOWED_ORIGINS: "http://127.0.0.1:5174",
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
      command: "npx supabase functions serve api",
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
