import type { FoundationRepository } from "../contracts.ts";
import { successResponse } from "../http.ts";

export async function handlePermissions(
  repository: FoundationRepository,
  traceId: string,
): Promise<Response> {
  return successResponse(await repository.listPermissions(), traceId);
}
