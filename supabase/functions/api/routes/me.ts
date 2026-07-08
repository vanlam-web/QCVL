import type { FoundationRepository } from "../contracts.ts";
import type { AuthClient } from "../middleware/auth.ts";
import { readBearerToken, requireAuth } from "../middleware/auth.ts";
import { successResponse } from "../http.ts";
import { getCurrentUser, signOutCurrentUserDevice, updateCurrentUserProfile } from "../use-cases/get-current-user.ts";

export interface MeRouteDependencies {
  auth: AuthClient;
  repository: FoundationRepository;
}

export async function handleMe(
  request: Request,
  traceId: string,
  dependencies: MeRouteDependencies,
): Promise<Response> {
  const authUser = await requireAuth(request, dependencies.auth);
  const url = new URL(request.url);

  if (request.method === "PATCH" && url.pathname === "/api/v1/me/profile") {
    const data = await updateCurrentUserProfile({
      authUser,
      repository: dependencies.repository,
      body: await request.json(),
    });
    return successResponse(data, traceId);
  }

  const signOutMatch = url.pathname.match(/^\/api\/v1\/me\/devices\/([^/]+)\/sign-out$/);
  if (request.method === "PATCH" && signOutMatch !== null) {
    const data = await signOutCurrentUserDevice({
      authUser,
      repository: dependencies.repository,
      accessToken: readBearerToken(request),
      deviceId: decodeURIComponent(signOutMatch[1]),
      device: requestDevice(request),
    });
    return successResponse(data, traceId);
  }

  const workstationId = request.headers.get("x-workstation-id");
  const data = await getCurrentUser({
    authUser,
    workstationId,
    device: requestDevice(request),
    repository: dependencies.repository,
  });

  return successResponse(data, traceId);
}

function requestDevice(request: Request) {
  return {
    clientDeviceId: request.headers.get("x-client-device-id"),
    userAgent: request.headers.get("user-agent"),
    ipAddress: request.headers.get("cf-connecting-ip") ?? firstForwardedIp(request.headers.get("x-forwarded-for")),
  };
}

function firstForwardedIp(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}
