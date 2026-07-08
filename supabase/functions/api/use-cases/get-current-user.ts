import type { CurrentUserData, CurrentUserDeviceData, CurrentUserProfileData, CurrentUserRecord, FoundationRepository } from "../contracts.ts";
import { ApiError } from "../http.ts";
import type { AuthUser } from "../middleware/auth.ts";

export interface GetCurrentUserOptions {
  authUser: AuthUser;
  workstationId: string | null;
  device: {
    clientDeviceId: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  };
  repository: FoundationRepository;
}

export async function getCurrentUser(options: GetCurrentUserOptions): Promise<CurrentUserData> {
  const record = await options.repository.getCurrentUser({
    userId: options.authUser.id,
    email: options.authUser.email,
    workstationId: options.workstationId,
  });

  if (record === null) {
    throw new ApiError({
      status: 403,
      code: "ACCOUNT_INACTIVE",
      message: "Account is inactive.",
    });
  }

  if (record.workstationInvalid) {
    throw new ApiError({
      status: 409,
      code: "WORKSTATION_INVALID",
      message: "Workstation is invalid.",
    });
  }

  const devices = await options.repository.recordCurrentUserDevice({
    userId: options.authUser.id,
    clientDeviceId: options.device.clientDeviceId,
    userAgent: options.device.userAgent,
    ipAddress: options.device.ipAddress,
  });

  return mapCurrentUser(record, devices);
}

function mapCurrentUser(record: CurrentUserRecord, devices: CurrentUserDeviceData[] = record.devices ?? []): CurrentUserData {
  return {
    user: {
      id: record.user.id,
      email: record.user.email,
      display_name: record.user.displayName,
    },
    profile: record.profile ?? emptyProfile(),
    organization: record.organization,
    workstation: record.workstation,
    devices,
    permissions: [...record.permissions].sort(),
  };
}

export async function updateCurrentUserProfile(options: {
  authUser: AuthUser;
  repository: FoundationRepository;
  body: unknown;
}): Promise<CurrentUserData> {
  const input = parseCurrentUserProfile(options.body);
  const record = await options.repository.updateCurrentUserProfile({
    userId: options.authUser.id,
    authEmail: options.authUser.email,
    displayName: input.displayName,
    profile: input.profile,
  });

  if (record === null) {
    throw new ApiError({
      status: 403,
      code: "ACCOUNT_INACTIVE",
      message: "Account is inactive.",
    });
  }

  return mapCurrentUser(record);
}

export async function signOutCurrentUserDevice(options: {
  authUser: AuthUser;
  repository: FoundationRepository;
  accessToken: string;
  deviceId: string;
  device: {
    clientDeviceId: string | null;
    userAgent: string | null;
    ipAddress: string | null;
  };
}): Promise<CurrentUserDeviceData[]> {
  const devices = await options.repository.signOutCurrentUserDevice({
    userId: options.authUser.id,
    accessToken: options.accessToken,
    deviceId: options.deviceId,
    clientDeviceId: options.device.clientDeviceId,
    userAgent: options.device.userAgent,
    ipAddress: options.device.ipAddress,
  });

  if (devices === null) {
    throw new ApiError({
      status: 404,
      code: "RESOURCE_NOT_FOUND",
      message: "Device was not found.",
    });
  }

  return devices;
}

function parseCurrentUserProfile(body: unknown): { displayName: string; profile: CurrentUserProfileData } {
  if (!isRecord(body)) throw validationError();
  const displayName = parseRequiredText(body.display_name, 100);
  const profile: CurrentUserProfileData = {
    username: parseNullableText(body.username, 100),
    phone: parsePhone(body.phone),
    email: parseEmail(body.email),
    birthday: parseBirthday(body.birthday),
    region: parseNullableText(body.region, 100),
    ward: parseNullableText(body.ward, 100),
    address: parseNullableText(body.address, 255),
    note: parseNullableText(body.note, 500),
  };
  return { displayName, profile };
}

function parseRequiredText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") throw validationError();
  const text = value.trim();
  if (text.length < 1 || text.length > maxLength) throw validationError();
  return text;
}

function parseNullableText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw validationError();
  const text = value.trim();
  if (text.length === 0) return null;
  if (text.length > maxLength) throw validationError();
  return text;
}

function parsePhone(value: unknown): string | null {
  const phone = parseNullableText(value, 20);
  if (phone !== null && !/^[0-9+\s().-]{8,20}$/.test(phone)) throw validationError();
  return phone;
}

function parseEmail(value: unknown): string | null {
  const email = parseNullableText(value, 254)?.toLowerCase() ?? null;
  if (email !== null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw validationError();
  return email;
}

function parseBirthday(value: unknown): string | null {
  const birthday = parseNullableText(value, 10);
  if (birthday !== null && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) throw validationError();
  return birthday;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validationError(): ApiError {
  return new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Invalid request." });
}

function emptyProfile(): CurrentUserProfileData {
  return {
    username: null,
    phone: null,
    email: null,
    birthday: null,
    region: null,
    ward: null,
    address: null,
    note: null,
  };
}
