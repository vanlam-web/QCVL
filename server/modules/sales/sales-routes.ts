import type { CurrentUserData, ServerRepository } from '../../http-types.js'

export type RouteResult = Promise<{ found: true; data: unknown; status?: number } | { found: false }>

export interface SalesRouteContext {
  request: Request
  url: URL
  currentUser: CurrentUserData
  repository: ServerRepository
}

export interface SalesRouteHandlers {
  validateCart(): RouteResult
  checkout(): RouteResult
  createQuote(): RouteResult
  reopenQuotePayload(): RouteResult
  reviseInvoice(): RouteResult
  listSalesDocuments(): RouteResult
  getSalesDocument(): RouteResult
  updateSalesDocument(): RouteResult
  previewKiotVietInvoiceImport(): RouteResult
  importKiotVietInvoices(): RouteResult
  deleteImportedKiotVietInvoices(): RouteResult
}

export function handleSalesRoute(context: SalesRouteContext, handlers: SalesRouteHandlers): RouteResult {
  const { request, url } = context
  const { method } = request
  const { pathname } = url

  if (method === 'POST' && pathname === '/api/v1/pos/cart/validate') return handlers.validateCart()
  if (method === 'POST' && pathname === '/api/v1/orders/checkout') return handlers.checkout()
  if (method === 'POST' && pathname === '/api/v1/orders/quotes') return handlers.createQuote()
  if (method === 'GET' && /^\/api\/v1\/orders\/quotes\/[^/]+\/reopen-payload$/.test(pathname)) {
    return handlers.reopenQuotePayload()
  }
  if (method === 'POST' && /^\/api\/v1\/orders\/[^/]+\/revise$/.test(pathname)) return handlers.reviseInvoice()
  if (method === 'GET' && pathname === '/api/v1/sales-documents') return handlers.listSalesDocuments()
  if (method === 'POST' && pathname === '/api/v1/sales-documents/import/kiotviet/preview') return handlers.previewKiotVietInvoiceImport()
  if (method === 'POST' && pathname === '/api/v1/sales-documents/import/kiotviet') return handlers.importKiotVietInvoices()
  if (method === 'DELETE' && pathname === '/api/v1/sales-documents/import/kiotviet') return handlers.deleteImportedKiotVietInvoices()
  if (method === 'GET' && /^\/api\/v1\/sales-documents\/[^/]+$/.test(pathname)) return handlers.getSalesDocument()
  if (method === 'PATCH' && /^\/api\/v1\/sales-documents\/[^/]+$/.test(pathname)) return handlers.updateSalesDocument()

  return Promise.resolve({ found: false })
}
