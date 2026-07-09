import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../sales/sales-routes.js'

export interface InventoryRouteContext {
  request: Request
  url: URL
  currentUser: CurrentUserData
  repository: ServerRepository
}

export interface InventoryRouteHandlers {
  listProducts(): RouteResult
  getProduct(): RouteResult
  adjustStock(): RouteResult
  stockMovements(): RouteResult
  stocktakes(): RouteResult
  rolls(): RouteResult
  sheets(): RouteResult
  shortagePreview(): RouteResult
  materialOpeningOptions(): RouteResult
  createMaterialOpening(): RouteResult
}

export function handleInventoryRoute(context: InventoryRouteContext, handlers: InventoryRouteHandlers): RouteResult {
  const { method } = context.request
  const { pathname } = context.url

  if (method === 'GET' && pathname === '/api/v1/inventory/products') return handlers.listProducts()
  if (method === 'GET' && /^\/api\/v1\/inventory\/products\/[^/]+$/.test(pathname)) return handlers.getProduct()
  if (method === 'PATCH' && /^\/api\/v1\/inventory\/products\/[^/]+\/adjust-stock$/.test(pathname)) return handlers.adjustStock()
  if (method === 'GET' && pathname === '/api/v1/inventory/stock-movements') return handlers.stockMovements()
  if (method === 'GET' && pathname === '/api/v1/inventory/stocktakes') return handlers.stocktakes()
  if (method === 'GET' && pathname === '/api/v1/inventory/rolls') return handlers.rolls()
  if (method === 'GET' && pathname === '/api/v1/inventory/sheets') return handlers.sheets()
  if (method === 'POST' && pathname === '/api/v1/inventory/pos-shortage-preview') return handlers.shortagePreview()
  if (method === 'GET' && pathname === '/api/v1/inventory/material-openings/options') return handlers.materialOpeningOptions()
  if (method === 'POST' && pathname === '/api/v1/inventory/material-openings') return handlers.createMaterialOpening()

  return Promise.resolve({ found: false })
}
