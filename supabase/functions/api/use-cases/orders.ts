import type { CheckoutResultData, FoundationRepository, PermissionCode, QuoteReopenPayloadData, QuoteSummaryData } from "../contracts.ts";
import { ApiError } from "../http.ts";

export interface OrderContext {
  actorUserId: string;
  organizationId: string;
  permissions: readonly PermissionCode[];
}

export async function checkoutOrder(
  repository: FoundationRepository,
  context: OrderContext,
  body: unknown,
): Promise<CheckoutResultData> {
  requireAnyPermission(context, ["perm.create_order"]);
  const payload = parseCheckoutPayload(body);
  if (payloadHasDiscount(payload)) {
    requireAnyPermission(context, ["perm.apply_discount"]);
  }

  try {
    return await repository.checkoutOrder({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      payload,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function saveQuote(
  repository: FoundationRepository,
  context: OrderContext,
  body: unknown,
): Promise<QuoteSummaryData> {
  requireAnyPermission(context, ["perm.create_order"]);
  const payload = parseQuotePayload(body);
  if (payloadHasDiscount(payload)) {
    requireAnyPermission(context, ["perm.apply_discount"]);
  }

  try {
    return await repository.saveQuote({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      payload,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function getQuoteReopenPayload(
  repository: FoundationRepository,
  context: OrderContext,
  quoteId: string,
): Promise<QuoteReopenPayloadData> {
  requireAnyPermission(context, ["perm.create_order"]);

  try {
    const payload = await repository.getQuoteReopenPayload({
      organizationId: context.organizationId,
      quoteId,
    });
    if (payload === null) {
      throw new ApiError({
        status: 404,
        code: "RESOURCE_NOT_FOUND",
        message: "The requested resource was not found.",
      });
    }
    return payload;
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function reviseInvoice(
  repository: FoundationRepository,
  context: OrderContext,
  orderId: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  requireAnyPermission(context, ["perm.edit_order_locked"]);
  const payload = parseRevisionPayload(body);

  try {
    const result = await repository.reviseInvoice({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      orderId,
      payload,
    });
    if (result.status === "not_implemented") {
      throw invoiceRevisionDisabled();
    }
    return result;
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

function requireAnyPermission(context: OrderContext, allowed: PermissionCode[]): void {
  if (!allowed.some((permission) => context.permissions.includes(permission))) {
    throw new ApiError({
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Permission denied.",
    });
  }
}

function parseCheckoutPayload(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw validationError();
  const payment = isRecord(body.payment) ? body.payment : null;
  if (payment === null) throw validationError();

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw validationError();
  for (const item of items) parseCheckoutItem(item);

  const cashAmount = parseMoney(payment.cash_amount ?? 0);
  const bankAmount = parseMoney(payment.bank_amount ?? 0);
  const oldDebtPaymentAmount = parseMoney(payment.old_debt_payment_amount ?? 0);
  const changeReturnedAmount = parseMoney(payment.change_returned_amount ?? 0);

  if (bankAmount > 0 && !isNonEmptyString(payment.bank_account_id)) {
    throw validationError();
  }

  if (oldDebtPaymentAmount > 0 && !isNonEmptyString(body.customer_id)) {
    throw validationError();
  }

  const payload: Record<string, unknown> = { ...body };
  payload.payment = {
    ...payment,
    cash_amount: cashAmount,
    bank_amount: bankAmount,
    old_debt_payment_amount: oldDebtPaymentAmount,
    change_returned_amount: changeReturnedAmount,
  };
  return payload;
}

function parseQuotePayload(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw validationError();
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw validationError();
  for (const item of items) parseCheckoutItem(item);
  return { ...body };
}

function parseCheckoutItem(value: unknown): void {
  if (!isRecord(value)) throw validationError();
  if (!isNonEmptyString(value.product_id)) throw validationError();
  const quantity = parsePositiveNumber(value.quantity);
  const unitPrice = parseMoney(value.unit_price);
  const discountAmount = parseMoney(value.discount_amount ?? 0);
  if (discountAmount > Math.round(quantity * unitPrice)) throw validationError();
  if (!isNonEmptyString(value.price_source)) throw validationError();
}

function payloadHasDiscount(payload: Record<string, unknown>): boolean {
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.some((item) =>
    isRecord(item) && typeof item.discount_amount === "number" && item.discount_amount > 0
  );
}

function parseRevisionPayload(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw validationError();
  if (!isNonEmptyString(body.revision_reason)) throw validationError();
  return body;
}

function parseMoney(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw validationError();
  return value;
}

function parsePositiveNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw validationError();
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validationError(): ApiError {
  return new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Invalid request." });
}

function mapRepositoryError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;
  if (isRecord(cause) && cause.code === "0A000") {
    return invoiceRevisionDisabled();
  }
  if (isRecord(cause) && cause.code === "22023") {
    return validationError();
  }
  if (isRecord(cause) && cause.code === "23503") {
    return new ApiError({
      status: 404,
      code: "RESOURCE_NOT_FOUND",
      message: "The requested resource was not found.",
    });
  }
  return new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "An internal error occurred." });
}

function invoiceRevisionDisabled(): ApiError {
  return new ApiError({
    status: 409,
    code: "RESOURCE_CONFLICT",
    message: "Invoice revision is not implemented yet.",
  });
}
