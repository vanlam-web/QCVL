import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach } from 'vitest'
import { SuppliersPage } from './SuppliersPage'
import type { SupplierService } from './supplier-service'

const customers = [
  { id: 'customer-1', code: 'KH000123', name: 'Nguyễn Phong', phone: '0909000000' },
]

const supplier = {
  id: 'supplier-1',
  code: 'NCC000031',
  name: 'Nguyễn Phong',
  phone: null,
  email: 'ncc@example.test',
  address: 'Quận 12',
  tax_code: '0312345678',
  linked_customer_id: 'customer-1',
  linked_customer: { id: 'customer-1', code: 'KH000123', name: 'Nguyễn Phong' },
  notes: 'NCC cũng là khách hàng',
  status: 'active' as const,
  current_payable_amount: 250000,
  total_purchase_amount: 300000,
  source_creator_name: 'Văn Lâm',
  created_at: '2026-07-08T03:00:00Z',
  supplier_group: { id: 'supplier-group-1', name: 'Nhóm vật tư' },
}

const inactiveSupplier = {
  ...supplier,
  id: 'supplier-2',
  code: 'NCC000032',
  name: 'NCC tạm ngưng',
  linked_customer_id: null,
  linked_customer: null,
  status: 'inactive' as const,
}

const payableReceipts = [
  {
    id: 'receipt-1',
    code: 'PN000673',
    supplier_document_no: 'HD-NCC-001',
    received_at: '2026-07-02T03:00:00 000Z',
    payable_amount: 300000,
    paid_amount: 0,
    remaining_amount: 300000,
    paid_after_post_amount: 50000,
    outstanding_amount: 250000,
  },
]

const supplierReceipts = [
  {
    id: 'receipt-1',
    code: 'PN000673',
    supplier_id: 'supplier-1',
    supplier: { id: 'supplier-1', code: 'NCC000031', name: 'Nguyễn Phong' },
    received_at: '2026-07-02T03:00:00 000Z',
    status: 'posted' as const,
    supplier_document_no: 'HD-NCC-001',
    subtotal_amount: 300000,
    discount_amount: 0,
    payable_amount: 300000,
    paid_amount: 50000,
    remaining_amount: 250000,
    notes: null,
    created_by: { id: 'user-1', name: 'Nguyễn Thị Mai Phương' },
    created_at: '2026-07-02T03:00:00 000Z',
    updated_at: '2026-07-02T03:00:00 000Z',
    items: [],
    supplier_payments: [],
  },
  {
    id: 'receipt-2',
    code: 'PN000674',
    supplier_id: 'supplier-1',
    supplier: { id: 'supplier-1', code: 'NCC000031', name: 'Nguyễn Phong' },
    received_at: '2026-07-03T03:00:00 000Z',
    status: 'posted' as const,
    supplier_document_no: 'HD-NCC-002',
    subtotal_amount: 100000,
    discount_amount: 0,
    payable_amount: 100000,
    paid_amount: 100000,
    remaining_amount: 0,
    notes: null,
    created_by: { id: 'user-1', name: 'Nguyễn Thị Mai Phương' },
    created_at: '2026-07-03T03:00:00 000Z',
    updated_at: '2026-07-03T03:00:00 000Z',
    items: [],
    supplier_payments: [],
  },
]

afterEach(() => {
  window.history.pushState({}, '', '/suppliers')
})

function makeService(overrides: Partial<SupplierService> = {}): SupplierService {
  return {
    listSuppliers: vi.fn(async () => ({ items: [supplier], page: 1, page_size: 15, total: 1 })),
    getSupplier: vi.fn(async () => supplier),
    listPurchaseReceipts: vi.fn(async () => ({ items: supplierReceipts, page: 1, page_size: 100, total: supplierReceipts.length })),
    createSupplier: vi.fn(async () => ({ ...supplier, id: 'supplier-2', code: 'NCC000001', phone: null })),
    updateSupplier: vi.fn(async () => ({ ...supplier, status: 'inactive' as const })),
    listCustomers: vi.fn(async () => ({ items: customers, page: 1, page_size: 20, total: 1 })),
    listPayableReceipts: vi.fn(async () => ({ items: payableReceipts })),
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
    paySupplier: vi.fn(async () => ({
      supplier_payment_id: 'payment-1',
      code: 'PCPN000001',
      amount: 250000,
      cashbook_voucher_id: 'voucher-1',
    })),
    previewKiotVietSupplierImport: vi.fn(),
    importKiotVietSuppliers: vi.fn(),
    deleteImportedKiotVietSuppliers: vi.fn(async () => ({ deleted_rows: 0, blocked_rows: 0 })),
    ...overrides,
  }
}

async function openSupplierDetail(code = 'NCC000031') {
  await userEvent.click(await screen.findByRole('button', { name: code }))
}

async function openSupplierPaymentFromDetail(code = 'NCC000031') {
  await openSupplierDetail(code)
  const detail = await screen.findByRole('region', { name: 'Hồ sơ và thanh toán nhà cung cấp' })
  await userEvent.click(within(detail).getByRole('button', { name: 'Thanh toán NCC' }))
}

async function openSupplierEditFromDetail(code = 'NCC000031') {
  await openSupplierDetail(code)
  const detail = await screen.findByRole('region', { name: 'Hồ sơ và thanh toán nhà cung cấp' })
  await userEvent.click(within(detail).getByRole('button', { name: 'Chỉnh sửa' }))
}

it('lists suppliers with payable and purchase totals without a linked customer list column', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  expect(screen.getByText('Đang tải nhà cung cấp...').closest('.management-main')).not.toBeNull()
  expect(await screen.findByRole('button', { name: 'NCC000031' })).toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveClass('management-page')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc nhà cung cấp' })
  expect(sidebar).toHaveClass('management-filter-sidebar')
  expect(within(sidebar).queryByRole('heading', { name: 'Bộ lọc' })).not.toBeInTheDocument()
  expect(sidebar.querySelector('.management-filter-summary')).toBeNull()
  expect(within(sidebar).queryByRole('button', { name: 'Đặt lại bộ lọc' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Danh sách nhà cung cấp' })).toHaveClass('management-list-surface')
  expect(screen.getByRole('search', { name: 'Lọc nhà cung cấp' }).closest('.management-page-header')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Lọc' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Trang chủ' })).not.toBeInTheDocument()
  expect(screen.getByText('Nguyễn Phong')).toBeInTheDocument()
  const table = screen.getByRole('table')
  expect(table.closest('.management-table-viewport')).not.toBeNull()
  expect(within(table).queryByText('KH000123 - Nguyễn Phong')).not.toBeInTheDocument()
  expect(within(table).getByText('250 000')).toBeInTheDocument()
  expect(within(table).getByText('300 000')).toBeInTheDocument()
  expect(within(table).queryByRole('columnheader', { name: 'Nhóm NCC' })).not.toBeInTheDocument()
  expect(within(table).queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument()
  expect(within(table).queryByRole('columnheader', { name: 'Khách hàng liên kết' })).not.toBeInTheDocument()
  const headers = Array.from(table.querySelectorAll('th')).map((header) => header.textContent?.trim())
  expect(headers).not.toContain('Thao tác')
  expect(headers).not.toContain('Nhóm NCC')
  expect(headers).not.toContain('Email')
  const firstDataRow = table.querySelector('tbody tr')
  const firstRowCells = Array.from(firstDataRow?.querySelectorAll('td') ?? []).map((cell) => cell.textContent?.trim())
  expect(firstRowCells[5]).toContain('Đang hoạt động')
  expect(within(firstDataRow as HTMLElement).getByLabelText('Có liên kết khách hàng')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Phân trang nhà cung cấp' })).toHaveClass('management-table-footer')
  expect(screen.queryByRole('form', { name: 'Thông tin nhà cung cấp' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tạo nhà cung cấp' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sửa NCC000031' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thanh toán NCC000031' })).not.toBeInTheDocument()
  expect(service.listCustomers).not.toHaveBeenCalled()
  expect(service.listFinanceAccounts).not.toHaveBeenCalled()
})

it('opens supplier detail directly from record link query without using visible search', async () => {
  window.history.pushState({}, '', '/suppliers?open=NCC000031')
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  const detail = await screen.findByRole('region', { name: 'Hồ sơ và thanh toán nhà cung cấp' })
  expect(within(detail).getByRole('heading', { name: 'Nguyễn Phong' })).toBeInTheDocument()
  expect(screen.getByLabelText('Tìm NCC')).toHaveValue('')
  expect(service.listSuppliers).toHaveBeenCalledWith(expect.objectContaining({ search: 'NCC000031' }))
})

it('summarizes supplier validation state with scan-friendly KPI cards and panels', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByRole('button', { name: 'NCC000031' })
  const summary = screen.getByRole('region', { name: 'Tổng quan nhà cung cấp' })
  expect(summary.closest('.management-filter-column')).not.toBeNull()
  expect(summary.closest('.management-page-header')).toBeNull()
  expect(within(summary).queryByText('Tổng NCC')).not.toBeInTheDocument()
  expect(within(summary).getByText('Nợ cần trả')).toBeInTheDocument()
  expect(within(summary).getByText('Tổng mua')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Danh sách nhà cung cấp' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Hồ sơ và thanh toán nhà cung cấp' })).not.toBeInTheDocument()
})

it('filters suppliers by search and status', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByRole('button', { name: 'NCC000031' })
  const filterForm = screen.getByRole('search', { name: 'Lọc nhà cung cấp' })
  const searchInput = within(filterForm).getByLabelText('Tìm NCC')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc nhà cung cấp' })
  await userEvent.type(searchInput, 'Nguyen')
  await userEvent.selectOptions(within(sidebar).getByRole('combobox', { name: 'Trạng thái' }), 'all')

  await waitFor(() => expect(service.listSuppliers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: 'Nguyen',
    status: 'all',
  }))
  expect(screen.queryByText('Tìm: Nguyen')).not.toBeInTheDocument()
})

it('uses supplier sidebar filters without a reset action', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByRole('button', { name: 'NCC000031' })
  const filterForm = screen.getByRole('search', { name: 'Lọc nhà cung cấp' })
  const searchInput = within(filterForm).getByLabelText('Tìm NCC')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc nhà cung cấp' })
  await userEvent.type(searchInput, 'NCC000031')
  await userEvent.selectOptions(within(sidebar).getByRole('combobox', { name: 'Trạng thái' }), 'inactive')

  await waitFor(() => expect(service.listSuppliers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: 'NCC000031',
    status: 'inactive',
  }))
  expect(screen.queryByText('Tìm: NCC000031')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đặt lại bộ lọc' })).not.toBeInTheDocument()
})

it('reactively filters suppliers by payable, purchase totals, and status in the shared sidebar', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByRole('button', { name: 'NCC000031' })
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc nhà cung cấp' })

  expect(within(sidebar).queryByRole('region', { name: 'Nhóm nhà cung cấp' })).not.toBeInTheDocument()
  expect(within(sidebar).queryByRole('region', { name: 'Thời gian' })).not.toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Tổng mua' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Nợ hiện tại' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Trạng thái' })).toBeInTheDocument()

  await userEvent.type(within(sidebar).getByLabelText('Tổng mua từ'), '100000')
  expect(service.listSuppliers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'active',
    total_purchase_min: 100000,
  })

  await userEvent.type(within(sidebar).getByLabelText('Nợ hiện tại tới'), '500000')
  expect(service.listSuppliers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'active',
    total_purchase_min: 100000,
    current_payable_max: 500000,
  })

  await userEvent.selectOptions(within(sidebar).getByRole('combobox', { name: 'Trạng thái' }), 'all')
  expect(service.listSuppliers).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'all',
    total_purchase_min: 100000,
    current_payable_max: 500000,
  })
})

it('uses 15-row pagination range and navigates pages through the list footer', async () => {
  const service = makeService({
    listSuppliers: vi.fn(async (input = {}) => ({
      items: [supplier],
      page: input.page ?? 1,
      page_size: input.page_size ?? 15,
      total: 16,
    })),
  })

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByRole('button', { name: 'NCC000031' })
  const footer = screen.getByRole('navigation', { name: 'Phân trang nhà cung cấp' })
  expect(within(footer).getByText('1 - 15 trong 16 nhà cung cấp')).toBeInTheDocument()
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('1')

  await userEvent.click(within(footer).getByRole('button', { name: 'Trang sau' }))

  expect(service.listSuppliers).toHaveBeenLastCalledWith({ page: 2, page_size: 15, search: undefined, status: 'active' })
})

it('creates supplier with blank phone and selected linked customer', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByRole('button', { name: 'NCC000031' })
  await userEvent.click(screen.getByRole('button', { name: 'Tạo nhà cung cấp' }))
  expect(screen.queryByRole('region', { name: 'Hồ sơ và thanh toán nhà cung cấp' })).not.toBeInTheDocument()
  const form = await screen.findByRole('form', { name: 'Thông tin nhà cung cấp' })
  expect(form.closest('.management-list-surface')).not.toBeNull()
  await userEvent.type(within(form).getByLabelText('Tên NCC'), 'NCC mới')
  await userEvent.type(within(form).getByLabelText('Địa chỉ'), 'Quận 1')
  await userEvent.selectOptions(within(form).getByLabelText('Khách hàng liên kết'), 'customer-1')
  await userEvent.click(within(form).getByRole('button', { name: 'Lưu nhà cung cấp' }))

  expect(service.createSupplier).toHaveBeenCalledWith({
    code: '',
    name: 'NCC mới',
    phone: '',
    email: '',
    address: 'Quận 1',
    tax_code: '',
    linked_customer_id: 'customer-1',
    notes: '',
    status: 'active',
  })
})

it('opens supplier detail in view mode before editing and saves inactive status', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await openSupplierDetail()
  const detail = screen.getByRole('region', { name: 'Hồ sơ và thanh toán nhà cung cấp' })
  expect(detail).not.toHaveClass('management-detail-panel')
  expect(detail.querySelector('.management-detail-panel')).not.toBeNull()
  expect(within(detail).getByRole('button', { name: 'Chỉnh sửa' })).toBeInTheDocument()
  expect(within(detail).queryByRole('form', { name: 'Thông tin nhà cung cấp' })).not.toBeInTheDocument()
  expect(within(detail).getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
  expect(within(detail).getByRole('tab', { name: 'Lịch sử NCC này' })).toBeInTheDocument()
  expect(within(detail).getByRole('tab', { name: 'Nợ NCC này' })).toBeInTheDocument()
  expect(within(detail).queryByRole('heading', { name: 'Thông tin nhà cung cấp' })).not.toBeInTheDocument()
  const detailSummary = within(detail).getByRole('group', { name: 'Tóm tắt nhà cung cấp' })
  expect(detailSummary).toHaveClass('management-detail-summary')
  expect(within(detailSummary).getByText('Người tạo:').parentElement).toHaveTextContent('Người tạo: Văn Lâm')
  expect(within(detailSummary).getByText('Ngày tạo:').parentElement).toHaveTextContent('Ngày tạo: 08/07/2026')
  expect(within(detailSummary).getByText('Nhóm nhà cung cấp:').parentElement).toHaveTextContent('Nhóm nhà cung cấp: Nhóm vật tư')
  const metaLabels = Array.from(detailSummary.querySelectorAll('.management-detail-meta-label')).map((element) => element.textContent)
  expect(metaLabels).toEqual(['Người tạo:', 'Ngày tạo:', 'Nhóm nhà cung cấp:'])
  const linkedCard = within(detail).getByRole('region', { name: 'Khách hàng đồng thời là Nhà cung cấp' })
  expect(linkedCard).toHaveTextContent('Khách hàng liên kết')
  expect(linkedCard).toHaveTextContent('KH000123 - Nguyễn Phong')
  expect(linkedCard).toHaveTextContent('Gộp khách hàng')
  const infoPanel = within(detail).getByRole('tabpanel', { name: 'Thông tin nhanh nhà cung cấp' })
  const infoGrid = infoPanel.querySelector('dl')
  expect(infoGrid).toHaveClass('management-detail-meta-grid', 'management-detail-meta-grid-three')
  expect(within(infoPanel).getByText('Điện thoại')).toBeInTheDocument()
  expect(within(infoPanel).getByText('Email')).toBeInTheDocument()
  expect(within(infoPanel).getByText('MST')).toBeInTheDocument()
  expect(within(infoPanel).getByText('Địa chỉ')).toBeInTheDocument()
  expect(infoGrid?.querySelectorAll('dt')).toHaveLength(4)
  const note = within(infoPanel).getByText('NCC cũng là khách hàng').closest('.management-detail-inline-note')
  expect(note).not.toBeNull()
  expect(note).toHaveTextContent('NCC cũng là khách hàng')
  expect(note?.querySelector('svg')).not.toBeNull()
  await userEvent.click(within(detail).getByRole('tab', { name: 'Lịch sử NCC này' }))
  const historyPanel = within(detail).getByRole('tabpanel', { name: 'Lịch sử nhập/trả hàng của NCC này' })
  const historyTable = within(historyPanel).getByRole('table', { name: 'Lịch sử nhập hàng của NCC này' })
  expect(historyTable).toHaveClass('management-detail-table', 'management-detail-linked-table')
  expect(within(historyTable).getByRole('columnheader', { name: 'Người tạo' })).toBeInTheDocument()
  expect(within(historyTable).getByRole('columnheader', { name: 'Tổng cộng' })).toBeInTheDocument()
  expect(within(historyTable).getByText('PN000673')).toBeInTheDocument()
  expect(within(historyTable).getByText('PN000674')).toBeInTheDocument()
  expect(within(historyTable).getAllByText('Nguyễn Thị Mai Phương')).toHaveLength(2)
  expect(within(historyTable).queryByRole('columnheader', { name: 'Cần trả' })).not.toBeInTheDocument()
  expect(within(historyTable).queryByRole('columnheader', { name: 'Còn nợ' })).not.toBeInTheDocument()
  await userEvent.click(within(detail).getByRole('tab', { name: 'Nợ NCC này' }))
  const debtPanel = within(detail).getByRole('tabpanel', { name: 'Nợ cần trả của NCC này' })
  const debtTable = within(debtPanel).getByRole('table', { name: 'Danh sách phiếu nợ của NCC này' })
  expect(debtTable).toHaveClass('management-detail-table', 'management-detail-linked-table')
  expect(within(debtTable).getByRole('columnheader', { name: 'Người tạo' })).toBeInTheDocument()
  expect(within(debtTable).getByRole('columnheader', { name: 'Tổng cộng' })).toBeInTheDocument()
  expect(within(debtTable).getByText('PN000673')).toBeInTheDocument()
  expect(within(debtTable).queryByText('PN000674')).not.toBeInTheDocument()
  expect(within(debtTable).queryByRole('columnheader', { name: 'Cần trả' })).not.toBeInTheDocument()
  expect(within(debtTable).queryByRole('columnheader', { name: 'Còn nợ' })).not.toBeInTheDocument()
  expect(within(debtPanel).getAllByText('250 000').length).toBeGreaterThan(0)
  await userEvent.click(within(detail).getByRole('button', { name: 'Chỉnh sửa' }))
  const form = await screen.findByRole('form', { name: 'Thông tin nhà cung cấp' })
  expect(form.closest('tr')).toHaveClass('management-detail-row')
  expect(form.closest('tr')?.previousElementSibling).toHaveClass('management-data-row-selected')
  await userEvent.selectOptions(within(form).getByLabelText('Trạng thái NCC'), 'inactive')
  await userEvent.click(within(form).getByRole('button', { name: 'Lưu nhà cung cấp' }))

  expect(service.getSupplier).toHaveBeenCalledWith('supplier-1')
  expect(service.listPurchaseReceipts).toHaveBeenCalledWith(expect.objectContaining({ id: 'supplier-1', code: 'NCC000031' }))
  expect(service.updateSupplier).toHaveBeenCalledWith('supplier-1', expect.objectContaining({ status: 'inactive' }))
})

it('closes supplier detail when clicking the selected supplier row again', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await openSupplierDetail()
  expect(await screen.findByText('NCC cũng là khách hàng')).toBeInTheDocument()

  await openSupplierDetail()

  expect(screen.queryByText('NCC cũng là khách hàng')).not.toBeInTheDocument()
  expect(service.getSupplier).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'NCC000031' }).closest('tr')).not.toHaveClass('management-data-row-selected')
})

it('clears supplier payment draft when closing the selected row', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await openSupplierPaymentFromDetail()
  expect(await screen.findByRole('button', { name: 'Lưu thanh toán NCC' })).toBeInTheDocument()

  await openSupplierDetail()

  expect(screen.queryByRole('button', { name: 'Lưu thanh toán NCC' })).not.toBeInTheDocument()
  expect(screen.getByText('NCC cũng là khách hàng')).toBeInTheDocument()
})

it('shows history and debt only for the current supplier', async () => {
  const foreignReceipt = {
    id: 'receipt-foreign',
    code: 'PN999999',
    supplier_id: 'supplier-2',
    supplier: { id: 'supplier-2', code: 'NCC000032', name: 'NCC tạm ngưng' },
    received_at: '2026-07-04T03:00:00Z',
    status: 'posted' as const,
    supplier_document_no: 'HD-OTHER-001',
    subtotal_amount: 123000,
    discount_amount: 0,
    payable_amount: 123000,
    paid_amount: 0,
    remaining_amount: 123000,
    notes: null,
    created_by: { id: 'user-1', name: 'Nguyễn Thị Mai Phương' },
    created_at: '2026-07-04T03:00:00Z',
    updated_at: '2026-07-04T03:00:00Z',
    items: [],
    supplier_payments: [],
  }
  const service = makeService({
    listPurchaseReceipts: vi.fn(async () => ({
      items: [...supplierReceipts, foreignReceipt],
      page: 1,
      page_size: 100,
      total: supplierReceipts.length + 1,
    })),
  })

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await openSupplierDetail()
  const detail = screen.getByRole('region', { name: 'Hồ sơ và thanh toán nhà cung cấp' })

  await userEvent.click(within(detail).getByRole('tab', { name: 'Lịch sử NCC này' }))
  const historyPanel = within(detail).getByRole('tabpanel', { name: 'Lịch sử nhập/trả hàng của NCC này' })
  expect(within(historyPanel).getByText('PN000673')).toBeInTheDocument()
  expect(within(historyPanel).queryByText('PN999999')).not.toBeInTheDocument()

  await userEvent.click(within(detail).getByRole('tab', { name: 'Nợ NCC này' }))
  const debtPanel = within(detail).getByRole('tabpanel', { name: 'Nợ cần trả của NCC này' })
  expect(within(debtPanel).getByText('PN000673')).toBeInTheDocument()
  expect(within(debtPanel).queryByText('PN999999')).not.toBeInTheDocument()
})

it('clears stale supplier edit detail when switching rows fails', async () => {
  const service = makeService({
    listSuppliers: vi.fn(async () => ({ items: [supplier, inactiveSupplier], page: 1, page_size: 15, total: 2 })),
    getSupplier: vi.fn(async (id) => {
      if (id === 'supplier-2') throw new Error('detail failed')
      return supplier
    }),
  })

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await openSupplierEditFromDetail()
  expect(screen.getByRole('form', { name: 'Thông tin nhà cung cấp' })).toBeInTheDocument()

  await openSupplierDetail('NCC000032')

  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được chi tiết nhà cung cấp.')
  expect(screen.queryByRole('form', { name: 'Thông tin nhà cung cấp' })).not.toBeInTheDocument()
})

it('opens supplier payment form from payable supplier and submits explicit receipt allocation', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await openSupplierPaymentFromDetail()
  const form = screen.getByRole('form', { name: 'Thanh toán nhà cung cấp' })
  expect(form.closest('.management-detail-panel')).not.toBeNull()

  expect(service.listPayableReceipts).toHaveBeenCalledWith('supplier-1')
  expect(within(form).getByText('PN000673')).toBeInTheDocument()
  expect(within(form).getByText('Còn nợ: 250 000')).toBeInTheDocument()
  await userEvent.clear(within(form).getByLabelText('Số tiền trả cho PN000673'))
  await userEvent.type(within(form).getByLabelText('Số tiền trả cho PN000673'), '250000')
  await userEvent.selectOptions(within(form).getByLabelText('Phương thức trả NCC'), 'bank_transfer')
  await screen.findByText('VCB - Vietcombank')
  await userEvent.selectOptions(within(form).getByLabelText('Tài khoản chuyển khoản NCC'), 'bank-1')
  await userEvent.type(within(form).getByLabelText('Ghi chú thanh toán'), 'Thanh toán NCC')
  await userEvent.click(within(form).getByRole('button', { name: 'Lưu thanh toán NCC' }))

  expect(service.paySupplier).toHaveBeenCalledWith('supplier-1', {
    payment_method: 'bank_transfer',
    finance_account_id: 'bank-1',
    note: 'Thanh toán NCC',
    allocations: [{ purchase_receipt_id: 'receipt-1', amount: 250000 }],
  })
})

it('clears stale supplier payment detail when switching rows fails', async () => {
  const service = makeService({
    listSuppliers: vi.fn(async () => ({ items: [supplier, inactiveSupplier], page: 1, page_size: 15, total: 2 })),
    getSupplier: vi.fn(async (id) => (id === 'supplier-2' ? inactiveSupplier : supplier)),
    listPayableReceipts: vi.fn(async (id) => {
      if (id === 'supplier-2') throw new Error('payable failed')
      return { items: payableReceipts }
    }),
  })

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await openSupplierPaymentFromDetail()
  expect(screen.getByRole('form', { name: 'Thanh toán nhà cung cấp' })).toBeInTheDocument()

  await openSupplierPaymentFromDetail('NCC000032')

  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được phiếu nhập còn nợ.')
  expect(screen.queryByRole('form', { name: 'Thanh toán nhà cung cấp' })).not.toBeInTheDocument()
})

it('blocks supplier payment over selected receipt outstanding amount in UI', async () => {
  const service = makeService()

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await openSupplierPaymentFromDetail()
  const form = screen.getByRole('form', { name: 'Thanh toán nhà cung cấp' })
  await userEvent.clear(within(form).getByLabelText('Số tiền trả cho PN000673'))
  await userEvent.type(within(form).getByLabelText('Số tiền trả cho PN000673'), '260000')
  await userEvent.click(within(form).getByRole('button', { name: 'Lưu thanh toán NCC' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Không được trả vượt số còn nợ của phiếu nhập.')
  expect(service.paySupplier).not.toHaveBeenCalled()
})

it('uses a denser supplier page size on wide management screens', async () => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 2209,
  })
  const service = makeService({
    listSuppliers: vi.fn(async (input = {}) => ({
      items: [supplier],
      page: 1,
      page_size: input.page_size ?? 15,
      total: 1,
    })),
  })

  render(<SuppliersPage service={service} onOpenDashboard={vi.fn()} />)

  await waitFor(() => expect(service.listSuppliers).toHaveBeenCalledWith(expect.objectContaining({
    status: 'active',
    page: 1,
    page_size: 30,
  })))
  const footer = await screen.findByRole('navigation', { name: 'Phân trang nhà cung cấp' })
  expect(within(footer).getByRole('combobox', { name: 'Số dòng hiển thị' })).toHaveValue('30')
})


