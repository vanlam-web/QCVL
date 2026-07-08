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
      ['/api/v1/inventory/products?q=mica&status=all&inventory_shape=normal&page=2&page_size=15', undefined],
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

  it('builds roll and sheet object inventory list filters', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: InventoryApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { items: [], page: 1, page_size: 15, total: 0 } as T
    }
    const service = createInventoryService({ request })

    await service.listInventoryRolls({ product_id: 'p-roll', status: 'in_use', page: 1, page_size: 15 })
    await service.listInventorySheets({ product_id: 'p-sheet', status: 'available', page: 2, page_size: 15 })

    expect(calls).toEqual([
      ['/api/v1/inventory/rolls?product_id=p-roll&status=in_use&page=1&page_size=15', undefined],
      ['/api/v1/inventory/sheets?product_id=p-sheet&status=available&page=2&page_size=15', undefined],
    ])
  })
})
