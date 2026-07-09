import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SalesDocumentsPage } from './SalesDocumentsPage'
import type { SalesDocumentDetail, SalesDocumentService } from './sales-document-service'
import type { OrderService, QuoteReopenPayload } from '../orders/order-service'
import type { CatalogService } from '../catalog/catalog-service'
import type { FoundationService } from '../users/foundation-service'

const listItem = {
  id: 'order-1',
  code: 'HD010985',
  order_type: 'invoice' as const,
  status: 'completed' as const,
  created_at: '2026-06-30T17:08:00Z',
  customer: { id: 'cus-1', code: 'KH001', name: 'Công ty Phong Cảnh', phone: '0909000000' },
  seller: { id: 'seller-1', name: 'Admin' },
  subtotal_amount: 180000,
  discount_amount: 30000,
  total_amount: 150000,
  paid_amount: 0,
  debt_amount: 150000,
  payment_status: 'unpaid' as const,
  note: 'Khách lấy sau',
}

const detail: SalesDocumentDetail = {
  ...listItem,
  price_list: { id: 'pl-1', code: 'BGCHUNG', name: 'Bảng giá chung' },
  change_returned_amount: 0,
  items: [
    {
      id: 'item-1',
      line_no: 1,
      product: {
        id: 'product-1',
        code: 'DECAL-PP',
        name: 'Decal PP',
        unit_name: 'm²',
        sell_method: 'area_m2',
      },
      quantity: 8.25,
      unit_price: 20000,
      line_subtotal_amount: 165000,
      discount_amount: 15000,
      line_total: 150000,
      price_source: 'manual',
      note: '2.5m x 3.3m x 1 = 8.25m2',
    },
  ],
  payment_receipts: [],
  debt_entries: [
    {
      id: 'debt-1',
      entry_type: 'invoice_debt',
      amount_delta: 150000,
      balance_after_order: 150000,
      balance_after_customer: 150000,
      created_at: '2026-06-30T17:08:01Z',
    },
  ],
  stock_movements: [
    {
      id: 'stock-1',
      movement_type: 'sale_deduction',
      product_id: 'product-1',
      quantity_delta: -8.25,
      unit_name: 'm²',
      note: 'HD010985',
    },
  ],
  history: [{ at: '2026-06-30T17:08:00Z', action: 'created', actor_name: 'Admin', note: null }],
}

const quoteListItem = {
  ...listItem,
  id: 'quote-1',
  code: 'BG000123',
  order_type: 'quote' as const,
  status: 'active' as const,
  paid_amount: 0,
  debt_amount: 0,
  payment_status: 'not_applicable' as const,
}

const secondListItem = {
  ...listItem,
  id: 'order-2',
  code: 'HD010986',
  customer: { id: 'cus-2', code: 'KH002', name: 'Công ty An Bình', phone: '0911000000' },
}

const quoteDetail: SalesDocumentDetail = {
  ...detail,
  ...quoteListItem,
  price_list: { id: 'pl-1', code: 'BGCHUNG', name: 'Bảng giá chung' },
  paid_amount: 0,
  debt_amount: 0,
  change_returned_amount: 0,
  payment_receipts: [],
  debt_entries: [],
  stock_movements: [],
}

const paidDetail = {
  ...detail,
  paid_amount: 150000,
  debt_amount: 0,
  payment_status: 'paid' as const,
  payment_receipts: [
    {
      id: 'receipt-1',
      code: 'PT000125',
      status: 'posted',
      receipt_type: 'sale_payment',
      total_received_amount: 150000,
      created_at: '2026-06-30T17:09:00Z',
      created_by: { id: 'cashier-1', name: 'Thu ngân' },
      methods: [
        {
          method_type: 'bank_transfer',
          amount: 150000,
          finance_account: { id: 'bank-1', code: 'MB01', name: 'MB Bank' },
        },
      ],
      allocations: [],
    },
  ],
} as SalesDocumentDetail

const partialPaidDetail = {
  ...detail,
  id: 'order-partial',
  code: 'HD000020',
  total_amount: 600000,
  paid_amount: 100000,
  debt_amount: 500000,
  payment_status: 'partial' as const,
} as SalesDocumentDetail

const quoteReopenPayload: QuoteReopenPayload = {
  quote: {
    id: 'quote-1',
    code: 'BG000123',
    status: 'active',
  },
  customer: {
    customer_id: 'cus-1',
    snapshot: { code: 'KH001', name: 'Công ty Phong Cảnh', phone: '0909000000' },
    warnings: [],
  },
  price_list: {
    price_list_id: null,
    snapshot: { code: null, name: null },
    warnings: [],
  },
  items: [],
  summary: { subtotal_amount: 180000, discount_amount: 30000, total_amount: 150000 },
  note: null,
}

function makeService(overrides: Partial<SalesDocumentService> = {}): SalesDocumentService {
  return {
    listSalesDocuments: vi.fn(async () => ({
      items: [listItem],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    getSalesDocument: vi.fn(async () => detail),
    ...overrides,
  }
}

function makeOrderService(overrides: Partial<OrderService> = {}): OrderService {
  return {
    validateCart: vi.fn(),
    checkout: vi.fn(),
    saveQuote: vi.fn(),
    getQuoteReopenPayload: vi.fn(async () => quoteReopenPayload),
    listFinanceAccounts: vi.fn(),
    getCustomerDebt: vi.fn(),
    listRecentCustomerProductPrices: vi.fn(),
    ...overrides,
  } as unknown as OrderService
}

function makeFoundationService(overrides: Partial<FoundationService> = {}): Pick<FoundationService, 'listUsers'> {
  return {
    listUsers: vi.fn(async () => ({
      items: [
        {
          id: 'seller-1',
          email: 'admin@example.test',
          display_name: 'Admin',
          status: 'active',
          permissions: ['perm.create_order'],
        },
      ],
      total: 1,
    })),
    ...overrides,
  } as Pick<FoundationService, 'listUsers'>
}

function makeCatalogService(overrides: Partial<CatalogService> = {}): Pick<CatalogService, 'listPriceLists'> {
  return {
    listPriceLists: vi.fn(async () => ({
      items: [
        {
          id: 'pl-1',
          code: 'BGCHUNG',
          name: 'Bảng giá chung',
          is_default: true,
          is_active: true,
        },
      ],
    })),
    ...overrides,
  } as Pick<CatalogService, 'listPriceLists'>
}

async function clickDocumentRow(code: string) {
  const table = await screen.findByRole('table', { name: 'Danh sách chứng từ bán hàng' })
  const codeCell = await within(table).findByText(code, { selector: 'tbody td:first-child strong' })
  const row = codeCell.closest('tr')
  if (!row) throw new Error(`Không tìm thấy dòng chứng từ ${code}`)
  await userEvent.click(row)
}

it('lists invoices with money, seller and customer snapshots', async () => {
  const service = makeService()
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  expect(screen.getByText('Đang tải chứng từ...').closest('.management-list-surface')).not.toBeNull()
  expect(await screen.findByText('HD010985')).toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveClass('management-page')
  expect(screen.getByRole('search', { name: 'Lọc chứng từ bán hàng' })).toHaveClass('management-compact-toolbar')
  expect(screen.queryByRole('button', { name: 'Lọc' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Trang chủ' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Danh sách chứng từ bán hàng' })).toHaveClass('management-list-surface')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc chứng từ bán hàng' })
  expect(sidebar).toBeInTheDocument()
  expect(within(sidebar).queryByRole('heading', { name: 'Bộ lọc' })).not.toBeInTheDocument()
  const summary = screen.getByRole('region', { name: 'Tổng quan chứng từ bán hàng' })
  expect(summary.closest('.management-filter-column')).not.toBeNull()
  expect(within(summary).queryByText('Tổng chứng từ')).not.toBeInTheDocument()
  expect(within(summary).getByText('Tổng tiền')).toBeInTheDocument()
  expect(within(summary).getByText('Còn nợ')).toBeInTheDocument()
  const typeFilterGroup = within(sidebar).getByRole('region', { name: 'Loại chứng từ' })
  const statusFilterGroup = within(sidebar).getByRole('region', { name: 'Trạng thái chứng từ' })
  expect(within(typeFilterGroup).getByRole('combobox', { name: 'Loại chứng từ' })).toHaveValue('all')
  expect(within(typeFilterGroup).queryByRole('radio')).not.toBeInTheDocument()
  expect(within(statusFilterGroup).getByRole('combobox', { name: 'Trạng thái chứng từ' })).toHaveValue('all')
  expect(within(statusFilterGroup).queryByRole('radio')).not.toBeInTheDocument()
  expect(within(sidebar).queryByRole('button', { name: 'Đặt lại bộ lọc' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Danh sách chứng từ' })).not.toBeInTheDocument()
  expect(screen.queryByText('Tìm nhanh mã hóa đơn/báo giá, khách hàng hoặc ghi chú theo dữ liệu API hiện có.')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Còn nợ' })).not.toBeInTheDocument()
  expect(screen.queryByText('Chưa có bộ lọc phụ.')).not.toBeInTheDocument()
  expect(screen.queryByText('Chọn một chứng từ để xem chi tiết.')).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Chi tiết chứng từ HD010985' })).not.toBeInTheDocument()
  expect(service.listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
    from: expect.stringMatching(/^\d{4}-\d{2}-01$/),
    page: 1,
    page_size: 15,
    to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  }))
  expect(screen.getByRole('columnheader', { name: 'Mã hóa đơn' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Thời gian' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Khách hàng' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Tổng tiền hàng' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Giảm giá' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Tổng sau giảm' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Khách đã trả' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Loại/Mã' })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Mã KH' })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Người bán' })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Còn nợ' })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Thanh toán' })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Mở' })).not.toBeInTheDocument()
  expect(screen.getByText('Công ty Phong Cảnh')).toBeInTheDocument()
  const table = screen.getByRole('table', { name: 'Danh sách chứng từ bán hàng' })
  expect(within(table).queryByText('Hóa đơn', { selector: 'tbody .status-chip-info' })).not.toBeInTheDocument()
  expect(within(table).queryByText('Admin')).not.toBeInTheDocument()
  expect(within(table).queryByText('Nợ')).not.toBeInTheDocument()
  expect(within(table).getAllByText('150 000')).toHaveLength(1)
  expect(within(table).getByText('180 000')).toBeInTheDocument()
  expect(within(table).getByText('30 000')).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
  expect(screen.queryByText('Hoàn tất', { selector: '.status-chip' })).not.toBeInTheDocument()
  const footer = screen.getByRole('navigation', { name: 'Phân trang chứng từ' })
  expect(footer).toHaveClass('management-table-footer')
  expect(within(footer).getByText('1 - 1 trong 1 chứng từ')).toBeInTheDocument()
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('1')
  expect(within(footer).getByRole('button', { name: 'Trang trước' })).toBeDisabled()
  expect(within(footer).getByRole('button', { name: 'Trang sau' })).toBeDisabled()
})

it('shows a shared plus action in document search to start a new sale', async () => {
  const onCreateSalesDocument = vi.fn()
  render(
    <SalesDocumentsPage
      service={makeService()}
      onCreateSalesDocument={onCreateSalesDocument}
      onOpenDashboard={vi.fn()}
    />,
  )

  const searchForm = screen.getByRole('search', { name: 'Lọc chứng từ bán hàng' })
  const createAction = within(searchForm).getByRole('button', { name: 'Tạo chứng từ bán hàng' })

  expect(createAction.closest('.management-compact-search')).not.toBeNull()
  expect(createAction).toHaveClass('management-compact-create-action')
  expect(createAction.querySelector('.lucide-plus')).not.toBeNull()
  await userEvent.click(createAction)
  expect(onCreateSalesDocument).toHaveBeenCalledTimes(1)
})

it('searches by document code and keeps filtered empty state clear', async () => {
  const service = makeService({
    listSalesDocuments: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('Chưa có chứng từ phù hợp bộ lọc.')
  await userEvent.type(screen.getByLabelText('Tìm chứng từ'), 'HD010985{Enter}')

  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    from: expect.stringMatching(/^\d{4}-\d{2}-01$/),
    page: 1,
    page_size: 15,
    search: 'HD010985',
    to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  }))
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc chứng từ bán hàng' })
  expect(within(sidebar).queryByText('Tìm: HD010985')).not.toBeInTheDocument()
  expect(screen.getByText('Không thấy chứng từ theo bộ lọc hiện tại.')).toBeInTheDocument()
  expect(screen.getByText('Hãy thử mở rộng thời gian hoặc bỏ bớt bộ lọc.')).toBeInTheDocument()
})

it('shows matching sales documents below search while typing without accents', async () => {
  const service = makeService({
    listSalesDocuments: vi.fn(async (input = {}) => ({
      items: input.search === 'HD010985' || input.search === 'phong' ? [listItem] : [secondListItem],
      page: 1,
      page_size: input.page_size ?? 15,
      total: 1,
    })),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('HD010986')
  await userEvent.type(screen.getByRole('textbox', { name: /Tìm chứng từ/ }), 'phong')

  const suggestions = await screen.findByRole('listbox')
  expect(within(suggestions).getByRole('option', { name: /HD010985/ })).toBeInTheDocument()
  await userEvent.click(within(suggestions).getByRole('option', { name: /HD010985/ }))

  await waitFor(() => {
    expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
      search: 'HD010985',
      page: 1,
      page_size: 15,
    }))
  })
})

it('uses 15-row pagination range and navigates pages through the list footer', async () => {
  const service = makeService({
    listSalesDocuments: vi.fn(async (input = {}) => ({
      items: [
        {
          ...listItem,
          id: `order-page-${input.page ?? 1}`,
          code: input.page === 2 ? 'HD010999' : 'HD010985',
        },
      ],
      page: input.page ?? 1,
      page_size: 15,
      total: 40,
    })),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  const footer = await screen.findByRole('navigation', { name: 'Phân trang chứng từ' })
  expect(within(footer).getByText('1 - 15 trong 40 chứng từ')).toBeInTheDocument()
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('1')
  expect(within(footer).getByRole('button', { name: 'Trang trước' })).toBeDisabled()
  expect(within(footer).getByRole('button', { name: 'Trang sau' })).toBeEnabled()
  await userEvent.click(within(footer).getByRole('button', { name: 'Trang sau' }))

  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    from: expect.stringMatching(/^\d{4}-\d{2}-01$/),
    page: 2,
    page_size: 15,
    to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  }))
  expect(await within(footer).findByText('16 - 30 trong 40 chứng từ')).toBeInTheDocument()
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('2')
  expect(await screen.findByText('HD010999')).toBeInTheDocument()
})

it('filters sales documents by KiotViet-style custom time range', async () => {
  const service = makeService()
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('HD010985')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc chứng từ bán hàng' })
  const timeGroup = within(sidebar).getByRole('region', { name: 'Thời gian' })

  expect(within(timeGroup).getByRole('radio', { name: 'Tháng này' })).toBeChecked()
  expect(within(timeGroup).getByRole('radio', { name: 'Tùy chỉnh' })).toBeInTheDocument()

  await userEvent.click(within(timeGroup).getByRole('radio', { name: 'Tùy chỉnh' }))
  await userEvent.clear(within(timeGroup).getByLabelText('Từ ngày'))
  await userEvent.type(within(timeGroup).getByLabelText('Từ ngày'), '2026-07-01')
  await userEvent.clear(within(timeGroup).getByLabelText('Đến ngày'))
  await userEvent.type(within(timeGroup).getByLabelText('Đến ngày'), '2026-07-31')

  expect(service.listSalesDocuments).toHaveBeenLastCalledWith({
    from: '2026-07-01',
    page: 1,
    page_size: 15,
    to: '2026-07-31',
  })
})

it('opens KiotViet-style quick time menu and can select all time without date params', async () => {
  const service = makeService()
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('HD010985')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc chứng từ bán hàng' })
  const timeGroup = within(sidebar).getByRole('region', { name: 'Thời gian' })

  await userEvent.click(within(timeGroup).getByText('Tháng này'))

  expect(within(timeGroup).getByRole('region', { name: 'Chọn nhanh thời gian' })).toBeInTheDocument()
  await userEvent.click(within(timeGroup).getByRole('button', { name: 'Toàn thời gian' }))

  expect(service.listSalesDocuments).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
  })
})

it('filters quotes and exposes reopen only for active quote rows', async () => {
  const service = makeService({
    listSalesDocuments: vi.fn(async () => ({
      items: [quoteListItem],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    getSalesDocument: vi.fn(async () => quoteDetail),
  })
  render(
    <SalesDocumentsPage
      service={service}
      orderService={makeOrderService()}
      onOpenDashboard={vi.fn()}
      onOpenQuoteInPos={vi.fn()}
    />,
  )

  await screen.findByText('BG000123')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Loại chứng từ' }), 'quote')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Trạng thái chứng từ' }), 'active')

  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    from: expect.stringMatching(/^\d{4}-\d{2}-01$/),
    type: 'quote',
    status: 'active',
    page: 1,
    page_size: 15,
    to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  }))
  expect(screen.queryByRole('button', { name: 'Mở tại POS BG000123' })).not.toBeInTheDocument()
  await clickDocumentRow('BG000123')
  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ BG000123' })
  expect(within(detailRegion).queryByRole('button', { name: 'Mở tại POS' })).not.toBeInTheDocument()
  expect(within(detailRegion).getByRole('button', { name: 'Hủy' })).toBeEnabled()
  expect(within(detailRegion).getByRole('button', { name: 'Sao chép' })).toBeEnabled()
  expect(within(detailRegion).getByRole('button', { name: 'Sửa' })).toBeEnabled()
  expect(within(detailRegion).queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument()
  expect(within(detailRegion).getByRole('button', { name: 'Lưu' })).toBeEnabled()
  expect(within(detailRegion).getByRole('button', { name: 'In' })).toBeEnabled()
})

it('filters sales documents by supported invoice payment seller and price list fields', async () => {
  const service = makeService()
  const userService = makeFoundationService()
  const catalogService = makeCatalogService()
  render(
    <SalesDocumentsPage
      service={service}
      userService={userService}
      catalogService={catalogService}
      onOpenDashboard={vi.fn()}
    />,
  )

  await screen.findByText('HD010985')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc chứng từ bán hàng' })

  const statusGroup = within(sidebar).getByRole('region', { name: 'Trạng thái chứng từ' })
  expect(within(statusGroup).getByRole('combobox', { name: 'Trạng thái chứng từ' })).toBeInTheDocument()
  expect(within(statusGroup).getByRole('option', { name: 'Hoàn tất' })).toBeInTheDocument()
  expect(within(statusGroup).getByRole('option', { name: 'Đã hủy' })).toBeInTheDocument()
  expect(within(statusGroup).queryByRole('option', { name: 'Không giao được' })).not.toBeInTheDocument()
  expect(within(statusGroup).queryByRole('option', { name: 'Đang xử lý' })).not.toBeInTheDocument()
  expect(within(statusGroup).queryByRole('radio')).not.toBeInTheDocument()

  await userEvent.selectOptions(within(statusGroup).getByRole('combobox', { name: 'Trạng thái chứng từ' }), 'completed')
  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    status: 'completed',
    page: 1,
    page_size: 15,
  }))

  const paymentStatusGroup = within(sidebar).getByRole('region', { name: 'Thanh toán' })
  await userEvent.selectOptions(within(paymentStatusGroup).getByRole('combobox', { name: 'Thanh toán' }), 'paid')
  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    status: 'completed',
    payment_status: 'paid',
    page: 1,
    page_size: 15,
  }))

  const paymentMethodGroup = within(sidebar).getByRole('region', { name: 'Phương thức thanh toán' })
  await userEvent.selectOptions(within(paymentMethodGroup).getByRole('combobox', { name: 'Phương thức thanh toán' }), 'bank_transfer')
  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    payment_method: 'bank_transfer',
    payment_status: 'paid',
    status: 'completed',
  }))

  const sellerGroup = within(sidebar).getByRole('region', { name: 'Người bán' })
  await userEvent.selectOptions(await within(sellerGroup).findByRole('combobox', { name: 'Người bán' }), 'seller-1')
  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    created_by: 'seller-1',
    payment_method: 'bank_transfer',
    payment_status: 'paid',
    status: 'completed',
  }))

  const priceListGroup = within(sidebar).getByRole('region', { name: 'Bảng giá' })
  await userEvent.selectOptions(await within(priceListGroup).findByRole('combobox', { name: 'Bảng giá' }), 'pl-1')
  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    created_by: 'seller-1',
    price_list_id: 'pl-1',
    payment_method: 'bank_transfer',
    payment_status: 'paid',
    status: 'completed',
  }))
})

it('stores reopen payload through callback when editing an active quote', async () => {
  const onOpenQuoteInPos = vi.fn()
  const orderService = makeOrderService()
  const service = makeService({
    listSalesDocuments: vi.fn(async () => ({
      items: [quoteListItem],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    getSalesDocument: vi.fn(async () => quoteDetail),
  })
  render(
    <SalesDocumentsPage
      service={service}
      orderService={orderService}
      onOpenDashboard={vi.fn()}
      onOpenQuoteInPos={onOpenQuoteInPos}
    />,
  )

  await clickDocumentRow('BG000123')
  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ BG000123' })
  expect(within(detailRegion).queryByRole('button', { name: 'Mở tại POS' })).not.toBeInTheDocument()
  await userEvent.click(within(detailRegion).getByRole('button', { name: 'Sửa' }))

  expect(orderService.getQuoteReopenPayload).toHaveBeenCalledWith('quote-1')
  expect(onOpenQuoteInPos).toHaveBeenCalledWith(quoteReopenPayload)
})

it('shows quote reopen failures inside the row-level shared detail area', async () => {
  const service = makeService({
    listSalesDocuments: vi.fn(async () => ({
      items: [quoteListItem],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    getSalesDocument: vi.fn(async () => quoteDetail),
  })
  const orderService = makeOrderService({
    getQuoteReopenPayload: vi.fn(async () => {
      throw new Error('Không mở được báo giá tại POS.')
    }),
  })
  render(
    <SalesDocumentsPage
      service={service}
      orderService={orderService}
      onOpenDashboard={vi.fn()}
      onOpenQuoteInPos={vi.fn()}
    />,
  )

  await clickDocumentRow('BG000123')
  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ BG000123' })
  expect(within(detailRegion).queryByRole('button', { name: 'Mở tại POS' })).not.toBeInTheDocument()
  await userEvent.click(within(detailRegion).getByRole('button', { name: 'Sửa' }))

  expect(detailRegion).toHaveClass('management-inline-detail')
  expect(within(detailRegion).getByRole('alert')).toHaveTextContent('Không mở được báo giá tại POS.')
})

it('clears the previous selected detail when opening another row fails', async () => {
  const service = makeService({
    listSalesDocuments: vi.fn(async () => ({
      items: [listItem, secondListItem],
      page: 1,
      page_size: 15,
      total: 2,
    })),
    getSalesDocument: vi.fn(async (id) => {
      if (id === 'order-2') throw new Error('Không tải được chi tiết chứng từ.')
      return detail
    }),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  expect(await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010985' })).toBeInTheDocument()

  await clickDocumentRow('HD010986')

  expect(screen.queryByRole('region', { name: 'Chi tiết chứng từ HD010985' })).not.toBeInTheDocument()
  const failedDetailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010986' })
  expect(within(failedDetailRegion).getByRole('alert')).toHaveTextContent('Không tải được chi tiết chứng từ.')
})

it('opens quote print only from quote detail', async () => {
  const onOpenQuotePrint = vi.fn()
  const service = makeService({
    listSalesDocuments: vi.fn(async () => ({
      items: [quoteListItem],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    getSalesDocument: vi.fn(async () => quoteDetail),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} onOpenQuotePrint={onOpenQuotePrint} />)

  await clickDocumentRow('BG000123')

  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ BG000123' })
  await userEvent.click(within(detailRegion).getByRole('button', { name: 'Xem/In báo giá' }))

  expect(onOpenQuotePrint).toHaveBeenCalledWith('quote-1')
})

it('opens invoice detail with item, price list, debt and stock snapshots', async () => {
  const service = makeService()
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')

  expect(service.getSalesDocument).toHaveBeenCalledWith('order-1')
  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010985' })
  expect(detailRegion).toHaveClass('management-inline-detail')
  expect(detailRegion.closest('.management-detail-row')).not.toBeNull()
  expect(detailRegion.querySelector('.management-detail-panel')).not.toBeNull()
  const detailHeader = within(detailRegion).getByRole('banner')
  expect(detailHeader).toHaveClass('management-detail-header')
  expect(within(detailRegion).getByRole('heading', { name: 'Công ty Phong Cảnh' })).toBeInTheDocument()
  expect(within(detailRegion).getByText('HD010985')).toBeInTheDocument()
  expect(within(detailHeader).getByText('Chưa thanh toán')).toHaveClass('status-chip', 'status-chip-neutral')
  expect(within(detailHeader).queryByText('Hoàn tất')).not.toBeInTheDocument()
  expect(within(detailRegion).queryByText('Người tạo:')).not.toBeInTheDocument()
  expect(within(detailRegion).getByText('Người bán:').closest('div')).toHaveTextContent('Người bán:Admin')
  expect(within(detailRegion).getByText('Ngày bán:').closest('div')).toHaveTextContent('Ngày bán:00:08 1/7/26')
  expect(within(detailRegion).getByText('Bảng giá chung')).toBeInTheDocument()
  expect(within(detailRegion).queryByText('Kênh bán:')).not.toBeInTheDocument()
  expect(within(detailRegion).queryByText('Chi nhánh')).not.toBeInTheDocument()
  expect(detailRegion.querySelector('.management-detail-meta-grid')).not.toBeNull()
  const lineTable = within(detailRegion).getByRole('table', { name: 'Dòng hàng' })
  expect(lineTable).toHaveClass('management-detail-table')
  expect(within(lineTable).getByRole('columnheader', { name: 'Mã hàng' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Tên hàng' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Số lượng' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Đơn giá' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Giảm giá' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Giá bán' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Thành tiền' })).toBeInTheDocument()
  expect(within(lineTable).getByText('DECAL-PP')).toBeInTheDocument()
  expect(within(lineTable).getByText('Decal PP')).toBeInTheDocument()
  expect(within(lineTable).getByText('8.25 m²')).toBeInTheDocument()
  expect(within(lineTable).getByText('20 000')).toBeInTheDocument()
  expect(within(lineTable).getByText('15 000')).toBeInTheDocument()
  expect(within(lineTable).getByText('18 182')).toBeInTheDocument()
  expect(within(detailRegion).getByText('2.5m x 3.3m x 1 = 8.25m2')).toBeInTheDocument()
  expect(within(detailRegion).getByText('Tổng tiền hàng (1)')).toBeInTheDocument()
  expect(within(detailRegion).getByText('Giảm giá hóa đơn')).toBeInTheDocument()
  expect(within(detailRegion).getByText('Khách cần trả')).toBeInTheDocument()
  expect(within(detailRegion).getByText('Khách đã trả')).toBeInTheDocument()
  expect(within(detailRegion).getByText('Công nợ')).toBeInTheDocument()
  expect(detailRegion.querySelector('.management-detail-summary-box')).toHaveClass('management-detail-summary-box-right')
  expect(detailRegion.querySelector('.management-detail-lower')).toHaveClass('management-detail-lower-right')
  const footer = detailRegion.querySelector('.management-detail-footer-actions')
  expect(footer).not.toBeNull()
  expect(within(footer as HTMLElement).getByRole('button', { name: 'Hủy' })).toBeEnabled()
  expect(within(footer as HTMLElement).getByRole('button', { name: 'Sao chép' })).toBeEnabled()
  expect(within(footer as HTMLElement).getByRole('button', { name: 'Sửa' })).toBeEnabled()
  expect(within(footer as HTMLElement).queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument()
  expect(within(footer as HTMLElement).getByRole('button', { name: 'Lưu' })).toBeEnabled()
  expect(within(footer as HTMLElement).getByRole('button', { name: 'Lưu' })).toHaveClass('button-secondary')
  expect(within(footer as HTMLElement).getByRole('button', { name: 'In' })).toBeEnabled()
  expect(footer?.querySelector('.management-detail-footer-actions-left')).not.toBeNull()
  expect(footer?.querySelector('.management-detail-footer-actions-right')).not.toBeNull()
  expect(footer?.querySelectorAll('svg')).toHaveLength(5)
  expect(footer?.querySelector('.lucide-trash-2')).not.toBeNull()

  await clickDocumentRow('HD010985')
  expect(screen.queryByRole('region', { name: 'Chi tiết chứng từ HD010985' })).not.toBeInTheDocument()
})

it('shows invoice payment status in the detail header', async () => {
  const service = makeService({
    getSalesDocument: vi.fn(async () => partialPaidDetail),
    listSalesDocuments: vi.fn(async () => ({
      items: [{ ...listItem, id: 'order-partial', code: 'HD000020', total_amount: 600000, paid_amount: 100000, debt_amount: 500000, payment_status: 'partial' as const }],
      total: 1,
      page: 1,
      page_size: 15,
      summary: { total_amount: 600000, paid_amount: 100000, debt_amount: 500000 },
    })),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD000020')

  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ HD000020' })
  const detailHeader = within(detailRegion).getByRole('banner')
  expect(within(detailHeader).getByText('Thanh toán 1 phần')).toHaveClass('status-chip', 'status-chip-warning')
  expect(within(detailHeader).queryByText('Hoàn tất')).not.toBeInTheDocument()
})

it('uses the shared paid invoice success chip color', async () => {
  const service = makeService({
    getSalesDocument: vi.fn(async () => paidDetail),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')

  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010985' })
  const detailHeader = within(detailRegion).getByRole('banner')
  expect(within(detailHeader).getByText('Hoàn tất')).toHaveClass('status-chip', 'status-chip-success')
})

it('hides payment history tab when an invoice has no receipts', async () => {
  const service = makeService()
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010985' })

  expect(within(detailRegion).getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
  expect(within(detailRegion).queryByRole('tab', { name: 'Lịch sử thanh toán' })).not.toBeInTheDocument()
  expect(within(detailRegion).getByRole('tabpanel', { name: 'Thông tin' })).toBeInTheDocument()
  expect(within(detailRegion).queryByText('Chưa có lịch sử thanh toán.')).not.toBeInTheDocument()
})

it('keeps invoice detail open when a bubbled click reports coordinates outside the selected row', async () => {
  const service = makeService()
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010985' })
  const selectedRow = screen.getByRole('button', { name: 'HD010985' }).closest('tr') as HTMLTableRowElement
  vi.spyOn(selectedRow, 'getBoundingClientRect').mockReturnValue({
    bottom: 120,
    height: 20,
    left: 0,
    right: 800,
    top: 100,
    width: 800,
    x: 0,
    y: 100,
    toJSON: () => ({}),
  })

  fireEvent.click(selectedRow, { clientX: 420, clientY: 180 })

  expect(detailRegion).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Chi tiết chứng từ HD010985' })).toBeInTheDocument()
})

it('shows payment receipt rows in the payment history tab', async () => {
  const service = makeService({
    getSalesDocument: vi.fn(async () => paidDetail),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010985' })

  expect(within(detailRegion).getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
  const historyTab = within(detailRegion).getByRole('tab', { name: 'Lịch sử thanh toán' })
  expect(historyTab).toHaveAttribute('aria-selected', 'false')

  await userEvent.click(historyTab)

  const paymentHistory = within(detailRegion).getByRole('table', { name: 'Lịch sử thanh toán' })
  expect(within(paymentHistory).getByRole('columnheader', { name: 'Mã phiếu' })).toBeInTheDocument()
  expect(within(paymentHistory).getByRole('columnheader', { name: 'Người thu' })).toBeInTheDocument()
  expect(within(paymentHistory).getByText('PT000125')).toBeInTheDocument()
  expect(within(paymentHistory).getByText('Thu ngân')).toBeInTheDocument()
  expect(within(paymentHistory).getByText('Chuyển khoản')).toBeInTheDocument()
  expect(within(paymentHistory).getByText('Đã thanh toán')).toBeInTheDocument()
  expect(within(paymentHistory).getAllByText('150 000').length).toBeGreaterThan(0)
})

it('keeps payment history visible when receipt data misses optional nested fields', async () => {
  const fragilePaymentDetail = {
    ...paidDetail,
    payment_receipts: [
      {
        ...paidDetail.payment_receipts[0],
        created_at: '',
        created_by: null,
        methods: undefined,
      },
    ],
  } as unknown as SalesDocumentDetail
  const service = makeService({
    getSalesDocument: vi.fn(async () => fragilePaymentDetail),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010985' })

  await userEvent.click(within(detailRegion).getByRole('tab', { name: 'Lịch sử thanh toán' }))

  const paymentHistory = within(detailRegion).getByRole('table', { name: 'Lịch sử thanh toán' })
  expect(within(paymentHistory).getByText('PT000125')).toBeInTheDocument()
  expect(within(paymentHistory).getByText('00:08 1/7/26')).toBeInTheDocument()
  expect(within(paymentHistory).getByText('Admin')).toBeInTheDocument()
  expect(within(paymentHistory).queryByText('Chưa có dữ liệu')).not.toBeInTheDocument()
  expect(within(paymentHistory).getAllByText('-')).toHaveLength(1)
})

it('shows active invoice detail action placeholders until flows exist', async () => {
  const service = makeService()
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  const detailRegion = await screen.findByRole('region', { name: 'Chi tiết chứng từ HD010985' })

  expect(within(detailRegion).getByRole('button', { name: 'Hủy' })).toBeEnabled()
  expect(within(detailRegion).getByRole('button', { name: 'Sao chép' })).toBeEnabled()
  expect(within(detailRegion).getByRole('button', { name: 'Sửa' })).toBeEnabled()
  expect(within(detailRegion).queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument()
  expect(within(detailRegion).getByRole('button', { name: 'Lưu' })).toBeEnabled()
  expect(within(detailRegion).getByRole('button', { name: 'In' })).toBeEnabled()
  expect(within(detailRegion).queryByRole('button', { name: 'Huỷ' })).not.toBeInTheDocument()
  expect(within(detailRegion).queryByRole('button', { name: 'In lại' })).not.toBeInTheDocument()
})
