import type {
  FoundationRepository,
  PermissionCode,
  ProductionQueueDraftPayloadData,
  ProductionQueueItemData,
} from "../contracts.ts";
import { ApiError } from "../http.ts";

export interface ProductionQueueContext {
  actorUserId: string;
  organizationId: string;
  permissions: readonly PermissionCode[];
}

export async function listProductionQueue(
  repository: FoundationRepository,
  context: ProductionQueueContext,
  url: URL,
): Promise<{ items: ProductionQueueItemData[]; page: number; page_size: number; total: number }> {
  requireCreateOrder(context);
  const { page, pageSize } = parsePage(url);
  const result = await repository.listProductionQueue({
    organizationId: context.organizationId,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function listProductionQueueHistory(
  repository: FoundationRepository,
  context: ProductionQueueContext,
  url: URL,
): Promise<{ items: ProductionQueueItemData[]; page: number; page_size: number; total: number }> {
  requireCreateOrder(context);
  const { page, pageSize } = parsePage(url);
  const result = await repository.listProductionQueueHistory({
    organizationId: context.organizationId,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function addProductionQueueItemToDraft(
  repository: FoundationRepository,
  context: ProductionQueueContext,
  queueItemId: string,
): Promise<ProductionQueueDraftPayloadData> {
  requireCreateOrder(context);
  const result = await repository.addProductionQueueItemToDraft({
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    queueItemId,
  });
  if (result === null) throw conflict();
  return result;
}

export async function dismissProductionQueueItem(
  repository: FoundationRepository,
  context: ProductionQueueContext,
  queueItemId: string,
): Promise<ProductionQueueItemData> {
  requireCreateOrder(context);
  const result = await repository.dismissProductionQueueItem({
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    queueItemId,
  });
  if (result === null) throw conflict();
  return result;
}

export async function restoreProductionQueueItem(
  repository: FoundationRepository,
  context: ProductionQueueContext,
  queueItemId: string,
): Promise<ProductionQueueItemData> {
  requireCreateOrder(context);
  const result = await repository.restoreProductionQueueItem({
    organizationId: context.organizationId,
    actorUserId: context.actorUserId,
    queueItemId,
  });
  if (result === null) throw conflict();
  return result;
}

function parsePage(url: URL): { page: number; pageSize: number } {
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationError();
  }
  return { page, pageSize };
}

function requireCreateOrder(context: ProductionQueueContext): void {
  if (!context.permissions.includes("perm.create_order")) {
    throw new ApiError({ status: 403, code: "PERMISSION_DENIED", message: "Permission denied." });
  }
}

function validationError(): ApiError {
  return new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Invalid request." });
}

function conflict(): ApiError {
  return new ApiError({
    status: 409,
    code: "RESOURCE_CONFLICT",
    message: "Queue item is no longer available.",
  });
}
