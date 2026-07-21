import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SalesDocumentsPage } from './SalesDocumentsPage'
import type { SalesDocumentDetail, SalesDocumentListResponse, SalesDocumentService } from './sales-document-service'
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
      width_m: 2.5,
      height_m: 3.3,
      unit_price: 20000,
      line_subtotal_amount: 165000,
      discount_amount: 15000,
      line_total: 150000,
      price_source: 'manual',
      note: 'vệ sinh + dán băng',
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
    previewKiotVietInvoiceImport: vi.fn(async () => ({
      summary: {
        total_rows: 1,
        valid_rows: 1,
        invalid_rows: 0,
        invoice_count: 1,
        create_rows: 1,
        update_rows: 0,
        item_rows: 1,
        missing_customer_count: 0,
        missing_product_count: 0,
        total_amount: 150000,
        paid_total: 150000,
        cash_total: 150000,
        bank_total: 0,
      },
      invalid_rows: [],
      missing_customer_codes: [],
      missing_product_codes: [],
    })),
    importKiotVietInvoices: vi.fn(async () => ({
      summary: {
        total_rows: 1,
        valid_rows: 1,
        invalid_rows: 0,
        created_rows: 1,
        updated_rows: 0,
        skipped_rows: 0,
        items_created: 1,
        items_updated: 0,
      },
      invalid_rows: [],
    })),
    deleteImportedKiotVietInvoices: vi.fn(async () => ({ deleted_rows: 1, blocked_rows: 0 })),
    cancelSalesDocument: vi.fn(async () => ({ ...detail, status: 'cancelled' as const })),
    updateSalesDocumentNote: vi.fn(async (_id: string, input: { note?: string | null; created_at?: string }) => ({ ...detail, note: input.note ?? '', created_at: input.created_at ?? detail.created_at })),
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

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
}

async function clickDocumentRow(code: string) {
  const table = await screen.findByRole('table', { name: 'Danh sách chứng từ bán hàng' })
  const codeCell = await within(table).findByText(code, { selector: 'tbody td:first-child strong' })
  const row = codeCell.closest('tr')
  if (!row) throw new Error(`Không tìm thấy dòng chứng từ ${code}`)
  await userEvent.click(row)
}

it('uses a denser default page size on wide management screens', async () => {
  const originalWidth = window.innerWidth
  setViewportWidth(2209)
  const service = makeService({
    listSalesDocuments: vi.fn(async (input = {}) => ({
      items: [listItem],
      page: 1,
      page_size: input.page_size ?? 15,
      total: 153,
    })),
  })

  try {
    render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

    await waitFor(() => expect(service.listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      page_size: 30,
    })))
    const footer = await screen.findByRole('navigation', { name: 'Phân trang chứng từ' })
    expect(within(footer).getByRole('combobox', { name: 'Số dòng hiển thị' })).toHaveValue('30')
  } finally {
    setViewportWidth(originalWidth)
  }
})

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
  const typeFilterGroup = within(sidebar).getByRole('region', { name: 'Loại hóa đơn' })
  const statusFilterGroup = within(sidebar).getByRole('region', { name: 'Trạng thái hóa đơn' })
  expect(within(typeFilterGroup).getByRole('checkbox', { name: 'Hóa đơn' })).toBeChecked()
  expect(within(typeFilterGroup).getByRole('checkbox', { name: 'Báo giá' })).toBeChecked()
  expect(within(typeFilterGroup).queryByRole('combobox')).not.toBeInTheDocument()
  expect(within(statusFilterGroup).getByRole('checkbox', { name: 'Đang hiệu lực' })).toBeChecked()
  expect(within(statusFilterGroup).getByRole('checkbox', { name: 'Hoàn tất' })).toBeChecked()
  expect(within(statusFilterGroup).getByRole('checkbox', { name: 'Đã hủy' })).not.toBeChecked()
  expect(within(statusFilterGroup).queryByRole('combobox')).not.toBeInTheDocument()
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
    status: 'active,completed',
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
  expect(table).toHaveClass('management-table')
  expect(table).not.toHaveClass('sales-documents-management-table')
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
  await userEvent.type(screen.getByLabelText('Tìm chứng từ'), 'HD010985')

  await waitFor(() => expect(service.listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
    from: expect.stringMatching(/^\d{4}-\d{2}-01$/),
    page: 1,
    page_size: 15,
    search: 'HD010985',
    status: 'active,completed',
    to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  })))
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc chứng từ bán hàng' })
  expect(within(sidebar).queryByText('Tìm: HD010985')).not.toBeInTheDocument()
  expect(screen.getByText('Không thấy chứng từ theo bộ lọc hiện tại.')).toBeInTheDocument()
  expect(screen.getByText('Hãy thử mở rộng thời gian hoặc bỏ bớt bộ lọc.')).toBeInTheDocument()
})

it('opens a single linked invoice from route query and searches full history', async () => {
  const originalUrl = window.location.href
  window.history.pushState({}, '', '/sales-documents?search=HD010985&type=invoice')
  const service = makeService({
    listSalesDocuments: vi.fn(async () => ({
      items: [listItem],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    getSalesDocument: vi.fn(async () => detail),
  })

  try {
    render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

    await waitFor(() => expect(service.listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      page_size: 15,
      search: 'HD010985',
      type: 'invoice',
    })))
    const listCalls = vi.mocked(service.listSalesDocuments).mock.calls
    const initialRequest = listCalls[listCalls.length - 1]?.[0]
    expect(initialRequest).not.toHaveProperty('from')
    expect(initialRequest).not.toHaveProperty('to')
    expect(screen.getByLabelText('Tìm chứng từ')).toHaveValue('HD010985')
    expect(screen.getByRole('checkbox', { name: 'Hóa đơn' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Báo giá' })).not.toBeChecked()
    expect(await screen.findByRole('region', { name: /HD010985/ })).toBeInTheDocument()
    expect(service.getSalesDocument).toHaveBeenCalledWith('order-1')
  } finally {
    window.history.pushState({}, '', originalUrl)
  }
})

it('loads route-open invoice detail by code without waiting for the list id lookup', async () => {
  const originalUrl = window.location.href
  window.history.pushState({}, '', '/sales-documents?open=HD010985&type=invoice')
  let resolveList: (value: SalesDocumentListResponse) => void = () => {}
  const listPromise = new Promise<SalesDocumentListResponse>((resolve) => {
    resolveList = resolve
  })
  const service = makeService({
    listSalesDocuments: vi.fn(async () => listPromise),
    getSalesDocument: vi.fn(async () => detail),
  })

  try {
    render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

    await waitFor(() => expect(service.getSalesDocument).toHaveBeenCalledWith('HD010985'))
    expect(await screen.findByRole('region', { name: /HD010985/ })).toBeInTheDocument()
    resolveList({
      items: [listItem],
      page: 1,
      page_size: 15,
      total: 1,
    })
  } finally {
    window.history.pushState({}, '', originalUrl)
  }
})

it('filters matching sales documents while typing without accents and without suggestions', async () => {
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

  await waitFor(() => expect(service.listSalesDocuments).toHaveBeenCalledWith(expect.objectContaining({
    search: 'phong',
    page: 1,
    page_size: 15,
  })))

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(screen.getByText('HD010985')).toBeInTheDocument()
})

it('cancels an invoice after confirmation', async () => {
  const cancelSalesDocument = vi.fn(async () => ({ ...detail, status: 'cancelled' as const }))
  const listSalesDocuments = vi.fn(async () => ({
    items: [listItem],
    page: 1,
    page_size: 15,
    total: 1,
  }))
  const service = makeService({ cancelSalesDocument, listSalesDocuments })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  const detailRegion = await screen.findByRole('region', { name: /HD010985/ })
  await userEvent.click(within(detailRegion).getByRole('button', { name: /H.y/ }))

  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('HD010985')).toBeInTheDocument()
  await userEvent.click(within(dialog).getAllByRole('button').at(-1) as HTMLElement)

  await waitFor(() => expect(cancelSalesDocument).toHaveBeenCalledWith('order-1'))
  expect(listSalesDocuments).toHaveBeenCalledTimes(2)
  expect(detailRegion.querySelector('.status-chip')).toHaveTextContent(/h.y/i)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('saves invoice note from the shared detail textarea', async () => {
  const updateSalesDocumentNote = vi.fn(async (_id: string, input: { note?: string | null; created_at?: string }) => ({
    ...detail,
    note: input.note ?? '',
    created_at: input.created_at ?? detail.created_at,
  }))
  const service = makeService({ updateSalesDocumentNote })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  const detailRegion = await screen.findByRole('region', { name: /HD010985/ })
  const noteInput = within(detailRegion).getByRole('textbox', { name: /Ghi ch/ })

  expect(noteInput).toHaveClass('management-detail-note')
  expect(noteInput).toHaveValue('Khách lấy sau')

  await userEvent.clear(noteInput)
  await userEvent.type(noteInput, 'Ghi chú mới')
  await userEvent.click(within(detailRegion).getByRole('button', { name: /L.u/ }))

  await waitFor(() => expect(updateSalesDocumentNote).toHaveBeenCalledWith('order-1', {
    note: 'Ghi chú mới',
    created_at: '2026-06-30T17:08:00.000Z',
  }))
  expect(noteInput).toHaveValue('Ghi chú mới')
})

it('saves invoice created time from the quick detail field', async () => {
  const updateSalesDocumentNote = vi.fn(async (_id: string, input: { note?: string | null; created_at?: string }) => ({
    ...detail,
    note: input.note ?? '',
    created_at: input.created_at ?? detail.created_at,
  }))
  const service = makeService({ updateSalesDocumentNote })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  const detailRegion = await screen.findByRole('region', { name: /HD010985/ })
  await userEvent.click(within(detailRegion).getByText('30/06/2026 17:08'))
  const createdAtInput = detailRegion.querySelector('input.management-detail-inline-input')

  expect(createdAtInput).not.toBeNull()
  expect(createdAtInput).toHaveValue('30/06/2026 17:08')

  fireEvent.change(createdAtInput as HTMLInputElement, { target: { value: '18/07/2026 04:15' } })
  await userEvent.click(within(detailRegion).getByRole('button', { name: /L.u/ }))

  await waitFor(() => expect(updateSalesDocumentNote).toHaveBeenCalledWith('order-1', expect.objectContaining({
    created_at: '2026-07-18T04:15:00.000Z',
  })))
  expect(within(detailRegion).getByText('18/07/2026 04:15')).toBeInTheDocument()
})

it('leaves the sales document unit cell empty when the product has no unit', async () => {
  const service = makeService({
    getSalesDocument: vi.fn(async () => ({
      ...detail,
      items: [{
        ...detail.items[0],
        product: {
          ...detail.items[0].product,
          unit_name: 'Cần cập nhật',
        },
      }],
    })),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await clickDocumentRow('HD010985')
  const lineTable = await screen.findByRole('table', { name: 'Dòng hàng' })
  const row = within(lineTable).getByText('DECAL-PP').closest('tr') as HTMLTableRowElement

  expect(row.cells[3]).toHaveTextContent('')
  expect(within(lineTable).queryByText('Cần cập nhật')).not.toBeInTheDocument()
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
    status: 'active,completed',
    to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  }))
  expect(await within(footer).findByText('16 - 30 trong 40 chứng từ')).toBeInTheDocument()
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('2')
  expect(await screen.findByText('HD010999')).toBeInTheDocument()
})

it('shows KPI totals from the whole filtered result instead of the current page', async () => {
  const service = makeService({
    listSalesDocuments: vi.fn(async () => ({
      items: [{ ...listItem, total_amount: 150000, debt_amount: 150000 }],
      page: 1,
      page_size: 15,
      total: 40,
      summary: { total_amount: 11351090, debt_amount: 9526090 },
    })),
  })
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  const summary = await screen.findByRole('region', { name: 'Tổng quan chứng từ bán hàng' })

  expect(within(summary).getByText('11 351 090')).toBeInTheDocument()
  expect(within(summary).getByText('9 526 090')).toBeInTheDocument()
  expect(within(summary).queryByText('150 000')).not.toBeInTheDocument()
})

it('filters sales documents by KiotViet-style custom time range', async () => {
  const service = makeService()
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('HD010985')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc chứng từ bán hàng' })
  const timeGroup = within(sidebar).getByRole('region', { name: 'Thời gian' })

  expect(within(timeGroup).getByRole('button', { name: 'Tháng này' })).toBeInTheDocument()
  expect(within(timeGroup).queryByRole('radio', { name: 'Tùy chỉnh' })).not.toBeInTheDocument()

  await userEvent.clear(within(timeGroup).getByLabelText('Từ ngày'))
  await userEvent.type(within(timeGroup).getByLabelText('Từ ngày'), '01/07/2026')
  await userEvent.clear(within(timeGroup).getByLabelText('Đến ngày'))
  await userEvent.type(within(timeGroup).getByLabelText('Đến ngày'), '31/07/2026')

  expect(service.listSalesDocuments).toHaveBeenLastCalledWith({
    from: '2026-07-01',
    page: 1,
    page_size: 15,
    status: 'active,completed',
    to: '2026-07-31',
  })
})

it('opens KiotViet invoice import and deletes old import data from the shared dialog', async () => {
  const service = makeService()
  render(<SalesDocumentsPage service={service} onOpenDashboard={vi.fn()} />)
  await screen.findByText('HD010985')

  await userEvent.click(screen.getByRole('button', { name: 'Import' }))
  const dialog = screen.getByRole('dialog', { name: 'Import hóa đơn KiotViet' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa dữ liệu cũ' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }))

  await waitFor(() => expect(service.deleteImportedKiotVietInvoices).toHaveBeenCalled())
  expect(service.listSalesDocuments).toHaveBeenCalledTimes(2)
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
    status: 'active,completed',
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
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc chứng từ bán hàng' })
  const typeGroup = within(sidebar).getByRole('region', { name: 'Loại hóa đơn' })
  const statusGroup = within(sidebar).getByRole('region', { name: 'Trạng thái hóa đơn' })
  await userEvent.click(within(typeGroup).getByRole('checkbox', { name: 'Hóa đơn' }))
  await userEvent.click(within(statusGroup).getByRole('checkbox', { name: 'Hoàn tất' }))

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

  const statusGroup = within(sidebar).getByRole('region', { name: 'Trạng thái hóa đơn' })
  expect(within(statusGroup).getByRole('checkbox', { name: 'Đang hiệu lực' })).toBeChecked()
  expect(within(statusGroup).getByRole('checkbox', { name: 'Hoàn tất' })).toBeChecked()
  expect(within(statusGroup).getByRole('checkbox', { name: 'Đã hủy' })).not.toBeChecked()
  expect(within(statusGroup).queryByRole('checkbox', { name: 'Không giao được' })).not.toBeInTheDocument()
  expect(within(statusGroup).queryByRole('checkbox', { name: 'Đang xử lý' })).not.toBeInTheDocument()
  expect(within(statusGroup).queryByRole('radio')).not.toBeInTheDocument()

  await userEvent.click(within(statusGroup).getByRole('checkbox', { name: 'Đang hiệu lực' }))
  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    status: 'completed',
    page: 1,
    page_size: 15,
  }))

  const paymentStatusGroup = within(sidebar).getByRole('region', { name: 'Thanh toán' })
  await userEvent.click(within(paymentStatusGroup).getByRole('checkbox', { name: 'Chưa thanh toán' }))
  await userEvent.click(within(paymentStatusGroup).getByRole('checkbox', { name: 'Thanh toán một phần' }))
  expect(service.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({
    status: 'completed',
    payment_status: 'paid',
    page: 1,
    page_size: 15,
  }))

  const paymentMethodGroup = within(sidebar).getByRole('region', { name: 'Phương thức TT' })
  await userEvent.selectOptions(within(paymentMethodGroup).getByRole('combobox', { name: 'Phương thức TT' }), 'bank_transfer')
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

it('opens a completed invoice in POS as an invoice revision draft', async () => {
  const onOpenInvoiceRevisionInPos = vi.fn()
  const service = makeService()

  render(
    <SalesDocumentsPage
      service={service}
      orderService={makeOrderService()}
      onOpenDashboard={vi.fn()}
      onOpenInvoiceRevisionInPos={onOpenInvoiceRevisionInPos}
    />,
  )

  await clickDocumentRow('HD010985')
  await userEvent.click(await screen.findByRole('button', { name: 'Sửa' }))

  expect(onOpenInvoiceRevisionInPos).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: 'invoice-revision',
      original_order: { id: 'order-1', code: 'HD010985' },
      customer: {
        customer_id: 'cus-1',
        snapshot: { code: 'KH001', name: 'Công ty Phong Cảnh', phone: '0909000000' },
      },
      items: [
        expect.objectContaining({
          order_item_id: 'item-1',
          product_id: 'product-1',
          product_snapshot: {
            code: 'DECAL-PP',
            name: 'Decal PP',
            unit_name: 'm²',
            sell_method: 'area_m2',
          },
          quantity: 8.25,
          unit_price: 20000,
          discount_amount: 15000,
          price_source: 'manual',
        }),
      ],
      summary: { subtotal_amount: 180000, discount_amount: 30000, total_amount: 150000 },
      note: 'Khách lấy sau',
    }),
  )
  expect(service.getSalesDocument).toHaveBeenCalledWith('order-1')
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
  expect(within(detailHeader).getByText('Chưa thanh toán')).toHaveClass('status-chip', 'status-chip-danger')
  expect(within(detailHeader).queryByText('Hoàn tất')).not.toBeInTheDocument()
  expect(within(detailRegion).queryByText('Người tạo:')).not.toBeInTheDocument()
  expect(within(detailRegion).getByText('Người bán:').closest('div')).toHaveTextContent('Người bán:Admin')
  expect(within(detailRegion).getByText('Ngày bán:').closest('div')).toHaveTextContent('Ngày bán:30/06/2026 17:08')
  expect(within(detailRegion).getByText('Giá chung')).toBeInTheDocument()
  expect(within(detailRegion).queryByText('Kênh bán:')).not.toBeInTheDocument()
  expect(within(detailRegion).queryByText('Chi nhánh')).not.toBeInTheDocument()
  expect(detailRegion.querySelector('.management-detail-meta-grid')).not.toBeNull()
  const lineTable = within(detailRegion).getByRole('table', { name: 'Dòng hàng' })
  expect(lineTable).toHaveClass('management-detail-table', 'management-detail-lines-table')
  expect(within(lineTable).getByRole('columnheader', { name: 'Mã hàng' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Tên hàng' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Số lượng' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Đơn vị' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Đơn giá' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Giảm giá' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Giá bán' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Thành tiền' })).toBeInTheDocument()
  expect(within(lineTable).getByText('DECAL-PP')).toBeInTheDocument()
  expect(within(lineTable).getByText('Decal PP')).toBeInTheDocument()
  const itemRow = within(lineTable).getByText('DECAL-PP').closest('tr') as HTMLElement
  expect(within(itemRow).getByText('8.25')).toBeInTheDocument()
  expect(within(itemRow).getByText('m²')).toBeInTheDocument()
  expect(within(lineTable).queryByText('8.25 m²')).not.toBeInTheDocument()
  expect(within(lineTable).getByText('20 000')).toBeInTheDocument()
  expect(within(lineTable).getByText('15 000')).toBeInTheDocument()
  expect(within(lineTable).getByText('18 182')).toBeInTheDocument()
  const itemNote = within(itemRow).getByText('vệ sinh + dán băng')
  expect(itemNote.closest('small')).toHaveClass('sales-document-line-subtext')
  expect(within(itemRow).getByText('2.5m x 3.3m x 1')).toHaveClass('sales-document-line-subtext')
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
  expect(within(footer as HTMLElement).getByRole('button', { name: 'Xuất file' })).toBeDisabled()
  expect(within(footer as HTMLElement).getByRole('button', { name: 'In' })).toBeEnabled()
  expect(within(footer as HTMLElement).queryByRole('button', { name: 'Tạo QR' })).not.toBeInTheDocument()
  expect(within(footer as HTMLElement).queryByRole('button', { name: 'Trả hàng' })).not.toBeInTheDocument()
  expect(footer?.querySelector('.management-detail-footer-actions-left')).not.toBeNull()
  expect(footer?.querySelector('.management-detail-footer-actions-right')).not.toBeNull()
  expect(footer?.querySelectorAll('svg')).toHaveLength(6)
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
  expect(within(paymentHistory).getByText('30/06/2026 17:08')).toBeInTheDocument()
  expect(within(paymentHistory).getByText('Admin')).toBeInTheDocument()
  expect(within(paymentHistory).queryByText('Chưa có dữ liệu')).not.toBeInTheDocument()
  expect(within(paymentHistory).queryByText('-')).not.toBeInTheDocument()
  const paymentCells = Array.from(paymentHistory.querySelectorAll('tbody tr:first-child td'))
  expect(paymentCells[4]).toHaveTextContent('')
})

it('shows invoice detail actions except return and QR flows', async () => {
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
  expect(within(detailRegion).queryByRole('button', { name: 'Trả hàng' })).not.toBeInTheDocument()
  expect(within(detailRegion).queryByRole('button', { name: 'Tạo QR' })).not.toBeInTheDocument()
})
