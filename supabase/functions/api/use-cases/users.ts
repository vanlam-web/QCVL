import type { FoundationRepository, PermissionCode, UserListItem } from "../contracts.ts";
import { ApiError } from "../http.ts";
import type { WorkstationContext } from "./workstations.ts";
import { requireManageUsers } from "./workstations.ts";

const internalStaffDefaultPermissions: PermissionCode[] = [
  "perm.create_order",
  "perm.apply_discount",
  "perm.edit_price_book",
  "perm.manage_inventory",
  "perm.manage_finance",
  "perm.view_shift_report",
];

export function parseListUsers(url: URL): {
  search?: string;
  status?: "active" | "inactive";
  page: number;
  pageSize: number;
} {
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationError();
  }
  if (status !== undefined && status !== "active" && status !== "inactive") {
    throw validationError();
  }
  if (search !== undefined && search.length > 100) {
    throw validationError();
  }

  return { search: search || undefined, status, page, pageSize };
}

export async function listUsers(
  repository: FoundationRepository,
  context: WorkstationContext,
  url: URL,
): Promise<{ items: UserListItem[]; total: number }> {
  requireManageUsers(context);
  return await repository.listUsers({ organizationId: context.organizationId, ...parseListUsers(url) });
}

export async function getUser(
  repository: FoundationRepository,
  context: WorkstationContext,
  userId: string,
): Promise<UserListItem> {
  requireManageUsers(context);
  const row = await repository.getUser({ organizationId: context.organizationId, userId });
  if (row === null) throw notFound();
  return row;
}

export async function createUser(
  repository: FoundationRepository,
  context: WorkstationContext,
  body: unknown,
  traceId: string,
  actorUserId: string,
): Promise<UserListItem> {
  requireManageUsers(context);
  const input = parseCreateUser(body);
  try {
    return await repository.createUser({
      organizationId: context.organizationId,
      actorUserId,
      traceId,
      ...input,
    });
  } catch (cause) {
    throw mapAdminError(cause);
  }
}

export async function updateUser(
  repository: FoundationRepository,
  context: WorkstationContext,
  userId: string,
  body: unknown,
  actorUserId: string,
): Promise<UserListItem> {
  requireManageUsers(context);
  const input = parseUpdateUser(body);
  try {
    const row = await repository.updateUser({
      organizationId: context.organizationId,
      userId,
      actorUserId,
      ...input,
    });
    if (row === null) throw notFound();
    return row;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw mapAdminError(cause);
  }
}

export async function replacePermissions(
  repository: FoundationRepository,
  context: WorkstationContext,
  userId: string,
  body: unknown,
  actorUserId: string,
  traceId: string,
): Promise<UserListItem> {
  requireManageUsers(context);
  const permissions = parsePermissions(body);
  try {
    const row = await repository.replaceUserPermissions({
      organizationId: context.organizationId,
      userId,
      permissions,
      actorUserId,
      traceId,
    });
    if (row === null) throw notFound();
    return row;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw mapAdminError(cause);
  }
}

function parseCreateUser(body: unknown): {
  email: string;
  username: string;
  phone: string | null;
  birthday: string | null;
  region: string | null;
  ward: string | null;
  address: string | null;
  note: string | null;
  password: string;
  displayName: string;
  permissions: PermissionCode[];
} {
  if (!isRecord(body)) throw validationError();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const username = typeof body.username === "string" ? body.username.trim() : email;
  const phone = typeof body.phone === "string" ? nullIfBlank(body.phone) : null;
  const birthday = parseBirthday(body.birthday);
  const region = parseNullableText(body.region, 100);
  const ward = parseNullableText(body.ward, 100);
  const address = parseNullableText(body.address, 255);
  const note = parseNullableText(body.note, 500);
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  const permissions = "permissions" in body
    ? parsePermissionArray(body.permissions)
    : [...internalStaffDefaultPermissions];
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    username.length < 1 ||
    username.length > 100 ||
    (phone !== null && !/^[0-9+\s().-]{8,20}$/.test(phone)) ||
    password.length < 8 ||
    password.length > 128 ||
    displayName.length < 1 ||
    displayName.length > 100
  ) {
    throw validationError();
  }
  return { email, username, phone, birthday, region, ward, address, note, password, displayName, permissions };
}

function parseUpdateUser(body: unknown): { displayName?: string; status?: "active" | "inactive" } {
  if (!isRecord(body)) throw validationError();
  const output: { displayName?: string; status?: "active" | "inactive" } = {};
  if ("display_name" in body) {
    if (typeof body.display_name !== "string") throw validationError();
    const displayName = body.display_name.trim();
    if (displayName.length < 1 || displayName.length > 100) throw validationError();
    output.displayName = displayName;
  }
  if ("status" in body) {
    if (body.status !== "active" && body.status !== "inactive") throw validationError();
    output.status = body.status;
  }
  if (Object.keys(output).length === 0) throw validationError();
  return output;
}

function parsePermissions(body: unknown): PermissionCode[] {
  if (!isRecord(body)) throw validationError();
  return parsePermissionArray(body.permissions);
}

function parsePermissionArray(value: unknown): PermissionCode[] {
  if (!Array.isArray(value) || value.length > 100) throw validationError();
  const permissions = [...new Set(value)];
  if (!permissions.every((code) => typeof code === "string" && /^perm\.[a-z0-9_]+$/.test(code))) {
    throw validationError();
  }
  return permissions as PermissionCode[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseNullableText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw validationError();
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) throw validationError();
  return trimmed;
}

function parseBirthday(value: unknown): string | null {
  const birthday = parseNullableText(value, 10);
  if (birthday !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) throw validationError();
  return birthday;
}

function validationError(): ApiError {
  return new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Invalid request." });
}

function notFound(): ApiError {
  return new ApiError({
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found.",
  });
}

function mapAdminError(cause: unknown): ApiError {
  if (isRecord(cause) && (cause.code === "23505" || cause.message === "LAST_ADMIN_REQUIRED")) {
    return new ApiError({ status: 409, code: "RESOURCE_CONFLICT", message: "Resource conflict." });
  }
  if (isRecord(cause) && cause.message === "INVALID_PERMISSION") {
    return validationError();
  }
  return new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "An internal error occurred." });
}
