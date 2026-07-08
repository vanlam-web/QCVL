import type { FoundationRepository } from "../contracts.ts";
import { ApiError, successResponse } from "../http.ts";
import type { AuthClient } from "../middleware/auth.ts";
import { requireAuth } from "../middleware/auth.ts";
import {
  collectCustomerDebt,
  cancelCashbookVoucher,
  createCashbookVoucher,
  getCashbookEntry,
  getCustomerDebt,
  getPaymentReceipt,
  listCashbookBalances,
  listCashbookEntries,
  listCashbookVouchers,
  listCustomerDebts,
  listFinanceAccounts,
  listRetailDebts,
  listReconciliations,
  reviseCashbookVoucher,
} from "../use-cases/finance.ts";

export interface FinanceRouteDependencies {
  auth: AuthClient;
  repository: FoundationRepository;
}

export async function handleFinance(
  request: Request,
  traceId: string,
  dependencies: FinanceRouteDependencies,
): Promise<Response> {
  const authUser = await requireAuth(request, dependencies.auth);
  const currentUser = await dependencies.repository.getCurrentUser({
    userId: authUser.id,
    email: authUser.email,
    workstationId: request.headers.get("x-workstation-id"),
  });
  if (currentUser === null) {
    throw new ApiError({ status: 403, code: "ACCOUNT_INACTIVE", message: "Account is inactive." });
  }
  if (currentUser.workstationInvalid) {
    throw new ApiError({ status: 403, code: "WORKSTATION_INVALID", message: "Workstation is invalid." });
  }

  const context = {
    actorUserId: currentUser.user.id,
    organizationId: currentUser.organization.id,
    permissions: currentUser.permissions,
  };
  const url = new URL(request.url);

  if (url.pathname === "/api/v1/finance/accounts" && request.method === "GET") {
    return successResponse(await listFinanceAccounts(dependencies.repository, context, url), traceId);
  }

  if (url.pathname === "/api/v1/finance/customer-debts" && request.method === "GET") {
    return successResponse(await listCustomerDebts(dependencies.repository, context, url), traceId);
  }

  if (url.pathname === "/api/v1/finance/retail-debts" && request.method === "GET") {
    return successResponse(await listRetailDebts(dependencies.repository, context, url), traceId);
  }

  const customerDebtMatch = url.pathname.match(/^\/api\/v1\/finance\/customers\/([^/]+)\/debt$/);
  if (customerDebtMatch !== null && request.method === "GET") {
    return successResponse(await getCustomerDebt(dependencies.repository, context, customerDebtMatch[1]), traceId);
  }

  if (url.pathname === "/api/v1/finance/debt-collections" && request.method === "POST") {
    return successResponse(
      await collectCustomerDebt(dependencies.repository, context, await request.json()),
      traceId,
      { status: 201 },
    );
  }

  if (url.pathname === "/api/v1/finance/cashbook" && request.method === "GET") {
    return successResponse(await listCashbookEntries(dependencies.repository, context, url), traceId);
  }

  if (url.pathname === "/api/v1/finance/cashbook/balances" && request.method === "GET") {
    return successResponse(await listCashbookBalances(dependencies.repository, context), traceId);
  }

  if (url.pathname === "/api/v1/finance/cashbook/vouchers" && request.method === "GET") {
    return successResponse(await listCashbookVouchers(dependencies.repository, context), traceId);
  }

  if (url.pathname === "/api/v1/finance/cashbook-vouchers" && request.method === "POST") {
    return successResponse(
      await createCashbookVoucher(dependencies.repository, context, await request.json()),
      traceId,
      { status: 201 },
    );
  }

  const cashbookVoucherCancelMatch = url.pathname.match(/^\/api\/v1\/finance\/cashbook-vouchers\/([^/]+)\/cancel$/);
  if (cashbookVoucherCancelMatch !== null && request.method === "POST") {
    return successResponse(
      await cancelCashbookVoucher(dependencies.repository, context, cashbookVoucherCancelMatch[1]),
      traceId,
    );
  }

  const cashbookVoucherReviseMatch = url.pathname.match(/^\/api\/v1\/finance\/cashbook-vouchers\/([^/]+)\/revise$/);
  if (cashbookVoucherReviseMatch !== null && request.method === "POST") {
    return successResponse(
      await reviseCashbookVoucher(dependencies.repository, context, cashbookVoucherReviseMatch[1], await request.json()),
      traceId,
    );
  }

  const cashbookEntryMatch = url.pathname.match(/^\/api\/v1\/finance\/cashbook\/([^/]+)$/);
  if (cashbookEntryMatch !== null && request.method === "GET") {
    return successResponse(await getCashbookEntry(dependencies.repository, context, cashbookEntryMatch[1]), traceId);
  }

  const paymentReceiptMatch = url.pathname.match(/^\/api\/v1\/finance\/payment-receipts\/([^/]+)$/);
  if (paymentReceiptMatch !== null && request.method === "GET") {
    return successResponse(await getPaymentReceipt(dependencies.repository, context, paymentReceiptMatch[1]), traceId);
  }

  if (url.pathname === "/api/v1/finance/reconciliations" && request.method === "GET") {
    return successResponse(await listReconciliations(dependencies.repository, context), traceId);
  }

  throw new ApiError({
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found.",
  });
}
