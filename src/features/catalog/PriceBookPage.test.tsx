import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PriceBookPage } from './PriceBookPage'
import type { CatalogService } from './catalog-service'

function makeService(overrides: Partial<CatalogService> = {}): CatalogService {
  return {
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-1',
          code: 'MICA-3MM',
          name: 'Mica 3mm',
          status: 'active' as const,
          unit_name: 'm',
          sell_method: 'linear_m' as const,
          latest_purchase_cost: 100000,
          default_sale_price: 150000,
          price_list_prices: { 'pl-default': 150000, 'pl-25': 125000 },
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    })),
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
    listCustomers: vi.fn(async () => ({ items: [], page: 1, page_size: 20, total: 0 })),
    listCustomerGroups: vi.fn(async () => ({ items: [] })),
    previewKiotVietCustomerImport: vi.fn(),
    importKiotVietCustomers: vi.fn(),
    deleteImportedKiotVietCustomers: vi.fn(async () => ({ deleted_rows: 0, blocked_rows: 0 })),
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    resolvePrices: vi.fn(async () => ({ items: [] })),
    listPriceLists: vi.fn(async () => ({
      items: [
        { id: 'pl-default', code: 'DEFAULT', name: 'Bảng giá chung', is_default: true, is_active: true },
        { id: 'pl-25', code: '25', name: '25', is_default: false, is_active: true },
      ],
    })),
    previewPriceFormula: vi.fn(async () => ({
      affected_count: 1,
      items: [
        {
          product_id: 'p-1',
          product_code: 'MICA-3MM',
          product_name: 'Mica 3mm',
          latest_purchase_cost: 100000,
          current_mode: 'manual' as const,
          current_unit_price: 120000,
          computed_prices: [
            {
              price_list_id: 'pl-default',
              price_list_name: 'Bảng giá chung',
              current_unit_price: 120000,
              computed_unit_price: 150000,
              delta: 30000,
            },
            {
              price_list_id: 'pl-25',
              price_list_name: '25',
              current_unit_price: null,
              computed_unit_price: 150000,
              delta: null,
            },
          ],
        },
      ],
    })),
    applyPriceFormula: vi.fn(async () => ({ formula_rule_id: 'rule-1', affected_count: 1 })),
    ...overrides,
  }
}

it('renders the price book as a separate grid-first workspace', async () => {
  const service = makeService()
  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  expect(screen.getByText('Đang tải bảng giá...')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { level: 1, name: 'Bảng giá' })).toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveClass('management-page')
  expect(screen.queryByRole('form', { name: 'Tạo hàng hóa' })).not.toBeInTheDocument()

  const searchForm = screen.getByRole('search', { name: 'Tìm bảng giá' })
  expect(searchForm.closest('.management-page-header')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Tìm' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Trang chủ' })).not.toBeInTheDocument()
  const filterForm = screen.getByRole('form', { name: 'Lọc bảng giá' })
  expect(filterForm.closest('.management-filter-sidebar')).not.toBeNull()
  const filterSidebar = screen.getByRole('complementary', { name: 'Bộ lọc bảng giá' })
  expect(filterForm).toHaveClass('management-filter-sidebar-form')
  expect(within(filterSidebar).queryByRole('button', { name: 'Áp dụng bộ lọc' })).not.toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Phân trang bảng giá' })).toHaveTextContent('1 - 1 trong 1 hàng hóa')
  await userEvent.type(within(searchForm).getByLabelText('Tìm bảng giá'), 'MICA')
  await waitFor(() => expect(service.listProducts).toHaveBeenCalledWith({
    page: 1,
    page_size: 20,
    search: 'MICA',
    status: 'active',
  }))

  const grid = await screen.findByRole('table', { name: 'Lưới bảng giá' })
  expect(grid).toHaveClass('management-table')
  expect(grid.closest('.management-table-viewport')).not.toBeNull()
  const header = within(grid).getByRole('row', {
    name: 'Mã hàng Tên hàng Giá nhập cuối Giá chung Cách bán',
  })
  expect(header).toBeInTheDocument()
  expect(within(grid).getByRole('cell', { name: '150 000' })).toBeInTheDocument()
  expect(within(grid).queryByRole('columnheader', { name: '25' })).not.toBeInTheDocument()
  expect(service.listProducts).toHaveBeenCalledWith({ status: 'active', page: 1, page_size: 15 })
  expect(service.listPriceLists).toHaveBeenCalled()
})

it('applies the status filter immediately without an apply action', async () => {
  const service = makeService()
  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByRole('table', { name: 'Lưới bảng giá' })

  await userEvent.click(screen.getByLabelText('Ngưng bán'))

  await waitFor(() => expect(service.listProducts).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 20,
    search: undefined,
    status: 'inactive',
  }))

  await userEvent.click(screen.getByLabelText('Đã xoá KV'))

  await waitFor(() => expect(service.listProducts).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 20,
    search: undefined,
    status: 'deleted',
  }))
})

it('filters the price book by product group from a KV-style checkbox picker', async () => {
  const service = makeService({
    listProductGroups: vi.fn(async () => ({
      items: [
        { id: 'pg-mica', code: 'MICA', name: 'Mica', is_default: false, is_active: true },
        { id: 'pg-decal', code: 'DECAL', name: 'Decal', is_default: false, is_active: true },
      ],
    })),
  })
  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByRole('table', { name: 'Lưới bảng giá' })

  const filterSidebar = screen.getByRole('complementary', { name: 'Bộ lọc bảng giá' })
  expect(within(filterSidebar).queryByRole('combobox', { name: 'Nhóm hàng' })).not.toBeInTheDocument()
  await userEvent.click(within(filterSidebar).getByRole('textbox', { name: 'Tất cả nhóm hàng' }))
  const picker = within(filterSidebar).getByRole('dialog', { name: 'Chọn nhóm hàng' })
  expect(picker).toHaveClass('management-filter-product-group-popover')
  await userEvent.type(within(picker).getByRole('textbox', { name: 'Tìm nhóm hàng' }), 'mica')
  expect(within(picker).queryByRole('checkbox', { name: 'Decal' })).not.toBeInTheDocument()
  await userEvent.click(within(picker).getByRole('checkbox', { name: 'Mica' }))
  expect(within(picker).getByRole('button', { name: 'Chọn tất cả' })).toBeInTheDocument()
  await userEvent.click(within(picker).getByRole('button', { name: 'Áp dụng' }))
  expect(within(filterSidebar).getByText('Mica')).toHaveClass('management-chip-picker-chip')

  await waitFor(() => expect(service.listProducts).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 20,
    product_group_id: ['pg-mica'],
    search: undefined,
    status: 'active',
  }))
})

it('adds price list columns from the reusable chip picker', async () => {
  const service = makeService()
  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  const grid = await screen.findByRole('table', { name: 'Lưới bảng giá' })
  expect(within(grid).queryByRole('columnheader', { name: '25' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mở Chọn bảng giá' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('textbox', { name: 'Chọn bảng giá' }))
  await userEvent.click(screen.getByRole('option', { name: '25' }))

  expect(within(grid).getByRole('columnheader', { name: '25' })).toBeInTheDocument()
  expect(within(grid).getByRole('cell', { name: '125 000' })).toBeInTheDocument()
})

it('starts with the default price list selected but lets users remove it', async () => {
  const service = makeService()
  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  const grid = await screen.findByRole('table', { name: 'Lưới bảng giá' })
  expect(within(grid).getByRole('columnheader', { name: 'Giá chung' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Bỏ Giá chung' }))

  expect(within(grid).queryByRole('columnheader', { name: 'Giá chung' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('textbox', { name: 'Chọn bảng giá' }))
  await userEvent.click(screen.getByRole('option', { name: 'Giá chung' }))

  expect(within(grid).getByRole('columnheader', { name: 'Giá chung' })).toBeInTheDocument()
})

it('sorts price book rows from shared column headers', async () => {
  const service = makeService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-2',
          code: 'KEO',
          name: 'Keo dÃ¡n',
          status: 'active' as const,
          unit_name: 'chai',
          sell_method: 'quantity' as const,
          latest_purchase_cost: 20000,
        },
        {
          id: 'p-1',
          code: 'MICA-3MM',
          name: 'Mica 3mm',
          status: 'active' as const,
          unit_name: 'm',
          sell_method: 'linear_m' as const,
          latest_purchase_cost: 100000,
          default_sale_price: 150000,
          price_list_prices: { 'pl-default': 150000, 'pl-25': 125000 },
        },
      ],
      page: 1,
      page_size: 20,
      total: 2,
    })),
  })
  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  const grid = await screen.findByRole('table', { name: 'Lưới bảng giá' })
  const rowsBeforeSort = within(grid).getAllByRole('row')
  expect(rowsBeforeSort[1]).toHaveTextContent('KEO')

  await userEvent.click(within(grid).getByRole('button', { name: 'Giá nhập cuối' }))

  const rowsAfterCostSort = within(grid).getAllByRole('row')
  expect(rowsAfterCostSort[1]).toHaveTextContent('MICA-3MM')
  expect(within(grid).getByRole('columnheader', { name: 'Giá nhập cuối' })).toHaveAttribute('aria-sort', 'descending')
})

it('sorts price book rows by code by default instead of latest edit time', async () => {
  const service = makeService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-old',
          code: 'OLD',
          name: 'Hàng cũ',
          status: 'active' as const,
          unit_name: 'cái',
          sell_method: 'quantity' as const,
          latest_purchase_cost: 10000,
          created_at: '2026-07-01T08:00:00.000Z',
          updated_at: '2026-07-01T08:00:00.000Z',
        },
        {
          id: 'p-created',
          code: 'NEW',
          name: 'Hàng mới tạo',
          status: 'active' as const,
          unit_name: 'cái',
          sell_method: 'quantity' as const,
          latest_purchase_cost: 20000,
          created_at: '2026-07-15T08:00:00.000Z',
          updated_at: null,
        },
        {
          id: 'p-updated',
          code: 'EDIT',
          name: 'Hàng mới sửa',
          status: 'active' as const,
          unit_name: 'cái',
          sell_method: 'quantity' as const,
          latest_purchase_cost: 30000,
          created_at: '2026-07-02T08:00:00.000Z',
          updated_at: '2026-07-16T08:00:00.000Z',
        },
      ],
      page: 1,
      page_size: 20,
      total: 3,
    })),
  })

  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  const grid = await screen.findByRole('table', { name: 'Lưới bảng giá' })
  const rows = within(grid).getAllByRole('row')
  expect(rows[1]).toHaveTextContent('EDIT')
  expect(rows[2]).toHaveTextContent('NEW')
  expect(rows[3]).toHaveTextContent('OLD')
})

it('previews and applies formula results in the price book grid', async () => {
  const service = makeService()
  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  expect(await screen.findByRole('columnheader', { name: 'Giá chung' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('textbox', { name: 'Chọn bảng giá' }))
  await userEvent.click(screen.getByRole('option', { name: '25' }))

  await userEvent.click(screen.getByRole('button', { name: 'Tạo công thức cho bộ lọc này' }))
  await userEvent.type(screen.getByLabelText('Tên công thức'), 'Fomex')
  await userEvent.type(screen.getByLabelText('Mã hàng chứa'), 'MICA')
  await userEvent.type(screen.getByLabelText('Tên hàng chứa'), 'Mica')
  await userEvent.selectOptions(screen.getByLabelText('Cách bán áp dụng'), 'linear_m')
  await userEvent.selectOptions(screen.getByLabelText('Kiểu chi phí'), 'amount_plus_percent')
  await userEvent.type(screen.getByLabelText('Chi phí cộng thêm'), '5000')
  await userEvent.type(screen.getByLabelText('% theo giá nhập cuối'), '8')
  await userEvent.selectOptions(screen.getByLabelText('Kiểu lợi nhuận'), 'tiers')
  await userEvent.selectOptions(screen.getByLabelText('Điều kiện lợi nhuận'), '>')
  await userEvent.type(screen.getByLabelText('Mốc giá nhập'), '100000')
  await userEvent.type(screen.getByLabelText('Lợi nhuận tier'), '25000')
  await userEvent.selectOptions(screen.getByLabelText('Điều chỉnh Giá chung'), 'amount')
  await userEvent.type(screen.getByLabelText('Giá trị điều chỉnh Giá chung'), '20000')
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))

  expect(await screen.findAllByText('150 000')).toHaveLength(2)
  const grid = screen.getByRole('table', { name: 'Lưới bảng giá' })
  expect(within(grid).getByText('Hiện tại 120 000 → 150 000')).toBeInTheDocument()
  expect(within(grid).getByText('Mới 150 000')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Áp dụng công thức' }))
  expect(service.applyPriceFormula).toHaveBeenCalledWith({
    formula: {
      name: 'Fomex',
      product_filter: { status: 'active', code_contains: 'MICA', name_contains: 'Mica', sell_method: 'linear_m' },
      cost_formula: { type: 'amount_plus_percent', amount: 5000, percent_of_latest_purchase_cost: 8 },
      profit_formula: { type: 'tiers', tiers: [{ operator: '>', value: 100000, amount: 25000 }] },
      price_list_adjustments: { 'pl-default': { type: 'amount', amount: 20000 } },
    },
    selected_items: [
      { product_id: 'p-1', price_list_id: 'pl-default' },
      { product_id: 'p-1', price_list_id: 'pl-25' },
    ],
  })
})

it('opens KiotViet price import from the price book toolbar', async () => {
  const service = makeService({
    previewKiotVietProductImport: vi.fn(async () => ({
      summary: {
        total_rows: 3,
        valid_rows: 3,
        invalid_rows: 0,
        create_rows: 0,
        update_rows: 3,
        unit_review_rows: 0,
        price_rows: 5,
        price_skipped_rows: 0,
        provisional_stock_rows: 2,
        provisional_stock_skipped_rows: 1,
        bom_rows: 0,
        bom_skipped_rows: 3,
        price_list_name: 'Bảng giá chung',
        cleanup_demo_requested: false,
        ignored_columns: [],
        deferred_columns: [],
      },
      invalid_rows: [],
    })),
    importKiotVietProducts: vi.fn(async () => ({
      summary: { created_rows: 0, updated_rows: 3, cleanup_deleted_rows: 0, cleanup_blocked_rows: 0 },
      invalid_rows: [],
    })),
  })
  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  const toolbar = await screen.findByRole('search', { name: 'Tìm bảng giá' })
  await userEvent.click(within(toolbar).getByRole('button', { name: 'Import' }))

  const dialog = screen.getByRole('dialog', { name: 'Import bảng giá KiotViet' })
  const file = new File(['dummy'], 'BangGia_KV.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  await userEvent.upload(within(dialog).getByLabelText('File KiotViet'), file)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }))
  await userEvent.click(await within(dialog).findByRole('button', { name: 'Import' }))

  expect(service.previewKiotVietProductImport).toHaveBeenCalledWith({ file, cleanup_demo: false })
  expect(service.importKiotVietProducts).toHaveBeenCalledWith({ file, cleanup_demo: false })
})
