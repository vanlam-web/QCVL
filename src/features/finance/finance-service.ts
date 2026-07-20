import { createApiClient } from '../../lib/api/client'
import { runtimeConfig } from '../../lib/config/runtime'
import type { ManagementExportCell } from '../../components/ui-shell/management-export'
import type {
  CashbookDirection,
  CashbookEntryDetail,
  CashbookEntry,
  CashbookSearchScope,
  CashbookStatus,
  CashbookListResponse,
  CashbookVoucher,
  CashbookVoucherCounterpartyOption,
  CashbookVoucherListResponse,
  CreateCashbookVoucherInput,
  CustomerDebtDetail,
  CustomerDebtListResponse,
  DebtCollectionInput,
  DebtCollectionResult,
  FinanceAccountListResponse,
  CashbookBalanceListResponse,
  FinanceAccount,
  FinanceSalesDocumentSummary,
  KiotVietCashbookDeleteResult,
  KiotVietCashbookImportPreview,
  CustomerDebtAdjustment,
  UpdateCustomerDebtAdjustmentInput,
  UpdateCashbookEntryInput,
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
    createFinanceAccount: (input: Omit<FinanceAccount, 'id'>) =>
      api.request<FinanceAccount>('/api/v1/finance/accounts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateFinanceAccount: (accountId: string, input: Partial<FinanceAccount>) =>
      api.request<FinanceAccount>(`/api/v1/finance/accounts/${accountId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
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
    updateCustomerDebtAdjustment: (adjustmentId: string, input: UpdateCustomerDebtAdjustmentInput) =>
      api.request<CustomerDebtAdjustment>(`/api/v1/finance/customer-debt-adjustments/${encodeURIComponent(adjustmentId)}`, {
        method: 'PATCH',
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
      sort_key?: 'code' | 'created_at' | 'created_by' | 'source_type' | 'counterparty' | 'finance_account' | 'amount_delta' | 'status' | 'note' | 'is_business_accounted'
      sort_direction?: 'asc' | 'desc'
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
      params.set('sort_key', input.sort_key ?? 'created_at')
      params.set('sort_direction', input.sort_direction ?? 'desc')
      const query = params.toString()
      return api.request<CashbookListResponse>(`/api/v1/finance/cashbook${query ? `?${query}` : ''}`)
    },
    getCashbookEntry: (entryId: string) => api.request<CashbookEntryDetail>(`/api/v1/finance/cashbook/${entryId}`),
    updateCashbookEntry: (entryId: string, input: UpdateCashbookEntryInput) =>
      api.request<CashbookEntryDetail>(`/api/v1/finance/cashbook/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
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
    listVoucherCounterparties: async (input: { type: 'customer' | 'supplier'; search?: string }) => {
      const params = new URLSearchParams()
      if (input.search?.trim()) params.set('search', input.search.trim())
      params.set('page', '1')
      params.set('page_size', '8')
      if (input.type === 'supplier') params.set('status', 'active')
      const path = input.type === 'supplier' ? '/api/v1/suppliers' : '/api/v1/customers'
      const result = await api.request<{ items: CashbookVoucherCounterpartyOption[] }>(`${path}?${params.toString()}`)
      return result.items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        phone: item.phone ?? null,
      }))
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
    previewKiotVietCashbookImport: async (input: { file: File }) =>
      api.request<KiotVietCashbookImportPreview>('/api/v1/finance/cashbook/import/kiotviet/preview', {
        method: 'POST',
        body: JSON.stringify(await fileImportPayload(input.file)),
      }),
    importKiotVietCashbook: async (input: { file: File }) =>
      api.request<KiotVietCashbookImportPreview>('/api/v1/finance/cashbook/import/kiotviet', {
        method: 'POST',
        body: JSON.stringify(await fileImportPayload(input.file)),
      }),
    deleteImportedKiotVietCashbook: () =>
      api.request<KiotVietCashbookDeleteResult>('/api/v1/finance/cashbook/import/kiotviet', { method: 'DELETE' }),
  }
}

export type FinanceService = ReturnType<typeof createFinanceService>

export function buildCashbookCsv(items: CashbookEntry[]): ManagementExportCell[][] {
  return [
    ['Mã phiếu', 'Thời gian', 'Người tạo', 'Loại phiếu', 'Số tài khoản', 'Người nộp/nhận', 'Giá trị', 'Ghi chú'],
    ...items.map((entry) => [
      entry.code,
      entry.created_at,
      entry.source?.source_creator_name ?? entry.created_by?.name ?? '',
      entry.source?.category_name ?? '',
      entry.finance_account.account_type === 'bank' ? entry.finance_account.code : '',
      entry.counterparty?.name ?? '',
      String(entry.amount_delta),
      entry.source?.source_note ?? entry.source?.transfer_content ?? entry.note ?? '',
    ]),
  ]
}

async function fileImportPayload(file: File) {
  const buffer = await file.arrayBuffer()
  return {
    file_name: file.name,
    file_base64: arrayBufferToBase64(buffer),
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function createBrowserFinanceService(getAccessToken: () => Promise<string | null>) {
  return createFinanceService(
    createApiClient({
      baseUrl: runtimeConfig.apiBaseUrl,
      getAccessToken,
    }),
  )
}
