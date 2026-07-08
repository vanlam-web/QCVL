import { createApp } from "../../functions/api/app.ts";
import type {
  CurrentUserRecord,
  FoundationRepository,
  PermissionCode,
  SalesDocumentDetailData,
  SalesDocumentListItemData,
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

const documentListItem: SalesDocumentListItemData = {
  id: "order-1",
  code: "HD010985",
  order_type: "invoice",
  status: "completed",
  created_at: "2026-06-30T17:08:00Z",
  customer: { id: "customer-1", code: "KH000001", name: "Cong ty ABC", phone: null },
  seller: { id: actorId, name: "Admin" },
  subtotal_amount: 180000,
  discount_amount: 30000,
  total_amount: 150000,
  paid_amount: 0,
  debt_amount: 150000,
  payment_status: "unpaid",
  note: "In gấp",
};

const documentDetail: SalesDocumentDetailData = {
  ...documentListItem,
  price_list: { id: "price-list-1", code: "BGC", name: "Bảng giá chung" },
  change_returned_amount: 0,
  items: [
    {
      id: "item-1",
      line_no: 1,
      product: { id: "product-1", code: "DECAL-PP", name: "Decal PP", unit_name: "m²", sell_method: "area_m2" },
      quantity: 2,
      width_m: 2.5,
      height_m: 3.3,
      linear_m: null,
      unit_price: 90000,
      line_subtotal_amount: 180000,
      discount_amount: 30000,
      line_total: 150000,
      price_source: "manual",
      note: "2.5m x 3.3m x 1 = 8.25m2",
    },
  ],
  payment_receipts: [
    {
      id: "receipt-1",
      code: "TTHD010985",
      status: "posted",
      receipt_type: "sale_payment",
      total_received_amount: 0,
      created_at: "2026-06-30T17:08:00Z",
      created_by: { id: "cashier-1", name: "Thu ngân" },
      methods: [],
      allocations: [],
    },
  ],
  debt_entries: [
    {
      id: "debt-1",
      entry_type: "invoice_debt",
      amount_delta: 150000,
      balance_after_order: 150000,
      balance_after_customer: 150000,
      created_at: "2026-06-30T17:08:00Z",
    },
  ],
  stock_movements: [
    {
      id: "movement-1",
      product_id: "product-1",
      movement_type: "sale_deduction",
      quantity_delta: -2,
      created_at: "2026-06-30T17:08:00Z",
    },
  ],
  history: [
    { at: "2026-06-30T17:08:00Z", action: "created", actor_name: "Admin", note: "Checkout POS" },
  ],
};

function repo(
  permissions: PermissionCode[],
  overrides: Record<string, unknown> = {},
): FoundationRepository {
  const base = {
    getCurrentUser: () => Promise.resolve(currentUser(permissions)),
    listSalesDocuments: () => Promise.resolve({ items: [documentListItem], total: 1 }),
    getSalesDocument: () => Promise.resolve(documentDetail),
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
        "x-request-id": "trace-sales-documents",
        ...init.headers,
      },
    }),
  );
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

Deno.test("sales documents require sales or finance permission", async () => {
  assertEquals((await call("/api/v1/sales-documents", { method: "GET" }, repo([]))).status, 403);
  assertEquals((await call("/api/v1/sales-documents", { method: "GET" }, repo(["perm.create_order"]))).status, 200);
  assertEquals((await call("/api/v1/sales-documents", { method: "GET" }, repo(["perm.manage_finance"]))).status, 200);
});

Deno.test("sales document list returns invoice money and debt columns", async () => {
  const response = await call("/api/v1/sales-documents", { method: "GET" }, repo(["perm.create_order"]));
  const data = (await body(response)).data as { items: SalesDocumentListItemData[]; total: number };

  assertEquals(response.status, 200);
  assertEquals(data.total, 1);
  assertEquals(data.items[0].code, "HD010985");
  assertEquals(data.items[0].discount_amount, 30000);
  assertEquals(data.items[0].debt_amount, 150000);
});

Deno.test("exact document code search ignores default date filters", async () => {
  const receivedInputs: Array<Record<string, unknown>> = [];
  const response = await call(
    "/api/v1/sales-documents?search=HD010985&from=2026-07-01T00:00:00Z&to=2026-07-31T23:59:59Z",
    { method: "GET" },
    repo(["perm.create_order"], {
      listSalesDocuments: (input: Record<string, unknown>) => {
        receivedInputs.push(input);
        return Promise.resolve({ items: [documentListItem], total: 1 });
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(receivedInputs[0].search, "HD010985");
  assertEquals(receivedInputs[0].from, undefined);
  assertEquals(receivedInputs[0].to, undefined);
});

Deno.test("sales document list accepts customer filter for customer history", async () => {
  const receivedInputs: Array<Record<string, unknown>> = [];
  const response = await call(
    "/api/v1/sales-documents?customer_id=customer-1&page=1&page_size=10",
    { method: "GET" },
    repo(["perm.create_order"], {
      listSalesDocuments: (input: Record<string, unknown>) => {
        receivedInputs.push(input);
        return Promise.resolve({ items: [documentListItem], total: 1 });
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(receivedInputs[0].customerId, "customer-1");
  assertEquals(receivedInputs[0].page, 1);
  assertEquals(receivedInputs[0].pageSize, 10);
});

Deno.test("sales document list accepts supported KiotViet-style filters", async () => {
  const receivedInputs: Array<Record<string, unknown>> = [];
  const response = await call(
    "/api/v1/sales-documents?status=completed&payment_status=paid&payment_method=bank_transfer&created_by=90000000-0000-4000-8000-000000000001&price_list_id=price-list-1",
    { method: "GET" },
    repo(["perm.create_order"], {
      listSalesDocuments: (input: Record<string, unknown>) => {
        receivedInputs.push(input);
        return Promise.resolve({ items: [documentListItem], total: 1 });
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(receivedInputs[0].status, "completed");
  assertEquals(receivedInputs[0].paymentStatus, "paid");
  assertEquals(receivedInputs[0].paymentMethod, "bank_transfer");
  assertEquals(receivedInputs[0].createdBy, actorId);
  assertEquals(receivedInputs[0].priceListId, "price-list-1");
});

Deno.test("sales document detail returns snapshots, payments, debt and stock movements", async () => {
  const response = await call("/api/v1/sales-documents/order-1", { method: "GET" }, repo(["perm.create_order"]));
  const data = (await body(response)).data as SalesDocumentDetailData;

  assertEquals(response.status, 200);
  assertEquals(data.code, "HD010985");
  assertEquals(data.items[0].product.code, "DECAL-PP");
  assertEquals(data.items[0].width_m, 2.5);
  assertEquals(data.items[0].height_m, 3.3);
  assertEquals(data.items[0].linear_m, null);
  assertEquals(data.items[0].note, "2.5m x 3.3m x 1 = 8.25m2");
  assertEquals(data.payment_receipts.length, 1);
  assertEquals(data.payment_receipts[0].created_by.name, "Thu ngân");
  assertEquals(data.debt_entries[0].amount_delta, 150000);
  assertEquals(data.stock_movements[0].movement_type, "sale_deduction");
});

Deno.test("missing sales document maps to resource not found", async () => {
  const response = await call(
    "/api/v1/sales-documents/missing-order",
    { method: "GET" },
    repo(["perm.create_order"], { getSalesDocument: () => Promise.resolve(null) }),
  );

  assertEquals(response.status, 404);
});

Deno.test("sales documents API is readonly for phase 2d", async () => {
  for (const [path, method] of [
    ["/api/v1/sales-documents", "POST"],
    ["/api/v1/sales-documents/order-1", "PATCH"],
    ["/api/v1/sales-documents/order-1", "DELETE"],
  ] as const) {
    const response = await call(
      path,
      { method, body: method === "POST" || method === "PATCH" ? JSON.stringify({}) : undefined },
      repo(["perm.create_order"]),
    );

    assertEquals(response.status, 404);
    assertEquals(((await body(response)).error as { code: string }).code, "RESOURCE_NOT_FOUND");
  }
});
