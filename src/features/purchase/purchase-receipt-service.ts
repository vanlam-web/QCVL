import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import { parseKiotVietProductWorkbook } from '../catalog/kiotviet-product-import'
import type {
  KiotVietImportDeleteResult,
  KiotVietPurchaseReceiptImportPreview,
  KiotVietPurchaseReceiptImportResult,
  PurchaseReceipt,
  PurchaseReceiptFinanceAccountListResponse,
  PurchaseReceiptInput,
  PurchaseReceiptListResponse,
  PurchaseReceiptProductListResponse,
  PurchaseReceiptPostInput,
  PurchaseReceiptPostResult,
  PurchaseReceiptSupplierListResponse,
  PurchaseReceiptSupplierPaymentInput,
  PurchaseReceiptSupplierPaymentResult,
  PurchaseReceiptStatus,
  PurchaseReceiptProduct,
} from './purchase-receipt-types'
import type { Product, ProductStatus, SellMethod } from '../catalog/types'
import type { Supplier } from './types'
import type { SupplierInput } from './supplier-service'

export interface PurchaseReceiptApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export function createPurchaseReceiptService(api: PurchaseReceiptApiRequester) {
  return {
    listReceipts: (
      input: {
        search?: string
        status?: PurchaseReceiptStatus | 'all'
        date_from?: string
        date_to?: string
        created_by?: string
        supplier_id?: string
        page?: number
        page_size?: number
        sort_key?: 'code' | 'received_at' | 'supplier_name' | 'total_quantity' | 'subtotal_amount' | 'payable_amount' | 'paid_amount'
        sort_direction?: 'asc' | 'desc'
      } = {},
    ) => {
      const params = new URLSearchParams()
      if (input.search) params.set('q', input.search)
      if (input.status) params.set('status', input.status)
      if (input.date_from) params.set('date_from', input.date_from)
      if (input.date_to) params.set('date_to', input.date_to)
      if (input.created_by) params.set('created_by', input.created_by)
      if (input.supplier_id) params.set('supplier_id', input.supplier_id)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      params.set('sort_key', input.sort_key ?? 'received_at')
      params.set('sort_direction', input.sort_direction ?? 'desc')
      const query = params.toString()
      return api.request<PurchaseReceiptListResponse>(`/api/v1/purchase/receipts${query ? `?${query}` : ''}`)
    },
    getReceipt: (id: string) => api.request<PurchaseReceipt>(`/api/v1/purchase/receipts/${id}`),
    createReceipt: (input: PurchaseReceiptInput) =>
      api.request<PurchaseReceipt>('/api/v1/purchase/receipts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateReceipt: (id: string, input: PurchaseReceiptInput) =>
      api.request<PurchaseReceipt>(`/api/v1/purchase/receipts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    postReceipt: (id: string, input: PurchaseReceiptPostInput) =>
      api.request<PurchaseReceiptPostResult>(`/api/v1/purchase/receipts/${id}/post`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    cancelReceipt: (id: string) =>
      api.request<PurchaseReceipt>(`/api/v1/purchase/receipts/${id}/cancel`, {
        method: 'POST',
      }),
    paySupplier: (supplierId: string, input: PurchaseReceiptSupplierPaymentInput) =>
      api.request<PurchaseReceiptSupplierPaymentResult>(`/api/v1/suppliers/${supplierId}/payments`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    previewKiotVietPurchaseReceiptImport: async (input: { file: File }) =>
      api.request<KiotVietPurchaseReceiptImportPreview>('/api/v1/purchase/receipts/import/kiotviet/preview', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietPurchaseReceiptImportPayload(input)),
      }),
    importKiotVietPurchaseReceipts: async (input: { file: File }) =>
      api.request<KiotVietPurchaseReceiptImportResult>('/api/v1/purchase/receipts/import/kiotviet', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietPurchaseReceiptImportPayload(input)),
      }),
    deleteImportedKiotVietPurchaseReceipts: async () =>
      api.request<KiotVietImportDeleteResult>('/api/v1/purchase/receipts/import/kiotviet', {
        method: 'DELETE',
      }),
    listSuppliers: (input: {
      search?: string
      status?: 'active' | 'inactive' | 'all'
      page?: number
      page_size?: number
    } = {}) => {
      const params = new URLSearchParams()
      params.set('status', input.status ?? 'active')
      if (input.search) params.set('q', input.search)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<PurchaseReceiptSupplierListResponse>(`/api/v1/suppliers${query ? `?${query}` : ''}`)
    },
    createSupplier: (input: SupplierInput) =>
      api.request<Supplier>('/api/v1/suppliers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    listProducts: (input: {
      search?: string
      status?: 'active' | 'inactive' | 'all' | 'deleted'
      page?: number
      page_size?: number
    } = {}) => {
      const params = new URLSearchParams()
      params.set('status', input.status ?? 'active')
      if (input.search) params.set('search', input.search)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<PurchaseReceiptProductListResponse>(`/api/v1/products${query ? `?${query}` : ''}`)
    },
    createProduct: (input: {
      code: string
      name: string
      status: ProductStatus
      unit_name: string
      sell_method: SellMethod
      inventory_shape?: Product['inventory_shape']
      track_inventory?: boolean
    }) =>
      api.request<PurchaseReceiptProduct>('/api/v1/products', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    listFinanceAccounts: () =>
      api.request<PurchaseReceiptFinanceAccountListResponse>('/api/v1/finance/accounts?is_active=true'),
  }
}

export type PurchaseReceiptService = ReturnType<typeof createPurchaseReceiptService>

async function buildKiotVietPurchaseReceiptImportPayload(input: { file: File }) {
  const buffer = await input.file.arrayBuffer()
  if (canParseCompressedXlsxInBrowser()) {
    return {
      file_name: input.file.name,
      rows: await parseKiotVietProductWorkbook(buffer),
    }
  }
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

export function createBrowserPurchaseReceiptService(getAccessToken: () => Promise<string | null>) {
  return createPurchaseReceiptService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
