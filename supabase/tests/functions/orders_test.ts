import { createApp } from "../../functions/api/app.ts";
import type {
  CheckoutResultData,
  CurrentUserRecord,
  FoundationRepository,
  PermissionCode,
  QuoteReopenPayloadData,
  QuoteSummaryData,
  UserListItem,
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

const user: UserListItem = {
  id: "u-1",
  email: "cashier@example.test",
  username: "cashier",
  phone: "0947900909",
  display_name: "Cashier",
  status: "active",
  permissions: ["perm.create_order"],
};

function checkoutResult(overrides: Partial<CheckoutResultData> = {}): CheckoutResultData {
  return {
    order: {
      id: "order-1",
      code: "HD000001",
      order_type: "invoice",
      status: "completed",
      total_amount: 180000,
      paid_amount: 180000,
      debt_amount: 0,
      payment_status: "paid",
    },
    payment_receipt: {
      id: "receipt-1",
      code: "PT000001",
      total_received_amount: 180000,
    },
    inventory_warnings: [],
    ...overrides,
  };
}

function quoteSummary(overrides: Partial<QuoteSummaryData> = {}): QuoteSummaryData {
  return {
    id: "quote-1",
    code: "BG000001",
    order_type: "quote",
    status: "active",
    total_amount: 170000,
    ...overrides,
  };
}

function quoteReopenPayload(overrides: Partial<QuoteReopenPayloadData> = {}): QuoteReopenPayloadData {
  return {
    quote: {
      id: "quote-1",
      code: "BG000001",
      status: "active",
    },
    customer: {
      customer_id: null,
      snapshot: { code: null, name: "Khach le", phone: null },
      warnings: [],
    },
    price_list: {
      price_list_id: null,
      snapshot: { code: null, name: null },
      warnings: [],
    },
    items: [{
      order_item_id: "quote-item-1",
      product_id: "p-1",
      product_snapshot: { code: "PVC", name: "PVC 5mm", unit_name: "tam", sell_method: "quantity" },
      quantity: 1,
      unit_price: 180000,
      discount_amount: 10000,
      price_source: "manual",
      note: null,
      warnings: [],
    }],
    summary: { subtotal_amount: 180000, discount_amount: 10000, total_amount: 170000 },
    note: null,
    ...overrides,
  };
}

function repo(
  permissions: PermissionCode[],
  overrides: Record<string, unknown> = {},
): FoundationRepository {
  const base = {
    getCurrentUser: () => Promise.resolve(currentUser(permissions)),
    listWorkstations: () => Promise.resolve([]),
    createWorkstation: () => {
      throw new Error("not implemented");
    },
    updateWorkstation: () => Promise.resolve(null),
    listUsers: () => Promise.resolve({ items: [user], total: 1 }),
    getUser: () => Promise.resolve(user),
    createUser: () => Promise.resolve(user),
    updateUser: () => Promise.resolve(user),
    replaceUserPermissions: () => Promise.resolve(user),
    listPermissions: () => Promise.resolve([]),
    listProducts: () => Promise.resolve({ items: [], total: 0 }),
    createProduct: () => {
      throw new Error("not implemented");
    },
    updateProduct: () => Promise.resolve(null),
    listPriceLists: () => Promise.resolve([]),
    createPriceList: () => {
      throw new Error("not implemented");
    },
    updatePriceList: () => Promise.resolve(null),
    upsertPriceListItem: () => {
      throw new Error("not implemented");
    },
    deletePriceListItem: () => Promise.resolve(false),
    resolvePrices: () => Promise.resolve([]),
    listCustomers: () => Promise.resolve({ items: [], total: 0 }),
    createCustomer: () => {
      throw new Error("not implemented");
    },
    updateCustomer: () => Promise.resolve(null),
    listCustomerGroups: () => Promise.resolve([]),
    createCustomerGroup: () => {
      throw new Error("not implemented");
    },
    updateCustomerGroup: () => Promise.resolve(null),
    checkoutOrder: () => Promise.resolve(checkoutResult()),
    saveQuote: () => Promise.resolve(quoteSummary()),
    getQuoteReopenPayload: () => Promise.resolve(quoteReopenPayload()),
    reviseInvoice: () => Promise.resolve({ order_id: "order-1", status: "not_implemented" }),
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
        "x-request-id": "trace-orders",
        ...init.headers,
      },
    }),
  );
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json();
}

Deno.test("checkout requires create_order permission", async () => {
  const response = await call(
    "/api/v1/orders/checkout",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ product_id: "p-1", quantity: 1, unit_price: 180000, price_source: "default_price_list" }],
        payment: { cash_amount: 180000, bank_amount: 0, old_debt_payment_amount: 0 },
      }),
    },
    repo([]),
  );

  assertEquals(response.status, 403);
});

Deno.test("checkout calls repository transaction and returns order summary", async () => {
  const receivedInputs: Array<Record<string, unknown>> = [];
  const response = await call(
    "/api/v1/orders/checkout",
    {
      method: "POST",
      body: JSON.stringify({
        customer_id: "customer-1",
        items: [{ product_id: "p-1", quantity: 1, unit_price: 180000, price_source: "default_price_list" }],
        payment: { cash_amount: 180000, bank_amount: 0, old_debt_payment_amount: 0 },
      }),
    },
    repo(["perm.create_order"], {
      checkoutOrder: (input: Record<string, unknown>) => {
        receivedInputs.push(input);
        return Promise.resolve(checkoutResult());
      },
    }),
  );

  const responseBody = await body(response);
  const data = responseBody.data as CheckoutResultData;
  assertEquals(response.status, 201);
  assertEquals(data.order.code, "HD000001");
  assertEquals(receivedInputs[0].organizationId, organizationId);
  assertEquals(receivedInputs[0].actorUserId, actorId);
});

Deno.test("checkout validates bank account when bank amount is present", async () => {
  const response = await call(
    "/api/v1/orders/checkout",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ product_id: "p-1", quantity: 1, unit_price: 180000, price_source: "default_price_list" }],
        payment: { cash_amount: 0, bank_amount: 180000, old_debt_payment_amount: 0 },
      }),
    },
    repo(["perm.create_order"]),
  );

  assertEquals(response.status, 400);
  assertEquals(((await body(response)).error as { code: string }).code, "VALIDATION_ERROR");
});

Deno.test("checkout validates line discount cannot exceed line subtotal", async () => {
  const response = await call(
    "/api/v1/orders/checkout",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{
          product_id: "p-1",
          quantity: 1,
          unit_price: 180000,
          discount_amount: 180001,
          price_source: "default_price_list",
        }],
        payment: { cash_amount: 0, bank_amount: 0, old_debt_payment_amount: 0 },
      }),
    },
    repo(["perm.create_order"]),
  );

  assertEquals(response.status, 400);
  assertEquals(((await body(response)).error as { code: string }).code, "VALIDATION_ERROR");
});

Deno.test("checkout requires apply_discount permission when line discount is submitted", async () => {
  const payload = {
    items: [{
      product_id: "p-1",
      quantity: 1,
      unit_price: 180000,
      discount_amount: 30000,
      price_source: "default_price_list",
    }],
    payment: { cash_amount: 150000, bank_amount: 0, old_debt_payment_amount: 0 },
  };

  const denied = await call(
    "/api/v1/orders/checkout",
    { method: "POST", body: JSON.stringify(payload) },
    repo(["perm.create_order"]),
  );

  assertEquals(denied.status, 403);
  assertEquals(((await body(denied)).error as { code: string }).code, "PERMISSION_DENIED");

  const allowed = await call(
    "/api/v1/orders/checkout",
    { method: "POST", body: JSON.stringify(payload) },
    repo(["perm.create_order", "perm.apply_discount"]),
  );

  assertEquals(allowed.status, 201);
});

Deno.test("checkout can return inventory warnings without blocking success", async () => {
  const response = await call(
    "/api/v1/orders/checkout",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ product_id: "p-1", quantity: 99, unit_price: 180000, price_source: "default_price_list" }],
        payment: { cash_amount: 180000, bank_amount: 0, old_debt_payment_amount: 0 },
      }),
    },
    repo(["perm.create_order"], {
      checkoutOrder: () =>
        Promise.resolve(checkoutResult({
          inventory_warnings: [{ product_id: "p-1", code: "NEGATIVE_STOCK", message: "Tồn kho sẽ âm" }],
        })),
    }),
  );

  const data = (await body(response)).data as CheckoutResultData;
  assertEquals(response.status, 201);
  assertEquals(data.inventory_warnings.length, 1);
});

Deno.test("cart validate route performs soft validation for checkout payload", async () => {
  const response = await call(
    "/api/v1/pos/cart/validate",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{
          product_id: "p-roll",
          quantity: 1,
          unit_price: 180000,
          price_source: "manual",
        }],
        payment: { cash_amount: 0, bank_amount: 0, old_debt_payment_amount: 0 },
      }),
    },
    repo(["perm.create_order"]),
  );

  const data = (await body(response)).data as { valid: boolean; warnings: unknown[] };
  assertEquals(response.status, 200);
  assertEquals(data.valid, true);
  assertEquals(Array.isArray(data.warnings), true);
});

Deno.test("quote routes save and reopen active quote with create_order", async () => {
  const receivedInputs: Array<Record<string, unknown>> = [];
  const saveResponse = await call(
    "/api/v1/orders/quotes",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{
          product_id: "p-1",
          quantity: 1,
          unit_price: 180000,
          discount_amount: 0,
          price_source: "manual",
        }],
        note: "Bao gia phase 3A",
      }),
    },
    repo(["perm.create_order"], {
      saveQuote: (input: Record<string, unknown>) => {
        receivedInputs.push(input);
        return Promise.resolve(quoteSummary());
      },
    }),
  );

  const saveBody = await body(saveResponse);
  assertEquals(saveResponse.status, 201);
  assertEquals((saveBody.data as QuoteSummaryData).code, "BG000001");
  assertEquals(receivedInputs[0].organizationId, organizationId);
  assertEquals(receivedInputs[0].actorUserId, actorId);

  const reopenResponse = await call(
    "/api/v1/orders/quotes/quote-1/reopen-payload",
    { method: "GET" },
    repo(["perm.create_order"], {
      getQuoteReopenPayload: (input: Record<string, unknown>) => {
        receivedInputs.push(input);
        return Promise.resolve(quoteReopenPayload());
      },
    }),
  );

  assertEquals(reopenResponse.status, 200);
  assertEquals(((await body(reopenResponse)).data as QuoteReopenPayloadData).quote.code, "BG000001");
});

Deno.test("quote save with discount requires apply_discount", async () => {
  const payload = {
    items: [{
      product_id: "p-1",
      quantity: 1,
      unit_price: 180000,
      discount_amount: 10000,
      price_source: "manual",
    }],
  };

  const denied = await call(
    "/api/v1/orders/quotes",
    { method: "POST", body: JSON.stringify(payload) },
    repo(["perm.create_order"]),
  );

  assertEquals(denied.status, 403);

  const allowed = await call(
    "/api/v1/orders/quotes",
    { method: "POST", body: JSON.stringify(payload) },
    repo(["perm.create_order", "perm.apply_discount"]),
  );

  assertEquals(allowed.status, 201);
});

Deno.test("quote revision endpoint is not part of phase 3a", async () => {
  const response = await call(
    "/api/v1/orders/quotes/quote-1/revisions",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ product_id: "p-1", quantity: 1, unit_price: 180000, discount_amount: 0, price_source: "manual" }],
      }),
    },
    repo(["perm.create_order"]),
  );

  const responseBody = await body(response);
  assertEquals(response.status, 404);
  assertEquals((responseBody.error as { code: string }).code, "RESOURCE_NOT_FOUND");
});

Deno.test("invoice revise requires edit_order_locked and revision_reason", async () => {
  assertEquals(
    (await call(
      "/api/v1/orders/order-1/revise",
      { method: "POST", body: JSON.stringify({ revision_reason: "Sai giá" }) },
      repo(["perm.create_order"]),
    )).status,
    403,
  );

  const missingReason = await call(
    "/api/v1/orders/order-1/revise",
    { method: "POST", body: JSON.stringify({}) },
    repo(["perm.edit_order_locked"]),
  );

  assertEquals(missingReason.status, 400);
});

Deno.test("invoice revise does not return fake success while disabled", async () => {
  const response = await call(
    "/api/v1/orders/order-1/revise",
    { method: "POST", body: JSON.stringify({ revision_reason: "Sai giá" }) },
    repo(["perm.edit_order_locked"]),
  );
  const responseBody = await body(response);

  assertEquals(response.status, 409);
  assertEquals((responseBody.error as { code: string }).code, "RESOURCE_CONFLICT");
});
