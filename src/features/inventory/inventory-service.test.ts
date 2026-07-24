import { describe, expect, it } from 'vitest'
import { createInventoryService } from './inventory-service'
import type { InventoryApiRequester } from './inventory-service'

describe('inventory-service', () => {
  it('builds inventory product list filters', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: InventoryApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { items: [], page: 2, page_size: 15, total: 0 } as T
    }
    const service = createInventoryService({ request })

    await service.listInventoryProducts({
      search: 'mica',
      status: 'all',
      inventory_shape: 'normal',
      page: 2,
      page_size: 15,
    })

    expect(calls).toEqual([
      ['/api/v1/inventory/products?search=mica&status=all&inventory_shape=normal&page=2&page_size=15', undefined],
    ])
  })

  it('posts normal product stock adjustments', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: InventoryApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return {
        id: 'stocktake-1',
        code: 'KK000001',
        status: 'balanced',
        source_type: 'manual',
        created_at: '2026-07-05T00:00:00Z',
        balanced_at: '2026-07-05T00:01:00Z',
        note: 'Đếm lại kho',
      } as T
    }
    const service = createInventoryService({ request })

    await service.adjustNormalProductStock('product-1', { actual_qty: 12, reason: 'Đếm lại kho' })

    expect(calls).toEqual([
      [
        '/api/v1/inventory/products/product-1/adjust-stock',
        {
          method: 'POST',
          body: JSON.stringify({ actual_qty: 12, reason: 'Đếm lại kho' }),
        },
      ],
    ])
  })

  it('calls material opening preview, options and create endpoints', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: InventoryApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      if (path.includes('options')) {
        return { product: { id: 'mat-1' }, conversions: [], warnings: [] } as T
      }
      if (path.includes('pos-shortage-preview')) {
        return { product_id: 'p-1', quantity: 2, source: 'product', shortages: [], warnings: [] } as T
      }
      return { id: 'opening-1' } as T
    }
    const service = createInventoryService({ request })

    await service.previewPosShortage({ product_id: 'p-1', quantity: 2 })
    await service.getMaterialOpeningOptions('mat-1')
    await service.createMaterialOpening({
      product_id: 'mat-1',
      inventory_shape: 'normal',
      opened_unit_id: 'unit-pack',
      opened_qty: 1,
      old_remaining_qty: 0,
      note: 'Khui nhanh',
    })

    expect(calls).toEqual([
      [
        '/api/v1/inventory/pos-shortage-preview',
        {
          method: 'POST',
          body: JSON.stringify({ product_id: 'p-1', quantity: 2 }),
        },
      ],
      ['/api/v1/inventory/material-openings/options?product_id=mat-1', undefined],
      [
        '/api/v1/inventory/material-openings',
        {
          method: 'POST',
          body: JSON.stringify({
            product_id: 'mat-1',
            inventory_shape: 'normal',
            opened_unit_id: 'unit-pack',
            opened_qty: 1,
            old_remaining_qty: 0,
            note: 'Khui nhanh',
          }),
        },
      ],
    ])
  })

  it('sends stocktake import cleanup flag to the server', async () => {
    const originalDecompressionStream = globalThis.DecompressionStream
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, value: undefined })
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: InventoryApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return null as T
    }
    const service = createInventoryService({ request })
    const file = new File([new Uint8Array([1, 2, 3])], 'stocktakes.xlsx')

    await service.importKiotVietStocktakes({ file, cleanup_demo: true })

    expect(calls[0][0]).toBe('/api/v1/inventory/stocktakes/import/kiotviet')
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      cleanup_demo: true,
      file_name: 'stocktakes.xlsx',
      file_base64: 'AQID',
    })
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, value: originalDecompressionStream })
  })

  it('deletes old KiotViet stocktake import data with a dedicated endpoint', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: InventoryApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { deleted_rows: 333, blocked_rows: 0 } as T
    }
    const service = createInventoryService({ request })

    await service.deleteImportedKiotVietStocktakes()

    expect(calls).toEqual([
      ['/api/v1/inventory/stocktakes/import/kiotviet', { method: 'DELETE' }],
    ])
  })

  it('loads stocktake detail by id', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: InventoryApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { id: 'stocktake-1', items: [] } as T
    }
    const service = createInventoryService({ request })

    await service.getStocktake('stocktake-1')

    expect(calls).toEqual([
      ['/api/v1/inventory/stocktakes/stocktake-1', undefined],
    ])
  })

  it('cancels stocktake detail by id', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: InventoryApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { id: 'stocktake-1', status: 'cancelled', items: [] } as T
    }
    const service = createInventoryService({ request })

    await service.cancelStocktake('stocktake-1')

    expect(calls).toEqual([
      [
        '/api/v1/inventory/stocktakes/stocktake-1',
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'cancelled' }),
        },
      ],
    ])
  })

})
