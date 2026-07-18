import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type {
  CheckoutInput,
  CheckoutResult,
  CustomerDebtDetail,
  FinanceAccount,
  QuoteReopenPayload,
  QuoteSummary,
  RecentPriceList,
  ReviseInvoiceInput,
} from './types'

export type {
  CheckoutCartLine,
  CheckoutResult,
  CustomerDebtDetail,
  FinanceAccount,
  InvoiceRevisionHandoffPayload,
  QuoteReopenPayload,
  QuoteSummary,
  RecentPriceList,
  ReviseInvoiceInput,
} from './types'

export interface OrderApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export function createOrderService(api: OrderApiRequester) {
  return {
    validateCart: (input: CheckoutInput) =>
      api.request<{ valid: boolean }>('/api/v1/pos/cart/validate', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    checkout: (input: CheckoutInput) =>
      api.request<CheckoutResult>('/api/v1/orders/checkout', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    saveQuote: (input: CheckoutInput) =>
      api.request<QuoteSummary>('/api/v1/orders/quotes', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    reviseInvoice: (orderId: string, input: ReviseInvoiceInput) =>
      api.request<CheckoutResult>(`/api/v1/orders/${orderId}/revise`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    getQuoteReopenPayload: (quoteId: string) =>
      api.request<QuoteReopenPayload>(`/api/v1/orders/quotes/${quoteId}/reopen-payload`),
    listFinanceAccounts: () => api.request<{ items: FinanceAccount[] }>('/api/v1/finance/accounts'),
    getCustomerDebt: (customerId: string) =>
      api.request<CustomerDebtDetail>(`/api/v1/finance/customers/${customerId}/debt`),
    listRecentCustomerProductPrices: (customerId: string, productId: string) =>
      api.request<RecentPriceList>(
        `/api/v1/customers/${customerId}/products/${productId}/recent-prices`,
      ),
  }
}

export type OrderService = ReturnType<typeof createOrderService>

export function createBrowserOrderService(getAccessToken: () => Promise<string | null>) {
  return createOrderService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
