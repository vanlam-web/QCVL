import type { CurrentUserData, ServerRepository } from '../../http-types.js'
import type { RouteResult } from '../sales/sales-routes.js'

export interface ProductionRouteContext {
  request: Request
  url: URL
  currentUser: CurrentUserData
  repository: ServerRepository
}

export interface ProductionRouteHandlers {
  listQueue(): RouteResult
  history(): RouteResult
  addToDraft(): RouteResult
  setVisibility(): RouteResult
}

export function handleProductionRoute(context: ProductionRouteContext, handlers: ProductionRouteHandlers): RouteResult {
  const { method } = context.request
  const { pathname } = context.url

  if (method === 'GET' && pathname === '/api/v1/production-queue') return handlers.listQueue()
  if (method === 'GET' && pathname === '/api/v1/production-queue/history') return handlers.history()
  if (method === 'POST' && /^\/api\/v1\/production-queue\/[^/]+\/add-to-draft$/.test(pathname)) return handlers.addToDraft()
  if (method === 'POST' && /^\/api\/v1\/production-queue\/[^/]+\/(dismiss|restore)$/.test(pathname)) {
    return handlers.setVisibility()
  }

  return Promise.resolve({ found: false })
}
