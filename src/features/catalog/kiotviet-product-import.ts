import type { Product, ProductKind, ProductStatus, SellMethod } from './types'

export interface KiotVietRawProductRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietImportProductRow {
  rowNumber: number
  code: string
  name: string
  product_group_name: string
  product_kind: ProductKind
  inventory_shape: NonNullable<Product['inventory_shape']>
  sell_method: SellMethod
  track_inventory: boolean
  unit_name: string
  unit_name_needs_review: boolean
  latest_purchase_cost: number | null
  status: ProductStatus
  unit_conversions: Array<{
    source_code: string | null
    unit_name: string
    stock_qty_per_unit: number
    is_default_purchase_unit: boolean
    is_default_sale_unit: boolean
  }>
  sale_price: number | null
  provisional_stock: number | null
  bom_text: string | null
  expected_out_of_stock_text: string | null
  source_created_at: string | null
  ignored: {
    brand: unknown
    min_stock: unknown
    max_stock: unknown
    direct_sale: unknown
    location: unknown
  }
}

export interface KiotVietInvalidProductRow {
  rowNumber: number
  code: string | null
  name: string | null
  errors: Array<'missing_code' | 'missing_name' | 'missing_unit'>
}

export interface KiotVietMappedProductRows {
  valid: KiotVietImportProductRow[]
  invalid: KiotVietInvalidProductRow[]
}

export function mapKiotVietProductRows(rows: KiotVietRawProductRow[]): KiotVietMappedProductRows {
  const valid: KiotVietImportProductRow[] = []
  const invalid: KiotVietInvalidProductRow[] = []
  const conversionsByProductCode = unitConversionsByProductCode(rows)

  for (const row of rows) {
    if (isUnitConversionRow(row)) continue
    const code = text(valueByHeader(row, 'Mã hàng', 'Mã sản phẩm', 'SKU'))
    const name = text(valueByHeader(row, 'Tên hàng', 'Tên sản phẩm'))
    const unitName = text(valueByHeader(row, 'ĐVT', 'Đơn vị tính', 'Mã ĐVT Cơ bản'))
    const errors: KiotVietInvalidProductRow['errors'] = []
    if (!code) errors.push('missing_code')
    if (!name) errors.push('missing_name')
    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, code, name, errors })
      continue
    }
    const validCode = code as string
    const validName = name as string
    const validUnitName = unitName ?? 'Cần cập nhật'

    const bomText = text(valueByHeader(row, 'Hàng thành phần', 'Vật tư cấu thành'))
    const productKind = mapProductKind(text(valueByHeader(row, 'Loại hàng')), bomText)
    const shapeAndMethod = shapeAndMethodForKind(productKind)

    valid.push({
      rowNumber: row.rowNumber,
      code: validCode,
      name: validName,
      product_group_name: text(valueByPrefix(row, 'Nhóm hàng')) ?? 'Giá chung',
      product_kind: productKind,
      inventory_shape: shapeAndMethod.inventory_shape,
      sell_method: shapeAndMethod.sell_method,
      track_inventory: shapeAndMethod.track_inventory,
      unit_name: validUnitName,
      unit_name_needs_review: unitName === null,
      latest_purchase_cost: number(valueByHeader(row, 'Giá vốn')),
      status: number(valueByHeader(row, 'Đang kinh doanh')) === 0 ? 'inactive' : 'active',
      unit_conversions: conversionsByProductCode.get(validCode) ?? [],
      sale_price: number(valueByHeader(row, 'Giá bán')),
      provisional_stock: number(valueByHeader(row, 'Tồn kho')),
      bom_text: bomText,
      expected_out_of_stock_text: text(valueByHeader(row, 'Dự kiến hết hàng')),
      source_created_at: text(valueByHeader(row, 'Thời gian tạo')),
      ignored: {
        brand: valueByHeader(row, 'Thương hiệu'),
        min_stock: valueByHeader(row, 'Tồn nhỏ nhất'),
        max_stock: valueByHeader(row, 'Tồn lớn nhất'),
        direct_sale: valueByHeader(row, 'Được bán trực tiếp'),
        location: valueByHeader(row, 'Vị trí'),
      },
    })
  }

  return { valid, invalid }
}

function unitConversionsByProductCode(rows: KiotVietRawProductRow[]) {
  const conversions = new Map<string, KiotVietImportProductRow['unit_conversions']>()
  for (const row of rows) {
    if (!isUnitConversionRow(row)) continue
    const productCode = text(valueByHeader(row, 'Mã ĐVT Cơ bản'))
    const sourceCode = text(valueByHeader(row, 'Mã hàng', 'Mã sản phẩm', 'SKU'))
    const unitName = text(valueByHeader(row, 'ĐVT', 'Đơn vị tính'))
    const conversionFactor = number(valueByHeader(row, 'Quy đổi'))
    if (!productCode || !unitName || conversionFactor === null || conversionFactor <= 0) continue
    const current = conversions.get(productCode) ?? []
    current.push({
      source_code: sourceCode,
      unit_name: unitName,
      stock_qty_per_unit: conversionFactor,
      is_default_purchase_unit: true,
      is_default_sale_unit: false,
    })
    conversions.set(productCode, current)
  }
  return conversions
}

function isUnitConversionRow(row: KiotVietRawProductRow) {
  const baseProductCode = text(valueByHeader(row, 'Mã ĐVT Cơ bản'))
  const conversionFactor = number(valueByHeader(row, 'Quy đổi'))
  return baseProductCode !== null && baseProductCode !== '1' && conversionFactor !== null
}

export async function parseKiotVietProductWorkbook(fileBuffer: ArrayBuffer): Promise<KiotVietRawProductRow[]> {
  const entries = await readZipEntries(fileBuffer)
  const worksheetName = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
  if (!worksheetName) return []

  const sharedStrings = entries.has('xl/sharedStrings.xml') ? parseSharedStrings(entries.get('xl/sharedStrings.xml') ?? '') : []
  const sheetRows = parseWorksheetRows(entries.get(worksheetName) ?? '', sharedStrings)
  const headerRow = sheetRows.find((row) => row.values.some((value) => text(value)))
  if (!headerRow) return []

  const headers = headerRow.values.map((value) => text(value) ?? '')
  return sheetRows
    .filter((row) => row.rowNumber > headerRow.rowNumber)
    .map((row) => {
      const record: KiotVietRawProductRow = { rowNumber: row.rowNumber }
      headers.forEach((header, index) => {
        if (header) record[header] = row.values[index] ?? null
      })
      return record
    })
    .filter((row) => Object.keys(row).some((key) => key !== 'rowNumber' && text(row[key]) !== null))
}

export function normalizeKiotVietHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
}

function mapProductKind(value: string | null, bomText: string | null): ProductKind {
  const normalized = normalizeKiotVietHeader(value)
  if (bomText) return 'combo'
  if (normalized.includes('dich vu')) return 'service'
  if (normalized.includes('combo')) return 'combo'
  if (normalized.includes('vat tu phu')) return 'auxiliary_material'
  if (normalized.includes('cuon')) return 'roll'
  if (normalized.includes('tam')) return 'sheet'
  return 'goods'
}

function shapeAndMethodForKind(productKind: ProductKind): {
  inventory_shape: NonNullable<Product['inventory_shape']>
  sell_method: SellMethod
  track_inventory: boolean
} {
  if (productKind === 'service') return { inventory_shape: 'normal', sell_method: 'quantity', track_inventory: false }
  if (productKind === 'roll') return { inventory_shape: 'roll', sell_method: 'linear_m', track_inventory: true }
  if (productKind === 'sheet') return { inventory_shape: 'sheet', sell_method: 'sheet', track_inventory: true }
  if (productKind === 'combo') return { inventory_shape: 'normal', sell_method: 'combo', track_inventory: false }
  return { inventory_shape: 'normal', sell_method: 'quantity', track_inventory: true }
}

function valueByHeader(row: KiotVietRawProductRow, ...headers: string[]) {
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header]
  }
  const normalizedHeaders = new Set(headers.map(normalizeKiotVietHeader))
  const matchedKey = Object.keys(row).find((key) => normalizedHeaders.has(normalizeKiotVietHeader(key)))
  return matchedKey ? row[matchedKey] : undefined
}

function valueByPrefix(row: KiotVietRawProductRow, prefix: string) {
  const normalizedPrefix = normalizeKiotVietHeader(prefix)
  const key = Object.keys(row).find((candidate) => {
    const normalized = normalizeKiotVietHeader(candidate)
    return normalized === normalizedPrefix || normalized.startsWith(`${normalizedPrefix}(`)
  })
  return key ? row[key] : undefined
}

function text(value: unknown) {
  const result = String(value ?? '').trim()
  return result.length > 0 ? result : null
}

function number(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const result = Number(String(value).replaceAll(',', '').trim())
  return Number.isFinite(result) ? result : null
}

async function readZipEntries(fileBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(fileBuffer)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries = new Map<string, string>()
  const endOffset = findEndOfCentralDirectory(view)
  if (endOffset < 0) return entries
  const centralSize = view.getUint32(endOffset + 12, true)
  const centralOffset = view.getUint32(endOffset + 16, true)
  let cursor = centralOffset
  const decoder = new TextDecoder()

  while (cursor < centralOffset + centralSize && view.getUint32(cursor, true) === 0x02014b50) {
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const fileNameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localHeaderOffset = view.getUint32(cursor + 42, true)
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength))
    const localNameLength = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength
    const compressed = bytes.slice(dataStart, dataStart + compressedSize)
    entries.set(name, decoder.decode(await unzipEntry(compressed, method)))
    cursor += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

async function unzipEntry(bytes: Uint8Array, method: number) {
  if (method === 0) return bytes
  if (method !== 8) throw new Error(`Unsupported xlsx compression method: ${method}`)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function findEndOfCentralDirectory(view: DataView) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset
  }
  return -1
}

function parseSharedStrings(xml: string) {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => decodeXml(textMatch[1])).join(''),
  )
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  return [...xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map((rowMatch, rowIndex) => {
    const rowNumber = Number(xmlAttr(rowMatch[1], 'r') ?? rowIndex + 1)
    const values: unknown[] = []
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1]
      const ref = xmlAttr(attrs, 'r')
      const columnIndex = ref ? columnToIndex(ref.replace(/\d+/g, '')) : values.length
      values[columnIndex] = readCellValue(attrs, cellMatch[2] ?? '', sharedStrings)
    }
    return { rowNumber, values }
  })
}

function readCellValue(attrs: string, body: string, sharedStrings: string[]) {
  const type = xmlAttr(attrs, 't')
  if (type === 'inlineStr') {
    return [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join('')
  }
  const valueMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)
  if (!valueMatch) return null
  const raw = decodeXml(valueMatch[1])
  if (type === 's') return sharedStrings[Number(raw)] ?? ''
  if (type === 'str') return raw
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : raw
}

function xmlAttr(attrs: string, name: string) {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`))
  return match?.[1] ?? null
}

function columnToIndex(column: string) {
  return [...column].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function decodeXml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}
