import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CustomersPage } from './CustomersPage'
import type { CatalogService } from './catalog-service'
import type { FinanceService } from '../finance/finance-service'
import type { OrderService } from '../orders/order-service'
import type { SalesDocumentService } from '../sales-documents/sales-document-service'

function makeService(overrides: Partial<CatalogService> = {}): CatalogService {
  return {
    listProducts: vi.fn(async () => ({ items: [], page: 1, page_size: 20, total: 0 })),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    getProductBom: vi.fn(async () => null),
    saveProductBom: vi.fn(),
    listProductGroups: vi.fn(async () => ({ items: [] })),
    createProductGroup: vi.fn(),
    updateProductGroup: vi.fn(),
    previewKiotVietProductImport: vi.fn(),
    importKiotVietProducts: vi.fn(),
    deleteImportedKiotVietProducts: vi.fn(async () => ({ deleted_rows: 0, blocked_rows: 0 })),
    listStockMovements: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    listInventoryRolls: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    listInventorySheets: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    adjustNormalProductStock: vi.fn(),
    recordSearchSelection: vi.fn(async () => ({ ok: true })),
    listCustomers: vi.fn(async () => ({
      items: [
        {
          id: 'customer-1',
          code: 'KH000123',
          name: 'Công ty Phong Cảnh',
          phone: '0909000000',
          tax_code: '0312345678',
          address: '12 Nguyễn Trãi, Quận 1',
          customer_group_id: null,
          customer_group: { id: 'cg-1', code: 'VIP', name: 'Khách VIP' },
          customer_type: 'company',
          created_by: { id: 'user-admin', name: 'Admin' },
          created_at: '2026-06-30T17:08:00Z',
          note: 'Ghi chú khách KV',
          status: 'active',
          total_sales_amount: 750000,
          total_debt_amount: 250000,
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    listCustomerGroups: vi.fn(async () => ({
      items: [
        { id: 'cg-1', code: 'VIP', name: 'Khách VIP', price_list_id: 'pl-1', is_active: true },
      ],
    })),
    previewKiotVietCustomerImport: vi.fn(),
    importKiotVietCustomers: vi.fn(),
    deleteImportedKiotVietCustomers: vi.fn(async () => ({ deleted_rows: 0, blocked_rows: 0 })),
    createCustomer: vi.fn(async () => ({
      id: 'customer-2',
      code: 'KH000124',
      name: 'Nguyễn Văn A',
      phone: '0911000000',
      tax_code: '0311111111',
      address: '99 Lê Lợi',
      customer_group_id: null,
      customer_group: null,
      created_by: { id: 'user-admin', name: 'Admin' },
      created_at: '2026-07-03T03:00:00Z',
      total_sales_amount: 0,
      total_debt_amount: 0,
    })),
    updateCustomer: vi.fn(),
    resolvePrices: vi.fn(async () => ({ items: [] })),
    listPriceLists: vi.fn(async () => ({ items: [] })),
    previewPriceFormula: vi.fn(),
    applyPriceFormula: vi.fn(),
    ...overrides,
  }
}

function makeOrderService(overrides: Partial<Pick<OrderService, 'getCustomerDebt'>> = {}) {
  return {
    getCustomerDebt: vi.fn(async () => ({
      customer_id: 'customer-1',
      total_debt: 250000,
      invoices: [
        {
          order_id: 'order-1',
          order_code: 'HD010985',
          created_at: '2026-06-30T17:08:00Z',
          total_amount: 150000,
          paid_amount: 0,
          debt_amount: 150000,
          remaining_debt: 150000,
        },
        {
          order_id: 'order-2',
          order_code: 'HD010986',
          created_at: '2026-06-29T17:08:00Z',
          total_amount: 200000,
          paid_amount: 50000,
          debt_amount: 150000,
          remaining_debt: 150000,
        },
      ],
      cashbook_entries: [
        {
          id: 'cashbook-1',
          code: 'TT000001',
          status: 'posted' as const,
          direction: 'in' as const,
          amount_delta: 190000,
          finance_account: { id: 'cash-main', code: 'TM', name: 'Tiền mặt', account_type: 'cash' as const },
          is_business_accounted: true,
          source_type: 'payment_receipt_method' as const,
          created_at: '2026-06-29T18:00:00Z',
          note: null,
          counterparty: { type: 'customer' as const, name: 'Công ty Phong Cảnh', phone: '0909000000' },
          created_by: { id: 'user-admin', name: 'Admin' },
          source: { type: 'payment_receipt', id: 'TT000001', code: 'TT000001', order_code: 'HD010986' },
        },
      ],
      ledger_rows: [
        {
          id: 'order-3',
          code: 'HD010987',
          created_at: '2026-06-28T17:08:00Z',
          amount_delta: 90000,
          balance_after: 90000,
          source_type: 'invoice',
          source_id: 'order-3',
        },
        {
          id: 'order-2',
          code: 'HD010986',
          created_at: '2026-06-29T17:08:00Z',
          amount_delta: 200000,
          balance_after: 290000,
          source_type: 'invoice',
          source_id: 'order-2',
        },
        {
          id: 'cashbook-1',
          code: 'TT000001',
          created_at: '2026-06-29T18:00:00Z',
          amount_delta: -190000,
          balance_after: 100000,
          source_type: 'payment',
          source_id: 'cashbook-1',
        },
        {
          id: 'order-1',
          code: 'HD010985',
          created_at: '2026-06-30T17:08:00Z',
          amount_delta: 150000,
          balance_after: 250000,
          source_type: 'invoice',
          source_id: 'order-1',
        },
      ],
    })),
    ...overrides,
  } satisfies Pick<OrderService, 'getCustomerDebt'>
}

function makeSalesDocumentService(overrides: Partial<Pick<SalesDocumentService, 'listSalesDocuments'>> = {}) {
  const quoteItems = [
    {
      id: 'quote-1',
      code: 'BG000245',
      order_type: 'quote' as const,
      status: 'active' as const,
      created_at: '2026-06-29T09:30:00Z',
      customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: '0909000000' },
      seller: { id: 'seller-1', name: 'Admin' },
      subtotal_amount: 120000,
      discount_amount: 0,
      total_amount: 120000,
      paid_amount: 0,
      debt_amount: 0,
      payment_status: 'not_applicable' as const,
      note: null,
    },
  ]
  const invoiceItems = [
    {
      id: 'order-1',
      code: 'HD010985',
      order_type: 'invoice' as const,
      status: 'completed' as const,
      created_at: '2026-06-30T17:08:00Z',
      customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: '0909000000' },
      seller: { id: 'seller-1', name: 'Admin' },
      subtotal_amount: 180000,
      discount_amount: 30000,
      total_amount: 150000,
      paid_amount: 0,
      debt_amount: 150000,
      payment_status: 'partial' as const,
      note: 'Khách lấy sau',
    },
    {
      id: 'order-cancelled',
      code: 'HD-CANCELLED',
      order_type: 'invoice' as const,
      status: 'cancelled' as const,
      created_at: '2026-06-27T17:08:00Z',
      customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: '0909000000' },
      seller: { id: 'seller-cancelled', name: 'Hệ thống KV' },
      subtotal_amount: 90000,
      discount_amount: 0,
      total_amount: 90000,
      paid_amount: 0,
      debt_amount: 90000,
      payment_status: 'unpaid' as const,
      note: null,
    },
    {
      id: 'order-2',
      code: 'HD010986',
      order_type: 'invoice' as const,
      status: 'completed' as const,
      created_at: '2026-06-29T17:08:00Z',
      customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: '0909000000' },
      seller: { id: 'seller-1', name: 'Admin' },
      subtotal_amount: 200000,
      discount_amount: 0,
      total_amount: 200000,
      paid_amount: 50000,
      debt_amount: 150000,
      payment_status: 'partial' as const,
      note: null,
    },
    {
      id: 'order-3',
      code: 'HD010987',
      order_type: 'invoice' as const,
      status: 'completed' as const,
      created_at: '2026-06-28T17:08:00Z',
      customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: '0909000000' },
      seller: { id: 'seller-1', name: 'Admin' },
      subtotal_amount: 90000,
      discount_amount: 0,
      total_amount: 90000,
      paid_amount: 90000,
      debt_amount: 0,
      payment_status: 'paid' as const,
      note: null,
    },
  ]
  return {
    listSalesDocuments: vi.fn(async (input = {}) => ({
      items: input.type === 'quote'
        ? input.status === 'active'
          ? quoteItems
          : []
        : input.type === 'invoice'
          ? input.status === 'completed'
            ? invoiceItems.filter((item) => item.status === 'completed')
            : invoiceItems
          : [],
      page: 1,
      page_size: 10,
      total: input.type === 'quote'
        ? (input.status === 'active' ? quoteItems.length : 0)
        : input.type === 'invoice'
          ? (input.status === 'completed' ? invoiceItems.filter((item) => item.status === 'completed').length : invoiceItems.length)
          : 0,
    })),
    ...overrides,
  } satisfies Pick<SalesDocumentService, 'listSalesDocuments'>
}

function makeFinanceService(overrides: Partial<Pick<FinanceService, 'listCashbookEntries' | 'collectCustomerDebt' | 'listAccounts' | 'updateCustomerDebtAdjustment'>> = {}) {
  return {
    listAccounts: vi.fn(async () => ({ items: [] })),
    listCashbookEntries: vi.fn(async () => ({
      items: [
        {
          id: 'cashbook-1',
          code: 'TT000001',
          status: 'posted' as const,
          direction: 'in' as const,
          amount_delta: 190000,
          finance_account: { id: 'cash-main', code: 'TM', name: 'Tiền mặt', account_type: 'cash' as const },
          is_business_accounted: true,
          source_type: 'payment_receipt_method' as const,
          created_at: '2026-06-29T18:00:00Z',
          note: null,
          counterparty: { type: 'customer' as const, name: 'Công ty Phong Cảnh', phone: '0909000000' },
          created_by: { id: 'user-admin', name: 'Admin' },
          source: { type: 'payment_receipt', id: 'TT000001', code: 'TT000001', order_code: 'HD010986' },
        },
      ],
      page: 1,
      page_size: 1000,
      total: 1,
      summary: { opening_balance: 0, total_in: 190000, total_out: 0, ending_balance: 190000 },
    })),
    collectCustomerDebt: vi.fn(async () => ({ payment_receipt_id: 'TT000001', allocated_amount: 250000 })),
    updateCustomerDebtAdjustment: vi.fn(async () => ({
      id: 'customer-debt-adjustment-kv-cb000001',
      source_code: 'CB000001',
      created_at: '2023-07-12T16:27:00.000Z',
      transaction_type: 'Dieu chinh',
      amount_delta: 2000000,
      paid_amount: 0,
      remaining_amount: 2000000,
      balance_after: 1000000,
      source_file: 'Ghi chú mới',
    })),
    ...overrides,
  } satisfies Pick<FinanceService, 'listAccounts' | 'listCashbookEntries' | 'collectCustomerDebt' | 'updateCustomerDebtAdjustment'>
}

it('lists customers in the shared management layout', async () => {
  const service = makeService()
  const orderService = makeOrderService()
  render(<CustomersPage service={service} orderService={orderService} />)

  expect(screen.getByText('Đang tải khách hàng...').closest('.management-list-surface')).not.toBeNull()
  expect(await screen.findByText('KH000123')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Khách hàng' }).closest('.management-page-header')).not.toBeNull()
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc khách hàng' })
  expect(sidebar).toHaveClass('management-filter-sidebar')
  expect(within(sidebar).queryByRole('heading', { name: 'Bộ lọc' })).not.toBeInTheDocument()
  expect(sidebar.querySelector('.management-filter-summary')).toBeNull()
  expect(within(sidebar).queryByRole('button', { name: 'Đặt lại bộ lọc' })).not.toBeInTheDocument()
  const summary = screen.getByRole('region', { name: 'Tổng quan khách hàng' })
  expect(summary.closest('.management-filter-column')).not.toBeNull()
  expect(within(summary).queryByText('Tổng KH')).not.toBeInTheDocument()
  expect(within(summary).getByText('Công nợ')).toBeInTheDocument()
  expect(within(summary).getByText('Tổng bán')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Danh sách khách hàng' })).toHaveClass('management-list-surface')

  const grid = screen.getByRole('table', { name: 'Danh sách khách hàng' })
  expect(grid).toHaveClass('management-table')
  expect(
    within(grid).getByRole('row', {
      name: 'Chọn tất cả dòng khách hàng Mã KH Tên khách hàng Điện thoại Nhóm khách Công nợ Tổng bán',
    }),
  ).toBeInTheDocument()
  expect(within(grid).getByRole('checkbox', { name: 'Chọn tất cả dòng khách hàng' }).parentElement).toHaveClass('finance-cashbook-checkbox-control')
  expect(within(grid).getByRole('checkbox', { name: 'Chọn dòng KH000123' }).parentElement).toHaveClass('finance-cashbook-checkbox-control')
  expect(within(grid).queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument()
  expect(within(grid).getByText('Công ty Phong Cảnh')).toBeInTheDocument()
  expect(within(grid).getByText('0909 000 000')).toBeInTheDocument()
  expect(within(grid).getByText('Khách VIP')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Lọc' })).not.toBeInTheDocument()
  expect(grid).toHaveTextContent('250 000')
  expect(grid).toHaveTextContent('750 000')
  expect(summary).toHaveTextContent('250 000')
  expect(summary).toHaveTextContent('750 000')
  expect(orderService.getCustomerDebt).not.toHaveBeenCalled()

  const footer = screen.getByRole('navigation', { name: 'Phân trang khách hàng' })
  expect(footer).toHaveClass('management-table-footer')
  expect(footer).toContainElement(screen.getByText('1 - 1 trong 1 khách hàng'))
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('1')
  expect(within(footer).getByRole('button', { name: 'Trang trước' })).toBeDisabled()
  expect(within(footer).getByRole('button', { name: 'Trang sau' })).toBeDisabled()
  expect(footer.closest('.management-table-viewport')).toBeNull()
})

it('leaves missing customer list values blank instead of showing hyphen placeholders', async () => {
  const service = makeService({
    listCustomers: vi.fn(async () => ({
      items: [
        {
          id: 'customer-empty',
          code: 'KHEMPTY',
          name: 'Missing fields',
          phone: null,
          tax_code: null,
          address: null,
          customer_group_id: null,
          customer_group: null,
          customer_type: 'individual',
          created_by: null,
          created_at: '2026-07-01T00:00:00Z',
          note: null,
          status: 'active',
          total_sales_amount: undefined,
          total_debt_amount: undefined,
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })

  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  const row = await screen.findByRole('row', { name: /KHEMPTY Missing fields/ })
  const cells = Array.from(row.querySelectorAll('td'))

  expect(cells[3]).toHaveTextContent('')
  expect(cells[4]).toHaveTextContent('')
  expect(cells[5]).toHaveTextContent('')
  expect(cells[6]).toHaveTextContent('')
  expect(row).not.toHaveTextContent('-')
})

it('treats legacy seed customer groups as no group in customer management', async () => {
  const service = makeService({
    listCustomers: vi.fn(async () => ({
      items: [
        {
          id: 'customer-seed-group',
          code: 'KH000523',
          name: 'Minh Võ (May)',
          phone: null,
          tax_code: null,
          address: null,
          customer_group_id: 'cg-retail',
          customer_group: { id: 'cg-retail', code: 'LE', name: 'cg-retail' },
          customer_type: 'individual',
          created_by: { id: 'user-admin', name: 'Admin' },
          created_at: '2026-07-20T03:00:00Z',
          note: null,
          status: 'active',
          total_sales_amount: 700000,
          total_debt_amount: 0,
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    listCustomerGroups: vi.fn(async () => ({
      items: [
        { id: 'cg-retail', code: 'LE', name: 'cg-retail', price_list_id: 'pl-default', is_active: true },
        { id: 'cg-vip', code: 'SI', name: 'Khach si', price_list_id: 'pl-vip', is_active: true },
        { id: 'cg-25', code: '25', name: '25', price_list_id: 'pl-25', is_active: true },
      ],
    })),
  })

  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  const row = await screen.findByRole('row', { name: /KH000523 Minh Võ \(May\)/ })
  const cells = Array.from(row.querySelectorAll('td'))
  expect(cells[4]).toHaveTextContent('')
  expect(screen.getByRole('option', { name: '25' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'cg-retail' })).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Khach si' })).not.toBeInTheDocument()

  await userEvent.click(within(row).getByRole('button', { name: 'KH000523' }))
  const detail = screen.getByRole('region', { name: 'Chi tiết khách hàng KH000523' })
  expect(detail).not.toHaveTextContent('cg-retail')
  expect(detail).not.toHaveTextContent('Khach si')
})

it('does not open customer detail when clicking the row checkbox', async () => {
  render(<CustomersPage service={makeService()} orderService={makeOrderService()} />)

  await userEvent.click(await screen.findByRole('checkbox', { name: 'Chọn dòng KH000123' }))

  expect(screen.queryByRole('region', { name: 'Chi tiết khách hàng KH000123' })).not.toBeInTheDocument()
})

it('uses the shared pagination footer to move between customer pages', async () => {
  const service = makeService({
    listCustomers: vi.fn(async (input = {}) => ({
      items: [
        {
          id: `customer-page-${input.page ?? 1}`,
          code: input.page === 2 ? 'KH000222' : 'KH000111',
          name: input.page === 2 ? 'Khách trang 2' : 'Khách trang 1',
          phone: null,
          tax_code: null,
          address: null,
          customer_group_id: null,
          customer_group: null,
          created_by: null,
          created_at: '2026-07-01T03:00:00Z',
        },
      ],
      page: input.page ?? 1,
      page_size: input.page_size ?? 15,
      total: 45,
    })),
  })
  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  expect(await screen.findByText('KH000111')).toBeInTheDocument()
  const footer = screen.getByRole('navigation', { name: 'Phân trang khách hàng' })
  expect(footer).toHaveClass('management-table-footer')
  expect(footer).toContainElement(screen.getByText('1 - 15 trong 45 khách hàng'))
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('1')

  await userEvent.click(within(footer).getByRole('button', { name: 'Trang sau' }))

  expect(await screen.findByText('KH000222')).toBeInTheDocument()
  expect(footer).toContainElement(screen.getByText('16 - 30 trong 45 khách hàng'))
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('2')
  expect(service.listCustomers).toHaveBeenLastCalledWith({ page: 2, page_size: 15, search: undefined, status: 'active' })
})

it('requests customer sorting from the API so sorting applies before pagination', async () => {
  const highDebtCustomer = {
    id: 'customer-high-debt',
    code: 'KH-HIGH',
    name: 'Khách nợ cao',
    phone: null,
    tax_code: null,
    address: null,
    customer_group_id: null,
    customer_group: null,
    created_by: { id: 'user-admin', name: 'Admin' },
    created_at: '2026-07-01T00:00:00Z',
    total_sales_amount: 1000000,
    total_debt_amount: 900000,
  }
  const lowDebtCustomer = {
    id: 'customer-low-debt',
    code: 'KH-LOW',
    name: 'Khách nợ thấp',
    phone: null,
    tax_code: null,
    address: null,
    customer_group_id: null,
    customer_group: null,
    created_by: { id: 'user-admin', name: 'Admin' },
    created_at: '2026-07-02T00:00:00Z',
    total_sales_amount: 2000000,
    total_debt_amount: 10000,
  }
  const service = makeService({
    listCustomers: vi.fn(async (input = {}) => ({
      items: input.sort_key === 'total_debt_amount' ? [highDebtCustomer] : [lowDebtCustomer],
      page: 1,
      page_size: input.page_size ?? 15,
      total: 2,
    })),
  })
  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  await screen.findByText('KH-LOW')
  await userEvent.click(within(screen.getByRole('columnheader', { name: 'Công nợ' })).getByRole('button', { name: 'Công nợ' }))

  await waitFor(() => expect(service.listCustomers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'active',
    sort_key: 'total_debt_amount',
    sort_direction: 'desc',
  }))
  expect(await screen.findByText('KH-HIGH')).toBeInTheDocument()
})

it('uses the shared management filter hide and show controls', async () => {
  render(<CustomersPage service={makeService()} orderService={makeOrderService()} />)

  await screen.findByText('KH000123')
  expect(screen.getByRole('complementary', { name: 'Bộ lọc khách hàng' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Ẩn bộ lọc khách hàng' }))

  expect(screen.queryByRole('complementary', { name: 'Bộ lọc khách hàng' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Khách hàng')).toHaveClass('management-layout-filters-hidden')

  await userEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc khách hàng' }))
  expect(screen.getByRole('complementary', { name: 'Bộ lọc khách hàng' })).toBeInTheDocument()
})

it('searches and creates a customer from the search action', async () => {
  const service = makeService()
  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  await screen.findByText('KH000123')
  const searchForm = screen.getByRole('search', { name: 'Lọc khách hàng' })
  expect(searchForm.closest('.management-page-header')).not.toBeNull()
  expect(within(searchForm).getByLabelText('Tìm khách hàng').closest('.management-compact-search')).not.toBeNull()
  await userEvent.type(within(searchForm).getByLabelText('Tìm khách hàng'), 'Phong')
  expect(service.listCustomers).not.toHaveBeenCalledWith(expect.objectContaining({ search: 'Phong' }))
  await userEvent.type(within(searchForm).getByLabelText('Tìm khách hàng'), '{Enter}')
  await waitFor(() => expect(service.listCustomers).toHaveBeenCalledWith({ page: 1, page_size: 15, search: 'Phong', status: 'active' }))
  expect(screen.queryByText('Tìm: Phong')).not.toBeInTheDocument()

  expect(screen.queryByRole('dialog', { name: 'Tạo khách hàng' })).not.toBeInTheDocument()
  await userEvent.click(within(searchForm).getByRole('button', { name: 'Xóa tìm kiếm' }))
  await waitFor(() => expect(service.listCustomers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'active',
  }))
  await userEvent.click(within(searchForm).getByRole('button', { name: /T.o kh.ch h.ng/i }))
  const dialog = screen.getByRole('dialog', { name: 'Tạo khách hàng' })
  expect(dialog).toHaveClass('management-modal-dialog')
  expect(dialog.closest('.management-modal-backdrop')).not.toBeNull()
  const createForm = within(dialog).getByRole('form', { name: 'Tạo khách hàng' })
  expect(within(createForm).getByLabelText('Tên khách hàng')).toHaveFocus()
  const codeInput = within(createForm).getByLabelText('Mã khách hàng')
  expect(codeInput).not.toBeDisabled()
  await userEvent.type(codeInput, 'KHMANUAL01')
  await userEvent.type(within(createForm).getByLabelText('Tên khách hàng'), 'Nguyễn Văn A')
  await userEvent.type(within(createForm).getByLabelText('Điện thoại'), '0911000000')
  await userEvent.type(within(createForm).getByLabelText('MST'), '0311111111')
  await userEvent.click(within(createForm).getByRole('radio', { name: 'Tổ chức' }))
  await userEvent.type(within(createForm).getByLabelText('Công ty'), 'Công ty ABC')
  await userEvent.selectOptions(within(createForm).getByLabelText('Nhóm khách hàng'), 'cg-1')
  await userEvent.type(within(createForm).getByLabelText('Ghi chú'), 'Khách mới')
  await userEvent.type(within(createForm).getByLabelText('Địa chỉ'), '99 Lê Lợi')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))

  expect(service.createCustomer).toHaveBeenCalledWith({
    code: 'KHMANUAL01',
    name: 'Nguyễn Văn A',
    phone: '0911000000',
    tax_code: '0311111111',
    address: '99 Lê Lợi',
    note: 'Khách mới',
    customer_group_id: 'cg-1',
    customer_type: 'company',
    company_name: 'Công ty ABC',
  })
  expect(service.listCustomers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'active',
  })
})

it('opens KiotViet customer import from the customer toolbar', async () => {
  const service = makeService()
  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  await screen.findByText('KH000123')
  await userEvent.click(screen.getByRole('button', { name: 'Import' }))

  expect(screen.getByRole('dialog', { name: 'Import khách hàng KiotViet' })).toBeInTheDocument()
  expect(screen.getByLabelText('File KiotViet')).toBeInTheDocument()
})

it.each([
  ['mã', 'KH000888'],
  ['tên', 'Anh Nam'],
  ['số điện thoại', '0908123456'],
])('filters customers by %s after Enter without opening a suggestion dropdown', async (_label, keyword) => {
  const suggestedCustomer = {
    id: 'customer-suggested',
    code: 'KH000888',
    name: 'Anh Nam',
    phone: '0908123456',
    tax_code: null,
    address: null,
    customer_group_id: null,
    customer_group: null,
    created_by: { id: 'user-admin', name: 'Admin' },
    created_at: '2026-07-08T08:00:00Z',
    total_sales_amount: 320000,
    total_debt_amount: 125000,
  }
  const service = makeService({
    listCustomers: vi.fn(async (input = {}) => {
      if (input.search === keyword) {
        return { items: [suggestedCustomer], page: 1, page_size: 15, total: 1 }
      }
      return { items: [suggestedCustomer], page: 1, page_size: 15, total: 1 }
    }),
  })

  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  await screen.findByText('KH000888')
  const searchForm = screen.getByRole('search', { name: 'Lọc khách hàng' })
  const searchInput = within(searchForm).getByLabelText('Tìm khách hàng')
  await userEvent.type(searchInput, keyword)
  expect(service.listCustomers).not.toHaveBeenCalledWith(expect.objectContaining({ search: keyword }))
  await userEvent.type(searchInput, '{Enter}')

  await waitFor(() => expect(service.listCustomers).toHaveBeenCalledWith(expect.objectContaining({
    page: 1,
    page_size: 15,
    search: keyword,
  })))

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(screen.getByText('KH000888')).toBeInTheDocument()
})

it('reactively filters customers by existing customer fields in the shared sidebar', async () => {
  const service = makeService()
  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  await screen.findByText('KH000123')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc khách hàng' })

  expect(within(sidebar).getByRole('region', { name: 'Nhóm khách' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Ngày tạo' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Người tạo' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Tổng bán' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Công nợ' })).toBeInTheDocument()
  expect(within(sidebar).queryByRole('region', { name: 'Giới tính' })).not.toBeInTheDocument()
  expect(within(sidebar).queryByRole('region', { name: 'Sinh nhật' })).not.toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: /Tr\u1ea1ng th\u00e1i/ })).toBeInTheDocument()

  await userEvent.selectOptions(within(sidebar).getByRole('combobox', { name: 'Nhóm khách' }), 'cg-1')
  expect(service.listCustomers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    customer_group_id: 'cg-1',
    status: 'active',
  })

  await userEvent.clear(within(sidebar).getByLabelText('Từ ngày'))
  await userEvent.type(within(sidebar).getByLabelText('Từ ngày'), '01/07/2026')
  await userEvent.type(within(sidebar).getByLabelText('Tổng bán từ'), '500000')
  await userEvent.type(within(sidebar).getByLabelText('Công nợ tới'), '300000')
  await userEvent.selectOptions(within(sidebar).getByRole('combobox', { name: 'Người tạo' }), 'user-admin')

  expect(service.listCustomers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    customer_group_id: 'cg-1',
    created_from: '2026-07-01',
    created_by: 'user-admin',
    total_sales_min: 500000,
    total_debt_max: 300000,
    status: 'active',
  })
})

it('filters customers by status from the shared sidebar', async () => {
  const service = makeService()
  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  await screen.findByText('KH000123')

  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc khách hàng' })
  const statusGroup = within(sidebar).getByRole('region', { name: 'Trạng thái' })
  expect(within(statusGroup).queryByRole('combobox', { name: 'Trạng thái' })).not.toBeInTheDocument()
  expect(within(statusGroup).getByRole('radio', { name: 'Đang hoạt động' })).toBeChecked()
  expect(service.listCustomers).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))

  await userEvent.click(within(statusGroup).getByRole('radio', { name: 'Ngừng hoạt động' }))

  await waitFor(() => expect(service.listCustomers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'inactive',
  }))
})

it('shows customer create errors inside the modal', async () => {
  const service = makeService({
    createCustomer: vi.fn(async () => {
      throw new Error('Mã khách hàng đã tồn tại')
    }),
  })
  render(<CustomersPage service={service} orderService={makeOrderService()} />)

  await screen.findByText('KH000123')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo khách hàng' }))
  const dialog = screen.getByRole('dialog', { name: 'Tạo khách hàng' })
  await userEvent.type(within(dialog).getByLabelText('Tên khách hàng'), 'Khách bị lỗi')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Không lưu được khách hàng.')
})

it('expands customer details directly under the selected row and closes on second click', async () => {
  const service = makeService()
  const orderService = makeOrderService()
  const salesDocumentService = makeSalesDocumentService()
  const financeService = makeFinanceService()
  render(<CustomersPage service={service} orderService={orderService} salesDocumentService={salesDocumentService} financeService={financeService} />)

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: 'Chi tiết khách hàng KH000123' })
  const customerRow = detail.closest('tr')?.previousElementSibling
  expect(customerRow).toHaveTextContent('KH000123')
  expect(customerRow).toHaveClass('management-data-row-selected')
  expect(detail.closest('tr')).toHaveClass('management-detail-row-selected')
  expect(detail).toHaveClass('management-inline-detail')
  expect(detail).not.toHaveClass('customer-inline-detail')
  expect(detail.querySelector('.management-detail-panel')).not.toBeNull()
  expect(detail.querySelector('.customer-detail-summary')).toBeNull()
  const detailSummary = within(detail).getByRole('group', { name: 'Tóm tắt khách hàng KH000123' })
  expect(detailSummary).toHaveClass('management-detail-summary')
  expect(within(detailSummary).getByRole('heading', { name: 'Công ty Phong Cảnh' })).toBeInTheDocument()
  expect(within(detailSummary).getByText('KH000123')).toBeInTheDocument()
  const metaLabels = Array.from(detailSummary.querySelectorAll('.management-detail-meta-label')).map((element) => element.textContent)
  const metaValues = Array.from(detailSummary.querySelectorAll('.management-detail-meta-value')).map((element) => element.textContent)
  expect(metaLabels).toEqual(['Người tạo:', 'Ngày tạo:', 'Nhóm khách:'])
  expect(metaValues).toEqual(['Admin', '30/06/2026', 'Khách VIP'])
  expect(within(detailSummary).getByText('Người tạo:').parentElement).toHaveTextContent('Người tạo: Admin')
  expect(within(detailSummary).getByText('Ngày tạo:').parentElement).toHaveTextContent('Ngày tạo: 30/06/2026')
  expect(within(detailSummary).getByText('Nhóm khách:').parentElement).toHaveTextContent('Nhóm khách: Khách VIP')
  const infoPanel = within(detail).getByRole('tabpanel', { name: 'Thông tin khách hàng' })
  expect(infoPanel).toHaveClass('management-detail-section')
  expect(infoPanel.querySelector('dl')).toHaveClass('management-detail-meta-grid', 'management-detail-meta-grid-four')
  expect(within(infoPanel).queryByText('KH000123')).not.toBeInTheDocument()
  expect(within(infoPanel).queryByText('Công ty Phong Cảnh')).not.toBeInTheDocument()
  expect(within(infoPanel).getByText('0909 000 000')).toBeInTheDocument()
  expect(within(infoPanel).getByText('0312345678')).toBeInTheDocument()
  expect(within(infoPanel).getByText('12 Nguyễn Trãi, Quận 1')).toBeInTheDocument()
  expect(within(infoPanel).queryByText('Nhóm khách')).not.toBeInTheDocument()
  expect(within(infoPanel).queryByText('Khách VIP')).not.toBeInTheDocument()
  expect(within(infoPanel).queryByText('Bảng giá áp dụng')).not.toBeInTheDocument()
  expect(within(infoPanel).queryByText('Theo nhóm: Khách VIP')).not.toBeInTheDocument()
  expect(within(infoPanel).getByText('Loại khách')).toBeInTheDocument()
  expect(within(infoPanel).getByText('Công ty')).toBeInTheDocument()
  expect(within(infoPanel).queryByText('Người tạo')).not.toBeInTheDocument()
  expect(within(infoPanel).queryByText('Ngày tạo')).not.toBeInTheDocument()
  expect(within(infoPanel).getByText('Ghi chú khách KV')).toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Xóa' })).toBeDisabled()
  expect(within(detail).getByRole('button', { name: 'Chỉnh sửa' })).toBeDisabled()
  expect(within(detail).getByRole('button', { name: 'Ngừng hoạt động' })).toBeDisabled()
  expect(within(infoPanel).queryByRole('button', { name: 'Xem phân tích' })).not.toBeInTheDocument()
  expect(within(infoPanel).queryByRole('region', { name: 'Xem phân tích khách hàng' })).not.toBeInTheDocument()
  await userEvent.click(within(detail).getByRole('button', { name: 'Xem phân tích' }))
  const analysis = screen.getByRole('dialog', { name: 'Phân tích khách hàng KH000123' })
  expect(within(analysis).getByLabelText('Khoảng thời gian')).toHaveValue('all')
  expect(within(analysis).getByText('Doanh thu')).toBeInTheDocument()
  expect(within(analysis).getByText('Số chứng từ')).toBeInTheDocument()
  expect(within(analysis).getByText('Tần suất')).toBeInTheDocument()
  expect(within(analysis).getAllByText('-')).toHaveLength(3)
  expect(within(analysis).queryByText('Chưa có dữ liệu phân tích. Sau này nối báo cáo mua hàng, công nợ và tần suất giao dịch theo khách.')).not.toBeInTheDocument()
  await userEvent.click(within(analysis).getByRole('button', { name: 'Đóng phân tích khách hàng' }))
  expect(screen.queryByRole('dialog', { name: 'Phân tích khách hàng KH000123' })).not.toBeInTheDocument()
  expect(within(infoPanel).queryByText('Đang hoạt động')).not.toBeInTheDocument()
  const detailTablist = within(detail).getByRole('tablist', { name: 'Chi tiết khách hàng' })
  const analysisButton = within(detail).getByRole('button', { name: 'Xem phân tích' })
  expect(analysisButton).toHaveClass('management-icon-button')
  expect(detailTablist).toBeInTheDocument()
  expect(analysisButton.closest('.inline-detail-tabbar')).toBe(detailTablist.closest('.inline-detail-tabbar'))
  expect(within(detailTablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Thông tin', 'Lịch sử', 'Công nợ'])
  expect(within(detail).getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
  expect(within(detail).getByRole('tab', { name: 'Công nợ' })).toHaveAttribute('aria-selected', 'false')
  expect(within(detail).getByRole('tab', { name: 'Lịch sử' })).toHaveAttribute('aria-selected', 'false')
  expect(within(detail).getByRole('button', { name: 'Chỉnh sửa' })).toBeDisabled()
  await userEvent.click(within(detail).getByRole('tab', { name: 'Công nợ' }))
  expect(within(detail).getByRole('tab', { name: 'Công nợ' })).toHaveAttribute('aria-selected', 'true')
  expect(within(detail).queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument()
  expect(within(detail).queryByRole('button', { name: 'Ngừng hoạt động' })).not.toBeInTheDocument()
  expect(within(detail).queryByRole('button', { name: 'Tạo QR' })).not.toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Xuất file công nợ' })).toBeDisabled()
  expect(within(detail).getByRole('button', { name: 'Xuất file' })).toBeDisabled()
  expect(within(detail).getByRole('button', { name: 'Thanh toán' })).toBeEnabled()
  expect(within(detail).getByRole('button', { name: 'Điều chỉnh' })).toBeEnabled()
  expect(within(detail).getByRole('button', { name: 'Chiết khấu thanh toán' })).toBeDisabled()
  await userEvent.click(within(detail).getByRole('button', { name: 'Điều chỉnh' }))
  const adjustmentDialog = screen.getByRole('dialog', { name: 'Điều chỉnh công nợ KH000123' })
  expect(within(adjustmentDialog).getByText('Nợ cần thu hiện tại')).toBeInTheDocument()
  expect(within(adjustmentDialog).getByLabelText('Ngày điều chỉnh')).toHaveValue('')
  expect(within(adjustmentDialog).getByLabelText('Giá trị nợ điều chỉnh')).toHaveValue('')
  expect(within(adjustmentDialog).getByLabelText('Mô tả')).toHaveValue('')
  await userEvent.click(within(adjustmentDialog).getByRole('button', { name: 'Chọn ngày điều chỉnh' }))
  expect(within(adjustmentDialog).getByRole('region', { name: 'Lịch chọn ngày điều chỉnh' })).toBeInTheDocument()
  await userEvent.click(within(adjustmentDialog).getByRole('button', { name: 'Chọn giờ điều chỉnh' }))
  expect(within(adjustmentDialog).getByRole('region', { name: 'Chọn giờ điều chỉnh' })).toBeInTheDocument()
  await userEvent.click(within(adjustmentDialog).getByRole('button', { name: 'Bỏ qua' }))
  expect(screen.queryByRole('dialog', { name: 'Điều chỉnh công nợ KH000123' })).not.toBeInTheDocument()
  await waitFor(() => expect(detail).toHaveTextContent('250 000'))
  expect(detail).toHaveTextContent('250 000')
  expect(within(detail).queryByText('Hóa đơn mở')).not.toBeInTheDocument()
  expect(within(detail).queryByText('Lịch sử công nợ')).not.toBeInTheDocument()
  expect(salesDocumentService.listSalesDocuments).toHaveBeenCalledWith({ customer_id: 'customer-1', type: 'invoice', status: 'completed', page: 1, page_size: 10 })
  expect(salesDocumentService.listSalesDocuments).not.toHaveBeenCalledWith(expect.objectContaining({ page_size: 1000 }))
  expect(financeService.listCashbookEntries).not.toHaveBeenCalled()
  expect(within(detail).getByRole('button', { name: 'Tóm tắt' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(detail).getByRole('button', { name: 'Chi tiết' })).toHaveAttribute('aria-pressed', 'false')
  const debtSummaryTable = within(detail).getByRole('table', { name: 'Tóm tắt công nợ' })
  expect(within(debtSummaryTable).getByText('HD010985')).toBeInTheDocument()
  expect(within(debtSummaryTable).getByText('HD010986')).toBeInTheDocument()
  expect(within(debtSummaryTable).queryByText('HD010987')).not.toBeInTheDocument()
  expect(within(debtSummaryTable).queryByText('TT000001')).not.toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Mã hóa đơn' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Thời gian' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Còn nợ' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Công nợ' })).toBeInTheDocument()
  expect(within(detail).queryByRole('columnheader', { name: 'Tổng cộng' })).not.toBeInTheDocument()
  expect(within(detail).queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument()
  expect(within(debtSummaryTable).getByRole('row', { name: /HD010985/ }).querySelectorAll('td')[2]).toHaveTextContent('150 000')
  expect(within(debtSummaryTable).getByRole('row', { name: /HD010985/ }).querySelectorAll('td')[3]).toHaveTextContent('250 000')
  expect(within(debtSummaryTable).getByRole('row', { name: /HD010986/ }).querySelectorAll('td')[2]).toHaveTextContent('100 000')
  expect(within(debtSummaryTable).getByRole('row', { name: /HD010986/ }).querySelectorAll('td')[3]).toHaveTextContent('100 000')
  expect(within(debtSummaryTable).queryByText('Tổng')).not.toBeInTheDocument()
  expect(within(detail).getByRole('navigation', { name: 'Phân trang tóm tắt công nợ' })).toHaveTextContent('1 - 2 trong 2 hóa đơn mở')

  await userEvent.click(within(detail).getByRole('button', { name: 'Thanh toán' }))
  const paymentDialog = screen.getByRole('dialog', { name: 'Thanh toán công nợ KH000123' })
  expect(within(paymentDialog).getByText(/Người thu: Admin/)).toBeInTheDocument()
  expect(within(paymentDialog).getByLabelText('Phương thức TT')).toHaveValue('cash')
  expect(within(paymentDialog).getByRole('table', { name: 'Danh sách phân bổ hóa đơn công nợ' })).toBeInTheDocument()
  expect(within(paymentDialog).getByLabelText('Số tiền')).toHaveValue('')
  expect(within(paymentDialog).getByLabelText('Tiền thu HD010985')).toHaveValue('')
  expect(within(paymentDialog).getByLabelText('Tiền thu HD010986')).toHaveValue('')
  expect(within(paymentDialog).getByRole('button', { name: 'Tạo phiếu thu' })).toBeDisabled()
  await userEvent.type(within(paymentDialog).getByLabelText('Tiền thu HD010986'), '90000')
  expect(within(paymentDialog).getByLabelText('Số tiền')).toHaveValue('90 000')
  expect(within(paymentDialog).getByLabelText('Tiền thu HD010986')).toHaveValue('90 000')
  expect(within(paymentDialog).getByRole('button', { name: 'Tạo phiếu thu' })).toBeEnabled()
  await userEvent.clear(within(paymentDialog).getByLabelText('Số tiền'))
  await userEvent.type(within(paymentDialog).getByLabelText('Số tiền'), '120000')
  expect(within(paymentDialog).getByLabelText('Tiền thu HD010985')).toHaveValue('20 000')
  expect(within(paymentDialog).getByLabelText('Tiền thu HD010986')).toHaveValue('100 000')
  await userEvent.clear(within(paymentDialog).getByLabelText('Số tiền'))
  await userEvent.type(within(paymentDialog).getByLabelText('Số tiền'), '250000')
  expect(within(paymentDialog).getByLabelText('Tiền thu HD010985')).toHaveValue('150 000')
  expect(within(paymentDialog).getByLabelText('Tiền thu HD010986')).toHaveValue('100 000')
  await userEvent.clear(within(paymentDialog).getByLabelText('Tiền thu HD010985'))
  await userEvent.type(within(paymentDialog).getByLabelText('Tiền thu HD010985'), '150000')
  expect(within(paymentDialog).getByLabelText('Số tiền')).toHaveValue('250 000')
  expect(within(paymentDialog).getByText('Tiền chưa phân bổ:')).toBeInTheDocument()
  expect(within(paymentDialog.querySelector('.customer-debt-payment-unallocated') as HTMLElement).getByText('100 000')).toBeInTheDocument()
  await userEvent.click(within(paymentDialog).getByRole('button', { name: 'Bỏ qua' }))
  expect(screen.queryByRole('dialog', { name: 'Thanh toán công nợ KH000123' })).not.toBeInTheDocument()

  await userEvent.click(within(detail).getByRole('button', { name: 'Chi tiết' }))
  expect(within(detail).getByRole('button', { name: 'Tóm tắt' })).toHaveAttribute('aria-pressed', 'false')
  expect(within(detail).getByRole('button', { name: 'Chi tiết' })).toHaveAttribute('aria-pressed', 'true')
  expect(await within(detail).findByText('HD010987')).toBeInTheDocument()
  expect(await within(detail).findByText('TT000001')).toBeInTheDocument()
  const debtHistoryTable = within(detail).getByRole('table', { name: 'Lịch sử công nợ' })
  expect(debtHistoryTable).toHaveClass('management-detail-table', 'management-detail-linked-table')
  expect(within(detail).getByRole('columnheader', { name: 'Mã phiếu' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Thời gian' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Loại' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Giá trị' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Công nợ' })).toBeInTheDocument()
  expect(within(debtHistoryTable).getByText('HD010985')).toBeInTheDocument()
  expect(within(debtHistoryTable).getByText('HD010986')).toBeInTheDocument()
  expect(within(debtHistoryTable).getByText('HD010987')).toBeInTheDocument()
  expect(within(debtHistoryTable).queryByText('HD-CANCELLED')).not.toBeInTheDocument()
  expect(within(debtHistoryTable).getByText('Thanh toán')).toBeInTheDocument()
  expect(within(debtHistoryTable).getByText('-190 000')).toBeInTheDocument()
  expect(within(debtHistoryTable).getAllByText('Bán hàng').length).toBeGreaterThan(0)
  expect(within(detail).getByRole('navigation', { name: 'Phân trang công nợ' })).toHaveTextContent('1 - 4 trong 4 dòng công nợ')
  expect(orderService.getCustomerDebt).toHaveBeenCalledWith('customer-1')
  expect(customerRow).toHaveTextContent('250 000')

  await userEvent.click(within(detail).getByRole('tab', { name: 'Lịch sử' }))
  expect(salesDocumentService.listSalesDocuments).toHaveBeenCalledWith({ customer_id: 'customer-1', type: 'invoice', status: 'completed', page: 1, page_size: 10 })
  expect(await within(detail).findByText('HD010985')).toBeInTheDocument()
  expect(within(detail).getByText('HD010986')).toBeInTheDocument()
  expect(within(detail).getByText('HD010987')).toBeInTheDocument()
  expect(within(detail).queryByText('BG000245')).not.toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Hóa đơn' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(detail).getByRole('button', { name: 'Báo giá' })).toHaveAttribute('aria-pressed', 'false')
  expect(within(detail).getByRole('columnheader', { name: 'Mã hóa đơn' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Thời gian' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Người bán' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Tổng cộng' })).toBeInTheDocument()
  expect(within(detail).getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument()
  expect(within(detail).queryByRole('columnheader', { name: 'Loại' })).not.toBeInTheDocument()
  expect(within(detail).queryByRole('columnheader', { name: 'Công nợ' })).not.toBeInTheDocument()
  expect(within(detail).queryByText('1 chứng từ gần đây')).not.toBeInTheDocument()
  expect(within(detail).getAllByText('Admin')).toHaveLength(4)
  expect(detail).toHaveTextContent('150 000')
  expect(within(detail).getByText('Nợ')).toBeInTheDocument()
  expect(within(detail).getByText('Nợ 1 phần')).toBeInTheDocument()
  expect(within(detail).getByText('Hoàn tất')).toBeInTheDocument()
  const historyTable = within(detail).getByRole('table', { name: 'Lịch sử chứng từ khách hàng' })
  expect(within(within(historyTable).getByRole('row', { name: /HD010985/ })).getByText('Nợ')).toBeInTheDocument()
  expect(historyTable).toHaveClass('customer-history-table')
  expect(within(historyTable).queryByText('Hóa đơn')).not.toBeInTheDocument()

  await userEvent.click(within(detail).getByRole('button', { name: 'Báo giá' }))
  expect(salesDocumentService.listSalesDocuments).toHaveBeenCalledWith({ customer_id: 'customer-1', type: 'quote', status: 'active', page: 1, page_size: 10 })
  expect(await within(detail).findByText('BG000245')).toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Hóa đơn' })).toHaveAttribute('aria-pressed', 'false')
  expect(within(detail).getByRole('button', { name: 'Báo giá' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(detail).getByRole('columnheader', { name: 'Mã báo giá' })).toBeInTheDocument()
  expect(within(detail).getByText('Đang hiệu lực')).toBeInTheDocument()
  expect(within(detail).queryByText('HD010985')).not.toBeInTheDocument()

  await userEvent.click(customerRow as HTMLElement)
  expect(screen.queryByRole('region', { name: 'Chi tiết khách hàng KH000123' })).not.toBeInTheDocument()
})

it('paginates customer sales history from the API', async () => {
  const listSalesDocuments = vi.fn(async (input: Parameters<SalesDocumentService['listSalesDocuments']>[0] = {}) => {
    const page = input.page ?? 1
    return {
      items: [
        {
          id: `history-order-${page}`,
          code: page === 2 ? 'HD-PAGE-2' : 'HD-PAGE-1',
          order_type: 'invoice' as const,
          status: 'completed' as const,
          created_at: page === 2 ? '2026-07-02T09:00:00Z' : '2026-07-01T09:00:00Z',
          customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: '0909000000' },
          seller: { id: 'seller-1', name: 'Admin' },
          subtotal_amount: 100000,
          discount_amount: 0,
          total_amount: page === 2 ? 200000 : 100000,
          paid_amount: 0,
          debt_amount: page === 2 ? 200000 : 100000,
          payment_status: 'unpaid' as const,
          note: null,
        },
      ],
      page,
      page_size: input.page_size ?? 10,
      total: 16,
    }
  })
  const salesDocumentService = makeSalesDocumentService({ listSalesDocuments })
  render(<CustomersPage service={makeService()} orderService={makeOrderService()} salesDocumentService={salesDocumentService} />)

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: /KH000123/ })

  await userEvent.click(within(detail).getByRole('tab', { name: 'Lịch sử' }))
  expect(await within(detail).findByText('HD-PAGE-1')).toBeInTheDocument()
  let historyPager = within(detail).getByRole('navigation', { name: 'Phân trang lịch sử hóa đơn' })
  expect(historyPager).toHaveTextContent('1 - 10 trong 16 hóa đơn')

  await userEvent.click(within(historyPager).getByRole('button', { name: 'Trang sau' }))
  await waitFor(() => expect(listSalesDocuments).toHaveBeenCalledWith({ customer_id: 'customer-1', type: 'invoice', status: 'completed', page: 2, page_size: 10 }))
  expect(await within(detail).findByText('HD-PAGE-2')).toBeInTheDocument()
  expect(within(detail).queryByText('HD-PAGE-1')).not.toBeInTheDocument()
  historyPager = within(detail).getByRole('navigation', { name: 'Phân trang lịch sử hóa đơn' })
  expect(historyPager).toHaveTextContent('11 - 16 trong 16 hóa đơn')
})

it('does not repeat customer group or price list in customer detail', async () => {
  const service = makeService({
    listCustomers: vi.fn(async () => ({
      items: [
        {
          id: 'customer-2',
          code: 'KH000124',
          name: 'Khách lẻ',
          phone: null,
          tax_code: null,
          address: null,
          customer_group_id: null,
          customer_group: null,
          created_by: null,
          created_at: '2026-07-01T03:00:00Z',
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })
  render(<CustomersPage service={service} orderService={makeOrderService({ getCustomerDebt: vi.fn(async () => ({ customer_id: 'customer-2', total_debt: 0, invoices: [] })) })} />)

  await userEvent.click(await screen.findByText('KH000124'))
  const detail = screen.getByRole('region', { name: 'Chi tiết khách hàng KH000124' })
  const detailSummary = within(detail).getByRole('group', { name: 'Tóm tắt khách hàng KH000124' })
  expect(within(detailSummary).getByText('Nhóm khách:').parentElement).toHaveTextContent('Nhóm khách:')
  const infoPanel = within(detail).getByRole('tabpanel', { name: 'Thông tin khách hàng' })
  expect(within(infoPanel).queryByText('Bảng giá chung')).not.toBeInTheDocument()
  expect(within(infoPanel).queryByText('Bảng giá áp dụng')).not.toBeInTheDocument()
  expect(within(infoPanel).queryByText('Nhóm khách')).not.toBeInTheDocument()
})

it('shows linked supplier card in customer detail', async () => {
  const service = makeService({
    listCustomers: vi.fn(async () => ({
      items: [
        {
          id: 'customer-linked',
          code: 'UT',
          name: 'Út Tèo',
          phone: null,
          tax_code: null,
          address: null,
          customer_group_id: null,
          customer_group: null,
          created_by: null,
          created_at: '2026-07-12T00:00:00Z',
          linked_supplier: { id: 'supplier-linked', code: 'NCC000035', name: 'Út Tèo', linked_at: '2026-07-13T14:25:22Z' },
          total_sales_amount: 0,
          total_debt_amount: 0,
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })
  render(
    <CustomersPage
      service={service}
      orderService={makeOrderService({ getCustomerDebt: vi.fn(async () => ({ customer_id: 'customer-linked', total_debt: 0, invoices: [] })) })}
    />,
  )

  const customerCodeButton = await screen.findByRole('button', { name: /UT/ })
  expect(within(customerCodeButton).getByLabelText('Có liên kết nhà cung cấp')).toBeInTheDocument()
  await userEvent.click(await screen.findByText('UT'))
  const detail = screen.getByRole('region', { name: 'Chi tiết khách hàng UT' })
  const linkedCard = within(detail).getByRole('region', { name: 'Khách hàng đồng thời là Nhà cung cấp' })
  expect(linkedCard).toHaveTextContent('Nhà cung cấp: Út Tèo')
  expect(linkedCard).toHaveTextContent('NCC000035 - Út Tèo')
  expect(linkedCard).toHaveTextContent('13/07/2026')
})

it('shows an unmatched creator state when imported customer creator does not match a username', async () => {
  const service = makeService({
    listCustomers: vi.fn(async () => ({
      items: [
        {
          id: 'customer-kv-1',
          code: 'KH000521',
          name: 'Khách import',
          phone: null,
          tax_code: null,
          address: null,
          customer_group_id: null,
          customer_group: null,
          created_by: null,
          source_creator_name: 'Phạm Nhật Linh',
          created_at: '2026-07-01T03:00:00Z',
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })
  render(<CustomersPage service={service} orderService={makeOrderService({ getCustomerDebt: vi.fn(async () => ({ customer_id: 'customer-kv-1', total_debt: 0, invoices: [] })) })} />)

  await userEvent.click(await screen.findByText('KH000521'))
  const detail = screen.getByRole('region', { name: 'Chi tiết khách hàng KH000521' })
  const detailSummary = within(detail).getByRole('group', { name: 'Tóm tắt khách hàng KH000521' })
  expect(within(detailSummary).getByText('Người tạo:').parentElement).toHaveTextContent('Người tạo: Chưa khớp tài khoản')
  const infoPanel = within(detail).getByRole('tabpanel', { name: 'Thông tin khách hàng' })
  expect(within(infoPanel).queryByText('Chưa khớp tài khoản')).not.toBeInTheDocument()
})

it('reloads customer debt when the debt tab is opened again', async () => {
  const getCustomerDebt = vi.fn()
    .mockResolvedValueOnce({ customer_id: 'customer-1', total_debt: 0, invoices: [] })
    .mockResolvedValueOnce({
      customer_id: 'customer-1',
      total_debt: 300000,
      invoices: [
        {
          order_id: 'order-bank-partial',
          order_code: 'HD-BANK-PARTIAL',
          created_at: '2026-07-09T04:00:00Z',
          total_amount: 600000,
          paid_amount: 300000,
          debt_amount: 300000,
          remaining_debt: 300000,
        },
      ],
    })
  const orderService = makeOrderService({ getCustomerDebt })

  render(<CustomersPage service={makeService({
    listCustomers: vi.fn(async () => ({
      items: [
        {
          id: 'customer-1',
          code: 'KH000123',
          name: 'Công ty Phong Cảnh',
          phone: '0909000000',
          tax_code: '0312345678',
          address: '12 Nguyễn Trãi, Quận 1',
          customer_group_id: null,
          customer_group: { id: 'cg-1', code: 'VIP', name: 'Khách VIP' },
          customer_type: 'company',
          created_by: { id: 'user-admin', name: 'Admin' },
          created_at: '2026-06-30T17:08:00Z',
          note: 'Ghi chú khách KV',
          status: 'active',
          total_sales_amount: 750000,
          total_debt_amount: 0,
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })} orderService={orderService} />)

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: /KH000123/ })
  const infoTab = within(detail).getByRole('tab', { name: 'Thông tin' })
  const debtTab = within(detail).getByRole('tab', { name: 'Công nợ' })

  await userEvent.click(debtTab)
  await waitFor(() => expect(getCustomerDebt).toHaveBeenCalledTimes(1))
  expect(within(detail).getByText('Không có hóa đơn chưa thanh toán.')).toBeInTheDocument()

  await userEvent.click(infoTab)
  await userEvent.click(debtTab)

  await waitFor(() => expect(getCustomerDebt).toHaveBeenCalledTimes(2))
  expect(within(detail).getByText('HD-BANK-PARTIAL')).toBeInTheDocument()
  expect(detail).toHaveTextContent('300 000')
})

it('derives open receivable totals from customer debt endpoint rows', async () => {
  const salesDocumentService = makeSalesDocumentService({
    listSalesDocuments: vi.fn(async () => ({
      items: [
        {
          id: 'order-open',
          code: 'HD-OPEN',
          order_type: 'invoice' as const,
          status: 'completed' as const,
          created_at: '2026-07-02T09:12:00Z',
          customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: null },
          seller: { id: 'seller-1', name: 'Admin' },
          subtotal_amount: 44800,
          discount_amount: 0,
          total_amount: 44800,
          paid_amount: 0,
          debt_amount: 44800,
          payment_status: 'unpaid' as const,
          note: null,
        },
        {
          id: 'order-paid-old-debt',
          code: 'HD-PAID-OLD',
          order_type: 'invoice' as const,
          status: 'completed' as const,
          created_at: '2026-07-01T09:12:00Z',
          customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: null },
          seller: { id: 'seller-1', name: 'Admin' },
          subtotal_amount: 100000,
          discount_amount: 0,
          total_amount: 100000,
          paid_amount: 100000,
          debt_amount: 100000,
          payment_status: 'paid' as const,
          note: null,
        },
      ],
      page: 1,
      page_size: 10,
      total: 2,
    })),
  })
  render(
    <CustomersPage
      service={makeService()}
      orderService={makeOrderService({
        getCustomerDebt: vi.fn(async () => ({
          customer_id: 'customer-1',
          total_debt: 44800,
          invoices: [
            {
              order_id: 'order-open',
              order_code: 'HD-OPEN',
              created_at: '2026-07-02T09:12:00Z',
              total_amount: 44800,
              paid_amount: 0,
              debt_amount: 44800,
              remaining_debt: 44800,
            },
          ],
          ledger_rows: [
            {
              id: 'order-paid-old-debt',
              code: 'HD-PAID-OLD',
              created_at: '2026-07-01T09:12:00Z',
              amount_delta: 100000,
              balance_after: 100000,
              source_type: 'invoice',
              source_id: 'order-paid-old-debt',
            },
            {
              id: 'order-open',
              code: 'HD-OPEN',
              created_at: '2026-07-02T09:12:00Z',
              amount_delta: 44800,
              balance_after: 44800,
              source_type: 'invoice',
              source_id: 'order-open',
            },
          ],
        })),
      })}
      salesDocumentService={salesDocumentService}
    />,
  )

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: /KH000123/ })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Công nợ' }))

  await waitFor(() => expect(salesDocumentService.listSalesDocuments).toHaveBeenCalledWith({ customer_id: 'customer-1', type: 'invoice', status: 'completed', page: 1, page_size: 10 }))
  expect(within(detail).getByRole('navigation', { name: 'Phân trang tóm tắt công nợ' })).toHaveTextContent('1 - 1 trong 1 hóa đơn mở')
  expect(detail).toHaveTextContent('44 800')
  const debtSummaryTable = within(detail).getByRole('table', { name: 'Tóm tắt công nợ' })
  expect(within(debtSummaryTable).getByText('HD-OPEN')).toBeInTheDocument()
  expect(within(debtSummaryTable).queryByText('HD-PAID-OLD')).not.toBeInTheDocument()

  await userEvent.click(within(detail).getByRole('button', { name: 'Chi tiết' }))
  const debtHistoryTable = within(detail).getByRole('table', { name: 'Lịch sử công nợ' })
  expect(within(debtHistoryTable).getByRole('row', { name: /HD-PAID-OLD/ })).toHaveTextContent('100 000')
  expect(within(debtHistoryTable).queryByText('HD-CANCELLED')).not.toBeInTheDocument()
})

it('keeps debt summary running balance aligned with applied payments', async () => {
  const orderService = makeOrderService({
    getCustomerDebt: vi.fn(async () => ({
      customer_id: 'customer-1',
      total_debt: 179396,
      invoices: [
        {
          order_id: 'order-open',
          order_code: 'HD-OPEN',
          created_at: '2026-07-02T09:12:00Z',
          total_amount: 719396,
          paid_amount: 0,
          debt_amount: 719396,
          remaining_debt: 719396,
        },
      ],
    })),
  })
  const salesDocumentService = makeSalesDocumentService({
    listSalesDocuments: vi.fn(async () => ({
      items: [
        {
          id: 'order-open',
          code: 'HD-OPEN',
          order_type: 'invoice' as const,
          status: 'completed' as const,
          created_at: '2026-07-02T09:12:00Z',
          customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: null },
          seller: { id: 'seller-1', name: 'Admin' },
          subtotal_amount: 719396,
          discount_amount: 0,
          total_amount: 719396,
          paid_amount: 0,
          debt_amount: 719396,
          payment_status: 'partial' as const,
          note: null,
        },
      ],
      page: 1,
      page_size: 10,
      total: 1,
    })),
  })
  const financeService = makeFinanceService({
    listCashbookEntries: vi.fn(async () => ({
      items: [
        {
          id: 'cashbook-payment',
          code: 'TTHDOPEN',
          status: 'posted' as const,
          direction: 'in' as const,
          amount_delta: 540000,
          finance_account: { id: 'cash-main', code: 'TM', name: 'Tiền mặt', account_type: 'cash' as const },
          is_business_accounted: true,
          source_type: 'payment_receipt_method' as const,
          created_at: '2026-07-02T09:20:00Z',
          note: null,
          counterparty: { type: 'customer' as const, name: 'Công ty Phong Cảnh', phone: null },
          created_by: { id: 'user-admin', name: 'Admin' },
          source: { type: 'payment_receipt', id: 'cashbook-payment', code: 'TTHDOPEN', order_code: 'HD-OPEN' },
        },
      ],
      page: 1,
      page_size: 1000,
      total: 1,
      summary: { opening_balance: 0, total_in: 540000, total_out: 0, ending_balance: 540000 },
    })),
  })

  render(<CustomersPage service={makeService()} orderService={orderService} salesDocumentService={salesDocumentService} financeService={financeService} />)

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: /KH000123/ })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Công nợ' }))

  const debtSummaryTable = await within(detail).findByRole('table', { name: 'Tóm tắt công nợ' })
  const summaryRow = within(debtSummaryTable).getByRole('row', { name: /HD-OPEN/ })
  expect(within(summaryRow).getAllByText('179 396')).toHaveLength(2)
  expect(within(summaryRow).queryByText('719 396')).not.toBeInTheDocument()
})

it('shows KiotViet adjustment balance as the debt running balance', async () => {
  const salesDocumentService = makeSalesDocumentService({
    listSalesDocuments: vi.fn(async () => ({
      items: [
        {
          id: 'order-after-cb',
          code: 'HD000007.03',
          order_type: 'invoice' as const,
          status: 'completed' as const,
          created_at: '2023-07-12T16:31:00.000Z',
          customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: '0909000000' },
          seller: { id: 'seller-1', name: 'Admin' },
          subtotal_amount: 790400,
          discount_amount: 0,
          total_amount: 790400,
          paid_amount: 0,
          debt_amount: 790400,
          payment_status: 'unpaid' as const,
          note: null,
        },
      ],
      page: 1,
      page_size: 1000,
      total: 1,
    })),
  })
  render(
    <CustomersPage
      service={makeService()}
      orderService={makeOrderService({
        getCustomerDebt: vi.fn(async () => ({
          customer_id: 'customer-1',
          total_debt: 1510080,
          invoices: [
            {
              order_id: 'order-after-cb',
              order_code: 'HD000007.03',
              created_at: '2023-07-12T16:31:00.000Z',
              total_amount: 790400,
              paid_amount: 0,
              debt_amount: 790400,
              remaining_debt: 790400,
            },
          ],
          adjustments: [
            {
              id: 'customer-debt-adjustment-kv-cb000001',
              source_code: 'CB000001',
              created_at: '2023-07-12T16:27:00.000Z',
              transaction_type: 'Dieu chinh',
              amount_delta: 1000000,
              paid_amount: 0,
              remaining_amount: 1000000,
              balance_after: 1000000,
              source_file: 'BaoCaoCongNoTheoKhachHang_KV13072026-150538-065.xlsx',
            },
            {
              id: 'customer-debt-adjustment-kv-pn000449',
              source_code: 'PN000449',
              created_at: '2023-07-12T17:00:00.000Z',
              transaction_type: 'Nhập hàng',
              amount_delta: -280320,
              paid_amount: 0,
              remaining_amount: -280320,
              balance_after: 1510080,
              source_file: 'LichSuThanhToanKhachHang_KV19072026-003658-454.xlsx',
            },
          ],
          ledger_rows: [
            {
              id: 'customer-debt-adjustment-kv-cb000001',
              code: 'CB000001',
              created_at: '2023-07-12T16:27:00.000Z',
              amount_delta: 1000000,
              balance_after: 1000000,
              source_type: 'adjustment',
              source_id: 'customer-debt-adjustment-kv-cb000001',
            },
            {
              id: 'order-after-cb',
              code: 'HD000007.03',
              created_at: '2023-07-12T16:31:00.000Z',
              amount_delta: 790400,
              balance_after: 1790400,
              source_type: 'invoice',
              source_id: 'order-after-cb',
            },
            {
              id: 'customer-debt-adjustment-kv-pn000449',
              code: 'PN000449',
              created_at: '2023-07-12T17:00:00.000Z',
              amount_delta: -280320,
              balance_after: 1510080,
              source_type: 'adjustment',
              source_id: 'customer-debt-adjustment-kv-pn000449',
            },
          ],
        })),
      })}
      salesDocumentService={salesDocumentService}
    />,
  )

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: /KH000123/ })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Công nợ' }))

  await userEvent.click(within(detail).getByRole('button', { name: 'Chi tiết' }))
  const debtHistoryTable = await within(detail).findByRole('table', { name: 'Lịch sử công nợ' })
  const adjustmentRow = within(debtHistoryTable).getByRole('row', { name: /CB000001/ })
  await userEvent.click(within(adjustmentRow).getByRole('button', { name: 'CB000001' }))
  const adjustmentDialog = screen.getByRole('dialog', { name: 'Điều chỉnh công nợ KH000123' })
  expect(within(adjustmentDialog).getByLabelText('Ngày điều chỉnh')).toHaveValue('12/07/2023 16:27')
  expect(within(adjustmentDialog).getByLabelText('Giá trị nợ điều chỉnh')).toHaveValue('1 000 000')
  expect(within(adjustmentDialog).getByLabelText('Mô tả')).toHaveValue('BaoCaoCongNoTheoKhachHang_KV13072026-150538-065.xlsx')
  await userEvent.click(within(adjustmentDialog).getByRole('button', { name: 'Bỏ qua' }))
  expect(within(adjustmentRow).getAllByRole('cell')[4]).toHaveTextContent('1 000 000')
  const invoiceRow = within(debtHistoryTable).getByRole('row', { name: /HD000007\.03/ })
  expect(within(invoiceRow).getAllByRole('cell')[4]).toHaveTextContent('1 790 400')
  const receiptRow = within(debtHistoryTable).getByRole('row', { name: /PN000449/ })
  expect(within(receiptRow).getByRole('link', { name: 'PN000449' })).toHaveAttribute('href', '/receipts?open=PN000449')
  expect(within(receiptRow).getAllByRole('cell')[3]).toHaveTextContent('-280 320')
  expect(within(receiptRow).getAllByRole('cell')[4]).toHaveTextContent('1 510 080')
})

it('submits edited customer debt payment time to the finance service', async () => {
  const collectCustomerDebt = vi.fn(async () => ({ payment_receipt_id: 'TT000002', allocated_amount: 100000 }))
  const financeService = makeFinanceService({ collectCustomerDebt })
  render(<CustomersPage service={makeService()} orderService={makeOrderService()} salesDocumentService={makeSalesDocumentService()} financeService={financeService} />)

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: 'Chi tiết khách hàng KH000123' })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Công nợ' }))
  await userEvent.click(within(detail).getByRole('button', { name: 'Thanh toán' }))
  const paymentDialog = screen.getByRole('dialog', { name: 'Thanh toán công nợ KH000123' })

  await userEvent.clear(within(paymentDialog).getByLabelText('Thời gian'))
  await userEvent.type(within(paymentDialog).getByLabelText('Thời gian'), '18/07/2026 08:20')
  await userEvent.type(within(paymentDialog).getByLabelText('Số tiền'), '100000')
  await userEvent.click(within(paymentDialog).getByRole('button', { name: 'Tạo phiếu thu' }))

  await waitFor(() => expect(collectCustomerDebt).toHaveBeenCalled())
  expect(collectCustomerDebt).toHaveBeenCalledWith(expect.objectContaining({
    amount: 100000,
    created_at: '2026-07-18T08:20:00.000Z',
  }))
})

it('submits customer debt bank payments with the selected finance account', async () => {
  const collectCustomerDebt = vi.fn(async () => ({ payment_receipt_id: 'TT000003', allocated_amount: 100000 }))
  const financeService = makeFinanceService({
    collectCustomerDebt,
    listAccounts: vi.fn(async () => ({
      items: [
        { id: 'cash-main', code: 'TM', name: 'Tiền mặt', account_type: 'cash' as const, is_default_cash: true, is_active: true },
        { id: 'bank-mb', code: 'MB', name: 'MB Bank', account_type: 'bank' as const, is_default_cash: false, is_active: true, account_number: '0771000598653' },
      ],
    })),
  })
  render(<CustomersPage service={makeService()} orderService={makeOrderService()} salesDocumentService={makeSalesDocumentService()} financeService={financeService} />)

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: 'Chi tiết khách hàng KH000123' })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Công nợ' }))
  await userEvent.click(within(detail).getByRole('button', { name: 'Thanh toán' }))
  const paymentDialog = screen.getByRole('dialog', { name: 'Thanh toán công nợ KH000123' })

  await userEvent.selectOptions(within(paymentDialog).getByLabelText('Phương thức TT'), 'bank_transfer')
  await waitFor(() => expect(financeService.listAccounts).toHaveBeenCalledWith({ is_active: true }))
  await userEvent.selectOptions(within(paymentDialog).getByLabelText('Tài khoản ngân hàng'), 'bank-mb')
  await userEvent.type(within(paymentDialog).getByLabelText('Số tiền'), '100000')
  await userEvent.click(within(paymentDialog).getByRole('button', { name: 'Tạo phiếu thu' }))

  await waitFor(() => expect(collectCustomerDebt).toHaveBeenCalled())
  expect(collectCustomerDebt).toHaveBeenCalledWith(expect.objectContaining({
    amount: 100000,
    payment_method: expect.objectContaining({
      cash_amount: 0,
      bank_amount: 100000,
      bank_account_id: 'bank-mb',
    }),
  }))
})

it('shows the current imported debt balance in the customer debt summary when it is above invoice debt', async () => {
  const salesDocumentService = makeSalesDocumentService({
    listSalesDocuments: vi.fn(async () => ({
      items: [
        {
          id: 'order-before-cb',
          code: 'HD011163',
          order_type: 'invoice' as const,
          status: 'completed' as const,
          created_at: '2026-07-14T14:18:00.000Z',
          customer: { id: 'customer-1', code: 'KH000123', name: 'Công ty Phong Cảnh', phone: '0909000000' },
          seller: { id: 'seller-1', name: 'Admin' },
          subtotal_amount: 209300,
          discount_amount: 0,
          total_amount: 209300,
          paid_amount: 0,
          debt_amount: 209300,
          payment_status: 'unpaid' as const,
          note: null,
        },
      ],
      page: 1,
      page_size: 1000,
      total: 1,
    })),
  })
  render(
    <CustomersPage
      service={makeService({
        listCustomers: vi.fn(async () => ({
          items: [{
            id: 'customer-1',
            code: 'KH000123',
            name: 'Công ty Phong Cảnh',
            phone: '0909000000',
            tax_code: null,
            address: null,
            customer_group_id: null,
            customer_group: null,
            customer_type: 'company',
            created_by: { id: 'user-admin', name: 'Admin' },
            created_at: '2026-06-30T17:08:00Z',
            status: 'active',
            total_sales_amount: 209300,
            total_debt_amount: 1510080,
          }],
          page: 1,
          page_size: 15,
          total: 1,
        })),
      })}
      financeService={makeFinanceService({ listCashbookEntries: vi.fn(async () => ({
        items: [],
        page: 1,
        page_size: 1000,
        total: 0,
        summary: { opening_balance: 0, total_in: 0, total_out: 0, ending_balance: 0 },
      })) })}
      orderService={makeOrderService({
        getCustomerDebt: vi.fn(async () => ({
          customer_id: 'customer-1',
          total_debt: 1510080,
          invoices: [
            {
              order_id: 'order-before-cb',
              order_code: 'HD011163',
              created_at: '2026-07-14T14:18:00.000Z',
              total_amount: 209300,
              paid_amount: 0,
              debt_amount: 209300,
              remaining_debt: 209300,
            },
          ],
          adjustments: [{
            id: 'customer-debt-adjustment-kv-cb000001',
            source_code: 'CB000001',
            created_at: '2026-07-14T15:00:00.000Z',
            transaction_type: 'Dieu chinh',
            amount_delta: 1510080,
            paid_amount: 0,
            remaining_amount: 1510080,
            balance_after: 1510080,
            source_file: 'BaoCaoCongNoTheoKhachHang.xlsx',
          }],
        })),
      })}
      salesDocumentService={salesDocumentService}
    />,
  )

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: /KH000123/ })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Công nợ' }))

  const debtSummaryTable = await within(detail).findByRole('table', { name: 'Tóm tắt công nợ' })
  const summaryRow = within(debtSummaryTable).getByRole('row', { name: /HD011163/ })
  expect(within(summaryRow).getAllByRole('cell')[3]).toHaveTextContent('1 510 080')
})

it('saves edits to imported customer debt adjustment slips', async () => {
  const updateCustomerDebtAdjustment = vi.fn(async () => ({
    id: 'customer-debt-adjustment-kv-cb000001',
    source_code: 'CB000001',
    created_at: '2023-07-12T16:27:00.000Z',
    transaction_type: 'Dieu chinh',
    amount_delta: 2000000,
    paid_amount: 0,
    remaining_amount: 2000000,
    balance_after: 1000000,
    source_file: 'Ghi chú mới',
  }))
  render(
    <CustomersPage
      service={makeService()}
      financeService={makeFinanceService({ updateCustomerDebtAdjustment })}
      orderService={makeOrderService({
        getCustomerDebt: vi.fn(async () => ({
          customer_id: 'customer-1',
          total_debt: 1000000,
          invoices: [],
          adjustments: [
            {
              id: 'customer-debt-adjustment-kv-cb000001',
              source_code: 'CB000001',
              created_at: '2023-07-12T16:27:00.000Z',
              transaction_type: 'Dieu chinh',
              amount_delta: 1000000,
              paid_amount: 0,
              remaining_amount: 1000000,
              balance_after: 1000000,
              source_file: 'Nguồn cũ',
            },
          ],
        })),
      })}
      salesDocumentService={makeSalesDocumentService({ listSalesDocuments: vi.fn(async () => ({ items: [], page: 1, page_size: 1000, total: 0 })) })}
    />,
  )

  await userEvent.click(await screen.findByText('KH000123'))
  const detail = screen.getByRole('region', { name: /KH000123/ })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Công nợ' }))
  await userEvent.click(within(detail).getByRole('button', { name: 'Chi tiết' }))
  const debtHistoryTable = await within(detail).findByRole('table', { name: 'Lịch sử công nợ' })
  await userEvent.click(within(within(debtHistoryTable).getByRole('row', { name: /CB000001/ })).getByRole('button', { name: 'CB000001' }))

  const adjustmentDialog = screen.getByRole('dialog', { name: 'Điều chỉnh công nợ KH000123' })
  await userEvent.clear(within(adjustmentDialog).getByLabelText('Giá trị nợ điều chỉnh'))
  await userEvent.type(within(adjustmentDialog).getByLabelText('Giá trị nợ điều chỉnh'), '2 000 000')
  await userEvent.clear(within(adjustmentDialog).getByLabelText('Mô tả'))
  await userEvent.type(within(adjustmentDialog).getByLabelText('Mô tả'), 'Ghi chú mới')
  await userEvent.click(within(adjustmentDialog).getByRole('button', { name: 'Cập nhật' }))

  expect(updateCustomerDebtAdjustment).toHaveBeenCalledWith('customer-debt-adjustment-kv-cb000001', {
    adjusted_at: '2023-07-12T16:27:00.000Z',
    amount_delta: 2000000,
    note: 'Ghi chú mới',
  })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Điều chỉnh công nợ KH000123' })).not.toBeInTheDocument())
})

it('opens customer detail when legacy cloud data has no created timestamp', async () => {
  const service = makeService({
    listCustomers: vi.fn(async () => ({
      items: [
        {
          id: 'customer-legacy',
          code: 'KHLEGACY',
          name: 'Khách dữ liệu cũ',
          phone: null,
          tax_code: null,
          address: null,
          customer_group_id: null,
          customer_group: null,
          created_by: null,
          created_at: '',
          total_sales_amount: 0,
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })
  render(
    <CustomersPage
      service={service}
      orderService={makeOrderService({ getCustomerDebt: vi.fn(async () => ({ customer_id: 'customer-legacy', total_debt: 0, invoices: [] })) })}
    />,
  )

  await userEvent.click(await screen.findByText('KHLEGACY'))
  const detail = screen.getByRole('region', { name: 'Chi tiết khách hàng KHLEGACY' })
  const detailSummary = within(detail).getByRole('group', { name: 'Tóm tắt khách hàng KHLEGACY' })
  expect(within(detailSummary).getByText('Người tạo:').parentElement).toHaveTextContent('Người tạo:')
  expect(within(detailSummary).getByText('Ngày tạo:').parentElement).toHaveTextContent('Ngày tạo:')
  const infoPanel = within(detail).getByRole('tabpanel', { name: 'Thông tin khách hàng' })
  expect(within(infoPanel).queryByText('Chưa có dữ liệu')).not.toBeInTheDocument()
})

it('uses a denser customer page size on wide management screens', async () => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 2209,
  })
  const service = makeService({
    listCustomers: vi.fn(async (input = {}) => ({
      items: [],
      page: 1,
      page_size: input.page_size ?? 15,
      total: 0,
    })),
  })

  render(
    <CustomersPage
      service={service}
      orderService={makeOrderService()}
    />,
  )

  await waitFor(() => expect(service.listCustomers).toHaveBeenCalledWith(expect.objectContaining({
    page: 1,
    page_size: 30,
  })))
  const footer = await screen.findByRole('navigation', { name: 'Phân trang khách hàng' })
  expect(within(footer).getByRole('combobox', { name: 'Số dòng hiển thị' })).toHaveValue('30')
})
