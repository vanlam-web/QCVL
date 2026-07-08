import { createApp } from "../../functions/api/app.ts";
import type {
  CurrentUserRecord,
  FoundationRepository,
  PermissionCode,
} from "../../functions/api/contracts.ts";
import type { AuthClient } from "../../functions/api/middleware/auth.ts";

const userId = "70000000-0000-4000-8000-000000000001";
const organizationId = "70000000-0000-4000-8000-000000000101";

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function auth(): AuthClient {
  return {
    getUser: () => Promise.resolve({ user: { id: userId, email: "admin@example.test" } }),
  };
}

function currentUser(permissions: PermissionCode[] = ["perm.manage_users"]): CurrentUserRecord {
  return {
    user: { id: userId, email: "admin@example.test", displayName: "Admin" },
    organization: { id: organizationId, code: "VAN-LAM", name: "Xưởng Văn Lâm" },
    workstation: null,
    permissions: [...permissions],
    workstationInvalid: false,
  };
}

function repo(overrides: Partial<FoundationRepository> = {}): FoundationRepository {
  return {
    getCurrentUser: () => Promise.resolve(currentUser()),
    listWorkstations: () =>
      Promise.resolve([
        { id: "w-1", code: "POS-01", name: "Quầy 1", status: "active" },
        { id: "w-2", code: "POS-02", name: "Quầy 2", status: "active" },
      ]),
    createWorkstation: (input: Parameters<FoundationRepository["createWorkstation"]>[0]) =>
      Promise.resolve({ id: "w-new", code: input.code, name: input.name, status: "active" }),
    updateWorkstation: (input: Parameters<FoundationRepository["updateWorkstation"]>[0]) =>
      input.id === "other-org"
        ? Promise.resolve(null)
        : Promise.resolve({
          id: input.id,
          code: input.code ?? "POS-01",
          name: input.name ?? "Quầy 1",
          status: input.status ?? "active",
        }),
    listUsers: () => Promise.resolve({ items: [], total: 0 }),
    getUser: () => Promise.resolve(null),
    createUser: () => {
      throw new Error("not implemented");
    },
    updateUser: () => Promise.resolve(null),
    replaceUserPermissions: () => Promise.resolve(null),
    listPermissions: () => Promise.resolve([]),
    ...overrides,
  } as unknown as FoundationRepository;
}

async function json(response: Response): Promise<unknown> {
  return await response.json();
}

Deno.test("GET /api/v1/workstations returns active same-org rows sorted by code", async () => {
  const response = await createApp({ version: "test", auth: auth(), repository: repo() })(
    new Request("http://local/api/v1/workstations", {
      headers: { authorization: "Bearer token", "x-request-id": "trace-list" },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await json(response), {
    success: true,
    data: [
      { id: "w-1", code: "POS-01", name: "Quầy 1", status: "active" },
      { id: "w-2", code: "POS-02", name: "Quầy 2", status: "active" },
    ],
    trace_id: "trace-list",
  });
});

Deno.test("POST /api/v1/workstations requires manage_users and normalizes code", async () => {
  const response = await createApp({ version: "test", auth: auth(), repository: repo() })(
    new Request("http://local/api/v1/workstations", {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
        "x-request-id": "trace-create",
      },
      body: JSON.stringify({ code: " pos-03 ", name: " Quầy 3 " }),
    }),
  );

  assertEquals(response.status, 201);
  assertEquals(await json(response), {
    success: true,
    data: { id: "w-new", code: "POS-03", name: "Quầy 3", status: "active" },
    trace_id: "trace-create",
  });
});

Deno.test("PATCH /api/v1/workstations/{id} returns not found for another organization", async () => {
  const response = await createApp({ version: "test", auth: auth(), repository: repo() })(
    new Request("http://local/api/v1/workstations/other-org", {
      method: "PATCH",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
        "x-request-id": "trace-not-found",
      },
      body: JSON.stringify({ name: "New" }),
    }),
  );

  assertEquals(response.status, 404);
  assertEquals(await json(response), {
    success: false,
    error: { code: "RESOURCE_NOT_FOUND", message: "The requested resource was not found." },
    trace_id: "trace-not-found",
  });
});

Deno.test("duplicate code maps to RESOURCE_CONFLICT", async () => {
  const response = await createApp({
    version: "test",
    auth: auth(),
    repository: repo({
      createWorkstation: () => Promise.reject({ code: "23505" }),
    }),
  })(
    new Request("http://local/api/v1/workstations", {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
        "x-request-id": "trace-duplicate",
      },
      body: JSON.stringify({ code: "POS-01", name: "Quầy duplicate" }),
    }),
  );

  assertEquals(response.status, 409);
  assertEquals(await json(response), {
    success: false,
    error: { code: "RESOURCE_CONFLICT", message: "Resource conflict." },
    trace_id: "trace-duplicate",
  });
});

Deno.test("invalid status returns VALIDATION_ERROR", async () => {
  const response = await createApp({ version: "test", auth: auth(), repository: repo() })(
    new Request("http://local/api/v1/workstations/w-1", {
      method: "PATCH",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
        "x-request-id": "trace-invalid",
      },
      body: JSON.stringify({ status: "retired" }),
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(await json(response), {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Invalid request." },
    trace_id: "trace-invalid",
  });
});

Deno.test("missing manage_users returns PERMISSION_DENIED", async () => {
  const response = await createApp({
    version: "test",
    auth: auth(),
    repository: repo({
      getCurrentUser: () => Promise.resolve(currentUser(["perm.create_order"])),
    }),
  })(
    new Request("http://local/api/v1/workstations", {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
        "x-request-id": "trace-denied",
      },
      body: JSON.stringify({ code: "POS-04", name: "Quầy 4" }),
    }),
  );

  assertEquals(response.status, 403);
  assertEquals(await json(response), {
    success: false,
    error: { code: "PERMISSION_DENIED", message: "Permission denied." },
    trace_id: "trace-denied",
  });
});
