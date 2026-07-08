import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InventoryPage } from './InventoryPage'
import type { InventoryService } from './inventory-service'
import type { InventoryProduct, StockMovement, Stocktake } from './types'

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
  created_at: '2026-07-05T02:05:00Z',
  balanced_at: '2026-07-05T02:06:00Z',
  total_actual_qty: 10,
  total_actual_value: 100000,
  total_difference_value: -5000,
  increased_qty: 2,
  decreased_qty: 3,
  note: 'Đếm lại kho',
}

function makeService(overrides: Partial<InventoryService> = {}): InventoryService {
  return {
    listInventoryProducts: vi.fn(async () => ({ items: [normalProduct, rollProduct, sheetProduct], page: 1, page_size: 15, total: 3 })),
    getInventoryProduct: vi.fn(async () => normalProduct),
    listStockMovements: vi.fn(async () => ({ items: [movement], page: 1, page_size: 10, total: 1 })),
    listStocktakes: vi.fn(async () => ({ items: [stocktake], page: 1, page_size: 10, total: 1 })),
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
  it('lists inventory products with filters and negative stock signal', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    expect(screen.getByText('Đang tải hàng hóa...')).toBeInTheDocument()
    expect(await screen.findByText('MICA-3MM')).toBeInTheDocument()
    expect(screen.getByText('DECAL-PP')).toBeInTheDocument()
    expect(screen.getAllByText('Âm kho').length).toBeGreaterThan(0)
    const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc hàng hóa' })
    expect(within(sidebar).queryByRole('button', { name: 'Đặt lại bộ lọc' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lọc' })).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Tìm hàng hóa'), 'mica')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Loại hàng' }), 'normal')
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Áp dụng bộ lọc' }))

    expect(service.listInventoryProducts).toHaveBeenLastCalledWith({
      search: 'mica',
      status: 'active',
      inventory_shape: 'normal',
      page: 1,
      page_size: 15,
    })
  })

  it('opens product detail, shows stock movement history, and adjusts normal stock', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Xem hàng hóa MICA-3MM' }))

    const detail = await screen.findByRole('region', { name: 'Chi tiết hàng hóa MICA-3MM' })
    expect(within(detail).getByText('Mica 3mm')).toBeInTheDocument()
    expect(within(detail).getByText('checkout')).toBeInTheDocument()
    expect(within(detail).getByText('KK000001')).toBeInTheDocument()

    await userEvent.clear(within(detail).getByLabelText('Tồn thực tế'))
    await userEvent.type(within(detail).getByLabelText('Tồn thực tế'), '12')
    await userEvent.type(within(detail).getByLabelText('Lý do điều chỉnh'), 'Đếm lại kho')
    await userEvent.click(within(detail).getByRole('button', { name: 'Cân bằng kho' }))

    expect(service.adjustNormalProductStock).toHaveBeenCalledWith('product-1', {
      actual_qty: 12,
      reason: 'Đếm lại kho',
    })
    await waitFor(() => expect(service.listInventoryProducts).toHaveBeenCalledTimes(2))
  })

  it('shows KiotViet-style stocktake list with aggregate columns', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Phiếu kiểm kho' }))

    expect(screen.getByRole('heading', { name: 'Phiếu kiểm kho' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Bộ lọc phiếu kiểm kho' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Danh sách phiếu kiểm kho' })
    expect(within(table).getByRole('columnheader', { name: 'Mã kiểm kho' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'SL thực tế' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Tổng thực tế' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Tổng chênh lệch' })).toBeInTheDocument()
    expect(within(table).getByText('KK000001')).toBeInTheDocument()
    expect(within(table).getByText('100 000')).toBeInTheDocument()
    expect(within(table).getByText('-5 000')).toBeInTheDocument()
    expect(within(table).getByText('Đếm lại kho')).toBeInTheDocument()
    expect(service.listStocktakes).toHaveBeenCalledWith({ page: 1, page_size: 15 })
  })

  it('shows object-level roll and sheet inventory', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Tồn theo cuộn/tấm' }))

    expect(screen.getByRole('heading', { name: 'Tồn theo cuộn/tấm' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Bộ lọc tồn theo cuộn tấm' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Danh sách tồn theo cuộn tấm' })
    expect(within(table).getByRole('columnheader', { name: 'Mã đối tượng' })).toBeInTheDocument()
    expect(within(table).getByText('ROLL-001')).toBeInTheDocument()
    expect(within(table).getByText('SHEET-001')).toBeInTheDocument()
    expect(within(table).getByText('57,6 m²')).toBeInTheDocument()
    expect(within(table).getByText('2,977 m²')).toBeInTheDocument()
    expect(service.listInventoryRolls).toHaveBeenCalledWith({ page: 1, page_size: 15 })
    expect(service.listInventorySheets).toHaveBeenCalledWith({ page: 1, page_size: 15 })
  })

  it('opens a manual material opening modal from inventory and submits normal material opening', async () => {
    const service = makeService()
    render(<InventoryPage service={service} />)

    await screen.findByText('MICA-3MM')
    await userEvent.click(screen.getByRole('button', { name: 'Khui vật tư' }))

    const dialog = screen.getByRole('dialog', { name: 'Khui vật tư' })
    await userEvent.selectOptions(within(dialog).getByLabelText('Vật tư khui'), 'product-1')
    expect(service.getMaterialOpeningOptions).toHaveBeenCalledWith('product-1')

    await userEvent.clear(within(dialog).getByLabelText('Số lượng khui mới'))
    await userEvent.type(within(dialog).getByLabelText('Số lượng khui mới'), '2')
    await userEvent.clear(within(dialog).getByLabelText('Phần cũ còn lại'))
    await userEvent.type(within(dialog).getByLabelText('Phần cũ còn lại'), '3')
    await userEvent.type(within(dialog).getByLabelText('Ghi chú khui'), 'Khui thủ công')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận khui' }))

    await waitFor(() =>
      expect(service.createMaterialOpening).toHaveBeenCalledWith({
        product_id: 'product-1',
        inventory_shape: 'normal',
        opened_unit_id: 'unit-pack',
        opened_qty: 2,
        old_remaining_qty: 3,
        note: 'Khui thủ công',
      }),
    )
    expect(await within(dialog).findByRole('status')).toHaveTextContent('Đã khui 100 tấm.')
  })

  it('submits roll and sheet object material openings from inventory', async () => {
    const service = makeService({
      getMaterialOpeningOptions: vi.fn(async (productId: string) => ({
        product: {
          id: productId,
          code: productId === 'product-2' ? 'DECAL-PP' : 'FOMEX-45',
          name: productId === 'product-2' ? 'Decal PP' : 'Fomex 4.5mm',
          inventory_shape: productId === 'product-2' ? 'roll' as const : 'sheet' as const,
          stock_unit: { id: 'unit-m2', code: 'M2', name: 'm²' },
        },
        conversions: [],
        warnings: [],
      })),
      createMaterialOpening: vi.fn(async (input) => ({
        id: 'opening-object',
        product_id: input.product_id,
        inventory_shape: input.inventory_shape,
        source_type: 'standard_object' as const,
        opened_unit_id: null,
        opened_qty: null,
        opened_stock_qty: 0,
        stock_movement_id: 'movement-object',
        warnings: [],
        created_at: '2026-07-05T02:00:00Z',
      })),
    })
    render(<InventoryPage service={service} />)

    await screen.findByText('DECAL-PP')
    await userEvent.click(screen.getByRole('button', { name: 'Khui vật tư' }))
    const dialog = screen.getByRole('dialog', { name: 'Khui vật tư' })

    await userEvent.selectOptions(within(dialog).getByLabelText('Vật tư khui'), 'product-2')
    await userEvent.type(await within(dialog).findByLabelText('Cuộn cũ'), 'roll-1')
    await userEvent.clear(within(dialog).getByLabelText('Dài cũ còn lại'))
    await userEvent.type(within(dialog).getByLabelText('Dài cũ còn lại'), '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận khui' }))

    await waitFor(() =>
      expect(service.createMaterialOpening).toHaveBeenCalledWith({
        product_id: 'product-2',
        inventory_shape: 'roll',
        old_inventory_roll_id: 'roll-1',
        old_remaining_length_m: 0,
      }),
    )

    await userEvent.selectOptions(within(dialog).getByLabelText('Vật tư khui'), 'product-3')
    await userEvent.clear(await within(dialog).findByLabelText('Tấm cũ'))
    await userEvent.type(within(dialog).getByLabelText('Tấm cũ'), 'sheet-1')
    await userEvent.click(within(dialog).getByLabelText('Bỏ phần tấm cũ'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận khui' }))

    await waitFor(() =>
      expect(service.createMaterialOpening).toHaveBeenLastCalledWith({
        product_id: 'product-3',
        inventory_shape: 'sheet',
        old_inventory_sheet_id: 'sheet-1',
        discard_old_sheet: true,
      }),
    )
  })
})
