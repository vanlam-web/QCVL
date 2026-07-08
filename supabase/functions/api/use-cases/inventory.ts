import type {
  FoundationRepository,
  InventoryRollData,
  InventorySheetData,
  InventoryProductData,
  MaterialOpeningOptionsData,
  MaterialOpeningResultData,
  PermissionCode,
  PosMaterialShortagePreviewData,
  ProductStatus,
  StockMovementData,
  StocktakeData,
} from "../contracts.ts";
import { ApiError } from "../http.ts";

export interface InventoryContext {
  actorUserId: string;
  organizationId: string;
  permissions: readonly PermissionCode[];
}

export async function listInventoryProducts(
  repository: FoundationRepository,
  context: InventoryContext,
  url: URL,
): Promise<{ items: InventoryProductData[]; page: number; page_size: number; total: number }> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_inventory"]);
  const { search, status, inventoryShape, page, pageSize } = parseInventoryProductList(url, context.permissions);
  const result = await repository.listInventoryProducts({
    organizationId: context.organizationId,
    search,
    status,
    inventoryShape,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function getInventoryProduct(
  repository: FoundationRepository,
  context: InventoryContext,
  productId: string,
): Promise<InventoryProductData> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_inventory"]);
  const result = await repository.getInventoryProduct({ organizationId: context.organizationId, productId });
  if (result === null) throw notFound();
  return result;
}

export async function listStockMovements(
  repository: FoundationRepository,
  context: InventoryContext,
  url: URL,
): Promise<{ items: StockMovementData[]; page: number; page_size: number; total: number }> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_inventory"]);
  const { page, pageSize } = parsePage(url);
  const productId = url.searchParams.get("product_id")?.trim() || undefined;
  const orderId = url.searchParams.get("order_id")?.trim() || undefined;
  const result = await repository.listStockMovements({
    organizationId: context.organizationId,
    productId,
    orderId,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function listStocktakes(
  repository: FoundationRepository,
  context: InventoryContext,
  url: URL,
): Promise<{ items: StocktakeData[]; page: number; page_size: number; total: number }> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const { page, pageSize } = parsePage(url);
  const search = url.searchParams.get("search")?.trim() || undefined;
  const status = parseOptionalEnum(url.searchParams.get("status"), ["draft", "balanced", "cancelled"]);
  const createdFrom = url.searchParams.get("created_from")?.trim() || undefined;
  const createdTo = url.searchParams.get("created_to")?.trim() || undefined;
  const result = await repository.listStocktakes({
    organizationId: context.organizationId,
    search,
    status,
    createdFrom,
    createdTo,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function getStocktake(
  repository: FoundationRepository,
  context: InventoryContext,
  stocktakeId: string,
): Promise<StocktakeData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const result = await repository.getStocktake({
    organizationId: context.organizationId,
    stocktakeId,
  });
  if (result === null) throw notFound();
  return result;
}

export async function listInventoryRolls(
  repository: FoundationRepository,
  context: InventoryContext,
  url: URL,
): Promise<{ items: InventoryRollData[]; page: number; page_size: number; total: number }> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_inventory"]);
  const { page, pageSize } = parsePage(url);
  const productId = url.searchParams.get("product_id")?.trim() || undefined;
  const status = parseOptionalEnum(url.searchParams.get("status"), ["available", "in_use", "empty", "discarded"]);
  const result = await repository.listInventoryRolls({
    organizationId: context.organizationId,
    productId,
    status,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function createInventoryRoll(
  repository: FoundationRepository,
  context: InventoryContext,
  body: unknown,
): Promise<InventoryRollData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const payload = parseCreateRoll(body);
  try {
    return await repository.createInventoryRoll({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      ...payload,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function updateInventoryRoll(
  repository: FoundationRepository,
  context: InventoryContext,
  rollId: string,
  body: unknown,
): Promise<InventoryRollData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const payload = parseUpdateRoll(body);
  const result = await repository.updateInventoryRoll({
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    rollId,
    ...payload,
  });
  if (result === null) throw notFound();
  return result;
}

export async function listInventorySheets(
  repository: FoundationRepository,
  context: InventoryContext,
  url: URL,
): Promise<{ items: InventorySheetData[]; page: number; page_size: number; total: number }> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_inventory"]);
  const { page, pageSize } = parsePage(url);
  const productId = url.searchParams.get("product_id")?.trim() || undefined;
  const status = parseOptionalEnum(url.searchParams.get("status"), ["available", "used", "discarded"]);
  const result = await repository.listInventorySheets({
    organizationId: context.organizationId,
    productId,
    status,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function createInventorySheet(
  repository: FoundationRepository,
  context: InventoryContext,
  body: unknown,
): Promise<InventorySheetData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const payload = parseCreateSheet(body);
  try {
    return await repository.createInventorySheet({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      ...payload,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function updateInventorySheet(
  repository: FoundationRepository,
  context: InventoryContext,
  sheetId: string,
  body: unknown,
): Promise<InventorySheetData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const payload = parseUpdateSheet(body);
  const result = await repository.updateInventorySheet({
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    sheetId,
    ...payload,
  });
  if (result === null) throw notFound();
  return result;
}

export function rejectStocktakeMutation(context: InventoryContext): never {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  throw new ApiError({
    status: 400,
    code: "VALIDATION_ERROR",
    message: "Manual stocktake mutations are not implemented yet.",
  });
}

export async function getMaterialOpeningOptions(
  repository: FoundationRepository,
  context: InventoryContext,
  url: URL,
): Promise<MaterialOpeningOptionsData> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_inventory"]);
  const productId = url.searchParams.get("product_id")?.trim();
  if (!productId) throw validationError();
  const result = await repository.getMaterialOpeningOptions({
    organizationId: context.organizationId,
    productId,
  });
  if (result === null) throw notFound();
  return result;
}

export async function createMaterialOpening(
  repository: FoundationRepository,
  context: InventoryContext,
  body: unknown,
): Promise<MaterialOpeningResultData> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_inventory"]);
  const payload = parseMaterialOpening(body);
  try {
    return await repository.createMaterialOpening({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      ...payload,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function previewPosMaterialShortage(
  repository: FoundationRepository,
  context: InventoryContext,
  body: unknown,
): Promise<PosMaterialShortagePreviewData> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_inventory"]);
  const payload = parsePosShortagePreview(body);
  const result = await repository.previewPosMaterialShortage({
    organizationId: context.organizationId,
    productId: payload.productId,
    quantity: payload.quantity,
  });
  if (result === null) throw notFound();
  return result;
}

export async function adjustNormalProductStock(
  repository: FoundationRepository,
  context: InventoryContext,
  productId: string,
  body: unknown,
): Promise<StocktakeData> {
  requireAnyPermission(context, ["perm.manage_inventory"]);
  const { actualQty, reason } = parseStockAdjustment(body);
  try {
    return await repository.adjustNormalProductStock({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      productId,
      actualQty,
      reason,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

function parseCreateRoll(body: unknown): {
  productId: string;
  code: string;
  widthM: number;
  initialLengthM: number;
  remainingLengthM?: number;
  status?: InventoryRollData["status"];
  note?: string | null;
} {
  if (!isRecord(body)) throw validationError();
  const remainingLengthM = body.remaining_length_m === undefined ? undefined : parseNonNegativeNumber(body.remaining_length_m);
  return {
    productId: parseRequiredText(body.product_id),
    code: parseRequiredText(body.code),
    widthM: parsePositiveNumber(body.width_m),
    initialLengthM: parseNonNegativeNumber(body.initial_length_m),
    ...(remainingLengthM === undefined ? {} : { remainingLengthM }),
    status: parseOptionalEnum(typeof body.status === "string" ? body.status : null, ["available", "in_use", "empty", "discarded"]),
    note: typeof body.note === "string" && body.note.trim().length > 0 ? body.note.trim() : null,
  };
}

function parseUpdateRoll(body: unknown): {
  remainingLengthM?: number;
  status?: InventoryRollData["status"];
  reason: string;
} {
  if (!isRecord(body)) throw validationError();
  return {
    remainingLengthM: body.remaining_length_m === undefined ? undefined : parseNonNegativeNumber(body.remaining_length_m),
    status: parseOptionalEnum(typeof body.status === "string" ? body.status : null, ["available", "in_use", "empty", "discarded"]),
    reason: parseRequiredText(body.reason),
  };
}

function parseCreateSheet(body: unknown): {
  productId: string;
  code: string;
  sheetKind: InventorySheetData["sheet_kind"];
  widthM: number;
  lengthM: number;
  status?: InventorySheetData["status"];
  note?: string | null;
} {
  if (!isRecord(body)) throw validationError();
  return {
    productId: parseRequiredText(body.product_id),
    code: parseRequiredText(body.code),
    sheetKind: parseOptionalEnum(typeof body.sheet_kind === "string" ? body.sheet_kind : null, ["full", "in_use", "remnant"]) ?? "full",
    widthM: parsePositiveNumber(body.width_m),
    lengthM: parsePositiveNumber(body.length_m),
    status: parseOptionalEnum(typeof body.status === "string" ? body.status : null, ["available", "used", "discarded"]),
    note: typeof body.note === "string" && body.note.trim().length > 0 ? body.note.trim() : null,
  };
}

function parseUpdateSheet(body: unknown): {
  widthM?: number;
  lengthM?: number;
  status?: InventorySheetData["status"];
  reason: string;
} {
  if (!isRecord(body)) throw validationError();
  return {
    widthM: body.width_m === undefined ? undefined : parsePositiveNumber(body.width_m),
    lengthM: body.length_m === undefined ? undefined : parsePositiveNumber(body.length_m),
    status: parseOptionalEnum(typeof body.status === "string" ? body.status : null, ["available", "used", "discarded"]),
    reason: parseRequiredText(body.reason),
  };
}

function parseMaterialOpening(body: unknown): {
  productId: string;
  inventoryShape: "normal" | "roll" | "sheet";
  openedUnitId?: string;
  openedQty?: number;
  oldRemainingQty?: number;
  oldInventoryRollId?: string;
  oldRemainingLengthM?: number;
  oldInventorySheetId?: string;
  oldRemainingWidthM?: number;
  oldRemainingLengthMForSheet?: number;
  discardOldSheet?: boolean;
  note?: string;
} {
  if (!isRecord(body)) throw validationError();
  if (body.inventory_shape !== "normal" && body.inventory_shape !== "roll" && body.inventory_shape !== "sheet") throw validationError();
  const productId = parseRequiredText(body.product_id);
  const note = typeof body.note === "string" && body.note.trim().length > 0 ? body.note.trim() : undefined;
  if (body.inventory_shape === "normal") {
    return {
      productId,
      inventoryShape: "normal",
      openedUnitId: parseRequiredText(body.opened_unit_id),
      openedQty: parsePositiveNumber(body.opened_qty),
      oldRemainingQty: body.old_remaining_qty === undefined ? undefined : parseNonNegativeNumber(body.old_remaining_qty),
      note,
    };
  }
  if (body.inventory_shape === "roll") {
    return {
      productId,
      inventoryShape: "roll",
      oldInventoryRollId: parseRequiredText(body.old_inventory_roll_id),
      oldRemainingLengthM: parseNonNegativeNumber(body.old_remaining_length_m),
      note,
    };
  }
  const discardOldSheet = body.discard_old_sheet === true;
  return {
    productId,
    inventoryShape: "sheet",
    oldInventorySheetId: parseRequiredText(body.old_inventory_sheet_id),
    oldRemainingWidthM: discardOldSheet ? undefined : parsePositiveNumber(body.old_remaining_width_m),
    oldRemainingLengthMForSheet: discardOldSheet ? undefined : parsePositiveNumber(body.old_remaining_length_m),
    discardOldSheet,
    note,
  };
}

function parsePosShortagePreview(body: unknown): { productId: string; quantity: number } {
  if (!isRecord(body)) throw validationError();
  return {
    productId: parseRequiredText(body.product_id),
    quantity: parsePositiveNumber(body.quantity),
  };
}

function parseInventoryProductList(
  url: URL,
  permissions: readonly PermissionCode[],
): {
  search?: string;
  status: ProductStatus | "all";
  inventoryShape?: "normal" | "roll" | "sheet";
  page: number;
  pageSize: number;
} {
  const { page, pageSize } = parsePage(url);
  const search = url.searchParams.get("search")?.trim();
  const requestedStatus = url.searchParams.get("status") ?? "active";
  const inventoryShape = parseOptionalEnum(url.searchParams.get("inventory_shape"), ["normal", "roll", "sheet"]);
  if (requestedStatus !== "active" && requestedStatus !== "inactive" && requestedStatus !== "all") {
    throw validationError();
  }
  if (search !== undefined && search.length > 100) throw validationError();
  return {
    search: search || undefined,
    status: contextCanManageInventory(permissions) ? requestedStatus : "active",
    inventoryShape,
    page,
    pageSize,
  };
}

function parseStockAdjustment(body: unknown): { actualQty: number; reason: string } {
  if (!isRecord(body)) throw validationError();
  if (typeof body.actual_qty !== "number" || !Number.isFinite(body.actual_qty) || body.actual_qty < 0) {
    throw validationError();
  }
  if (typeof body.reason !== "string" || body.reason.trim().length === 0) throw validationError();
  return { actualQty: body.actual_qty, reason: body.reason.trim() };
}

function parseRequiredText(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw validationError();
  return value.trim();
}

function parsePositiveNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw validationError();
  return value;
}

function parseNonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw validationError();
  return value;
}

function parsePage(url: URL): { page: number; pageSize: number } {
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationError();
  }
  return { page, pageSize };
}

function parseOptionalEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (value === null || value === "") return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw validationError();
}

function contextCanManageInventory(permissions: readonly PermissionCode[]): boolean {
  return permissions.includes("perm.manage_inventory");
}

function requireAnyPermission(context: InventoryContext, allowed: PermissionCode[]): void {
  if (!allowed.some((permission) => context.permissions.includes(permission))) {
    throw new ApiError({ status: 403, code: "PERMISSION_DENIED", message: "Permission denied." });
  }
}

function validationError(): ApiError {
  return new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Invalid request." });
}

function notFound(): ApiError {
  return new ApiError({ status: 404, code: "RESOURCE_NOT_FOUND", message: "The requested resource was not found." });
}

function mapRepositoryError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;
  if (isRecord(cause) && cause.code === "22023") return validationError();
  if (isRecord(cause) && cause.code === "23503") return notFound();
  return new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "An internal error occurred." });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
