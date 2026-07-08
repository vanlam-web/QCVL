import type { FoundationRepository } from "../contracts.ts";
import { ApiError, successResponse } from "../http.ts";
import type { AuthClient } from "../middleware/auth.ts";
import { requireAuth } from "../middleware/auth.ts";
import { enforceRateLimit, type RateLimiter } from "../middleware/rate-limit.ts";
import {
  createUser,
  getUser,
  listUsers,
  replacePermissions,
  updateUser,
} from "../use-cases/users.ts";

export interface UserRouteDependencies {
  auth: AuthClient;
  repository: FoundationRepository;
  rateLimiter?: RateLimiter;
}

export async function handleUsers(
  request: Request,
  traceId: string,
  dependencies: UserRouteDependencies,
): Promise<Response> {
  const authUser = await requireAuth(request, dependencies.auth);
  const currentUser = await dependencies.repository.getCurrentUser({
    userId: authUser.id,
    email: authUser.email,
    workstationId: null,
  });
  if (currentUser === null) {
    throw new ApiError({ status: 403, code: "ACCOUNT_INACTIVE", message: "Account is inactive." });
  }

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/v1\/users(?:\/([^/]+)(?:\/permissions)?)?$/);
  const id = match?.[1];
  const isPermissionsRoute = url.pathname.endsWith("/permissions");
  const context = { organizationId: currentUser.organization.id, permissions: currentUser.permissions };
  const read = request.method === "GET";
  enforceRateLimit(dependencies.rateLimiter, authUser.id, read ? "read" : "write");

  if (request.method === "GET" && id === undefined) {
    return successResponse(await listUsers(dependencies.repository, context, url), traceId);
  }
  if (request.method === "GET" && id !== undefined && !isPermissionsRoute) {
    return successResponse(await getUser(dependencies.repository, context, id), traceId);
  }
  if (request.method === "POST" && id === undefined) {
    return successResponse(
      await createUser(dependencies.repository, context, await request.json(), traceId, authUser.id),
      traceId,
      { status: 201 },
    );
  }
  if (request.method === "PATCH" && id !== undefined && !isPermissionsRoute) {
    return successResponse(
      await updateUser(dependencies.repository, context, id, await request.json(), authUser.id),
      traceId,
    );
  }
  if (request.method === "PUT" && id !== undefined && isPermissionsRoute) {
    return successResponse(
      await replacePermissions(
        dependencies.repository,
        context,
        id,
        await request.json(),
        authUser.id,
        traceId,
      ),
      traceId,
    );
  }

  throw new ApiError({
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found.",
  });
}
