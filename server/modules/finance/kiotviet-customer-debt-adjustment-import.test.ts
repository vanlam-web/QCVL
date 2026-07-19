import { describe, expect, test } from 'vitest'
import {
  applyKiotVietCustomerDebtAdjustmentImport,
  mapKiotVietCustomerDebtAdjustmentRows,
  previewKiotVietCustomerDebtAdjustmentImport,
} from './kiotviet-customer-debt-adjustment-import.js'

describe('KiotViet customer debt adjustment import', () => {
  test('maps only customer debt balancing rows while carrying customer code from previous row', () => {
    const mapped = mapKiotVietCustomerDebtAdjustmentRows([
      {
        rowNumber: 2,
        'Ma KH': 'UT',
        'Khach hang': 'Ut Teo',
        'Ma giao dich': '---',
        'Thoi gian': '31/12/2018 00:00',
        'Loai giao dich': 'Du no dau ky',
        'Gia tri': 0,
        'Du no cuoi': 0,
      },
      {
        rowNumber: 3,
        'Ma KH': '',
        'Khach hang': '',
        'Ma giao dich': 'CB000001',
        'Thoi gian': '12/07/2023 23:27',
        'Loai giao dich': 'Dieu chinh',
        'Gia tri': 1000000,
        'Du no cuoi': 1000000,
      },
      {
        rowNumber: 4,
        'Ma giao dich': 'CKKH000001',
        'Thoi gian': '13/07/2023 08:00',
        'Loai giao dich': 'Chiet khau thanh toan cho khach',
        'Gia tri': -500,
        'Du no cuoi': 999500,
      },
      {
        rowNumber: 5,
        'Ma giao dich': 'PN000449',
        'Thoi gian': '13/07/2023 09:00',
        'Loai giao dich': 'Nhap hang',
        'Gia tri': -1200000,
        'Du no cuoi': -200500,
      },
      {
        rowNumber: 6,
        'Ma giao dich': 'CNH000334',
        'Thoi gian': '13/07/2023 10:00',
        'Loai giao dich': 'Chi phi khac',
        'Gia tri': 140000,
        'Du no cuoi': -60500,
      },
      {
        rowNumber: 7,
        'Ma giao dich': 'TTHD000001',
        'Thoi gian': '13/07/2023 11:00',
        'Loai giao dich': 'Thanh toan',
        'Gia tri': -10000,
        'Du no cuoi': -70500,
      },
      {
        rowNumber: 8,
        'Ma giao dich': 'TT000001',
        'Thoi gian': '13/07/2023 12:00',
        'Loai giao dich': 'Thanh toan',
        'Gia tri': -10000,
        'Du no cuoi': -80500,
      },
      {
        rowNumber: 9,
        'Ma giao dich': 'HD000007.03',
        'Thoi gian': '12/07/2023 23:31',
        'Loai giao dich': 'Ban hang',
        'Gia tri': 790400,
        'Du no cuoi': 1790400,
      },
    ], { sourceFile: 'BaoCaoCongNoTheoKhachHang_KV13072026-150538-065.xlsx' })

    expect(mapped.invalid).toEqual([])
    expect(mapped.valid).toEqual([
      {
        rowNumber: 3,
        customer_code: 'UT',
        customer_name: 'Ut Teo',
        source_code: 'CB000001',
        transaction_time: '2023-07-12T23:27:00.000Z',
        transaction_type: 'Dieu chinh',
        amount_delta: 1000000,
        balance_after: 1000000,
        source_file: 'BaoCaoCongNoTheoKhachHang_KV13072026-150538-065.xlsx',
      },
    ])
  })

  test('previews and applies valid adjustment rows through repository', async () => {
    const mapped = mapKiotVietCustomerDebtAdjustmentRows([
      { rowNumber: 2, 'Ma KH': 'UT', 'Khach hang': 'Ut Teo', 'Ma giao dich': 'CB000001', 'Gia tri': 1000000, 'Du no cuoi': 1000000 },
    ])
    const calls: unknown[] = []

    const preview = await previewKiotVietCustomerDebtAdjustmentImport({
      organizationId: 'org',
      repository: {},
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })
    const result = await applyKiotVietCustomerDebtAdjustmentImport({
      organizationId: 'org',
      rows: mapped.valid,
      invalidRows: mapped.invalid,
      repository: {
        upsertImportedKiotVietCustomerDebtAdjustments: async (input) => {
          calls.push(input)
          return { created: 1, updated: 0, skipped: 0 }
        },
      },
    })

    expect(preview.summary).toMatchObject({ valid_rows: 1, customer_count: 1, adjustment_total_delta: 1000000 })
    expect(calls).toHaveLength(1)
    expect(result.summary).toMatchObject({ created_rows: 1, updated_rows: 0, skipped_rows: 0 })
  })
})
