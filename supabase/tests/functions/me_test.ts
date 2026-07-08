import { createApp } from "../../functions/api/app.ts";
import type { CurrentUserProfileData, CurrentUserRecord, FoundationRepository } from "../../functions/api/contracts.ts";
import type { AuthClient } from "../../functions/api/middleware/auth.ts";

const userId = "50000000-0000-4000-8000-000000000001";
const organizationId = "50000000-0000-4000-8000-000000000101";
const workstationId = "50000000-0000-4000-8000-000000000201";

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function createAuthClient(): AuthClient {
  return {
    getUser(token: string) {
      if (token !== "valid-token") {
        return Promise.resolve({ user: null });
      }

      return Promise.resolve({
        user: {
          id: userId,
          email: "cashier@example.test",
        },
      });
    },
  };
}

function createRepository(record: CurrentUserRecord | null): FoundationRepository {
  return {
    getCurrentUser(input: Parameters<FoundationRepository["getCurrentUser"]>[0]) {
      assertEquals(input.userId, userId);
      return Promise.resolve(record);
    },
    listWorkstations: () => Promise.resolve([]),
    createWorkstation: () => {
      throw new Error("not implemented");
    },
    updateWorkstation: () => {
      throw new Error("not implemented");
    },
    listUsers: () => Promise.resolve({ items: [], total: 0 }),
    getUser: () => Promise.resolve(null),
    createUser: () => {
      throw new Error("not implemented");
    },
    updateUser: () => Promise.resolve(null),
    replaceUserPermissions: () => Promise.resolve(null),
    updateCurrentUserProfile: () => {
      throw new Error("not implemented");
    },
    recordCurrentUserDevice: () => Promise.resolve(record?.devices ?? []),
    signOutCurrentUserDevice: () => Promise.resolve(record?.devices ?? []),
    listPermissions: () => Promise.resolve([]),
  } as unknown as FoundationRepository;
}

const profile: CurrentUserProfileData = {
  username: "cashier",
  phone: "0947900909",
  email: "cashier-contact@example.test",
  birthday: "1990-01-31",
  region: "TP Hồ Chí Minh",
  ward: "Phường Bến Nghé",
  address: "1 Lê Lợi",
  note: "Ca sáng",
};

function activeRecord(overrides: Partial<CurrentUserRecord> = {}): CurrentUserRecord {
  return {
    user: {
      id: userId,
      email: "cashier@example.test",
      displayName: "Cashier",
    },
    profile,
    organization: {
      id: organizationId,
      code: "VAN-LAM",
      name: "Xưởng Văn Lâm",
    },
    workstation: {
      id: workstationId,
      code: "POS-01",
      name: "Quầy thu ngân 1",
    },
    permissions: ["perm.create_order", "perm.view_shift_report"],
    devices: [
      {
        id: "device-1",
        device_name: "Mac OS",
        device_type: "desktop",
        browser_name: "Chrome",
        os_name: "macOS",
        ip_address: "203.0.113.10",
        last_seen_at: "2026-07-06T14:00:00Z",
        created_at: "2026-07-06T13:00:00Z",
        is_current_device: true,
        status: "active",
      },
    ],
    workstationInvalid: false,
    ...overrides,
  };
}

Deno.test("GET /api/v1/me returns profile, organization, devices, permissions and optional workstation", async () => {
  let recorded: Parameters<FoundationRepository["recordCurrentUserDevice"]>[0] | null = null;
  const response = await createApp({
    version: "test-sha",
    auth: createAuthClient(),
    repository: {
      ...createRepository(activeRecord()),
      recordCurrentUserDevice(input: Parameters<FoundationRepository["recordCurrentUserDevice"]>[0]) {
        recorded = input;
        return Promise.resolve(activeRecord().devices);
      },
    } as unknown as FoundationRepository,
  })(
    new Request("http://local/api/v1/me", {
      headers: {
        authorization: "Bearer valid-token",
        "x-request-id": "trace-me-success",
        "x-workstation-id": workstationId,
        "x-client-device-id": "browser-device-1",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(recorded, {
    userId,
    clientDeviceId: "browser-device-1",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36",
    ipAddress: "203.0.113.10",
  });
  assertEquals(body, {
    success: true,
    data: {
      user: {
        id: userId,
        email: "cashier@example.test",
        display_name: "Cashier",
      },
      profile,
      organization: {
        id: organizationId,
        code: "VAN-LAM",
        name: "Xưởng Văn Lâm",
      },
      workstation: {
        id: workstationId,
        code: "POS-01",
        name: "Quầy thu ngân 1",
      },
      devices: activeRecord().devices,
      permissions: ["perm.create_order", "perm.view_shift_report"],
    },
    trace_id: "trace-me-success",
  });
});

Deno.test("PATCH /api/v1/me/devices/:id/sign-out marks another device signed out", async () => {
  let signedOut: Parameters<FoundationRepository["signOutCurrentUserDevice"]>[0] | null = null;
  const devices = activeRecord().devices ?? [];
  const response = await createApp({
    version: "test-sha",
    auth: createAuthClient(),
    repository: {
      ...createRepository(activeRecord()),
      signOutCurrentUserDevice(input: Parameters<FoundationRepository["signOutCurrentUserDevice"]>[0]) {
        signedOut = input;
        return Promise.resolve(devices.filter((device) => device.id !== input.deviceId));
      },
    } as unknown as FoundationRepository,
  })(
    new Request("http://local/api/v1/me/devices/device-2/sign-out", {
      method: "PATCH",
      headers: {
        authorization: "Bearer valid-token",
        "x-request-id": "trace-me-device-sign-out",
        "x-client-device-id": "browser-device-1",
        "user-agent": "Mozilla/5.0 Chrome/126.0.0.0",
        "x-forwarded-for": "203.0.113.10",
      },
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(signedOut, {
    userId,
    accessToken: "valid-token",
    deviceId: "device-2",
    clientDeviceId: "browser-device-1",
    userAgent: "Mozilla/5.0 Chrome/126.0.0.0",
    ipAddress: "203.0.113.10",
  });
  assertEquals(body.data, devices.filter((device) => device.id !== "device-2"));
});

Deno.test("PATCH /api/v1/me/profile stores the signed-in user's editable profile", async () => {
  let saved: Parameters<FoundationRepository["updateCurrentUserProfile"]>[0] | null = null;
  const response = await createApp({
    version: "test-sha",
    auth: createAuthClient(),
    repository: {
      ...createRepository(activeRecord()),
      updateCurrentUserProfile(input: Parameters<FoundationRepository["updateCurrentUserProfile"]>[0]) {
        saved = input;
        return Promise.resolve({
          ...activeRecord(),
          user: { ...activeRecord().user, displayName: input.displayName },
          profile: input.profile,
        });
      },
    } as unknown as FoundationRepository,
  })(
    new Request("http://local/api/v1/me/profile", {
      method: "PATCH",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
        "x-request-id": "trace-me-profile",
      },
      body: JSON.stringify({
        display_name: "Cashier Updated",
        username: "cashier-updated",
        phone: " 0947 900 909 ",
        email: " Contact@Example.Test ",
        birthday: "1991-02-03",
        region: "TP Hồ Chí Minh",
        ward: "Phường Bến Nghé",
        address: "2 Lê Lợi",
        note: "Ghi chú mới",
      }),
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(saved, {
    userId,
    authEmail: "cashier@example.test",
    displayName: "Cashier Updated",
    profile: {
      username: "cashier-updated",
      phone: "0947 900 909",
      email: "contact@example.test",
      birthday: "1991-02-03",
      region: "TP Hồ Chí Minh",
      ward: "Phường Bến Nghé",
      address: "2 Lê Lợi",
      note: "Ghi chú mới",
    },
  });
  assertEquals(body.data.user.display_name, "Cashier Updated");
  assertEquals(body.data.profile.email, "contact@example.test");
});

Deno.test("PATCH /api/v1/me/profile rejects invalid profile input", async () => {
  const response = await createApp({
    version: "test-sha",
    auth: createAuthClient(),
    repository: createRepository(activeRecord()),
  })(
    new Request("http://local/api/v1/me/profile", {
      method: "PATCH",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
        "x-request-id": "trace-me-profile-invalid",
      },
      body: JSON.stringify({ display_name: "", phone: "abc", birthday: "bad-date" }),
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 400);
  assertEquals(body.error.code, "VALIDATION_ERROR");
});

Deno.test("GET /api/v1/me rejects a missing bearer token with AUTH_REQUIRED", async () => {
  const response = await createApp({
    version: "test-sha",
    auth: createAuthClient(),
    repository: createRepository(activeRecord()),
  })(
    new Request("http://local/api/v1/me", {
      headers: { "x-request-id": "trace-missing-auth" },
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 401);
  assertEquals(body, {
    success: false,
    error: {
      code: "AUTH_REQUIRED",
      message: "Authentication is required.",
    },
    trace_id: "trace-missing-auth",
  });
});

Deno.test("GET /api/v1/me rejects an inactive profile with ACCOUNT_INACTIVE", async () => {
  const response = await createApp({
    version: "test-sha",
    auth: createAuthClient(),
    repository: createRepository(null),
  })(
    new Request("http://local/api/v1/me", {
      headers: {
        authorization: "Bearer valid-token",
        "x-request-id": "trace-inactive",
      },
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 403);
  assertEquals(body, {
    success: false,
    error: {
      code: "ACCOUNT_INACTIVE",
      message: "Account is inactive.",
    },
    trace_id: "trace-inactive",
  });
});

Deno.test("GET /api/v1/me rejects a cross-organization workstation with WORKSTATION_INVALID", async () => {
  const response = await createApp({
    version: "test-sha",
    auth: createAuthClient(),
    repository: createRepository(activeRecord({ workstation: null, workstationInvalid: true })),
  })(
    new Request("http://local/api/v1/me", {
      headers: {
        authorization: "Bearer valid-token",
        "x-request-id": "trace-bad-workstation",
        "x-workstation-id": "60000000-0000-4000-8000-000000000201",
      },
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 409);
  assertEquals(body, {
    success: false,
    error: {
      code: "WORKSTATION_INVALID",
      message: "Workstation is invalid.",
    },
    trace_id: "trace-bad-workstation",
  });
});
