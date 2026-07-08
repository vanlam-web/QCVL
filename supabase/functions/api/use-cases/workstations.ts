import type { FoundationRepository, PermissionCode, WorkstationData } from "../contracts.ts";
import { ApiError } from "../http.ts";

export interface WorkstationContext {
  organizationId: string;
  permissions: readonly PermissionCode[];
}

export function requireManageUsers(context: WorkstationContext): void {
  if (!context.permissions.includes("perm.manage_users")) {
    throw new ApiError({
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Permission denied.",
    });
  }
}

export async function listWorkstations(
  repository: FoundationRepository,
  context: WorkstationContext,
): Promise<WorkstationData[]> {
  const rows = await repository.listWorkstations(context.organizationId);
  return [...rows].sort((a, b) => a.code.localeCompare(b.code));
}

export async function createWorkstation(
  repository: FoundationRepository,
  context: WorkstationContext,
  body: unknown,
): Promise<WorkstationData> {
  requireManageUsers(context);
  const input = parseCreateInput(body);

  try {
    return await repository.createWorkstation({
      organizationId: context.organizationId,
      ...input,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function updateWorkstation(
  repository: FoundationRepository,
  context: WorkstationContext,
  id: string,
  body: unknown,
): Promise<WorkstationData> {
  requireManageUsers(context);
  const input = parseUpdateInput(body);

  try {
    const row = await repository.updateWorkstation({
      organizationId: context.organizationId,
      id,
      ...input,
    });

    if (row === null) {
      throw new ApiError({
        status: 404,
        code: "RESOURCE_NOT_FOUND",
        message: "The requested resource was not found.",
      });
    }

    return row;
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw cause;
    }

    throw mapRepositoryError(cause);
  }
}

function parseCreateInput(body: unknown): { code: string; name: string } {
  if (!isRecord(body)) {
    throw validationError();
  }

  const code = normalizeCode(body.code);
  const name = normalizeName(body.name);

  if (Object.keys(body).some((key) => !["code", "name"].includes(key))) {
    throw validationError();
  }

  return { code, name };
}

function parseUpdateInput(
  body: unknown,
): { code?: string; name?: string; status?: "active" | "inactive" } {
  if (!isRecord(body)) {
    throw validationError();
  }

  if (Object.keys(body).some((key) => !["code", "name", "status"].includes(key))) {
    throw validationError();
  }

  const input: { code?: string; name?: string; status?: "active" | "inactive" } = {};

  if ("code" in body) {
    input.code = normalizeCode(body.code);
  }

  if ("name" in body) {
    input.name = normalizeName(body.name);
  }

  if ("status" in body) {
    if (body.status !== "active" && body.status !== "inactive") {
      throw validationError();
    }

    input.status = body.status;
  }

  if (Object.keys(input).length === 0) {
    throw validationError();
  }

  return input;
}

function normalizeCode(value: unknown): string {
  if (typeof value !== "string") {
    throw validationError();
  }

  const code = value.trim().toUpperCase();
  if (code.length < 1 || code.length > 30 || !/^[A-Z0-9-]+$/.test(code)) {
    throw validationError();
  }

  return code;
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") {
    throw validationError();
  }

  const name = value.trim();
  if (name.length < 1 || name.length > 100) {
    throw validationError();
  }

  return name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validationError(): ApiError {
  return new ApiError({
    status: 400,
    code: "VALIDATION_ERROR",
    message: "Invalid request.",
  });
}

function mapRepositoryError(cause: unknown): ApiError {
  if (isRecord(cause) && cause.code === "23505") {
    return new ApiError({
      status: 409,
      code: "RESOURCE_CONFLICT",
      message: "Resource conflict.",
    });
  }

  return new ApiError({
    status: 500,
    code: "INTERNAL_ERROR",
    message: "An internal error occurred.",
  });
}
