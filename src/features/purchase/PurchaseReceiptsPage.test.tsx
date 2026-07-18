import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PurchaseReceiptsPage } from './PurchaseReceiptsPage'
import type { PurchaseReceiptService } from './purchase-receipt-service'
import type { CurrentUserData } from '../../lib/api/types'

const currentUser: CurrentUserData = {
  user: { id: 'user-1', email: 'admin@qc.local', display_name: 'Nguyễn Thị Mai Phương' },
  organization: { id: 'org-1', code: 'QCVL', name: 'QCVL' },
  workstation: null,
  permissions: [],
  devices: [],
}

const receiptCreateDraftStorageKey = 'qc-oms.purchase-receipt-create-draft.v1'

beforeEach(() => {
  window.name = ''
  window.sessionStorage.clear()
  window.localStorage.clear()
})

const suppliers = [
  {
    id: 'supplier-1',
    code: 'NCC000031',
    name: 'Nguyễn Phong',
    phone: null,
    email: null,
    address: null,
    tax_code: null,
    linked_customer_id: null,
    linked_customer: null,
    notes: null,
    status: 'active' as const,
    current_payable_amount: 0,
    total_purchase_amount: 0,
  },
]

const products = [
  {
    id: 'product-1',
    code: 'SP0001',
    name: 'Decal sữa',
    status: 'active' as const,
    unit_name: 'm',
    sell_method: 'quantity' as const,
    latest_purchase_cost: 85000,
    latest_purchase_cost_at: null,
    inventory_shape: 'normal' as const,
  },
  {
    id: 'product-2',
    code: 'SP0002',
    name: 'Fomex',
    status: 'active' as const,
    unit_name: 'tấm',
    sell_method: 'quantity' as const,
    latest_purchase_cost: null,
    latest_purchase_cost_at: null,
    inventory_shape: 'sheet' as const,
  },
  {
    id: 'product-3',
    code: 'SP0003',
    name: 'Bạt cuộn',
    status: 'active' as const,
    unit_name: 'm2',
    sell_method: 'area_m2' as const,
    latest_purchase_cost: 1000000,
    latest_purchase_cost_at: null,
    inventory_shape: 'roll' as const,
  },
]

const remoteCodeProduct = {
  id: 'product-remote-code',
  code: 'NGD-01',
  name: 'Nguyên liệu decal',
  status: 'active' as const,
  unit_name: 'm',
  sell_method: 'quantity' as const,
  latest_purchase_cost: 12000,
  latest_purchase_cost_at: null,
  inventory_shape: 'normal' as const,
}

const receipt = {
  id: 'receipt-1',
  code: 'PN000673',
  supplier_id: 'supplier-1',
  supplier: { id: 'supplier-1', code: 'NCC000031', name: 'Nguyễn Phong' },
  received_at: '2026-07-01T03:00:00 000Z',
  status: 'draft' as const,
  supplier_document_no: 'HD-NCC-001',
  subtotal_amount: 190000,
  discount_amount: 10000,
  payable_amount: 180000,
  paid_amount: 50000,
  remaining_amount: 130000,
  notes: 'Nhập hàng thường',
  created_by: { id: 'user-1', name: 'Nguyễn Thị Mai Phương' },
  created_at: '2026-07-01T03:00:00 000Z',
  updated_at: '2026-07-01T03:00:00 000Z',
  items: [
    {
      id: 'item-1',
      product_id: 'product-1',
      product: { id: 'product-1', code: 'SP0001', name: 'Decal sữa' },
      line_no: 1,
      inventory_shape: 'normal' as const,
      unit_name_snapshot: 'm',
      quantity: 2,
      unit_cost: 100000,
      discount_amount: 10000,
      line_amount: 190000,
      physical_payload: null,
    },
  ],
  supplier_payments: [],
}

const postedReceipt = {
  ...receipt,
  id: 'receipt-posted',
  code: 'PN000674',
  status: 'posted' as const,
  remaining_amount: 130000,
  supplier_payments: [
    {
      id: 'payment-1',
      code: 'PCPN000001',
      paid_at: '2026-07-02T07:00:00 000Z',
      created_by: 'user-1',
      payment_method: 'cash' as const,
      status: 'posted' as const,
      amount: 50000,
    },
  ],
}

function makeService(overrides: Partial<PurchaseReceiptService> = {}): PurchaseReceiptService {
  return {
    listReceipts: vi.fn(async () => ({ items: [receipt], page: 1, page_size: 15, total: 1 })),
    getReceipt: vi.fn(async () => receipt),
    createReceipt: vi.fn(async () => receipt),
    updateReceipt: vi.fn(async () => ({ ...receipt, notes: 'Đã sửa' })),
    postReceipt: vi.fn(async () => ({
      purchase_receipt_id: 'receipt-1',
      status: 'posted' as const,
      posted_at: '2026-07-02T03:00:00 000Z',
      cashbook_voucher_id: 'voucher-1',
    })),
    paySupplier: vi.fn(async () => ({
      supplier_payment_id: 'payment-2',
      code: 'PCPN000002',
      amount: 80000,
      cashbook_voucher_id: 'voucher-2',
    })),
    previewKiotVietPurchaseReceiptImport: vi.fn(async () => ({
      summary: {
        total_rows: 2,
        valid_rows: 2,
        invalid_rows: 0,
        receipt_count: 1,
        create_rows: 1,
        update_rows: 0,
        item_rows: 2,
        missing_supplier_count: 0,
        missing_product_count: 0,
        payable_total: 2880000,
        paid_total: 2880000,
      },
      invalid_rows: [],
      missing_supplier_codes: [],
      missing_product_codes: [],
    })),
    importKiotVietPurchaseReceipts: vi.fn(async () => ({
      summary: {
        total_rows: 2,
        valid_rows: 2,
        invalid_rows: 0,
        created_rows: 1,
        updated_rows: 0,
        skipped_rows: 0,
        items_created: 2,
        items_updated: 0,
      },
      invalid_rows: [],
    })),
    deleteImportedKiotVietPurchaseReceipts: vi.fn(async () => ({ deleted_rows: 1, blocked_rows: 0 })),
    listSuppliers: vi.fn(async () => ({ items: suppliers, page: 1, page_size: 20, total: 1 })),
    listProducts: vi.fn(async () => ({ items: products, page: 1, page_size: 20, total: 2 })),
    createProduct: vi.fn(async () => products[0]),
    listFinanceAccounts: vi.fn(async () => ({
      items: [
        {
          id: 'bank-1',
          code: 'VCB',
          name: 'Vietcombank',
          account_type: 'bank' as const,
          is_default_cash: false,
          is_active: true,
        },
      ],
    })),
    ...overrides,
  }
}

async function openReceiptDetail(code = 'PN000673') {
  await userEvent.click(await screen.findByRole('button', { name: code }))
}

async function addProductToCreateReceipt(query: string) {
  const productSearch = screen.getByRole('textbox', { name: 'Tìm hàng (F3)' })
  await userEvent.clear(productSearch)
  await userEvent.type(productSearch, query)
  await userEvent.keyboard('{Enter}')
}

it('lists draft purchase receipts with totals and opens post action for draft detail', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage currentUser={currentUser} service={service} onOpenDashboard={vi.fn()} />)

  expect(screen.getByText('Đang tải phiếu nhập...')).toBeInTheDocument()
  expect(await screen.findByText('PN000673')).toBeInTheDocument()
  const table = screen.getByRole('table')
  const headers = Array.from(table.querySelectorAll('th')).map((header) => header.textContent?.trim())
  expect(headers).toEqual(['', '☆', 'Mã nhập hàng', 'Nhà cung cấp', 'Số lượng', 'Thành tiền', 'Cần trả', 'Đã trả'])
  expect(within(table).getByRole('checkbox', { name: 'Chọn tất cả phiếu nhập' })).toBeInTheDocument()
  expect(within(table).getByRole('checkbox', { name: 'Chọn phiếu nhập PN000673' })).toBeInTheDocument()
  expect(within(table).getByRole('button', { name: 'Chỉ hiện phiếu nhập ưu tiên' })).toHaveClass('finance-cashbook-star-button')
  expect(within(table).queryByRole('button', { name: /Tên NCC/i })).not.toBeInTheDocument()
  expect(within(table).queryByText('Mã NCC')).not.toBeInTheDocument()
  expect(within(table).queryByText('Thời gian')).not.toBeInTheDocument()
  expect(within(table).queryByText('Còn phải trả')).not.toBeInTheDocument()
  expect(within(table).queryByText('Trạng thái')).not.toBeInTheDocument()
  expect(within(table).queryByText('NCC000031')).not.toBeInTheDocument()
  expect(within(table).getByText('Nguyễn Phong')).toBeInTheDocument()
  expect(within(table).queryByText('NCC000031 - Nguyễn Phong')).not.toBeInTheDocument()
  expect(within(table).getByText('2.00')).toBeInTheDocument()
  expect(within(table).getByText('190 000')).toBeInTheDocument()
  expect(within(table).getByText('180 000')).toBeInTheDocument()
  expect(within(table).getByText('50 000')).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Thông tin phiếu nhập' })).not.toBeInTheDocument()
  expect(screen.queryByRole('complementary', { name: 'Chi tiết và thao tác phiếu nhập' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tạo phiếu nhập' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Lọc' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Trang chủ' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Hoàn thành nhập hàng' })).not.toBeInTheDocument()
  expect(headers).not.toContain('Mở')
  expect(service.listSuppliers).not.toHaveBeenCalled()
  expect(service.listProducts).not.toHaveBeenCalled()
  expect(service.listFinanceAccounts).not.toHaveBeenCalled()
  const footer = screen.getByRole('navigation', { name: 'Phân trang phiếu nhập' })
  expect(within(footer).getByText('1 - 1 trong 1 phiếu nhập')).toBeInTheDocument()
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('1')
  await openReceiptDetail()
  const detail = screen.getByRole('region', { name: 'Chi tiết phiếu nhập PN000673' })
  expect(detail).toBeInTheDocument()
  expect(detail.closest('tr')).toHaveClass('management-detail-row')
  expect(detail.closest('section[aria-label="Phiếu nhập"]')).toHaveClass('management-layout')
  expect(detail).not.toHaveClass('management-detail-panel')
  expect(detail.querySelector('.management-detail-panel')).not.toBeNull()
  expect(detail.querySelector('.management-detail-header')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Hoàn thành nhập hàng' })).toBeInTheDocument()
})

it('renders purchase receipts through the shared management data table', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  const table = await screen.findByRole('table', { name: 'Danh sách phiếu nhập' })
  expect(table).toHaveClass('management-table')

  await openReceiptDetail()
  const detail = screen.getByRole('region', { name: 'Chi tiết phiếu nhập PN000673' })
  expect(detail.closest('tr')).toHaveClass('management-detail-row')
})

it('summarizes purchase receipt validation state with scan-friendly KPI cards and panels', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  const summary = screen.getByRole('region', { name: 'Tổng quan phiếu nhập' })
  expect(summary.closest('.management-filter-column')).not.toBeNull()
  expect(summary.closest('.management-page-header')).toBeNull()
  expect(within(summary).queryByText('Tổng phiếu')).not.toBeInTheDocument()
  expect(within(summary).getByText('Tổng tiền hàng')).toBeInTheDocument()
  expect(within(summary).getByText('Tổng nợ')).toBeInTheDocument()
  expect(within(summary).queryByText('Cần trả')).not.toBeInTheDocument()
  expect(within(summary).queryByText('Còn phải trả')).not.toBeInTheDocument()
  expect(screen.getByRole('complementary', { name: 'Bộ lọc phiếu nhập' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Danh sách phiếu nhập' })).toBeInTheDocument()
  expect(screen.queryByRole('complementary', { name: 'Chi tiết và thao tác phiếu nhập' })).not.toBeInTheDocument()
})

it('filters purchase receipts by search status and dates', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  const filterForm = screen.getByRole('search', { name: 'Lọc phiếu nhập' })
  const filterSidebar = screen.getByRole('complementary', { name: 'Bộ lọc phiếu nhập' })
  const searchInput = within(filterForm).getByLabelText('Tìm phiếu/NCC')
  await userEvent.type(searchInput, 'Nguyễn Phong')
  await userEvent.selectOptions(within(filterSidebar).getByRole('combobox', { name: 'Trạng thái' }), 'all')
  await userEvent.type(within(filterSidebar).getByLabelText('Từ ngày'), '01/06/2026')
  await userEvent.type(within(filterSidebar).getByLabelText('Đến ngày'), '31/07/2026')
  await userEvent.type(searchInput, '{Enter}')

  expect(service.listReceipts).toHaveBeenLastCalledWith({
    search: 'Nguyễn Phong',
    status: 'all',
    date_from: '2026-06-01',
    date_to: '2026-07-31',
    page: 1,
    page_size: 15,
  })
})

it('filters matching purchase receipts while typing without opening a suggestion dropdown', async () => {
  const suggestedReceipt = {
    ...receipt,
    id: 'receipt-suggested',
    code: 'PN000674',
    supplier: { id: 'supplier-1', code: 'NCC000031', name: 'Nguyá»…n Phong' },
    payable_amount: 240000,
  }
  const service = makeService({
    listReceipts: vi.fn(async (input = {}) => {
      if (input.search === 'PN000674') {
        return { items: [suggestedReceipt], page: 1, page_size: 15, total: 1 }
      }
      return { items: [receipt], page: 1, page_size: 15, total: 1 }
    }),
  })

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  const filterForm = screen.getByRole('search', { name: 'Lọc phiếu nhập' })
  const searchInput = within(filterForm).getByLabelText('Tìm phiếu/NCC')
  await userEvent.type(searchInput, 'PN000674')

  await waitFor(() => expect(service.listReceipts).toHaveBeenLastCalledWith({
    search: 'PN000674',
    status: 'posted',
    date_from: undefined,
    date_to: undefined,
    created_by: undefined,
    page: 1,
    page_size: 15,
  }))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(screen.getByText('PN000674')).toBeInTheDocument()
})

it('reactively filters purchase receipts by supplier invoice and creator fields that exist in the project', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  const filterSidebar = screen.getByRole('complementary', { name: 'Bộ lọc phiếu nhập' })

  expect(within(filterSidebar).getByRole('region', { name: 'Trạng thái' })).toBeInTheDocument()
  expect(within(filterSidebar).getByRole('region', { name: 'Thời gian' })).toBeInTheDocument()
  expect(within(filterSidebar).getByRole('region', { name: 'Người tạo' })).toBeInTheDocument()
  expect(within(filterSidebar).getByRole('region', { name: 'Số hóa đơn đầu vào' })).toBeInTheDocument()
  expect(within(filterSidebar).queryByRole('region', { name: 'Người nhập' })).not.toBeInTheDocument()

  await userEvent.type(within(filterSidebar).getByPlaceholderText('Theo số hóa đơn đầu vào'), 'HD-NCC-001')
  expect(service.listReceipts).toHaveBeenLastCalledWith({
    search: 'HD-NCC-001',
    status: 'posted',
    page: 1,
    page_size: 15,
  })

  await userEvent.selectOptions(within(filterSidebar).getByRole('combobox', { name: 'Người tạo' }), 'user-1')
  expect(within(filterSidebar).getByRole('option', { name: 'Nguyễn Thị Mai Phương' })).toHaveValue('user-1')
  expect(service.listReceipts).toHaveBeenLastCalledWith({
    search: 'HD-NCC-001',
    status: 'posted',
    created_by: 'user-1',
    page: 1,
    page_size: 15,
  })
})

it('uses purchase receipt quick time filters and exact PN search priority without a reset action', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  const filterForm = screen.getByRole('search', { name: 'Lọc phiếu nhập' })
  const filterSidebar = screen.getByRole('complementary', { name: 'Bộ lọc phiếu nhập' })
  await userEvent.click(within(filterSidebar).getByRole('button', { name: 'Toàn thời gian' }))
  await userEvent.click(within(filterSidebar).getByRole('button', { name: 'Hôm nay' }))

  expect(service.listReceipts).toHaveBeenLastCalledWith(
    expect.objectContaining({
      status: 'posted',
      date_from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      date_to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )

  await userEvent.type(within(filterForm).getByLabelText('Tìm phiếu/NCC'), 'NCC')
  await waitFor(() => expect(service.listReceipts).toHaveBeenCalledWith(expect.objectContaining({
    search: 'NCC',
    status: 'posted',
    page: 1,
    page_size: 15,
  })))
  await userEvent.clear(within(filterForm).getByLabelText('Tìm phiếu/NCC'))
  await userEvent.type(within(filterForm).getByLabelText('Tìm phiếu/NCC'), 'PN000673{Enter}')

  expect(service.listReceipts).toHaveBeenLastCalledWith({ search: 'PN000673', status: 'all', page: 1, page_size: 15 })
  expect(within(filterSidebar).queryByText(/Tìm: PN000673/)).not.toBeInTheDocument()
  expect(within(filterSidebar).queryByRole('button', { name: 'Đặt lại bộ lọc' })).not.toBeInTheDocument()
})

it('opens a single purchase receipt from route query and searches all statuses', async () => {
  const originalUrl = window.location.href
  window.history.pushState({}, '', '/purchase/receipts?search=PN000674')
  const service = makeService({
    listReceipts: vi.fn(async () => ({ items: [postedReceipt], page: 1, page_size: 15, total: 1 })),
    getReceipt: vi.fn(async () => postedReceipt),
  })

  try {
    render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

    await waitFor(() => expect(service.listReceipts).toHaveBeenCalledWith({
      search: 'PN000674',
      status: 'all',
      page: 1,
      page_size: 15,
    }))
    expect(screen.getByLabelText('Tìm phiếu/NCC')).toHaveValue('PN000674')
    expect(await screen.findByRole('region', { name: 'Chi tiết phiếu nhập PN000674' })).toBeInTheDocument()
    expect(service.getReceipt).toHaveBeenCalledWith('receipt-posted')
  } finally {
    window.history.pushState({}, '', originalUrl)
  }
})

it('opens purchase receipt create workspace from the plus action', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage currentUser={currentUser} service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo phiếu nhập' }))

  const workspace = await screen.findByRole('region', { name: 'Tạo phiếu nhập' })
  expect(workspace.querySelector('.purchase-receipt-workspace-form')).not.toBeNull()
  expect(workspace.closest('.management-list-surface')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Nhập hàng' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Quay lại danh sách phiếu nhập' })).toBeInTheDocument()
  expect(within(workspace).queryByRole('heading', { name: 'Nhập hàng' })).not.toBeInTheDocument()
  expect(within(workspace).queryByText('Tạo draft phiếu nhập')).not.toBeInTheDocument()
  expect(screen.queryByRole('search', { name: 'Lọc phiếu nhập' })).not.toBeInTheDocument()
  expect(workspace.querySelector('.purchase-receipt-workspace-header')).toBeNull()
  expect(within(workspace).queryByRole('textbox', { name: 'Tìm hàng nhập' })).not.toBeInTheDocument()
  expect(screen.getByRole('search', { name: 'Tìm hàng nhập' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tạo hàng hóa' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hàng hóa' }))
  expect(screen.getByRole('complementary', { name: 'Tạo hàng hóa' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Đóng tạo hàng hóa' }))

  const productSearch = screen.getByRole('textbox', { name: 'Tìm hàng (F3)' })
  await userEvent.keyboard('{F8}')
  expect(productSearch).toHaveFocus()
  await userEvent.type(productSearch, 'decal sua')
  expect(screen.getByRole('button', { name: 'Xóa tìm kiếm' })).toBeInTheDocument()
  expect(await screen.findByRole('listbox', { name: 'Kết quả tìm hàng' })).toHaveTextContent('SP0001 - Decal sữa')
  await userEvent.keyboard('{Enter}')
  expect(within(workspace).queryByLabelText('Sản phẩm dòng 1')).not.toBeInTheDocument()
  expect(within(workspace).getByRole('list', { name: 'Dòng hàng phiếu nhập mới' })).toHaveClass('pos-cart-lines')
  expect(within(workspace).getByLabelText('Cột dòng hàng nhập')).toHaveTextContent('STTMã hàngTên hàngĐVTSố lượngĐơn giáGiảm giáThành tiền')
  expect(within(workspace).getByText('Decal sữa')).toBeInTheDocument()
  expect(within(workspace).getByText('SP0001')).toBeInTheDocument()
  expect(within(workspace).getByLabelText('Đơn vị dòng 1')).toHaveValue('m')
  expect(within(workspace).getByLabelText('Số lượng dòng 1')).toHaveValue(1)
  expect(within(workspace).getByLabelText('Đơn giá dòng 1')).toHaveValue(85000)
  expect(screen.queryByRole('button', { name: 'Xóa tìm kiếm' })).not.toBeInTheDocument()
  expect(within(workspace).queryByRole('table', { name: 'Dòng hàng phiếu nhập mới' })).not.toBeInTheDocument()

  const form = within(workspace).getByRole('form', { name: 'Thông tin phiếu nhập' })
  expect(within(form).queryByLabelText('Nhà cung cấp')).not.toBeInTheDocument()
  expect(within(form).getByLabelText('Tài khoản')).toHaveValue('Nguyễn Thị Mai Phương')
  expect(within(form).getByLabelText('Mã phiếu nhập')).toHaveAttribute('placeholder', 'Mã phiếu tự động')
  expect(within(form).getByLabelText('Số hóa đơn đầu vào')).toBeInTheDocument()
  expect(within(form).getByText('Tổng tiền hàng')).toBeInTheDocument()
  expect(within(form).getByText('Tổng nợ')).toBeInTheDocument()

  expect(within(workspace).getByRole('button', { name: 'Lưu tạm' })).toBeInTheDocument()
  expect(within(workspace).getByRole('button', { name: 'Hoàn thành' })).toBeInTheDocument()
  expect(within(workspace).queryByRole('button', { name: 'In' })).not.toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'Danh sách phiếu nhập' })).not.toBeInTheDocument()
})

it('restores the in-progress purchase receipt create workspace after remounting', async () => {
  const service = makeService()

  const { unmount } = render(<PurchaseReceiptsPage currentUser={currentUser} service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo phiếu nhập' }))
  const form = await screen.findByRole('form', { name: 'Thông tin phiếu nhập' })
  await userEvent.type(within(form).getByLabelText('Số hóa đơn đầu vào'), 'HD-DANG-NHAP')
  await addProductToCreateReceipt('SP0001')
  await userEvent.clear(within(form).getByLabelText('Số lượng dòng 1'))
  await userEvent.type(within(form).getByLabelText('Số lượng dòng 1'), '3')

  await waitFor(() => {
    expect(window.localStorage.getItem(receiptCreateDraftStorageKey)).toContain('HD-DANG-NHAP')
    expect(window.localStorage.getItem(receiptCreateDraftStorageKey)).toContain('product-1')
  })

  unmount()

  render(<PurchaseReceiptsPage currentUser={currentUser} service={makeService()} onOpenDashboard={vi.fn()} />)

  const restoredWorkspace = await screen.findByRole('region', { name: 'Tạo phiếu nhập' })
  const restoredForm = within(restoredWorkspace).getByRole('form', { name: 'Thông tin phiếu nhập' })
  expect(screen.getByRole('heading', { name: 'Nhập hàng' })).toBeInTheDocument()
  expect(screen.queryByRole('search', { name: 'Lọc phiếu nhập' })).not.toBeInTheDocument()
  expect(within(restoredForm).getByLabelText('Số hóa đơn đầu vào')).toHaveValue('HD-DANG-NHAP')
  expect(within(restoredForm).getByText('SP0001')).toBeInTheDocument()
  expect(within(restoredForm).getByText('Decal sữa')).toBeInTheDocument()
  expect(within(restoredForm).getByLabelText('Số lượng dòng 1')).toHaveValue(3)
})

it('searches remote products by code when creating purchase receipts', async () => {
  const listProducts = vi.fn(async (input: { search?: string } = {}) => {
    if (input.search === 'NGD-01') {
      return { items: [remoteCodeProduct], page: 1, page_size: 20, total: 1 }
    }
    if (input.search) {
      return { items: [], page: 1, page_size: 20, total: 0 }
    }
    return { items: products, page: 1, page_size: 20, total: 3 }
  })
  const service = makeService({ listProducts })

  render(<PurchaseReceiptsPage currentUser={currentUser} service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  const createButton = document.querySelector<HTMLButtonElement>('.management-compact-create-action')
  expect(createButton).not.toBeNull()
  await userEvent.click(createButton as HTMLButtonElement)
  await waitFor(() => expect(document.querySelector('.purchase-receipt-workspace')).not.toBeNull())
  const workspace = document.querySelector<HTMLElement>('.purchase-receipt-workspace') as HTMLElement
  const productSearch = document.querySelector<HTMLInputElement>('.purchase-receipt-product-search-toolbar input') as HTMLInputElement
  expect(productSearch).not.toBeNull()

  await userEvent.type(productSearch, 'NGD-01')

  await waitFor(() => expect(listProducts).toHaveBeenCalledWith({
    status: 'active',
    search: 'NGD-01',
    page: 1,
    page_size: 20,
  }))
  expect(await screen.findByText(/NGD-01/)).toBeInTheDocument()
  await userEvent.keyboard('{Enter}')

  expect(within(workspace).getByText('NGD-01')).toBeInTheDocument()
})

it('creates a draft receipt for normal items with computed totals shown locally', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo phiếu nhập' }))
  const detail = await screen.findByRole('region', { name: 'Tạo phiếu nhập' })
  expect(detail).toBeInTheDocument()
  const form = screen.getByRole('form', { name: 'Thông tin phiếu nhập' })
  await userEvent.clear(within(form).getByLabelText('Thời gian nhập'))
  await userEvent.type(within(form).getByLabelText('Thời gian nhập'), '2026-07-01T10:00')
  await userEvent.type(within(form).getByLabelText('Số hóa đơn đầu vào'), 'HD-NCC-001')
  await addProductToCreateReceipt('SP0001')
  expect(within(form).getByLabelText('Đơn vị dòng 1')).toHaveAttribute('readonly')
  await userEvent.clear(within(form).getByLabelText('Số lượng dòng 1'))
  await userEvent.type(within(form).getByLabelText('Số lượng dòng 1'), '2')
  await userEvent.clear(within(form).getByLabelText('Đơn giá dòng 1'))
  await userEvent.type(within(form).getByLabelText('Đơn giá dòng 1'), '100000')
  await userEvent.clear(within(form).getByLabelText('Giảm giá dòng 1'))
  await userEvent.type(within(form).getByLabelText('Giảm giá dòng 1'), '10000')
  await userEvent.clear(within(form).getByLabelText('Giảm giá phiếu'))
  await userEvent.type(within(form).getByLabelText('Giảm giá phiếu'), '10000')
  await userEvent.clear(within(form).getByLabelText('Đã trả tạm'))
  await userEvent.type(within(form).getByLabelText('Đã trả tạm'), '50000')

  expect(within(form).getByText('Tổng tiền hàng')).toBeInTheDocument()
  expect(within(form).getByText('Tổng nợ')).toBeInTheDocument()
  expect(within(form).getAllByText('190 000').length).toBeGreaterThan(0)
  expect(within(form).getByText('130 000')).toBeInTheDocument()

  await userEvent.click(within(form).getByRole('button', { name: 'Lưu tạm' }))

  expect(service.createReceipt).toHaveBeenCalledWith({
    code: '',
    supplier_id: 'supplier-1',
    received_at: '2026-07-01T10:00',
    supplier_document_no: 'HD-NCC-001',
    notes: '',
    discount_amount: 10000,
    paid_amount: 50000,
    items: [
      {
        product_id: 'product-1',
        inventory_shape: 'normal',
        unit_name: 'm',
        quantity: 2,
        unit_cost: 100000,
        discount_amount: 10000,
        physical_payload: null,
      },
    ],
  })
})

it('creates a roll draft line from physical roll lengths without manual object codes', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo phiếu nhập' }))
  const form = await screen.findByRole('form', { name: 'Thông tin phiếu nhập' })
  await userEvent.clear(within(form).getByLabelText('Thời gian nhập'))
  await userEvent.type(within(form).getByLabelText('Thời gian nhập'), '2026-07-01T10:00')
  await addProductToCreateReceipt('SP0003')

  expect(within(form).queryByLabelText(/mã cuộn/i)).not.toBeInTheDocument()
  await userEvent.clear(within(form).getByLabelText('Khổ rộng cuộn dòng 1'))
  await userEvent.type(within(form).getByLabelText('Khổ rộng cuộn dòng 1'), '3.2')
  await userEvent.clear(within(form).getByLabelText('Chiều dài từng cuộn dòng 1'))
  await userEvent.type(within(form).getByLabelText('Chiều dài từng cuộn dòng 1'), '50, 50, 45')
  expect(within(form).getByLabelText('Số lượng dòng 1')).toHaveValue(3)
  expect(within(form).getByText('3 cuộn, khổ 3.2m, tổng 464.000 m²')).toBeInTheDocument()

  await userEvent.click(within(form).getByRole('button', { name: 'Lưu tạm' }))

  expect(service.createReceipt).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [
        expect.objectContaining({
          product_id: 'product-3',
          inventory_shape: 'roll',
          unit_name: 'cuộn',
          quantity: 3,
          physical_payload: { rolls: { width_m: 3.2, lengths_m: [50, 50, 45] } },
        }),
      ],
    }),
  )
})

it('creates a sheet draft line with multiple size groups', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo phiếu nhập' }))
  const form = await screen.findByRole('form', { name: 'Thông tin phiếu nhập' })
  await userEvent.clear(within(form).getByLabelText('Thời gian nhập'))
  await userEvent.type(within(form).getByLabelText('Thời gian nhập'), '2026-07-01T10:00')
  await addProductToCreateReceipt('SP0002')
  await userEvent.clear(within(form).getByLabelText('Rộng nhóm 1 dòng 1'))
  await userEvent.type(within(form).getByLabelText('Rộng nhóm 1 dòng 1'), '1.22')
  await userEvent.clear(within(form).getByLabelText('Dài nhóm 1 dòng 1'))
  await userEvent.type(within(form).getByLabelText('Dài nhóm 1 dòng 1'), '2.44')
  await userEvent.clear(within(form).getByLabelText('Số tấm nhóm 1 dòng 1'))
  await userEvent.type(within(form).getByLabelText('Số tấm nhóm 1 dòng 1'), '2')
  await userEvent.click(within(form).getByRole('button', { name: 'Thêm nhóm kích thước' }))
  await userEvent.clear(within(form).getByLabelText('Rộng nhóm 2 dòng 1'))
  await userEvent.type(within(form).getByLabelText('Rộng nhóm 2 dòng 1'), '1')
  await userEvent.clear(within(form).getByLabelText('Dài nhóm 2 dòng 1'))
  await userEvent.type(within(form).getByLabelText('Dài nhóm 2 dòng 1'), '2')
  expect(within(form).getByLabelText('Số lượng dòng 1')).toHaveValue(3)
  expect(within(form).getByText('3 tấm, 2 nhóm kích thước, tổng 7.954 m²')).toBeInTheDocument()

  await userEvent.click(within(form).getByRole('button', { name: 'Lưu tạm' }))

  expect(service.createReceipt).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [
        expect.objectContaining({
          product_id: 'product-2',
          inventory_shape: 'sheet',
          unit_name: 'tấm',
          quantity: 3,
          physical_payload: {
            sheet_groups: [
              { width_m: 1.22, length_m: 2.44, quantity: 2 },
              { width_m: 1, length_m: 2, quantity: 1 },
            ],
          },
        }),
      ],
    }),
  )
})

it('opens a draft receipt for editing and saves updated lines', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await openReceiptDetail()
  const form = screen.getByRole('form', { name: 'Thông tin phiếu nhập' })
  await userEvent.clear(within(form).getByLabelText('Ghi chú'))
  await userEvent.type(within(form).getByLabelText('Ghi chú'), 'Đã sửa')
  await userEvent.click(within(form).getByRole('button', { name: 'Lưu draft phiếu nhập' }))

  expect(service.getReceipt).toHaveBeenCalledWith('receipt-1')
  expect(service.updateReceipt).toHaveBeenCalledWith('receipt-1', expect.objectContaining({ notes: 'Đã sửa' }))
})

it('opens posted receipts as view-only details', async () => {
  const service = makeService({
    listReceipts: vi.fn(async () => ({ items: [postedReceipt], page: 1, page_size: 15, total: 1 })),
    getReceipt: vi.fn(async () => postedReceipt),
  })

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await openReceiptDetail('PN000674')
  const detail = screen.getByRole('region', { name: 'Chi tiết phiếu nhập PN000674' })
  const lineTable = within(detail).getByRole('table', { name: 'Dòng hàng phiếu nhập' })
  const note = within(detail).getByRole('textbox', { name: 'Ghi chú phiếu nhập' })

  expect(within(detail).queryByRole('heading', { name: 'Xem phiếu nhập' })).not.toBeInTheDocument()
  expect(within(detail).queryByRole('button', { name: 'Hoàn thành nhập hàng' })).not.toBeInTheDocument()
  expect(within(detail).queryByRole('button', { name: 'Tạo mới' })).not.toBeInTheDocument()
  expect(within(detail).queryByRole('button', { name: 'In tem nhãn' })).not.toBeInTheDocument()
  expect(within(detail).queryByRole('button', { name: 'Trả hàng nhập' })).not.toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'In' })).toBeInTheDocument()
  expect(within(detail).queryByRole('form', { name: 'Thông tin phiếu nhập' })).not.toBeInTheDocument()
  expect(note).toHaveClass('management-detail-note')
  expect(note).toHaveAttribute('readonly')
  expect(lineTable).toHaveClass('management-detail-table', 'management-detail-lines-table')
  expect(within(lineTable).getByRole('columnheader', { name: 'Số lượng' })).toBeInTheDocument()
  expect(within(lineTable).getByRole('columnheader', { name: 'Đơn vị' })).toBeInTheDocument()
  expect(within(lineTable).getByText('SP0001')).toBeInTheDocument()
  expect(within(lineTable).getByText('Decal sữa')).toBeInTheDocument()
  const itemRow = within(lineTable).getByText('SP0001').closest('tr') as HTMLElement
  expect(within(itemRow).getByText('2.00')).toBeInTheDocument()
  expect(within(itemRow).getByText('m')).toBeInTheDocument()
  expect(within(lineTable).queryByText('2.00 m')).not.toBeInTheDocument()
  expect(within(detail).getByText('Cần trả NCC')).toBeInTheDocument()
})

it('shows supplier payment history and pays remaining amount from posted receipt detail', async () => {
  const service = makeService({
    listReceipts: vi.fn(async () => ({ items: [postedReceipt], page: 1, page_size: 15, total: 1 })),
    getReceipt: vi.fn(async () => postedReceipt),
  })

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await openReceiptDetail('PN000674')
  const detail = screen.getByRole('region', { name: 'Chi tiết phiếu nhập PN000674' })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Lịch sử thanh toán' }))

  expect(within(detail).queryByRole('form', { name: 'Thông tin phiếu nhập' })).not.toBeInTheDocument()
  expect(within(detail).getByRole('region', { name: 'Lịch sử thanh toán NCC' })).toBeInTheDocument()
  expect(within(detail).getByText('PCPN000001')).toBeInTheDocument()
  expect(within(detail).getByText('Đã thanh toán')).toHaveClass('status-chip', 'status-chip-success')
  expect(within(detail).getByText('50 000')).toBeInTheDocument()
  await userEvent.click(within(detail).getByRole('button', { name: 'Thanh toán NCC' }))
  const paymentForm = screen.getByRole('form', { name: 'Thanh toán nhà cung cấp' })
  expect(within(paymentForm).getByText('PN000674')).toBeInTheDocument()
  expect(within(paymentForm).getByText('Còn nợ: 80 000')).toBeInTheDocument()
  await userEvent.selectOptions(within(paymentForm).getByLabelText('Phương thức trả NCC'), 'cash')
  await userEvent.click(within(paymentForm).getByRole('button', { name: 'Lưu thanh toán NCC' }))

  expect(service.paySupplier).toHaveBeenCalledWith('supplier-1', {
    payment_method: 'cash',
    allocations: [{ purchase_receipt_id: 'receipt-posted', amount: 80000 }],
  })
})

it('shows imported paid amount as a supplier payment history row', async () => {
  const importedPaidReceipt = {
    ...receipt,
    status: 'posted' as const,
    paid_amount: 50000,
    remaining_amount: 0,
    supplier_payments: [],
  }
  const service = makeService({
    listReceipts: vi.fn(async () => ({ items: [importedPaidReceipt], page: 1, page_size: 15, total: 1 })),
    getReceipt: vi.fn(async () => importedPaidReceipt),
  })

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await openReceiptDetail('PN000673')
  const detail = screen.getByRole('region', { name: 'Chi tiết phiếu nhập PN000673' })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Lịch sử thanh toán' }))

  const history = within(detail).getByRole('region', { name: 'Lịch sử thanh toán NCC' })
  expect(within(history).queryByText('Chưa có thanh toán NCC sau nhập.')).not.toBeInTheDocument()
  expect(within(history).getByText('PCPN000673')).toBeInTheDocument()
  expect(within(history).getByText('Chuyển khoản')).toBeInTheDocument()
  expect(within(history).getByText('Đã thanh toán')).toHaveClass('status-chip', 'status-chip-success')
  expect(within(history).getByText('50 000')).toBeInTheDocument()
})

it('hides payment history tab when posted receipt has no payment history', async () => {
  const unpaidPostedReceipt = {
    ...receipt,
    status: 'posted' as const,
    paid_amount: 0,
    remaining_amount: 180000,
    supplier_payments: [],
  }
  const service = makeService({
    listReceipts: vi.fn(async () => ({ items: [unpaidPostedReceipt], page: 1, page_size: 15, total: 1 })),
    getReceipt: vi.fn(async () => unpaidPostedReceipt),
  })

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await openReceiptDetail('PN000673')
  const detail = screen.getByRole('region', { name: 'Chi tiết phiếu nhập PN000673' })

  expect(within(detail).queryByRole('tab', { name: 'Lịch sử thanh toán' })).not.toBeInTheDocument()
  expect(within(detail).queryByRole('region', { name: 'Lịch sử thanh toán NCC' })).not.toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Thanh toán NCC' })).toBeInTheDocument()
})

it('warns on low purchase cost and posts with a selected bank account', async () => {
  const lowCostReceipt = {
    ...receipt,
    items: [{ ...receipt.items[0], unit_cost: 80000, line_amount: 150000 }],
  }
  const service = makeService({
    getReceipt: vi.fn(async () => lowCostReceipt),
  })

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await openReceiptDetail()
  const detail = screen.getByRole('region', { name: 'Chi tiết phiếu nhập PN000673' })
  const form = screen.getByRole('form', { name: 'Thông tin phiếu nhập' })

  expect(within(form).getByText(/thấp hơn giá nhập cuối/i)).toBeInTheDocument()
  await userEvent.selectOptions(within(form).getByLabelText('Phương thức trả ngay'), 'bank_transfer')
  await screen.findByText('VCB - Vietcombank')
  await userEvent.selectOptions(within(form).getByLabelText('Tài khoản chuyển khoản'), 'bank-1')
  await userEvent.click(within(detail).getByRole('button', { name: 'Hoàn thành nhập hàng' }))

  expect(service.postReceipt).toHaveBeenCalledWith('receipt-1', {
    payment_method: 'bank_transfer',
    finance_account_id: 'bank-1',
  })
})

it('opens KiotViet purchase receipt import and deletes old import data from the shared dialog', async () => {
  const service = makeService()

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  await userEvent.click(screen.getByRole('button', { name: 'Import' }))
  const dialog = screen.getByRole('dialog', { name: 'Import nhập hàng KiotViet' })

  expect(dialog).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa dữ liệu cũ' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }))

  expect(service.deleteImportedKiotVietPurchaseReceipts).toHaveBeenCalled()
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Đã xóa 1 dòng dữ liệu cũ.')
})

it('explains why purchase receipt import is disabled when supplier or product codes are missing', async () => {
  const service = makeService({
    previewKiotVietPurchaseReceiptImport: vi.fn(async () => ({
      summary: {
        total_rows: 2,
        valid_rows: 2,
        invalid_rows: 0,
        receipt_count: 1,
        create_rows: 1,
        update_rows: 0,
        item_rows: 2,
        missing_supplier_count: 1,
        missing_product_count: 2,
        payable_total: 2880000,
        paid_total: 2880000,
      },
      invalid_rows: [],
      missing_supplier_codes: ['NCC lẻ'],
      missing_product_codes: ['NGD', 'PP127'],
    })),
  })
  const file = new File([new Uint8Array([1, 2, 3])], 'DanhSachChiTietNhapHang.xlsx')

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('PN000673')
  await userEvent.click(screen.getByRole('button', { name: 'Import' }))
  const dialog = screen.getByRole('dialog', { name: 'Import nhập hàng KiotViet' })
  const input = within(dialog).getByLabelText('File KiotViet')
  await userEvent.upload(input, file)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Chưa thể import vì còn thiếu 1 mã NCC và 2 mã hàng.')
  expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled()
})

it('uses a denser purchase receipt page size on wide management screens', async () => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 2209,
  })
  const service = makeService({
    listReceipts: vi.fn(async (input = {}) => ({
      items: [receipt],
      page: 1,
      page_size: input.page_size ?? 15,
      total: 1,
    })),
  })

  render(<PurchaseReceiptsPage service={service} onOpenDashboard={vi.fn()} />)

  await waitFor(() => expect(service.listReceipts).toHaveBeenCalledWith(expect.objectContaining({
    status: 'posted',
    page: 1,
    page_size: 30,
  })))
  const footer = await screen.findByRole('navigation', { name: 'Phân trang phiếu nhập' })
  expect(within(footer).getByRole('combobox', { name: 'Số dòng hiển thị' })).toHaveValue('30')
})
