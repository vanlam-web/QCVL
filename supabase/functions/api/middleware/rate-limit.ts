import { ApiError } from "../http.ts";

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): boolean;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (bucket === undefined || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (bucket.count >= limit) {
      return false;
    }

    bucket.count += 1;
    return true;
  }
}

export function enforceRateLimit(
  limiter: RateLimiter | undefined,
  userId: string,
  group: "read" | "write",
): void {
  if (limiter === undefined) {
    return;
  }

  const limit = group === "read" ? 30 : 10;
  if (!limiter.check(`${userId}:${group}`, limit, 60_000)) {
    throw new ApiError({
      status: 429,
      code: "RATE_LIMITED",
      message: "Rate limit exceeded.",
    });
  }
}
