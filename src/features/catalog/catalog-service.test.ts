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
      created_from: '2026-07-01',
      created_to: '2026-07-31',
      page: 2,
      page_size: 15,
      sort: 'pos_usage',
    })

    expect(calls).toEqual([
      [
        '/api/v1/products?search=mica&status=active&sell_method=combo&product_kind=combo&created_from=2026-07-01&created_to=2026-07-31&page=2&page_size=15&sort=pos_usage',
        undefined,
      ],
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
      sort_key: 'total_debt_amount',
      sort_direction: 'desc',
    })
    await service.listCustomerGroups()

    expect(calls).toEqual([
      [
        '/api/v1/customers?search=phong&customer_group_id=cg-1&created_from=2026-07-01&created_to=2026-07-06&created_by=user-admin&total_sales_min=500000&total_sales_max=900000&total_debt_min=100000&total_debt_max=300000&page=2&page_size=15&sort_key=total_debt_amount&sort_direction=desc',
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

  it('sends xlsx base64 to the server when the browser cannot decompress workbooks', async () => {
    const originalDecompressionStream = globalThis.DecompressionStream
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, value: undefined })
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return null as T
    }
    const service = createCatalogService({ request })
    const file = new File([new Uint8Array([1, 2, 3])], 'products.xlsx')

    await service.previewKiotVietProductImport({ file, cleanup_demo: false })

    expect(calls[0][0]).toBe('/api/v1/products/import/kiotviet/preview')
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      cleanup_demo: false,
      file_name: 'products.xlsx',
      file_base64: 'AQID',
    })
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, value: originalDecompressionStream })
  })

  it('sends KiotViet customer import files to customer import endpoints', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return null as T
    }
    const service = createCatalogService({ request })
    const file = new File([new Uint8Array([1, 2, 3])], 'customers.xlsx')

    await service.previewKiotVietCustomerImport({ file })
    await service.importKiotVietCustomers({ file })

    expect(calls[0][0]).toBe('/api/v1/customers/import/kiotviet/preview')
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      file_name: 'customers.xlsx',
      file_base64: 'AQID',
    })
    expect(calls[1][0]).toBe('/api/v1/customers/import/kiotviet')
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({
      file_name: 'customers.xlsx',
      file_base64: 'AQID',
    })
  })

  it('deletes old KiotViet product import data with a dedicated endpoint', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { deleted_rows: 5, blocked_rows: 0 } as T
    }
    const service = createCatalogService({ request })

    await service.deleteImportedKiotVietProducts()

    expect(calls).toEqual([
      ['/api/v1/products/import/kiotviet', { method: 'DELETE' }],
    ])
  })

  it('deletes old KiotViet customer import data with a dedicated endpoint', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { deleted_rows: 531, blocked_rows: 0 } as T
    }
    const service = createCatalogService({ request })

    await service.deleteImportedKiotVietCustomers()

    expect(calls).toEqual([
      ['/api/v1/customers/import/kiotviet', { method: 'DELETE' }],
    ])
  })

  it('updates a customer through a dedicated patch endpoint', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { id: 'customer-1', name: 'Khach moi' } as T
    }
    const service = createCatalogService({ request })

    await service.updateCustomer('customer-1', {
      code: 'KH000001',
      name: 'Khach moi',
      phone: '0909000000',
      tax_code: '0312345678',
      address: '12 Nguyen Trai',
      note: 'Khach VIP',
      customer_group_id: 'cg-vip',
      customer_type: 'company',
      company_name: 'Cong ty moi',
    })

    expect(calls).toEqual([
      [
        '/api/v1/customers/customer-1',
        {
          method: 'PATCH',
          body: JSON.stringify({
            code: 'KH000001',
            name: 'Khach moi',
            phone: '0909000000',
            tax_code: '0312345678',
            address: '12 Nguyen Trai',
            note: 'Khach VIP',
            customer_group_id: 'cg-vip',
            customer_type: 'company',
            company_name: 'Cong ty moi',
          }),
        },
      ],
    ])
  })

  it('patches preferred bill template without requiring name', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: CatalogApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { id: 'customer-1', preferred_bill_template: 'k80' } as T
    }
    const service = createCatalogService({ request })

    await service.updateCustomer('customer-1', { preferred_bill_template: 'k80' })

    expect(calls).toEqual([
      [
        '/api/v1/customers/customer-1',
        {
          method: 'PATCH',
          body: JSON.stringify({ preferred_bill_template: 'k80' }),
        },
      ],
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
