import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type { SalesDocumentDetail, SalesDocumentListResponse } from './types'

export type { SalesDocumentDetail, SalesDocumentListItem, SalesDocumentListResponse } from './types'

export interface SalesDocumentApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export function createSalesDocumentService(api: SalesDocumentApiRequester) {
  return {
    listSalesDocuments: (input: {
      search?: string
      type?: 'quote' | 'invoice'
      status?: 'active' | 'converted' | 'completed' | 'cancelled'
      customer_id?: string
      payment_status?: 'not_applicable' | 'unpaid' | 'partial' | 'paid'
      payment_method?: 'cash' | 'bank_transfer'
      created_by?: string
      price_list_id?: string
      from?: string
      to?: string
      page?: number
      page_size?: number
    } = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('search', input.search)
      if (input.type) params.set('type', input.type)
      if (input.status) params.set('status', input.status)
      if (input.customer_id) params.set('customer_id', input.customer_id)
      if (input.payment_status) params.set('payment_status', input.payment_status)
      if (input.payment_method) params.set('payment_method', input.payment_method)
      if (input.created_by) params.set('created_by', input.created_by)
      if (input.price_list_id) params.set('price_list_id', input.price_list_id)
      if (input.from) params.set('from', input.from)
      if (input.to) params.set('to', input.to)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<SalesDocumentListResponse>(`/api/v1/sales-documents${query ? `?${query}` : ''}`)
    },
    getSalesDocument: (id: string) => api.request<SalesDocumentDetail>(`/api/v1/sales-documents/${id}`),
  }
}

export type SalesDocumentService = ReturnType<typeof createSalesDocumentService>

export function createBrowserSalesDocumentService(getAccessToken: () => Promise<string | null>) {
  return createSalesDocumentService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
