import { describe, expect, it } from 'vitest'
import { excelSerialToIso, mapKiotVietStocktakeRows, previewKiotVietStocktakeImport } from './kiotviet-stocktake-import'

describe('mapKiotVietStocktakeRows', () => {
  it('maps valid KiotViet stocktake rows and validates the difference formula', () => {
    const result = mapKiotVietStocktakeRows([
      {
        rowNumber: 2,
        'Mã kiểm kho': 'KK000333',
        'Thời gian': '10/07/2026 09:30',
        'Ngày cân bằng': 25569.5,
        'Trạng thái': 'Đã cân bằng kho',
        'Mã hàng': 'HDA5',
        'Tên hàng': 'Hiflex 3m2',
        'Đơn vị tính': 'Cuốn',
        'Tồn kho': 60,
        'Kiểm thực tế': 58,
        'SL lệch': -2,
        'SL lệch tăng': 0,
        'SL lệch giảm': -2,
        'Tổng thực tế': 580000,
        'Tổng chênh lệch': -20000,
        'Giá trị lệch': -20000,
        'Ghi chú': 'Đối soát KV',
      },
    ])

    expect(result.invalid).toEqual([])
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]).toMatchObject({
      rowNumber: 2,
      source_code: 'KK000333',
      source_created_at: '10/07/2026 09:30',
      source_balanced_at: '1970-01-01T12:00:00.000Z',
      status: 'balanced',
      product_code: 'HDA5',
      product_name: 'Hiflex 3m2',
      unit_name: 'Cuốn',
      system_qty: 60,
      actual_qty: 58,
      difference_qty: -2,
      increased_qty: 0,
      decreased_qty: -2,
      total_actual_value: 580000,
      total_difference_value: -20000,
      line_difference_value: -20000,
      note: 'Đối soát KV',
      is_deleted_product_code: false,
      formula_valid: true,
    })
  })

  it('maps stocktake statuses from KiotViet labels', () => {
    const rows = [
      { rowNumber: 2, 'Mã kiểm kho': 'KK1', 'Mã hàng': 'A', 'Trạng thái': 'Phiếu tạm', 'Tồn kho': 1, 'Kiểm thực tế': 1, 'SL lệch': 0 },
      { rowNumber: 3, 'Mã kiểm kho': 'KK2', 'Mã hàng': 'B', 'Trạng thái': 'Đã cân bằng kho', 'Tồn kho': 1, 'Kiểm thực tế': 2, 'SL lệch': 1 },
      { rowNumber: 4, 'Mã kiểm kho': 'KK3', 'Mã hàng': 'C', 'Trạng thái': 'Đã hủy', 'Tồn kho': 1, 'Kiểm thực tế': 0, 'SL lệch': -1 },
      { rowNumber: 5, 'Mã kiểm kho': 'KK4', 'Mã hàng': 'D', 'Trạng thái': 'Khác', 'Tồn kho': 1, 'Kiểm thực tế': 1, 'SL lệch': 0 },
    ]

    const result = mapKiotVietStocktakeRows(rows)

    expect(result.valid.map((row) => row.status)).toEqual(['draft', 'balanced', 'cancelled', 'unknown'])
  })

  it('marks rows invalid when required codes are missing or formulas do not match', () => {
    const result = mapKiotVietStocktakeRows([
      { rowNumber: 2, 'Mã kiểm kho': '', 'Mã hàng': 'A', 'Tồn kho': 1, 'Kiểm thực tế': 1, 'SL lệch': 0 },
      { rowNumber: 3, 'Mã kiểm kho': 'KK2', 'Mã hàng': '', 'Tồn kho': 1, 'Kiểm thực tế': 1, 'SL lệch': 0 },
      { rowNumber: 4, 'Mã kiểm kho': 'KK3', 'Mã hàng': 'C', 'Tồn kho': 5, 'Kiểm thực tế': 7, 'SL lệch': 3 },
    ])

    expect(result.valid).toHaveLength(0)
    expect(result.invalid).toEqual([
      { rowNumber: 2, source_code: null, product_code: 'A', errors: ['missing_source_code'] },
      { rowNumber: 3, source_code: 'KK2', product_code: null, errors: ['missing_product_code'] },
      { rowNumber: 4, source_code: 'KK3', product_code: 'C', errors: ['formula_mismatch'] },
    ])
  })

  it('keeps deleted KiotViet product codes as import history', () => {
    const result = mapKiotVietStocktakeRows([
      { rowNumber: 2, 'Mã kiểm kho': 'KK1', 'Mã hàng': 'OLD-CODE{DEL}', 'Tồn kho': 3, 'Kiểm thực tế': 0, 'SL lệch': -3 },
    ])

    expect(result.invalid).toEqual([])
    expect(result.valid[0]).toMatchObject({
      product_code: 'OLD-CODE{DEL}',
      is_deleted_product_code: true,
    })
  })
})

describe('excelSerialToIso', () => {
  it('converts Excel serial dates to UTC ISO timestamps', () => {
    expect(excelSerialToIso(25569)).toBe('1970-01-01T00:00:00.000Z')
    expect(excelSerialToIso(25569.5)).toBe('1970-01-01T12:00:00.000Z')
    expect(excelSerialToIso('not-a-date')).toBeNull()
  })
})

describe('previewKiotVietStocktakeImport', () => {
  it('summarizes rows, matched products, missing products, deleted codes, and formula errors without writing', async () => {
    const repository = {
      findProductsByCodes: async () => new Set(['HDA5']),
      upsertImportedKiotVietStocktakes: async () => {
        throw new Error('preview must not write')
      },
    }
    const mapped = mapKiotVietStocktakeRows([
      { rowNumber: 2, 'Mã kiểm kho': 'KK1', 'Mã hàng': 'HDA5', 'Tồn kho': 60, 'Kiểm thực tế': 58, 'SL lệch': -2 },
      { rowNumber: 3, 'Mã kiểm kho': 'KK1', 'Mã hàng': 'MISSING', 'Tồn kho': 1, 'Kiểm thực tế': 2, 'SL lệch': 1 },
      { rowNumber: 4, 'Mã kiểm kho': 'KK2', 'Mã hàng': 'OLD{DEL}', 'Tồn kho': 3, 'Kiểm thực tế': 0, 'SL lệch': -3 },
      { rowNumber: 5, 'Mã kiểm kho': 'KK3', 'Mã hàng': 'BAD', 'Tồn kho': 5, 'Kiểm thực tế': 7, 'SL lệch': 3 },
    ])

    const result = await previewKiotVietStocktakeImport({
      organizationId: 'org-1',
      repository,
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })

    expect(result.summary).toEqual({
      total_rows: 4,
      valid_rows: 3,
      invalid_rows: 1,
      stocktake_count: 2,
      product_code_count: 3,
      matched_product_count: 1,
      missing_product_count: 2,
      deleted_product_code_count: 1,
      formula_error_count: 1,
    })
    expect(result.missing_product_codes).toEqual(['MISSING', 'OLD{DEL}'])
    expect(result.invalid_rows).toEqual([
      { rowNumber: 5, source_code: 'KK3', product_code: 'BAD', errors: ['formula_mismatch'] },
    ])
  })

  it('counts deleted KiotViet product codes by distinct code, not by repeated rows', async () => {
    const mapped = mapKiotVietStocktakeRows([
      { rowNumber: 2, 'Mã kiểm kho': 'KK1', 'Mã hàng': 'OLD{DEL}', 'Tồn kho': 3, 'Kiểm thực tế': 0, 'SL lệch': -3 },
      { rowNumber: 3, 'Mã kiểm kho': 'KK2', 'Mã hàng': 'OLD{DEL}', 'Tồn kho': 2, 'Kiểm thực tế': 0, 'SL lệch': -2 },
    ])

    const result = await previewKiotVietStocktakeImport({
      organizationId: 'org-1',
      repository: { findProductsByCodes: async () => new Set() },
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })

    expect(result.summary.deleted_product_code_count).toBe(1)
  })
})
