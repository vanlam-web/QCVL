import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../../route-types.js'

export interface PurchaseRouteContext {
  request: Request
  url: URL
  currentUser: CurrentUserData
  repository: ServerRepository
}

export interface PurchaseRouteHandlers {
  listSuppliers(): RouteResult
  previewKiotVietSupplierImport(): RouteResult
  importKiotVietSuppliers(): RouteResult
  deleteImportedKiotVietSuppliers(): RouteResult
  getSupplier(): RouteResult
  createSupplier(): RouteResult
  updateSupplier(): RouteResult
  supplierPayableReceipts(): RouteResult
  paySupplier(): RouteResult
  listReceipts(): RouteResult
  previewKiotVietPurchaseReceiptImport(): RouteResult
  importKiotVietPurchaseReceipts(): RouteResult
  deleteImportedKiotVietPurchaseReceipts(): RouteResult
  getReceipt(): RouteResult
  createReceipt(): RouteResult
  updateReceipt(): RouteResult
  postReceipt(): RouteResult
  cancelReceipt(): RouteResult
}

export function handlePurchaseRoute(context: PurchaseRouteContext, handlers: PurchaseRouteHandlers): RouteResult {
  const { method } = context.request
  const { pathname } = context.url

  if (method === 'GET' && pathname === '/api/v1/suppliers') return handlers.listSuppliers()
  if (method === 'POST' && pathname === '/api/v1/suppliers/import/kiotviet/preview') return handlers.previewKiotVietSupplierImport()
  if (method === 'POST' && pathname === '/api/v1/suppliers/import/kiotviet') return handlers.importKiotVietSuppliers()
  if (method === 'DELETE' && pathname === '/api/v1/suppliers/import/kiotviet') return handlers.deleteImportedKiotVietSuppliers()
  if (method === 'GET' && /^\/api\/v1\/suppliers\/[^/]+$/.test(pathname)) return handlers.getSupplier()
  if (method === 'POST' && pathname === '/api/v1/suppliers') return handlers.createSupplier()
  if (method === 'PATCH' && /^\/api\/v1\/suppliers\/[^/]+$/.test(pathname)) return handlers.updateSupplier()
  if (method === 'GET' && /^\/api\/v1\/suppliers\/[^/]+\/payable-receipts$/.test(pathname)) {
    return handlers.supplierPayableReceipts()
  }
  if (method === 'POST' && /^\/api\/v1\/suppliers\/[^/]+\/payments$/.test(pathname)) return handlers.paySupplier()
  if (method === 'GET' && pathname === '/api/v1/purchase/receipts') return handlers.listReceipts()
  if (method === 'POST' && pathname === '/api/v1/purchase/receipts/import/kiotviet/preview') {
    return handlers.previewKiotVietPurchaseReceiptImport()
  }
  if (method === 'POST' && pathname === '/api/v1/purchase/receipts/import/kiotviet') {
    return handlers.importKiotVietPurchaseReceipts()
  }
  if (method === 'DELETE' && pathname === '/api/v1/purchase/receipts/import/kiotviet') {
    return handlers.deleteImportedKiotVietPurchaseReceipts()
  }
  if (method === 'GET' && /^\/api\/v1\/purchase\/receipts\/[^/]+$/.test(pathname)) return handlers.getReceipt()
  if (method === 'POST' && pathname === '/api/v1/purchase/receipts') return handlers.createReceipt()
  if (method === 'PATCH' && /^\/api\/v1\/purchase\/receipts\/[^/]+$/.test(pathname)) return handlers.updateReceipt()
  if (method === 'POST' && /^\/api\/v1\/purchase\/receipts\/[^/]+\/post$/.test(pathname)) return handlers.postReceipt()
  if (method === 'POST' && /^\/api\/v1\/purchase\/receipts\/[^/]+\/cancel$/.test(pathname)) return handlers.cancelReceipt()

  return Promise.resolve({ found: false })
}
