import { ApiError, successResponse } from "../http.ts";
import { handleMe } from "./me.ts";
import { handleWorkstations } from "./workstations.ts";
import { handlePermissions } from "./permissions.ts";
import { handleUsers } from "./users.ts";
import { handleCatalog } from "./catalog.ts";
import { handleOrders } from "./orders.ts";
import { handleSalesDocuments } from "./sales-documents.ts";
import { handleFinance } from "./finance.ts";
import { handleInventory } from "./inventory.ts";
import { handleProductionQueue } from "./production-queue.ts";
import { handlePurchase } from "./purchase.ts";
import type { AuthClient } from "../middleware/auth.ts";
import type { FoundationRepository } from "../contracts.ts";
import type { RateLimiter } from "../middleware/rate-limit.ts";

export interface RouterOptions {
  version: string;
  auth?: AuthClient;
  repository?: FoundationRepository;
  rateLimiter?: RateLimiter;
}

export interface RouterDependencies {
  auth: AuthClient;
  repository: FoundationRepository;
  rateLimiter?: RateLimiter;
}

export function routeRequest(
  request: Request,
  traceId: string,
  options: RouterOptions,
): Response | Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/v1/health") {
    return successResponse(
      {
        status: "ok",
        service: "qc-oms-api",
        version: options.version,
      },
      traceId,
    );
  }

  if (
    (request.method === "GET" && url.pathname === "/api/v1/me") ||
    (request.method === "PATCH" && url.pathname === "/api/v1/me/profile") ||
    (request.method === "PATCH" && /^\/api\/v1\/me\/devices\/[^/]+\/sign-out$/.test(url.pathname))
  ) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }

    return handleMe(request, traceId, {
      auth: options.auth,
      repository: options.repository,
    });
  }

  if (url.pathname === "/api/v1/workstations" || url.pathname.startsWith("/api/v1/workstations/")) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }

    return handleWorkstations(request, traceId, {
      auth: options.auth,
      repository: options.repository,
    });
  }

  if (url.pathname === "/api/v1/permissions") {
    if (options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }
    return handlePermissions(options.repository, traceId);
  }

  if (url.pathname === "/api/v1/users" || url.pathname.startsWith("/api/v1/users/")) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }
    return handleUsers(request, traceId, {
      auth: options.auth,
      repository: options.repository,
      rateLimiter: options.rateLimiter,
    });
  }

  if (
    url.pathname === "/api/v1/products" ||
    url.pathname.startsWith("/api/v1/products/") ||
    url.pathname === "/api/v1/customers" ||
    url.pathname.startsWith("/api/v1/customers/") ||
    url.pathname === "/api/v1/customer-groups" ||
    url.pathname.startsWith("/api/v1/customer-groups/") ||
    url.pathname === "/api/v1/product-groups" ||
    url.pathname.startsWith("/api/v1/product-groups/") ||
    url.pathname === "/api/v1/price-lists" ||
    url.pathname.startsWith("/api/v1/price-lists/") ||
    url.pathname === "/api/v1/pricing/resolve"
  ) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }

    return handleCatalog(request, traceId, {
      auth: options.auth,
      repository: options.repository,
    });
  }

  if (url.pathname === "/api/v1/orders/checkout" || url.pathname.startsWith("/api/v1/orders/")) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }

    return handleOrders(request, traceId, {
      auth: options.auth,
      repository: options.repository,
    });
  }

  if (url.pathname === "/api/v1/sales-documents" || url.pathname.startsWith("/api/v1/sales-documents/")) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }

    return handleSalesDocuments(request, traceId, {
      auth: options.auth,
      repository: options.repository,
    });
  }

  if (url.pathname === "/api/v1/finance" || url.pathname.startsWith("/api/v1/finance/")) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }

    return handleFinance(request, traceId, {
      auth: options.auth,
      repository: options.repository,
    });
  }

  if (url.pathname === "/api/v1/inventory" || url.pathname.startsWith("/api/v1/inventory/")) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }

    return handleInventory(request, traceId, {
      auth: options.auth,
      repository: options.repository,
    });
  }

  if (
    url.pathname === "/api/v1/suppliers" ||
    url.pathname.startsWith("/api/v1/suppliers/") ||
    url.pathname === "/api/v1/purchase/receipts" ||
    url.pathname.startsWith("/api/v1/purchase/receipts/")
  ) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }

    return handlePurchase(request, traceId, {
      auth: options.auth,
      repository: options.repository,
    });
  }

  if (url.pathname === "/api/v1/production-queue" || url.pathname.startsWith("/api/v1/production-queue/")) {
    if (options.auth === undefined || options.repository === undefined) {
      throw new ApiError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
      });
    }

    return handleProductionQueue(request, traceId, {
      auth: options.auth,
      repository: options.repository,
    });
  }

  throw new ApiError({
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found.",
  });
}
