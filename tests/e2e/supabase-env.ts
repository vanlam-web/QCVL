import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface E2eSupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export const e2eConfigOnlySupabaseEnv: E2eSupabaseEnv = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "e2e-config-only",
};

interface E2eSupabaseEnvSources {
  processEnv: Record<string, string | undefined>;
  fileEnv: Record<string, string | undefined>;
  cliEnv: Record<string, string | undefined>;
}

export function loadPlaywrightConfigSupabaseEnv(argv: string[] = process.argv): E2eSupabaseEnv {
  if (argv.includes("--list")) return e2eConfigOnlySupabaseEnv;
  return loadE2eSupabaseEnv();
}

export function loadE2eSupabaseEnv(): E2eSupabaseEnv {
  const env = resolveE2eSupabaseEnv({
    processEnv: process.env,
    fileEnv: readEnvFiles(),
    cliEnv: readSupabaseStatusEnv(),
  });

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;

  const missing = Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY })
    .filter(([, value]) => value === undefined || value.length === 0)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase E2E environment: ${missing.join(", ")}. Set the variables or add them to .env.local.`,
    );
  }

  return env;
}

export function resolveE2eSupabaseEnv(sources: E2eSupabaseEnvSources): E2eSupabaseEnv {
  const processEnv = normalizeSource(sources.processEnv);
  const fileEnv = normalizeSource(sources.fileEnv);
  const cliEnv = normalizeSource(sources.cliEnv);

  if (processEnv.SUPABASE_URL !== undefined && processEnv.SUPABASE_ANON_KEY !== undefined) {
    return {
      SUPABASE_URL: processEnv.SUPABASE_URL,
      SUPABASE_ANON_KEY: processEnv.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: processEnv.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  if (isCompleteE2eSource(cliEnv)) {
    return {
      SUPABASE_URL: cliEnv.SUPABASE_URL,
      SUPABASE_ANON_KEY: cliEnv.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: cliEnv.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  if (fileEnv.SUPABASE_URL !== undefined && fileEnv.SUPABASE_ANON_KEY !== undefined) {
    return {
      SUPABASE_URL: fileEnv.SUPABASE_URL,
      SUPABASE_ANON_KEY: fileEnv.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: fileEnv.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  return {
    SUPABASE_URL: cliEnv.SUPABASE_URL ?? "",
    SUPABASE_ANON_KEY: cliEnv.SUPABASE_ANON_KEY ?? "",
    SUPABASE_SERVICE_ROLE_KEY: cliEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function requireE2eServiceRoleKey(env: E2eSupabaseEnv): string {
  if (env.SUPABASE_SERVICE_ROLE_KEY === undefined || env.SUPABASE_SERVICE_ROLE_KEY.length === 0) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. E2E global setup needs it to create the test user on the shared Supabase server.",
    );
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export function resolveE2eApiBaseUrl(
  env: Pick<E2eSupabaseEnv, "SUPABASE_URL">,
  processEnv: Record<string, string | undefined> = process.env,
): string {
  return processEnv.E2E_API_BASE_URL ?? `${env.SUPABASE_URL}/functions/v1`;
}

function readEnvFiles(): Record<string, string> {
  return [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../..", ".env.local"),
    resolve(process.cwd(), "../..", ".env"),
  ].reduce<Record<string, string>>((env, path) => {
    if (!existsSync(path)) return env;
    return { ...env, ...parseEnv(readFileSync(path, "utf8")) };
  }, {});
}

function readSupabaseStatusEnv(): Record<string, string> {
  try {
    return parseEnv(
      execFileSync("npx", ["supabase", "status", "-o", "env"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return {};
  }
}

function normalizeSource(source: Record<string, string | undefined>) {
  return {
    SUPABASE_URL: source.SUPABASE_URL ?? source.VITE_SUPABASE_URL ?? source.API_URL,
    SUPABASE_ANON_KEY: source.SUPABASE_ANON_KEY ?? source.VITE_SUPABASE_ANON_KEY ?? source.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY ?? source.SERVICE_ROLE_KEY,
  };
}

function isCompleteE2eSource(source: ReturnType<typeof normalizeSource>) {
  return (
    source.SUPABASE_URL !== undefined &&
    source.SUPABASE_ANON_KEY !== undefined &&
    source.SUPABASE_SERVICE_ROLE_KEY !== undefined
  );
}

function parseEnv(output: string): Record<string, string> {
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator === -1) return null;
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, "");
        return [key, value] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null),
  );
}
