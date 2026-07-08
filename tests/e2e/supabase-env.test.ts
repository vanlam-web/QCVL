import { describe, expect, test } from "vitest";
import {
  e2eConfigOnlySupabaseEnv,
  loadPlaywrightConfigSupabaseEnv,
  resolveE2eApiBaseUrl,
  resolveE2eSupabaseEnv,
} from "./supabase-env";

describe("resolveE2eSupabaseEnv", () => {
  test("uses complete CLI env instead of mixing incomplete file env with local service role", () => {
    const env = resolveE2eSupabaseEnv({
      processEnv: {},
      fileEnv: {
        SUPABASE_URL: "https://cloud.supabase.co",
        SUPABASE_ANON_KEY: "cloud-anon",
      },
      cliEnv: {
        API_URL: "http://127.0.0.1:54321",
        ANON_KEY: "local-anon",
        SERVICE_ROLE_KEY: "local-service-role",
      },
    });

    expect(env).toEqual({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "local-anon",
      SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
    });
  });

  test("uses CLI env together when file env is incomplete", () => {
    const env = resolveE2eSupabaseEnv({
      processEnv: {},
      fileEnv: { SUPABASE_URL: "https://cloud.supabase.co" },
      cliEnv: {
        API_URL: "http://127.0.0.1:54321",
        ANON_KEY: "local-anon",
        SERVICE_ROLE_KEY: "local-service-role",
      },
    });

    expect(env).toEqual({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "local-anon",
      SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
    });
  });

  test("prefers complete CLI env over file env so local E2E stays consistent", () => {
    const env = resolveE2eSupabaseEnv({
      processEnv: {},
      fileEnv: {
        SUPABASE_URL: "https://cloud.supabase.co",
        SUPABASE_ANON_KEY: "cloud-anon",
        SUPABASE_SERVICE_ROLE_KEY: "cloud-service-role",
      },
      cliEnv: {
        API_URL: "http://127.0.0.1:54321",
        ANON_KEY: "local-anon",
        SERVICE_ROLE_KEY: "local-service-role",
      },
    });

    expect(env).toEqual({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "local-anon",
      SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
    });
  });

  test("lets explicit process env override file and CLI env", () => {
    const env = resolveE2eSupabaseEnv({
      processEnv: {
        VITE_SUPABASE_URL: "https://process.supabase.co",
        VITE_SUPABASE_ANON_KEY: "process-anon",
        SUPABASE_SERVICE_ROLE_KEY: "process-service-role",
      },
      fileEnv: {
        SUPABASE_URL: "https://cloud.supabase.co",
        SUPABASE_ANON_KEY: "cloud-anon",
      },
      cliEnv: {
        API_URL: "http://127.0.0.1:54321",
        ANON_KEY: "local-anon",
        SERVICE_ROLE_KEY: "local-service-role",
      },
    });

    expect(env).toEqual({
      SUPABASE_URL: "https://process.supabase.co",
      SUPABASE_ANON_KEY: "process-anon",
      SUPABASE_SERVICE_ROLE_KEY: "process-service-role",
    });
  });
});

describe("resolveE2eApiBaseUrl", () => {
  test("derives API base URL from the selected Supabase URL instead of stale VITE env", () => {
    expect(
      resolveE2eApiBaseUrl(
        {
          SUPABASE_URL: "http://127.0.0.1:54321",
          SUPABASE_ANON_KEY: "local-anon",
          SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
        },
        {
          VITE_API_BASE_URL: "https://cloud.supabase.co/functions/v1",
        },
      ),
    ).toBe("http://127.0.0.1:54321/functions/v1");
  });

  test("allows an explicit E2E API base URL override", () => {
    expect(
      resolveE2eApiBaseUrl(
        {
          SUPABASE_URL: "http://127.0.0.1:54321",
          SUPABASE_ANON_KEY: "local-anon",
        },
        {
          E2E_API_BASE_URL: "http://127.0.0.1:54399/functions/v1",
          VITE_API_BASE_URL: "https://cloud.supabase.co/functions/v1",
        },
      ),
    ).toBe("http://127.0.0.1:54399/functions/v1");
  });
});

describe("loadPlaywrightConfigSupabaseEnv", () => {
  test("uses config-only placeholder env when Playwright only lists specs", () => {
    expect(loadPlaywrightConfigSupabaseEnv(["node", "playwright", "test", "--list"])).toEqual(
      e2eConfigOnlySupabaseEnv,
    );
  });
});
