import type {
  FoundationRepository,
  PermissionCode,
  SalesDocumentDetailData,
  SalesDocumentListItemData,
} from "../contracts.ts";
import { ApiError } from "../http.ts";

export interface SalesDocumentsContext {
  actorUserId: string;
  organizationId: string;
  permissions: readonly PermissionCode[];
}

export async function listSalesDocuments(
  repository: FoundationRepository,
  context: SalesDocumentsContext,
  url: URL,
): Promise<{ items: SalesDocumentListItemData[]; page: number; page_size: number; total: number }> {
  requireSalesDocumentAccess(context);
  const { page, pageSize } = parsePage(url);
  const search = url.searchParams.get("search")?.trim() || undefined;
  const isExactDocumentSearch = search !== undefined && /^[A-Z]{2}[A-Z0-9]*[0-9]{3,}(?:\.[0-9]{2})?$/.test(search);
  const result = await repository.listSalesDocuments({
    organizationId: context.organizationId,
    search,
    type: parseOptionalEnum(url.searchParams.get("type"), ["quote", "invoice"]),
    status: parseOptionalEnum(url.searchParams.get("status"), ["active", "converted", "completed", "cancelled"]),
    customerId: parseOptionalId(url.searchParams.get("customer_id")),
    paymentStatus: parseOptionalEnum(url.searchParams.get("payment_status"), ["not_applicable", "unpaid", "partial", "paid"]),
    paymentMethod: parseOptionalEnum(url.searchParams.get("payment_method"), ["cash", "bank_transfer"]),
    createdBy: parseOptionalId(url.searchParams.get("created_by")),
    priceListId: parseOptionalId(url.searchParams.get("price_list_id")),
    from: isExactDocumentSearch ? undefined : url.searchParams.get("from")?.trim() || undefined,
    to: isExactDocumentSearch ? undefined : url.searchParams.get("to")?.trim() || undefined,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function getSalesDocument(
  repository: FoundationRepository,
  context: SalesDocumentsContext,
  orderId: string,
): Promise<SalesDocumentDetailData> {
  requireSalesDocumentAccess(context);
  const result = await repository.getSalesDocument({ organizationId: context.organizationId, orderId });
  if (result === null) throw notFound();
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

function parseOptionalEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (value === null || value === "") return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw validationError();
}

function parseOptionalId(value: string | null): string | undefined {
  if (value === null || value.trim() === "") return undefined;
  return value.trim();
}

function requireSalesDocumentAccess(context: SalesDocumentsContext): void {
  if (!context.permissions.includes("perm.create_order") && !context.permissions.includes("perm.manage_finance")) {
    throw new ApiError({ status: 403, code: "PERMISSION_DENIED", message: "Permission denied." });
  }
}

function validationError(): ApiError {
  return new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Invalid request." });
}

function notFound(): ApiError {
  return new ApiError({ status: 404, code: "RESOURCE_NOT_FOUND", message: "The requested resource was not found." });
}
