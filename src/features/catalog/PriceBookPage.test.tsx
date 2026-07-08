import { render, screen, within } from '@testing-library/react'
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
    listStockMovements: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    listInventoryRolls: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    listInventorySheets: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    adjustNormalProductStock: vi.fn(),
    listCustomers: vi.fn(async () => ({ items: [], page: 1, page_size: 20, total: 0 })),
    listCustomerGroups: vi.fn(async () => ({ items: [] })),
    createCustomer: vi.fn(),
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
  expect(await screen.findByRole('heading', { name: 'Bảng giá' })).toBeInTheDocument()
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
  expect(within(filterSidebar).getByRole('button', { name: 'Áp dụng bộ lọc' }).closest('.management-filter-actions')).not.toBeNull()
  expect(screen.getByRole('navigation', { name: 'Phân trang bảng giá' })).toHaveTextContent('1 - 1 trong 1 hàng hóa')

  const grid = await screen.findByRole('table', { name: 'Lưới bảng giá' })
  expect(grid.closest('.management-table-viewport')).not.toBeNull()
  const header = within(grid).getByRole('row', {
    name: 'Mã hàng Tên hàng Giá nhập cuối Chi phí Lợi nhuận Bảng giá chung 25 Cách bán Trạng thái Thao tác',
  })
  expect(header).toBeInTheDocument()
  expect(within(grid).getAllByRole('cell', { name: 'Chưa cấu hình' })).toHaveLength(2)
  expect(within(grid).getAllByRole('cell', { name: 'Chưa xem' })).toHaveLength(2)
  expect(service.listProducts).toHaveBeenCalledWith({ status: 'active', page: 1, page_size: 15 })
  expect(service.listPriceLists).toHaveBeenCalled()
})

it('previews and applies formula results in the price book grid', async () => {
  const service = makeService()
  render(<PriceBookPage service={service} onOpenDashboard={vi.fn()} />)

  expect(await screen.findByText('Bảng giá chung')).toBeInTheDocument()

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
  await userEvent.selectOptions(screen.getByLabelText('Điều chỉnh Bảng giá chung'), 'amount')
  await userEvent.type(screen.getByLabelText('Giá trị điều chỉnh Bảng giá chung'), '20000')
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
