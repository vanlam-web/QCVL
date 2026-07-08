import { describe, expect, it } from 'vitest'
import { createCatalogService } from './catalog-service'
import type { CatalogApiRequester } from './catalog-service'

describe('catalog-service', () => {
  it('builds product list filters from existing product fields', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return null as T
    }
    const service = createCatalogService({ request })

    await service.listProducts({
      search: 'mica',
      status: 'active',
      sell_method: 'combo',
      product_kind: 'combo',
      page: 2,
      page_size: 15,
      sort: 'pos_usage',
    })

    expect(calls).toEqual([
      ['/api/v1/products?search=mica&status=active&sell_method=combo&product_kind=combo&page=2&page_size=15&sort=pos_usage', undefined],
    ])
  })

  it('builds customer list filters from existing customer fields', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return null as T
    }
    const service = createCatalogService({ request })

    await service.listCustomers({
      search: 'phong',
      customer_group_id: 'cg-1',
      created_from: '2026-07-01',
      created_to: '2026-07-06',
      created_by: 'user-admin',
      total_sales_min: 500000,
      total_sales_max: 900000,
      total_debt_min: 100000,
      total_debt_max: 300000,
      page: 2,
      page_size: 15,
    })
    await service.listCustomerGroups()

    expect(calls).toEqual([
      [
        '/api/v1/customers?search=phong&customer_group_id=cg-1&created_from=2026-07-01&created_to=2026-07-06&created_by=user-admin&total_sales_min=500000&total_sales_max=900000&total_debt_min=100000&total_debt_max=300000&page=2&page_size=15',
        undefined,
      ],
      ['/api/v1/customer-groups', undefined],
    ])
  })

  it('sends product kind when creating products', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return null as T
    }
    const service = createCatalogService({ request })

    await service.createProduct({
      code: 'KEO',
      name: 'Keo phụ',
      status: 'active',
      product_kind: 'auxiliary_material',
      unit_name: 'chai',
      sell_method: 'quantity',
      inventory_shape: 'normal',
      track_inventory: true,
      latest_purchase_cost: 10000,
    })

    expect(calls).toEqual([
      [
        '/api/v1/products',
        {
          method: 'POST',
          body: JSON.stringify({
            code: 'KEO',
            name: 'Keo phụ',
            status: 'active',
            product_kind: 'auxiliary_material',
            unit_name: 'chai',
            sell_method: 'quantity',
            inventory_shape: 'normal',
            track_inventory: true,
            latest_purchase_cost: 10000,
          }),
        },
      ],
    ])
  })

  it('loads stock movements for product detail stock card', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return null as T
    }
    const service = createCatalogService({ request })

    await service.listStockMovements({ product_id: 'product-1', page: 2, page_size: 15 })

    expect(calls).toEqual([
      ['/api/v1/inventory/stock-movements?product_id=product-1&page=2&page_size=15', undefined],
    ])
  })

  it('gets and saves product BOM', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return null as T
    }
    const service = createCatalogService({ request })

    await service.getProductBom('product-1')
    await service.saveProductBom('product-1', {
      items: [{ component_product_id: 'component-1', quantity: 2, notes: 'Keo' }],
    })

    expect(calls).toEqual([
      ['/api/v1/products/product-1/bom', undefined],
      [
        '/api/v1/products/product-1/bom',
        {
          method: 'POST',
          body: JSON.stringify({ items: [{ component_product_id: 'component-1', quantity: 2, notes: 'Keo' }] }),
        },
      ],
    ])
  })
})
