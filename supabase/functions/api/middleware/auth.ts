import { ApiError } from "../http.ts";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthClient {
  getUser(token: string): Promise<{ user: AuthUser | null }>;
}

export function readBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new ApiError({
      status: 401,
      code: "AUTH_REQUIRED",
      message: "Authentication is required.",
    });
  }

  return match[1];
}

export async function requireAuth(request: Request, auth: AuthClient): Promise<AuthUser> {
  const token = readBearerToken(request);
  const { user } = await auth.getUser(token);

  if (user === null) {
    throw new ApiError({
      status: 401,
      code: "AUTH_REQUIRED",
      message: "Authentication is required.",
    });
  }

  return user;
}
