import type { FoundationRepository } from "../contracts.ts";
import { ApiError, successResponse } from "../http.ts";
import type { AuthClient } from "../middleware/auth.ts";
import { requireAuth } from "../middleware/auth.ts";
import { getSalesDocument, listSalesDocuments } from "../use-cases/sales-documents.ts";

export interface SalesDocumentsRouteDependencies {
  auth: AuthClient;
  repository: FoundationRepository;
}

export async function handleSalesDocuments(
  request: Request,
  traceId: string,
  dependencies: SalesDocumentsRouteDependencies,
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

  if (url.pathname === "/api/v1/sales-documents" && request.method === "GET") {
    return successResponse(await listSalesDocuments(dependencies.repository, context, url), traceId);
  }

  const detailMatch = url.pathname.match(/^\/api\/v1\/sales-documents\/([^/]+)$/);
  if (detailMatch !== null && request.method === "GET") {
    return successResponse(await getSalesDocument(dependencies.repository, context, detailMatch[1]), traceId);
  }

  throw new ApiError({
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found.",
  });
}
