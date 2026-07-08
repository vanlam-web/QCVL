import { createApp } from "../../functions/api/app.ts";
import type {
  CurrentUserRecord,
  FoundationRepository,
  PermissionCode,
  UserListItem,
} from "../../functions/api/contracts.ts";
import type { AuthClient } from "../../functions/api/middleware/auth.ts";
import { MemoryRateLimiter } from "../../functions/api/middleware/rate-limit.ts";

const actorId = "80000000-0000-4000-8000-000000000001";
const organizationId = "80000000-0000-4000-8000-000000000101";

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function auth(): AuthClient {
  return { getUser: () => Promise.resolve({ user: { id: actorId, email: "admin@example.test" } }) };
}

function currentUser(permissions: PermissionCode[] = ["perm.manage_users"]): CurrentUserRecord {
  return {
    user: { id: actorId, email: "admin@example.test", displayName: "Admin" },
    organization: { id: organizationId, code: "VAN-LAM", name: "Xưởng Văn Lâm" },
    workstation: null,
    permissions,
    workstationInvalid: false,
  };
}

const user: UserListItem = {
  id: "u-1",
  email: "cashier@example.test",
  username: "cashier",
  phone: "0947900909",
  display_name: "Cashier",
  status: "active",
  permissions: ["perm.create_order"],
};

function repo(overrides: Partial<FoundationRepository> = {}): FoundationRepository {
  return {
    getCurrentUser: () => Promise.resolve(currentUser()),
    listWorkstations: () => Promise.resolve([]),
    createWorkstation: () => {
      throw new Error("not implemented");
    },
    updateWorkstation: () => Promise.resolve(null),
    listUsers: () => Promise.resolve({ items: [user], total: 1 }),
    getUser: ({ userId }: Parameters<FoundationRepository["getUser"]>[0]) =>
      Promise.resolve(userId === "u-1" ? user : null),
    createUser: (input: Parameters<FoundationRepository["createUser"]>[0]) =>
      Promise.resolve({
        id: "u-new",
        email: input.email,
        username: input.username,
        phone: input.phone,
        display_name: input.displayName,
        status: "active",
        permissions: input.permissions,
      }),
    updateUser: (input: Parameters<FoundationRepository["updateUser"]>[0]) =>
      Promise.resolve(input.userId === "u-1" ? { ...user, display_name: input.displayName ?? user.display_name } : null),
    replaceUserPermissions: (input: Parameters<FoundationRepository["replaceUserPermissions"]>[0]) =>
      Promise.resolve(input.userId === "u-1" ? { ...user, permissions: input.permissions } : null),
    listPermissions: () =>
      Promise.resolve([
        { code: "perm.create_order", module: "sales", description: "Create sales orders" },
        { code: "perm.apply_discount", module: "sales", description: "Apply discounts" },
        { code: "perm.edit_price_book", module: "catalog", description: "Edit price book" },
        { code: "perm.manage_inventory", module: "inventory", description: "Manage inventory" },
        { code: "perm.manage_finance", module: "finance", description: "Manage finance" },
        { code: "perm.view_shift_report", module: "reports", description: "View reports" },
      ]),
    ...overrides,
  } as unknown as FoundationRepository;
}

async function call(path: string, init: RequestInit, repository = repo()): Promise<Response> {
  return await createApp({
    version: "test",
    auth: auth(),
    repository,
    rateLimiter: new MemoryRateLimiter(),
  })(
    new Request(`http://local${path}`, {
      ...init,
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
        "x-request-id": "trace-users",
        ...init.headers,
      },
    }),
  );
}

Deno.test("user and permission route matrix works for manage_users", async () => {
  assertEquals((await call("/api/v1/users", { method: "GET" })).status, 200);
  assertEquals((await call("/api/v1/users/u-1", { method: "GET" })).status, 200);
  assertEquals((await call("/api/v1/permissions", { method: "GET" })).status, 200);
  assertEquals(
    (await call("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({
        email: "new@example.test",
        password: "password123",
        display_name: "New User",
        permissions: ["perm.create_order"],
      }),
    })).status,
    201,
  );
  assertEquals(
    (await call("/api/v1/users/u-1", {
      method: "PATCH",
      body: JSON.stringify({ display_name: "Cashier 2" }),
    })).status,
    200,
  );
  assertEquals(
    (await call("/api/v1/users/u-1/permissions", {
      method: "PUT",
      body: JSON.stringify({ permissions: ["perm.create_order"] }),
    })).status,
    200,
  );
});

Deno.test("create user defaults to internal staff MVP operational permissions when omitted", async () => {
  const createInputs: Array<Parameters<FoundationRepository["createUser"]>[0]> = [];
  const response = await call("/api/v1/users", {
    method: "POST",
    body: JSON.stringify({
      email: "operator@example.test",
      username: "operator-login",
      phone: " 0947 900 909 ",
      birthday: "2026-07-07",
      region: " TP Hồ Chí Minh ",
      ward: "Phường Bến Thành",
      address: "12 Nguyen Trai",
      note: "Ca tối",
      password: "password123",
      display_name: "Operator",
    }),
  }, repo({
    createUser: (input: Parameters<FoundationRepository["createUser"]>[0]) => {
      createInputs.push(input);
      return Promise.resolve({
        id: "u-new",
        email: input.email,
        username: input.username ?? null,
        phone: input.phone ?? null,
        birthday: input.birthday ?? null,
        region: input.region ?? null,
        ward: input.ward ?? null,
        address: input.address ?? null,
        note: input.note ?? null,
        display_name: input.displayName,
        status: "active",
        permissions: input.permissions,
      });
    },
  }));
  const responseBody = await response.json();
  const created = responseBody.data as UserListItem;

  assertEquals(response.status, 201);
  const createInput = createInputs[0];
  assertEquals(createInput?.birthday, "2026-07-07");
  assertEquals(createInput?.region, "TP Hồ Chí Minh");
  assertEquals(createInput?.ward, "Phường Bến Thành");
  assertEquals(createInput?.address, "12 Nguyen Trai");
  assertEquals(createInput?.note, "Ca tối");
  assertEquals(created.username, "operator-login");
  assertEquals(created.phone, "0947 900 909");
  assertEquals(created.birthday, "2026-07-07");
  assertEquals(created.region, "TP Hồ Chí Minh");
  assertEquals(created.ward, "Phường Bến Thành");
  assertEquals(created.address, "12 Nguyen Trai");
  assertEquals(created.note, "Ca tối");
  assertEquals(created.permissions, [
    "perm.create_order",
    "perm.apply_discount",
    "perm.edit_price_book",
    "perm.manage_inventory",
    "perm.manage_finance",
    "perm.view_shift_report",
  ]);
});

Deno.test("user admin validates input and maps final admin conflict", async () => {
  const invalid = await call("/api/v1/users", {
    method: "POST",
    body: JSON.stringify({ email: "bad", password: "short", display_name: "", permissions: [] }),
  });
  assertEquals(invalid.status, 400);

  const conflict = await call(
    "/api/v1/users/u-1/permissions",
    { method: "PUT", body: JSON.stringify({ permissions: ["perm.create_order"] }) },
    repo({ replaceUserPermissions: () => Promise.reject({ message: "LAST_ADMIN_REQUIRED" }) }),
  );
  assertEquals(conflict.status, 409);
});
