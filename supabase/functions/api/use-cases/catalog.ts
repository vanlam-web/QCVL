import type {
  CustomerData,
  CustomerGroupData,
  FoundationRepository,
  PermissionCode,
  PriceListData,
  PriceFormulaPreviewData,
  ProductGroupData,
  ProductBomData,
  ProductData,
  ProductKind,
  ProductStatus,
  ResolvedPriceData,
  SellMethod,
} from "../contracts.ts";
import { ApiError } from "../http.ts";

export interface CatalogContext {
  organizationId: string;
  actorUserId?: string;
  permissions: readonly PermissionCode[];
}

export interface ProductListResponse {
  items: ProductData[];
  page: number;
  page_size: number;
  total: number;
}

export interface PriceListResponse {
  items: PriceListData[];
}

export interface ProductGroupListResponse {
  items: ProductGroupData[];
}

export interface CustomerListResponse {
  items: CustomerData[];
  page: number;
  page_size: number;
  total: number;
}

export interface CustomerGroupListResponse {
  items: CustomerGroupData[];
}

export interface ResolvePricesResponse {
  items: ResolvedPriceData[];
}

export interface PriceFormulaApplyResponse {
  formula_rule_id: string;
  affected_count: number;
}

const sellMethods = new Set<SellMethod>(["quantity", "area_m2", "linear_m", "sheet", "combo"]);
const productKinds = new Set<ProductKind>(["goods", "service", "auxiliary_material", "roll", "sheet", "combo"]);

export function requireAnyPermission(context: CatalogContext, allowed: PermissionCode[]): void {
  if (!allowed.some((permission) => context.permissions.includes(permission))) {
    throw new ApiError({
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Permission denied.",
    });
  }
}

export async function listProducts(
  repository: FoundationRepository,
  context: CatalogContext,
  url: URL,
): Promise<ProductListResponse> {
  requireAnyPermission(context, ["perm.create_order", "perm.edit_price_book", "perm.manage_inventory"]);
  const { search, status, sellMethod, inventoryShape, productKind, productGroupId, page, pageSize } = parseListProducts(url, context.permissions);
  const result = await repository.listProducts({
    organizationId: context.organizationId,
    search,
    status,
    sellMethod,
    inventoryShape,
    productKind,
    productGroupId,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function createProduct(
  repository: FoundationRepository,
  context: CatalogContext,
  body: unknown,
): Promise<ProductData> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const input = parseProductCreate(body);

  try {
    return await repository.createProduct({
      organizationId: context.organizationId,
      ...input,
      latestPurchaseCostUpdatedBy: input.latestPurchaseCost === undefined ? undefined : context.actorUserId,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function listProductGroups(
  repository: FoundationRepository,
  context: CatalogContext,
  url: URL,
): Promise<ProductGroupListResponse> {
  requireAnyPermission(context, ["perm.create_order", "perm.edit_price_book", "perm.manage_inventory"]);
  const activeOnly = url.searchParams.get("active_only") !== "false";
  return await repository.listProductGroups({ organizationId: context.organizationId, activeOnly });
}

export async function createProductGroup(
  repository: FoundationRepository,
  context: CatalogContext,
  body: unknown,
): Promise<ProductGroupData> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const input = parseProductGroupCreate(body);
  try {
    return await repository.createProductGroup({ organizationId: context.organizationId, ...input });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function updateProduct(
  repository: FoundationRepository,
  context: CatalogContext,
  id: string,
  body: unknown,
): Promise<ProductData> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const input = parseProductUpdate(body);

  try {
    const row = await repository.updateProduct({
      organizationId: context.organizationId,
      id,
      ...input,
      latestPurchaseCostUpdatedBy: input.latestPurchaseCost === undefined ? undefined : context.actorUserId,
    });
    if (row === null) throw notFound();
    return row;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw mapRepositoryError(cause);
  }
}

export async function getProductBom(
  repository: FoundationRepository,
  context: CatalogContext,
  productId: string,
): Promise<ProductBomData | null> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  return await repository.getProductBom({ organizationId: context.organizationId, productId });
}

export async function saveProductBom(
  repository: FoundationRepository,
  context: CatalogContext,
  productId: string,
  body: unknown,
): Promise<ProductBomData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  if (context.actorUserId === undefined) throw validationError();
  const input = parseProductBomBody(body);

  try {
    return await repository.saveProductBom({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      productId,
      ...input,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function listPriceLists(
  repository: FoundationRepository,
  context: CatalogContext,
  url: URL,
): Promise<PriceListResponse> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const activeOnly = url.searchParams.get("active_only") !== "false";
  return { items: await repository.listPriceLists({ organizationId: context.organizationId, activeOnly }) };
}

export async function createPriceList(
  repository: FoundationRepository,
  context: CatalogContext,
  body: unknown,
): Promise<PriceListData> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const input = parsePriceListCreate(body);

  try {
    return await repository.createPriceList({ organizationId: context.organizationId, ...input });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function updatePriceList(
  repository: FoundationRepository,
  context: CatalogContext,
  id: string,
  body: unknown,
): Promise<PriceListData> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const input = parsePriceListUpdate(body);

  try {
    const row = await repository.updatePriceList({ organizationId: context.organizationId, id, ...input });
    if (row === null) throw notFound();
    return row;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw mapRepositoryError(cause);
  }
}

export async function upsertPriceListItem(
  repository: FoundationRepository,
  context: CatalogContext,
  priceListId: string,
  productId: string,
  body: unknown,
): Promise<ResolvedPriceData> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const unitPrice = parseUnitPrice(body);

  try {
    return await repository.upsertPriceListItem({
      organizationId: context.organizationId,
      priceListId,
      productId,
      unitPrice,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function deletePriceListItem(
  repository: FoundationRepository,
  context: CatalogContext,
  priceListId: string,
  productId: string,
): Promise<{ deleted: boolean }> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  return {
    deleted: await repository.deletePriceListItem({
      organizationId: context.organizationId,
      priceListId,
      productId,
    }),
  };
}

export async function previewPriceFormula(
  repository: FoundationRepository,
  context: CatalogContext,
  body: unknown,
): Promise<PriceFormulaPreviewData> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const formula = parseFormulaBody(body);
  try {
    return await repository.previewPriceFormula({ organizationId: context.organizationId, formula });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function applyPriceFormula(
  repository: FoundationRepository,
  context: CatalogContext,
  body: unknown,
): Promise<PriceFormulaApplyResponse> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  if (context.actorUserId === undefined) throw validationError();
  const input = parseFormulaApplyBody(body);
  try {
    return await repository.applyPriceFormula({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      formula: input.formula,
      selectedItems: input.selectedItems,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function resolvePrices(
  repository: FoundationRepository,
  context: CatalogContext,
  body: unknown,
): Promise<ResolvePricesResponse> {
  requireAnyPermission(context, ["perm.create_order"]);
  const { productIds, customerId } = parseResolvePrices(body);
  try {
    return { items: await repository.resolvePrices({ organizationId: context.organizationId, productIds, customerId }) };
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function listCustomers(
  repository: FoundationRepository,
  context: CatalogContext,
  url: URL,
): Promise<CustomerListResponse> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_inventory"]);
  const {
    search,
    customerGroupId,
    createdFrom,
    createdTo,
    createdBy,
    totalSalesMin,
    totalSalesMax,
    totalDebtMin,
    totalDebtMax,
    page,
    pageSize,
  } = parseCustomerList(url);
  const result = await repository.listCustomers({
    organizationId: context.organizationId,
    search,
    customerGroupId,
    createdFrom,
    createdTo,
    createdBy,
    totalSalesMin,
    totalSalesMax,
    totalDebtMin,
    totalDebtMax,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function createCustomer(
  repository: FoundationRepository,
  context: CatalogContext,
  body: unknown,
): Promise<CustomerData> {
  requireAnyPermission(context, ["perm.create_order"]);
  if (context.actorUserId === undefined) throw validationError();
  const input = parseCustomerCreate(body);
  try {
    return await repository.createCustomer({ organizationId: context.organizationId, actorUserId: context.actorUserId, ...input });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function updateCustomer(
  repository: FoundationRepository,
  context: CatalogContext,
  id: string,
  body: unknown,
): Promise<CustomerData> {
  requireAnyPermission(context, ["perm.create_order"]);
  const input = parseCustomerUpdate(body);
  try {
    const row = await repository.updateCustomer({ organizationId: context.organizationId, id, ...input });
    if (row === null) throw notFound();
    return row;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw mapRepositoryError(cause);
  }
}

export async function listCustomerGroups(
  repository: FoundationRepository,
  context: CatalogContext,
  url: URL,
): Promise<CustomerGroupListResponse> {
  requireAnyPermission(context, ["perm.create_order", "perm.edit_price_book"]);
  const activeOnly = url.searchParams.get("active_only") !== "false";
  return { items: await repository.listCustomerGroups({ organizationId: context.organizationId, activeOnly }) };
}

export async function createCustomerGroup(
  repository: FoundationRepository,
  context: CatalogContext,
  body: unknown,
): Promise<CustomerGroupData> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const input = parseCustomerGroupCreate(body);
  try {
    return await repository.createCustomerGroup({ organizationId: context.organizationId, ...input });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function updateCustomerGroup(
  repository: FoundationRepository,
  context: CatalogContext,
  id: string,
  body: unknown,
): Promise<CustomerGroupData> {
  requireAnyPermission(context, ["perm.edit_price_book"]);
  const input = parseCustomerGroupUpdate(body);
  try {
    const row = await repository.updateCustomerGroup({ organizationId: context.organizationId, id, ...input });
    if (row === null) throw notFound();
    return row;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw mapRepositoryError(cause);
  }
}

function parseListProducts(
  url: URL,
  permissions: readonly PermissionCode[],
): {
  search?: string;
  status: ProductStatus | "all";
  sellMethod?: SellMethod;
  inventoryShape?: "normal" | "roll" | "sheet";
  productKind?: ProductKind;
  productGroupId?: string;
  page: number;
  pageSize: number;
} {
  const search = url.searchParams.get("search")?.trim();
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  const requestedStatus = url.searchParams.get("status") ?? "active";
  const requestedSellMethod = url.searchParams.get("sell_method") ?? undefined;
  const requestedInventoryShape = url.searchParams.get("inventory_shape") ?? undefined;
  const requestedProductKind = url.searchParams.get("product_kind") ?? undefined;
  const requestedProductGroupId = parseOptionalQueryId(url.searchParams.get("product_group_id"));
  const canEditPriceBook = permissions.includes("perm.edit_price_book");

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationError();
  }
  if (search !== undefined && search.length > 100) {
    throw validationError();
  }
  if (requestedStatus !== "active" && requestedStatus !== "inactive" && requestedStatus !== "all") {
    throw validationError();
  }
  if (requestedSellMethod !== undefined && !sellMethods.has(requestedSellMethod as SellMethod)) {
    throw validationError();
  }
  if (requestedProductKind !== undefined && !productKinds.has(requestedProductKind as ProductKind)) {
    throw validationError();
  }
  if (
    requestedInventoryShape !== undefined &&
    requestedInventoryShape !== "normal" &&
    requestedInventoryShape !== "roll" &&
    requestedInventoryShape !== "sheet"
  ) {
    throw validationError();
  }

  return {
    search: search || undefined,
    status: canEditPriceBook ? requestedStatus : "active",
    sellMethod: requestedSellMethod as SellMethod | undefined,
    inventoryShape: requestedInventoryShape as "normal" | "roll" | "sheet" | undefined,
    productKind: requestedProductKind as ProductKind | undefined,
    productGroupId: requestedProductGroupId,
    page,
    pageSize,
  };
}

function parseProductCreate(body: unknown): {
  code: string;
  name: string;
  status: ProductStatus;
  productKind: ProductKind;
  unitName: string;
  sellMethod: SellMethod;
  inventoryShape?: "normal" | "roll" | "sheet";
  trackInventory?: boolean;
  productGroupId?: string | null;
  latestPurchaseCost?: number | null;
  unitConversions?: Array<{
    unitName: string;
    stockQtyPerUnit: number;
    isDefaultPurchaseUnit: boolean;
    isDefaultSaleUnit: boolean;
  }>;
} {
  if (!isRecord(body)) throw validationError();
  const sellMethod = parseSellMethod(body.sell_method);
  const inventoryShape = parseOptionalInventoryShape(body.inventory_shape);
  const trackInventory = "track_inventory" in body ? parseBoolean(body.track_inventory) : undefined;
  return {
    code: normalizeCode(body.code),
    name: normalizeText(body.name, 200),
    status: parseStatus(body.status ?? "active"),
    productKind: parseOptionalProductKind(body.product_kind) ?? inferProductKind(sellMethod, inventoryShape, trackInventory),
    unitName: normalizeText(body.unit_name, 30),
    sellMethod,
    inventoryShape,
    trackInventory,
    productGroupId: "product_group_id" in body ? parseOptionalId(body.product_group_id) : undefined,
    latestPurchaseCost: "latest_purchase_cost" in body ? parseOptionalMoney(body.latest_purchase_cost) : undefined,
    unitConversions: "unit_conversions" in body ? parseUnitConversions(body.unit_conversions) : undefined,
  };
}

function parseUnitConversions(value: unknown): Array<{
  unitName: string;
  stockQtyPerUnit: number;
  isDefaultPurchaseUnit: boolean;
  isDefaultSaleUnit: boolean;
}> {
  if (!Array.isArray(value)) throw validationError();
  return value.map((item) => {
    if (!isRecord(item)) throw validationError();
    const stockQtyPerUnit = parsePositiveNumber(item.stock_qty_per_unit);
    return {
      unitName: normalizeText(item.unit_name, 60),
      stockQtyPerUnit,
      isDefaultPurchaseUnit: "is_default_purchase_unit" in item ? parseBoolean(item.is_default_purchase_unit) : false,
      isDefaultSaleUnit: "is_default_sale_unit" in item ? parseBoolean(item.is_default_sale_unit) : false,
    };
  });
}

function parseProductGroupCreate(body: unknown): { name: string; code?: string } {
  if (!isRecord(body)) throw validationError();
  return {
    name: normalizeText(body.name, 120),
    ...("code" in body ? { code: normalizeCode(body.code) } : {}),
  };
}

function parseProductUpdate(body: unknown): {
  code?: string;
  name?: string;
  status?: ProductStatus;
  productKind?: ProductKind;
  unitName?: string;
  sellMethod?: SellMethod;
  latestPurchaseCost?: number | null;
} {
  if (!isRecord(body)) throw validationError();
  const input: {
    code?: string;
    name?: string;
    status?: ProductStatus;
    productKind?: ProductKind;
    unitName?: string;
    sellMethod?: SellMethod;
    latestPurchaseCost?: number | null;
  } = {};
  if ("code" in body) input.code = normalizeCode(body.code);
  if ("name" in body) input.name = normalizeText(body.name, 200);
  if ("status" in body) input.status = parseStatus(body.status);
  if ("product_kind" in body) input.productKind = parseProductKind(body.product_kind);
  if ("unit_name" in body) input.unitName = normalizeText(body.unit_name, 30);
  if ("sell_method" in body) input.sellMethod = parseSellMethod(body.sell_method);
  if ("latest_purchase_cost" in body) input.latestPurchaseCost = parseOptionalMoney(body.latest_purchase_cost);
  if (Object.keys(input).length === 0) throw validationError();
  return input;
}

function parsePriceListCreate(body: unknown): { code: string; name: string; isDefault: boolean } {
  if (!isRecord(body)) throw validationError();
  return {
    code: normalizeCode(body.code),
    name: normalizeText(body.name, 120),
    isDefault: parseBoolean(body.is_default ?? false),
  };
}

function parsePriceListUpdate(body: unknown): {
  code?: string;
  name?: string;
  isDefault?: boolean;
  isActive?: boolean;
} {
  if (!isRecord(body)) throw validationError();
  const input: { code?: string; name?: string; isDefault?: boolean; isActive?: boolean } = {};
  if ("code" in body) input.code = normalizeCode(body.code);
  if ("name" in body) input.name = normalizeText(body.name, 120);
  if ("is_default" in body) input.isDefault = parseBoolean(body.is_default);
  if ("is_active" in body) input.isActive = parseBoolean(body.is_active);
  if (Object.keys(input).length === 0) throw validationError();
  return input;
}

function parseUnitPrice(body: unknown): number {
  if (!isRecord(body)) throw validationError();
  const value = body.unit_price;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw validationError();
  return value;
}

function parseOptionalMoney(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw validationError();
  return value;
}

function parsePositiveNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw validationError();
  return value;
}

function parseFormulaBody(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw validationError();
  return body;
}

function parseFormulaApplyBody(body: unknown): {
  formula: Record<string, unknown>;
  selectedItems: Array<{ product_id: string; price_list_id: string }>;
} {
  if (!isRecord(body) || !isRecord(body.formula) || !Array.isArray(body.selected_items)) throw validationError();
  const selectedItems = body.selected_items.map((item) => {
    if (!isRecord(item)) throw validationError();
    return {
      product_id: parseRequiredId(item.product_id),
      price_list_id: parseRequiredId(item.price_list_id),
    };
  });
  if (selectedItems.length < 1 || selectedItems.length > 1000) throw validationError();
  return { formula: body.formula, selectedItems };
}

function parseResolvePrices(body: unknown): { productIds: string[]; customerId?: string } {
  if (!isRecord(body) || !Array.isArray(body.product_ids)) throw validationError();
  const productIds = [...new Set(body.product_ids)];
  if (
    productIds.length < 1 ||
    productIds.length > 100 ||
    !productIds.every((id) => typeof id === "string" && id.trim().length > 0)
  ) {
    throw validationError();
  }
  let customerId: string | undefined;
  if ("customer_id" in body && body.customer_id !== null && body.customer_id !== undefined) {
    if (typeof body.customer_id !== "string" || body.customer_id.trim().length === 0) throw validationError();
    customerId = body.customer_id.trim();
  }
  return { productIds: productIds.map((id) => id.trim()), customerId };
}

function parseCustomerList(url: URL): {
  search?: string;
  customerGroupId?: string;
  createdFrom?: string;
  createdTo?: string;
  createdBy?: string;
  totalSalesMin?: number;
  totalSalesMax?: number;
  totalDebtMin?: number;
  totalDebtMax?: number;
  page: number;
  pageSize: number;
} {
  const search = url.searchParams.get("search")?.trim();
  const customerGroupId = parseOptionalQueryId(url.searchParams.get("customer_group_id"));
  const createdFrom = parseOptionalDateFilter(url.searchParams.get("created_from"));
  const createdTo = parseOptionalDateFilter(url.searchParams.get("created_to"));
  const createdBy = parseOptionalQueryId(url.searchParams.get("created_by"));
  const totalSalesMin = parseOptionalMoneyFilter(url.searchParams.get("total_sales_min"));
  const totalSalesMax = parseOptionalMoneyFilter(url.searchParams.get("total_sales_max"));
  const totalDebtMin = parseOptionalMoneyFilter(url.searchParams.get("total_debt_min"));
  const totalDebtMax = parseOptionalMoneyFilter(url.searchParams.get("total_debt_max"));
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationError();
  }
  if (search !== undefined && search.length > 100) throw validationError();
  return {
    search: search || undefined,
    customerGroupId,
    createdFrom,
    createdTo,
    createdBy,
    totalSalesMin,
    totalSalesMax,
    totalDebtMin,
    totalDebtMax,
    page,
    pageSize,
  };
}

function parseCustomerCreate(body: unknown): {
  code?: string;
  name: string;
  phone?: string;
  taxCode?: string;
  address?: string;
  customerGroupId?: string | null;
} {
  if (!isRecord(body)) throw validationError();
  const input: {
    code?: string;
    name: string;
    phone?: string;
    taxCode?: string;
    address?: string;
    customerGroupId?: string | null;
  } = { name: normalizeText(body.name, 200) };
  if ("code" in body && body.code !== null && body.code !== undefined && String(body.code).trim() !== "") {
    input.code = normalizeCustomerCode(body.code);
  }
  if ("phone" in body && body.phone !== null && body.phone !== undefined && String(body.phone).trim() !== "") {
    input.phone = normalizeText(body.phone, 30);
  }
  if ("tax_code" in body && body.tax_code !== null && body.tax_code !== undefined && String(body.tax_code).trim() !== "") {
    input.taxCode = normalizeText(body.tax_code, 50);
  }
  if ("address" in body && body.address !== null && body.address !== undefined && String(body.address).trim() !== "") {
    input.address = normalizeText(body.address, 300);
  }
  if ("customer_group_id" in body) {
    input.customerGroupId = parseOptionalId(body.customer_group_id);
  }
  return input;
}

function parseCustomerUpdate(body: unknown): {
  code?: string;
  name?: string;
  phone?: string | null;
  taxCode?: string | null;
  address?: string | null;
  customerGroupId?: string | null;
} {
  if (!isRecord(body)) throw validationError();
  const input: {
    code?: string;
    name?: string;
    phone?: string | null;
    taxCode?: string | null;
    address?: string | null;
    customerGroupId?: string | null;
  } = {};
  if ("code" in body) input.code = normalizeCustomerCode(body.code);
  if ("name" in body) input.name = normalizeText(body.name, 200);
  if ("phone" in body) input.phone = body.phone === null ? null : normalizeText(body.phone, 30);
  if ("tax_code" in body) input.taxCode = body.tax_code === null ? null : normalizeText(body.tax_code, 50);
  if ("address" in body) input.address = body.address === null ? null : normalizeText(body.address, 300);
  if ("customer_group_id" in body) input.customerGroupId = parseOptionalId(body.customer_group_id);
  if (Object.keys(input).length === 0) throw validationError();
  return input;
}

function parseCustomerGroupCreate(body: unknown): { code: string; name: string; priceListId: string } {
  if (!isRecord(body)) throw validationError();
  return {
    code: normalizeCode(body.code),
    name: normalizeText(body.name, 120),
    priceListId: parseRequiredId(body.price_list_id),
  };
}

function parseCustomerGroupUpdate(body: unknown): {
  code?: string;
  name?: string;
  priceListId?: string;
  isActive?: boolean;
} {
  if (!isRecord(body)) throw validationError();
  const input: { code?: string; name?: string; priceListId?: string; isActive?: boolean } = {};
  if ("code" in body) input.code = normalizeCode(body.code);
  if ("name" in body) input.name = normalizeText(body.name, 120);
  if ("price_list_id" in body) input.priceListId = parseRequiredId(body.price_list_id);
  if ("is_active" in body) input.isActive = parseBoolean(body.is_active);
  if (Object.keys(input).length === 0) throw validationError();
  return input;
}

function normalizeCode(value: unknown): string {
  if (typeof value !== "string") throw validationError();
  const code = value.trim().toUpperCase();
  if (code.length < 1 || code.length > 50) throw validationError();
  return code;
}

function normalizeCustomerCode(value: unknown): string {
  return normalizeCode(value);
}

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") throw validationError();
  const text = value.trim();
  if (text.length < 1 || text.length > maxLength) throw validationError();
  return text;
}

function parseStatus(value: unknown): ProductStatus {
  if (value !== "active" && value !== "inactive") throw validationError();
  return value;
}

function parseSellMethod(value: unknown): SellMethod {
  if (typeof value !== "string" || !sellMethods.has(value as SellMethod)) throw validationError();
  return value as SellMethod;
}

function parseProductKind(value: unknown): ProductKind {
  if (typeof value !== "string" || !productKinds.has(value as ProductKind)) throw validationError();
  return value as ProductKind;
}

function parseOptionalProductKind(value: unknown): ProductKind | undefined {
  if (value === undefined) return undefined;
  return parseProductKind(value);
}

function inferProductKind(
  sellMethod: SellMethod,
  inventoryShape: "normal" | "roll" | "sheet" | undefined,
  trackInventory: boolean | undefined,
): ProductKind {
  if (sellMethod === "combo") return "combo";
  if (inventoryShape === "roll") return "roll";
  if (inventoryShape === "sheet") return "sheet";
  if (sellMethod === "quantity" && trackInventory === false) return "service";
  return "goods";
}

function parseOptionalInventoryShape(value: unknown): "normal" | "roll" | "sheet" | undefined {
  if (value === undefined) return undefined;
  if (value !== "normal" && value !== "roll" && value !== "sheet") throw validationError();
  return value;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw validationError();
  return value;
}

function parseRequiredId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw validationError();
  return value.trim();
}

function parseOptionalQueryId(value: string | null): string | undefined {
  if (value === null || value.trim() === "") return undefined;
  return value.trim();
}

function parseOptionalDateFilter(value: string | null): string | undefined {
  if (value === null || value.trim() === "") return undefined;
  if (Number.isNaN(Date.parse(value))) throw validationError();
  return value.trim();
}

function parseOptionalMoneyFilter(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw validationError();
  return amount;
}

function parseOptionalId(value: unknown): string | null {
  if (value === null) return null;
  return parseRequiredId(value);
}

function parseProductBomBody(body: unknown): {
  notes?: string | null;
  items: Array<{ componentProductId: string; quantity: number; notes?: string | null }>;
} {
  if (!isRecord(body) || !Array.isArray(body.items) || body.items.length === 0) throw validationError();
  if (body.items.length > 50) throw validationError();
  return {
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    items: body.items.map((item) => {
      if (!isRecord(item)) throw validationError();
      if ("component_role" in item || "role" in item || "is_main" in item || "is_auxiliary" in item) throw validationError();
      const componentProductId = parseRequiredId(item.component_product_id);
      const quantity = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw validationError();
      return {
        componentProductId,
        quantity,
        notes: typeof item.notes === "string" && item.notes.trim() ? item.notes.trim() : null,
      };
    }),
  };
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
    return notFound();
  }
  if (isRecord(cause) && cause.message === "PRODUCT_NOT_FOUND") {
    return notFound();
  }
  if (isRecord(cause) && cause.message === "CUSTOMER_NOT_FOUND") {
    return notFound();
  }
  if (isRecord(cause) && cause.message === "DEFAULT_PRICE_LIST_REQUIRED") {
    return new ApiError({ status: 409, code: "RESOURCE_CONFLICT", message: "Default price list is required." });
  }
  if (isRecord(cause) && String(cause.message).startsWith("FORMULA_")) {
    return new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Invalid price formula." });
  }
  return new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "An internal error occurred." });
}
