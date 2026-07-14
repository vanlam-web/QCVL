import { describe, expect, it } from 'vitest'
import {
  applyKiotVietInvoiceImport,
  mapKiotVietInvoiceRows,
  previewKiotVietInvoiceImport,
} from './kiotviet-invoice-import'

const rows = [
  {
    rowNumber: 2,
    'Mã hóa đơn': 'HD000001',
    'Thời gian tạo': 45657.5,
    'Mã khách hàng': 'Khách lẻ',
    'Tên khách hàng': '',
    'Điện thoại': '',
    'Bảng giá': 'Bảng giá chung',
    'Người bán': 'Mai Phương',
    'Người tạo': 'Mai Phương',
    'Kênh bán': 'Bán trực tiếp',
    'Ghi chú': 'Ghi chú đơn',
    'Tổng tiền hàng': '580000',
    'Giảm giá hóa đơn': '30000',
    'Thu khác': '0',
    'Khách cần trả': '550000',
    'Khách đã trả': '500000',
    'Tiền mặt': '200000',
    'Thẻ': '999999',
    'Ví': '888888',
    'Chuyển khoản': '300000',
    'Trạng thái': 'Hoàn thành',
    'Mã hàng': 'B260',
    'Tên hàng': 'Bạt khổ 260',
    'ĐVT': 'Khổ 260',
    'Ghi chú hàng hóa': 'Dòng 1',
    'Số lượng': '2',
    'Đơn giá': '250000',
    'Giảm giá %': '0',
    'Giảm giá': '0',
    'Giá bán': '250000',
    'Thành tiền': '500000',
  },
  {
    rowNumber: 3,
    'Mã hóa đơn': 'HD000001',
    'Thời gian tạo': 45657.5,
    'Mã khách hàng': 'Khách lẻ',
    'Tên khách hàng': '',
    'Người bán': 'Mai Phương',
    'Người tạo': 'Mai Phương',
    'Tổng tiền hàng': '580000',
    'Giảm giá hóa đơn': '30000',
    'Khách cần trả': '550000',
    'Khách đã trả': '500000',
    'Tiền mặt': '200000',
    'Chuyển khoản': '300000',
    'Trạng thái': 'Hoàn thành',
    'Mã hàng': 'DV',
    'Tên hàng': 'Dịch vụ',
    'ĐVT': 'lần',
    'Số lượng': '1',
    'Đơn giá': '80000',
    'Giảm giá': '0',
    'Giá bán': '80000',
    'Thành tiền': '80000',
  },
]

describe('KiotViet invoice import', () => {
  it('maps real Vietnamese KiotViet headers without mojibake fallback', () => {
    const mapped = mapKiotVietInvoiceRows([{
      rowNumber: 2,
      'Mã hóa đơn': 'HD-TV-001',
      'Mã khách hàng': '',
      'Tên khách hàng': 'Khách lẻ',
      'Điện thoại': '0909000000',
      'Người bán': 'Mai Phương',
      'Tổng tiền hàng': '100000',
      'Khách cần trả': '100000',
      'Khách đã trả': '100000',
      'Tiền mặt': '100000',
      'Trạng thái': 'Hoàn thành',
      'Mã hàng': 'B260',
      'Tên hàng': 'Bạt khổ 260',
      'ĐVT': 'Khổ 260',
      'Số lượng': '1',
      'Giá bán': '100000',
      'Thành tiền': '100000',
    }])

    expect(mapped.invalid).toEqual([])
    expect(mapped.valid[0]).toMatchObject({
      source_code: 'HD-TV-001',
      customer_code: 'khachle',
      customer_phone: '0909000000',
      source_user_name: 'Mai Phương',
      product_code: 'B260',
      unit_name: 'Khổ 260',
      status: 'completed',
    })
  })

  it('maps invoice rows with only cash and bank payment amounts', () => {
    const mapped = mapKiotVietInvoiceRows(rows)

    expect(mapped.invalid).toEqual([])
    expect(mapped.valid).toHaveLength(2)
    expect(mapped.valid[0]).toMatchObject({
      source_code: 'HD000001',
      customer_code: 'khachle',
      source_user_name: 'Mai Phương',
      channel_name: null,
      cash_amount: 200000,
      bank_amount: 300000,
      paid_amount: 500000,
      product_code: 'B260',
      quantity: 2,
      unit_price: 250000,
      line_amount: 500000,
      status: 'completed',
    })
  })

  it('uses KiotViet invoice time for adjusted invoice codes like the KiotViet list', () => {
    const mapped = mapKiotVietInvoiceRows([{
      rowNumber: 2,
      'Mã hóa đơn': 'HD011050.01',
      'Thời gian': 46209.46065451389,
      'Thời gian tạo': 46210.42749456019,
      'Mã khách hàng': 'KH000066',
      'Tên khách hàng': 'nội thất đât quảng',
      'Khách cần trả': '100000',
      'Khách đã trả': '100000',
      'Trạng thái': 'Hoàn thành',
      'Mã hàng': 'IB',
      'Tên hàng': 'In bạt',
      'Số lượng': '1',
      'Giá bán': '100000',
      'Thành tiền': '100000',
    }])

    expect(mapped.invalid).toEqual([])
    expect(mapped.valid[0]).toMatchObject({
      source_code: 'HD011050.01',
      created_at: '2026-07-06T11:03:20.550Z',
    })
  })

  it('previews missing references and applies import by invoice code', async () => {
    const mapped = mapKiotVietInvoiceRows(rows)
    const upserted: unknown[] = []
    const preview = await previewKiotVietInvoiceImport({
      organizationId: 'org-1',
      repository: {
        findSalesDocumentsByCodes: async () => new Set(),
        findCustomersByCodes: async () => new Set(['khachle']),
        findProductsByCodes: async () => new Set(['B260', 'DV']),
      },
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })
    const result = await applyKiotVietInvoiceImport({
      organizationId: 'org-1',
      repository: {
        findCustomersByCodes: async () => new Set(['khachle']),
        findProductsByCodes: async () => new Set(['B260', 'DV']),
        upsertImportedKiotVietInvoices: async (input) => {
          upserted.push(input)
          return { invoices_created: 1, invoices_updated: 0, items_created: 2, items_updated: 0, skipped_rows: 0 }
        },
      },
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })

    expect(preview.summary).toMatchObject({
      invoice_count: 1,
      valid_rows: 2,
      missing_customer_count: 0,
      missing_product_count: 0,
      cash_total: 200000,
      bank_total: 300000,
    })
    expect(result.summary).toMatchObject({ created_rows: 1, items_created: 2 })
    expect(upserted).toHaveLength(1)
    expect(upserted[0]).toMatchObject({ rows: mapped.valid })
  })

  it('auto-resolves walk-in and deleted KiotViet references while keeping real missing codes blocked', async () => {
    const mapped = mapKiotVietInvoiceRows([
      {
        rowNumber: 2,
        'Ma hoa don': 'HD-OLD',
        'Ma khach hang': '',
        'Ten khach hang': 'Khach le',
        'Khach can tra': 1000,
        'Khach da tra': 1000,
        'Ma hang': 'SP000299{DEL}',
        'Ten hang': 'Hang da xoa',
        'So luong': 1,
        'Gia ban': 1000,
      },
      {
        rowNumber: 3,
        'Ma hoa don': 'HD-OLD-2',
        'Ma khach hang': 'KH000166{DEL}',
        'Ten khach hang': 'Khach da xoa',
        'Khach can tra': 1000,
        'Khach da tra': 1000,
        'Ma hang': 'MISSING',
        'Ten hang': 'Hang thieu that',
        'So luong': 1,
        'Gia ban': 1000,
      },
    ])
    const customersUpserted: unknown[] = []
    const productsUpserted: unknown[] = []

    const preview = await previewKiotVietInvoiceImport({
      organizationId: 'org-1',
      repository: {
        findSalesDocumentsByCodes: async () => new Set(),
        findCustomersByCodes: async () => new Set(),
        findProductsByCodes: async () => new Set(),
      },
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })
    const result = await applyKiotVietInvoiceImport({
      organizationId: 'org-1',
      repository: {
        findCustomersByCodes: async () => new Set(['khachle', 'KH000166{DEL}']),
        findProductsByCodes: async () => new Set(['SP000299{DEL}']),
        upsertCustomersByCode: async (input) => {
          customersUpserted.push(...input.rows)
          return { created: input.rows.length, updated: 0, skipped: 0 }
        },
        upsertProductsByCode: async (input) => {
          productsUpserted.push(...input.rows)
          return { created: input.rows.length, updated: 0, skipped: 0 }
        },
        upsertImportedKiotVietInvoices: async () => ({ invoices_created: 0, invoices_updated: 0, items_created: 0, items_updated: 0, skipped_rows: 0 }),
      },
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })

    expect(preview.missing_customer_codes).toEqual([])
    expect(preview.missing_product_codes).toEqual(['MISSING'])
    expect(result.invalid_rows).toEqual([
      expect.objectContaining({ rowNumber: 3, product_code: 'MISSING', errors: ['missing_product_match'] }),
    ])
    expect(customersUpserted).toEqual([
      expect.objectContaining({ code: 'khachle', status: 'active' }),
      expect.objectContaining({ code: 'KH000166{DEL}', status: 'inactive' }),
    ])
    expect(productsUpserted).toEqual([
      expect.objectContaining({ code: 'SP000299{DEL}', status: 'inactive', track_inventory: false }),
    ])
  })
})
