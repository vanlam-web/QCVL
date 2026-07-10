import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InventoryPage } from './InventoryPage'
import type { InventoryService } from './inventory-service'
import type { InventoryProduct, StockMovement, Stocktake } from './types'
import { currentMonthRange, toDisplayDateInput } from '../../lib/date-ranges'

const defaultStocktakeQuery = {
  status: 'draft,balanced,cancelled',
  from: currentMonthRange().from,
  to: currentMonthRange().to,
  page: 1,
  page_size: 15,
}

const normalProduct: InventoryProduct = {
  product_id: 'product-1',
  code: 'MICA-3MM',
  name: 'Mica 3mm',
  status: 'active',
  inventory_shape: 'normal',
  stock_unit: 'tấm',
  available_qty: 8,
  is_negative: false,
}

const rollProduct: InventoryProduct = {
  product_id: 'product-2',
  code: 'DECAL-PP',
  name: 'Decal PP',
  status: 'active',
  inventory_shape: 'roll',
  stock_unit: 'm²',
  available_qty: -2,
  is_negative: true,
}

const sheetProduct: InventoryProduct = {
  product_id: 'product-3',
  code: 'FOMEX-45',
  name: 'Fomex 4.5mm',
  status: 'active',
  inventory_shape: 'sheet',
  stock_unit: 'm²',
  available_qty: 12,
  is_negative: false,
}

const movement: StockMovement = {
  id: 'movement-1',
  product_id: 'product-1',
  movement_type: 'checkout',
  quantity_delta: -2,
  created_at: '2026-07-05T02:00:00Z',
}

const stocktake: Stocktake = {
  id: 'stocktake-1',
  code: 'KK000001',
  status: 'balanced',
  source_type: 'manual',
  created_at: '2026-06-05T07:52:12.640Z',
  balanced_at: '2026-06-05T07:53:12.640Z',
  total_actual_qty: 1.5,
  total_actual_value: 313550,
  total_difference_value: -16.25,
  increased_qty: 1.495,
  decreased_qty: -15.678,
  note: 'Đếm lại kho',
}

function makeService(overrides: Partial<InventoryService> = {}): InventoryService {
  return {
    listInventoryProducts: vi.fn(async () => ({ items: [normalProduct, rollProduct, sheetProduct], page: 1, page_size: 15, total: 3 })),
    getInventoryProduct: vi.fn(async () => normalProduct),
    listStockMovements: vi.fn(async () => ({ items: [movement], page: 1, page_size: 10, total: 1 })),
    listStocktakes: vi.fn(async (input = {}) => ({ items: [stocktake], page: input.page ?? 1, page_size: input.page_size ?? 10, total: 1 })),
    previewKiotVietStocktakeImport: vi.fn(async () => ({
      summary: {
        total_rows: 333,
        valid_rows: 333,
        invalid_rows: 0,
        stocktake_count: 120,
        product_code_count: 129,
        matched_product_count: 119,
        missing_product_count: 10,
        deleted_product_code_count: 10,
        formula_error_count: 0,
      },
      invalid_rows: [],
      missing_product_codes: ['OLD{DEL}'],
    })),
    importKiotVietStocktakes: vi.fn(async () => ({
      summary: {
        total_rows: 333,
        valid_rows: 333,
        invalid_rows: 0,
        stocktakes_created: 120,
        stocktakes_updated: 0,
        items_created: 333,
        items_updated: 0,
        missing_product_rows: 10,
        creates_stock_movements: false as const,
      },
      invalid_rows: [],
    })),
    deleteImportedKiotVietStocktakes: vi.fn(async () => ({ deleted_rows: 333, blocked_rows: 0 })),
    listInventoryRolls: vi.fn(async () => ({
      items: [
        {
          id: 'roll-1',
          product_id: 'product-roll',
          code: 'ROLL-001',
          width_m: 3.2,
          initial_length_m: 50,
          remaining_length_m: 18,
          initial_area_m2: 160,
          remaining_area_m2: 57.6,
          status: 'in_use' as const,
          note: 'Cuộn đang dùng',
          created_at: '2026-07-05T02:00:00Z',
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    listInventorySheets: vi.fn(async () => ({
      items: [
        {
          id: 'sheet-1',
          product_id: 'product-sheet',
          code: 'SHEET-001',
          sheet_kind: 'full' as const,
          width_m: 1.22,
          length_m: 2.44,
          area_m2: 2.977,
          status: 'available' as const,
          note: 'Tấm nguyên',
          created_at: '2026-07-05T02:00:00Z',
        },
      ],
      page: 1,
      page_size: 15,
      total: 1,
    })),
    adjustNormalProductStock: vi.fn(async () => stocktake),
    previewPosShortage: vi.fn(),
    getMaterialOpeningOptions: vi.fn(async () => ({
      product: {
        id: 'product-1',
        code: 'MICA-3MM',
        name: 'Mica 3mm',
        inventory_shape: 'normal' as const,
        stock_unit: { id: 'unit-sheet', code: 'TAM', name: 'tấm' },
      },
      conversions: [{ unit_id: 'unit-pack', code: 'RAM', name: 'Ram', stock_qty_per_unit: 100 }],
      warnings: [],
    })),
    createMaterialOpening: vi.fn(async () => ({
      id: 'opening-1',
      product_id: 'product-1',
      inventory_shape: 'normal' as const,
      source_type: 'manual_normal' as const,
      opened_unit_id: 'unit-pack',
      opened_qty: 1,
      opened_stock_qty: 100,
      stock_movement_id: 'movement-opening-1',
      warnings: [],
      created_at: '2026-07-05T02:00:00Z',
    })),
    ...overrides,
  }
}

describe('InventoryPage', () => {
  it('opens stocktake list by default and does not show duplicate inventory tabs', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    expect(await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hàng hóa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Phiếu kiểm kho' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tồn theo cuộn/tấm' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Khui vật tư' })).not.toBeInTheDocument()
    expect(service.listStocktakes).toHaveBeenCalledWith(defaultStocktakeQuery)
  })

  it('shows KiotViet-style stocktake list with aggregate columns', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    expect(await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Bộ lọc phiếu kiểm kho' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Danh sách phiếu kiểm kho' })
    expect(within(table).getByRole('columnheader', { name: 'Mã kiểm kho' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'SL thực tế' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Tổng thực tế' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Tổng chênh lệch' })).toBeInTheDocument()
    expect(within(table).getByText('KK000001')).toBeInTheDocument()
    expect(within(table).getByText('05/06/2026 07:52')).toBeInTheDocument()
    expect(within(table).getByText('313,550')).toBeInTheDocument()
    expect(within(table).getByText('-16.25')).toBeInTheDocument()
    expect(within(table).getByText('1.495')).toBeInTheDocument()
    expect(within(table).getByText('-15.678')).toBeInTheDocument()
    expect(within(table).getByText('Đếm lại kho')).toBeInTheDocument()
    expect(service.listStocktakes).toHaveBeenCalledWith(defaultStocktakeQuery)
  })

  it('uses KiotViet-style stocktake toolbar and filter shell', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    const toolbar = await screen.findByRole('search', { name: 'Lọc phiếu kiểm kho' })
    const searchInput = within(toolbar).getByLabelText('Tìm phiếu kiểm kho')
    expect(searchInput).toHaveAttribute('placeholder', 'Theo mã phiếu kiểm')
    expect(within(toolbar).getByRole('button', { name: '+ Kiểm kho' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Import KV' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Xuất file' })).toBeInTheDocument()

    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc phiếu kiểm kho' })
    const dateGroup = within(sidebar).getByRole('region', { name: 'Ngày tạo' })
    expect(within(dateGroup).getByRole('radio', { name: 'Tháng này' })).toBeChecked()
    expect(within(dateGroup).getByRole('radio', { name: 'Tùy chỉnh' })).not.toBeChecked()

    const statusGroup = within(sidebar).getByRole('region', { name: 'Trạng thái' })
    expect(within(statusGroup).getByRole('checkbox', { name: 'Phiếu tạm' })).toBeChecked()
    expect(within(statusGroup).getByRole('checkbox', { name: 'Đã cân bằng kho' })).toBeChecked()
    expect(within(statusGroup).getByRole('checkbox', { name: 'Đã hủy' })).toBeChecked()

    await userEvent.type(searchInput, 'KK000333')
    await userEvent.keyboard('{Enter}')

    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        search: 'KK000333',
        ...defaultStocktakeQuery,
      }),
    )
  })

  it('opens the stocktake quick time menu like sales documents', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })
    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc phiếu kiểm kho' })
    const dateGroup = within(sidebar).getByRole('region', { name: 'Ngày tạo' })

    await userEvent.click(within(dateGroup).getByText('Tháng này'))
    expect(within(dateGroup).getByRole('region', { name: 'Chọn nhanh thời gian' })).toBeInTheDocument()
    await userEvent.click(within(dateGroup).getByRole('button', { name: 'Toàn thời gian' }))

    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        status: 'draft,balanced,cancelled',
        page: 1,
        page_size: 15,
      }),
    )
  })

  it('reloads stocktakes when status and date filters change', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Đã hủy' }))

    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        status: 'draft,balanced',
        from: currentMonthRange().from,
        to: currentMonthRange().to,
        page: 1,
        page_size: 15,
      }),
    )

    await userEvent.click(screen.getByRole('radio', { name: 'Tùy chỉnh' }))
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-06-30' } })

    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        status: 'draft,balanced',
        from: '2026-06-01',
        to: '2026-06-30',
        page: 1,
        page_size: 15,
      }),
    )
  })

  it('uses the current month when custom stocktake date filter is first enabled', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)
    const currentMonth = currentMonthRange()

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })
    await userEvent.click(screen.getByRole('radio', { name: 'Tùy chỉnh' }))

    expect(screen.getByLabelText('Từ ngày')).toHaveValue(toDisplayDateInput(currentMonth.from))
    expect(screen.getByLabelText('Đến ngày')).toHaveValue(toDisplayDateInput(currentMonth.to))
    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        status: 'draft,balanced,cancelled',
        from: currentMonth.from,
        to: currentMonth.to,
        page: 1,
        page_size: 15,
      }),
    )
  })

  it('reloads stocktakes when browser date inputs emit input events', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })
    await userEvent.click(screen.getByRole('radio', { name: 'Tùy chỉnh' }))
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '31/07/2026' } })

    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        status: 'draft,balanced,cancelled',
        from: '2026-06-01',
        to: '2026-07-31',
        page: 1,
        page_size: 15,
      }),
    )
  })

  it('keeps the latest stocktake filter result when older requests finish later', async () => {
    const pending: Array<{
      input: Parameters<InventoryService['listStocktakes']>[0]
      resolve: (value: Awaited<ReturnType<InventoryService['listStocktakes']>>) => void
    }> = []
    const listStocktakes = vi.fn((input: Parameters<InventoryService['listStocktakes']>[0] = {}) =>
      new Promise<Awaited<ReturnType<InventoryService['listStocktakes']>>>((resolve) => {
        pending.push({ input, resolve })
      }),
    )
    const service = makeService({
      listStocktakes,
    })
    render(<InventoryPage service={service} />)

    await waitFor(() => expect(pending).toHaveLength(1))
    pending[0].resolve({ items: [stocktake], page: 1, page_size: 15, total: 1 })
    expect(await screen.findByText('KK000001')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Tùy chỉnh' }))
    await waitFor(() => expect(pending).toHaveLength(2))
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-06-01' } })
    await waitFor(() => expect(pending).toHaveLength(3))

    pending[2].resolve({ items: [], page: 1, page_size: 15, total: 0 })
    await waitFor(() => expect(screen.queryByText('KK000001')).not.toBeInTheDocument())

    pending[1].resolve({ items: [stocktake], page: 1, page_size: 15, total: 1 })
    await waitFor(() => expect(screen.queryByText('KK000001')).not.toBeInTheDocument())
  })

  it('previews and imports KiotViet stocktake history from the stocktake toolbar', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)
    const file = new File(['fake-xlsx'], 'DanhSachChiTietKiemKho_KV10072026-092956-003.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })
    await userEvent.click(screen.getByRole('button', { name: 'Import KV' }))
    const dialog = screen.getByRole('dialog', { name: 'Import kiểm kho KiotViet' })
    await userEvent.upload(within(dialog).getByLabelText('File KiotViet'), file)

    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }))

    expect(await within(dialog).findByText('333 dòng hợp lệ')).toBeInTheDocument()
    expect(within(dialog).getByText('129 mã hàng')).toBeInTheDocument()
    expect(within(dialog).getByText('119 mã khớp')).toBeInTheDocument()
    expect(within(dialog).getByText('10 mã thiếu/xóa')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }))

    expect(service.previewKiotVietStocktakeImport).toHaveBeenCalledWith({ file, cleanup_demo: false })
    expect(service.importKiotVietStocktakes).toHaveBeenCalledWith({ file, cleanup_demo: false })
    await waitFor(() => expect(service.listStocktakes).toHaveBeenLastCalledWith(defaultStocktakeQuery))
  })

  it('deletes old KiotViet stocktake import data from the shared import dialog', async () => {
    const service = makeService()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<InventoryPage service={service} />)

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })
    await userEvent.click(screen.getByRole('button', { name: 'Import KV' }))
    const dialog = screen.getByRole('dialog', { name: 'Import kiểm kho KiotViet' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa dữ liệu cũ' }))

    expect(confirm).toHaveBeenCalled()
    expect(service.deleteImportedKiotVietStocktakes).toHaveBeenCalled()
    expect(await within(dialog).findByText('Đã xóa 333 dòng dữ liệu cũ.')).toBeInTheDocument()
    await waitFor(() => expect(service.listStocktakes).toHaveBeenLastCalledWith(defaultStocktakeQuery))
    confirm.mockRestore()
  })
})
