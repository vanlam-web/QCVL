import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../sales/sales-routes.js'

export interface FinanceRouteContext {
  request: Request
  url: URL
  currentUser: CurrentUserData
  repository: ServerRepository
}

export interface FinanceRouteHandlers {
  listAccounts(): RouteResult
  createAccount(): RouteResult
  updateAccount(): RouteResult
  listCustomerDebts(): RouteResult
  getCustomerDebt(): RouteResult
  collectCustomerDebt(): RouteResult
  cashbookBalances(): RouteResult
  cashbookVouchers(): RouteResult
  previewKiotVietCashbookImport(): RouteResult
  importKiotVietCashbook(): RouteResult
  deleteImportedKiotVietCashbook(): RouteResult
  previewKiotVietCustomerDebtAdjustmentImport(): RouteResult
  importKiotVietCustomerDebtAdjustments(): RouteResult
  listCashbook(): RouteResult
  getCashbookEntry(): RouteResult
  createCashbookVoucher(): RouteResult
  cancelCashbookVoucher(): RouteResult
  reviseCashbookVoucher(): RouteResult
}

export function handleFinanceRoute(context: FinanceRouteContext, handlers: FinanceRouteHandlers): RouteResult {
  const { request, url } = context
  const { method } = request
  const { pathname } = url

  if (method === 'GET' && pathname === '/api/v1/finance/accounts') return handlers.listAccounts()
  if (method === 'POST' && pathname === '/api/v1/finance/accounts') return handlers.createAccount()
  if (method === 'PATCH' && /^\/api\/v1\/finance\/accounts\/[^/]+$/.test(pathname)) return handlers.updateAccount()
  if (method === 'GET' && pathname === '/api/v1/finance/customer-debts') return handlers.listCustomerDebts()
  if (method === 'GET' && /^\/api\/v1\/finance\/customers\/[^/]+\/debt$/.test(pathname)) return handlers.getCustomerDebt()
  if (method === 'POST' && pathname === '/api/v1/finance/debt-collections') return handlers.collectCustomerDebt()
  if (method === 'GET' && pathname === '/api/v1/finance/cashbook/balances') return handlers.cashbookBalances()
  if (method === 'GET' && pathname === '/api/v1/finance/cashbook/vouchers') return handlers.cashbookVouchers()
  if (method === 'POST' && pathname === '/api/v1/finance/cashbook/import/kiotviet/preview') return handlers.previewKiotVietCashbookImport()
  if (method === 'POST' && pathname === '/api/v1/finance/cashbook/import/kiotviet') return handlers.importKiotVietCashbook()
  if (method === 'DELETE' && pathname === '/api/v1/finance/cashbook/import/kiotviet') return handlers.deleteImportedKiotVietCashbook()
  if (method === 'POST' && pathname === '/api/v1/finance/customer-debt-adjustments/import/kiotviet/preview') return handlers.previewKiotVietCustomerDebtAdjustmentImport()
  if (method === 'POST' && pathname === '/api/v1/finance/customer-debt-adjustments/import/kiotviet') return handlers.importKiotVietCustomerDebtAdjustments()
  if (method === 'GET' && pathname === '/api/v1/finance/cashbook') return handlers.listCashbook()
  if (method === 'GET' && /^\/api\/v1\/finance\/cashbook\/[^/]+$/.test(pathname)) return handlers.getCashbookEntry()
  if (method === 'POST' && pathname === '/api/v1/finance/cashbook-vouchers') return handlers.createCashbookVoucher()
  if (method === 'POST' && /^\/api\/v1\/finance\/cashbook-vouchers\/[^/]+\/cancel$/.test(pathname)) {
    return handlers.cancelCashbookVoucher()
  }
  if (method === 'POST' && /^\/api\/v1\/finance\/cashbook-vouchers\/[^/]+\/revise$/.test(pathname)) {
    return handlers.reviseCashbookVoucher()
  }

  return Promise.resolve({ found: false })
}
