import { vi } from 'vitest'
import {
  applyKiotVietPurchaseReceiptImport,
  mapKiotVietPurchaseReceiptRows,
  previewKiotVietPurchaseReceiptImport,
} from './purchase-receipt-import.js'

const rows = [
  {
    rowNumber: 2,
    'Mã nhập hàng': 'PN000684',
    'Thời gian': 46214.61905783565,
    'Thời gian tạo': 46214.61905833333,
    'Mã nhà cung cấp': 'NCC000026',
    'Tên nhà cung cấp': 'Chị giao',
    'Người nhập': 'Văn Viết Phương Lâm',
    'Người tạo': 'Văn Viết Phương Lâm',
    'Tổng tiền hàng': 2880000,
    'Giảm giá phiếu nhập': 0,
    'Cần trả NCC': 2880000,
    'Tiền đã trả NCC': 2880000,
    'Ghi chú': '',
    'Số hóa đơn đầu vào': null,
    'Tổng số lượng': 6,
    'Tổng số mặt hàng': 2,
    'Trạng thái': 'Đã nhập hàng',
    'Mã hàng': 'MTro',
    'Tên hàng': 'Mica Đài loan 2mm (Trong)',
    'ĐVT': 'Tấm',
    'Giá nhập': 680000,
    'Giảm giá': 0,
    'Thành tiền': 2040000,
    'Số lượng': 3,
  },
  {
    rowNumber: 3,
    'Mã nhập hàng': 'PN000684',
    'Thời gian': 46214.61905783565,
    'Mã nhà cung cấp': 'NCC000026',
    'Tên nhà cung cấp': 'Chị giao',
    'Người nhập': 'Văn Viết Phương Lâm',
    'Người tạo': 'Văn Viết Phương Lâm',
    'Tổng tiền hàng': 2880000,
    'Giảm giá phiếu nhập': 0,
    'Cần trả NCC': 2880000,
    'Tiền đã trả NCC': 2880000,
    'Tổng số lượng': 6,
    'Tổng số mặt hàng': 2,
    'Trạng thái': 'Đã nhập hàng',
    'Mã hàng': 'NGD',
    'Tên hàng': 'Nhựa giả đá',
    'ĐVT': 'Tấm',
    'Giá nhập': 280000,
    'Giảm giá': 0,
    'Thành tiền': 840000,
    'Số lượng': 3,
  },
]

it('maps KiotViet purchase receipt detail rows into posted receipt lines', () => {
  const mapped = mapKiotVietPurchaseReceiptRows(rows)

  expect(mapped.invalid).toEqual([])
  expect(mapped.valid).toHaveLength(2)
  expect(mapped.valid[0]).toEqual(expect.objectContaining({
    source_code: 'PN000684',
    supplier_code: 'NCC000026',
    product_code: 'MTro',
    status: 'posted',
    quantity: 3,
    unit_cost: 680000,
    line_amount: 2040000,
  }))
})

it('maps blank supplier code to the walk-in supplier', () => {
  const mapped = mapKiotVietPurchaseReceiptRows([
    {
      rowNumber: 2,
      'Mã nhập hàng': 'PN-NCC-LE',
      'Thời gian': 46214,
      'Mã nhà cung cấp': '',
      'Tên nhà cung cấp': '',
      'Trạng thái': 'Đã nhập hàng',
      'Mã hàng': 'BT',
      'Tên hàng': 'Bạt 300g Ojet Tím',
      'ĐVT': 'm2',
      'Giá nhập': 1000,
      'Thành tiền': 2000,
      'Số lượng': 2,
    },
  ])

  expect(mapped.invalid).toEqual([])
  expect(mapped.valid[0]).toEqual(expect.objectContaining({
    supplier_code: 'NCC lẻ',
    supplier_name: 'Nhà cung cấp lẻ',
  }))
})

it('treats the walk-in supplier as available in preview', async () => {
  const mapped = mapKiotVietPurchaseReceiptRows([
    {
      rowNumber: 2,
      'Mã nhập hàng': 'PN-NCC-LE',
      'Mã nhà cung cấp': '',
      'Mã hàng': 'BT',
      'Tên hàng': 'Bạt 300g Ojet Tím',
      'ĐVT': 'm2',
      'Giá nhập': 1000,
      'Thành tiền': 2000,
      'Số lượng': 2,
    },
  ])

  const preview = await previewKiotVietPurchaseReceiptImport({
    organizationId: 'org-1',
    repository: {
      findPurchaseReceiptsByCodes: async () => new Set(),
      findSuppliersByCodes: async () => new Set(),
      findProductsByCodes: async () => new Set(['BT']),
    },
    rows: mapped.valid,
    invalidRows: mapped.invalid,
  })

  expect(preview.missing_supplier_codes).toEqual([])
})

it('creates the walk-in supplier before importing blank-supplier purchase receipts', async () => {
  const mapped = mapKiotVietPurchaseReceiptRows([
    {
      rowNumber: 2,
      'Mã nhập hàng': 'PN-NCC-LE',
      'Mã nhà cung cấp': '',
      'Mã hàng': 'BT',
      'Tên hàng': 'Bạt 300g Ojet Tím',
      'ĐVT': 'm2',
      'Giá nhập': 1000,
      'Thành tiền': 2000,
      'Số lượng': 2,
    },
  ])
  const upsertSuppliersByCode = vi.fn(async () => ({ created: 1, updated: 0, skipped: 0 }))

  await applyKiotVietPurchaseReceiptImport({
    organizationId: 'org-1',
    repository: {
      findSuppliersByCodes: async () => new Set(['NCC lẻ']),
      findProductsByCodes: async () => new Set(['BT']),
      upsertSuppliersByCode,
      upsertImportedKiotVietPurchaseReceipts: async () => ({
        receipts_created: 1,
        receipts_updated: 0,
        items_created: 1,
        items_updated: 0,
        skipped_rows: 0,
      }),
    },
    rows: mapped.valid,
    invalidRows: mapped.invalid,
  })

  expect(upsertSuppliersByCode).toHaveBeenCalledWith({
    organizationId: 'org-1',
    rows: [expect.objectContaining({ code: 'NCC lẻ', name: 'Nhà cung cấp lẻ' })],
  })
})

it('previews grouped purchase receipts and reference mismatches', async () => {
  const mapped = mapKiotVietPurchaseReceiptRows(rows)

  const preview = await previewKiotVietPurchaseReceiptImport({
    organizationId: 'org-1',
    repository: {
      findPurchaseReceiptsByCodes: async () => new Set(['PN000684']),
      findSuppliersByCodes: async () => new Set(['NCC000026']),
      findProductsByCodes: async () => new Set(['MTro']),
    },
    rows: mapped.valid,
    invalidRows: mapped.invalid,
  })

  expect(preview.summary.receipt_count).toBe(1)
  expect(preview.summary.update_rows).toBe(1)
  expect(preview.summary.missing_product_count).toBe(1)
  expect(preview.missing_product_codes).toEqual(['NGD'])
})

it('does not import when products or suppliers are missing', async () => {
  const mapped = mapKiotVietPurchaseReceiptRows(rows)

  const result = await applyKiotVietPurchaseReceiptImport({
    organizationId: 'org-1',
    repository: {
      findSuppliersByCodes: async () => new Set(['NCC000026']),
      findProductsByCodes: async () => new Set(['MTro']),
      upsertImportedKiotVietPurchaseReceipts: async () => ({
        receipts_created: 1,
        receipts_updated: 0,
        items_created: 2,
        items_updated: 0,
        skipped_rows: 0,
      }),
    },
    rows: mapped.valid,
    invalidRows: mapped.invalid,
  })

  expect(result.summary.created_rows).toBe(0)
  expect(result.summary.skipped_rows).toBe(2)
  expect(result.invalid_rows).toContainEqual(expect.objectContaining({
    rowNumber: 3,
    errors: ['missing_product_match'],
  }))
})

it('matches deleted KiotViet suffix codes to the base supplier and product code', async () => {
  const mapped = mapKiotVietPurchaseReceiptRows([
    {
      rowNumber: 2,
      'Mã nhập hàng': 'PN000100',
      'Thời gian': 46214,
      'Mã nhà cung cấp': 'NCC000017{DEL}',
      'Tên nhà cung cấp': 'NCC cũ',
      'Trạng thái': 'Đã nhập hàng',
      'Mã hàng': 'SP000217{DEL}',
      'Tên hàng': 'Hàng cũ',
      'ĐVT': 'Cái',
      'Giá nhập': 1000,
      'Thành tiền': 2000,
      'Số lượng': 2,
    },
  ])

  const preview = await previewKiotVietPurchaseReceiptImport({
    organizationId: 'org-1',
    repository: {
      findPurchaseReceiptsByCodes: async () => new Set(),
      findSuppliersByCodes: async () => new Set(['NCC000017']),
      findProductsByCodes: async () => new Set(['SP000217']),
    },
    rows: mapped.valid,
    invalidRows: mapped.invalid,
  })

  expect(preview.missing_supplier_codes).toEqual([])
  expect(preview.missing_product_codes).toEqual([])
})
