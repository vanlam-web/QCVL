import { createApp } from "./app.ts";
import { createSupabaseRepositoryFromEnv } from "./repositories/foundation-repository.ts";
import { MemoryRateLimiter } from "./middleware/rate-limit.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
  throw new Error("Supabase Auth environment variables are required.");
}

const version = Deno.env.get("DENO_DEPLOYMENT_ID") ??
  Deno.env.get("VERCEL_GIT_COMMIT_SHA") ??
  Deno.env.get("GIT_SHA") ??
  "local";

const allowedOrigins = (Deno.env.get("QC_OMS_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

Deno.serve(createApp({
  version,
  allowedOrigins,
  auth: {
    async getUser(token) {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
      });

      if (!response.ok) {
        return { user: null };
      }

      const user = await response.json();
      return {
        user: {
          id: user.id,
          email: user.email,
        },
      };
    },
  },
  repository: createSupabaseRepositoryFromEnv(),
  rateLimiter: new MemoryRateLimiter(),
}));
