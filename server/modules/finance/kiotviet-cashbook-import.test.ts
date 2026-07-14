import { describe, expect, test } from 'vitest'
import {
  applyKiotVietCashbookImport,
  mapKiotVietCashbookRows,
  previewKiotVietCashbookImport,
} from './kiotviet-cashbook-import.js'

describe('KiotViet cashbook import', () => {
  test('maps all extra columns from the full KiotViet cashbook export', () => {
    const mapped = mapKiotVietCashbookRows([
      {
        rowNumber: 2,
        'Ma phieu': 'TTHD011149',
        'Thoi gian': 46216.39027777778,
        'Thoi gian tao': 46216.3909121875,
        'Nguoi tao': 'Pham Nhat Linh',
        'Nhan vien': 'Pham Nhat Linh',
        'Loai thu chi': 'Phieu thu Tien khach tra',
        'Ten tai khoan': 'van viet phuong lam',
        'So tai khoan': '0947900909',
        'Ma nguoi nop/nhan': '',
        'Nguoi nop/nhan': '',
        'So dien thoai': '',
        'Dia chi': 'Dia chi nguoi nop',
        'Gia tri': 220000,
        'Noi dung chuyen khoan': 'CK HD011149',
        'Ghi chu': 'Ghi chu tu KV',
        'Loai so quy': 'Ngan hang',
        'Trang thai': 'Da thanh toan',
      },
    ])

    expect(mapped.invalid).toEqual([])
    expect(mapped.valid[0]).toMatchObject({
      source_code: 'TTHD011149',
      source_created_at: '2026-07-13T09:22:54.813Z',
      counterparty_address: 'Dia chi nguoi nop',
      transfer_content: 'CK HD011149',
      source_note: 'Ghi chu tu KV',
    })
  })

  test('maps cash and bank rows from KiotViet So Quy export', () => {
    const mapped = mapKiotVietCashbookRows([
      {
        rowNumber: 2,
        'Mã phiếu': 'PT000001',
        'Thời gian': '24/06/2026 18:19',
        'Loại thu chi': 'Phiếu thu Tiền khách trả',
        'Tên tài khoản': '',
        'Số tài khoản': '',
        'Mã người nộp/nhận': 'KH000001',
        'Người nộp/nhận': 'Khách lẻ',
        'Số điện thoại': '0900000000',
        'Giá trị': 120000,
        'Loại sổ quỹ': 'Tiền mặt',
        'Trạng thái': 'Đã thanh toán',
      },
      {
        rowNumber: 3,
        'Mã phiếu': 'PC000001',
        'Thời gian': 46297.5,
        'Loại thu chi': 'Phiếu chi Vật tư',
        'Tên tài khoản': 'TK Chi',
        'Số tài khoản': '7059359298',
        'Người nộp/nhận': 'Nhà cung cấp A',
        'Giá trị': -50000,
        'Loại sổ quỹ': 'Ngân hàng',
        'Trạng thái': 'Đã hủy',
      },
    ])

    expect(mapped.invalid).toEqual([])
    expect(mapped.valid).toHaveLength(2)
    expect(mapped.valid[0]).toMatchObject({
      source_code: 'PT000001',
      account_type: 'cash',
      account_name: 'Tiền mặt',
      account_number: null,
      direction: 'in',
      amount_delta: 120000,
      status: 'posted',
      counterparty_code: 'KH000001',
      counterparty_name: 'Khách lẻ',
    })
    expect(mapped.valid[1]).toMatchObject({
      source_code: 'PC000001',
      account_type: 'bank',
      account_name: 'TK Chi',
      account_number: '7059359298',
      direction: 'out',
      amount_delta: -50000,
      status: 'cancelled',
    })
  })

  test('previews account upserts and signed totals', async () => {
    const mapped = mapKiotVietCashbookRows([
      { rowNumber: 2, 'Mã phiếu': 'PT1', 'Giá trị': 1000, 'Loại sổ quỹ': 'Tiền mặt', 'Trạng thái': 'Đã thanh toán' },
      { rowNumber: 3, 'Mã phiếu': 'PC1', 'Giá trị': -3000, 'Loại sổ quỹ': 'Ngân hàng', 'Tên tài khoản': 'TK Chi', 'Số tài khoản': '7059359298', 'Trạng thái': 'Đã thanh toán' },
      { rowNumber: 4, 'Mã phiếu': 'PT2', 'Giá trị': 5000, 'Loại sổ quỹ': 'Ngân hàng', 'Tên tài khoản': 'TK Chi', 'Số tài khoản': '7059359298', 'Trạng thái': 'Đã hủy' },
    ])

    const preview = await previewKiotVietCashbookImport({
      organizationId: 'org',
      repository: {},
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })

    expect(preview.summary).toMatchObject({
      total_rows: 3,
      valid_rows: 3,
      invalid_rows: 0,
      account_count: 2,
      cash_rows: 1,
      bank_rows: 2,
      posted_rows: 2,
      cancelled_rows: 1,
      cash_total_delta: 1000,
      bank_total_delta: 2000,
    })
  })

  test('imports rows through repository after validating required fields', async () => {
    const mapped = mapKiotVietCashbookRows([
      { rowNumber: 2, 'Mã phiếu': 'PT1', 'Giá trị': 1000, 'Loại sổ quỹ': 'Tiền mặt', 'Trạng thái': 'Đã thanh toán' },
    ])
    const calls: unknown[] = []

    const result = await applyKiotVietCashbookImport({
      organizationId: 'org',
      rows: mapped.valid,
      invalidRows: mapped.invalid,
      repository: {
        upsertImportedKiotVietCashbook: async (input) => {
          calls.push(input)
          return { accounts_created: 1, accounts_updated: 0, entries_created: 1, entries_updated: 0, skipped_rows: 0 }
        },
      },
    })

    expect(calls).toHaveLength(1)
    expect(result.summary).toMatchObject({
      created_rows: 1,
      updated_rows: 0,
      accounts_created: 1,
      accounts_updated: 0,
    })
  })

  test('ignores blank footer rows and keeps bank rows with missing account in a review account', () => {
    const mapped = mapKiotVietCashbookRows([
      { rowNumber: 2, 'Mã phiếu': 'TTHD009044', 'Giá trị': 40000, 'Loại sổ quỹ': 'Ngân hàng', 'Trạng thái': 'Đã thanh toán' },
      { rowNumber: 3, 'Mã phiếu': '', 'Giá trị': '', 'Loại sổ quỹ': '', 'Trạng thái': '' },
    ])

    expect(mapped.invalid).toEqual([])
    expect(mapped.valid).toHaveLength(1)
    expect(mapped.valid[0]).toMatchObject({
      source_code: 'TTHD009044',
      account_type: 'bank',
      account_name: 'Ngân hàng chưa rõ',
      account_number: null,
      amount_delta: 40000,
    })
  })
})
