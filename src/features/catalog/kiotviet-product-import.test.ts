import { describe, expect, it } from 'vitest'
import { mapKiotVietProductRows, parseKiotVietProductWorkbook } from './kiotviet-product-import'

describe('mapKiotVietProductRows', () => {
  it('maps KV product columns into QCVL import rows and keeps ignored fields out of writes', () => {
    const result = mapKiotVietProductRows([
      {
        rowNumber: 2,
        'Loại hàng': 'Hàng hóa',
        'Nhóm hàng(3 Cấp)': 'Alu>>Vật tư',
        'Mã hàng': 'A10T',
        'Tên hàng': 'Alu 3li 0.1 Trắng',
        'Thương hiệu': 'Acores',
        'Giá bán': 0,
        'Giá vốn': 200000,
        'Tồn kho': 4,
        'Tồn nhỏ nhất': 0,
        'Tồn lớn nhất': 999999999,
        'ĐVT': 'Tấm',
        'Mã ĐVT Cơ bản': null,
        'Quy đổi': 1,
        'Đang kinh doanh': 1,
        'Được bán trực tiếp': 1,
        'Vị trí': null,
      },
    ])

    expect(result.valid).toHaveLength(1)
    expect(result.invalid).toHaveLength(0)
    expect(result.valid[0]).toMatchObject({
      rowNumber: 2,
      code: 'A10T',
      name: 'Alu 3li 0.1 Trắng',
      product_group_name: 'Alu>>Vật tư',
      product_kind: 'goods',
      inventory_shape: 'normal',
      sell_method: 'quantity',
      unit_name: 'Tấm',
      latest_purchase_cost: 200000,
      status: 'active',
      ignored: {
        brand: 'Acores',
        min_stock: 0,
        max_stock: 999999999,
        direct_sale: 1,
        location: null,
      },
    })
  })

  it('marks missing code, name, or unit as invalid', () => {
    const result = mapKiotVietProductRows([
      { rowNumber: 3, 'Mã hàng': '', 'Tên hàng': 'Thiếu mã', 'ĐVT': 'Cái' },
      { rowNumber: 4, 'Mã hàng': 'NO-NAME', 'Tên hàng': '', 'ĐVT': 'Cái' },
    ])

    expect(result.valid).toHaveLength(0)
    expect(result.invalid.map((item) => item.rowNumber)).toEqual([3, 4])
    expect(result.invalid[0].errors).toContain('missing_code')
    expect(result.invalid[1].errors).toContain('missing_name')
  })

  it('uses a clear temporary unit for rows missing ĐVT', () => {
    const result = mapKiotVietProductRows([
      { rowNumber: 5, 'Mã hàng': 'NO-UNIT', 'Tên hàng': 'Thiếu đơn vị', 'ĐVT': '' },
    ])

    expect(result.invalid).toHaveLength(0)
    expect(result.valid[0]).toMatchObject({
      code: 'NO-UNIT',
      unit_name: 'Cần cập nhật',
      unit_name_needs_review: true,
    })
  })

  it('attaches KiotViet unit conversion rows to the main product instead of creating extra products', () => {
    const result = mapKiotVietProductRows([
      {
        rowNumber: 2,
        'Loại hàng': 'Hàng hóa',
        'Mã hàng': 'BT',
        'Tên hàng': 'Bạt 300g Ojet Tím',
        'ĐVT': 'm2',
        'Mã ĐVT Cơ bản': '1',
        'Quy đổi': '',
        'Giá bán': 20000,
      },
      {
        rowNumber: 3,
        'Loại hàng': 'Hàng hóa',
        'Mã hàng': 'B50',
        'Tên hàng': 'Bạt 300g Ojet Tím',
        'ĐVT': 'Khổ 50',
        'Mã ĐVT Cơ bản': 'BT',
        'Quy đổi': 40,
        'Giá bán': 720000,
      },
    ])

    expect(result.invalid).toHaveLength(0)
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]).toMatchObject({
      code: 'BT',
      unit_name: 'm2',
      sale_price: 20000,
      unit_conversions: [
        {
          source_code: 'B50',
          unit_name: 'Khổ 50',
          stock_qty_per_unit: 40,
          is_default_purchase_unit: true,
          is_default_sale_unit: false,
        },
      ],
    })
  })

  it('maps combo rows from Hàng thành phần and keeps BOM for later phases', () => {
    const result = mapKiotVietProductRows([
      {
        rowNumber: 8,
        'Loại hàng': 'Combo - đóng gói',
        'Nhóm hàng(3 Cấp)': 'Thành phẩm',
        'Mã hàng': 'HH',
        'Tên hàng': 'Hộp hoa',
        'ĐVT': 'Cái',
        'Hàng thành phần': 'DCS:0.6|F5:0.3',
        'Đang kinh doanh': 1,
      },
    ])

    expect(result.valid[0]).toMatchObject({
      product_kind: 'combo',
      inventory_shape: 'normal',
      sell_method: 'combo',
      track_inventory: false,
      bom_text: 'DCS:0.6|F5:0.3',
    })
  })

  it('parses an xlsx ArrayBuffer into raw rows with row numbers', async () => {
    const workbook = buildMinimalWorkbook([
      ['Mã hàng', 'Tên hàng', 'ĐVT'],
      ['A10T', 'Alu 3li 0.1 Trắng', 'Tấm'],
    ])

    const rows = await parseKiotVietProductWorkbook(workbook)

    expect(rows).toEqual([
      { rowNumber: 2, 'Mã hàng': 'A10T', 'Tên hàng': 'Alu 3li 0.1 Trắng', ĐVT: 'Tấm' },
    ])
  })

  it('keeps later columns aligned when KiotViet exports self-closing empty cells', async () => {
    const workbook = buildWorkbookFromSheetXml(`
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1">
            <c r="A1" t="inlineStr"><is><t>Mã hàng</t></is></c>
            <c r="B1" t="inlineStr"><is><t>Mã ĐVT Cơ bản</t></is></c>
            <c r="C1" t="inlineStr"><is><t>Quy đổi</t></is></c>
            <c r="D1" t="inlineStr"><is><t>Hình ảnh (url1,url2...)</t></is></c>
            <c r="E1" t="inlineStr"><is><t>Trọng lượng</t></is></c>
            <c r="F1" t="inlineStr"><is><t>Đang kinh doanh</t></is></c>
          </row>
          <row r="2">
            <c r="A2" t="str"><v>A10T</v></c>
            <c r="B2" t="str" />
            <c r="C2" t="n"><v>1</v></c>
            <c r="D2" t="str" />
            <c r="E2" t="n" />
            <c r="F2" t="n"><v>1</v></c>
          </row>
        </sheetData>
      </worksheet>
    `)

    const rows = await parseKiotVietProductWorkbook(workbook)

    expect(rows[0]).toMatchObject({
      'Mã hàng': 'A10T',
      'Mã ĐVT Cơ bản': null,
      'Quy đổi': 1,
      'Hình ảnh (url1,url2...)': null,
      'Trọng lượng': null,
      'Đang kinh doanh': 1,
    })
  })
})

function buildMinimalWorkbook(values: string[][]) {
  const sheetRows = values.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const cellRef = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`
      return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
    }).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')
  return buildStoredZip({
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" />',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" />',
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  })
}

function buildWorkbookFromSheetXml(sheetXml: string) {
  return buildStoredZip({
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" />',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" />',
    'xl/worksheets/sheet1.xml': sheetXml,
  })
}

function buildStoredZip(entries: Record<string, string>) {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const centralDirectory: Uint8Array[] = []
  let offset = 0

  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(content)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(8, 0, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    chunks.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centralDirectory.push(central)
    offset += local.length
  }

  const centralStart = offset
  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, centralDirectory.length, true)
  endView.setUint16(10, centralDirectory.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, centralStart, true)

  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + centralSize + end.length
  const zip = new Uint8Array(size)
  let cursor = 0
  for (const chunk of [...chunks, ...centralDirectory, end]) {
    zip.set(chunk, cursor)
    cursor += chunk.length
  }
  return zip.buffer
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
