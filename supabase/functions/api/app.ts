import { ApiError, corsHeaders, createTraceId, errorResponse, preflightResponse } from "./http.ts";
import { routeRequest, type RouterDependencies } from "./routes/router.ts";

export interface AppOptions {
  version: string;
  allowedOrigins?: readonly string[];
  auth?: RouterDependencies["auth"];
  repository?: RouterDependencies["repository"];
  rateLimiter?: RouterDependencies["rateLimiter"];
}

export type AppHandler = (request: Request) => Promise<Response>;

export function createApp(options: AppOptions): AppHandler {
  const allowedOrigins = options.allowedOrigins ?? [];

  return async (request: Request): Promise<Response> => {
    const traceId = createTraceId(request);
    const origin = request.headers.get("origin");
    const headers = corsHeaders({ origin, allowedOrigins });

    if (request.method === "OPTIONS") {
      return preflightResponse(request, allowedOrigins);
    }

    try {
      const response = await routeRequest(request, traceId, {
        version: options.version,
        auth: options.auth,
        repository: options.repository,
        rateLimiter: options.rateLimiter,
      });

      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }

      return response;
    } catch (cause) {
      const error = cause instanceof ApiError
        ? cause
        : new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: "An internal error occurred.",
        });

      if (error.status >= 500) {
        console.error("api_error", {
          trace_id: traceId,
          method: request.method,
          path: new URL(request.url).pathname,
          status: error.status,
          code: error.code,
        });
      }

      return errorResponse(error, traceId, headers);
    }
  };
}
