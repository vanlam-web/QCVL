import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type { CashbookListResponse, CustomerDebtListResponse } from '../finance/types'
import type { InventoryProductListResponse } from '../inventory/types'
import type { SalesDocumentListResponse } from '../sales-documents/types'

export interface ReportApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export function createReportService(api: ReportApiRequester) {
  return {
    listSalesDocuments: (input: { from?: string; to?: string; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      params.set('type', 'invoice')
      params.set('status', 'completed')
      if (input.from) params.set('from', input.from)
      if (input.to) params.set('to', input.to)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      return api.request<SalesDocumentListResponse>(`/api/v1/sales-documents?${params.toString()}`)
    },
    listCustomerDebts: (input: { page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<CustomerDebtListResponse>(`/api/v1/finance/customer-debts${query ? `?${query}` : ''}`)
    },
    listCashbook: (input: { from?: string; to?: string; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.from) params.set('from', input.from)
      if (input.to) params.set('to', input.to)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<CashbookListResponse>(`/api/v1/finance/cashbook${query ? `?${query}` : ''}`)
    },
    listInventoryProducts: (input: { page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      params.set('status', 'active')
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      return api.request<InventoryProductListResponse>(`/api/v1/inventory/products?${params.toString()}`)
    },
  }
}

export type ReportService = ReturnType<typeof createReportService>

export function createBrowserReportService(getAccessToken: () => Promise<string | null>) {
  return createReportService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
