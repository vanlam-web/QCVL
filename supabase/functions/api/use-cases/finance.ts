import type {
  CashbookBalanceData,
  CashbookEntryDetailData,
  CashbookVoucherData,
  CustomerDebtDetailData,
  CustomerDebtSummaryData,
  DebtCollectionResultData,
  FinanceAccountData,
  FoundationRepository,
  PermissionCode,
  ReconciliationData,
  PaymentReceiptDetailData,
  RetailDebtInvoiceData,
} from "../contracts.ts";
import { ApiError } from "../http.ts";

export interface FinanceContext {
  actorUserId: string;
  organizationId: string;
  permissions: readonly PermissionCode[];
}

export async function listFinanceAccounts(
  repository: FoundationRepository,
  context: FinanceContext,
  url: URL,
): Promise<{ items: FinanceAccountData[] }> {
  requireAnyPermission(context, ["perm.view_shift_report", "perm.manage_finance", "perm.manage_inventory"]);
  const accountType = parseOptionalEnum(url.searchParams.get("account_type"), ["cash", "bank"]);
  const isActive = parseOptionalBoolean(url.searchParams.get("is_active"));
  return {
    items: await repository.listFinanceAccounts({
      organizationId: context.organizationId,
      accountType,
      isActive,
    }),
  };
}

export async function listCustomerDebts(
  repository: FoundationRepository,
  context: FinanceContext,
  url: URL,
): Promise<{ items: CustomerDebtSummaryData[]; page: number; page_size: number; total: number }> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_finance"]);
  const { search, page, pageSize } = parsePagedSearch(url);
  const result = await repository.listCustomerDebts({
    organizationId: context.organizationId,
    search,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function getCustomerDebt(
  repository: FoundationRepository,
  context: FinanceContext,
  customerId: string,
): Promise<CustomerDebtDetailData> {
  requireAnyPermission(context, ["perm.create_order", "perm.manage_finance"]);
  const result = await repository.getCustomerDebt({ organizationId: context.organizationId, customerId });
  if (result === null) throw notFound();
  return result;
}

export async function listRetailDebts(
  repository: FoundationRepository,
  context: FinanceContext,
  url: URL,
): Promise<{ items: RetailDebtInvoiceData[]; page: number; page_size: number; total: number }> {
  requireAnyPermission(context, ["perm.manage_finance"]);
  const { page, pageSize } = parsePagedSearch(url);
  const result = await repository.listRetailDebts({
    organizationId: context.organizationId,
    page,
    pageSize,
  });
  return { items: result.items, page, page_size: pageSize, total: result.total };
}

export async function collectCustomerDebt(
  repository: FoundationRepository,
  context: FinanceContext,
  body: unknown,
): Promise<DebtCollectionResultData> {
  requireAnyPermission(context, ["perm.manage_finance"]);
  const payload = parseDebtCollectionPayload(body);
  try {
    return await repository.collectCustomerDebt({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      payload,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function createCashbookVoucher(
  repository: FoundationRepository,
  context: FinanceContext,
  body: unknown,
): Promise<CashbookVoucherData> {
  requireAnyPermission(context, ["perm.manage_finance"]);
  const payload = parseCashbookVoucherPayload(body);
  try {
    return await repository.createCashbookVoucher({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      payload,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function cancelCashbookVoucher(
  repository: FoundationRepository,
  context: FinanceContext,
  voucherId: string,
): Promise<CashbookVoucherData> {
  requireAnyPermission(context, ["perm.manage_finance"]);
  try {
    return await repository.cancelCashbookVoucher({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      voucherId,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function reviseCashbookVoucher(
  repository: FoundationRepository,
  context: FinanceContext,
  voucherId: string,
  body: unknown,
): Promise<CashbookVoucherData> {
  requireAnyPermission(context, ["perm.manage_finance"]);
  const payload = parseCashbookVoucherPayload(body);
  try {
    return await repository.reviseCashbookVoucher({
      organizationId: context.organizationId,
      actorUserId: context.actorUserId,
      voucherId,
      payload,
    });
  } catch (cause) {
    throw mapRepositoryError(cause);
  }
}

export async function listCashbookBalances(
  repository: FoundationRepository,
  context: FinanceContext,
): Promise<{ items: CashbookBalanceData[] }> {
  requireAnyPermission(context, ["perm.view_shift_report", "perm.manage_finance"]);
  return { items: await repository.listCashbookBalances({ organizationId: context.organizationId }) };
}

export async function listCashbookEntries(
  repository: FoundationRepository,
  context: FinanceContext,
  url: URL,
) {
  requireAnyPermission(context, ["perm.view_shift_report", "perm.manage_finance"]);
  const { page, pageSize } = parsePagedSearch(url);
  const search = url.searchParams.get("search")?.trim() || undefined;
  const searchScope = parseOptionalEnum(url.searchParams.get("search_scope"), ["code", "note", "transfer_content"]);
  const isExactVoucherSearch = (searchScope === "code" || searchScope === undefined) &&
    search !== undefined &&
    /^[A-Z]{2,}[A-Z0-9]*[0-9]{3,}(?:\.[0-9]{2})?$/.test(search);
  return await repository.listCashbookEntries({
    organizationId: context.organizationId,
    financeAccountId: url.searchParams.get("finance_account_id")?.trim() || undefined,
    financeAccountType: parseOptionalEnum(url.searchParams.get("finance_account_type"), ["cash", "bank"]),
    search,
    searchScope,
    direction: parseOptionalEnum(url.searchParams.get("direction"), ["in", "out"]),
    sourceType: parseOptionalEnum(url.searchParams.get("source_type"), ["payment_receipt_method", "cashbook_voucher"]),
    status: parseOptionalEnum(url.searchParams.get("status"), ["posted", "cancelled"]),
    isBusinessAccounted: parseOptionalBoolean(url.searchParams.get("is_business_accounted")),
    from: isExactVoucherSearch ? undefined : url.searchParams.get("from")?.trim() || undefined,
    to: isExactVoucherSearch ? undefined : url.searchParams.get("to")?.trim() || undefined,
    page,
    pageSize,
  });
}

export async function getCashbookEntry(
  repository: FoundationRepository,
  context: FinanceContext,
  entryId: string,
): Promise<CashbookEntryDetailData> {
  requireAnyPermission(context, ["perm.view_shift_report", "perm.manage_finance"]);
  const result = await repository.getCashbookEntry({ organizationId: context.organizationId, entryId });
  if (result === null) throw notFound();
  return result;
}

export async function getPaymentReceipt(
  repository: FoundationRepository,
  context: FinanceContext,
  receiptId: string,
): Promise<PaymentReceiptDetailData> {
  requireAnyPermission(context, ["perm.view_shift_report", "perm.manage_finance"]);
  const result = await repository.getPaymentReceipt({ organizationId: context.organizationId, receiptId });
  if (result === null) throw notFound();
  return result;
}

export async function listCashbookVouchers(
  repository: FoundationRepository,
  context: FinanceContext,
): Promise<{ items: CashbookVoucherData[]; total: number }> {
  requireAnyPermission(context, ["perm.view_shift_report", "perm.manage_finance"]);
  return await repository.listCashbookVouchers({ organizationId: context.organizationId });
}

export async function listReconciliations(
  repository: FoundationRepository,
  context: FinanceContext,
): Promise<{ items: ReconciliationData[]; total: number }> {
  requireAnyPermission(context, ["perm.manage_finance"]);
  return await repository.listReconciliations({ organizationId: context.organizationId });
}

function parseDebtCollectionPayload(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw validationError();
  if (!isNonEmptyString(body.customer_id)) throw validationError();
  const amount = parseMoney(body.amount);
  const method = isRecord(body.payment_method) ? body.payment_method : null;
  if (method === null) throw validationError();

  const cashAmount = parseMoney(method.cash_amount ?? 0);
  const bankAmount = parseMoney(method.bank_amount ?? 0);
  if (amount !== cashAmount + bankAmount) throw validationError();
  if (bankAmount > 0 && !isNonEmptyString(method.bank_account_id)) throw validationError();

  return {
    customer_id: body.customer_id,
    cash_amount: cashAmount,
    bank_amount: bankAmount,
    bank_account_id: isNonEmptyString(method.bank_account_id) ? method.bank_account_id : null,
    bank_transaction_ref: isNonEmptyString(method.bank_transaction_ref) ? method.bank_transaction_ref : null,
    note: isNonEmptyString(body.note) ? body.note.trim() : null,
  };
}

function parseCashbookVoucherPayload(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw validationError();
  const direction = parseRequiredEnum(body.voucher_direction, ["in", "out"]);
  const voucherType = parseRequiredEnum(body.voucher_type, [
    "other_income",
    "capital_contribution",
    "transfer",
    "material_purchase",
    "supplier_payment",
    "staff_salary",
    "shipping_expense",
    "customer_refund",
    "operating_expense",
    "tax_or_vat",
    "commission",
    "other_expense",
  ]);
  const inTypes = ["other_income", "capital_contribution", "transfer"];
  const outTypes = [
    "transfer",
    "material_purchase",
    "supplier_payment",
    "staff_salary",
    "shipping_expense",
    "customer_refund",
    "operating_expense",
    "tax_or_vat",
    "commission",
    "other_expense",
  ];
  if (direction === "in" && !inTypes.includes(voucherType)) throw validationError();
  if (direction === "out" && !outTypes.includes(voucherType)) throw validationError();
  if (!isNonEmptyString(body.finance_account_id)) throw validationError();
  const amount = parseMoney(body.amount);
  if (amount <= 0) throw validationError();
  const counterpartyType = parseOptionalEnumValue(body.counterparty_type, [
    "customer",
    "supplier",
    "employee",
    "other",
    "none",
  ]) ?? "none";
  if (!isNonEmptyString(body.reason)) throw validationError();
  const partnerDebtMode = parseOptionalEnumValue(body.partner_debt_mode, [
    "affects_partner_debt",
    "not_affect_partner_debt",
    "no_partner_debt",
  ]) ?? "no_partner_debt";

  return {
    voucher_direction: direction,
    voucher_type: voucherType,
    finance_account_id: body.finance_account_id.trim(),
    amount,
    partner_debt_mode: partnerDebtMode,
    is_business_accounted: typeof body.is_business_accounted === "boolean" ? body.is_business_accounted : true,
    counterparty_type: counterpartyType,
    counterparty_name: isNonEmptyString(body.counterparty_name) ? body.counterparty_name.trim() : null,
    counterparty_phone: isNonEmptyString(body.counterparty_phone) ? body.counterparty_phone.trim() : null,
    reason: body.reason.trim(),
  };
}

function parsePagedSearch(url: URL): { search?: string; page: number; pageSize: number } {
  const search = url.searchParams.get("search")?.trim();
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validationError();
  }
  if (search !== undefined && search.length > 100) throw validationError();
  return { search: search || undefined, page, pageSize };
}

function parseOptionalEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (value === null || value === "") return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw validationError();
}

function parseOptionalEnumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw validationError();
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw validationError();
}

function parseRequiredEnum<T extends string>(value: unknown, allowed: readonly T[]): T {
  const parsed = parseOptionalEnumValue(value, allowed);
  if (parsed === undefined) throw validationError();
  return parsed;
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value === null || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw validationError();
}

function parseMoney(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw validationError();
  return value;
}

function requireAnyPermission(context: FinanceContext, allowed: PermissionCode[]): void {
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
