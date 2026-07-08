import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type {
  CashbookDirection,
  CashbookEntryDetail,
  CashbookEntry,
  CashbookSearchScope,
  CashbookStatus,
  CashbookListResponse,
  CashbookVoucher,
  CashbookVoucherListResponse,
  CreateCashbookVoucherInput,
  CustomerDebtDetail,
  CustomerDebtListResponse,
  DebtCollectionInput,
  DebtCollectionResult,
  FinanceAccountListResponse,
  CashbookBalanceListResponse,
  FinanceSalesDocumentSummary,
} from './types'

export interface FinanceApiRequester {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export function createFinanceService(api: FinanceApiRequester) {
  return {
    listAccounts: (input: { is_active?: boolean } = {}) => {
      const params = new URLSearchParams()
      if (input.is_active !== undefined) params.set('is_active', String(input.is_active))
      const query = params.toString()
      return api.request<FinanceAccountListResponse>(`/api/v1/finance/accounts${query ? `?${query}` : ''}`)
    },
    listCustomerDebts: (input: { search?: string; page?: number; page_size?: number } = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('search', input.search)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<CustomerDebtListResponse>(`/api/v1/finance/customer-debts${query ? `?${query}` : ''}`)
    },
    getCustomerDebt: (customerId: string) =>
      api.request<CustomerDebtDetail>(`/api/v1/finance/customers/${customerId}/debt`),
    collectCustomerDebt: (input: DebtCollectionInput) =>
      api.request<DebtCollectionResult>('/api/v1/finance/debt-collections', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    listCashbookBalances: () => api.request<CashbookBalanceListResponse>('/api/v1/finance/cashbook/balances'),
    listCashbookEntries: (input: {
      search?: string
      search_scope?: CashbookSearchScope
      finance_account_id?: string
      finance_account_type?: 'cash' | 'bank'
      direction?: CashbookDirection | 'all'
      status?: CashbookStatus | 'all'
      is_business_accounted?: boolean
      from?: string
      to?: string
      page?: number
      page_size?: number
    } = {}) => {
      const params = new URLSearchParams()
      if (input.search) params.set('search', input.search)
      if (input.search_scope && input.search_scope !== 'all') params.set('search_scope', input.search_scope)
      if (input.finance_account_id) params.set('finance_account_id', input.finance_account_id)
      if (input.finance_account_type) params.set('finance_account_type', input.finance_account_type)
      if (input.direction && input.direction !== 'all') params.set('direction', input.direction)
      if (input.status && input.status !== 'all') params.set('status', input.status)
      if (input.is_business_accounted !== undefined) params.set('is_business_accounted', String(input.is_business_accounted))
      if (input.from) params.set('from', input.from)
      if (input.to) params.set('to', input.to)
      if (input.page) params.set('page', String(input.page))
      if (input.page_size) params.set('page_size', String(input.page_size))
      const query = params.toString()
      return api.request<CashbookListResponse>(`/api/v1/finance/cashbook${query ? `?${query}` : ''}`)
    },
    getCashbookEntry: (entryId: string) => api.request<CashbookEntryDetail>(`/api/v1/finance/cashbook/${entryId}`),
    getSalesDocumentByCode: async (code: string) => {
      const params = new URLSearchParams({
        search: code,
        type: 'invoice',
        page: '1',
        page_size: '1',
      })
      const result = await api.request<{ items: FinanceSalesDocumentSummary[] }>(`/api/v1/sales-documents?${params.toString()}`)
      return result.items.find((item) => item.code === code) ?? null
    },
    listCashbookVouchers: () => api.request<CashbookVoucherListResponse>('/api/v1/finance/cashbook/vouchers'),
    createCashbookVoucher: (input: CreateCashbookVoucherInput) =>
      api.request<CashbookVoucher>('/api/v1/finance/cashbook-vouchers', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    cancelCashbookVoucher: (voucherId: string) =>
      api.request<CashbookVoucher>(`/api/v1/finance/cashbook-vouchers/${voucherId}/cancel`, {
        method: 'POST',
      }),
    reviseCashbookVoucher: (voucherId: string, input: CreateCashbookVoucherInput) =>
      api.request<CashbookVoucher>(`/api/v1/finance/cashbook-vouchers/${voucherId}/revise`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  }
}

export type FinanceService = ReturnType<typeof createFinanceService>

export function buildCashbookCsv(items: CashbookEntry[]) {
  const rows = [
    ['Mã phiếu', 'Thời gian', 'Loại thu chi', 'Người nộp/nhận', 'Giá trị', 'Quỹ/Tài khoản', 'Trạng thái', 'Ghi chú', 'Hạch toán KQKD'],
    ...items.map((entry) => [
      entry.code,
      entry.created_at,
      '',
      entry.counterparty?.name ?? '',
      String(entry.amount_delta),
      entry.finance_account.code,
      entry.status,
      entry.note ?? '',
      String(entry.is_business_accounted),
    ]),
  ]
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function createBrowserFinanceService(getAccessToken: () => Promise<string | null>) {
  return createFinanceService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
