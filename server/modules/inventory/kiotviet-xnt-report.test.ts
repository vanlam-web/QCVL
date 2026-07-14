import { describe, expect, it } from 'vitest'
import { compareQcvMovementBucketsWithKiotVietXnt, mapKiotVietXntReportRows, toKiotVietXntCheckpointRows } from './kiotviet-xnt-report'

describe('mapKiotVietXntReportRows', () => {
  it('maps KiotViet XNT report movement buckets by product code', () => {
    const result = mapKiotVietXntReportRows([
      {
        rowNumber: 8,
        'Ma hang': 'SP000184',
        'Ten hang': 'Muc in epsion',
        'Don vi tinh': 'ml',
        'Ton dau ki': 0,
        'Nhap NCC': 2500,
        'Nhap kiem': 0,
        'Nhap tra': 0,
        'Nhap SX': 0,
        'Xuat ban': 2190.2,
        'Xuat huy': 0,
        'Xuat dung noi bo': 0,
        'Xuat tra': 0,
        'Xuat kiem': 0,
        'Xuat SX': 0,
        'Ton cuoi ki': 309.8,
      },
    ])

    expect(result.invalid).toEqual([])
    expect(result.valid).toEqual([
      {
        rowNumber: 8,
        product_code: 'SP000184',
        product_name: 'Muc in epsion',
        unit_name: 'ml',
        opening_qty: 0,
        purchase_qty: 2500,
        stocktake_in_qty: 0,
        return_in_qty: 0,
        production_in_qty: 0,
        sale_out_qty: 2190.2,
        damage_out_qty: 0,
        internal_use_out_qty: 0,
        supplier_return_out_qty: 0,
        stocktake_out_qty: 0,
        production_out_qty: 0,
        ending_qty: 309.8,
      },
    ])
  })

  it('rejects rows without product code', () => {
    const result = mapKiotVietXntReportRows([{ rowNumber: 9, 'Ten hang': 'No code' }])

    expect(result.valid).toEqual([])
    expect(result.invalid).toEqual([{ rowNumber: 9, product_code: null, errors: ['missing_product_code'] }])
  })
})

describe('compareQcvMovementBucketsWithKiotVietXnt', () => {
  it('compares QCVL movement buckets against KiotViet XNT movement buckets', () => {
    const result = compareQcvMovementBucketsWithKiotVietXnt({
      xntRows: [
        {
          rowNumber: 8,
          product_code: 'SP000184',
          product_name: 'Muc in epsion',
          unit_name: 'ml',
          opening_qty: 0,
          purchase_qty: 2500,
          stocktake_in_qty: 0,
          return_in_qty: 0,
          production_in_qty: 0,
          sale_out_qty: 2190.2,
          damage_out_qty: 0,
          internal_use_out_qty: 0,
          supplier_return_out_qty: 0,
          stocktake_out_qty: 0,
          production_out_qty: 0,
          ending_qty: 309.8,
        },
      ],
      qcvRows: [
        { product_code: 'SP000184', purchase_qty: 2500, sale_out_qty: 345.2, stocktake_in_qty: 0, stocktake_out_qty: 0, ending_qty: 2154.8 },
      ],
    })

    expect(result).toEqual([
      {
        product_code: 'SP000184',
        product_name: 'Muc in epsion',
        unit_name: 'ml',
        kv_ending_qty: 309.8,
        qcv_ending_qty: 2154.8,
        ending_diff: 1845,
        bucket_diffs: {
          purchase_qty: 0,
          stocktake_in_qty: 0,
          sale_out_qty: -1845,
          stocktake_out_qty: 0,
        },
      },
    ])
  })
})

describe('toKiotVietXntCheckpointRows', () => {
  it('turns XNT ending stock into one balanced stocktake checkpoint', () => {
    const rows = toKiotVietXntCheckpointRows({
      sourceCode: 'XNT-KV-2026-07-12',
      checkpointAt: '2026-07-12T16:00:00.000Z',
      rows: [
        {
          rowNumber: 8,
          product_code: 'SP000184',
          product_name: 'Muc in epsion',
          unit_name: 'ml',
          opening_qty: 0,
          purchase_qty: 2500,
          stocktake_in_qty: 0,
          return_in_qty: 0,
          production_in_qty: 0,
          sale_out_qty: 2190.2,
          damage_out_qty: 0,
          internal_use_out_qty: 0,
          supplier_return_out_qty: 0,
          stocktake_out_qty: 0,
          production_out_qty: 0,
          ending_qty: 309.8,
        },
      ],
    })

    expect(rows).toEqual([
      {
        rowNumber: 8,
        source_code: 'XNT-KV-2026-07-12',
        source_created_at: '2026-07-12T16:00:00.000Z',
        source_creator_name: 'KiotViet XNT',
        source_balanced_at: '2026-07-12T16:00:00.000Z',
        status: 'balanced',
        product_code: 'SP000184',
        product_name: 'Muc in epsion',
        unit_name: 'ml',
        system_qty: null,
        actual_qty: 309.8,
        difference_qty: null,
        increased_qty: null,
        decreased_qty: null,
        total_actual_value: null,
        total_difference_value: null,
        line_difference_value: null,
        note: 'Checkpoint tồn cuối kỳ từ báo cáo Xuất nhập tồn KiotViet.',
        is_deleted_product_code: false,
        formula_valid: true,
      },
    ])
  })
})
