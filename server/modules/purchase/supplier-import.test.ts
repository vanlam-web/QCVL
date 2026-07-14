import { describe, expect, it } from 'vitest'
import {
  applyKiotVietSupplierImport,
  mapKiotVietSupplierRows,
  previewKiotVietSupplierImport,
} from './supplier-import'

describe('mapKiotVietSupplierRows', () => {
  it('maps KiotViet supplier columns into supplier import rows', () => {
    const result = mapKiotVietSupplierRows([
      {
        rowNumber: 2,
        'Mã nhà cung cấp': 'THN',
        'Tên nhà cung cấp': 'Thịnh Hồng Nguyên',
        Email: '',
        'Điện thoại': '0787583609',
        'Địa chỉ': '',
        'Khu vực': 'Triệu Phong - Quảng Trị',
        'Phường/Xã': 'Triệu Ái',
        'Tổng mua': 31973289,
        'Nợ cần trả hiện tại': 0,
        'Mã số thuế': '0312345678',
        'Ghi chú': 'NCC decal',
        'Trạng thái': 1,
        'Tổng mua trừ trả hàng': 30000000,
        'Công ty': 'Công ty THN',
        'Người tạo': 'Văn Viết Phương Lâm',
        'Ngày tạo': 46178.38895795139,
      },
    ])

    expect(result.invalid).toEqual([])
    expect(result.valid).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        code: 'THN',
        name: 'Thịnh Hồng Nguyên',
        phone: '0787583609',
        email: null,
        address: 'Triệu Ái, Triệu Phong - Quảng Trị',
        tax_code: '0312345678',
        note: 'NCC decal',
        company_name: 'Công ty THN',
        source_creator_name: 'Văn Viết Phương Lâm',
        status: 'active',
        kiotviet_current_payable: 0,
        kiotviet_total_purchase: 31973289,
        kiotviet_net_purchase: 30000000,
      }),
    ])
    expect(result.valid[0].source_created_at).toBe('2026-06-05T09:20:05.967Z')
  })

  it('marks rows missing code or name as invalid', () => {
    const result = mapKiotVietSupplierRows([
      { rowNumber: 3, 'Mã nhà cung cấp': '', 'Tên nhà cung cấp': 'Thiếu mã' },
      { rowNumber: 4, 'Mã nhà cung cấp': 'NCC000004', 'Tên nhà cung cấp': '' },
    ])

    expect(result.valid).toEqual([])
    expect(result.invalid).toEqual([
      { rowNumber: 3, code: null, name: 'Thiếu mã', errors: ['missing_code'] },
      { rowNumber: 4, code: 'NCC000004', name: null, errors: ['missing_name'] },
    ])
  })
})

describe('previewKiotVietSupplierImport', () => {
  it('summarizes create, update, source money, and ignored columns', async () => {
    const mapped = mapKiotVietSupplierRows([
      { rowNumber: 2, 'Mã nhà cung cấp': 'THN', 'Tên nhà cung cấp': 'Thịnh Hồng Nguyên', 'Tổng mua': 31973289, 'Nợ cần trả hiện tại': 0 },
      { rowNumber: 3, 'Mã nhà cung cấp': 'NCC000038', 'Tên nhà cung cấp': 'O Hoa', 'Tổng mua': 2010000, 'Nợ cần trả hiện tại': 500000 },
    ])

    const preview = await previewKiotVietSupplierImport({
      organizationId: 'org-1',
      repository: {
        findSuppliersByCodes: async () => new Set(['THN']),
      },
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })

    expect(preview.summary).toMatchObject({
      total_rows: 2,
      valid_rows: 2,
      invalid_rows: 0,
      create_rows: 1,
      update_rows: 1,
      kiotviet_payable_total: 500000,
      kiotviet_total_purchase: 33983289,
      ignored_columns: ['Số CMND/CCCD', 'Nhóm nhà cung cấp'],
    })
  })
})

describe('applyKiotVietSupplierImport', () => {
  it('upserts suppliers by supplier code', async () => {
    const mapped = mapKiotVietSupplierRows([
      { rowNumber: 2, 'Mã nhà cung cấp': 'THN', 'Tên nhà cung cấp': 'Thịnh Hồng Nguyên' },
      { rowNumber: 3, 'Mã nhà cung cấp': 'NCC000038', 'Tên nhà cung cấp': 'O Hoa', 'Trạng thái': 0 },
    ])
    const upsertedRows: unknown[] = []

    const result = await applyKiotVietSupplierImport({
      organizationId: 'org-1',
      repository: {
        upsertSuppliersByCode: async (input) => {
          upsertedRows.push(...input.rows)
          return { created: 1, updated: 1, skipped: 0 }
        },
      },
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })

    expect(upsertedRows).toEqual([
      expect.objectContaining({ code: 'THN', name: 'Thịnh Hồng Nguyên', status: 'active' }),
      expect.objectContaining({ code: 'NCC000038', name: 'O Hoa', status: 'inactive' }),
    ])
    expect(result.summary).toMatchObject({
      created_rows: 1,
      updated_rows: 1,
      skipped_rows: 0,
    })
  })
})
