import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CatalogPage } from './CatalogPage'
import type { CatalogService } from './catalog-service'

function makeService(overrides: Partial<CatalogService> = {}): CatalogService {
  return {
    listProducts: vi.fn(async (input = {}) => ({
      items: [
        {
          id: 'p-1',
          code: 'MICA-3MM',
          name: 'Mica 3mm',
          status: 'active' as const,
          unit_name: 'm',
          sell_method: 'linear_m' as const,
          latest_purchase_cost: 100000,
          default_sale_price: 650000,
          inventory_shape: 'normal' as const,
          unit_conversions: [
            {
              unit_id: 'unit-m-toi',
              unit_name: 'm tới',
              stock_qty_per_unit: 0.5,
              is_default_purchase_unit: true,
              is_default_sale_unit: true,
            },
            {
              unit_id: 'unit-tac',
              unit_name: 'Tấc',
              stock_qty_per_unit: 0.042,
              is_default_purchase_unit: false,
              is_default_sale_unit: false,
            },
          ],
        },
        {
          id: 'p-2',
          code: 'KEO',
          name: 'Keo dán',
          status: 'active' as const,
          unit_name: 'chai',
          sell_method: 'quantity' as const,
          latest_purchase_cost: 20000,
          inventory_shape: 'normal' as const,
        },
      ],
      page: input.page ?? 1,
      page_size: input.page_size ?? 15,
      total: 2,
    })),
    listProductGroups: vi.fn(async () => ({
      items: [
        { id: 'pg-default', code: 'GENERAL', name: 'Giá chung', is_default: true, is_active: true },
        { id: 'pg-vat-tu', code: 'VAT-TU', name: 'Vật tư', is_default: false, is_active: true },
      ],
    })),
    previewKiotVietProductImport: vi.fn(async () => ({
      summary: {
        total_rows: 1,
        valid_rows: 1,
        invalid_rows: 0,
        create_rows: 1,
        update_rows: 0,
        unit_review_rows: 0,
        cleanup_demo_requested: false,
        ignored_columns: [],
        deferred_columns: [],
      },
      invalid_rows: [],
    })),
    importKiotVietProducts: vi.fn(async () => ({
      summary: { created_rows: 1, updated_rows: 0, cleanup_deleted_rows: 0, cleanup_blocked_rows: 0 },
      invalid_rows: [],
    })),
    deleteImportedKiotVietProducts: vi.fn(async () => ({ deleted_rows: 517, blocked_rows: 0 })),
    listStockMovements: vi.fn(async () => ({
      items: [
        {
          id: 'movement-1',
          product_id: 'p-1',
          movement_type: 'sale_deduction',
          quantity_delta: -1.656,
          created_at: '2026-07-07T05:30:00Z',
          document_code: 'HD011036',
          document_type: 'sale_invoice' as const,
          transaction_price: 300000,
          cost_price: 107751.2,
          ending_qty: 18.344,
          partner_name: 'Khách lẻ',
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    listInventoryRolls: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    listInventorySheets: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    adjustNormalProductStock: vi.fn(async () => ({
      id: 'stocktake-1',
      code: 'KK000001',
      status: 'balanced' as const,
      source_type: 'product_edit' as const,
      created_at: '2026-07-07T06:00:00Z',
      balanced_at: '2026-07-07T06:00:00Z',
      total_actual_qty: 12,
      total_actual_value: null,
      total_difference_value: null,
      increased_qty: 4,
      decreased_qty: 0,
      note: 'Cập nhật tồn từ trang Hàng hóa',
    })),
    createProduct: vi.fn(async () => ({
      id: 'p-2',
      code: 'DECAL',
      name: 'Decal',
      status: 'active' as const,
      unit_name: 'm²',
      sell_method: 'area_m2' as const,
      latest_purchase_cost: 50000,
      inventory_shape: 'normal' as const,
    })),
    updateProduct: vi.fn(async () => ({
      id: 'p-1',
      code: 'MICA-3MM',
      name: 'Mica 3mm',
      status: 'inactive' as const,
      unit_name: 'm',
      sell_method: 'linear_m' as const,
    })),
    getProductBom: vi.fn(async () => null),
    saveProductBom: vi.fn(async () => ({
      id: 'bom-1',
      product_id: 'p-1',
      version: 1,
      status: 'active' as const,
      notes: null,
      created_at: '2026-07-05T00:00:00Z',
      items: [
        {
          id: 'bom-item-1',
          component_product_id: 'p-2',
          component_product: {
            id: 'p-2',
            code: 'KEO',
            name: 'Keo dán',
            unit_name: 'chai',
            product_kind: 'auxiliary_material' as const,
            latest_purchase_cost: 20000,
          },
          quantity: 2,
          sort_order: 1,
          notes: 'Dán mica',
        },
      ],
    })),
    listCustomers: vi.fn(async () => ({ items: [], page: 1, page_size: 20, total: 0 })),
    listCustomerGroups: vi.fn(async () => ({ items: [] })),
    previewKiotVietCustomerImport: vi.fn(),
    importKiotVietCustomers: vi.fn(),
    deleteImportedKiotVietCustomers: vi.fn(async () => ({ deleted_rows: 0, blocked_rows: 0 })),
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

it('lists products and creates a product', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  expect(screen.getByText('Đang tải hàng hóa...').closest('.management-list-surface')).not.toBeNull()
  expect(await screen.findByText('MICA-3MM')).toBeInTheDocument()
  expect(screen.getAllByText('Mica 3mm').length).toBeGreaterThan(0)
  expect(screen.getByRole('main')).toHaveClass('management-page')
  expect(screen.getByRole('heading', { name: 'Hàng hóa' }).closest('.management-page-header')).not.toBeNull()
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc hàng hóa' })
  expect(sidebar).toHaveClass('management-filter-sidebar')
  expect(within(sidebar).queryByRole('heading', { name: 'Bộ lọc' })).not.toBeInTheDocument()
  expect(sidebar.querySelector('.management-filter-summary')).toBeNull()
  expect(within(sidebar).queryByRole('button', { name: 'Đặt lại bộ lọc' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Danh sách hàng hóa' })).toHaveClass('management-list-surface')
  expect(screen.queryByRole('button', { name: 'Tạo công thức cho bộ lọc này' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Lọc' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Trang chủ' })).not.toBeInTheDocument()

  expect(screen.queryByRole('dialog', { name: 'Tạo hàng hóa' })).not.toBeInTheDocument()
  await userEvent.click(within(screen.getByRole('search', { name: 'Lọc hàng hóa' })).getByRole('button', { name: 'Tạo hàng hóa' }))
  const createDialog = screen.getByRole('dialog', { name: 'Tạo hàng hóa' })
  const createForm = within(createDialog).getByRole('form', { name: 'Tạo hàng hóa' })
  expect(within(createDialog).queryByRole('tab', { name: 'Thông tin' })).not.toBeInTheDocument()
  expect(within(createDialog).queryByRole('tab', { name: 'Mô tả' })).not.toBeInTheDocument()
  expect(within(createForm).getByRole('combobox', { name: 'Loại hàng' })).toHaveValue('goods')
  expect(within(createForm).getByRole('combobox', { name: 'Nhóm hàng' })).toHaveValue('')
  expect(within(createForm).getByRole('region', { name: 'Giá vốn, giá bán' })).toBeInTheDocument()
  expect(within(createForm).getByRole('region', { name: 'Tồn kho' })).toBeInTheDocument()
  expect(within(createDialog).queryByText('Thêm ảnh')).not.toBeInTheDocument()
  expect(within(createDialog).queryByText('Mỗi ảnh không quá 2 MB')).not.toBeInTheDocument()
  expect(within(createDialog).queryByText('Bán trực tiếp')).not.toBeInTheDocument()
  await userEvent.type(within(createForm).getByLabelText('Mã hàng'), 'DECAL')
  await userEvent.type(within(createForm).getByLabelText('Tên hàng'), 'Decal')
  await userEvent.type(within(createForm).getByLabelText('Đơn vị'), 'm²')
  await userEvent.selectOptions(within(createForm).getByLabelText('Nhóm hàng'), 'pg-vat-tu')
  await userEvent.clear(within(createForm).getByLabelText('Giá vốn'))
  await userEvent.type(within(createForm).getByLabelText('Giá vốn'), '50000')
  await userEvent.selectOptions(within(createForm).getByLabelText('Cách tính bán'), 'area_m2')
  await userEvent.click(within(createForm).getByRole('button', { name: 'Lưu' }))

  expect(service.createProduct).toHaveBeenCalledWith({
    code: 'DECAL',
    name: 'Decal',
    status: 'active',
    product_kind: 'goods',
    unit_name: 'm²',
    sell_method: 'area_m2',
    inventory_shape: 'normal',
    track_inventory: true,
    product_group_id: 'pg-vat-tu',
    latest_purchase_cost: 50000,
  })
})

it('switches the shared create product modal for service, roll, sheet, and combo goods', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('MICA-3MM')
  await userEvent.click(within(screen.getByRole('search', { name: 'Lọc hàng hóa' })).getByRole('button', { name: 'Tạo hàng hóa' }))
  const createDialog = screen.getByRole('dialog', { name: 'Tạo hàng hóa' })
  const createForm = within(createDialog).getByRole('form', { name: 'Tạo hàng hóa' })

  await userEvent.selectOptions(within(createForm).getByRole('combobox', { name: 'Loại hàng' }), 'service')
  expect(within(createForm).queryByRole('region', { name: 'Tồn kho' })).not.toBeInTheDocument()
  expect(within(createForm).queryByRole('region', { name: 'Vật tư cấu thành' })).not.toBeInTheDocument()

  await userEvent.selectOptions(within(createForm).getByRole('combobox', { name: 'Loại hàng' }), 'auxiliary_material')
  expect(within(createForm).getByRole('combobox', { name: 'Cách tính bán' })).toHaveValue('quantity')
  expect(within(createForm).getByRole('region', { name: 'Tồn kho' })).toBeInTheDocument()
  expect(within(createForm).queryByRole('region', { name: 'Vật tư cấu thành' })).not.toBeInTheDocument()

  await userEvent.selectOptions(within(createForm).getByRole('combobox', { name: 'Loại hàng' }), 'roll')
  expect(within(createForm).getByRole('combobox', { name: 'Cách tính bán' })).toHaveValue('linear_m')
  expect(within(createForm).getByRole('region', { name: 'Tồn kho' })).toHaveTextContent('Cuộn')

  await userEvent.selectOptions(within(createForm).getByRole('combobox', { name: 'Loại hàng' }), 'sheet')
  expect(within(createForm).getByRole('combobox', { name: 'Cách tính bán' })).toHaveValue('sheet')
  expect(within(createForm).getByRole('region', { name: 'Tồn kho' })).toHaveTextContent('Tấm')

  await userEvent.selectOptions(within(createForm).getByRole('combobox', { name: 'Loại hàng' }), 'combo')
  expect(within(createForm).getByRole('combobox', { name: 'Cách tính bán' })).toHaveValue('combo')
  expect(within(createForm).queryByRole('region', { name: 'Tồn kho' })).not.toBeInTheDocument()
  expect(within(createForm).getByRole('region', { name: 'Vật tư cấu thành' })).toBeInTheDocument()
})

it('keeps the shared create product modal open when saving and creating another product', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('MICA-3MM')
  await userEvent.click(within(screen.getByRole('search', { name: 'Lọc hàng hóa' })).getByRole('button', { name: 'Tạo hàng hóa' }))
  const createDialog = screen.getByRole('dialog', { name: 'Tạo hàng hóa' })
  const createForm = within(createDialog).getByRole('form', { name: 'Tạo hàng hóa' })

  await userEvent.selectOptions(within(createForm).getByRole('combobox', { name: 'Loại hàng' }), 'service')
  await userEvent.type(within(createForm).getByLabelText('Mã hàng'), 'DESIGN')
  await userEvent.type(within(createForm).getByLabelText('Tên hàng'), 'Thiết kế')
  await userEvent.clear(within(createForm).getByLabelText('Giá vốn'))
  await userEvent.type(within(createForm).getByLabelText('Giá vốn'), '0')
  await userEvent.click(within(createForm).getByRole('button', { name: 'Lưu & tạo thêm' }))

  expect(service.createProduct).toHaveBeenCalledWith({
    code: 'DESIGN',
    name: 'Thiết kế',
    status: 'active',
    product_kind: 'service',
    unit_name: 'lần',
    sell_method: 'quantity',
    inventory_shape: 'normal',
    track_inventory: false,
    latest_purchase_cost: 0,
  })
  expect(screen.getByRole('dialog', { name: 'Tạo hàng hóa' })).toBeInTheDocument()
  expect(within(createForm).getByRole('combobox', { name: 'Loại hàng' })).toHaveValue('goods')
  expect(within(createForm).getByLabelText('Mã hàng')).toHaveValue('')
  expect(within(createForm).getByLabelText('Tên hàng')).toHaveValue('')
})

it('creates a combo product with BOM components from the shared create modal', async () => {
  const service = makeService({
    createProduct: vi.fn(async () => ({
      id: 'p-combo',
      code: 'COMBO-01',
      name: 'Combo bảng hiệu',
      status: 'active' as const,
      unit_name: 'combo',
      sell_method: 'combo' as const,
      latest_purchase_cost: 0,
      inventory_shape: 'normal' as const,
    })),
  })
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('MICA-3MM')
  await userEvent.click(within(screen.getByRole('search', { name: 'Lọc hàng hóa' })).getByRole('button', { name: 'Tạo hàng hóa' }))
  const createDialog = screen.getByRole('dialog', { name: 'Tạo hàng hóa' })
  const createForm = within(createDialog).getByRole('form', { name: 'Tạo hàng hóa' })

  await userEvent.selectOptions(within(createForm).getByRole('combobox', { name: 'Loại hàng' }), 'combo')
  const componentRegion = within(createForm).getByRole('region', { name: 'Vật tư cấu thành' })
  await userEvent.type(within(createForm).getByLabelText('Mã hàng'), 'COMBO-01')
  await userEvent.type(within(createForm).getByLabelText('Tên hàng'), 'Combo bảng hiệu')
  await userEvent.selectOptions(within(componentRegion).getByLabelText('Vật tư'), 'p-2')
  expect(within(componentRegion).queryByLabelText('Loại')).not.toBeInTheDocument()
  await userEvent.clear(within(componentRegion).getByLabelText('Định mức'))
  await userEvent.type(within(componentRegion).getByLabelText('Định mức'), '2')
  await userEvent.type(within(componentRegion).getByLabelText('Ghi chú'), 'Keo dán')
  await userEvent.click(within(createForm).getByRole('button', { name: 'Lưu' }))

  expect(service.createProduct).toHaveBeenCalledWith({
    code: 'COMBO-01',
    name: 'Combo bảng hiệu',
    status: 'active',
    product_kind: 'combo',
    unit_name: 'combo',
    sell_method: 'combo',
    inventory_shape: 'normal',
    track_inventory: false,
    latest_purchase_cost: 0,
  })
  expect(service.saveProductBom).toHaveBeenCalledWith('p-combo', {
    items: [{ component_product_id: 'p-2', quantity: 2, notes: 'Keo dán' }],
  })
})

it('filters by status and toggles product active state', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('MICA-3MM')
  const filterForm = screen.getByRole('search', { name: 'Lọc hàng hóa' })
  expect(filterForm.closest('.management-page-header')).not.toBeNull()
  expect(within(filterForm).getByLabelText('Tìm hàng hóa').closest('.management-compact-search')).not.toBeNull()
  const createAction = within(filterForm).getByRole('button', { name: 'Tạo hàng hóa' })
  expect(createAction.closest('.management-compact-search')).not.toBeNull()
  expect(createAction).toHaveClass('management-compact-create-action')
  expect(within(filterForm).getByRole('button', { name: 'Import' })).toBeInTheDocument()
  const searchInput = within(filterForm).getByLabelText('Tìm hàng hóa')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc hàng hóa' })
  expect(within(sidebar).getByRole('combobox', { name: 'Loại hàng' })).toHaveValue('all')
  expect(within(sidebar).getByRole('option', { name: 'Dịch vụ' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('option', { name: 'Vật tư phụ' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('combobox', { name: 'Nhóm hàng' })).toHaveValue('all')
  expect(within(sidebar).getByRole('combobox', { name: 'Tồn kho' })).toHaveValue('all')
  expect(within(sidebar).queryByRole('combobox', { name: 'Cách tính bán' })).not.toBeInTheDocument()
  expect(within(sidebar).getByRole('combobox', { name: 'Trạng thái hàng hóa' })).toHaveValue('active')
  await userEvent.selectOptions(within(sidebar).getByRole('combobox', { name: 'Trạng thái hàng hóa' }), 'all')
  expect(service.listProducts).toHaveBeenLastCalledWith({ page: 1, page_size: 15, search: undefined, status: 'all' })
  await userEvent.type(searchInput, 'MICA')
  await waitFor(() => expect(service.listProducts).toHaveBeenCalledWith({ page: 1, page_size: 15, search: 'MICA', status: 'all' }))
  await userEvent.type(searchInput, '{Enter}')
  expect(service.listProducts).toHaveBeenCalledWith({ page: 1, page_size: 15, search: 'MICA', status: 'all' })
  expect(screen.queryByText('Trạng thái: Tất cả')).not.toBeInTheDocument()

  expect(screen.queryByRole('button', { name: 'Ngưng bán' })).not.toBeInTheDocument()
  expect(service.updateProduct).not.toHaveBeenCalled()
})

it('opens KiotViet product import dialog from the toolbar and reloads after import', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('MICA-3MM')
  await userEvent.click(within(screen.getByRole('search', { name: 'Lọc hàng hóa' })).getByRole('button', { name: 'Import' }))
  const dialog = screen.getByRole('dialog', { name: 'Import hàng hóa KiotViet' })
  const file = new File(['fake-xlsx'], 'products.xlsx')

  await userEvent.upload(within(dialog).getByLabelText('File KiotViet'), file)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }))
  await screen.findByText('1 dòng hợp lệ')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))

  expect(service.previewKiotVietProductImport).toHaveBeenCalledWith({ file, cleanup_demo: false })
  expect(service.importKiotVietProducts).toHaveBeenCalledWith({ file, cleanup_demo: false })
  expect(service.listProducts).toHaveBeenLastCalledWith({ page: 1, page_size: 15, search: undefined, status: 'active' })
})

it('deletes old KiotViet product import data from the shared import dialog', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('MICA-3MM')
  await userEvent.click(within(screen.getByRole('search', { name: 'Lọc hàng hóa' })).getByRole('button', { name: 'Import' }))
  const dialog = screen.getByRole('dialog', { name: 'Import hàng hóa KiotViet' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa dữ liệu cũ' }))
  const confirmDialog = within(dialog).getByRole('alertdialog', { name: 'Xác nhận xóa dữ liệu cũ' })
  await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Xóa' }))

  expect(service.deleteImportedKiotVietProducts).toHaveBeenCalled()
  expect(await within(dialog).findByText('Đã xóa 517 dòng dữ liệu cũ.')).toBeInTheDocument()
  expect(service.listProducts).toHaveBeenLastCalledWith({ page: 1, page_size: 15, search: undefined, status: 'active' })
})

it('reactively filters products by existing product fields in the shared sidebar', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('MICA-3MM')
  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc hàng hóa' })

  expect(within(sidebar).getByRole('region', { name: 'Nhóm hàng' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Tồn kho' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Thời gian tạo' })).toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Loại hàng' })).toBeInTheDocument()
  expect(within(sidebar).queryByRole('region', { name: 'Cách tính bán' })).not.toBeInTheDocument()
  expect(within(sidebar).getByRole('region', { name: 'Trạng thái hàng hóa' })).toBeInTheDocument()
  expect(within(sidebar).queryByRole('region', { name: 'Nhà cung cấp' })).not.toBeInTheDocument()
  expect(within(sidebar).queryByRole('region', { name: 'Thương hiệu' })).not.toBeInTheDocument()

  const groupRegion = within(sidebar).getByRole('region', { name: 'Nhóm hàng' })
  const stockRegion = within(sidebar).getByRole('region', { name: 'Tồn kho' })
  const createdAtRegion = within(sidebar).getByRole('region', { name: 'Thời gian tạo' })
  const kindRegion = within(sidebar).getByRole('region', { name: 'Loại hàng' })
  expect(groupRegion.compareDocumentPosition(stockRegion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(stockRegion.compareDocumentPosition(createdAtRegion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(createdAtRegion.compareDocumentPosition(kindRegion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

  expect(within(createdAtRegion).getByRole('radio', { name: 'Toàn thời gian' })).toBeChecked()
  await userEvent.click(within(createdAtRegion).getByRole('radio', { name: 'Tùy chỉnh' }))
  await userEvent.clear(within(createdAtRegion).getByLabelText('Từ ngày'))
  await userEvent.type(within(createdAtRegion).getByLabelText('Từ ngày'), '01/07/2026')
  await userEvent.clear(within(createdAtRegion).getByLabelText('Đến ngày'))
  await userEvent.type(within(createdAtRegion).getByLabelText('Đến ngày'), '31/07/2026')
  expect(within(createdAtRegion).getByLabelText('Đến ngày')).toHaveValue('31/07/2026')
  expect(service.listProducts).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'active',
    created_from: '2026-07-01',
    created_to: '2026-07-31',
  })

  await userEvent.selectOptions(within(sidebar).getByRole('combobox', { name: 'Tồn kho' }), 'roll')
  expect(service.listProducts).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'active',
    created_from: '2026-07-01',
    created_to: '2026-07-31',
    inventory_shape: 'roll',
  })

  await userEvent.selectOptions(within(sidebar).getByRole('combobox', { name: 'Loại hàng' }), 'service')
  expect(service.listProducts).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'active',
    created_from: '2026-07-01',
    created_to: '2026-07-31',
    inventory_shape: 'roll',
    product_kind: 'service',
  })

  await userEvent.selectOptions(within(sidebar).getByRole('combobox', { name: 'Nhóm hàng' }), 'pg-vat-tu')
  expect(service.listProducts).toHaveBeenLastCalledWith({
    page: 1,
    page_size: 15,
    search: undefined,
    status: 'active',
    created_from: '2026-07-01',
    created_to: '2026-07-31',
    inventory_shape: 'roll',
    product_kind: 'service',
    product_group_id: 'pg-vat-tu',
  })
})

it('renders products as a goods and inventory-oriented list, not a pricebook workspace', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  const grid = await screen.findByRole('table', { name: 'Danh sách hàng hóa' })
  expect(grid).toHaveClass('management-table')
  expect(grid.closest('.management-table-viewport')).not.toBeNull()
  expect(within(grid).getByRole('columnheader', { name: 'Tồn QCVL' })).toBeInTheDocument()
  expect(within(grid).getByRole('checkbox', { name: 'Chọn tất cả dòng hàng hóa' }).parentElement).toHaveClass('finance-cashbook-checkbox-control')
  expect(within(grid).getByRole('button', { name: 'Chỉ hiện hàng ưu tiên' })).toHaveClass('finance-cashbook-star-button')
  expect(within(grid).getByRole('checkbox', { name: 'Chọn dòng MICA-3MM' }).parentElement).toHaveClass('finance-cashbook-checkbox-control')
  expect(within(grid).getByRole('button', { name: 'Đánh dấu ưu tiên MICA-3MM' })).toHaveClass('finance-cashbook-star-button')
  expect(within(grid).queryByRole('columnheader', { name: 'Thao tác' })).not.toBeInTheDocument()
  expect(within(grid).queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument()
  expect(within(grid).queryByRole('columnheader', { name: 'Thời gian tạo' })).not.toBeInTheDocument()
  expect(within(grid).queryByRole('columnheader', { name: 'Cách tính bán' })).not.toBeInTheDocument()
  expect(within(grid).queryByRole('button', { name: 'Ngưng bán' })).not.toBeInTheDocument()
  expect(within(grid).getByText('650 000')).toBeInTheDocument()
  expect(within(grid).getAllByText('Chưa có').length).toBeGreaterThanOrEqual(3)
  const footer = screen.getByRole('navigation', { name: 'Phân trang hàng hóa' })
  expect(footer).toHaveClass('management-table-footer')
  expect(footer).toContainElement(screen.getByText('1 - 2 trong 2 hàng hóa'))
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('1')
  expect(screen.queryByRole('table', { name: 'Lưới bảng giá' })).not.toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Công thức bảng giá' })).not.toBeInTheDocument()
})

it('sorts product rows from shared column headers', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  const grid = await screen.findByRole('table', { name: 'Danh sách hàng hóa' })
  const rowsBeforeSort = within(grid).getAllByRole('row')
  expect(rowsBeforeSort[1]).toHaveTextContent('MICA-3MM')

  await userEvent.click(within(grid).getByRole('button', { name: 'Tên hàng' }))

  const rowsAfterNameSort = within(grid).getAllByRole('row')
  expect(rowsAfterNameSort[1]).toHaveTextContent('KEO')
  expect(within(grid).getByRole('columnheader', { name: 'Tên hàng' })).toHaveAttribute('aria-sort', 'ascending')

  await userEvent.click(within(grid).getByRole('button', { name: 'Tên hàng' }))

  const rowsAfterReverseNameSort = within(grid).getAllByRole('row')
  expect(rowsAfterReverseNameSort[1]).toHaveTextContent('MICA-3MM')
  expect(within(grid).getByRole('columnheader', { name: 'Tên hàng' })).toHaveAttribute('aria-sort', 'descending')
})

it('persists product favorite marks and filters the current product page by favorites', async () => {
  window.localStorage.clear()
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  const grid = await screen.findByRole('table', { name: 'Danh sách hàng hóa' })
  await userEvent.click(within(grid).getByRole('button', { name: 'Đánh dấu ưu tiên MICA-3MM' }))

  expect(JSON.parse(window.localStorage.getItem('catalog.product.favoriteProductIds') ?? '[]')).toEqual(['p-1'])
  await userEvent.click(within(grid).getByRole('button', { name: 'Chỉ hiện hàng ưu tiên' }))

  expect(screen.getByText('MICA-3MM')).toBeInTheDocument()
  expect(screen.queryByText('KEO')).not.toBeInTheDocument()
  expect(within(grid).getByRole('button', { name: 'Hiện tất cả hàng hóa' })).toHaveAttribute('aria-pressed', 'true')
})

it('opens product BOM and saves single-level normal components', async () => {
  const service = makeService({
    getProductBom: vi.fn(async () => ({
      id: 'bom-1',
      product_id: 'p-1',
      version: 1,
      status: 'active' as const,
      notes: null,
      created_at: '2026-07-05T00:00:00Z',
      items: [
        {
          id: 'bom-item-1',
          component_product_id: 'p-2',
          component_product: {
            id: 'p-2',
            code: 'KEO',
            name: 'Keo dán',
            unit_name: 'chai',
            product_kind: 'auxiliary_material' as const,
            latest_purchase_cost: 20000,
          },
          quantity: 2,
          sort_order: 1,
          notes: 'Dán mica',
        },
      ],
    })),
  })
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await userEvent.click(await screen.findByText('MICA-3MM'))
  await userEvent.click(screen.getByRole('tab', { name: 'BOM/Vật tư cấu thành' }))
  const bomRegion = await screen.findByRole('region', { name: 'BOM MICA-3MM' })
  expect(within(bomRegion).getByRole('table', { name: 'Vật tư cấu thành MICA-3MM' })).toBeInTheDocument()
  expect(within(bomRegion).getByRole('columnheader', { name: 'Mã vật tư' })).toBeInTheDocument()
  expect(within(bomRegion).getByRole('columnheader', { name: 'Tên vật tư' })).toBeInTheDocument()
  expect(within(bomRegion).getByRole('columnheader', { name: 'Định mức' })).toBeInTheDocument()
  expect(within(bomRegion).getByRole('columnheader', { name: 'Đơn vị' })).toBeInTheDocument()
  expect(within(bomRegion).getByRole('columnheader', { name: 'Giá vốn tạm' })).toBeInTheDocument()
  expect(within(bomRegion).getByRole('columnheader', { name: 'Trạng thái dòng' })).toBeInTheDocument()
  await waitFor(() => {
    const loadedBomRegion = screen.getByRole('region', { name: 'BOM MICA-3MM' })
    expect(within(loadedBomRegion).getByText('Vật tư phụ')).toBeInTheDocument()
    expect(within(loadedBomRegion).getByText('20 000')).toBeInTheDocument()
  })
  await userEvent.selectOptions(within(bomRegion).getByLabelText('Vật tư'), 'p-2')
  expect(within(bomRegion).queryByLabelText('Loại')).not.toBeInTheDocument()
  await userEvent.clear(within(bomRegion).getByLabelText('Định mức'))
  await userEvent.type(within(bomRegion).getByLabelText('Định mức'), '2')
  await userEvent.clear(within(bomRegion).getByLabelText('Ghi chú'))
  await userEvent.type(within(bomRegion).getByLabelText('Ghi chú'), 'Dán mica')
  await userEvent.click(within(bomRegion).getByRole('button', { name: 'Lưu BOM' }))

  expect(service.getProductBom).toHaveBeenCalledWith('p-1')
  expect(service.saveProductBom).toHaveBeenCalledWith('p-1', {
    items: [{ component_product_id: 'p-2', quantity: 2, notes: 'Dán mica' }],
  })
  await userEvent.click(screen.getByRole('tab', { name: 'Thông tin' }))
  expect(screen.getByRole('region', { name: 'Chi tiết hàng hóa MICA-3MM' })).toHaveTextContent('Vật tư cấu thành')
  expect(screen.getByRole('region', { name: 'Chi tiết hàng hóa MICA-3MM' })).toHaveTextContent('KEO')
})

it('opens product detail without a page error when the BOM endpoint is unavailable', async () => {
  const service = makeService({
    getProductBom: vi.fn(async () => {
      throw new Error('BOM tables unavailable')
    }),
  })
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await userEvent.click(await screen.findByText('MICA-3MM'))

  expect(await screen.findByRole('region', { name: 'Chi tiết hàng hóa MICA-3MM' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: 'BOM/Vật tư cấu thành' }))
  expect(screen.queryByText('Máy chủ gặp lỗi. Vui lòng thử lại sau.')).not.toBeInTheDocument()
  expect(screen.queryByText('BOM tables unavailable')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'BOM MICA-3MM' })).toHaveTextContent('Chưa có BOM')
})

it('uses the shared table footer to move between product pages', async () => {
  const service = makeService({
    listProducts: vi.fn(async (input = {}) => ({
      items: [
        {
          id: `p-page-${input.page ?? 1}`,
          code: input.page === 2 ? 'DECAL-2' : 'MICA-3MM',
          name: input.page === 2 ? 'Decal trang 2' : 'Mica 3mm',
          status: 'active' as const,
          unit_name: 'm',
          sell_method: 'linear_m' as const,
          latest_purchase_cost: 100000,
        },
      ],
      page: input.page ?? 1,
      page_size: input.page_size ?? 15,
      total: 45,
      total_all: 52,
    })),
  })
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  expect(await screen.findByText('MICA-3MM')).toBeInTheDocument()
  const footer = screen.getByRole('navigation', { name: 'Phân trang hàng hóa' })
  expect(footer).toContainElement(screen.getByText('1 - 15 trong 45 hàng hóa (52 mã hàng)'))
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('1')

  await userEvent.click(within(footer).getByRole('button', { name: 'Trang sau' }))

  expect(await screen.findByText('DECAL-2')).toBeInTheDocument()
  expect(footer).toContainElement(screen.getByText('16 - 30 trong 45 hàng hóa (52 mã hàng)'))
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('2')
  expect(service.listProducts).toHaveBeenLastCalledWith({ page: 2, page_size: 15, search: undefined, status: 'active' })
})

it('expands product details directly under the selected row and closes on second click', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await userEvent.click(await screen.findByText('MICA-3MM'))
  const detail = screen.getByRole('region', { name: 'Chi tiết hàng hóa MICA-3MM' })
  const productRow = detail.closest('tr')?.previousElementSibling
  expect(productRow).toHaveTextContent('MICA-3MM')
  expect(productRow).toHaveClass('management-data-row-selected')
  expect(detail.closest('tr')).toHaveClass('management-detail-row')
  expect(detail.querySelector('.management-detail-panel')).not.toBeNull()
  const tabbar = detail.querySelector('.inline-detail-tabbar')
  expect(tabbar).not.toBeNull()
  expect(within(detail).getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
  expect(within(detail).getByRole('tab', { name: 'Đơn vị & quy đổi' })).toHaveAttribute('aria-selected', 'false')
  expect(within(detail).getByRole('tab', { name: 'BOM/Vật tư cấu thành' })).toHaveAttribute('aria-selected', 'false')
  expect(within(detail).getByRole('tab', { name: 'Tồn kho' })).toHaveAttribute('aria-selected', 'false')
  expect(within(detail).getByRole('tab', { name: 'Thẻ kho' })).toHaveAttribute('aria-selected', 'false')
  expect(within(detail).getByRole('tab', { name: 'Ghi chú' })).toHaveAttribute('aria-selected', 'false')
  expect(detail.querySelector('.management-detail-header')).not.toBeNull()
  expect(detail.querySelector('.management-detail-meta-grid')).toHaveClass('management-detail-meta-grid-four')
  expect(detail.querySelector('.management-detail-footer-actions')).not.toBeNull()
  expect(within(detail).queryByRole('button', { name: 'In tem mã' })).not.toBeInTheDocument()
  expect(within(detail).getByText('Mica 3mm')).toBeInTheDocument()
  expect(within(detail).getByText('m tới')).toBeInTheDocument()
  expect(within(detail).getByText('100 000')).toBeInTheDocument()

  await userEvent.click(within(detail).getByRole('tab', { name: 'Đơn vị & quy đổi' }))
  expect(within(detail).getByRole('tab', { name: 'Đơn vị & quy đổi' })).toHaveAttribute('aria-selected', 'true')
  expect(within(detail).getByRole('region', { name: 'Đơn vị và quy đổi MICA-3MM' })).toHaveTextContent('m')
  expect(within(detail).getByRole('region', { name: 'Đơn vị và quy đổi MICA-3MM' })).toHaveTextContent('m tới')
  expect(within(detail).getByRole('region', { name: 'Đơn vị và quy đổi MICA-3MM' })).toHaveTextContent('1 m tới = 0,5 m')
  expect(within(detail).getByRole('region', { name: 'Đơn vị và quy đổi MICA-3MM' })).toHaveTextContent('1 Tấc = 0,042 m')

  await userEvent.click(productRow as HTMLElement)
  expect(screen.queryByRole('region', { name: 'Chi tiết hàng hóa MICA-3MM' })).not.toBeInTheDocument()
})

it('shows stock card tab as a KV-style movement table with placeholders for missing API fields', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await userEvent.click(await screen.findByText('MICA-3MM'))
  const detail = screen.getByRole('region', { name: 'Chi tiết hàng hóa MICA-3MM' })

  await userEvent.click(within(detail).getByRole('tab', { name: 'Thẻ kho' }))

  expect(service.listStockMovements).toHaveBeenCalledWith({ product_id: 'p-1', page: 1, page_size: 15 })
  expect(within(detail).getByRole('tab', { name: 'Thẻ kho' })).toHaveAttribute('aria-selected', 'true')
  const stockCardTable = within(detail).getByRole('table', { name: 'Thẻ kho MICA-3MM' })
  expect(within(stockCardTable).getByRole('columnheader', { name: 'Chứng từ' })).toBeInTheDocument()
  expect(within(stockCardTable).getByRole('columnheader', { name: 'Thời gian' })).toBeInTheDocument()
  expect(within(stockCardTable).getByRole('columnheader', { name: 'Loại giao dịch' })).toBeInTheDocument()
  expect(within(stockCardTable).getByRole('columnheader', { name: 'Giá GD' })).toBeInTheDocument()
  expect(within(stockCardTable).getByRole('columnheader', { name: 'Giá vốn' })).toBeInTheDocument()
  expect(within(stockCardTable).getByRole('columnheader', { name: 'Số lượng' })).toBeInTheDocument()
  expect(within(stockCardTable).getByRole('columnheader', { name: 'Tồn cuối' })).toBeInTheDocument()
  expect(within(stockCardTable).getByRole('columnheader', { name: 'Đối tác' })).toBeInTheDocument()
  expect(within(stockCardTable).getByRole('button', { name: 'HD011036' })).toBeInTheDocument()
  expect(within(stockCardTable).getByText('Bán hàng')).toBeInTheDocument()
  expect(within(stockCardTable).getByText('300 000')).toBeInTheDocument()
  expect(within(stockCardTable).getByText('107 751,2')).toBeInTheDocument()
  expect(within(stockCardTable).getByText('-1,656')).toBeInTheDocument()
  expect(within(stockCardTable).getByText('18,344')).toBeInTheDocument()
  expect(within(stockCardTable).getByText('Khách lẻ')).toBeInTheDocument()
  expect(within(stockCardTable).queryByText('Chưa có')).not.toBeInTheDocument()
  expect(within(detail).getByRole('navigation', { name: 'Phân trang thẻ kho MICA-3MM' })).toHaveTextContent('1 - 1 trong 1 dòng')
})

it('creates an automatic stocktake link when adjusting normal product stock from product detail', async () => {
  const service = makeService()
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await userEvent.click(await screen.findByText('MICA-3MM'))
  const detail = screen.getByRole('region', { name: 'Chi tiết hàng hóa MICA-3MM' })

  await userEvent.click(within(detail).getByRole('tab', { name: 'Tồn kho' }))
  const inventoryPanel = within(detail).getByRole('region', { name: 'Tồn kho MICA-3MM' })
  await userEvent.type(within(inventoryPanel).getByLabelText('Tồn thực tế'), '12')
  await userEvent.type(within(inventoryPanel).getByLabelText('Lý do điều chỉnh'), 'Đếm lại kho')
  await userEvent.click(within(inventoryPanel).getByRole('button', { name: 'Cập nhật tồn' }))

  expect(service.adjustNormalProductStock).toHaveBeenCalledWith('p-1', {
    actual_qty: 12,
    reason: 'Đếm lại kho',
  })
  expect(await within(inventoryPanel).findByText(/Đã tạo phiếu kiểm kho KK000001/)).toBeInTheDocument()
  expect(within(inventoryPanel).getByRole('link', { name: /Xem phiếu KK000001/ })).toHaveAttribute(
    'href',
    '/inventory?stocktake_id=stocktake-1',
  )
})

it('shows KiotViet provisional stock and draft BOM metadata for imported products', async () => {
  const service = makeService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-kv',
          code: 'HH',
          name: 'Hop hoa',
          status: 'active' as const,
          unit_name: 'cai',
          sell_method: 'quantity' as const,
          latest_purchase_cost: 48520,
          default_sale_price: 200000,
          inventory_shape: 'normal' as const,
          product_kind: 'combo' as const,
          kiotviet_provisional_stock: {
            quantity: 4,
            unit_name: 'cai',
            source_type: 'kiotviet_import' as const,
            source_label: 'KiotViet product import',
          },
          draft_bom: {
            id: 'bom-draft-hh',
            version: 1,
            status: 'draft' as const,
            item_count: 2,
            notes: 'Imported from KiotViet product BOM. Review before activating.',
          },
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('HH')
  expect(screen.getByRole('columnheader', { name: 'Tồn QCVL' })).toBeInTheDocument()

  await userEvent.click(screen.getByText('HH'))
  const detail = screen.getByRole('region', { name: 'Chi tiết hàng hóa HH' })

  await userEvent.click(within(detail).getByRole('tab', { name: 'Tồn kho' }))
  const inventoryPanel = within(detail).getByRole('region', { name: 'Tồn kho HH' })
  expect(within(inventoryPanel).getByText('Tồn KV tạm nhập')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('4 cai')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('Chưa phải tồn kho vận hành')).toBeInTheDocument()

  await userEvent.click(within(detail).getByRole('tab', { name: 'BOM/Vật tư cấu thành' }))
  const bomPanel = within(detail).getByRole('region', { name: 'BOM HH' })
  expect(within(bomPanel).getByText('BOM nháp KiotViet')).toBeInTheDocument()
  expect(within(bomPanel).getByText('2 vật tư')).toBeInTheDocument()
  expect(within(bomPanel).getByText('Cần rà soát trước khi kích hoạt')).toBeInTheDocument()
})

it('shows calculated QCVL operating stock as the main product stock value', async () => {
  const service = makeService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-kv',
          code: 'BT',
          name: 'Bat 300g Ojet Tim',
          status: 'active' as const,
          unit_name: 'm2',
          sell_method: 'area_m2' as const,
          latest_purchase_cost: 20000,
          default_sale_price: 500000,
          inventory_shape: 'roll' as const,
          product_kind: 'roll' as const,
          operating_stock: {
            quantity: 156,
            unit_name: 'm2',
            source_type: 'stock_movements' as const,
            source_label: 'Nhap hang - hoa don',
          },
          kiotviet_provisional_stock: {
            quantity: 208,
            unit_name: 'm2',
            source_type: 'kiotviet_import' as const,
            source_label: 'KiotViet product import',
          },
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await screen.findByText('BT')
  expect(screen.getByRole('columnheader', { name: /Tồn QCVL/ })).toBeInTheDocument()
  expect(screen.getByText('156 m2')).toBeInTheDocument()

  await userEvent.click(screen.getByText('BT'))
  const detail = screen.getByRole('region', { name: 'Chi tiết hàng hóa BT' })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Tồn kho' }))
  const inventoryPanel = within(detail).getByRole('region', { name: 'Tồn kho BT' })
  expect(within(inventoryPanel).getByText('Tồn QCVL')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('156 m2')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('Tồn KV tạm nhập')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('208 m2')).toBeInTheDocument()
})

it('shows latest KiotViet stocktake evidence without replacing provisional stock', async () => {
  const service = makeService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-kv',
          code: 'HDA5',
          name: 'Hiflex 3m2',
          status: 'active' as const,
          unit_name: 'Cuộn',
          sell_method: 'quantity' as const,
          latest_purchase_cost: 48520,
          default_sale_price: 200000,
          inventory_shape: 'normal' as const,
          product_kind: 'goods' as const,
          kiotviet_provisional_stock: {
            quantity: 60,
            unit_name: 'Cuộn',
            source_type: 'kiotviet_import' as const,
            source_label: 'KiotViet product import',
          },
          latest_kiotviet_stocktake: {
            code: 'KK000333',
            source_created_at: '2026-07-10T09:30:00.000Z',
            source_balanced_at: '2026-07-10T09:45:00.000Z',
            system_qty: 60,
            actual_qty: 58,
            difference_qty: -2,
            unit_name: 'Cuộn',
          },
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await userEvent.click(await screen.findByText('HDA5'))
  const detail = screen.getByRole('region', { name: 'Chi tiết hàng hóa HDA5' })
  await userEvent.click(within(detail).getByRole('tab', { name: 'Tồn kho' }))
  const inventoryPanel = within(detail).getByRole('region', { name: 'Tồn kho HDA5' })

  expect(within(inventoryPanel).getByText('Tồn KV tạm nhập')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('60 Cuộn')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('Kiểm kho KiotViet gần nhất')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('KK000333')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('58 Cuộn')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('-2 Cuộn')).toBeInTheDocument()
  expect(within(inventoryPanel).getByText('Chỉ là lịch sử đối soát, không thay tồn tạm hiện tại')).toBeInTheDocument()
})

it('shows roll objects in the product inventory detail tab instead of allowing total stock edits', async () => {
  const service = makeService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-roll',
          code: 'BAT-32',
          name: 'Bạt 3.2m',
          status: 'active' as const,
          unit_name: 'm²',
          sell_method: 'linear_m' as const,
          latest_purchase_cost: 50000,
          inventory_shape: 'roll' as const,
          product_kind: 'roll' as const,
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    listInventoryRolls: vi.fn(async () => ({
      items: [
        {
          id: 'roll-1',
          product_id: 'p-roll',
          code: 'ROLL-001',
          width_m: 3.2,
          initial_length_m: 50,
          remaining_length_m: 18,
          initial_area_m2: 160,
          remaining_area_m2: 57.6,
          status: 'in_use' as const,
          note: null,
          created_at: '2026-07-07T00:00:00Z',
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
  })
  render(<CatalogPage service={service} onOpenDashboard={vi.fn()} />)

  await userEvent.click(await screen.findByText('BAT-32'))
  const detail = screen.getByRole('region', { name: 'Chi tiết hàng hóa BAT-32' })

  await userEvent.click(within(detail).getByRole('tab', { name: 'Tồn kho' }))

  expect(service.listInventoryRolls).toHaveBeenCalledWith({ product_id: 'p-roll', page: 1, page_size: 15 })
  expect(within(detail).queryByRole('button', { name: 'Cập nhật tồn' })).not.toBeInTheDocument()
  expect(within(detail).getByText('Sửa tồn tổng không áp dụng cho loại hàng này.')).toBeInTheDocument()
  const table = await within(detail).findByRole('table', { name: 'Tồn theo cuộn tấm BAT-32' })
  expect(within(table).getByText('ROLL-001')).toBeInTheDocument()
  expect(within(table).getByText('57,6 m²')).toBeInTheDocument()
})
