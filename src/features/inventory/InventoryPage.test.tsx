import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InventoryPage } from './InventoryPage'
import type { InventoryService } from './inventory-service'
import type { InventoryProduct, StockMovement, Stocktake, StocktakeDetail } from './types'
import { quickDateRange, toDisplayDateInput } from '../../lib/date-ranges'

const currentStocktakeDefaultRange = quickDateRange('year')
const defaultStocktakeQuery = {
  status: 'draft,balanced,cancelled',
  from: currentStocktakeDefaultRange.from,
  to: currentStocktakeDefaultRange.to,
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
  product_code: 'F4',
  product_name: 'Fomex 4mm',
  product_system_qty: 7.5,
  product_actual_qty: 5,
  product_difference_qty: -2.5,
  created_by: { id: 'user-maiphuong', name: 'Nguyễn Thị Mai Phương' },
  note: 'Đếm lại kho',
}

const stocktakeDetail: StocktakeDetail = {
  ...stocktake,
  items: [
    {
      id: 'stocktake-item-1',
      line_no: 1,
      product_id: 'product-f4',
      product_code: 'F4',
      product_name: 'Fomex 4mm',
      unit_name: 'Tấm',
      system_qty: 7.5,
      actual_qty: 5,
      difference_qty: -2.5,
      line_difference_value: null,
      line_actual_value: null,
      note: null,
    },
    {
      id: 'stocktake-item-2',
      line_no: 2,
      product_id: null,
      product_code: 'MTro',
      product_name: 'Mica Đài loan 2mm Trong',
      unit_name: 'Tấm',
      system_qty: -0.19,
      actual_qty: 1,
      difference_qty: 1.19,
      line_difference_value: 821100,
      line_actual_value: 690000,
      note: null,
    },
  ],
}

function makeService(overrides: Partial<InventoryService> = {}): InventoryService {
  return {
    listInventoryProducts: vi.fn(async () => ({ items: [normalProduct, rollProduct, sheetProduct], page: 1, page_size: 15, total: 3 })),
    getInventoryProduct: vi.fn(async () => normalProduct),
    listStockMovements: vi.fn(async () => ({ items: [movement], page: 1, page_size: 10, total: 1 })),
    listStocktakes: vi.fn(async (input = {}) => ({ items: [stocktake], page: input.page ?? 1, page_size: input.page_size ?? 10, total: 1 })),
    getStocktake: vi.fn(async () => stocktakeDetail),
    updateStocktakeNote: vi.fn(async () => stocktakeDetail),
    cancelStocktake: vi.fn(async () => ({ ...stocktakeDetail, status: 'cancelled' as const })),
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
    expect(screen.getByRole('button', { name: 'Tồn theo cuộn/tấm' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Khui vật tư' })).toBeDisabled()
    expect(service.listStocktakes).toHaveBeenCalledWith(defaultStocktakeQuery)
  })

  it('shows stocktake list with easy quantity columns', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    expect(await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Bộ lọc phiếu kiểm kho' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Danh sách phiếu kiểm kho' })
    expect(within(table).getByRole('checkbox', { name: 'Chọn tất cả phiếu kiểm kho' }).parentElement).toHaveClass('finance-cashbook-checkbox-control')
    expect(within(table).getByRole('button', { name: 'Chỉ hiện phiếu kiểm kho ưu tiên' })).toHaveClass('finance-cashbook-star-button')
    expect(within(table).getByRole('checkbox', { name: 'Chọn phiếu kiểm kho KK000001' }).parentElement).toHaveClass('finance-cashbook-checkbox-control')
    expect(within(table).getByRole('button', { name: 'Đánh dấu ưu tiên KK000001' })).toHaveClass('finance-cashbook-star-button')
    expect(within(table).getByRole('columnheader', { name: 'Mã phiếu' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Ngày kiểm' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Mã hàng' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Tên hàng' })).toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Người tạo' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Ngày cân bằng' })).not.toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Tồn trước' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Kiểm được' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Lệch' })).toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'SL thực tế' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Tổng thực tế' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Tổng chênh lệch' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'SL lệch tăng' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'SL lệch giảm' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Ghi chú' })).not.toBeInTheDocument()
    expect(within(table).getByText('KK000001')).toBeInTheDocument()
    expect(within(table).getByText('05/06/2026 07:52')).toBeInTheDocument()
    expect(within(table).getByText('F4')).toBeInTheDocument()
    expect(within(table).getByText('Fomex 4mm')).toBeInTheDocument()
    expect(within(table).getByText('7.5')).toBeInTheDocument()
    expect(within(table).getByText('5')).toBeInTheDocument()
    expect(within(table).getByText('-2.5')).toBeInTheDocument()
    expect(within(table).queryByText('313,550')).not.toBeInTheDocument()
    expect(within(table).queryByText('-16.25')).not.toBeInTheDocument()
    expect(within(table).queryByText('1.495')).not.toBeInTheDocument()
    expect(within(table).queryByText('-15.678')).not.toBeInTheDocument()
    expect(within(table).queryByText('Đếm lại kho')).not.toBeInTheDocument()
    expect(service.listStocktakes).toHaveBeenCalledWith(defaultStocktakeQuery)
  })

  it('sorts stocktake rows from shared column headers', async () => {
    const service = makeService({
      listStocktakes: vi.fn(async (input = {}) => ({
        items: [
          stocktake,
          {
            ...stocktake,
            id: 'stocktake-2',
            code: 'KK000002',
            product_code: 'ALU',
            product_name: 'Alu 3mm',
            product_system_qty: 2,
            product_actual_qty: 3,
            product_difference_qty: 1,
          },
        ],
        page: input.page ?? 1,
        page_size: input.page_size ?? 15,
        total: 2,
      })),
    })
    render(<InventoryPage service={service} />)

    const table = await screen.findByRole('table', { name: 'Danh sách phiếu kiểm kho' })
    const rowsBeforeSort = within(table).getAllByRole('row')
    expect(rowsBeforeSort[1]).toHaveTextContent('Fomex 4mm')

    await userEvent.click(within(table).getByRole('button', { name: 'Tên hàng' }))

    const rowsAfterNameSort = within(table).getAllByRole('row')
    expect(rowsAfterNameSort[1]).toHaveTextContent('Alu 3mm')
    expect(within(table).getByRole('columnheader', { name: 'Tên hàng' })).toHaveAttribute('aria-sort', 'ascending')
  })

  it('keeps stocktake row closed when clicking checkbox and filters favorites from the header star', async () => {
    window.localStorage.clear()
    const service = makeService()
    render(<InventoryPage service={service} />)

    const table = await screen.findByRole('table', { name: 'Danh sách phiếu kiểm kho' })
    await userEvent.click(within(table).getByRole('checkbox', { name: 'Chọn phiếu kiểm kho KK000001' }))
    expect(screen.queryByRole('region', { name: 'Chi tiết phiếu kiểm kho KK000001' })).not.toBeInTheDocument()

    await userEvent.click(within(table).getByRole('button', { name: 'Đánh dấu ưu tiên KK000001' }))
    expect(JSON.parse(window.localStorage.getItem('inventory.stocktake.favoriteIds') ?? '[]')).toEqual(['stocktake-1'])
    await userEvent.click(within(table).getByRole('button', { name: 'Chỉ hiện phiếu kiểm kho ưu tiên' }))

    expect(within(table).getByText('KK000001')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Hiện tất cả phiếu kiểm kho' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows imported creator only through the mapped QCVL account', async () => {
    const service = makeService({
      listStocktakes: vi.fn(async (input = {}) => ({
        items: [
          {
            ...stocktake,
            source_type: 'kiotviet_import' as const,
            source_creator_name: 'maiphuong{DEL}',
            created_by: null,
          },
        ],
        page: input.page ?? 1,
        page_size: input.page_size ?? 15,
        total: 1,
      })),
    })
    render(<InventoryPage service={service} />)

    const table = await screen.findByRole('table', { name: 'Danh sách phiếu kiểm kho' })

    expect(within(table).queryByText('Chưa khớp tài khoản')).not.toBeInTheDocument()
    expect(within(table).queryByText('maiphuong{DEL}')).not.toBeInTheDocument()
  })

  it('opens a shared inline stocktake detail without balance person or balance date', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    const table = await screen.findByRole('table', { name: 'Danh sách phiếu kiểm kho' })
    const stocktakeRow = within(table).getByText('KK000001').closest('tr')
    expect(stocktakeRow).not.toBeNull()
    const stocktakeTableRow = stocktakeRow as HTMLTableRowElement
    expect(stocktakeTableRow).toHaveClass('management-data-row')
    await userEvent.click(within(stocktakeTableRow).getByRole('button', { name: 'KK000001' }))

    expect(service.getStocktake).toHaveBeenCalledWith('stocktake-1')
    expect(stocktakeTableRow).toHaveAttribute('aria-expanded', 'true')
    const detail = await screen.findByRole('region', { name: 'Chi tiết phiếu kiểm kho KK000001' })
    expect(within(detail).getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
    expect(within(detail).getByRole('heading', { name: 'KK000001' })).toBeInTheDocument()
    expect(within(detail).getByText('Đã cân bằng')).toBeInTheDocument()
    expect(within(detail).getByText('Người tạo:')).toBeInTheDocument()
    expect(within(detail).getByText('Nguyễn Thị Mai Phương')).toBeInTheDocument()
    expect(within(detail).getByText('Ngày tạo:')).toBeInTheDocument()
    expect(within(detail).getByText('05/06/2026 07:52')).toBeInTheDocument()
    expect(within(detail).queryByText('Người cân bằng')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Ngày cân bằng')).not.toBeInTheDocument()

    const itemsTable = within(detail).getByRole('table', { name: 'Dòng kiểm kho KK000001' })
    expect(itemsTable).toHaveClass('management-detail-table', 'management-detail-lines-table')
    expect(within(itemsTable).getByRole('columnheader', { name: 'Mã hàng' })).toBeInTheDocument()
    expect(within(itemsTable).getByRole('columnheader', { name: 'Tên hàng' })).toBeInTheDocument()
    expect(within(itemsTable).getByRole('columnheader', { name: 'Tồn kho' })).toBeInTheDocument()
    expect(within(itemsTable).getByRole('columnheader', { name: 'Thực tế' })).toBeInTheDocument()
    expect(within(itemsTable).getByRole('columnheader', { name: 'SL lệch' })).toBeInTheDocument()
    expect(within(itemsTable).queryByRole('columnheader', { name: 'Giá trị lệch' })).not.toBeInTheDocument()
    expect(within(itemsTable).queryByLabelText('Tìm mã hàng')).not.toBeInTheDocument()
    expect(within(itemsTable).queryByLabelText('Tìm tên hàng')).not.toBeInTheDocument()
    expect(within(itemsTable).getByText('F4')).toBeInTheDocument()
    expect(within(itemsTable).getByText('Fomex 4mm (Tấm)')).toBeInTheDocument()
    expect(within(itemsTable).getByText('-2.5')).toBeInTheDocument()
    expect(within(itemsTable).queryByText('821,100')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Đã khớp hàng hóa')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Chưa khớp hàng hóa')).not.toBeInTheDocument()
    expect(within(detail).getByText('Số lượng thực tế')).toBeInTheDocument()
    expect(within(detail).getByText('Số lượng chênh lệch')).toBeInTheDocument()
    expect(within(detail).getByText('Đếm lại kho')).toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: 'Hủy' })).toBeEnabled()
    expect(within(detail).getByRole('button', { name: 'Lưu' })).toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: 'Sao chép' })).toBeDisabled()
    expect(within(detail).getByRole('button', { name: 'Xuất file' })).toBeDisabled()
    expect(within(detail).getByRole('button', { name: 'In' })).toBeDisabled()
  })

  it('edits the stocktake detail note directly and saves it', async () => {
    const updateStocktakeNote = vi.fn(async () => ({ ...stocktakeDetail, note: 'Ghi chú mới' }))
    const service = makeService({ updateStocktakeNote } as unknown as Partial<InventoryService>)
    render(<InventoryPage service={service} />)

    const table = await screen.findByRole('table', { name: 'Danh sách phiếu kiểm kho' })
    const stocktakeRow = within(table).getByText('KK000001').closest('tr') as HTMLTableRowElement
    await userEvent.click(within(stocktakeRow).getByRole('button', { name: 'KK000001' }))

    const detail = await screen.findByRole('region', { name: 'Chi tiết phiếu kiểm kho KK000001' })
    const noteInput = within(detail).getByRole('textbox', { name: 'Ghi chú phiếu kiểm kho' })
    expect(noteInput).toHaveClass('management-detail-note')

    await userEvent.clear(noteInput)
    await userEvent.type(noteInput, 'Ghi chú mới')
    await userEvent.click(within(detail).getByRole('button', { name: 'Lưu' }))

    expect(updateStocktakeNote).toHaveBeenCalledWith('stocktake-1', { note: 'Ghi chú mới' })
    expect(noteInput).toHaveValue('Ghi chú mới')
  })

  it('cancels the open stocktake detail after confirmation', async () => {
    const cancelStocktake = vi.fn(async () => ({ ...stocktakeDetail, status: 'cancelled' as const }))
    const confirm = vi.spyOn(window, 'confirm')
    const service = makeService({ cancelStocktake } as unknown as Partial<InventoryService>)
    render(<InventoryPage service={service} />)

    const table = await screen.findByRole('table', { name: 'Danh sách phiếu kiểm kho' })
    const stocktakeRow = within(table).getByText('KK000001').closest('tr') as HTMLTableRowElement
    await userEvent.click(within(stocktakeRow).getByRole('button', { name: 'KK000001' }))

    const detail = await screen.findByRole('region', { name: 'Chi tiết phiếu kiểm kho KK000001' })
    await userEvent.click(within(detail).getByRole('button', { name: 'Hủy' }))

    expect(confirm).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: 'Hủy phiếu kiểm kho' })
    expect(dialog).toHaveClass('management-modal-dialog', 'management-modal-dialog-compact')
    expect(dialog).toHaveTextContent('Bạn có chắc chắn muốn hủy phiếu kiểm kho')
    expect(within(dialog).getByText('KK000001')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Bỏ qua' }))
    expect(cancelStocktake).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Hủy phiếu kiểm kho' })).not.toBeInTheDocument()

    await userEvent.click(within(detail).getByRole('button', { name: 'Hủy' }))
    const confirmDialog = screen.getByRole('dialog', { name: 'Hủy phiếu kiểm kho' })
    await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Đồng ý' }))

    expect(cancelStocktake).toHaveBeenCalledWith('stocktake-1')
    expect(await within(detail).findByText('Đã hủy')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('uses KiotViet-style stocktake toolbar and filter shell', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    const toolbar = await screen.findByRole('search', { name: 'Lọc phiếu kiểm kho' })
    const searchInput = within(toolbar).getByLabelText('Tìm phiếu kiểm kho')
    expect(searchInput).toHaveAttribute('placeholder', 'Mã phiếu, mã hàng, tên hàng')
    const createAction = within(toolbar).getByRole('button', { name: 'Tạo phiếu kiểm kho' })
    expect(createAction).toHaveClass('management-compact-create-action')
    expect(createAction.closest('.management-compact-search')).not.toBeNull()
    expect(within(toolbar).queryByRole('button', { name: '+ Kiểm kho' })).not.toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Import' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Xuất file' })).toBeInTheDocument()

    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc phiếu kiểm kho' })
    const dateGroup = within(sidebar).getByRole('region', { name: 'Ngày tạo' })
    expect(within(dateGroup).getByRole('button', { name: 'Năm nay' })).toBeInTheDocument()
    expect(within(dateGroup).queryByRole('radio', { name: 'Tùy chỉnh' })).not.toBeInTheDocument()

    const statusGroup = within(sidebar).getByRole('region', { name: 'Trạng thái' })
    expect(within(statusGroup).getByRole('checkbox', { name: 'Phiếu tạm' })).toBeChecked()
    expect(within(statusGroup).getByRole('checkbox', { name: 'Đã cân bằng kho' })).toBeChecked()
    expect(within(statusGroup).getByRole('checkbox', { name: 'Đã hủy' })).toBeChecked()
    const creatorGroup = within(sidebar).getByRole('region', { name: 'Người tạo' })
    expect(within(creatorGroup).getByRole('option', { name: 'Nguyễn Thị Mai Phương' })).toHaveValue('user-maiphuong')

    await userEvent.type(searchInput, 'KK000333')
    expect(within(toolbar).getByRole('button', { name: 'Xóa tìm kiếm' })).toHaveClass('management-compact-create-action-clear')

    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        search: 'KK000333',
        ...defaultStocktakeQuery,
      }),
    )

    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        search: 'KK000333',
        ...defaultStocktakeQuery,
      }),
    )

    await userEvent.click(within(toolbar).getByRole('button', { name: 'Xóa tìm kiếm' }))
    expect(searchInput).toHaveValue('')
    await userEvent.click(searchInput)
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(service.listStocktakes).toHaveBeenLastCalledWith(defaultStocktakeQuery))

    await userEvent.selectOptions(within(creatorGroup).getByRole('combobox', { name: 'Người tạo' }), 'user-maiphuong')

    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        status: 'draft,balanced,cancelled',
        from: currentStocktakeDefaultRange.from,
        to: currentStocktakeDefaultRange.to,
        created_by: 'user-maiphuong',
        page: 1,
        page_size: 15,
      }),
    )
  })

  it('uses stocktake creator options from the list response instead of the visible page only', async () => {
    const service = makeService({
      listStocktakes: vi.fn(async (input = {}) => ({
        items: [stocktake],
        creator_options: [
          { id: 'user-maiphuong', name: 'Nguyễn Thị Mai Phương' },
          { id: 'user-vanlam', name: 'Văn Lâm' },
        ],
        page: input.page ?? 1,
        page_size: input.page_size ?? 15,
        total: 1,
      })),
    })
    render(<InventoryPage service={service} />)

    const sidebar = await screen.findByRole('complementary', { name: 'Bộ lọc phiếu kiểm kho' })
    const creatorGroup = within(sidebar).getByRole('region', { name: 'Người tạo' })

    expect(within(creatorGroup).getByRole('option', { name: 'Nguyễn Thị Mai Phương' })).toHaveValue('user-maiphuong')
    expect(within(creatorGroup).getByRole('option', { name: 'Văn Lâm' })).toHaveValue('user-vanlam')
  })

  it('opens the stocktake quick time menu like sales documents', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })
    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc phiếu kiểm kho' })
    const dateGroup = within(sidebar).getByRole('region', { name: 'Ngày tạo' })

    await userEvent.click(within(dateGroup).getByText('Năm nay'))
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
        from: currentStocktakeDefaultRange.from,
        to: currentStocktakeDefaultRange.to,
        page: 1,
        page_size: 15,
      }),
    )

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

  it('shows the current year clipped to today in stocktake date inputs', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })

    expect(screen.getByLabelText('Từ ngày')).toHaveValue(toDisplayDateInput(currentStocktakeDefaultRange.from))
    expect(screen.getByLabelText('Đến ngày')).toHaveValue(toDisplayDateInput(new Date().toISOString().slice(0, 10)))
    await waitFor(() =>
      expect(service.listStocktakes).toHaveBeenLastCalledWith({
        status: 'draft,balanced,cancelled',
        from: currentStocktakeDefaultRange.from,
        to: currentStocktakeDefaultRange.to,
        page: 1,
        page_size: 15,
      }),
    )
  })

  it('reloads stocktakes when browser date inputs emit input events', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })
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

    await userEvent.click(screen.getByRole('checkbox', { name: 'Đã hủy' }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
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
    render(<InventoryPage service={service} />)

    await screen.findByRole('heading', { name: 'Phiếu kiểm kho' })
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    const dialog = screen.getByRole('dialog', { name: 'Import kiểm kho KiotViet' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa dữ liệu cũ' }))
    const confirmDialog = within(dialog).getByRole('alertdialog', { name: 'Xác nhận xóa dữ liệu cũ' })
    await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Xóa' }))

    expect(service.deleteImportedKiotVietStocktakes).toHaveBeenCalled()
    expect(await within(dialog).findByText('Đã xóa 333 dòng dữ liệu cũ.')).toBeInTheDocument()
    await waitFor(() => expect(service.listStocktakes).toHaveBeenLastCalledWith(defaultStocktakeQuery))
  })
})
