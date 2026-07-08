import type {
  FoundationRepository,
  JsonValue,
  PermissionCode,
  PurchasePhysicalPayloadData,
  PurchaseReceiptData,
  PurchaseReceiptPostResult,
  SupplierData,
  SupplierPayableReceiptData,
  SupplierPaymentResultData,
} from "../contracts.ts";
import { ApiError } from "../http.ts";
import { requireAnyPermission } from "./catalog.ts";

export interface PurchaseContext {
  organizationId: string;
  actorUserId: string;
  permissions: readonly PermissionCode[];
}

export interface SupplierListResponse {
  items: SupplierData[];
  page: number;
  page_size: number;
  total: number;
}

export interface PurchaseReceiptListResponse {
  items: PurchaseReceiptData[];
  page: number;
  page_size: number;
  total: number;
}

export interface SupplierPayableReceiptListResponse {
  items: SupplierPayableReceiptData[];
}

export async function listSuppliers(
  repository: FoundationRepository,
  context: PurchaseContext,
  url: URL,
): Promise<SupplierListResponse> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const {
    search,
    status,
    totalPurchaseMin,
    totalPurchaseMax,
    currentPayableMin,
    currentPayableMax,
    page,
    pageSize,
  } = parseSupplierList(url);
  const result = await repository.listSuppliers({
    organizationId: context.organizationId,
    search,
    status,
    totalPurchaseMin,
    totalPurchaseMax,
    currentPayableMin,
    currentPayableMax,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function getSupplier(
  repository: FoundationRepository,
  context: PurchaseContext,
  id: string,
): Promise<SupplierData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const row = await repository.getSupplier({ organizationId: context.organizationId, id });
  if (row === null) throw notFound();
  return row;
}

export async function createSupplier(
  repository: FoundationRepository,
  context: PurchaseContext,
  body: unknown,
): Promise<SupplierData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const input = parseSupplierCreate(body);
  try {
    return await repository.createSupplier({ organizationId: context.organizationId, ...input });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function updateSupplier(
  repository: FoundationRepository,
  context: PurchaseContext,
  id: string,
  body: unknown,
): Promise<SupplierData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const input = parseSupplierUpdate(body);
  try {
    const row = await repository.updateSupplier({ organizationId: context.organizationId, id, ...input });
    if (row === null) throw notFound();
    return row;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw mapRepositoryError(cause);
  }
}

export async function listSupplierPayableReceipts(
  repository: FoundationRepository,
  context: PurchaseContext,
  supplierId: string,
): Promise<SupplierPayableReceiptListResponse> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  return await repository.listSupplierPayableReceipts({ organizationId: context.organizationId, supplierId });
}

export async function paySupplier(
  repository: FoundationRepository,
  context: PurchaseContext,
  supplierId: string,
  body: unknown,
): Promise<SupplierPaymentResultData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const input = parseSupplierPayment(body);
  try {
    return await repository.paySupplier({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      supplierId,
      ...input,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function listPurchaseReceipts(
  repository: FoundationRepository,
  context: PurchaseContext,
  url: URL,
): Promise<PurchaseReceiptListResponse> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const { search, status, dateFrom, dateTo, createdBy, page, pageSize } = parsePurchaseReceiptList(url);
  const result = await repository.listPurchaseReceipts({
    organizationId: context.organizationId,
    search,
    status,
    dateFrom,
    dateTo,
    createdBy,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function getPurchaseReceipt(
  repository: FoundationRepository,
  context: PurchaseContext,
  id: string,
): Promise<PurchaseReceiptData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const row = await repository.getPurchaseReceipt({ organizationId: context.organizationId, id });
  if (row === null) throw notFound();
  return row;
}

export async function createPurchaseReceipt(
  repository: FoundationRepository,
  context: PurchaseContext,
  body: unknown,
): Promise<PurchaseReceiptData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const input = parsePurchaseReceiptCreate(body);
  try {
    return await repository.createPurchaseReceipt({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      ...input,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function updatePurchaseReceipt(
  repository: FoundationRepository,
  context: PurchaseContext,
  id: string,
  body: unknown,
): Promise<PurchaseReceiptData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const input = parsePurchaseReceiptUpdate(body);
  try {
    const row = await repository.updatePurchaseReceipt({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      id,
      ...input,
    });
    if (row === null) throw notFound();
    return row;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw mapRepositoryError(cause);
  }
}

export async function postPurchaseReceipt(
  repository: FoundationRepository,
  context: PurchaseContext,
  id: string,
  body: unknown,
): Promise<PurchaseReceiptPostResult> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const input = parsePurchaseReceiptPost(body);
  try {
    return await repository.postPurchaseReceipt({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      id,
      ...input,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

function parseSupplierList(url: URL): {
  search?: string;
  status: "active" | "inactive" | "all";
  totalPurchaseMin?: number;
  totalPurchaseMax?: number;
  currentPayableMin?: number;
  currentPayableMax?: number;
  page: number;
  pageSize: number;
} {
  const search = url.searchParams.get("q")?.trim() || url.searchParams.get("search")?.trim();
  const status = parseSupplierListStatus(url.searchParams.get("status") ?? "active");
  const totalPurchaseMin = parseOptionalMoneyFilter(url.searchParams.get("total_purchase_min"));
  const totalPurchaseMax = parseOptionalMoneyFilter(url.searchParams.get("total_purchase_max"));
  const currentPayableMin = parseOptionalMoneyFilter(url.searchParams.get("current_payable_min"));
  const currentPayableMax = parseOptionalMoneyFilter(url.searchParams.get("current_payable_max"));
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationError();
  }
  if (search !== undefined && search.length > 100) throw validationError();
  return {
    search: search || undefined,
    status,
    totalPurchaseMin,
    totalPurchaseMax,
    currentPayableMin,
    currentPayableMax,
    page,
    pageSize,
  };
}

function parsePurchaseReceiptList(url: URL): {
  search?: string;
  status: "draft" | "posted" | "cancelled" | "all";
  dateFrom?: string;
  dateTo?: string;
  createdBy?: string;
  page: number;
  pageSize: number;
} {
  const search = url.searchParams.get("q")?.trim() || url.searchParams.get("search")?.trim();
  const status = parsePurchaseReceiptListStatus(url.searchParams.get("status") ?? "draft");
  const dateFrom = url.searchParams.get("date_from")?.trim() || undefined;
  const dateTo = url.searchParams.get("date_to")?.trim() || undefined;
  const createdBy = url.searchParams.get("created_by")?.trim() || undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationError();
  }
  if (search !== undefined && search.length > 100) throw validationError();
  if (createdBy !== undefined && createdBy.length > 100) throw validationError();
  if (dateFrom !== undefined && Number.isNaN(Date.parse(dateFrom))) throw validationError();
  if (dateTo !== undefined && Number.isNaN(Date.parse(dateTo))) throw validationError();
  return { search: search || undefined, status, dateFrom, dateTo, createdBy, page, pageSize };
}

function parseSupplierCreate(body: unknown): {
  code?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  linkedCustomerId?: string | null;
  notes?: string;
  status?: "active" | "inactive";
} {
  if (!isRecord(body)) throw validationError();
  const input: {
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxCode?: string;
    linkedCustomerId?: string | null;
    notes?: string;
    status?: "active" | "inactive";
  } = { name: normalizeText(body.name, 200) };
  if ("code" in body && body.code !== null && body.code !== undefined && String(body.code).trim() !== "") {
    input.code = normalizeCode(body.code);
  }
  if ("phone" in body && body.phone !== null && body.phone !== undefined && String(body.phone).trim() !== "") {
    input.phone = normalizeText(body.phone, 30);
  }
  if ("email" in body && body.email !== null && body.email !== undefined && String(body.email).trim() !== "") {
    input.email = normalizeText(body.email, 254);
  }
  if ("address" in body && body.address !== null && body.address !== undefined && String(body.address).trim() !== "") {
    input.address = normalizeText(body.address, 500);
  }
  if ("tax_code" in body && body.tax_code !== null && body.tax_code !== undefined && String(body.tax_code).trim() !== "") {
    input.taxCode = normalizeText(body.tax_code, 50);
  }
  if ("linked_customer_id" in body) input.linkedCustomerId = parseOptionalId(body.linked_customer_id);
  if ("notes" in body && body.notes !== null && body.notes !== undefined && String(body.notes).trim() !== "") {
    input.notes = normalizeText(body.notes, 1000);
  }
  if ("status" in body) input.status = parseSupplierStatus(body.status);
  return input;
}

function parseSupplierUpdate(body: unknown): {
  code?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxCode?: string | null;
  linkedCustomerId?: string | null;
  notes?: string | null;
  status?: "active" | "inactive";
} {
  if (!isRecord(body)) throw validationError();
  const input: {
    code?: string;
    name?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    taxCode?: string | null;
    linkedCustomerId?: string | null;
    notes?: string | null;
    status?: "active" | "inactive";
  } = {};
  if ("code" in body) input.code = normalizeCode(body.code);
  if ("name" in body) input.name = normalizeText(body.name, 200);
  if ("phone" in body) input.phone = parseOptionalText(body.phone, 30);
  if ("email" in body) input.email = parseOptionalText(body.email, 254);
  if ("address" in body) input.address = parseOptionalText(body.address, 500);
  if ("tax_code" in body) input.taxCode = parseOptionalText(body.tax_code, 50);
  if ("linked_customer_id" in body) input.linkedCustomerId = parseOptionalId(body.linked_customer_id);
  if ("notes" in body) input.notes = parseOptionalText(body.notes, 1000);
  if ("status" in body) input.status = parseSupplierStatus(body.status);
  if (Object.keys(input).length === 0) throw validationError();
  return input;
}

function parsePurchaseReceiptCreate(body: unknown): {
  code?: string;
  supplierId: string;
  receivedAt: string;
  supplierDocumentNo?: string;
  notes?: string;
  discountAmount: number;
  paidAmount: number;
  items: Array<{
    productId: string;
    inventoryShape?: "normal" | "roll" | "sheet";
    unitName: string;
    quantity: number;
    unitCost: number;
    discountAmount: number;
    physicalPayload?: PurchasePhysicalPayloadData | null;
  }>;
} {
  if (!isRecord(body)) throw validationError();
  const input = {
    supplierId: parseRequiredId(body.supplier_id),
    receivedAt: parseRequiredDate(body.received_at),
    discountAmount: parseNonNegativeAmount(body.discount_amount ?? 0),
    paidAmount: parseNonNegativeAmount(body.paid_amount ?? 0),
    items: parsePurchaseReceiptItems(body.items),
  };
  const optional: {
    code?: string;
    supplierDocumentNo?: string;
    notes?: string;
  } = {};
  if ("code" in body && body.code !== null && body.code !== undefined && String(body.code).trim() !== "") {
    optional.code = normalizeCode(body.code);
  }
  if ("supplier_document_no" in body && body.supplier_document_no !== null && body.supplier_document_no !== undefined && String(body.supplier_document_no).trim() !== "") {
    optional.supplierDocumentNo = normalizeText(body.supplier_document_no, 100);
  }
  if ("notes" in body && body.notes !== null && body.notes !== undefined && String(body.notes).trim() !== "") {
    optional.notes = normalizeText(body.notes, 1000);
  }
  return { ...input, ...optional };
}

function parsePurchaseReceiptUpdate(body: unknown): {
  code?: string;
  supplierId?: string;
  receivedAt?: string;
  supplierDocumentNo?: string | null;
  notes?: string | null;
  discountAmount?: number;
  paidAmount?: number;
  items?: Array<{
    productId: string;
    unitName: string;
    quantity: number;
    unitCost: number;
    discountAmount: number;
  }>;
} {
  if (!isRecord(body)) throw validationError();
  const input: {
    code?: string;
    supplierId?: string;
    receivedAt?: string;
    supplierDocumentNo?: string | null;
    notes?: string | null;
    discountAmount?: number;
    paidAmount?: number;
    items?: Array<{
      productId: string;
      inventoryShape?: "normal" | "roll" | "sheet";
      unitName: string;
      quantity: number;
      unitCost: number;
      discountAmount: number;
      physicalPayload?: PurchasePhysicalPayloadData | null;
    }>;
  } = {};
  if ("code" in body) input.code = normalizeCode(body.code);
  if ("supplier_id" in body) input.supplierId = parseRequiredId(body.supplier_id);
  if ("received_at" in body) input.receivedAt = parseRequiredDate(body.received_at);
  if ("supplier_document_no" in body) input.supplierDocumentNo = parseOptionalText(body.supplier_document_no, 100);
  if ("notes" in body) input.notes = parseOptionalText(body.notes, 1000);
  if ("discount_amount" in body) input.discountAmount = parseNonNegativeAmount(body.discount_amount);
  if ("paid_amount" in body) input.paidAmount = parseNonNegativeAmount(body.paid_amount);
  if ("items" in body) input.items = parsePurchaseReceiptItems(body.items);
  if (Object.keys(input).length === 0) throw validationError();
  return input;
}

function parsePurchaseReceiptPost(body: unknown): {
  paymentMethod?: "cash" | "bank_transfer";
  financeAccountId?: string;
} {
  if (body === null || body === undefined) return {};
  if (!isRecord(body)) throw validationError();
  const input: {
    paymentMethod?: "cash" | "bank_transfer";
    financeAccountId?: string;
  } = {};
  if ("payment_method" in body && body.payment_method !== null && body.payment_method !== undefined && String(body.payment_method).trim() !== "") {
    if (body.payment_method !== "cash" && body.payment_method !== "bank_transfer") throw validationError();
    input.paymentMethod = body.payment_method;
  }
  if ("finance_account_id" in body && body.finance_account_id !== null && body.finance_account_id !== undefined && String(body.finance_account_id).trim() !== "") {
    input.financeAccountId = parseRequiredId(body.finance_account_id);
  }
  return input;
}

function parseSupplierPayment(body: unknown): {
  paymentMethod: "cash" | "bank_transfer";
  financeAccountId?: string;
  paidAt?: string;
  note?: string;
  allocations: Array<{ purchaseReceiptId: string; amount: number }>;
} {
  if (!isRecord(body)) throw validationError();
  if (body.payment_method !== "cash" && body.payment_method !== "bank_transfer") throw validationError();
  const input: {
    paymentMethod: "cash" | "bank_transfer";
    financeAccountId?: string;
    paidAt?: string;
    note?: string;
    allocations: Array<{ purchaseReceiptId: string; amount: number }>;
  } = {
    paymentMethod: body.payment_method,
    allocations: parseSupplierPaymentAllocations(body.allocations),
  };
  if ("finance_account_id" in body && body.finance_account_id !== null && body.finance_account_id !== undefined && String(body.finance_account_id).trim() !== "") {
    input.financeAccountId = parseRequiredId(body.finance_account_id);
  }
  if ("paid_at" in body && body.paid_at !== null && body.paid_at !== undefined && String(body.paid_at).trim() !== "") {
    input.paidAt = parseRequiredDate(body.paid_at);
  }
  if ("note" in body && body.note !== null && body.note !== undefined && String(body.note).trim() !== "") {
    input.note = normalizeText(body.note, 500);
  }
  return input;
}

function parseSupplierPaymentAllocations(value: unknown): Array<{ purchaseReceiptId: string; amount: number }> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw validationError();
  const seen = new Set<string>();
  return value.map((item) => {
    if (!isRecord(item)) throw validationError();
    const purchaseReceiptId = parseRequiredId(item.purchase_receipt_id);
    if (seen.has(purchaseReceiptId)) throw validationError();
    seen.add(purchaseReceiptId);
    return {
      purchaseReceiptId,
      amount: parsePositiveMoney(item.amount),
    };
  });
}

function parsePurchaseReceiptItems(value: unknown): Array<{
  productId: string;
  inventoryShape?: "normal" | "roll" | "sheet";
  unitName: string;
  quantity: number;
  unitCost: number;
  discountAmount: number;
  physicalPayload?: PurchasePhysicalPayloadData | null;
}> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) throw validationError();
  const seen = new Set<string>();
  return value.map((item) => {
    if (!isRecord(item)) throw validationError();
    const productId = parseRequiredId(item.product_id);
    if (seen.has(productId)) throw validationError();
    seen.add(productId);
    const parsed: {
      productId: string;
      inventoryShape?: "normal" | "roll" | "sheet";
      unitName: string;
      quantity: number;
      unitCost: number;
      discountAmount: number;
      physicalPayload?: PurchasePhysicalPayloadData | null;
    } = {
      productId,
      unitName: normalizeText(item.unit_name, 30),
      quantity: parsePositiveQuantity(item.quantity),
      unitCost: parseNonNegativeAmount(item.unit_cost),
      discountAmount: parseNonNegativeAmount(item.discount_amount ?? 0),
    };
    if ("inventory_shape" in item) parsed.inventoryShape = parseInventoryShape(item.inventory_shape);
    if ("physical_payload" in item) parsed.physicalPayload = parseOptionalObjectPayload(item.physical_payload);
    return parsed;
  });
}

function parseInventoryShape(value: unknown): "normal" | "roll" | "sheet" {
  if (value !== "normal" && value !== "roll" && value !== "sheet") throw validationError();
  return value;
}

function parseOptionalObjectPayload(value: unknown): PurchasePhysicalPayloadData | null {
  if (value === null || value === undefined) return null;
  if (!isJsonValue(value) || !isRecord(value)) throw validationError();
  return value as PurchasePhysicalPayloadData;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return Number.isFinite(value as number) || typeof value !== "number";
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
}

function normalizeCode(value: unknown): string {
  if (typeof value !== "string") throw validationError();
  const code = value.trim().toUpperCase();
  if (code.length < 1 || code.length > 50) throw validationError();
  return code;
}

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") throw validationError();
  const text = value.trim();
  if (text.length < 1 || text.length > maxLength) throw validationError();
  return text;
}

function parseOptionalText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return normalizeText(value, maxLength);
}

function parseOptionalId(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  if (typeof value !== "string") throw validationError();
  return value.trim();
}

function parseRequiredId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw validationError();
  return value.trim();
}

function parseRequiredDate(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || Number.isNaN(Date.parse(value))) throw validationError();
  return value.trim();
}

function parsePositiveQuantity(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw validationError();
  return amount;
}

function parseNonNegativeAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw validationError();
  return amount;
}

function parseOptionalMoneyFilter(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  return parseNonNegativeAmount(value);
}

function parsePositiveMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw validationError();
  return amount;
}

function parseSupplierStatus(value: unknown): "active" | "inactive" {
  if (value !== "active" && value !== "inactive") throw validationError();
  return value;
}

function parseSupplierListStatus(value: string): "active" | "inactive" | "all" {
  if (value !== "active" && value !== "inactive" && value !== "all") throw validationError();
  return value;
}

function parsePurchaseReceiptListStatus(value: string): "draft" | "posted" | "cancelled" | "all" {
  if (value !== "draft" && value !== "posted" && value !== "cancelled" && value !== "all") throw validationError();
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function mapRepositoryError(cause: unknown): ApiError {
  if (isRecord(cause) && cause.code === "23505") {
    return new ApiError({ status: 409, code: "RESOURCE_CONFLICT", message: "Resource conflict." });
  }
  if (isRecord(cause) && cause.code === "23503") {
    return validationError();
  }
  if (isRecord(cause) && cause.code === "23514") {
    return validationError();
  }
  if (isRecord(cause) && cause.code === "22023") {
    return validationError();
  }
  return new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "An internal error occurred." });
}
