import type { FoundationRepository } from "../contracts.ts";
import { ApiError, successResponse } from "../http.ts";
import type { AuthClient } from "../middleware/auth.ts";
import { requireAuth } from "../middleware/auth.ts";
import {
  addProductionQueueItemToDraft,
  dismissProductionQueueItem,
  listProductionQueue,
  listProductionQueueHistory,
  restoreProductionQueueItem,
} from "../use-cases/production-queue.ts";

export interface ProductionQueueRouteDependencies {
  auth: AuthClient;
  repository: FoundationRepository;
}

export async function handleProductionQueue(
  request: Request,
  traceId: string,
  dependencies: ProductionQueueRouteDependencies,
): Promise<Response> {
  const authUser = await requireAuth(request, dependencies.auth);
  const currentUser = await dependencies.repository.getCurrentUser({
    userId: authUser.id,
    email: authUser.email,
    workstationId: request.headers.get("x-workstation-id"),
  });
  if (currentUser === null) {
    throw new ApiError({ status: 403, code: "ACCOUNT_INACTIVE", message: "Account is inactive." });
  }
  if (currentUser.workstationInvalid) {
    throw new ApiError({ status: 403, code: "WORKSTATION_INVALID", message: "Workstation is invalid." });
  }

  const context = {
    actorUserId: currentUser.user.id,
    organizationId: currentUser.organization.id,
    permissions: currentUser.permissions,
  };
  const url = new URL(request.url);

  if (url.pathname === "/api/v1/production-queue" && request.method === "GET") {
    return successResponse(await listProductionQueue(dependencies.repository, context, url), traceId);
  }

  if (url.pathname === "/api/v1/production-queue/history" && request.method === "GET") {
    return successResponse(await listProductionQueueHistory(dependencies.repository, context, url), traceId);
  }

  const addToDraftMatch = url.pathname.match(/^\/api\/v1\/production-queue\/([^/]+)\/add-to-draft$/);
  if (addToDraftMatch !== null && request.method === "POST") {
    return successResponse(
      await addProductionQueueItemToDraft(dependencies.repository, context, addToDraftMatch[1]),
      traceId,
    );
  }

  const dismissMatch = url.pathname.match(/^\/api\/v1\/production-queue\/([^/]+)\/dismiss$/);
  if (dismissMatch !== null && request.method === "POST") {
    return successResponse(await dismissProductionQueueItem(dependencies.repository, context, dismissMatch[1]), traceId);
  }

  const restoreMatch = url.pathname.match(/^\/api\/v1\/production-queue\/([^/]+)\/restore$/);
  if (restoreMatch !== null && request.method === "POST") {
    return successResponse(await restoreProductionQueueItem(dependencies.repository, context, restoreMatch[1]), traceId);
  }

  throw new ApiError({
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found.",
  });
}
