import { describe, expect, it, vi } from 'vitest'
import { handleInventoryRoute, type InventoryRouteHandlers } from './inventory-routes'

function handlers(overrides: Partial<InventoryRouteHandlers> = {}): InventoryRouteHandlers {
  return {
    listProducts: vi.fn(async () => ({ found: false })),
    getProduct: vi.fn(async () => ({ found: false })),
    adjustStock: vi.fn(async () => ({ found: true, data: { ok: true } })),
    stockMovements: vi.fn(async () => ({ found: false })),
    stocktakes: vi.fn(async () => ({ found: false })),
    getStocktake: vi.fn(async () => ({ found: false })),
    updateStocktake: vi.fn(async () => ({ found: false })),
    shortagePreview: vi.fn(async () => ({ found: false })),
    previewKiotVietStocktakeImport: vi.fn(async () => ({ found: false })),
    importKiotVietStocktakes: vi.fn(async () => ({ found: false })),
    deleteImportedKiotVietStocktakes: vi.fn(async () => ({ found: false })),
    materialOpeningOptions: vi.fn(async () => ({ found: false })),
    createMaterialOpening: vi.fn(async () => ({ found: false })),
    ...overrides,
  }
}

describe('handleInventoryRoute', () => {
  it('routes stock adjustment POST requests from the browser service', async () => {
    const routeHandlers = handlers()
    const result = await handleInventoryRoute({
      request: new Request('http://api.local/api/v1/inventory/products/product-1/adjust-stock', { method: 'POST' }),
      url: new URL('http://api.local/api/v1/inventory/products/product-1/adjust-stock'),
      currentUser: {} as never,
      repository: {} as never,
    }, routeHandlers)

    expect(result).toEqual({ found: true, data: { ok: true } })
    expect(routeHandlers.adjustStock).toHaveBeenCalledTimes(1)
  })
})
