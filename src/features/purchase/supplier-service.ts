import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type {
  Supplier,
  SupplierCustomerListResponse,
  SupplierFinanceAccountListResponse,
  SupplierListResponse,
  KiotVietImportDeleteResult,
  KiotVietSupplierImportPreview,
  KiotVietSupplierImportResult,
  SupplierPayableReceiptListResponse,
  SupplierPaymentInput,
  SupplierPaymentResult,
  SupplierStatus,
} from './types'
import type { PurchaseReceiptListResponse } from './purchase-receipt-types'

export interface SupplierApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export interface SupplierInput {
  code: string
  name: string
  phone: string
  email: string
  address: string
  tax_code: string
  linked_customer_id: string | null
  notes: string
  status: SupplierStatus
}

export interface SupplierListFilters {
  search?: string
  status?: SupplierStatus | 'all'
  total_purchase_min?: number
  total_purchase_max?: number
  current_payable_min?: number
  current_payable_max?: number
  page?: number
  page_size?: number
}

export function createSupplierService(api: SupplierApiRequester) {
  return {
    listSuppliers: (input: SupplierListFilters = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('q', input.search)
      if (input.status) params.set('status', input.status)
      if (input.total_purchase_min !== undefined) params.set('total_purchase_min', String(input.total_purchase_min))
      if (input.total_purchase_max !== undefined) params.set('total_purchase_max', String(input.total_purchase_max))
      if (input.current_payable_min !== undefined) params.set('current_payable_min', String(input.current_payable_min))
      if (input.current_payable_max !== undefined) params.set('current_payable_max', String(input.current_payable_max))
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<SupplierListResponse>(`/api/v1/suppliers${query ? `?${query}` : ''}`)
    },
    getSupplier: (id: string) => api.request<Supplier>(`/api/v1/suppliers/${id}`),
    previewKiotVietSupplierImport: async (input: { file: File }) =>
      api.request<KiotVietSupplierImportPreview>('/api/v1/suppliers/import/kiotviet/preview', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietSupplierImportPayload(input)),
      }),
    importKiotVietSuppliers: async (input: { file: File }) =>
      api.request<KiotVietSupplierImportResult>('/api/v1/suppliers/import/kiotviet', {
        method: 'POST',
        body: JSON.stringify(await buildKiotVietSupplierImportPayload(input)),
      }),
    deleteImportedKiotVietSuppliers: () =>
      api.request<KiotVietImportDeleteResult>('/api/v1/suppliers/import/kiotviet', {
        method: 'DELETE',
      }),
    createSupplier: (input: SupplierInput) =>
      api.request<Supplier>('/api/v1/suppliers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateSupplier: (id: string, input: SupplierInput) =>
      api.request<Supplier>(`/api/v1/suppliers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    listCustomers: (input: { search?: string } = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('search', input.search)
      const query = params.toString()
      return api.request<SupplierCustomerListResponse>(`/api/v1/customers${query ? `?${query}` : ''}`)
    },
    listPayableReceipts: (supplierId: string) =>
      api.request<SupplierPayableReceiptListResponse>(`/api/v1/suppliers/${supplierId}/payable-receipts`),
    listPurchaseReceipts: (supplier: Pick<Supplier, 'id' | 'code'>) => {
      const params = new URLSearchParams({
        supplier_id: supplier.id,
        supplier_code: supplier.code,
        status: 'posted',
        page: '1',
        page_size: '100',
      })
      return api.request<PurchaseReceiptListResponse>(`/api/v1/purchase/receipts?${params.toString()}`)
    },
    listFinanceAccounts: () => api.request<SupplierFinanceAccountListResponse>('/api/v1/finance/accounts?is_active=true'),
    paySupplier: (supplierId: string, input: SupplierPaymentInput) =>
      api.request<SupplierPaymentResult>(`/api/v1/suppliers/${supplierId}/payments`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  }
}

export type SupplierService = ReturnType<typeof createSupplierService>

async function buildKiotVietSupplierImportPayload(input: { file: File }) {
  const buffer = await input.file.arrayBuffer()
  return {
    file_name: input.file.name,
    file_base64: arrayBufferToBase64(buffer),
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function createBrowserSupplierService(getAccessToken: () => Promise<string | null>) {
  return createSupplierService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
