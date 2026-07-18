import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinancePage } from './FinancePage'
import type { FinanceService } from './finance-service'
import type {
  CashbookBalance,
  CashbookEntry,
  CashbookEntryDetail,
  CashbookVoucher,
  CustomerDebtDetail,
  CustomerDebtSummary,
  FinanceAccount,
} from './types'

const accounts: FinanceAccount[] = [
  { id: 'cash-1', code: 'CASH', name: 'Quỹ tiền mặt', account_type: 'cash', is_default_cash: true, is_active: true },
  { id: 'bank-1', code: 'MB01', name: 'MB Bank', account_type: 'bank', is_default_cash: false, is_active: true },
]

const balances: CashbookBalance[] = [
  { finance_account_id: 'cash-1', code: 'CASH', name: 'Quỹ tiền mặt', account_type: 'cash', balance: 200000 },
  { finance_account_id: 'bank-1', code: 'MB01', name: 'MB Bank', account_type: 'bank', balance: 300000 },
]

const noCounterparty = { type: 'none' as const, name: null, phone: null }

const debt: CustomerDebtSummary = {
  customer_id: 'customer-1',
  customer_code: 'KH001',
  customer_name: 'Anh Nam',
  total_debt: 500000,
  oldest_order_code: 'HD0001',
  open_invoice_count: 2,
}

const debtDetail: CustomerDebtDetail = {
  customer_id: 'customer-1',
  total_debt: 500000,
  invoices: [
    {
      order_id: 'order-1',
      order_code: 'HD0001',
      created_at: '2026-07-05T02:00:00Z',
      total_amount: 700000,
      paid_amount: 200000,
      debt_amount: 500000,
      remaining_debt: 500000,
    },
  ],
}

const entry: CashbookEntry = {
  id: 'entry-1',
  code: 'PT0001',
  status: 'posted',
  direction: 'in',
  amount_delta: 500000,
  finance_account: { id: 'cash-1', code: 'CASH', name: 'Quỹ tiền mặt', account_type: 'cash' },
  is_business_accounted: true,
  source_type: 'payment_receipt_method',
  created_at: '2026-07-05T02:05:00Z',
  note: 'Thu nợ',
  counterparty: noCounterparty,
}

const cashbookDetail: CashbookEntryDetail = {
  ...entry,
  created_by: { id: 'user-1', name: 'Văn Viết Phương Lâm' },
  counterparty: { type: 'customer', name: 'Anh Nam', phone: '0900000000' },
  payment_method: 'cash',
  source: { type: 'payment_receipt', id: 'receipt-1', code: 'PT0001', order_code: 'HD0001' },
  allocations: [
    {
      order_id: 'order-1',
      order_code: 'HD0001',
      order_total_amount: 700000,
      collected_before: 200000,
      allocated_amount: 500000,
      remaining_after: 0,
    },
  ],
}

const expenseEntry: CashbookEntry = {
  id: 'entry-out-1',
  code: 'PCPN000679',
  status: 'posted',
  direction: 'out',
  amount_delta: -6899000,
  finance_account: { id: 'bank-1', code: 'MB01', name: 'MB Bank', account_type: 'bank' },
  is_business_accounted: false,
  source_type: 'cashbook_voucher',
  created_at: '2026-07-04T09:34:00Z',
  note: null,
  counterparty: noCounterparty,
}

const expenseCashbookDetail: CashbookEntryDetail = {
  ...expenseEntry,
  created_by: { id: 'user-1', name: 'Văn Viết Phương Lâm' },
  counterparty: { type: 'supplier', name: 'Thu Nghĩa', phone: '000100' },
  payment_method: 'bank_transfer',
  source: { type: 'manual_voucher', id: 'voucher-out-1', code: 'PCPN000679', order_code: 'PN000679' },
  allocations: [
    {
      order_id: 'receipt-1',
      order_code: 'PN000679',
      order_total_amount: 6899000,
      collected_before: 0,
      allocated_amount: 6899000,
      remaining_after: 0,
    },
  ],
}

const unallocatedExpenseEntry: CashbookEntry = {
  id: 'entry-out-empty',
  code: 'CTM001181',
  status: 'posted',
  direction: 'out',
  amount_delta: -100000,
  finance_account: { id: 'cash-1', code: 'CASH', name: 'Quỹ tiền mặt', account_type: 'cash' },
  is_business_accounted: true,
  source_type: 'cashbook_voucher',
  created_at: '2026-07-06T01:11:00Z',
  note: 'Ứng lần 2',
  counterparty: noCounterparty,
}

const unallocatedExpenseDetail: CashbookEntryDetail = {
  ...unallocatedExpenseEntry,
  created_by: { id: 'user-2', name: 'Nguyễn Thị Bích Nương' },
  counterparty: { type: 'other', name: 'Tý', phone: '0964917315' },
  payment_method: 'cash',
  source: { type: 'manual_voucher', id: 'voucher-empty-1', code: 'CTM001181', order_code: null },
  allocations: [],
}

const noteLinkedReceiptEntry: CashbookEntry = {
  id: 'entry-note-linked',
  code: 'PT000015',
  status: 'posted',
  direction: 'in',
  amount_delta: 500000,
  finance_account: { id: 'cash-1', code: 'CASH', name: 'Quỹ tiền mặt', account_type: 'cash' },
  is_business_accounted: true,
  source_type: 'payment_receipt_method',
  created_at: '2026-07-06T03:22:00Z',
  note: 'Checkout HD000015',
  counterparty: noCounterparty,
}

const noteLinkedReceiptDetail: CashbookEntryDetail = {
  ...noteLinkedReceiptEntry,
  created_by: { id: 'user-1', name: 'Văn Viết Phương Lâm' },
  counterparty: { type: 'customer', name: 'Khách lẻ', phone: null },
  payment_method: 'cash',
  source: { type: 'payment_receipt', id: 'receipt-note-linked', code: 'PT000015', order_code: null },
  allocations: [],
}

const receiptEntryWithoutDocumentNote: CashbookEntry = {
  ...noteLinkedReceiptEntry,
  id: 'entry-receipt-no-note',
  code: 'PT000009',
  amount_delta: 90000,
  note: null,
}

const receiptDetailWithoutDocumentNote: CashbookEntryDetail = {
  ...noteLinkedReceiptDetail,
  ...receiptEntryWithoutDocumentNote,
  created_by: { id: 'user-1', name: 'Văn Viết Phương Lâm' },
  counterparty: { type: 'customer', name: 'Khách lẻ', phone: null },
  payment_method: 'cash',
  source: { type: 'payment_receipt', id: 'receipt-no-note', code: 'PT000009', order_code: null },
  allocations: [],
}

const partialCheckoutReceiptEntry: CashbookEntry = {
  id: 'entry-partial-checkout',
  code: 'PT000020',
  status: 'posted',
  direction: 'in',
  amount_delta: 100000,
  finance_account: { id: 'cash-1', code: 'CASH', name: 'Quỹ tiền mặt', account_type: 'cash' },
  is_business_accounted: true,
  source_type: 'payment_receipt_method',
  created_at: '2026-07-06T04:15:00Z',
  note: 'Checkout HD000020',
  counterparty: { type: 'customer', name: 'Khách lẻ', phone: null },
}

const partialCheckoutReceiptDetail: CashbookEntryDetail = {
  ...partialCheckoutReceiptEntry,
  created_by: { id: 'user-1', name: 'Văn Viết Phương Lâm' },
  counterparty: { type: 'customer', name: 'Khách lẻ', phone: null },
  payment_method: 'cash',
  source: { type: 'payment_receipt', id: 'receipt-partial-checkout', code: 'PT000020', order_code: 'HD000020' },
  allocations: [
    {
      order_id: 'order-20',
      order_code: 'HD000020',
      order_total_amount: 600000,
      collected_before: 0,
      allocated_amount: 100000,
      remaining_after: 500000,
    },
  ],
}

const stalePartialCheckoutReceiptDetail: CashbookEntryDetail = {
  ...partialCheckoutReceiptDetail,
  allocations: [],
}

const voucher: CashbookVoucher = {
  id: 'voucher-1',
  code: 'PT0001',
  source_type: 'payment_receipt',
  status: 'posted',
  amount: 500000,
}

const manualVoucher: CashbookVoucher = {
  id: 'voucher-2',
  code: 'PC000001',
  source_type: 'manual_voucher',
  status: 'posted',
  amount: 45000,
}

function makeService(overrides: Partial<FinanceService> = {}): FinanceService {
  return {
    listAccounts: vi.fn(async () => ({ items: accounts })),
    listCustomerDebts: vi.fn(async () => ({ items: [debt], page: 1, page_size: 15, total: 1 })),
    getCustomerDebt: vi.fn(async () => debtDetail),
    collectCustomerDebt: vi.fn(async () => ({ payment_receipt_id: 'receipt-1', allocated_amount: 500000 })),
    createFinanceAccount: vi.fn(async (input) => ({ ...input, id: 'created-bank-account' })),
    updateFinanceAccount: vi.fn(async (accountId, input) => ({ ...accounts.find((account) => account.id === accountId) ?? accounts[1], ...input, id: accountId })),
    createCashbookVoucher: vi.fn(async () => ({
      id: 'voucher-2',
      code: 'PC000001',
      source_type: 'manual_voucher' as const,
      status: 'posted' as const,
      amount: 45000,
    })),
    cancelCashbookVoucher: vi.fn(async () => ({
      ...manualVoucher,
      status: 'cancelled' as const,
    })),
    reviseCashbookVoucher: vi.fn(async () => ({
      ...manualVoucher,
      id: 'voucher-3',
      code: 'PC000001.01',
      amount: 50000,
    })),
    listCashbookBalances: vi.fn(async () => ({ items: balances })),
    getCashbookEntry: vi.fn(async () => cashbookDetail),
    getSalesDocumentByCode: vi.fn(async () => null),
    listCashbookEntries: vi.fn(async () => ({
      summary: { opening_balance: 100000, total_in: 500000, total_out: 100000, ending_balance: 400000 },
      items: [entry],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    listCashbookVouchers: vi.fn(async () => ({ items: [voucher], total: 1 })),
    previewKiotVietCashbookImport: vi.fn(async () => ({
      summary: {
        total_rows: 2,
        valid_rows: 2,
        invalid_rows: 0,
        account_count: 2,
        cash_rows: 1,
        bank_rows: 1,
        posted_rows: 2,
        cancelled_rows: 0,
        cash_total_delta: 1000,
        bank_total_delta: -3000,
      },
      invalid_rows: [],
    })),
    importKiotVietCashbook: vi.fn(async () => ({
      summary: {
        total_rows: 2,
        valid_rows: 2,
        invalid_rows: 0,
        account_count: 2,
        cash_rows: 1,
        bank_rows: 1,
        posted_rows: 2,
        cancelled_rows: 0,
        cash_total_delta: 1000,
        bank_total_delta: -3000,
        created_rows: 2,
        updated_rows: 0,
        skipped_rows: 0,
        accounts_created: 2,
        accounts_updated: 0,
      },
      invalid_rows: [],
    })),
    deleteImportedKiotVietCashbook: vi.fn(async () => ({ deleted_rows: 2, blocked_rows: 0 })),
    ...overrides,
  }
}

describe('FinancePage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    })
  })

  it('does not load hidden balance and voucher sections during initial finance load', async () => {
    const service = makeService()

    render(<FinancePage service={service} />)

    await screen.findByText('Sổ quỹ')
    expect(service.listAccounts).toHaveBeenCalledTimes(1)
    expect(service.listCustomerDebts).toHaveBeenCalledTimes(1)
    expect(service.listCashbookEntries).toHaveBeenCalledTimes(1)
    expect(service.listCashbookBalances).not.toHaveBeenCalled()
    expect(service.listCashbookVouchers).not.toHaveBeenCalled()
  })

  it('uses a denser cashbook page size on wide management screens', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 2209,
    })
    const service = makeService({
      listCustomerDebts: vi.fn(async (input = {}) => ({
        items: [],
        page: 1,
        page_size: input.page_size ?? 15,
        total: 0,
      })),
      listCashbookEntries: vi.fn(async (input = {}) => ({
        summary: { opening_balance: 100000, total_in: 500000, total_out: 100000, ending_balance: 400000 },
        items: [entry],
        page: 1,
        page_size: input.page_size ?? 15,
        total: 153,
      })),
    })

    render(<FinancePage service={service} />)

    await waitFor(() => expect(service.listCashbookEntries).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      page_size: 30,
    })))
    const footer = await screen.findByRole('navigation', { name: 'Phân trang sổ quỹ' })
    expect(within(footer).getByRole('combobox', { name: 'Số dòng hiển thị' })).toHaveValue('30')
  })

  it('shows cashbook without auxiliary account debt and voucher sections', async () => {
    render(<FinancePage service={makeService()} />)

    expect(await screen.findByRole('table', { name: 'Sổ quỹ' })).toBeInTheDocument()
    expect(screen.getAllByText('PT0001').length).toBeGreaterThan(0)
    expect(screen.queryByRole('region', { name: 'Tài khoản quỹ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Công nợ khách hàng' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Phiếu thu/chi' })).not.toBeInTheDocument()
    expect(screen.queryByText('Công nợ khách')).not.toBeInTheDocument()
  })

  it('keeps cashbook summary cards directly above the main table', async () => {
    render(<FinancePage service={makeService()} />)

    await screen.findByRole('table', { name: 'Sổ quỹ' })
    const mainSummary = screen.getByRole('region', { name: 'Tổng quan sổ quỹ' })
    const summaryLabels = within(mainSummary)
      .getAllByText(/Quỹ đầu kỳ|Tổng chi|Tồn quỹ|Tổng thu/)
      .map((node) => node.textContent)

    expect(summaryLabels).toEqual(['Quỹ đầu kỳ', 'Tổng thu', 'Tổng chi', 'Tồn quỹ'])
    expect(within(mainSummary).getByText('400 000')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Sổ quỹ' })).not.toBeInTheDocument()
  })

  it('renders only the selected cashbook page size when the API returns an oversized page', async () => {
    const entries = Array.from({ length: 24 }, (_, index): CashbookEntry => ({
      ...entry,
      id: `entry-${index + 1}`,
      code: `PT${String(index + 1).padStart(4, '0')}`,
    }))
    const { container } = render(<FinancePage service={makeService({
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 500000, total_out: 100000, ending_balance: 400000 },
        items: entries,
        page: 1,
        page_size: 15,
        total: 24,
      })),
    })} />)

    await screen.findByText('PT0015')
    const rows = container.querySelectorAll('.finance-cashbook-data-table tr')
    expect(rows).toHaveLength(16)
    expect(screen.getByText('PT0015')).toBeInTheDocument()
    expect(screen.queryByText('PT0016')).not.toBeInTheDocument()
  })

  it('sorts cashbook rows from shared column headers', async () => {
    render(<FinancePage service={makeService({
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 500000, total_out: 100000, ending_balance: 400000 },
        items: [entry, expenseEntry],
        page: 1,
        page_size: 15,
        total: 2,
      })),
    })} />)

    const table = await screen.findByRole('table', { name: 'Sổ quỹ' })
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('PT0001')

    await userEvent.click(within(table).getByRole('button', { name: 'Mã phiếu' }))

    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('PCPN000679')
    expect(within(table).getByRole('columnheader', { name: 'Mã phiếu' })).toHaveAttribute('aria-sort', 'ascending')
  })

  it('filters cashbook entries from the header search', async () => {
    const service = makeService()
    render(<FinancePage service={service} />)

    await userEvent.type(await screen.findByLabelText('Tìm sổ quỹ'), 'PT0001')
    const clearSearchButton = screen.getByRole('button', { name: 'Xóa tìm kiếm' })
    expect(screen.getByLabelText('Tìm sổ quỹ').closest('.management-compact-search')).toContainElement(clearSearchButton)
    expect(clearSearchButton).toHaveClass('management-compact-create-action-clear')
    expect(clearSearchButton).toHaveTextContent('')

    await waitFor(() => expect(service.listCashbookEntries).toHaveBeenCalledWith({
      search: 'PT0001',
      search_scope: 'all',
      from: '2026-07-01',
      to: '2026-07-31',
      finance_account_id: undefined,
      finance_account_type: undefined,
      direction: 'all',
      status: 'posted',
      is_business_accounted: undefined,
      page: 1,
      page_size: 15,
    }))

    await userEvent.click(screen.getByRole('checkbox', { name: 'Phiếu thu' }))
    expect(screen.queryByRole('button', { name: 'Lọc sổ' })).not.toBeInTheDocument()

    expect(service.listCashbookEntries).toHaveBeenLastCalledWith({
      search: 'PT0001',
      search_scope: 'all',
      from: '2026-07-01',
      to: '2026-07-31',
      finance_account_id: undefined,
      finance_account_type: undefined,
      direction: 'in',
      status: 'posted',
      is_business_accounted: undefined,
      page: 1,
      page_size: 15,
    })
  })

  it('filters cashbook by account status and business accounting', async () => {
    const service = makeService({
      listAccounts: vi.fn(async () => ({ items: [accounts[1], accounts[0]] })),
    })
    render(<FinancePage service={service} />)

    await screen.findByRole('table', { name: 'Sổ quỹ' })
    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc tài chính' })
    expect(within(sidebar).queryByRole('heading', { name: 'Sổ quỹ' })).not.toBeInTheDocument()
    expect(within(sidebar).queryByLabelText('Tìm sổ quỹ')).not.toBeInTheDocument()
    expect(within(sidebar).queryByLabelText('Tìm theo')).not.toBeInTheDocument()
    expect(within(sidebar).getByRole('radio', { name: 'Tổng quỹ' })).toBeChecked()
    expect(within(sidebar).getByRole('radio', { name: 'Tiền mặt' })).not.toBeChecked()
    expect(within(sidebar).getByRole('radio', { name: 'Ngân hàng' })).not.toBeChecked()
    expect(within(sidebar).getAllByRole('radio', { name: /Tiền mặt|Ngân hàng|Tổng quỹ/ }).map((input) => input.closest('label')?.textContent)).toEqual([
      'Tổng quỹ',
      'Tiền mặt',
      'Ngân hàng',
    ])
    await waitFor(() => expect(service.listCashbookEntries).toHaveBeenCalled())
    expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.not.objectContaining({
      finance_account_id: 'cash-1',
    }))
    expect(within(sidebar).queryByRole('combobox', { name: 'Quỹ tiền' })).not.toBeInTheDocument()
    expect(within(sidebar).queryByRole('combobox', { name: 'Loại chứng từ' })).not.toBeInTheDocument()
    expect(within(sidebar).queryByRole('combobox', { name: 'Trạng thái sổ quỹ' })).not.toBeInTheDocument()
    expect(within(sidebar).queryByRole('combobox', { name: 'Hạch toán KQKD' })).not.toBeInTheDocument()

    await userEvent.click(within(sidebar).getByRole('radio', { name: 'Ngân hàng' }))
    await waitFor(() => {
      expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.objectContaining({
        finance_account_id: undefined,
        finance_account_type: 'bank',
      }))
    })
    expect(within(sidebar).getByRole('button', { name: 'Chọn tài khoản' })).toHaveTextContent('Chọn tài khoản')
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Chọn tài khoản' }))
    expect(within(sidebar).queryByRole('textbox', { name: 'Tìm kiếm tài khoản' })).not.toBeInTheDocument()
    expect(within(sidebar).getByRole('button', { name: /Sửa tài khoản MB01 - MB Bank/ })).toHaveClass('management-icon-button')
    expect(within(sidebar).getByRole('button', { name: /Ghim tài khoản MB01 - MB Bank/ })).toHaveClass('management-icon-button')
    await userEvent.click(within(sidebar).getByRole('option', { name: /MB01MB Bank/ }))
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: 'Phiếu thu' }))
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: 'Đã hủy' }))
    await userEvent.click(within(sidebar).getByRole('radio', { name: 'Không' }))

    expect(service.listCashbookEntries).toHaveBeenLastCalledWith({
      search: undefined,
      search_scope: 'all',
      from: '2026-07-01',
      to: '2026-07-31',
      finance_account_id: 'bank-1',
      direction: 'in',
      status: 'all',
      is_business_accounted: false,
      page: 1,
      page_size: 15,
    })
  })

  it('shows edit and pin actions on bank account options', async () => {
    const secondBankAccount: FinanceAccount = {
      id: 'bank-2',
      code: 'VCB',
      name: 'Vietcombank',
      account_type: 'bank',
      is_default_cash: false,
      is_active: true,
      account_number: '0771000598653',
      account_holder: 'VAN VIET PHUONG LAM',
    }
    const deletedBankAccount: FinanceAccount = {
      id: 'bank-del',
      code: '0947900909{DEL}',
      name: 'MB',
      account_type: 'bank',
      is_default_cash: false,
      is_active: true,
      account_number: '0947900909{DEL}',
      account_holder: 'VAN VIET PHUONG LAM',
    }
    const service = makeService({
      listAccounts: vi.fn(async () => ({ items: [...accounts, secondBankAccount, deletedBankAccount] })),
    })
    render(<FinancePage service={service} />)

    const sidebar = await screen.findByRole('complementary', { name: 'Bộ lọc tài chính' })
    await userEvent.click(within(sidebar).getByRole('radio', { name: 'Ngân hàng' }))
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Chọn tài khoản' }))

    expect(within(sidebar).getByText('0771000598653')).toBeInTheDocument()
    expect(within(sidebar).getByText('Vietcombank')).toBeInTheDocument()
    expect(within(sidebar).getByText('VAN VIET PHUONG LAM')).toBeInTheDocument()
    expect(within(sidebar).queryByText('0947900909{DEL}')).not.toBeInTheDocument()
    const pinButton = within(sidebar).getByRole('button', { name: /Ghim tài khoản MB01 - MB Bank/ })
    expect(pinButton).toHaveClass('management-icon-button')
    expect(pinButton).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(pinButton)
    expect(pinButton).toHaveAttribute('aria-pressed', 'true')
    expect(pinButton).toHaveClass('management-filter-account-action-pinned')
    expect(JSON.parse(window.localStorage.getItem('finance.bankAccounts.pinnedIds') ?? '[]')).toEqual(['bank-1'])

    await userEvent.click(within(sidebar).getByRole('button', { name: /Sửa tài khoản MB01 - MB Bank/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Sửa tài khoản ngân hàng' })
    expect(within(dialog).getByLabelText('Số tài khoản')).toHaveValue('')
    expect(within(dialog).getByLabelText('Chủ tài khoản')).toHaveValue('')
    await userEvent.type(within(dialog).getByLabelText('Số tài khoản'), '0947900909')
    await userEvent.type(within(dialog).getByLabelText('Chủ tài khoản'), 'van viet phuong lam')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tạo phiếu thu chi' }))
    const voucherDialog = await screen.findByRole('dialog', { name: 'Tạo phiếu thu' })
    expect(within(voucherDialog).getByLabelText('Tài khoản nhận')).toHaveValue('bank-1')
  })

  it('soft deletes bank accounts while keeping historical cashbook rows visible', async () => {
    const historyBankAccount: FinanceAccount = {
      id: 'bank-history',
      code: 'VCB',
      name: 'Vietcombank',
      account_type: 'bank',
      is_default_cash: false,
      is_active: true,
      account_number: '0771000598653',
      account_holder: 'VAN VIET PHUONG LAM',
    }
    const bankEntry: CashbookEntry = {
      ...entry,
      id: 'entry-bank-history',
      finance_account: { id: historyBankAccount.id, code: historyBankAccount.account_number ?? '', name: historyBankAccount.name, account_type: 'bank' },
    }
    const service = makeService({
      listAccounts: vi.fn(async () => ({ items: [accounts[0], historyBankAccount] })),
      updateFinanceAccount: vi.fn(async (accountId, input) => ({ ...historyBankAccount, ...input, id: accountId })),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 0, total_in: 500000, total_out: 0, ending_balance: 500000 },
        items: [bankEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    const sidebar = await screen.findByRole('complementary', { name: 'Bộ lọc tài chính' })
    await userEvent.click(within(sidebar).getByRole('radio', { name: 'Ngân hàng' }))
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Chọn tài khoản' }))
    await userEvent.click(within(sidebar).getByRole('button', { name: /Sửa tài khoản 0771000598653/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Sửa tài khoản ngân hàng' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }))

    expect(service.updateFinanceAccount).toHaveBeenCalledWith('bank-history', { is_active: false })
    expect(screen.queryByRole('dialog', { name: 'Sửa tài khoản ngân hàng' })).not.toBeInTheDocument()
    expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.objectContaining({
      finance_account_id: undefined,
      finance_account_type: 'bank',
    }))
    expect(screen.getByText('0771000598653')).toBeInTheDocument()

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Chọn tài khoản' }))
    expect(within(sidebar).queryByRole('option', { name: /0771000598653/ })).not.toBeInTheDocument()
    await userEvent.click(within(sidebar).getByRole('button', { name: /Tài khoản đã xóa/ }))
    expect(within(sidebar).getByText('0771000598653')).toBeInTheDocument()
    expect(within(sidebar).getByText('Đã xóa')).toBeInTheDocument()
    expect(within(sidebar).queryByText('0771000598653{DEL}')).not.toBeInTheDocument()
  })

  it('uses KV-style checkbox defaults for cashbook direction and status filters', async () => {
    const service = makeService()
    render(<FinancePage service={service} />)

    await screen.findByRole('table', { name: 'Sổ quỹ' })
    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc tài chính' })

    expect(within(sidebar).getByRole('checkbox', { name: 'Phiếu thu' })).not.toBeChecked()
    expect(within(sidebar).getByRole('checkbox', { name: 'Phiếu chi' })).not.toBeChecked()
    expect(within(sidebar).getByRole('checkbox', { name: 'Đã thanh toán' })).toBeChecked()
    expect(within(sidebar).getByRole('checkbox', { name: 'Đã hủy' })).not.toBeChecked()

    expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.not.objectContaining({
      finance_account_id: 'cash-1',
    }))
    expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.objectContaining({
      direction: 'all',
      status: 'posted',
    }))

    await userEvent.click(within(sidebar).getByRole('checkbox', { name: 'Phiếu chi' }))
    expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'out' }))

    await userEvent.click(within(sidebar).getByRole('checkbox', { name: 'Phiếu thu' }))
    expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'all' }))

    await userEvent.click(within(sidebar).getByRole('checkbox', { name: 'Đã thanh toán' }))
    await userEvent.click(within(sidebar).getByRole('checkbox', { name: 'Đã hủy' }))
    expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'cancelled' }))
  })

  it('shows only bank cashbook rows when the bank fund filter is selected', async () => {
    const service = makeService({
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 0, total_in: 500000, total_out: -6899000, ending_balance: -6399000 },
        items: [entry, expenseEntry],
        page: 1,
        page_size: 15,
        total: 2,
      })),
    })
    render(<FinancePage service={service} />)

    const table = await screen.findByRole('table', { name: 'Sổ quỹ' })
    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc tài chính' })

    await userEvent.click(within(sidebar).getByRole('radio', { name: 'Ngân hàng' }))

    await waitFor(() => {
      expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.objectContaining({
        finance_account_id: undefined,
        finance_account_type: 'bank',
      }))
    })
    expect(within(table).queryByRole('row', { name: /PT0001/ })).not.toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /PCPN000679/ })).toHaveTextContent('MB01')
    expect(within(table).queryByText('Tiền mặt')).not.toBeInTheDocument()
  })

  it('adds a local bank account from the cashbook bank picker', async () => {
    const service = makeService()
    render(<FinancePage service={service} />)

    const sidebar = await screen.findByRole('complementary', { name: 'Bộ lọc tài chính' })
    await userEvent.click(within(sidebar).getByRole('radio', { name: 'Ngân hàng' }))
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Thêm' }))

    const dialog = await screen.findByRole('dialog', { name: 'Thêm tài khoản ngân hàng' })
    const form = within(dialog).getByRole('form', { name: 'Thêm tài khoản ngân hàng' })
    expect(within(form).getByRole('option', { name: 'Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam' })).toHaveValue('Vietcombank')
    expect(within(form).getByRole('option', { name: 'VIB - Ngân hàng TMCP Quốc tế Việt Nam' })).toHaveValue('VIB')
    await userEvent.selectOptions(within(form).getByLabelText('Ngân hàng'), 'Vietcombank')
    await userEvent.type(within(form).getByLabelText('Số tài khoản'), '0771000598653')
    await userEvent.type(within(form).getByLabelText('Chủ tài khoản'), 'van viet phuong lam')
    await userEvent.type(within(form).getByLabelText('Số dư ban đầu'), '1500000')
    expect(within(form).getByLabelText('Bật thông báo tiền về')).toBeChecked()
    await userEvent.click(within(form).getByRole('button', { name: 'Lưu' }))

    expect(screen.queryByRole('dialog', { name: 'Thêm tài khoản ngân hàng' })).not.toBeInTheDocument()
    expect(within(sidebar).getByRole('button', { name: 'Chọn tài khoản' })).toHaveTextContent('0771000598653')
    expect(within(sidebar).getByRole('button', { name: 'Chọn tài khoản' })).not.toHaveTextContent('Vietcombank')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('filters cashbook by date range', async () => {
    const service = makeService()
    render(<FinancePage service={service} />)

    await screen.findByRole('table', { name: 'Sổ quỹ' })
    const timeGroup = screen.getByRole('region', { name: 'Thời gian' })
    expect(within(timeGroup).getByRole('button', { name: 'Tháng này' })).toBeInTheDocument()
    expect(within(timeGroup).queryByRole('radio', { name: 'Tùy chỉnh' })).not.toBeInTheDocument()
    await userEvent.click(within(timeGroup).getByText('Tháng này'))
    const quickTimeMenu = screen.getByRole('region', { name: 'Chọn nhanh thời gian' })
    expect(within(quickTimeMenu).getByRole('button', { name: 'Hôm nay' })).toBeInTheDocument()
    expect(within(quickTimeMenu).getByRole('button', { name: 'Tháng trước' })).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Từ ngày'))
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-07-01')
    await userEvent.clear(screen.getByLabelText('Đến ngày'))
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-07-31')

    expect(service.listCashbookEntries).toHaveBeenLastCalledWith(expect.objectContaining({
      search: undefined,
      search_scope: 'all',
      from: '2026-07-01',
      to: '2026-07-31',
    }))
  })

  it('does not show a cashbook reset action in the filter sidebar', async () => {
    const service = makeService()
    render(<FinancePage service={service} />)

    await screen.findByRole('table', { name: 'Sổ quỹ' })
    await userEvent.click(screen.getByRole('radio', { name: 'Ngân hàng' }))

    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc tài chính' })
    expect(within(sidebar).queryByRole('button', { name: 'Đặt lại bộ lọc tài chính' })).not.toBeInTheDocument()
  })

  it('exports visible rows without showing a cashbook column chooser', async () => {
    const service = makeService()
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cashbook')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<FinancePage service={service} />)

    await screen.findByRole('table', { name: 'Sổ quỹ' })
    const voucherActions = screen.getByLabelText('Tác vụ sổ quỹ')
    expect(within(voucherActions).getByRole('button', { name: 'Xuất file' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cột' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Chọn cột sổ quỹ' })).not.toBeInTheDocument()

    await userEvent.click(within(voucherActions).getByRole('button', { name: 'Xuất file' }))
    expect(screen.getByRole('status')).toHaveTextContent('Đã tạo file sổ quỹ')
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()

    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    click.mockRestore()
  })

  it('keeps the cashbook result area aligned to the KiotViet-like main layout', async () => {
    render(<FinancePage service={makeService()} />)

    const table = await screen.findByRole('table', { name: 'Sổ quỹ' })
    const voucherActions = screen.getByLabelText('Tác vụ sổ quỹ')

    expect(screen.getByRole('button', { name: 'Tạo phiếu thu chi' })).toBeInTheDocument()
    expect(within(voucherActions).queryByRole('button', { name: '+ Phiếu thu' })).not.toBeInTheDocument()
    expect(within(voucherActions).queryByRole('button', { name: '+ Phiếu chi' })).not.toBeInTheDocument()
    expect(within(voucherActions).getByRole('button', { name: 'Import' })).toBeInTheDocument()
    expect(within(voucherActions).getByRole('button', { name: 'Xuất file' })).toBeInTheDocument()

    const selectAllCheckbox = within(table).getByRole('checkbox', { name: 'Chọn tất cả dòng sổ quỹ' })
    expect(selectAllCheckbox).toBeInTheDocument()
    expect(selectAllCheckbox.parentElement).toHaveClass('finance-cashbook-checkbox-control')
    expect(within(table).getByRole('columnheader', { name: 'Đánh dấu' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Mã phiếu' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Thời gian' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Người tạo' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Loại thu chi' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Số tài khoản' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Người nộp/nhận' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Giá trị' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Ghi chú' })).toBeInTheDocument()

    const row = within(table).getByRole('row', { name: /PT0001/ })
    expect(within(row).getByText('Phiếu thu')).toBeInTheDocument()
    expect(within(row).queryByText('CASH · Quỹ tiền mặt')).not.toBeInTheDocument()
  })

  it('shows payer or receiver from cashbook rows as a detail link', async () => {
    const entryWithCounterparty = {
      ...entry,
      counterparty: { type: 'customer', name: 'Anh Nam', phone: '0900000000' },
    } satisfies CashbookEntry
    const service = makeService({
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 500000, total_out: 100000, ending_balance: 400000 },
        items: [entryWithCounterparty],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    const table = await screen.findByRole('table', { name: 'Sổ quỹ' })
    const row = within(table).getByRole('row', { name: /PT0001/ })
    const counterpartyLink = within(row).getByRole('button', { name: 'Mở chi tiết PT0001 từ Người nộp Anh Nam' })

    expect(counterpartyLink).toHaveTextContent('Anh Nam')
    await userEvent.click(counterpartyLink)

    expect(await screen.findByRole('region', { name: 'Chi tiết sổ quỹ PT0001' })).toBeInTheDocument()
    expect(service.getCashbookEntry).toHaveBeenCalledWith('entry-1')
  })

  it('keeps cashbook rows visible and hydrates when an older API response omits counterparty', async () => {
    const legacyEntry = { ...entry }
    delete (legacyEntry as Partial<CashbookEntry>).counterparty
    const service = makeService({
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 500000, total_out: 100000, ending_balance: 400000 },
        items: [legacyEntry as CashbookEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    const table = await screen.findByRole('table', { name: 'Sổ quỹ' })
    const row = within(table).getByRole('row', { name: /PT0001/ })

    await waitFor(() => {
      expect(within(row).getByRole('button', { name: 'Mở chi tiết PT0001 từ Người nộp Anh Nam' })).toBeInTheDocument()
    })
  })

  it('keeps hydrated cashbook row counterparties when opening detail', async () => {
    const service = makeService({
      getCashbookEntry: vi.fn(async () => noteLinkedReceiptDetail),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 500000, total_out: 100000, ending_balance: 400000 },
        items: [noteLinkedReceiptEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    const table = await screen.findByRole('table', { name: 'Sổ quỹ' })
    const row = within(table).getByRole('row', { name: /PT000015/ })

    await waitFor(() => {
      expect(within(row).getByRole('button', { name: 'Mở chi tiết PT000015 từ Người nộp khách lẻ' })).toBeInTheDocument()
    })
    await userEvent.click(row)

    const detail = await screen.findByRole('region', { name: 'Chi tiết sổ quỹ PT000015' })
    expect(within(detail).queryByRole('button', { name: 'Người nộp Khách lẻ' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(within(row).getByRole('button', { name: 'Mở chi tiết PT000015 từ Người nộp khách lẻ' })).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: 'Mở chi tiết PT000015 từ Người nộp khách lẻ' })).toHaveTextContent('khách lẻ')
      expect(within(row).getByRole('button', { name: 'Mở chi tiết PT000015 từ Người nộp khách lẻ' })).toHaveClass('finance-cashbook-counterparty-link')
    })
  })

  it('hydrates missing cashbook row counterparties before opening detail', async () => {
    const service = makeService({
      getCashbookEntry: vi.fn(async () => noteLinkedReceiptDetail),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 500000, total_out: 100000, ending_balance: 400000 },
        items: [noteLinkedReceiptEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    const table = await screen.findByRole('table', { name: 'Sổ quỹ' })
    const row = within(table).getByRole('row', { name: /PT000015/ })

    await waitFor(() => {
      expect(within(row).getByRole('button', { name: 'Mở chi tiết PT000015 từ Người nộp khách lẻ' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('region', { name: 'Chi tiết sổ quỹ PT000015' })).not.toBeInTheDocument()
    expect(service.getCashbookEntry).toHaveBeenCalledWith('entry-note-linked')
  })

  it('hydrates KiotViet cashbook row counterparties before opening detail', async () => {
    const kiotVietEntry = {
      ...noteLinkedReceiptEntry,
      id: 'entry-kv-tthd',
      code: 'TTHD010901',
      source_type: 'kiotviet_cashbook' as const,
      note: 'Phiếu thu Tiền khách trả',
      counterparty: { type: 'none', name: '', phone: null },
    } satisfies CashbookEntry
    const kiotVietDetail = {
      ...noteLinkedReceiptDetail,
      ...kiotVietEntry,
      created_by: { id: 'user-1', name: 'Văn Viết Phương Lâm' },
      counterparty: { type: 'customer', name: 'Khách lẻ', phone: null },
      payment_method: 'cash',
      source: { type: 'kiotviet_cashbook', id: 'TTHD010901', code: 'TTHD010901', order_code: null },
    } satisfies CashbookEntryDetail
    const service = makeService({
      getCashbookEntry: vi.fn(async () => kiotVietDetail),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 22000, total_out: 0, ending_balance: 122000 },
        items: [kiotVietEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    const table = await screen.findByRole('table', { name: 'Sổ quỹ' })
    const row = within(table).getByRole('row', { name: /TTHD010901/ })

    await waitFor(() => {
      expect(within(row).getByRole('button', { name: 'Mở chi tiết TTHD010901 từ Người nộp khách lẻ' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('region', { name: 'Chi tiết sổ quỹ TTHD010901' })).not.toBeInTheDocument()
    expect(service.getCashbookEntry).toHaveBeenCalledWith('entry-kv-tthd')
  })

  it('hydrates missing payment receipt counterparty even when note has no invoice code', async () => {
    const service = makeService({
      getCashbookEntry: vi.fn(async () => receiptDetailWithoutDocumentNote),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 90000, total_out: 100000, ending_balance: 90000 },
        items: [receiptEntryWithoutDocumentNote],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    const table = await screen.findByRole('table', { name: 'Sổ quỹ' })
    const row = within(table).getByRole('row', { name: /PT000009/ })

    await waitFor(() => {
      expect(within(row).getByRole('button', { name: 'Mở chi tiết PT000009 từ Người nộp khách lẻ' })).toBeInTheDocument()
    })
    expect(service.getCashbookEntry).toHaveBeenCalledWith('entry-receipt-no-note')
  })

  it('creates a manual cashbook expense voucher and reloads cashbook data', async () => {
    const service = makeService()
    render(<FinancePage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Tạo phiếu thu chi' }))
    await userEvent.click(await screen.findByRole('tab', { name: 'Phiếu chi' }))
    expect(await screen.findByRole('dialog', { name: 'Tạo phiếu chi' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Phiếu chi' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Tạo phiếu chi tiền mặt' })).toBeInTheDocument()
    const form = await screen.findByRole('form', { name: 'Tạo phiếu chi' })

    expect(within(form).getByLabelText('Mã phiếu')).toHaveAttribute('placeholder', 'Tự động')
    expect(within(form).getByLabelText('Người chi')).toHaveValue('Cloud Admin')
    expect(within(form).getByLabelText('Hạch toán kết quả kinh doanh')).toBeChecked()
    await userEvent.selectOptions(within(form).getByLabelText('Tài khoản chi'), 'cash-1')
    await userEvent.selectOptions(within(form).getByLabelText('Loại chi'), 'staff_salary')
    await userEvent.type(within(form).getByLabelText('Số tiền'), '45000')
    await userEvent.selectOptions(within(form).getByLabelText('Đối tượng nhận'), 'employee')
    await userEvent.type(within(form).getByLabelText('Tên người nhận'), 'Nguyen Van A')
    await userEvent.click(within(form).getByLabelText('Hạch toán kết quả kinh doanh'))
    await userEvent.type(within(form).getByLabelText('Ghi chú'), 'Mua văn phòng phẩm')
    expect(within(form).getByRole('button', { name: 'Bỏ qua' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Lưu & In' })).toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: 'Lưu' }))

    expect(service.createCashbookVoucher).toHaveBeenCalledWith({
      voucher_direction: 'out',
      voucher_type: 'staff_salary',
      finance_account_id: 'cash-1',
      amount: 45000,
      partner_debt_mode: 'no_partner_debt',
      is_business_accounted: false,
      counterparty_type: 'employee',
      counterparty_name: 'Nguyen Van A',
      reason: 'Mua văn phòng phẩm',
    })
    await waitFor(() => expect(service.listCashbookEntries).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('status')).toHaveTextContent('Đã tạo phiếu PC000001')
  })

  it('opens cashbook entry detail with allocation rows', async () => {
    const service = makeService()
    render(<FinancePage service={service} />)

    const openButton = await screen.findByRole('button', { name: 'Mở chi tiết PT0001' })
    const cashbookRow = openButton.closest('tr')
    expect(cashbookRow).not.toBeNull()
    await userEvent.click(cashbookRow as HTMLTableRowElement)

    const detail = await screen.findByRole('region', { name: 'Chi tiết sổ quỹ PT0001' })
    expect(cashbookRow).toHaveClass('management-data-row-selected')
    expect(cashbookRow).toHaveAttribute('aria-expanded', 'true')
    expect(detail.closest('tr')).toHaveClass('management-detail-row')
    expect(within(detail).getByRole('tab', { name: 'Thông tin' })).toBeInTheDocument()
    expect(within(detail).getByRole('heading', { name: 'Phiếu thu PT0001' })).toBeInTheDocument()
    expect(within(detail).queryByText('Đã thanh toán')).not.toBeInTheDocument()
    expect(within(detail).getByText('Hoàn tất')).toHaveClass('status-chip', 'status-chip-success')
    expect(within(detail).getByText('Có hạch toán')).toBeInTheDocument()
    expect(within(detail).queryByText('Chi nhánh trung tâm')).not.toBeInTheDocument()
    expect(detail.querySelector('.management-detail-panel')).not.toBeNull()
    expect(detail.querySelector('.finance-cashbook-detail')).toBeNull()
    expect(detail.querySelector('.management-detail-header')).not.toBeNull()
    expect(detail.querySelector('.management-detail-title-line')).toBeNull()
    const metaGrid = detail.querySelector('.management-detail-meta-grid')
    expect(metaGrid).toHaveClass('management-detail-meta-grid-three')
    expect(Array.from(metaGrid?.querySelectorAll('dt') ?? []).map((element) => element.textContent)).toEqual([
      'Người tạo:',
      'Thời gian:',
      'Số tiền',
      'Loại thu',
      'Phương thức thanh toán',
      'Người nộp',
    ])
    expect(detail.querySelector('.management-detail-meta-rows')).toBeNull()
    expect(detail.querySelector('.finance-cashbook-linked-documents-inner')).not.toBeNull()
    expect(detail.querySelector('.management-detail-inline-note')).not.toBeNull()
    expect(
      detail.querySelector('.management-detail-inline-note')?.compareDocumentPosition(
        detail.querySelector('.finance-cashbook-linked-documents') as Node,
      ),
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING)
    const detailText = detail.textContent ?? ''
    expect(detailText).toContain('Người tạo:')
    expect(detailText).toContain('Văn Viết Phương Lâm')
    expect(detailText).not.toContain('Người thu')
    expect(detailText).not.toContain('Người chi')
    expect(detailText).toContain('Thời gian:')
    expect(within(detail).getByText('Số tiền')).toBeInTheDocument()
    expect(within(detail).getByText('Loại thu')).toBeInTheDocument()
    expect(within(detail).getByText('Phương thức thanh toán')).toBeInTheDocument()
    expect(within(detail).getByText('Người nộp')).toBeInTheDocument()
    expect(within(detail).getByText('Anh Nam, 0900000000')).toBeInTheDocument()
    expect(within(detail).queryByText('Đối tượng nộp')).not.toBeInTheDocument()
    expect(within(detail).queryByRole('button', { name: 'Người nộp Anh Nam, 0900000000' })).not.toBeInTheDocument()
    expect(within(detail).queryByText('Đến quỹ')).not.toBeInTheDocument()
    expect(within(detail).getByText('Phiếu thu tự động được gắn với hóa đơn HD0001.')).toBeInTheDocument()
    const linkedDocumentsTable = within(detail).getByRole('table', { name: 'Chứng từ liên kết' })
    expect(linkedDocumentsTable).toBeInTheDocument()
    expect(linkedDocumentsTable).toHaveClass('management-detail-table', 'management-detail-linked-table')
    expect(within(linkedDocumentsTable).getByRole('columnheader', { name: 'Tổng sau giảm' })).toBeInTheDocument()
    expect(within(linkedDocumentsTable).queryByRole('columnheader', { name: 'Giá trị phiếu' })).not.toBeInTheDocument()
    expect(within(linkedDocumentsTable).queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument()
    const linkedInvoice = within(linkedDocumentsTable).getByRole('link', { name: 'HD0001' })
    expect(linkedInvoice).toHaveClass('finance-cashbook-linked-document-link')
    expect(linkedInvoice).toHaveAttribute(
      'href',
      '/sales-documents?open=HD0001&type=invoice',
    )
    expect(within(detail).getByText('Thu nợ')).toBeInTheDocument()
    expect(within(detail).getByText('Hoàn tất')).toHaveClass('status-chip', 'status-chip-success')
    expect(within(detail).getByRole('button', { name: 'Xóa phiếu PT0001' })).toBeEnabled()
    expect(within(detail).queryByRole('button', { name: 'Hủy phiếu PT0001' })).not.toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: 'Sửa phiếu PT0001' })).toBeEnabled()
    expect(within(detail).getByRole('button', { name: 'Sửa phiếu PT0001' })).toHaveClass('button-secondary')
    expect(within(detail).queryByRole('button', { name: 'Chỉnh sửa phiếu PT0001' })).not.toBeInTheDocument()
    await userEvent.click(within(detail).getByRole('button', { name: 'Sửa phiếu PT0001' }))
    const editDialog = await screen.findByRole('dialog', { name: 'Sửa phiếu PT0001' })
    expect(within(editDialog).getByRole('heading', { name: 'Sửa phiếu PT0001' })).toBeInTheDocument()
    expect(within(editDialog).getByRole('button', { name: 'Lưu' })).toBeDisabled()
    await userEvent.click(within(editDialog).getByRole('button', { name: 'Đóng popup sửa phiếu PT0001' }))
    expect(screen.queryByRole('dialog', { name: 'Sửa phiếu PT0001' })).not.toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: 'In phiếu PT0001' })).toBeEnabled()
    expect(within(detail).getAllByText('HD0001').length).toBeGreaterThan(0)
    expect(service.getCashbookEntry).toHaveBeenCalledWith('entry-1')
    const callsBeforeClose = vi.mocked(service.getCashbookEntry).mock.calls.length

    await userEvent.click(cashbookRow as HTMLTableRowElement)
    expect(screen.queryByRole('region', { name: 'Chi tiết sổ quỹ PT0001' })).not.toBeInTheDocument()
    expect(cashbookRow).not.toHaveClass('management-data-row-selected')
    expect(service.getCashbookEntry).toHaveBeenCalledTimes(callsBeforeClose)
  })

  it('keeps cashbook row utilities from opening inline detail', async () => {
    window.localStorage.clear()
    const service = makeService()
    render(<FinancePage service={service} />)

    await screen.findByRole('button', { name: 'Mở chi tiết PT0001' })
    await waitFor(() => expect(service.getCashbookEntry).toHaveBeenCalledWith('entry-1'))
    const callsBeforeUtilityClicks = vi.mocked(service.getCashbookEntry).mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'Đánh dấu ưu tiên PT0001' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn dòng PT0001' }))

    expect(screen.queryByRole('region', { name: 'Chi tiết sổ quỹ PT0001' })).not.toBeInTheDocument()
    expect(service.getCashbookEntry).toHaveBeenCalledTimes(callsBeforeUtilityClicks)
  })

  it('shows expense cashbook detail with payer-free log and expense allocation wording', async () => {
    const service = makeService({
      getCashbookEntry: vi.fn(async () => expenseCashbookDetail),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 0, total_out: 6899000, ending_balance: -6799000 },
        items: [expenseEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết PCPN000679' }))

    const detail = await screen.findByRole('region', { name: 'Chi tiết sổ quỹ PCPN000679' })
    expect(within(detail).getByRole('heading', { name: 'Phiếu chi PCPN000679' })).toBeInTheDocument()
    const detailText = detail.textContent ?? ''
    expect(detailText).toContain('Người tạo:')
    expect(detailText).toContain('Văn Viết Phương Lâm')
    expect(detailText).not.toContain('Người chi')
    expect(within(detail).getByText('Phương thức thanh toán')).toBeInTheDocument()
    expect(within(detail).getByText('MB Bank: MB01')).toBeInTheDocument()
    expect(within(detail).getByText('Phiếu chi tự động được gắn với phiếu nhập hàng PN000679.')).toBeInTheDocument()
    const linkedDocumentsTable = within(detail).getByRole('table', { name: 'Chứng từ liên kết' })
    const linkedReceipt = within(linkedDocumentsTable).getByRole('link', { name: 'PN000679' })
    expect(linkedReceipt).toHaveClass('finance-cashbook-linked-document-link')
    expect(linkedReceipt).toHaveAttribute('href', '/receipts?open=PN000679')
    expect(within(detail).getByText('Đã trả trước')).toBeInTheDocument()
    expect(within(detail).getByText('Giá trị chi')).toBeInTheDocument()
  })

  it('opens shared delete confirmation from cashbook detail and cancels manual vouchers', async () => {
    const service = makeService({
      getCashbookEntry: vi.fn(async () => expenseCashbookDetail),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 0, total_out: 6899000, ending_balance: -6799000 },
        items: [expenseEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết PCPN000679' }))
    const detail = await screen.findByRole('region', { name: /PCPN000679/ })
    await userEvent.click(within(detail).getByRole('button', { name: /Xóa phiếu PCPN000679/ }))

    const dialog = await screen.findByRole('dialog', { name: /Xóa phiếu PCPN000679/ })
    expect(within(dialog).getByText(/hủy mềm/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }))

    expect(service.cancelCashbookVoucher).toHaveBeenCalledWith('voucher-out-1')
    expect(await screen.findByText(/Đã hủy phiếu PC000001/)).toBeInTheDocument()
  })

  it('does not cancel automatic cashbook entries from detail delete dialog', async () => {
    const service = makeService()
    render(<FinancePage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết PT0001' }))
    const detail = await screen.findByRole('region', { name: /PT0001/ })
    await userEvent.click(within(detail).getByRole('button', { name: /Xóa phiếu PT0001/ }))

    const dialog = await screen.findByRole('dialog', { name: /Xóa phiếu PT0001/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đã hiểu' }))

    expect(service.cancelCashbookVoucher).not.toHaveBeenCalled()
    expect(await screen.findByText(/Chỉ xóa\/hủy được phiếu thu\/chi thủ công/)).toBeInTheDocument()
  })

  it('hides linked document shell when the cashbook row has no linked document', async () => {
    const service = makeService({
      getCashbookEntry: vi.fn(async () => unallocatedExpenseDetail),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 0, total_out: 100000, ending_balance: 0 },
        items: [unallocatedExpenseEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết CTM001181' }))

    const detail = await screen.findByRole('region', { name: 'Chi tiết sổ quỹ CTM001181' })
    expect(within(detail).queryByRole('table', { name: 'Chứng từ liên kết' })).not.toBeInTheDocument()
    expect(within(detail).queryByText('Không có chứng từ liên kết.')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Tiền chưa phân bổ:')).not.toBeInTheDocument()
    expect(within(detail).getByText('Ứng lần 2')).toBeInTheDocument()
  })

  it('shows a note-inferred linked invoice when a receipt references a checkout invoice', async () => {
    const service = makeService({
      getCashbookEntry: vi.fn(async () => noteLinkedReceiptDetail),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 500000, total_out: 0, ending_balance: 600000 },
        items: [noteLinkedReceiptEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết PT000015' }))

    const detail = await screen.findByRole('region', { name: 'Chi tiết sổ quỹ PT000015' })
    expect(within(detail).getByText('Hoàn tất')).toHaveClass('status-chip', 'status-chip-success')
    expect(within(detail).queryByText('Không có chứng từ liên kết.')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Không có kết quả phù hợp')).not.toBeInTheDocument()
    expect(within(detail).getByText('Phiếu thu tự động được gắn với hóa đơn HD000015.')).toBeInTheDocument()
    expect(within(detail).getAllByText('HD000015').length).toBeGreaterThan(0)
    const linkedDocuments = within(detail).getByRole('table', { name: 'Chứng từ liên kết' })
    const row = within(linkedDocuments).getByText('HD000015').closest('tr')
    expect(row).not.toBeNull()
    expect(within(linkedDocuments).queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument()
    expect(within(row as HTMLTableRowElement).queryByText('Hoàn tất')).not.toBeInTheDocument()
    expect(within(row as HTMLTableRowElement).queryByText('Đã thanh toán')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Checkout HD000015')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Chưa có ghi chú')).not.toBeInTheDocument()
  })

  it('shows invoice payment state from linked allocation totals', async () => {
    const service = makeService({
      getCashbookEntry: vi.fn(async () => partialCheckoutReceiptDetail),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 100000, total_out: 0, ending_balance: 200000 },
        items: [partialCheckoutReceiptEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết PT000020' }))

    const detail = await screen.findByRole('region', { name: 'Chi tiết sổ quỹ PT000020' })
    expect(within(detail).getByText('Thanh toán 1 phần')).toHaveClass('status-chip', 'status-chip-warning')
    const linkedDocuments = within(detail).getByRole('table', { name: 'Chứng từ liên kết' })
    expect(within(linkedDocuments).getByRole('columnheader', { name: 'Chưa TT' })).toBeInTheDocument()
    expect(within(linkedDocuments).queryByRole('columnheader', { name: 'Đã thu trước' })).not.toBeInTheDocument()
    expect(within(linkedDocuments).queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument()
    const row = within(linkedDocuments).getByText('HD000020').closest('tr')
    expect(row).not.toBeNull()
    expect(within(row as HTMLTableRowElement).getByText('600 000')).toBeInTheDocument()
    expect(within(row as HTMLTableRowElement).getByText('500 000')).toBeInTheDocument()
    expect(within(row as HTMLTableRowElement).getByText('100 000')).toBeInTheDocument()
    expect(within(row as HTMLTableRowElement).queryByText('Thanh toán 1 phần')).not.toBeInTheDocument()
  })

  it('hydrates missing linked invoice allocation from the sales document', async () => {
    const service = makeService({
      getCashbookEntry: vi.fn(async () => stalePartialCheckoutReceiptDetail),
      getSalesDocumentByCode: vi.fn(async () => ({
        id: 'order-20',
        code: 'HD000020',
        total_amount: 600000,
        paid_amount: 100000,
        debt_amount: 500000,
        payment_status: 'partial' as const,
      })),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 100000, total_out: 0, ending_balance: 200000 },
        items: [partialCheckoutReceiptEntry],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết PT000020' }))

    const detail = await screen.findByRole('region', { name: 'Chi tiết sổ quỹ PT000020' })
    expect(within(detail).getByText('Thanh toán 1 phần')).toHaveClass('status-chip', 'status-chip-warning')
    const linkedDocuments = within(detail).getByRole('table', { name: 'Chứng từ liên kết' })
    const row = within(linkedDocuments).getByText('HD000020').closest('tr')
    expect(row).not.toBeNull()
    expect(within(row as HTMLTableRowElement).getByText('600 000')).toBeInTheDocument()
    expect(within(row as HTMLTableRowElement).getByText('500 000')).toBeInTheDocument()
    expect(within(row as HTMLTableRowElement).getByText('100 000')).toBeInTheDocument()
    expect(service.getSalesDocumentByCode).toHaveBeenCalledWith('HD000020')
  })

  it('hydrates missing receipt counterparty from the linked sales document customer', async () => {
    const receiptWithoutCounterparty = {
      ...stalePartialCheckoutReceiptDetail,
      counterparty: noCounterparty,
    } satisfies CashbookEntryDetail
    const service = makeService({
      getCashbookEntry: vi.fn(async () => receiptWithoutCounterparty),
      getSalesDocumentByCode: vi.fn(async () => ({
        id: 'order-20',
        code: 'HD000020',
        total_amount: 600000,
        paid_amount: 100000,
        debt_amount: 500000,
        payment_status: 'partial' as const,
        customer: { id: 'customer-xd', code: 'KH011', name: 'Xuân Đức', phone: '0909000000' },
      })),
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 100000, total_out: 0, ending_balance: 200000 },
        items: [{ ...partialCheckoutReceiptEntry, counterparty: noCounterparty }],
        page: 1,
        page_size: 15,
        total: 1,
      })),
    })
    render(<FinancePage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết PT000020' }))

    const detail = await screen.findByRole('region', { name: 'Chi tiết sổ quỹ PT000020' })
    expect(within(detail).queryByRole('button', { name: 'Người nộp Xuân Đức, 0909000000' })).not.toBeInTheDocument()
    expect(within(detail).getByText('Người nộp')).toBeInTheDocument()
    expect(within(detail).getByText('Xuân Đức, 0909000000')).toBeInTheDocument()
    expect(service.getSalesDocumentByCode).toHaveBeenCalledWith('HD000020')
  })

  it('persists cashbook favorite marks and filters the current page by favorites', async () => {
    window.localStorage.clear()
    const secondEntry: CashbookEntry = {
      ...expenseEntry,
      id: 'entry-favorite-2',
      code: 'PT000016',
      direction: 'in',
      amount_delta: 360000,
      source_type: 'payment_receipt_method',
      counterparty: noCounterparty,
    }
    const service = makeService({
      listCashbookEntries: vi.fn(async () => ({
        summary: { opening_balance: 100000, total_in: 860000, total_out: 0, ending_balance: 960000 },
        items: [noteLinkedReceiptEntry, secondEntry],
        page: 1,
        page_size: 15,
        total: 2,
      })),
    })
    render(<FinancePage service={service} />)

    await screen.findByRole('button', { name: 'Mở chi tiết PT000015' })
    await userEvent.click(screen.getByRole('button', { name: 'Đánh dấu ưu tiên PT000015' }))

    expect(screen.getByRole('button', { name: 'Bỏ ưu tiên PT000015' })).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(window.localStorage.getItem('finance.cashbook.favoriteEntryIds') ?? '[]')).toEqual(['entry-note-linked'])

    await userEvent.click(screen.getByRole('button', { name: 'Chỉ hiện mục ưu tiên' }))
    expect(screen.getByRole('button', { name: 'Mở chi tiết PT000015' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mở chi tiết PT000016' })).not.toBeInTheDocument()
  })

})
