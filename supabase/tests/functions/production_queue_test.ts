import { createApp } from "../../functions/api/app.ts";
import type {
  CurrentUserRecord,
  FoundationRepository,
  PermissionCode,
  ProductionQueueDraftPayloadData,
  ProductionQueueItemData,
} from "../../functions/api/contracts.ts";
import type { AuthClient } from "../../functions/api/middleware/auth.ts";

const actorId = "90000000-0000-4000-8000-000000000001";
const organizationId = "90000000-0000-4000-8000-000000000101";

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function auth(): AuthClient {
  return { getUser: () => Promise.resolve({ user: { id: actorId, email: "admin@example.test" } }) };
}

function currentUser(permissions: PermissionCode[]): CurrentUserRecord {
  return {
    user: { id: actorId, email: "admin@example.test", displayName: "Admin" },
    organization: { id: organizationId, code: "VAN-LAM", name: "Xưởng Văn Lâm" },
    workstation: null,
    permissions,
    workstationInvalid: false,
  };
}

const queueItem: ProductionQueueItemData = {
  id: "queue-1",
  production_machine: { id: "machine-1", code: "IN-DECAL", name: "In decal" },
  raw_file_name: "KH000001_DECAL-PP_120x50_x2",
  received_at: "2026-07-01T10:30:00Z",
  status: "queued",
  parse_status: "ok",
  parse_error: null,
  parsed: { customer_code: "KH000001", product_code: "DECAL-PP", width_cm: 120, height_cm: 50, quantity: 2 },
};

const draftPayload: ProductionQueueDraftPayloadData = {
  queue_item_id: "queue-1",
  customer: { id: "customer-1", code: "KH000001", name: "Khách lẻ" },
  draft_line: {
    product_id: "product-1",
    product_code: "DECAL-PP",
    product_name: "Decal PP",
    unit_name: "m²",
    sell_method: "area_m2",
    width_m: 1.2,
    height_m: 0.5,
    linear_m: null,
    quantity: 2,
    source: "production_queue",
  },
};

function repo(
  permissions: PermissionCode[],
  overrides: Record<string, unknown> = {},
): FoundationRepository {
  const base = {
    getCurrentUser: () => Promise.resolve(currentUser(permissions)),
    listProductionQueue: () => Promise.resolve({ items: [queueItem], total: 1 }),
    listProductionQueueHistory: () => Promise.resolve({ items: [], total: 0 }),
    addProductionQueueItemToDraft: () => Promise.resolve(draftPayload),
    dismissProductionQueueItem: () => Promise.resolve(queueItem),
    restoreProductionQueueItem: () => Promise.resolve(queueItem),
    ...overrides,
  };

  return base as unknown as FoundationRepository;
}

async function call(
  path: string,
  init: RequestInit,
  repository: FoundationRepository,
): Promise<Response> {
  return await createApp({
    version: "test",
    auth: auth(),
    repository,
  })(
    new Request(`http://local${path}`, {
      ...init,
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
        "x-request-id": "trace-production-queue",
        ...init.headers,
      },
    }),
  );
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

Deno.test("production queue requires create_order permission for cashier actions", async () => {
  const response = await call("/api/v1/production-queue", { method: "GET" }, repo([]));

  assertEquals(response.status, 403);
});

Deno.test("production queue lists queued items grouped by machine context", async () => {
  const response = await call("/api/v1/production-queue", { method: "GET" }, repo(["perm.create_order"]));
  const data = (await body(response)).data as { items: ProductionQueueItemData[] };

  assertEquals(response.status, 200);
  assertEquals(data.items.length, 1);
  assertEquals(data.items[0].production_machine.code, "IN-DECAL");
});

Deno.test("add to draft returns normalized local draft payload", async () => {
  const response = await call(
    "/api/v1/production-queue/queue-1/add-to-draft",
    { method: "POST" },
    repo(["perm.create_order"]),
  );
  const data = (await body(response)).data as ProductionQueueDraftPayloadData;

  assertEquals(response.status, 200);
  assertEquals(data.queue_item_id, "queue-1");
  assertEquals(data.draft_line.source, "production_queue");
});

Deno.test("add to draft maps already handled queue item to resource conflict", async () => {
  const response = await call(
    "/api/v1/production-queue/queue-1/add-to-draft",
    { method: "POST" },
    repo(["perm.create_order"], {
      addProductionQueueItemToDraft: () => Promise.resolve(null),
    }),
  );

  assertEquals(response.status, 409);
});
