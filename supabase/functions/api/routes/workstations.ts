import type { FoundationRepository } from "../contracts.ts";
import { ApiError, successResponse } from "../http.ts";
import type { AuthClient } from "../middleware/auth.ts";
import { requireAuth } from "../middleware/auth.ts";
import {
  createWorkstation,
  listWorkstations,
  updateWorkstation,
} from "../use-cases/workstations.ts";

export interface WorkstationRouteDependencies {
  auth: AuthClient;
  repository: FoundationRepository;
}

export async function handleWorkstations(
  request: Request,
  traceId: string,
  dependencies: WorkstationRouteDependencies,
): Promise<Response> {
  const authUser = await requireAuth(request, dependencies.auth);
  const currentUser = await dependencies.repository.getCurrentUser({
    userId: authUser.id,
    email: authUser.email,
    workstationId: null,
  });

  if (currentUser === null) {
    throw new ApiError({
      status: 403,
      code: "ACCOUNT_INACTIVE",
      message: "Account is inactive.",
    });
  }

  const context = {
    organizationId: currentUser.organization.id,
    permissions: currentUser.permissions,
  };
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/v1\/workstations(?:\/([^/]+))?$/);
  const id = match?.[1];

  if (request.method === "GET" && id === undefined) {
    return successResponse(await listWorkstations(dependencies.repository, context), traceId);
  }

  if (request.method === "POST" && id === undefined) {
    return successResponse(
      await createWorkstation(dependencies.repository, context, await request.json()),
      traceId,
      { status: 201 },
    );
  }

  if (request.method === "PATCH" && id !== undefined) {
    return successResponse(
      await updateWorkstation(dependencies.repository, context, id, await request.json()),
      traceId,
    );
  }

  throw new ApiError({
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found.",
  });
}
