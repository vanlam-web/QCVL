import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type {
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
} from './purchase-receipt-types'

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
        page?: number
        page_size?: number
      } = {},
    ) => {
      const params = new URLSearchParams()
      if (input.search) params.set('q', input.search)
      if (input.status) params.set('status', input.status)
      if (input.date_from) params.set('date_from', input.date_from)
      if (input.date_to) params.set('date_to', input.date_to)
      if (input.created_by) params.set('created_by', input.created_by)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
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
    paySupplier: (supplierId: string, input: PurchaseReceiptSupplierPaymentInput) =>
      api.request<PurchaseReceiptSupplierPaymentResult>(`/api/v1/suppliers/${supplierId}/payments`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    listSuppliers: () => api.request<PurchaseReceiptSupplierListResponse>('/api/v1/suppliers?status=active'),
    listProducts: () => api.request<PurchaseReceiptProductListResponse>('/api/v1/products?status=active'),
    listFinanceAccounts: () =>
      api.request<PurchaseReceiptFinanceAccountListResponse>('/api/v1/finance/accounts?is_active=true'),
  }
}

export type PurchaseReceiptService = ReturnType<typeof createPurchaseReceiptService>

export function createBrowserPurchaseReceiptService(getAccessToken: () => Promise<string | null>) {
  return createPurchaseReceiptService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
