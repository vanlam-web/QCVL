import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PosShell } from './PosShell'
import { ThemeProvider } from '../../components/ui-shell/ThemeProvider'
import type { CatalogService } from '../catalog/catalog-service'
import type { InventoryService } from '../inventory/inventory-service'
import type { OrderService } from '../orders/order-service'
import type { ProductionQueueService } from '../production-queue/production-queue-service'
import { saveQuoteReopenPayload } from './quote-draft-handoff'

function makeCatalogService(overrides: Partial<CatalogService> = {}): CatalogService {
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
    previewKiotVietProductImport: vi.fn(),
    importKiotVietProducts: vi.fn(),
    deleteImportedKiotVietProducts: vi.fn(async () => ({ deleted_rows: 0, blocked_rows: 0 })),
    listStockMovements: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    listInventoryRolls: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    listInventorySheets: vi.fn(async () => ({ items: [], page: 1, page_size: 15, total: 0 })),
    adjustNormalProductStock: vi.fn(),
    listCustomers: vi.fn(async () => ({
      items: [
        {
          id: 'customer-1',
          code: 'KH000001',
          name: 'Khach le',
          phone: null,
          tax_code: null,
          address: null,
          customer_group_id: null,
          customer_group: null,
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    })),
    listCustomerGroups: vi.fn(async () => ({ items: [] })),
    createCustomer: vi.fn(),
    resolvePrices: vi.fn(async () => ({
      items: [
        {
          product_id: 'p-1',
          unit_price: 120000,
          price_source: 'default_price_list' as const,
          price_list_id: 'pl-1',
        },
      ],
    })),
    listPriceLists: vi.fn(async () => ({ items: [] })),
    previewPriceFormula: vi.fn(),
    applyPriceFormula: vi.fn(),
    ...overrides,
  }
}

function renderPosShell(overrides: {
  catalogService?: CatalogService
  inventoryService?: InventoryService
  orderService?: OrderService
  productionQueueService?: ProductionQueueService
  currentUser?: Parameters<typeof PosShell>[0]['currentUser']
  onOpenDashboard?: () => void
} = {}) {
  return render(
    <ThemeProvider>
      <PosShell
        catalogService={overrides.catalogService ?? makeCatalogService()}
        inventoryService={overrides.inventoryService ?? makeInventoryService()}
        orderService={overrides.orderService ?? makeOrderService()}
        productionQueueService={overrides.productionQueueService ?? makeProductionQueueService()}
        currentUser={
          overrides.currentUser ?? {
            user: { id: 'u-1', email: 'cashier@example.test', display_name: 'Cashier' },
            organization: { id: 'o-1', code: 'VAN-LAM', name: 'Xưởng Văn Lâm' },
            workstation: null,
            permissions: ['perm.create_order'],
          }
        }
        onSignOut={vi.fn()}
        onOpenAdmin={vi.fn()}
        onOpenDashboard={overrides.onOpenDashboard ?? vi.fn()}
      />
    </ThemeProvider>,
  )
}

function makeOrderService(overrides: Partial<OrderService> = {}): OrderService {
  return {
    validateCart: vi.fn(),
    checkout: vi.fn(),
    saveQuote: vi.fn(async () => ({
      id: 'quote-1',
      code: 'BG000001',
      order_type: 'quote' as const,
      status: 'active' as const,
      total_amount: 120000,
    })),
    getQuoteReopenPayload: vi.fn(),
    listFinanceAccounts: vi.fn(async () => ({ items: [] })),
    getCustomerDebt: vi.fn(async () => ({ customer_id: 'customer-1', total_debt: 0, invoices: [] })),
    listRecentCustomerProductPrices: vi.fn(async () => ({ items: [] })),
    ...overrides,
  }
}

function makeInventoryService(overrides: Partial<InventoryService> = {}): InventoryService {
  return {
    listInventoryProducts: vi.fn(),
    getInventoryProduct: vi.fn(),
    listStockMovements: vi.fn(),
    listStocktakes: vi.fn(),
    adjustNormalProductStock: vi.fn(),
    previewPosShortage: vi.fn(async () => ({
      product_id: 'p-1',
      quantity: 1,
      source: 'product' as const,
      shortages: [],
      warnings: [],
    })),
    getMaterialOpeningOptions: vi.fn(),
    createMaterialOpening: vi.fn(),
    ...overrides,
  } as InventoryService
}

beforeEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
})

async function openCheckoutDrawer() {
  await userEvent.click(await screen.findByRole('button', { name: 'Thanh toán' }))
  return screen.getByLabelText('Ngăn thanh toán')
}

function makeProductionQueueService(
  overrides: Partial<ProductionQueueService> = {},
): ProductionQueueService {
  return {
    listQueue: vi.fn(async () => ({ items: [], page: 1, page_size: 20, total: 0 })),
    listHistory: vi.fn(async () => ({ items: [], page: 1, page_size: 20, total: 0 })),
    addToDraft: vi.fn(),
    dismiss: vi.fn(),
    restore: vi.fn(),
    ...overrides,
  }
}

it('renders POS landmarks, profile identity, and active product grid', async () => {
  render(
    <ThemeProvider>
      <PosShell
        catalogService={makeCatalogService()}
        inventoryService={makeInventoryService()}
        orderService={makeOrderService()}
        productionQueueService={makeProductionQueueService()}
        currentUser={{
          user: { id: 'u-1', email: 'cashier@example.test', display_name: 'Cashier' },
          organization: { id: 'o-1', code: 'VAN-LAM', name: 'Xưởng Văn Lâm' },
          workstation: null,
          permissions: ['perm.create_order'],
        }}
        onSignOut={vi.fn()}
        onOpenAdmin={vi.fn()}
        onOpenDashboard={vi.fn()}
      />
    </ThemeProvider>,
  )

  expect(screen.getByLabelText('K01 topbar')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'QC' }).querySelector('.pos-brand-logo')).toHaveAttribute('src', '/brand-logo.png')
  expect(screen.getByLabelText('K02 giỏ hàng')).toBeInTheDocument()
  expect(screen.getByLabelText('K03 sản phẩm')).toBeInTheDocument()
  expect(screen.getByLabelText('K01 tìm kiếm')).toBeInTheDocument()
  expect(screen.getByLabelText('K01 tab hóa đơn')).toBeInTheDocument()
  expect(screen.getByLabelText('K01 tiện ích')).toBeInTheDocument()
  expect(within(screen.getByLabelText('K01 tiện ích')).getByRole('button', { name: 'Khui vật tư' })).toBeEnabled()
  const cartWorkspace = screen.getByLabelText('K02 giỏ hàng')
  const salesWorkspace = screen.getByLabelText('K03 sản phẩm')
  expect(within(cartWorkspace).queryByLabelText('Khách hàng')).not.toBeInTheDocument()
  expect(within(cartWorkspace).queryByLabelText('K02-D hàng đợi máy sản xuất')).not.toBeInTheDocument()
  expect(within(salesWorkspace).getByLabelText('Khách hàng')).toBeInTheDocument()
  expect(await within(salesWorkspace).findByLabelText('Sản phẩm nhanh')).toBeInTheDocument()
  expect(screen.getByLabelText('K02-D hàng đợi máy sản xuất')).toBeInTheDocument()
  expect(within(salesWorkspace).getByRole('button', { name: 'Thanh toán' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Ngăn thanh toán')).not.toBeInTheDocument()
  expect(screen.getByText('Hóa đơn 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tạo hóa đơn mới' })).toHaveTextContent('+')
  expect(screen.getByLabelText('connection status')).toHaveAttribute('title', 'Đã kết nối')
  expect(screen.getByRole('button', { name: 'Tài khoản' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Mica 3mm/ }))
  const cart = screen.getByLabelText('K02 giỏ hàng')
  expect(within(cart).getByText('Mica 3mm')).toBeInTheDocument()
  expect(within(cart).getAllByText('120 000').length).toBeGreaterThan(0)
})

it('loads enough quick products for local POS grid pagination on startup', async () => {
  const service = makeCatalogService()
  renderPosShell({ catalogService: service })

  await screen.findByRole('button', { name: /Mica 3mm/ })

  expect(service.listProducts).toHaveBeenCalledWith({ status: 'active', page: 1, page_size: 120, sort: 'pos_usage' })
})

it('replaces the K03 product panel with the checkout drawer while payment is open', async () => {
  renderPosShell()

  expect(await screen.findByLabelText('K03 sản phẩm')).toBeInTheDocument()

  await openCheckoutDrawer()

  expect(screen.getByLabelText('Ngăn thanh toán')).toBeInTheDocument()
  expect(screen.queryByLabelText('K03 sản phẩm')).not.toBeInTheDocument()
})

it('closes the checkout drawer when clicking outside it', async () => {
  renderPosShell()

  await openCheckoutDrawer()

  await userEvent.click(screen.getByLabelText('K02 giỏ hàng'))

  expect(screen.queryByLabelText('Ngăn thanh toán')).not.toBeInTheDocument()
  expect(await screen.findByLabelText('K03 sản phẩm')).toBeInTheDocument()
})

it('does not reload products when customer prices refresh', async () => {
  const service = makeCatalogService({
    resolvePrices: vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          {
            product_id: 'p-1',
            unit_price: 120000,
            price_source: 'default_price_list' as const,
            price_list_id: 'pl-default',
          },
        ],
      })
      .mockResolvedValue({
        items: [
          {
            product_id: 'p-1',
            unit_price: 90000,
            price_source: 'customer_group_price_list' as const,
            price_list_id: 'pl-customer',
          },
        ],
      }),
  })

  renderPosShell({ catalogService: service })

  await screen.findByRole('button', { name: /Mica 3mm/ })
  expect(service.listProducts).toHaveBeenCalledTimes(1)

  await userEvent.type(screen.getByLabelText('Tìm khách'), 'khach')
  await userEvent.keyboard('{Enter}')
  await userEvent.click(await screen.findByRole('option', { name: 'Chọn KH000001 Khach le' }))

  await waitFor(() => expect(service.resolvePrices).toHaveBeenCalledTimes(2))
  expect(service.listProducts).toHaveBeenCalledTimes(1)
})

it('uses the K01 F3 product search as an enabled product picker', async () => {
  renderPosShell()

  const search = screen.getByRole('textbox', { name: 'Tìm hàng (F3)' })
  expect(search).toBeEnabled()

  await userEvent.keyboard('{F3}')
  expect(search).toHaveFocus()

  await userEvent.type(search, 'mica')
  const results = await screen.findByRole('listbox', { name: 'Kết quả tìm hàng' })
  await userEvent.click(within(results).getByRole('option', { name: /MICA-3MM Mica 3mm/ }))

  const cart = screen.getByLabelText('K02 giỏ hàng')
  expect(within(cart).getByText('Mica 3mm')).toBeInTheDocument()
  expect(within(cart).getAllByText('120 000').length).toBeGreaterThan(0)
})

it('does not show quick material opening when preview has no supported shortage', async () => {
  const inventoryService = makeInventoryService()
  renderPosShell({ inventoryService })

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))

  await waitFor(() => expect(inventoryService.previewPosShortage).toHaveBeenCalledWith({ product_id: 'p-1', quantity: 1 }))
  expect(screen.queryByRole('button', { name: 'Khui vật tư Mica 3mm' })).not.toBeInTheDocument()
})

it('opens topbar manual material opening and submits normal material opening', async () => {
  const inventoryService = makeInventoryService({
    getMaterialOpeningOptions: vi.fn(async () => ({
      product: {
        id: 'p-1',
        code: 'MICA-3MM',
        name: 'Mica 3mm',
        inventory_shape: 'normal' as const,
        stock_unit: { id: 'unit-m', code: 'M', name: 'm' },
      },
      conversions: [{ unit_id: 'unit-roll', code: 'CUON', name: 'Cuộn', stock_qty_per_unit: 50 }],
      warnings: [],
    })),
    createMaterialOpening: vi.fn(async () => ({
      id: 'opening-manual',
      product_id: 'p-1',
      inventory_shape: 'normal' as const,
      source_type: 'manual_normal' as const,
      opened_unit_id: 'unit-roll',
      opened_qty: 2,
      opened_stock_qty: 100,
      stock_movement_id: null,
      warnings: [],
      created_at: '2026-07-05T00:00:00Z',
    })),
  })
  renderPosShell({ inventoryService })

  await screen.findByRole('button', { name: /Mica 3mm/ })
  await userEvent.click(screen.getByRole('button', { name: 'Khui vật tư' }))

  const dialog = await screen.findByRole('dialog', { name: 'Khui vật tư thủ công' })
  await userEvent.selectOptions(within(dialog).getByLabelText('Vật tư khui thủ công'), 'p-1')
  expect(inventoryService.getMaterialOpeningOptions).toHaveBeenCalledWith('p-1')
  await userEvent.clear(within(dialog).getByLabelText('Số lượng khui thủ công'))
  await userEvent.type(within(dialog).getByLabelText('Số lượng khui thủ công'), '2')
  await userEvent.clear(within(dialog).getByLabelText('Phần cũ còn lại thủ công'))
  await userEvent.type(within(dialog).getByLabelText('Phần cũ còn lại thủ công'), '1')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận khui' }))

  await waitFor(() =>
    expect(inventoryService.createMaterialOpening).toHaveBeenCalledWith({
      product_id: 'p-1',
      inventory_shape: 'normal',
      opened_unit_id: 'unit-roll',
      opened_qty: 2,
      old_remaining_qty: 1,
      note: 'Khui thủ công từ POS',
    }),
  )
  expect(screen.queryByRole('dialog', { name: 'Khui vật tư thủ công' })).not.toBeInTheDocument()
})

it('opens quick material opening prefilled for one supported shortage and rechecks preview after submit', async () => {
  const inventoryService = makeInventoryService({
    previewPosShortage: vi
      .fn()
      .mockResolvedValueOnce({
        product_id: 'p-1',
        quantity: 1,
        source: 'product',
        shortages: [
          {
            product_id: 'mat-1',
            code: 'GIAY-A4',
            name: 'Giấy A4',
            required_qty: 5,
            available_qty: 2,
            shortage_qty: 3,
            stock_unit: { id: 'unit-sheet', code: 'TO', name: 'Tờ' },
            inventory_shape: 'normal' as const,
            quick_material_opening_supported: true,
            conversion_options: [{ unit_id: 'unit-ram', code: 'RAM', name: 'Ram', stock_qty_per_unit: 500 }],
          },
        ],
        warnings: [],
      })
      .mockResolvedValue({
        product_id: 'p-1',
        quantity: 1,
        source: 'product' as const,
        shortages: [],
        warnings: [],
      }),
    getMaterialOpeningOptions: vi.fn(async () => ({
      product: {
        id: 'mat-1',
        code: 'GIAY-A4',
        name: 'Giấy A4',
        inventory_shape: 'normal' as const,
        stock_unit: { id: 'unit-sheet', code: 'TO', name: 'Tờ' },
      },
      conversions: [{ unit_id: 'unit-ram', code: 'RAM', name: 'Ram', stock_qty_per_unit: 500 }],
      warnings: [],
    })),
    createMaterialOpening: vi.fn(async () => ({
      id: 'opening-1',
      product_id: 'mat-1',
      inventory_shape: 'normal' as const,
      source_type: 'manual_normal' as const,
      opened_unit_id: 'unit-ram',
      opened_qty: 1,
      opened_stock_qty: 500,
      stock_movement_id: null,
      warnings: [],
      created_at: '2026-07-05T00:00:00Z',
    })),
  })
  renderPosShell({ inventoryService })

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  const quickButton = await screen.findByRole('button', { name: 'Khui vật tư Mica 3mm' })
  expect(screen.getByText('Thiếu vật tư: Giấy A4 thiếu 3 Tờ')).toBeInTheDocument()

  await userEvent.click(quickButton)

  const dialog = await screen.findByRole('dialog', { name: 'Khui vật tư nhanh' })
  expect(within(dialog).getByText('GIAY-A4 Giấy A4')).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Chọn Giấy A4')).toBeChecked()
  expect(within(dialog).getByLabelText('Số lượng khui Giấy A4')).toHaveValue(1)
  expect(within(dialog).getByLabelText('Đơn vị khui Giấy A4')).toHaveValue('unit-ram')

  await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận khui' }))

  await waitFor(() =>
    expect(inventoryService.createMaterialOpening).toHaveBeenCalledWith({
      product_id: 'mat-1',
      inventory_shape: 'normal',
      opened_unit_id: 'unit-ram',
      opened_qty: 1,
      old_remaining_qty: 0,
      note: 'Khui nhanh từ POS: Mica 3mm',
    }),
  )
  await waitFor(() => expect(inventoryService.previewPosShortage).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('dialog', { name: 'Khui vật tư nhanh' })).not.toBeInTheDocument()
})

it('lets staff choose one or many supported shortage materials before opening', async () => {
  const inventoryService = makeInventoryService({
    previewPosShortage: vi.fn(async () => ({
      product_id: 'p-1',
      quantity: 1,
      source: 'standard_bom' as const,
      bom_id: 'bom-1',
      shortages: [
        {
          product_id: 'mat-1',
          code: 'LED',
          name: 'Bóng LED',
          required_qty: 10,
          available_qty: 4,
          shortage_qty: 6,
          stock_unit: { id: 'unit-led', code: 'CON', name: 'Con' },
          inventory_shape: 'normal' as const,
          quick_material_opening_supported: true,
          conversion_options: [{ unit_id: 'unit-bag', code: 'BAO', name: 'Bao', stock_qty_per_unit: 100 }],
        },
        {
          product_id: 'mat-2',
          code: 'GIAY',
          name: 'Giấy ảnh',
          required_qty: 3,
          available_qty: 0,
          shortage_qty: 3,
          stock_unit: { id: 'unit-sheet', code: 'TO', name: 'Tờ' },
          inventory_shape: 'normal' as const,
          quick_material_opening_supported: true,
          conversion_options: [{ unit_id: 'unit-ram', code: 'RAM', name: 'Ram', stock_qty_per_unit: 500 }],
        },
      ],
      warnings: [],
    })),
    getMaterialOpeningOptions: vi.fn(async (productId: string) => ({
      product: {
        id: productId,
        code: productId === 'mat-1' ? 'LED' : 'GIAY',
        name: productId === 'mat-1' ? 'Bóng LED' : 'Giấy ảnh',
        inventory_shape: 'normal' as const,
        stock_unit: { id: 'unit-stock', code: 'DV', name: 'Đơn vị' },
      },
      conversions: productId === 'mat-1'
        ? [{ unit_id: 'unit-bag', code: 'BAO', name: 'Bao', stock_qty_per_unit: 100 }]
        : [{ unit_id: 'unit-ram', code: 'RAM', name: 'Ram', stock_qty_per_unit: 500 }],
      warnings: [],
    })),
    createMaterialOpening: vi.fn(async (input) => ({
      id: `opening-${input.product_id}`,
      product_id: input.product_id,
      inventory_shape: 'normal' as const,
      source_type: 'manual_normal' as const,
      opened_unit_id: input.opened_unit_id,
      opened_qty: input.opened_qty,
      opened_stock_qty: 100,
      stock_movement_id: null,
      warnings: [],
      created_at: '2026-07-05T00:00:00Z',
    })),
  })
  renderPosShell({ inventoryService })

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Khui vật tư Mica 3mm' }))

  const dialog = await screen.findByRole('dialog', { name: 'Khui vật tư nhanh' })
  expect(within(dialog).getByLabelText('Chọn Bóng LED')).toBeChecked()
  expect(within(dialog).getByLabelText('Chọn Giấy ảnh')).toBeChecked()

  await userEvent.click(within(dialog).getByLabelText('Chọn Giấy ảnh'))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận khui' }))

  await waitFor(() => expect(inventoryService.createMaterialOpening).toHaveBeenCalledTimes(1))
  expect(inventoryService.createMaterialOpening).toHaveBeenCalledWith(expect.objectContaining({ product_id: 'mat-1' }))
})

it('keeps quote and checkout actions available while shortage warning is visible', async () => {
  const inventoryService = makeInventoryService({
    previewPosShortage: vi.fn(async () => ({
      product_id: 'p-1',
      quantity: 1,
      source: 'product' as const,
      shortages: [
        {
          product_id: 'mat-1',
          code: 'GIAY-A4',
          name: 'Giấy A4',
          required_qty: 5,
          available_qty: 2,
          shortage_qty: 3,
          stock_unit: { id: 'unit-sheet', code: 'TO', name: 'Tờ' },
          inventory_shape: 'normal' as const,
          quick_material_opening_supported: true,
          conversion_options: [{ unit_id: 'unit-ram', code: 'RAM', name: 'Ram', stock_qty_per_unit: 500 }],
        },
      ],
      warnings: [],
    })),
  })
  renderPosShell({ inventoryService })

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await screen.findByRole('button', { name: 'Khui vật tư Mica 3mm' })
  const checkoutDrawer = await openCheckoutDrawer()

  expect(within(checkoutDrawer).getByRole('button', { name: 'Báo giá' })).toBeEnabled()
  expect(within(checkoutDrawer).getByRole('button', { name: 'Tạo hóa đơn' })).toBeEnabled()
})

it('keeps K01 utility actions visible beside connection and profile', async () => {
  renderPosShell()

  const actions = screen.getByLabelText('K01 tiện ích')
  expect(within(actions).getByRole('button', { name: 'Khui vật tư' })).toBeInTheDocument()
  expect(within(actions).getByRole('button', { name: 'Lịch sử 10 đơn gần nhất' })).toBeInTheDocument()
  expect(within(actions).queryByRole('button', { name: 'Tải lại giao diện' })).not.toBeInTheDocument()
  expect(within(actions).getByLabelText('connection status')).toHaveAttribute('title', 'Đã kết nối')
  const userActions = within(actions).getByLabelText('Tài khoản và giao diện')
  expect(within(userActions).getByRole('button', { name: 'Đổi sang giao diện tối' })).toBeInTheDocument()
  expect(within(userActions).getByRole('button', { name: 'Tài khoản' })).toBeInTheDocument()
})

it('uses the QC brand button as a dashboard shortcut', async () => {
  const onOpenDashboard = vi.fn()
  renderPosShell({ onOpenDashboard })

  const search = screen.getByLabelText('K01 tìm kiếm')
  expect(within(search).queryByText('QC-OMS POS')).not.toBeInTheDocument()

  await userEvent.click(within(search).getByRole('button', { name: 'QC' }))

  expect(onOpenDashboard).toHaveBeenCalledTimes(1)
})

it('keeps cart lines isolated between invoice tabs', async () => {
  renderPosShell()

  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn mới' }))
  expect(screen.getByRole('button', { name: 'Hóa đơn 2' })).toHaveAttribute('aria-current', 'true')

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  expect(screen.getByLabelText('K02 giỏ hàng')).toHaveTextContent('Mica 3mm')

  expect(screen.getByRole('button', { name: 'HĐ 1' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đóng Hóa đơn 1' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'HĐ 1' }))
  expect(screen.getByRole('button', { name: 'Hóa đơn 1' })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByRole('button', { name: 'HĐ 2 •' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đóng Hóa đơn 2' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('K02 giỏ hàng')).not.toHaveTextContent('Mica 3mm')

  await userEvent.click(screen.getByRole('button', { name: 'HĐ 2 •' }))
  expect(screen.getByLabelText('K02 giỏ hàng')).toHaveTextContent('Mica 3mm')
})

it('removes the completed draft tab after checkout and keeps another draft open', async () => {
  const orderService = makeOrderService({
    checkout: vi.fn(async () => ({
      order: {
        id: 'order-1',
        code: 'HD000001',
        order_type: 'invoice' as const,
        status: 'completed' as const,
        total_amount: 120000,
        paid_amount: 120000,
        debt_amount: 0,
        payment_status: 'paid' as const,
      },
      payment_receipt: null,
      inventory_warnings: [],
    })),
  })
  renderPosShell({ orderService })

  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn mới' }))
  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))

  const checkoutDrawer = await openCheckoutDrawer()
  await userEvent.click(within(checkoutDrawer).getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(orderService.checkout).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Hóa đơn 2 •' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hóa đơn 1' })).toHaveAttribute('aria-current', 'true')
  expect(screen.queryByLabelText('Ngăn thanh toán')).not.toBeInTheDocument()
})

it('removes the completed draft tab after saving a quote', async () => {
  const orderService = makeOrderService()
  renderPosShell({ orderService })

  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn mới' }))
  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))

  const checkoutDrawer = await openCheckoutDrawer()
  await userEvent.click(within(checkoutDrawer).getByRole('button', { name: 'Báo giá' }))

  expect(orderService.saveQuote).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Hóa đơn 2 •' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hóa đơn 1' })).toHaveAttribute('aria-current', 'true')
  expect(screen.queryByLabelText('Ngăn thanh toán')).not.toBeInTheDocument()
})

it('restores local invoice draft tabs after POS remount', async () => {
  const { unmount } = renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn mới' }))
  await userEvent.click(screen.getByRole('button', { name: 'HĐ 1 •' }))
  expect(screen.getByLabelText('K02 giỏ hàng')).toHaveTextContent('Mica 3mm')

  unmount()
  renderPosShell()

  expect(screen.getByRole('button', { name: 'Hóa đơn 1 •' })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByRole('button', { name: 'HĐ 2' })).toBeInTheDocument()
  expect(screen.getByLabelText('K02 giỏ hàng')).toHaveTextContent('Mica 3mm')
})

it('closes empty invoice tabs immediately', async () => {
  renderPosShell()

  await userEvent.click(screen.getByRole('button', { name: 'Tạo hóa đơn mới' }))
  expect(screen.getByRole('button', { name: 'Hóa đơn 2' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Đóng Hóa đơn 2' }))

  expect(screen.queryByRole('button', { name: 'Hóa đơn 2' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hóa đơn 1' })).toHaveAttribute('aria-current', 'true')
})

it('requires confirmation before closing a dirty invoice tab', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Đóng Hóa đơn 1' }))

  expect(confirm).toHaveBeenCalledWith('Đơn hàng này chưa được lưu, bạn có chắc chắn muốn xóa không?')
  expect(screen.getByRole('button', { name: 'Hóa đơn 1 •' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Đóng Hóa đơn 1' }))

  expect(screen.getByRole('button', { name: 'Hóa đơn 1' })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByLabelText('K02 giỏ hàng')).not.toHaveTextContent('Mica 3mm')
  confirm.mockRestore()
})

it('resolves prices again with the selected customer', async () => {
  const service = makeCatalogService()

  renderPosShell({ catalogService: service })

  await userEvent.type(screen.getByLabelText('Tìm khách'), 'khach')
  await userEvent.keyboard('{Enter}')
  await userEvent.click(await screen.findByRole('option', { name: 'Chọn KH000001 Khach le' }))

  expect(await screen.findByDisplayValue('Khach le')).toBeInTheDocument()
  expect(service.resolvePrices).toHaveBeenCalledWith(['p-1'], 'customer-1')
})

it('lets the cashier edit quantity and unit price in the cart', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  const cart = screen.getByLabelText('K02 giỏ hàng')
  await userEvent.clear(screen.getByLabelText('Số lượng Mica 3mm'))
  await userEvent.type(screen.getByLabelText('Số lượng Mica 3mm'), '3')
  expect(within(cart).getAllByText('360 000').length).toBeGreaterThan(0)

  await userEvent.clear(screen.getByLabelText('Đơn giá Mica 3mm'))
  await userEvent.type(screen.getByLabelText('Đơn giá Mica 3mm'), '100000')

  expect(screen.getByLabelText('Đơn giá Mica 3mm')).toHaveValue('100 000')
  expect(within(cart).getAllByText('300 000').length).toBeGreaterThan(0)
})

it('focuses quantity for normal products and lets Tab move to unit price', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))

  const quantityInput = screen.getByLabelText('Số lượng Mica 3mm')
  await waitFor(() => expect(quantityInput).toHaveFocus())

  await userEvent.tab()

  expect(screen.getByLabelText('Đơn giá Mica 3mm')).toHaveFocus()
})

it('selects the whole value on first click and lets the second click place the cursor', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))

  const priceInput = screen.getByLabelText('Đơn giá Mica 3mm') as HTMLInputElement
  fireEvent.mouseDown(priceInput)
  priceInput.focus()

  expect(priceInput.selectionStart).toBe(0)
  expect(priceInput.selectionEnd).toBe(priceInput.value.length)
  expect(fireEvent.mouseUp(priceInput)).toBe(false)

  fireEvent.mouseDown(priceInput, { clientX: 999 })

  expect(fireEvent.mouseUp(priceInput)).toBe(true)
  await waitFor(() => expect(priceInput.selectionStart).toBe(priceInput.value.length))
  expect(priceInput.selectionEnd).toBe(priceInput.value.length)
})

it('focuses the primary cart input when selecting the line background', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await waitFor(() => expect(screen.getByLabelText('Số lượng Mica 3mm')).toHaveFocus())

  await userEvent.click(screen.getByLabelText('Đơn giá Mica 3mm'))
  expect(screen.getByLabelText('Đơn giá Mica 3mm')).toHaveFocus()

  const row = screen.getByLabelText('Số lượng Mica 3mm').closest('.pos-cart-line-shell')
  expect(row).not.toBeNull()
  await userEvent.click(row as HTMLElement)

  await waitFor(() => expect(screen.getByLabelText('Số lượng Mica 3mm')).toHaveFocus())
})

it('expands price columns for long money values without changing the measure format', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  const priceInput = screen.getByLabelText('Đơn giá Mica 3mm')

  await userEvent.clear(priceInput)
  await userEvent.type(priceInput, '2222222222222220')

  expect(priceInput).toHaveValue('2 222 222 222 222 220')
  expect(priceInput).toHaveStyle({ width: '19.55ch' })
  expect(priceInput.closest('.pos-cart-lines')).toHaveStyle({
    '--pos-line-price-width': '12.51rem',
    '--pos-line-total-width': '12.51rem',
  })
})

it('lets the cashier enter width, height, and count for m2 products', async () => {
  const orderService = makeOrderService()
  const catalogService = makeCatalogService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-area',
          code: 'DECAL-PP',
          name: 'Decal PP',
          status: 'active' as const,
          unit_name: 'm²',
          sell_method: 'area_m2' as const,
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    })),
    resolvePrices: vi.fn(async () => ({
      items: [
        {
          product_id: 'p-area',
          unit_price: 20000,
          price_source: 'default_price_list' as const,
          price_list_id: 'pl-1',
        },
      ],
    })),
  })

  renderPosShell({ catalogService, orderService })

  await userEvent.click(await screen.findByRole('button', { name: /Decal PP/ }))
  fireEvent.change(screen.getByLabelText('Rộng Decal PP'), { target: { value: '1.2' } })
  fireEvent.change(screen.getByLabelText('Dài Decal PP'), { target: { value: '3.3' } })
  fireEvent.change(screen.getByLabelText('Số tấm Decal PP'), { target: { value: '2' } })

  const cart = screen.getByLabelText('K02 giỏ hàng')
  expect(within(cart).getByLabelText('Diện tích Decal PP')).toHaveTextContent('7.92 m²')
  expect(within(cart).getAllByText('158 400').length).toBeGreaterThan(0)

  const checkoutDrawer = await openCheckoutDrawer()
  await userEvent.clear(within(checkoutDrawer).getByLabelText('Khách thanh toán'))
  await userEvent.type(within(checkoutDrawer).getByLabelText('Khách thanh toán'), '158400')
  await userEvent.click(within(checkoutDrawer).getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(orderService.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [
        expect.objectContaining({
          product_id: 'p-area',
          quantity: 7.92,
          width_m: 1.2,
          height_m: 3.3,
        }),
      ],
    }),
  )
})

it('focuses width for m2 products and lets Tab move through measurement fields', async () => {
  const catalogService = makeCatalogService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-area',
          code: 'DECAL-PP',
          name: 'Decal PP',
          status: 'active' as const,
          unit_name: 'm²',
          sell_method: 'area_m2' as const,
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    })),
    resolvePrices: vi.fn(async () => ({
      items: [
        {
          product_id: 'p-area',
          unit_price: 20000,
          price_source: 'default_price_list' as const,
          price_list_id: 'pl-1',
        },
      ],
    })),
  })

  renderPosShell({ catalogService })

  await userEvent.click(await screen.findByRole('button', { name: /Decal PP/ }))

  const widthInput = screen.getByLabelText('Rộng Decal PP')
  await waitFor(() => expect(widthInput).toHaveFocus())

  await userEvent.tab()

  expect(screen.getByLabelText('Dài Decal PP')).toHaveFocus()
})

it('replaces the selected m2 width with a dot decimal after adding a product', async () => {
  const catalogService = makeCatalogService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-area',
          code: 'DECAL-PP',
          name: 'Decal PP',
          status: 'active' as const,
          unit_name: 'm²',
          sell_method: 'area_m2' as const,
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    })),
    resolvePrices: vi.fn(async () => ({
      items: [
        {
          product_id: 'p-area',
          unit_price: 20000,
          price_source: 'default_price_list' as const,
          price_list_id: 'pl-1',
        },
      ],
    })),
  })

  renderPosShell({ catalogService })

  await userEvent.click(await screen.findByRole('button', { name: /Decal PP/ }))
  const widthInput = screen.getByLabelText('Rộng Decal PP')
  await waitFor(() => expect(widthInput).toHaveFocus())

  fireEvent.change(widthInput, { target: { value: '1.2' } })

  expect(widthInput).toHaveValue('1.2')
  expect(screen.getByLabelText('Diện tích Decal PP')).toHaveTextContent('1.2 m²')
})

it('shows cart row headers, line note, and add-row action while editing a line', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await userEvent.click(screen.getByLabelText('Số lượng Mica 3mm'))

  expect(screen.getByLabelText('Cột dòng Mica 3mm')).toHaveTextContent('STT')
  expect(screen.getByLabelText('Cột dòng Mica 3mm')).toHaveTextContent('Tên hàng')
  expect(screen.getByLabelText('Cột dòng Mica 3mm')).toHaveTextContent('Đơn giá')
  await userEvent.clear(screen.getByLabelText('Số lượng Mica 3mm'))
  await userEvent.type(screen.getByLabelText('Số lượng Mica 3mm'), '3')
  await userEvent.clear(screen.getByLabelText('Đơn giá Mica 3mm'))
  await userEvent.type(screen.getByLabelText('Đơn giá Mica 3mm'), '100000')
  await userEvent.type(screen.getByLabelText('Chú thích Mica 3mm'), 'Cắt gấp')
  await userEvent.click(screen.getByRole('button', { name: 'Thêm dòng Mica 3mm' }))

  expect(screen.getAllByLabelText('Số lượng Mica 3mm').map((input) => (input as HTMLInputElement).value)).toEqual(['3', '1'])
  expect(screen.getAllByLabelText('Đơn giá Mica 3mm').map((input) => (input as HTMLInputElement).value)).toEqual(['100 000', '120 000'])
  await waitFor(() => expect(screen.getAllByLabelText('Số lượng Mica 3mm')[1]).toHaveFocus())
})

it('adds a default area line after the current row and focuses the new width field', async () => {
  const catalogService = makeCatalogService({
    listProducts: vi.fn(async () => ({
      items: [
        {
          id: 'p-area',
          code: 'DECAL-PP',
          name: 'Decal PP',
          status: 'active' as const,
          unit_name: 'm²',
          sell_method: 'area_m2' as const,
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    })),
    resolvePrices: vi.fn(async () => ({
      items: [
        {
          product_id: 'p-area',
          unit_price: 40000,
          price_source: 'default_price_list' as const,
          price_list_id: 'pl-1',
        },
      ],
    })),
  })
  renderPosShell({ catalogService })

  await userEvent.click(await screen.findByRole('button', { name: /Decal PP/ }))
  fireEvent.change(screen.getByLabelText('Rộng Decal PP'), { target: { value: '1.2' } })
  fireEvent.change(screen.getByLabelText('Dài Decal PP'), { target: { value: '2.2' } })
  fireEvent.change(screen.getByLabelText('Số tấm Decal PP'), { target: { value: '4' } })
  await userEvent.click(screen.getByLabelText('Rộng Decal PP'))

  await userEvent.click(screen.getByRole('button', { name: 'Thêm dòng Decal PP' }))

  const widthInputs = screen.getAllByLabelText('Rộng Decal PP')
  const heightInputs = screen.getAllByLabelText('Dài Decal PP')
  const pieceInputs = screen.getAllByLabelText('Số tấm Decal PP')
  expect(widthInputs.map((input) => (input as HTMLInputElement).value)).toEqual(['1.2', '1'])
  expect(heightInputs.map((input) => (input as HTMLInputElement).value)).toEqual(['2.2', '1'])
  expect(pieceInputs.map((input) => (input as HTMLInputElement).value)).toEqual(['4', '1'])
  await waitFor(() => expect(widthInputs[1]).toHaveFocus())
})

it('shows the cart column header only when no row is active', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))

  await waitFor(() => expect(screen.queryByLabelText('Cột dòng hàng')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByLabelText('Cột dòng Mica 3mm')).toBeInTheDocument())

  await userEvent.click(screen.getByRole('textbox', { name: 'Tìm hàng (F3)' }))

  const header = screen.getByLabelText('Cột dòng hàng')
  expect(header).toHaveTextContent('STT')
  expect(header).toHaveTextContent('Tên hàng')
  expect(header).toHaveTextContent('SL')
  expect(header).toHaveTextContent('Đơn giá')
  expect(header).toHaveTextContent('Thành tiền')
  expect(screen.queryByLabelText('Cột dòng Mica 3mm')).not.toBeInTheDocument()
})

it('collapses cart row details after hover and focus leave the line', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  const row = screen.getByLabelText('Số lượng Mica 3mm').closest('.pos-cart-line-shell')
  expect(row).not.toBeNull()

  await userEvent.hover(row as HTMLElement)
  expect(screen.getByLabelText('Cột dòng Mica 3mm')).toBeInTheDocument()

  await userEvent.unhover(row as HTMLElement)
  await waitFor(() => expect(screen.getByLabelText('Cột dòng Mica 3mm')).toBeInTheDocument())

  await userEvent.click(screen.getByLabelText('Số lượng Mica 3mm'))
  expect(screen.getByLabelText('Cột dòng Mica 3mm')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('textbox', { name: 'Tìm hàng (F3)' }))
  await waitFor(() =>
    expect(screen.queryByLabelText('Cột dòng Mica 3mm')).not.toBeInTheDocument(),
  )
})

it('keeps the selected cart line expanded when another line is hovered', async () => {
  renderPosShell()

  const productButton = await screen.findByRole('button', { name: /Mica 3mm/ })
  await userEvent.click(productButton)
  await userEvent.click(productButton)
  const rows = screen.getAllByLabelText('Số lượng Mica 3mm').map((input) =>
    input.closest('.pos-cart-line-shell'),
  )
  expect(rows).toHaveLength(2)

  await userEvent.click(screen.getAllByLabelText('Số lượng Mica 3mm')[0])
  expect(screen.getByLabelText('Cột dòng Mica 3mm')).toBeInTheDocument()

  await userEvent.hover(rows[1] as HTMLElement)

  expect(screen.getAllByLabelText('Cột dòng Mica 3mm')).toHaveLength(1)
  expect(rows[0]).toHaveAttribute('data-active', 'true')
  expect(rows[1]).toHaveAttribute('data-active', 'false')
})

it('shows remove in the header and add-row action in the note row while selected or hovered', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  const row = screen.getByLabelText('Số lượng Mica 3mm').closest('.pos-cart-line-shell')
  expect(row).not.toBeNull()

  await userEvent.click(screen.getByRole('textbox', { name: 'Tìm hàng (F3)' }))
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Xóa Mica 3mm' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thêm dòng Mica 3mm' })).not.toBeInTheDocument()
  })

  await userEvent.hover(row as HTMLElement)
  expect(screen.getByRole('button', { name: 'Xóa Mica 3mm' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Thêm dòng Mica 3mm' })).toBeInTheDocument()

  await userEvent.click(screen.getByLabelText('Số lượng Mica 3mm'))
  expect(screen.getByRole('button', { name: 'Xóa Mica 3mm' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Thêm dòng Mica 3mm' })).toBeInTheDocument()
})

it('closes the discount editor when focus moves away from the cart line', async () => {
  renderPosShell({
    currentUser: {
      user: { id: 'u-1', email: 'cashier@example.test', display_name: 'Cashier' },
      organization: { id: 'o-1', code: 'VAN-LAM', name: 'Xưởng Văn Lâm' },
      workstation: null,
      permissions: ['perm.create_order', 'perm.apply_discount'],
    },
  })

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await userEvent.click(screen.getByLabelText('Đơn giá Mica 3mm'))
  expect(screen.queryByLabelText('Chiết khấu Mica 3mm')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mở chiết khấu Mica 3mm' }))
  expect(screen.getByLabelText('Chiết khấu Mica 3mm')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('textbox', { name: 'Tìm hàng (F3)' }))

  await waitFor(() =>
    expect(screen.queryByLabelText('Chiết khấu Mica 3mm')).not.toBeInTheDocument(),
  )
})

it('shows recent customer prices from the discount editor and applies a selected price', async () => {
  const orderService = makeOrderService({
    listRecentCustomerProductPrices: vi.fn(async () => ({
      items: [
        { unitPrice: 99000, soldAt: '2026-07-01T10:00:00Z', orderCode: 'HD000111' },
      ],
    })),
  })
  renderPosShell({
    orderService,
    currentUser: {
      user: { id: 'u-1', email: 'cashier@example.test', display_name: 'Cashier' },
      organization: { id: 'o-1', code: 'VAN-LAM', name: 'Xưởng Văn Lâm' },
      workstation: null,
      permissions: ['perm.create_order', 'perm.apply_discount'],
    },
  })

  await userEvent.type(screen.getByLabelText('Tìm khách'), 'khach')
  await userEvent.keyboard('{Enter}')
  await userEvent.click(await screen.findByRole('option', { name: 'Chọn KH000001 Khach le' }))
  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await userEvent.click(screen.getByLabelText('Đơn giá Mica 3mm'))
  await userEvent.click(screen.getByRole('button', { name: 'Mở chiết khấu Mica 3mm' }))
  await userEvent.click(screen.getByRole('button', { name: 'Lịch sử giá Mica 3mm' }))

  expect(orderService.listRecentCustomerProductPrices).toHaveBeenCalledWith('customer-1', 'p-1')
  await userEvent.click(await screen.findByRole('button', { name: 'HD000111 99 000' }))

  expect(screen.getByLabelText('Đơn giá Mica 3mm')).toHaveValue('99 000')
})

it('lets operators with apply_discount enter a line discount', async () => {
  const orderService = makeOrderService()
  renderPosShell({
    orderService,
    currentUser: {
      user: { id: 'u-1', email: 'cashier@example.test', display_name: 'Cashier' },
      organization: { id: 'o-1', code: 'VAN-LAM', name: 'Xưởng Văn Lâm' },
      workstation: null,
      permissions: ['perm.create_order', 'perm.apply_discount'],
    },
  })

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await userEvent.click(screen.getByLabelText('Đơn giá Mica 3mm'))
  await userEvent.click(screen.getByRole('button', { name: 'Mở chiết khấu Mica 3mm' }))
  await userEvent.clear(await screen.findByLabelText('Giảm giá Mica 3mm'))
  await userEvent.type(screen.getByLabelText('Giảm giá Mica 3mm'), '40000')

  const cart = screen.getByLabelText('K02 giỏ hàng')
  expect(within(cart).getAllByText('80 000').length).toBeGreaterThan(0)

  const checkoutDrawer = await openCheckoutDrawer()
  await userEvent.clear(within(checkoutDrawer).getByLabelText('Khách thanh toán'))
  await userEvent.type(within(checkoutDrawer).getByLabelText('Khách thanh toán'), '80000')
  await userEvent.click(within(checkoutDrawer).getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(orderService.checkout).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [expect.objectContaining({ discount_amount: 40000 })],
      payment: expect.objectContaining({ cash_amount: 80000 }),
    }),
  )
})

it('lets operators switch line discount to percent', async () => {
  renderPosShell({
    currentUser: {
      user: { id: 'u-1', email: 'cashier@example.test', display_name: 'Cashier' },
      organization: { id: 'o-1', code: 'VAN-LAM', name: 'Xưởng Văn Lâm' },
      workstation: null,
      permissions: ['perm.create_order', 'perm.apply_discount'],
    },
  })

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))
  await userEvent.click(screen.getByLabelText('Đơn giá Mica 3mm'))
  await userEvent.click(screen.getByRole('button', { name: 'Mở chiết khấu Mica 3mm' }))
  await userEvent.click(screen.getByRole('button', { name: '%' }))
  await userEvent.clear(await screen.findByLabelText('Giảm giá Mica 3mm'))
  await userEvent.type(screen.getByLabelText('Giảm giá Mica 3mm'), '50')

  const cart = screen.getByLabelText('K02 giỏ hàng')
  expect(within(cart).getAllByText('60 000').length).toBeGreaterThan(0)
})

it('hides line discount editing without apply_discount permission', async () => {
  renderPosShell()

  await userEvent.click(await screen.findByRole('button', { name: /Mica 3mm/ }))

  expect(screen.queryByLabelText('Giảm giá Mica 3mm')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mở chiết khấu Mica 3mm' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('K02 giỏ hàng')).toHaveTextContent('120 000')
})

it('updates automatic cart prices on customer change but preserves manual prices', async () => {
  const service = makeCatalogService({
    resolvePrices: vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          {
            product_id: 'p-1',
            unit_price: 120000,
            price_source: 'default_price_list' as const,
            price_list_id: 'pl-default',
          },
        ],
      })
      .mockResolvedValue({
        items: [
          {
            product_id: 'p-1',
            unit_price: 90000,
            price_source: 'customer_group_price_list' as const,
            price_list_id: 'pl-customer',
          },
        ],
      }),
  })

  renderPosShell({ catalogService: service })

  await userEvent.click(
    within(await screen.findByLabelText('Sản phẩm nhanh')).getByRole('button', {
      name: /Mica 3mm/,
    }),
  )
  await userEvent.clear(screen.getByLabelText('Đơn giá Mica 3mm'))
  await userEvent.type(screen.getByLabelText('Đơn giá Mica 3mm'), '100000')

  await userEvent.type(screen.getByLabelText('Tìm khách'), 'khach')
  await userEvent.keyboard('{Enter}')
  await userEvent.click(await screen.findByRole('option', { name: 'Chọn KH000001 Khach le' }))

  expect(await screen.findByDisplayValue('Khach le')).toBeInTheDocument()
  expect(screen.getByLabelText('Đơn giá Mica 3mm')).toHaveValue('100 000')
  expect(screen.getByLabelText('Đơn giá Mica 3mm')).toHaveValue('100 000')

  await userEvent.click(
    within(screen.getByLabelText('Sản phẩm nhanh')).getByRole('button', { name: /Mica 3mm/ }),
  )
  const priceInputs = screen.getAllByLabelText('Đơn giá Mica 3mm')
  expect(priceInputs[1]).toHaveValue('90 000')
})

it('adds a production queue payload to the local draft cart without checkout', async () => {
  const catalogService = makeCatalogService({
    resolvePrices: vi.fn(async () => ({
      items: [
        {
          product_id: 'p-2',
          unit_price: 65000,
          price_source: 'default_price_list' as const,
          price_list_id: 'pl-1',
        },
      ],
    })),
  })
  const orderService = makeOrderService()
  const productionQueueService = makeProductionQueueService({
    listQueue: vi.fn(async () => ({
      items: [
        {
          id: 'queue-1',
          production_machine: { id: 'machine-1', code: 'IN-DECAL', name: 'In decal' },
          raw_file_name: 'KH000001_DECAL-PP_120x50_x2',
          received_at: '2026-07-01T10:30:00Z',
          status: 'queued' as const,
          parse_status: 'ok' as const,
          parse_error: null,
          parsed: {},
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    })),
    addToDraft: vi.fn(async () => ({
      queue_item_id: 'queue-1',
      customer: { id: 'customer-1', code: 'KH000001', name: 'Khach le' },
      draft_line: {
        product_id: 'p-2',
        product_code: 'DECAL-PP',
        product_name: 'Decal PP',
        unit_name: 'm²',
        sell_method: 'area_m2' as const,
        width_m: 1.2,
        height_m: 0.5,
        linear_m: null,
        quantity: 2,
        source: 'production_queue' as const,
      },
    })),
  })

  renderPosShell({ catalogService, orderService, productionQueueService })

  await userEvent.click(await screen.findByRole('button', { name: /In decal/ }))

  await userEvent.click(
    await screen.findByRole('button', { name: 'Thêm KH000001_DECAL-PP_120x50_x2 vào nháp' }),
  )

  const cart = screen.getByLabelText('K02 giỏ hàng')
  expect(await within(cart).findByText('Decal PP')).toBeInTheDocument()
  expect(within(cart).getByLabelText('Diện tích Decal PP')).toHaveTextContent('1.2 m²')
  expect(within(cart).getAllByText('78 000').length).toBeGreaterThan(0)
  expect(screen.getByDisplayValue('Khach le')).toBeInTheDocument()
  expect(orderService.checkout).not.toHaveBeenCalled()
})

it('reopened quote keeps snapshot price and checks out as a normal draft', async () => {
  saveQuoteReopenPayload({
    quote: {
      id: 'quote-1',
      code: 'BG000123',
      status: 'active',
    },
    customer: {
      customer_id: 'customer-1',
      snapshot: { code: 'KH000001', name: 'Khach le', phone: null },
      warnings: [],
    },
    price_list: {
      price_list_id: null,
      snapshot: { code: null, name: null },
      warnings: [],
    },
    items: [{
      order_item_id: 'quote-item-1',
      product_id: 'p-1',
      product_snapshot: { code: 'MICA-3MM', name: 'Mica 3mm', unit_name: 'm', sell_method: 'linear_m' },
      quantity: 1,
      unit_price: 99000,
      discount_amount: 0,
      price_source: 'manual',
      note: null,
      warnings: [{ code: 'CURRENT_PRICE_DIFFERS', message: 'Giá hiện tại khác báo giá.' }],
    }],
    summary: { subtotal_amount: 99000, discount_amount: 0, total_amount: 99000 },
    note: null,
  })
  const orderService = makeOrderService()

  renderPosShell({ orderService })

  expect(screen.queryByText('Từ báo giá BG000123')).not.toBeInTheDocument()
  expect(await screen.findByLabelText('Ghi chú đơn hàng')).toHaveValue('Từ báo giá BG000123')
  expect(screen.getByLabelText('Đơn giá Mica 3mm')).toHaveValue('99 000')
  expect(screen.getByText('Giá hiện tại khác báo giá.')).toBeInTheDocument()

  const checkoutDrawer = await openCheckoutDrawer()
  await userEvent.clear(within(checkoutDrawer).getByLabelText('Khách thanh toán'))
  await userEvent.type(within(checkoutDrawer).getByLabelText('Khách thanh toán'), '99000')
  await userEvent.click(within(checkoutDrawer).getByRole('button', { name: 'Tạo hóa đơn' }))

  expect(orderService.checkout).toHaveBeenCalledWith(
    expect.objectContaining({ note: 'Từ báo giá BG000123' }),
  )
  expect(orderService.checkout).toHaveBeenCalledWith(
    expect.not.objectContaining({ source_quote_id: 'quote-1' }),
  )
})

it('blocks checkout when reopened quote has inactive or missing product warning', async () => {
  saveQuoteReopenPayload({
    quote: {
      id: 'quote-1',
      code: 'BG000123',
      status: 'active',
    },
    customer: {
      customer_id: null,
      snapshot: { code: null, name: 'Khach le', phone: null },
      warnings: [],
    },
    price_list: {
      price_list_id: null,
      snapshot: { code: null, name: null },
      warnings: [],
    },
    items: [{
      order_item_id: 'quote-item-1',
      product_id: null,
      product_snapshot: { code: 'OLD', name: 'Hang cu', unit_name: 'tam', sell_method: 'quantity' },
      quantity: 1,
      unit_price: 50000,
      discount_amount: 0,
      price_source: 'manual',
      note: null,
      warnings: [{ code: 'PRODUCT_MISSING', message: 'Sản phẩm không còn trong danh mục.' }],
    }],
    summary: { subtotal_amount: 50000, discount_amount: 0, total_amount: 50000 },
    note: null,
  })
  const orderService = makeOrderService()

  renderPosShell({ orderService })

  expect(await screen.findByText('Sản phẩm không còn trong danh mục.')).toBeInTheDocument()
  const checkoutDrawer = await openCheckoutDrawer()
  expect(within(checkoutDrawer).getByRole('button', { name: 'Tạo hóa đơn' })).toBeDisabled()
  expect(within(checkoutDrawer).getByRole('button', { name: 'Báo giá' })).toBeDisabled()
  expect(orderService.checkout).not.toHaveBeenCalled()
})
