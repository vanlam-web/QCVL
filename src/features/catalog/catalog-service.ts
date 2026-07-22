import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type { InventoryRollListResponse, InventorySheetListResponse } from '../inventory/types'
import { parseKiotVietProductWorkbook } from './kiotviet-product-import'
import type {
  Customer,
  CustomerGroup,
  CustomerListResponse,
  KiotVietCustomerImportPreview,
  KiotVietCustomerImportResult,
  KiotVietProductImportPreview,
  KiotVietProductImportResult,
  KiotVietImportDeleteResult,
  ProductBom,
  PriceFormulaApplyResult,
  PriceFormulaInput,
  PriceFormulaPreview,
  PriceListResponse,
  Product,
  ProductKind,
  ProductGroup,
  ProductListResponse,
  ProductStockMovementListResponse,
  ProductStocktake,
  ProductStatus,
  ProductStatusFilter,
  ResolvePricesResponse,
  SellMethod,
} from './types'

export interface CatalogApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export interface CustomerListFilters {
  search?: string
  status?: 'active' | 'inactive' | 'all'
  customer_group_id?: string
  created_from?: string
  created_to?: string
  created_by?: string
  total_sales_min?: number
  total_sales_max?: number
  total_debt_min?: number
  total_debt_max?: number
  page?: number
  page_size?: number
  sort_key?: 'code' | 'created_at' | 'name' | 'phone' | 'group' | 'total_debt_amount' | 'total_sales_amount'
  sort_direction?: 'asc' | 'desc'
}

export type ProductListSortKey =
  | 'code'
  | 'created_at'
  | 'name'
  | 'latest_purchase_cost'
  | 'default_sale_price'
  | 'operating_stock'
  | 'unit_name'
  | 'out_of_stock'
  | 'sell_method'

export type ManagementSortDirection = 'asc' | 'desc'

export function createCatalogService(api: CatalogApiRequester) {
  return {
    listProducts: (input: {
      search?: string
      status?: ProductStatusFilter
      sell_method?: SellMethod
      inventory_shape?: Product['inventory_shape']
      product_kind?: ProductKind
      product_group_id?: string | string[]
      created_from?: string
      created_to?: string
      page?: number
      page_size?: number
      sort?: 'pos_usage'
      sort_key?: ProductListSortKey
      sort_direction?: ManagementSortDirection
    } = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('search', input.search)
      if (input.status) params.set('status', input.status)
      if (input.sell_method) params.set('sell_method', input.sell_method)
      if (input.inventory_shape) params.set('inventory_shape', input.inventory_shape)
      if (input.product_kind) params.set('product_kind', input.product_kind)
      if (Array.isArray(input.product_group_id)) {
        input.product_group_id.forEach((groupId) => params.append('product_group_id', groupId))
      } else if (input.product_group_id) params.set('product_group_id', input.product_group_id)
      if (input.created_from) params.set('created_from', input.created_from)
      if (input.created_to) params.set('created_to', input.created_to)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      if (input.sort) params.set('sort', input.sort)
      if (input.sort !== 'pos_usage') {
        params.set('sort_key', input.sort_key ?? 'created_at')
        params.set('sort_direction', input.sort_direction ?? 'desc')
      }
      const query = params.toString()
      return api.request<ProductListResponse>(`/api/v1/products${query ? `?${query}` : ''}`)
    },
    listProductGroups: () => api.request<{ items: ProductGroup[] }>('/api/v1/product-groups'),
    createProductGroup: (input: { name: string }) =>
      api.request<ProductGroup>('/api/v1/product-groups', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateProductGroup: (input: { id: string; name: string }) =>
      api.request<ProductGroup>(`/api/v1/product-groups/${encodeURIComponent(input.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: input.name }),
      }),
    previewKiotVietProductImport: async (input: { file: File; cleanup_demo: boolean }) =>
      api.request<KiotVietProductImportPreview>('/api/v1/products/import/kiotviet/preview', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietImportPayload(input)),
      }),
    importKiotVietProducts: async (input: { file: File; cleanup_demo: boolean }) =>
      api.request<KiotVietProductImportResult>('/api/v1/products/import/kiotviet', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietImportPayload(input)),
      }),
    deleteImportedKiotVietProducts: async () =>
      api.request<KiotVietImportDeleteResult>('/api/v1/products/import/kiotviet', {
        method: 'DELETE',
      }),
    listStockMovements: (input: { product_id?: string; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.product_id) params.set('product_id', input.product_id)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<ProductStockMovementListResponse>(`/api/v1/inventory/stock-movements${query ? `?${query}` : ''}`)
    },
    listInventoryRolls: (input: { product_id?: string; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.product_id) params.set('product_id', input.product_id)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<InventoryRollListResponse>(`/api/v1/inventory/rolls${query ? `?${query}` : ''}`)
    },
    listInventorySheets: (input: { product_id?: string; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.product_id) params.set('product_id', input.product_id)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<InventorySheetListResponse>(`/api/v1/inventory/sheets${query ? `?${query}` : ''}`)
    },
    adjustNormalProductStock: (productId: string, input: { actual_qty: number; reason: string }) =>
      api.request<ProductStocktake>(`/api/v1/inventory/products/${productId}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    createProduct: (input: {
      code: string
      name: string
      status: ProductStatus
      product_kind?: ProductKind
      unit_name: string
      sell_method: SellMethod
      inventory_shape?: Product['inventory_shape']
      track_inventory?: boolean
      product_group_id?: string
      latest_purchase_cost?: number | null
      unit_conversions?: Array<{
        unit_name: string
        stock_qty_per_unit: number
        is_default_purchase_unit?: boolean
        is_default_sale_unit?: boolean
      }>
    }) =>
      api.request<Product>('/api/v1/products', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateProduct: (
      id: string,
      input: Partial<{
        code: string
        name: string
        status: ProductStatus
        product_kind: ProductKind
        unit_name: string
        sell_method: SellMethod
        latest_purchase_cost: number | null
      }>,
    ) =>
      api.request<Product>(`/api/v1/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    getProductBom: (productId: string) => api.request<ProductBom | null>(`/api/v1/products/${productId}/bom`),
    saveProductBom: (
      productId: string,
      input: { notes?: string | null; items: Array<{ component_product_id: string; quantity: number; notes?: string | null }> },
    ) =>
      api.request<ProductBom>(`/api/v1/products/${productId}/bom`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    listCustomers: (input: CustomerListFilters = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('search', input.search)
      if (input.status) params.set('status', input.status)
      if (input.customer_group_id) params.set('customer_group_id', input.customer_group_id)
      if (input.created_from) params.set('created_from', input.created_from)
      if (input.created_to) params.set('created_to', input.created_to)
      if (input.created_by) params.set('created_by', input.created_by)
      if (input.total_sales_min !== undefined) params.set('total_sales_min', String(input.total_sales_min))
      if (input.total_sales_max !== undefined) params.set('total_sales_max', String(input.total_sales_max))
      if (input.total_debt_min !== undefined) params.set('total_debt_min', String(input.total_debt_min))
      if (input.total_debt_max !== undefined) params.set('total_debt_max', String(input.total_debt_max))
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      params.set('sort_key', input.sort_key ?? 'created_at')
      params.set('sort_direction', input.sort_direction ?? 'desc')
      const query = params.toString()
      return api.request<CustomerListResponse>(`/api/v1/customers${query ? `?${query}` : ''}`)
    },
    listCustomerGroups: () => api.request<{ items: CustomerGroup[] }>('/api/v1/customer-groups'),
    previewKiotVietCustomerImport: async (input: { file: File }) =>
      api.request<KiotVietCustomerImportPreview>('/api/v1/customers/import/kiotviet/preview', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietCustomerImportPayload(input)),
      }),
    importKiotVietCustomers: async (input: { file: File }) =>
      api.request<KiotVietCustomerImportResult>('/api/v1/customers/import/kiotviet', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietCustomerImportPayload(input)),
      }),
    deleteImportedKiotVietCustomers: async () =>
      api.request<KiotVietImportDeleteResult>('/api/v1/customers/import/kiotviet', {
        method: 'DELETE',
      }),
    createCustomer: (input: {
      code?: string
      name: string
      phone?: string
      tax_code?: string
      address?: string
      note?: string
      customer_group_id?: string | null
      customer_type?: string | null
      company_name?: string | null
    }) =>
      api.request<Customer>('/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateCustomer: (id: string, input: {
      code?: string
      name?: string
      phone?: string | null
      tax_code?: string | null
      address?: string | null
      note?: string | null
      customer_group_id?: string | null
      customer_type?: string | null
      company_name?: string | null
      preferred_bill_template?: string | null
    }) =>
      api.request<Customer>(`/api/v1/customers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    resolvePrices: (productIds: string[], customerId?: string) =>
      api.request<ResolvePricesResponse>('/api/v1/pricing/resolve', {
        method: 'POST',
        body: JSON.stringify({ product_ids: productIds, customer_id: customerId }),
      }),
    listPriceLists: () => api.request<PriceListResponse>('/api/v1/price-lists'),
    previewPriceFormula: (input: PriceFormulaInput) =>
      api.request<PriceFormulaPreview>('/api/v1/price-lists/formulas/preview', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    applyPriceFormula: (input: {
      formula: PriceFormulaInput
      selected_items: Array<{ product_id: string; price_list_id: string }>
    }) =>
      api.request<PriceFormulaApplyResult>('/api/v1/price-lists/formulas/apply', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  }
}

export type CatalogService = ReturnType<typeof createCatalogService>

async function buildKiotVietImportPayload(input: { file: File; cleanup_demo: boolean }) {
  const buffer = await input.file.arrayBuffer()
  if (canParseCompressedXlsxInBrowser()) {
    return {
      cleanup_demo: input.cleanup_demo,
      file_name: input.file.name,
      rows: await parseKiotVietProductWorkbook(buffer),
    }
  }
  return {
    cleanup_demo: input.cleanup_demo,
    file_name: input.file.name,
    file_base64: arrayBufferToBase64(buffer),
  }
}

async function buildKiotVietCustomerImportPayload(input: { file: File }) {
  const buffer = await input.file.arrayBuffer()
  return {
    file_name: input.file.name,
    file_base64: arrayBufferToBase64(buffer),
  }
}

function canParseCompressedXlsxInBrowser() {
  try {
    return typeof DecompressionStream === 'function' && Boolean(new DecompressionStream('deflate-raw'))
  } catch {
    return false
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function createBrowserCatalogService(getAccessToken: () => Promise<string | null>) {
  return createCatalogService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
