import { createApp } from "../../functions/api/app.ts";
import type {
  CurrentUserRecord,
  FoundationRepository,
  PermissionCode,
  SupplierData,
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

const supplier: SupplierData = {
  id: "supplier-1",
  code: "NCC000031",
  name: "Nguyễn Phong",
  phone: null,
  email: "ncc@example.test",
  address: "Quận 12",
  tax_code: "0312345678",
  linked_customer_id: "customer-1",
  linked_customer: { id: "customer-1", code: "KH000123", name: "Nguyễn Phong" },
  notes: "NCC cũng là khách hàng",
  status: "active",
  current_payable_amount: 0,
  total_purchase_amount: 0,
};

function repo(
  permissions: PermissionCode[],
  overrides: Record<string, unknown> = {},
): FoundationRepository {
  return {
    getCurrentUser: () => Promise.resolve(currentUser(permissions)),
    listSuppliers: () => Promise.resolve({ items: [supplier], total: 1 }),
    createSupplier: () => Promise.resolve(supplier),
    getSupplier: () => Promise.resolve(supplier),
    updateSupplier: () => Promise.resolve({ ...supplier, status: "inactive" }),
    ...overrides,
  } as unknown as FoundationRepository;
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
        "x-request-id": "trace-suppliers",
        ...init.headers,
      },
    }),
  );
}

async function data(response: Response): Promise<unknown> {
  return (await response.json()).data;
}

Deno.test("supplier routes require manage inventory permission", async () => {
  assertEquals((await call("/api/v1/suppliers", { method: "GET" }, repo(["perm.manage_inventory"]))).status, 200);
  assertEquals((await call("/api/v1/suppliers", { method: "GET" }, repo(["perm.create_order"]))).status, 403);
});

Deno.test("supplier list maps search status and default paging", async () => {
  let captured: Record<string, unknown> | null = null;
  const repository = repo(["perm.manage_inventory"], {
    listSuppliers: (input: Record<string, unknown>) => {
      captured = input;
      return Promise.resolve({ items: [supplier], total: 1 });
    },
  });

  const response = await call("/api/v1/suppliers?q=nguyen&status=all", { method: "GET" }, repository);

  assertEquals(response.status, 200);
  assertEquals(captured, {
    organizationId,
    search: "nguyen",
    status: "all",
    page: 1,
    pageSize: 20,
  });
  const body = await data(response) as { items: SupplierData[]; total: number };
  assertEquals(body.items[0].current_payable_amount, 0);
  assertEquals(body.items[0].total_purchase_amount, 0);
});

Deno.test("supplier list maps payable and purchase total ranges", async () => {
  let captured: Record<string, unknown> | null = null;
  const repository = repo(["perm.manage_inventory"], {
    listSuppliers: (input: Record<string, unknown>) => {
      captured = input;
      return Promise.resolve({ items: [supplier], total: 1 });
    },
  });

  const response = await call(
    "/api/v1/suppliers?total_purchase_min=100000&total_purchase_max=900000&current_payable_min=50000&current_payable_max=300000",
    { method: "GET" },
    repository,
  );

  assertEquals(response.status, 200);
  assertEquals(captured, {
    organizationId,
    status: "active",
    totalPurchaseMin: 100000,
    totalPurchaseMax: 900000,
    currentPayableMin: 50000,
    currentPayableMax: 300000,
    page: 1,
    pageSize: 20,
  });
});

Deno.test("supplier create normalizes optional fields and allows blank phone", async () => {
  let captured: Record<string, unknown> | null = null;
  const repository = repo(["perm.manage_inventory"], {
    createSupplier: (input: Record<string, unknown>) => {
      captured = input;
      return Promise.resolve({ ...supplier, phone: null, code: "NCC000001" });
    },
  });

  const response = await call(
    "/api/v1/suppliers",
    {
      method: "POST",
      body: JSON.stringify({
        code: "",
        name: "Nguyễn Phong",
        phone: "",
        email: "",
        address: "Quận 12",
        tax_code: "",
        linked_customer_id: "customer-1",
        notes: "NCC cũng là khách hàng",
        status: "inactive",
      }),
    },
    repository,
  );

  assertEquals(response.status, 201);
  assertEquals(captured, {
    organizationId,
    code: undefined,
    name: "Nguyễn Phong",
    phone: undefined,
    email: undefined,
    address: "Quận 12",
    taxCode: undefined,
    linkedCustomerId: "customer-1",
    notes: "NCC cũng là khách hàng",
    status: "inactive",
  });
});

Deno.test("supplier detail and update support linked customer and inactive status", async () => {
  let captured: Record<string, unknown> | null = null;
  const repository = repo(["perm.manage_inventory"], {
    updateSupplier: (input: Record<string, unknown>) => {
      captured = input;
      return Promise.resolve({ ...supplier, status: "inactive" });
    },
  });

  const detailResponse = await call("/api/v1/suppliers/supplier-1", { method: "GET" }, repository);
  assertEquals(detailResponse.status, 200);

  const updateResponse = await call(
    "/api/v1/suppliers/supplier-1",
    {
      method: "PATCH",
      body: JSON.stringify({ status: "inactive", linked_customer_id: null, phone: "" }),
    },
    repository,
  );

  assertEquals(updateResponse.status, 200);
  assertEquals(captured, {
    organizationId,
    id: "supplier-1",
    phone: null,
    linkedCustomerId: null,
    status: "inactive",
  });
});

Deno.test("supplier routes reject unsupported mutations", async () => {
  const response = await call("/api/v1/suppliers/supplier-1", { method: "DELETE" }, repo(["perm.manage_inventory"]));
  assertEquals(response.status, 405);
});

Deno.test("supplier routes surface missing linked customer as validation error", async () => {
  const response = await call(
    "/api/v1/suppliers",
    { method: "POST", body: JSON.stringify({ name: "NCC", linked_customer_id: "missing" }) },
    repo(["perm.manage_inventory"], {
      createSupplier: () => {
        throw { code: "23503", message: "linked customer must belong to same organization" };
      },
    }),
  );

  assertEquals(response.status, 400);
  const body = await response.json() as { error: { code: string } };
  assertEquals(body.error.code, "VALIDATION_ERROR");
});

Deno.test("supplier payable receipts route returns selected-payment candidates", async () => {
  let captured: Record<string, unknown> | null = null;
  const repository = repo(["perm.manage_inventory"], {
    listSupplierPayableReceipts: (input: Record<string, unknown>) => {
      captured = input;
      return Promise.resolve({
        items: [
          {
            id: "receipt-1",
            code: "PN000673",
            supplier_document_no: "HD-NCC-001",
            received_at: "2026-07-02T03:00:00.000Z",
            payable_amount: 300000,
            paid_amount: 0,
            remaining_amount: 300000,
            paid_after_post_amount: 50000,
            outstanding_amount: 250000,
          },
        ],
      });
    },
  });

  const response = await call("/api/v1/suppliers/supplier-1/payable-receipts", { method: "GET" }, repository);

  assertEquals(response.status, 200);
  assertEquals(captured, { organizationId, supplierId: "supplier-1" });
  const body = await data(response) as { items: Array<{ code: string; outstanding_amount: number }> };
  assertEquals(body.items[0].code, "PN000673");
  assertEquals(body.items[0].outstanding_amount, 250000);
});

Deno.test("supplier payment route maps explicit receipt allocations", async () => {
  let captured: Record<string, unknown> = {};
  const repository = repo(["perm.manage_inventory"], {
    paySupplier: (input: Record<string, unknown>) => {
      captured = input;
      return Promise.resolve({
        supplier_payment_id: "payment-1",
        code: "PCPN000001",
        amount: 250000,
        cashbook_voucher_id: "voucher-1",
      });
    },
  });

  const response = await call(
    "/api/v1/suppliers/supplier-1/payments",
    {
      method: "POST",
      body: JSON.stringify({
        payment_method: "bank_transfer",
        finance_account_id: "account-1",
        paid_at: "2026-07-02T14:00:00+07:00",
        note: "Thanh toán NCC",
        allocations: [
          { purchase_receipt_id: "receipt-1", amount: 150000 },
          { purchase_receipt_id: "receipt-2", amount: 100000 },
        ],
      }),
    },
    repository,
  );

  assertEquals(response.status, 201);
  assertEquals(captured.organizationId, organizationId);
  assertEquals(captured.actorUserId, actorId);
  assertEquals(captured.supplierId, "supplier-1");
  assertEquals(captured.paymentMethod, "bank_transfer");
  assertEquals(captured.financeAccountId, "account-1");
  assertEquals(captured.paidAt, "2026-07-02T14:00:00+07:00");
  assertEquals(captured.note, "Thanh toán NCC");
  assertEquals(captured.allocations, [
    { purchaseReceiptId: "receipt-1", amount: 150000 },
    { purchaseReceiptId: "receipt-2", amount: 100000 },
  ]);
  assertEquals(await data(response), {
    supplier_payment_id: "payment-1",
    code: "PCPN000001",
    amount: 250000,
    cashbook_voucher_id: "voucher-1",
  });
});

Deno.test("supplier payment route rejects duplicate selected receipts before repository call", async () => {
  const response = await call(
    "/api/v1/suppliers/supplier-1/payments",
    {
      method: "POST",
      body: JSON.stringify({
        payment_method: "cash",
        allocations: [
          { purchase_receipt_id: "receipt-1", amount: 10000 },
          { purchase_receipt_id: "receipt-1", amount: 20000 },
        ],
      }),
    },
    repo(["perm.manage_inventory"], {
      paySupplier: () => {
        throw new Error("repository should not be called for duplicate receipt allocations");
      },
    }),
  );

  assertEquals(response.status, 400);
  const body = await response.json() as { error: { code: string } };
  assertEquals(body.error.code, "VALIDATION_ERROR");
});
