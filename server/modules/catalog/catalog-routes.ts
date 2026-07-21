import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../sales/sales-routes.js'

export interface CatalogRouteContext {
  request: Request
  url: URL
  currentUser: CurrentUserData
  repository: ServerRepository
}

export interface CatalogRouteHandlers {
  productGroups(): RouteResult
  createProductGroup(): RouteResult
  updateProductGroup(): RouteResult
  listProducts(): RouteResult
  previewKiotVietProductImport(): RouteResult
  importKiotVietProducts(): RouteResult
  deleteImportedKiotVietProducts(): RouteResult
  getProductBom(): RouteResult
  createProduct(): RouteResult
  updateProduct(): RouteResult
  upsertProductBom(): RouteResult
  customerGroups(): RouteResult
  listCustomers(): RouteResult
  createCustomer(): RouteResult
  updateCustomer(): RouteResult
  previewKiotVietCustomerImport(): RouteResult
  importKiotVietCustomers(): RouteResult
  deleteImportedKiotVietCustomers(): RouteResult
  customerRecentPrices(): RouteResult
  resolvePricing(): RouteResult
  priceLists(): RouteResult
  previewPriceFormula(): RouteResult
  applyPriceFormula(): RouteResult
}

export function handleCatalogRoute(context: CatalogRouteContext, handlers: CatalogRouteHandlers): RouteResult {
  const { method } = context.request
  const { pathname } = context.url

  if (method === 'GET' && pathname === '/api/v1/product-groups') return handlers.productGroups()
  if (method === 'POST' && pathname === '/api/v1/product-groups') return handlers.createProductGroup()
  if (method === 'PATCH' && /^\/api\/v1\/product-groups\/[^/]+$/.test(pathname)) return handlers.updateProductGroup()
  if (method === 'GET' && pathname === '/api/v1/products') return handlers.listProducts()
  if (method === 'POST' && pathname === '/api/v1/products/import/kiotviet/preview') return handlers.previewKiotVietProductImport()
  if (method === 'POST' && pathname === '/api/v1/products/import/kiotviet') return handlers.importKiotVietProducts()
  if (method === 'DELETE' && pathname === '/api/v1/products/import/kiotviet') return handlers.deleteImportedKiotVietProducts()
  if (method === 'GET' && /^\/api\/v1\/products\/[^/]+\/bom$/.test(pathname)) return handlers.getProductBom()
  if (method === 'POST' && pathname === '/api/v1/products') return handlers.createProduct()
  if (method === 'PATCH' && /^\/api\/v1\/products\/[^/]+$/.test(pathname)) return handlers.updateProduct()
  if ((method === 'POST' || method === 'PUT') && /^\/api\/v1\/products\/[^/]+\/bom$/.test(pathname)) return handlers.upsertProductBom()
  if (method === 'GET' && pathname === '/api/v1/customer-groups') return handlers.customerGroups()
  if (method === 'GET' && pathname === '/api/v1/customers') return handlers.listCustomers()
  if (method === 'POST' && pathname === '/api/v1/customers') return handlers.createCustomer()
  if (method === 'PATCH' && /^\/api\/v1\/customers\/[^/]+$/.test(pathname)) return handlers.updateCustomer()
  if (method === 'POST' && pathname === '/api/v1/customers/import/kiotviet/preview') return handlers.previewKiotVietCustomerImport()
  if (method === 'POST' && pathname === '/api/v1/customers/import/kiotviet') return handlers.importKiotVietCustomers()
  if (method === 'DELETE' && pathname === '/api/v1/customers/import/kiotviet') return handlers.deleteImportedKiotVietCustomers()
  if (method === 'GET' && /^\/api\/v1\/customers\/[^/]+\/products\/[^/]+\/recent-prices$/.test(pathname)) {
    return handlers.customerRecentPrices()
  }
  if (method === 'POST' && pathname === '/api/v1/pricing/resolve') return handlers.resolvePricing()
  if (method === 'GET' && pathname === '/api/v1/price-lists') return handlers.priceLists()
  if (method === 'POST' && pathname === '/api/v1/price-lists/formulas/preview') return handlers.previewPriceFormula()
  if (method === 'POST' && pathname === '/api/v1/price-lists/formulas/apply') return handlers.applyPriceFormula()

  return Promise.resolve({ found: false })
}
