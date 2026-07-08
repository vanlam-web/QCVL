import { createApp } from "../../functions/api/app.ts";
import type {
  CurrentUserRecord,
  FoundationRepository,
  PermissionCode,
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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
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
    listProducts: () =>
      Promise.resolve({
        items: [
          {
            id: "p-1",
            code: "MICA-3MM",
            name: "Mica 3mm",
            status: "active",
            unit_name: "m",
            sell_method: "linear_m",
          },
        ],
        total: 1,
      }),
    createProduct: () =>
      Promise.resolve({
        id: "p-new",
        code: "DECAL",
        name: "Decal",
        status: "active",
        unit_name: "m²",
        sell_method: "area_m2",
      }),
    updateProduct: () =>
      Promise.resolve({
        id: "p-1",
        code: "MICA-3MM",
        name: "Mica 3mm",
        status: "inactive",
        unit_name: "m",
        sell_method: "linear_m",
      }),
    getProductBom: () => Promise.resolve(null),
    saveProductBom: () =>
      Promise.resolve({
        id: "bom-1",
        product_id: "p-1",
        version: 1,
        status: "active",
        notes: null,
        created_at: "2026-07-05T00:00:00Z",
        items: [
          {
            id: "item-1",
            component_product_id: "component-1",
            component_product: { id: "component-1", code: "KEO", name: "Keo dán", unit_name: "chai" },
            quantity: 2,
            sort_order: 1,
            notes: "Dán mica",
          },
        ],
      }),
    listPriceLists: () =>
      Promise.resolve([
        {
          id: "pl-1",
          code: "DEFAULT",
          name: "Bảng giá chung",
          is_default: true,
          is_active: true,
        },
      ]),
    createPriceList: () =>
      Promise.resolve({
        id: "pl-2",
        code: "DAILY",
        name: "Bảng giá đại lý",
        is_default: false,
        is_active: true,
      }),
    updatePriceList: () =>
      Promise.resolve({
        id: "pl-1",
        code: "DEFAULT",
        name: "Bảng giá chung",
        is_default: true,
        is_active: true,
      }),
    upsertPriceListItem: () =>
      Promise.resolve({
        product_id: "p-1",
        unit_price: 120000,
        price_source: "default_price_list",
        price_list_id: "pl-1",
      }),
    deletePriceListItem: () => Promise.resolve(true),
    resolvePrices: () =>
      Promise.resolve([
        {
          product_id: "p-1",
          unit_price: 120000,
          price_source: "default_price_list",
          price_list_id: "pl-1",
        },
      ]),
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
        "x-request-id": "trace-catalog",
        ...init.headers,
      },
    }),
  );
}

async function data(response: Response): Promise<unknown> {
  return (await response.json()).data;
}

Deno.test("catalog routes require account permissions", async () => {
  assertEquals((await call("/api/v1/products", { method: "GET" }, repo(["perm.create_order"]))).status, 200);
  assertEquals(
    (await call(
      "/api/v1/products",
      {
        method: "POST",
        body: JSON.stringify({
          code: "DECAL",
          name: "Decal",
          status: "active",
          unit_name: "m²",
          sell_method: "area_m2",
        }),
      },
      repo(["perm.edit_price_book"]),
    )).status,
    201,
  );
  assertEquals((await call("/api/v1/products", { method: "GET" }, repo([]))).status, 403);
});

Deno.test("product search hides inactive products for POS users", async () => {
  let requestedStatus: string | null = null;
  const repository = repo(["perm.create_order"], {
    listProducts: (input: { status: string }) => {
      requestedStatus = input.status;
      return Promise.resolve({ items: [], total: 0 });
    },
  });

  const response = await call("/api/v1/products?status=all", { method: "GET" }, repository);

  assertEquals(response.status, 200);
  assertEquals(requestedStatus, "active");
});

Deno.test("product create accepts inventory shape and latest purchase cost", async () => {
  const createInputs: Array<Record<string, unknown>> = [];
  const repository = repo(["perm.edit_price_book"], {
    createProduct: (input: Record<string, unknown>) => {
      createInputs.push(input);
      return Promise.resolve({
        id: "p-new",
        code: input.code,
        name: input.name,
        status: input.status,
        product_kind: input.productKind,
        unit_name: input.unitName,
        sell_method: input.sellMethod,
        latest_purchase_cost: input.latestPurchaseCost,
        inventory_shape: input.inventoryShape,
      });
    },
  });

  const response = await call(
    "/api/v1/products",
    {
      method: "POST",
      body: JSON.stringify({
        code: "BAT-32",
        name: "Bạt 3.2m",
        status: "active",
        product_kind: "auxiliary_material",
        unit_name: "m",
        sell_method: "linear_m",
        inventory_shape: "roll",
        track_inventory: false,
        latest_purchase_cost: 50000,
      }),
    },
    repository,
  );

  assertEquals(response.status, 201);
  assertEquals(createInputs[0].productKind, "auxiliary_material");
  assertEquals(createInputs[0].inventoryShape, "roll");
  assertEquals(createInputs[0].trackInventory, false);
  assertEquals(createInputs[0].latestPurchaseCost, 50000);
});

Deno.test("product list accepts product kind filter", async () => {
  const listInputs: Array<Record<string, unknown>> = [];
  const repository = repo(["perm.edit_price_book"], {
    listProducts: (input: Record<string, unknown>) => {
      listInputs.push(input);
      return Promise.resolve({ items: [], total: 0 });
    },
  });

  const response = await call("/api/v1/products?product_kind=auxiliary_material", { method: "GET" }, repository);

  assertEquals(response.status, 200);
  assertEquals(listInputs[0].productKind, "auxiliary_material");
});

Deno.test("catalog product groups include default general group", async () => {
  const response = await call("/api/v1/product-groups", { method: "GET" }, repo(["perm.edit_price_book"], {
    listProductGroups: (input: Record<string, unknown>) => {
      assertEquals(input.organizationId, organizationId);
      return Promise.resolve({
        items: [
          { id: "pg-default", code: "GENERAL", name: "Giá chung", is_default: true, is_active: true },
        ],
      });
    },
  }));

  assertEquals(response.status, 200);
  const body = await data(response) as { items: Array<Record<string, unknown>> };
  assertEquals(body.items[0].name, "Giá chung");
  assertEquals(body.items[0].is_default, true);
});

Deno.test("catalog product create and list map product group", async () => {
  const receivedInputs: Array<Record<string, unknown>> = [];
  const repository = repo(["perm.edit_price_book"], {
    createProduct: (input: Record<string, unknown>) => {
      receivedInputs.push(input);
      return Promise.resolve({
        id: "p-group",
        code: "TEST-GROUP",
        name: "Hàng test nhóm",
        status: "active",
        product_kind: "goods",
        unit_name: "cái",
        sell_method: "quantity",
        latest_purchase_cost: null,
        latest_purchase_cost_at: null,
        product_group: { id: input.productGroupId as string, code: "VAT-TU", name: "Vật tư" },
      });
    },
    listProducts: (input: Record<string, unknown>) => {
      receivedInputs.push(input);
      return Promise.resolve({ items: [], total: 0 });
    },
  });

  const createResponse = await call(
    "/api/v1/products",
    {
      method: "POST",
      body: JSON.stringify({
        code: "TEST-GROUP",
        name: "Hàng test nhóm",
        unit_name: "cái",
        sell_method: "quantity",
        product_group_id: "pg-vat-tu",
      }),
    },
    repository,
  );
  const listResponse = await call("/api/v1/products?product_group_id=pg-vat-tu", { method: "GET" }, repository);

  assertEquals(createResponse.status, 201);
  assertEquals(listResponse.status, 200);
  assertEquals(receivedInputs[0].productGroupId, "pg-vat-tu");
  assertEquals(receivedInputs[1].productGroupId, "pg-vat-tu");
});

Deno.test("catalog product create accepts KV-style unit conversions", async () => {
  const receivedInputs: Array<Record<string, unknown>> = [];
  const response = await call(
    "/api/v1/products",
    {
      method: "POST",
      body: JSON.stringify({
        code: "TEST-UNIT",
        name: "Hàng nhiều đơn vị",
        unit_name: "tờ",
        sell_method: "quantity",
        unit_conversions: [
          { unit_name: "Ram", stock_qty_per_unit: 100, is_default_purchase_unit: true },
          { unit_name: "m tới", stock_qty_per_unit: 0.5, is_default_sale_unit: true },
          { unit_name: "Tấc", stock_qty_per_unit: 0.042 },
        ],
      }),
    },
    repo(["perm.edit_price_book"], {
      createProduct: (input: Record<string, unknown>) => {
        receivedInputs.push(input);
        return Promise.resolve({
          id: "p-unit",
          code: "TEST-UNIT",
          name: "Hàng nhiều đơn vị",
          status: "active",
          product_kind: "goods",
          unit_name: "tờ",
          sell_method: "quantity",
          latest_purchase_cost: null,
          latest_purchase_cost_at: null,
          unit_conversions: input.unitConversions,
        });
      },
    }),
  );

  assertEquals(response.status, 201);
  const conversions = receivedInputs[0].unitConversions as Array<Record<string, unknown>>;
  assertEquals(conversions.map((item) => item.unitName), ["Ram", "m tới", "Tấc"]);
  assertEquals(conversions.map((item) => item.stockQtyPerUnit), [100, 0.5, 0.042]);
  assertEquals(conversions[0].isDefaultPurchaseUnit, true);
  assertEquals(conversions[1].isDefaultSaleUnit, true);
});

Deno.test("catalog product group create normalizes input", async () => {
  const receivedInputs: Array<Record<string, unknown>> = [];
  const response = await call(
    "/api/v1/product-groups",
    { method: "POST", body: JSON.stringify({ name: " Vật tư chính " }) },
    repo(["perm.edit_price_book"], {
      createProductGroup: (input: Record<string, unknown>) => {
        receivedInputs.push(input);
        return Promise.resolve({
          id: "pg-vat-tu",
          code: "VAT-TU-CHINH",
          name: input.name,
          is_default: false,
          is_active: true,
        });
      },
    }),
  );

  assertEquals(response.status, 201);
  assertEquals(receivedInputs[0].organizationId, organizationId);
  assertEquals(receivedInputs[0].name, "Vật tư chính");
});

Deno.test("price resolution uses default price list without discount model", async () => {
  const response = await call(
    "/api/v1/pricing/resolve",
    { method: "POST", body: JSON.stringify({ product_ids: ["p-1"] }) },
    repo(["perm.create_order"]),
  );

  assertEquals(response.status, 200);
  const body = await data(response) as { items: Array<Record<string, unknown>> };
  assertEquals(body.items[0].unit_price, 120000);
  assertEquals(body.items[0].price_source, "default_price_list");
  assert(!("discount_rate" in body.items[0]), "price response must not include discount_rate");
  assert(!("discount_items" in body.items[0]), "price response must not include discount_items");
});

Deno.test("product BOM routes require inventory permission and normalize items", async () => {
  const forbidden = await call("/api/v1/products/p-1/bom", { method: "GET" }, repo(["perm.create_order"]));
  assertEquals(forbidden.status, 403);

  const receivedInputs: Array<Record<string, unknown>> = [];
  const repository = repo(["perm.manage_inventory"], {
    getProductBom: (input: Record<string, unknown>) => {
      receivedInputs.push(input);
      return Promise.resolve(null);
    },
    saveProductBom: (input: Record<string, unknown>) => {
      receivedInputs.push(input);
      return Promise.resolve({
        id: "bom-1",
        product_id: input.productId as string,
        version: 1,
        status: "active",
        notes: null,
        created_at: "2026-07-05T00:00:00Z",
        items: [
          {
            id: "item-1",
            component_product_id: "component-1",
            component_product: {
              id: "component-1",
              code: "KEO",
              name: "Keo dán",
              unit_name: "chai",
              product_kind: "auxiliary_material",
              latest_purchase_cost: 20000,
            },
            quantity: 2,
            sort_order: 1,
            notes: null,
          },
        ],
      });
    },
  });

  const getResponse = await call("/api/v1/products/p-1/bom", { method: "GET" }, repository);
  const postResponse = await call(
    "/api/v1/products/p-1/bom",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ component_product_id: "component-1", quantity: "2", notes: " Dán mica " }],
      }),
    },
    repository,
  );

  assertEquals(getResponse.status, 200);
  assertEquals(postResponse.status, 201);
  const body = await data(postResponse) as { items: Array<{ component_product: Record<string, unknown> }> };
  assertEquals(body.items[0].component_product.product_kind, "auxiliary_material");
  assertEquals(body.items[0].component_product.latest_purchase_cost, 20000);
  assertEquals(receivedInputs[0].productId, "p-1");
  assertEquals(receivedInputs[1].items, [{ componentProductId: "component-1", quantity: 2, notes: "Dán mica" }]);
});

Deno.test("product BOM PUT route saves BOM and rejects manual main/sub flags", async () => {
  const receivedInputs: Array<Record<string, unknown>> = [];
  const repository = repo(["perm.manage_inventory"], {
    saveProductBom: (input: Record<string, unknown>) => {
      receivedInputs.push(input);
      return Promise.resolve({
        id: "bom-1",
        product_id: input.productId as string,
        version: 1,
        status: "active",
        notes: null,
        created_at: "2026-07-05T00:00:00Z",
        items: [],
      });
    },
  });

  const putResponse = await call(
    "/api/v1/products/p-1/bom",
    {
      method: "PUT",
      body: JSON.stringify({ items: [{ component_product_id: "component-1", quantity: 2 }] }),
    },
    repository,
  );
  const invalidResponse = await call(
    "/api/v1/products/p-1/bom",
    {
      method: "POST",
      body: JSON.stringify({ items: [{ component_product_id: "component-1", quantity: 2, component_role: "main" }] }),
    },
    repository,
  );

  assertEquals(putResponse.status, 201);
  assertEquals(invalidResponse.status, 400);
  assertEquals(receivedInputs[0].items, [{ componentProductId: "component-1", quantity: 2, notes: null }]);
});

Deno.test("customer routes normalize optional phone and auto code", async () => {
  const receivedInputs: Array<{
    code?: string;
    name: string;
    phone?: string;
    taxCode?: string;
    address?: string;
    customerGroupId?: string | null;
    actorUserId?: string;
  }> = [];
  const repository = repo(["perm.create_order"], {
    createCustomer: (input: {
      code?: string;
      name: string;
      phone?: string;
      taxCode?: string;
      address?: string;
      customerGroupId?: string | null;
      actorUserId?: string;
    }) => {
      receivedInputs.push(input);
      return Promise.resolve({
        id: "customer-1",
        code: input.code ?? "KH000002",
        name: input.name,
        phone: input.phone ?? null,
        tax_code: input.taxCode ?? null,
        address: input.address ?? null,
        customer_group_id: input.customerGroupId ?? null,
        customer_group: null,
        created_at: "2026-07-03T03:00:00Z",
        created_by: { id: input.actorUserId ?? "", name: "Admin" },
        total_sales_amount: 0,
      });
    },
  });

  const response = await call(
    "/api/v1/customers",
    {
      method: "POST",
      body: JSON.stringify({
        name: " Cong ty ABC ",
        phone: " 090 123 4567 ",
        tax_code: " 0312345678 ",
        address: " 12 Nguyen Trai, Quan 1 ",
      }),
    },
    repository,
  );

  const body = await data(response) as Record<string, unknown>;
  assertEquals(response.status, 201);
  assertEquals(receivedInputs[0].code, undefined);
  assertEquals(receivedInputs[0].name, "Cong ty ABC");
  assertEquals(receivedInputs[0].phone, "090 123 4567");
  assertEquals(receivedInputs[0].taxCode, "0312345678");
  assertEquals(receivedInputs[0].address, "12 Nguyen Trai, Quan 1");
  assertEquals(receivedInputs[0].actorUserId, actorId);
  assertEquals(body.code, "KH000002");
  assertEquals(body.name, "Cong ty ABC");
  assertEquals(body.tax_code, "0312345678");
  assertEquals(body.address, "12 Nguyen Trai, Quan 1");
  assertEquals((body.created_by as Record<string, unknown>).name, "Admin");
});

Deno.test("customer list maps existing filter fields", async () => {
  let captured: Record<string, unknown> | null = null;
  const repository = repo(["perm.create_order"], {
    listCustomers: (input: Record<string, unknown>) => {
      captured = input;
      return Promise.resolve({ items: [], total: 0 });
    },
  });

  const response = await call(
    "/api/v1/customers?search=phong&customer_group_id=cg-1&created_from=2026-07-01&created_to=2026-07-06&created_by=user-admin&total_sales_min=500000&total_sales_max=900000&total_debt_min=100000&total_debt_max=300000&page=2&page_size=15",
    { method: "GET" },
    repository,
  );

  assertEquals(response.status, 200);
  assertEquals(captured, {
    organizationId,
    search: "phong",
    customerGroupId: "cg-1",
    createdFrom: "2026-07-01",
    createdTo: "2026-07-06",
    createdBy: "user-admin",
    totalSalesMin: 500000,
    totalSalesMax: 900000,
    totalDebtMin: 100000,
    totalDebtMax: 300000,
    page: 2,
    pageSize: 15,
  });
});

Deno.test("customer routes map duplicate name or phone to resource conflict", async () => {
  const duplicateError = { code: "23505", message: "duplicate key value violates unique constraint" };
  const createResponse = await call(
    "/api/v1/customers",
    {
      method: "POST",
      body: JSON.stringify({ name: "Khach le" }),
    },
    repo(["perm.create_order"], {
      createCustomer: () => {
        throw duplicateError;
      },
    }),
  );

  assertEquals(createResponse.status, 409);
  assertEquals(((await createResponse.json()).error as Record<string, unknown>).code, "RESOURCE_CONFLICT");

  const updateResponse = await call(
    "/api/v1/customers/customer-1",
    {
      method: "PATCH",
      body: JSON.stringify({ phone: "0901234567" }),
    },
    repo(["perm.create_order"], {
      updateCustomer: () => {
        throw duplicateError;
      },
    }),
  );

  assertEquals(updateResponse.status, 409);
  assertEquals(((await updateResponse.json()).error as Record<string, unknown>).code, "RESOURCE_CONFLICT");
});

Deno.test("price resolution accepts a customer id", async () => {
  let receivedCustomerId: string | undefined;
  const repository = repo(["perm.create_order"], {
    resolvePrices: (input: { productIds: string[]; customerId?: string }) => {
      receivedCustomerId = input.customerId;
      return Promise.resolve([
        {
          product_id: input.productIds[0],
          unit_price: input.customerId === "customer-1" ? 100000 : 120000,
          price_source: "customer_group_price_list",
          price_list_id: "price-list-2",
        },
      ]);
    },
  });

  const response = await call(
    "/api/v1/pricing/resolve",
    { method: "POST", body: JSON.stringify({ product_ids: ["p-1"], customer_id: "customer-1" }) },
    repository,
  );

  const body = await data(response) as { items: Array<Record<string, unknown>> };
  assertEquals(response.status, 200);
  assertEquals(receivedCustomerId, "customer-1");
  assertEquals(body.items[0].unit_price, 100000);
  assertEquals(body.items[0].price_source, "customer_group_price_list");
});

Deno.test("price formula preview requires edit_price_book and returns computed rows", async () => {
  const response = await call(
    "/api/v1/price-lists/formulas/preview",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Fomex",
        product_filter: { name_contains: "Mica" },
        cost_formula: { type: "fixed", amount: 5000 },
        profit_formula: { type: "fixed", amount: 25000 },
        price_list_adjustments: { "pl-1": { type: "amount", amount: 20000 } },
      }),
    },
    repo(["perm.edit_price_book"], {
      previewPriceFormula: () =>
        Promise.resolve({
          affected_count: 1,
          items: [
            {
              product_id: "p-1",
              product_code: "MICA-3MM",
              product_name: "Mica 3mm",
              latest_purchase_cost: 100000,
              current_mode: "manual",
              current_unit_price: 120000,
              computed_prices: [
                {
                  price_list_id: "pl-1",
                  price_list_name: "Bảng giá chung",
                  current_unit_price: 120000,
                  computed_unit_price: 150000,
                  delta: 30000,
                },
              ],
            },
          ],
        }),
    }),
  );

  assertEquals(response.status, 200);
  const body = await data(response) as { affected_count: number };
  assertEquals(body.affected_count, 1);
});

Deno.test("price formula preview is blocked without edit_price_book", async () => {
  const response = await call(
    "/api/v1/price-lists/formulas/preview",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Fomex",
        product_filter: {},
        cost_formula: { type: "fixed", amount: 5000 },
        profit_formula: { type: "fixed", amount: 25000 },
        price_list_adjustments: {},
      }),
    },
    repo(["perm.create_order"]),
  );

  assertEquals(response.status, 403);
});

Deno.test("price formula apply persists selected formula cells", async () => {
  let receivedActorUserId: string | undefined;
  let receivedSelectionCount = 0;
  const response = await call(
    "/api/v1/price-lists/formulas/apply",
    {
      method: "POST",
      body: JSON.stringify({
        formula: {
          name: "Fomex",
          product_filter: {},
          cost_formula: { type: "fixed", amount: 5000 },
          profit_formula: { type: "fixed", amount: 25000 },
          price_list_adjustments: { "pl-1": { type: "amount", amount: 20000 } },
        },
        selected_items: [{ product_id: "p-1", price_list_id: "pl-1" }],
      }),
    },
    repo(["perm.edit_price_book"], {
      applyPriceFormula: (input: { actorUserId: string; selectedItems: unknown[] }) => {
        receivedActorUserId = input.actorUserId;
        receivedSelectionCount = input.selectedItems.length;
        return Promise.resolve({ formula_rule_id: "rule-1", affected_count: 1 });
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(receivedActorUserId, actorId);
  assertEquals(receivedSelectionCount, 1);
  const body = await data(response) as { affected_count: number };
  assertEquals(body.affected_count, 1);
});
