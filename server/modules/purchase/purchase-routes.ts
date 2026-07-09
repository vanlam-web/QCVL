import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../sales/sales-routes.js'

export interface PurchaseRouteContext {
  request: Request
  url: URL
  currentUser: CurrentUserData
  repository: ServerRepository
}

export interface PurchaseRouteHandlers {
  listSuppliers(): RouteResult
  getSupplier(): RouteResult
  createSupplier(): RouteResult
  updateSupplier(): RouteResult
  supplierPayableReceipts(): RouteResult
  paySupplier(): RouteResult
  listReceipts(): RouteResult
  getReceipt(): RouteResult
  createReceipt(): RouteResult
  updateReceipt(): RouteResult
  postReceipt(): RouteResult
}

export function handlePurchaseRoute(context: PurchaseRouteContext, handlers: PurchaseRouteHandlers): RouteResult {
  const { method } = context.request
  const { pathname } = context.url

  if (method === 'GET' && pathname === '/api/v1/suppliers') return handlers.listSuppliers()
  if (method === 'GET' && /^\/api\/v1\/suppliers\/[^/]+$/.test(pathname)) return handlers.getSupplier()
  if (method === 'POST' && pathname === '/api/v1/suppliers') return handlers.createSupplier()
  if (method === 'PATCH' && /^\/api\/v1\/suppliers\/[^/]+$/.test(pathname)) return handlers.updateSupplier()
  if (method === 'GET' && /^\/api\/v1\/suppliers\/[^/]+\/payable-receipts$/.test(pathname)) {
    return handlers.supplierPayableReceipts()
  }
  if (method === 'POST' && /^\/api\/v1\/suppliers\/[^/]+\/payments$/.test(pathname)) return handlers.paySupplier()
  if (method === 'GET' && pathname === '/api/v1/purchase/receipts') return handlers.listReceipts()
  if (method === 'GET' && /^\/api\/v1\/purchase\/receipts\/[^/]+$/.test(pathname)) return handlers.getReceipt()
  if (method === 'POST' && pathname === '/api/v1/purchase/receipts') return handlers.createReceipt()
  if (method === 'PATCH' && /^\/api\/v1\/purchase\/receipts\/[^/]+$/.test(pathname)) return handlers.updateReceipt()
  if (method === 'POST' && /^\/api\/v1\/purchase\/receipts\/[^/]+\/post$/.test(pathname)) return handlers.postReceipt()

  return Promise.resolve({ found: false })
}
