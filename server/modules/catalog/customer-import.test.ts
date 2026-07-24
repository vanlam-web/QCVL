import { describe, expect, it } from 'vitest'
import {
  applyKiotVietCustomerImport,
  mapKiotVietCustomerRows,
  parseKiotVietCustomerWorkbookBuffer,
  previewKiotVietCustomerImport,
} from './customer-import'

describe('mapKiotVietCustomerRows', () => {
  it('maps KiotViet customer columns and allows duplicate customer names', () => {
    const result = mapKiotVietCustomerRows([
      {
        rowNumber: 2,
        'Loại khách': 'Cá nhân',
        'Mã khách hàng': 'KH000001',
        'Tên khách hàng': 'A Cường',
        'Điện thoại': '0909000001',
        'Địa chỉ': '',
        'Khu vực giao hàng': 'Triệu Phong - Quảng Trị',
        'Phường/Xã': 'Triệu Ái',
        'Công ty': 'Công ty In Ấn ABC',
        'Mã số thuế': '0312345678',
        'Nhóm khách hàng': '35',
        'Ghi chú': 'Khách in bạt',
        'Người tạo': 'maiphuong{DEL}',
        'Ngày tạo': 46211.5,
        'Ngày giao dịch cuối': 46212,
        'Nợ cần thu hiện tại': 120000,
        'Tổng bán': 500000,
        'Tổng bán trừ trả hàng': 450000,
        'Trạng thái': 1,
      },
      {
        rowNumber: 3,
        'Loại khách': 'Cá nhân',
        'Mã khách hàng': 'KH000002',
        'Tên khách hàng': 'A Cường',
        'Điện thoại': '',
        'Địa chỉ': 'Thôn 1',
        'Khu vực giao hàng': 'Triệu Phong - Quảng Trị',
        'Phường/Xã': 'Triệu Ái',
        'Công ty': '',
        'Trạng thái': 0,
      },
    ])

    expect(result.invalid).toEqual([])
    expect(result.valid).toHaveLength(2)
    expect(result.valid[0]).toMatchObject({
      rowNumber: 2,
      code: 'KH000001',
      name: 'A Cường',
      customer_type: 'individual',
      company_name: 'Công ty In Ấn ABC',
      phone: '0909000001',
      tax_code: '0312345678',
      address: 'Triệu Ái, Triệu Phong - Quảng Trị',
      area_name: 'Triệu Phong - Quảng Trị',
      ward_name: 'Triệu Ái',
      customer_group_name: '35',
      note: 'Khách in bạt',
      source_creator_name: 'maiphuong{DEL}',
      status: 'active',
      kiotviet_current_debt: 120000,
      kiotviet_total_sales: 500000,
      kiotviet_net_sales: 450000,
    })
    expect(result.valid[0].source_created_at).toBe('2026-07-08T05:00:00.000Z')
    expect(result.valid[0].last_transaction_at).toBe('2026-07-08T17:00:00.000Z')
    expect(result.valid[1]).toMatchObject({
      code: 'KH000002',
      name: 'A Cường',
      address: 'Thôn 1, Triệu Ái, Triệu Phong - Quảng Trị',
      status: 'inactive',
    })
  })

  it('marks rows missing code or name as invalid', () => {
    const result = mapKiotVietCustomerRows([
      { rowNumber: 4, 'Mã khách hàng': '', 'Tên khách hàng': 'Thiếu mã' },
      { rowNumber: 5, 'Mã khách hàng': 'KH000005', 'Tên khách hàng': '' },
    ])

    expect(result.valid).toEqual([])
    expect(result.invalid).toEqual([
      { rowNumber: 4, code: null, name: 'Thiếu mã', errors: ['missing_code'] },
      { rowNumber: 5, code: 'KH000005', name: null, errors: ['missing_name'] },
    ])
  })
})

describe('previewKiotVietCustomerImport', () => {
  it('summarizes create, update, groups, source money and ignored columns', async () => {
    const mapped = mapKiotVietCustomerRows([
      { rowNumber: 2, 'Mã khách hàng': 'KH000001', 'Tên khách hàng': 'Khách cũ', 'Nhóm khách hàng': '35', 'Nợ cần thu hiện tại': 100000, 'Tổng bán': 200000 },
      { rowNumber: 3, 'Mã khách hàng': 'KH000002', 'Tên khách hàng': 'Khách mới', 'Nhóm khách hàng': '', 'Nợ cần thu hiện tại': 50000, 'Tổng bán': 300000 },
    ])

    const preview = await previewKiotVietCustomerImport({
      organizationId: 'org-1',
      repository: {
        findCustomersByCodes: async () => new Set(['KH000001']),
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
      group_rows: 1,
      kiotviet_debt_total: 150000,
      kiotviet_total_sales: 500000,
      ignored_columns: ['Chi nhánh tạo', 'Số CMND/CCCD', 'Ngày sinh', 'Giới tính', 'Email', 'Facebook'],
    })
  })
})

describe('applyKiotVietCustomerImport', () => {
  it('upserts groups and customers by customer code', async () => {
    const mapped = mapKiotVietCustomerRows([
      { rowNumber: 2, 'Mã khách hàng': 'KH000001', 'Tên khách hàng': 'Khách cũ', 'Nhóm khách hàng': '35' },
      { rowNumber: 3, 'Mã khách hàng': 'KH000002', 'Tên khách hàng': 'Khách mới', 'Nhóm khách hàng': '' },
    ])
    const calls: unknown[] = []

    const result = await applyKiotVietCustomerImport({
      organizationId: 'org-1',
      repository: {
        upsertCustomerGroupsByName: async (input) => {
          calls.push(input)
          return new Map([['35', 'cg-35']])
        },
        upsertCustomersByCode: async (input) => {
          calls.push(input.rows)
          return { created: 1, updated: 1, skipped: 0 }
        },
      },
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })

    expect(calls[0]).toEqual({ organizationId: 'org-1', names: ['35'] })
    expect(calls[1]).toEqual([
      expect.objectContaining({ code: 'KH000001', customer_group_id: 'cg-35' }),
      expect.objectContaining({ code: 'KH000002', customer_group_id: null }),
    ])
    expect(result.summary).toMatchObject({
      created_rows: 1,
      updated_rows: 1,
      skipped_rows: 0,
    })
  })

  it('skips the QCVL default retail customer when importing KiotViet rows', async () => {
    const mapped = mapKiotVietCustomerRows([
      { rowNumber: 2, 'Mã khách hàng': 'khachle', 'Tên khách hàng': 'Test thợ', 'Nhóm khách hàng': '25' },
      { rowNumber: 3, 'Mã khách hàng': 'KH000522', 'Tên khách hàng': 'Lanh Hồ', 'Nhóm khách hàng': '' },
    ])
    const upsertedRows: unknown[] = []

    const result = await applyKiotVietCustomerImport({
      organizationId: 'org-1',
      repository: {
        upsertCustomerGroupsByName: async () => new Map([['25', 'cg-25']]),
        upsertCustomersByCode: async (input) => {
          upsertedRows.push(...input.rows)
          return { created: input.rows.length, updated: 0, skipped: 0 }
        },
      },
      rows: mapped.valid,
      invalidRows: mapped.invalid,
    })

    expect(upsertedRows).toEqual([
      expect.objectContaining({ code: 'KH000522', name: 'Lanh Hồ' }),
    ])
    expect(result.summary).toMatchObject({
      created_rows: 1,
      updated_rows: 0,
      skipped_rows: 1,
    })
  })
})

describe('parseKiotVietCustomerWorkbookBuffer', () => {
  it('parses customer workbook rows with Vietnamese headers', () => {
    const workbook = buildStoredZip({
      '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" />',
      'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" />',
      'xl/worksheets/sheet1.xml': `
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1">
              <c r="A1" t="inlineStr"><is><t>Mã khách hàng</t></is></c>
              <c r="B1" t="inlineStr"><is><t>Tên khách hàng</t></is></c>
            </row>
            <row r="2">
              <c r="A2" t="inlineStr"><is><t>KH000001</t></is></c>
              <c r="B2" t="inlineStr"><is><t>Khách lẻ</t></is></c>
            </row>
          </sheetData>
        </worksheet>
      `,
    })

    expect(parseKiotVietCustomerWorkbookBuffer(Buffer.from(workbook))).toEqual([
      { rowNumber: 2, 'Mã khách hàng': 'KH000001', 'Tên khách hàng': 'Khách lẻ' },
    ])
  })
})

function buildStoredZip(entries: Record<string, string>) {
  const chunks: Buffer[] = []
  const centralDirectory: Buffer[] = []
  let offset = 0

  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name)
    const data = Buffer.from(content)
    const local = Buffer.alloc(30 + nameBytes.length + data.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 8)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    nameBytes.copy(local, 30)
    data.copy(local, 30 + nameBytes.length)
    chunks.push(local)

    const central = Buffer.alloc(46 + nameBytes.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 10)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    nameBytes.copy(central, 46)
    centralDirectory.push(central)
    offset += local.length
  }

  const centralStart = offset
  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(centralDirectory.length, 8)
  end.writeUInt16LE(centralDirectory.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(centralStart, 16)

  return Buffer.concat([...chunks, ...centralDirectory, end])
}
