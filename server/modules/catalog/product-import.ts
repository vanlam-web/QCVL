import { inflateRawSync } from 'node:zlib'

type ProductStatus = 'active' | 'inactive'
type SellMethod = 'quantity' | 'area_m2' | 'linear_m' | 'sheet' | 'combo'
type ProductKind = 'goods' | 'service' | 'auxiliary_material' | 'roll' | 'sheet' | 'combo'
type InventoryShape = 'normal' | 'roll' | 'sheet'

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
  inventory_shape: InventoryShape
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

export interface ProductImportUpsertRow {
  code: string
  name: string
  status: ProductStatus
  product_group_id: string | null
  unit_name: string
  sell_method: SellMethod
  product_kind: ProductKind
  inventory_shape: InventoryShape
  track_inventory: boolean
  latest_purchase_cost: number | null
  unit_conversions: KiotVietImportProductRow['unit_conversions']
  source_created_at: string | null
  source: KiotVietImportProductRow
}

export function mapKiotVietProductRows(rows: KiotVietRawProductRow[]) {
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

    const bomText = text(valueByHeader(row, 'Hàng thành phần', 'Vật tư cấu thành'))
    const productKind = mapProductKind(text(valueByHeader(row, 'Loại hàng')), bomText)
    const shapeAndMethod = shapeAndMethodForKind(productKind)
    const validUnitName = unitName ?? 'Cần cập nhật'

    valid.push({
      rowNumber: row.rowNumber,
      code: code as string,
      name: name as string,
      product_group_name: text(valueByPrefix(row, 'Nhóm hàng')) ?? 'Giá chung',
      product_kind: productKind,
      inventory_shape: shapeAndMethod.inventory_shape,
      sell_method: shapeAndMethod.sell_method,
      track_inventory: shapeAndMethod.track_inventory,
      unit_name: validUnitName,
      unit_name_needs_review: unitName === null,
      latest_purchase_cost: number(valueByHeader(row, 'Giá vốn')),
      status: number(valueByHeader(row, 'Đang kinh doanh')) === 0 ? 'inactive' : 'active',
      unit_conversions: conversionsByProductCode.get(code as string) ?? [],
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

export function parseKiotVietProductWorkbookBuffer(buffer: Buffer): KiotVietRawProductRow[] {
  const entries = readZipEntries(buffer)
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

export interface ProductImportRepository {
  findProductsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  findDefaultPriceList?(input: { organizationId: string }): Promise<{ id: string; name: string } | null>
  deleteDemoProductsForImport?(input: { organizationId: string }): Promise<{ deleted: number; blocked: number }>
  upsertProductGroupsByName?(input: { organizationId: string; names: string[] }): Promise<Map<string, string>>
  upsertProductsByCode?(input: {
    organizationId: string
    rows: ProductImportUpsertRow[]
  }): Promise<{ created: number; updated: number; skipped: number }>
  upsertDefaultPriceListItems?(input: {
    organizationId: string
    priceListId: string
    rows: Array<{ product_code: string; unit_price: number }>
  }): Promise<{ created: number; updated: number; skipped: number }>
  upsertProvisionalStockBalances?(input: {
    organizationId: string
    rows: Array<{ product_code: string; quantity: number; unit_name: string; source_label: string }>
  }): Promise<{ created: number; updated: number; skipped: number }>
  upsertDraftProductBoms?(input: {
    organizationId: string
    rows: Array<{
      product_code: string
      source_text: string
      components: Array<{ component_code: string; quantity: number }>
      note: string
    }>
  }): Promise<{ created: number; updated: number; skipped: number }>
}

export interface ProductImportInput {
  organizationId: string
  repository: ProductImportRepository
  rows: KiotVietImportProductRow[]
  invalidRows: KiotVietInvalidProductRow[]
  cleanupDemo: boolean
}

export async function previewKiotVietProductImport(input: ProductImportInput) {
  const codes = unique(input.rows.map((row) => row.code))
  const existingCodes = await input.repository.findProductsByCodes?.({ organizationId: input.organizationId, codes }) ?? new Set<string>()
  const defaultPriceList = await input.repository.findDefaultPriceList?.({ organizationId: input.organizationId }) ?? null
  const updateRows = input.rows.filter((row) => existingCodes.has(row.code)).length
  const createRows = input.rows.length - updateRows
  const unitReviewRows = input.rows.filter((row) => row.unit_name_needs_review).length
  const priceRows = priceImportRows(input.rows)
  const provisionalStockRows = provisionalStockImportRows(input.rows)
  const bomRows = bomImportRows(input.rows)

  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      create_rows: createRows,
      update_rows: updateRows,
      unit_review_rows: unitReviewRows,
      price_rows: priceRows.length,
      price_skipped_rows: input.rows.length - priceRows.length,
      provisional_stock_rows: provisionalStockRows.length,
      provisional_stock_skipped_rows: input.rows.length - provisionalStockRows.length,
      bom_rows: bomRows.length,
      bom_skipped_rows: input.rows.length - bomRows.length,
      price_list_name: defaultPriceList?.name ?? null,
      cleanup_demo_requested: input.cleanupDemo,
      ignored_columns: ['Thương hiệu', 'Tồn nhỏ nhất', 'Tồn lớn nhất', 'Được bán trực tiếp', 'Vị trí'],
      deferred_columns: ['Dự kiến hết hàng'],
    },
    invalid_rows: input.invalidRows,
  }
}

export async function applyKiotVietProductImport(input: ProductImportInput) {
  if (input.invalidRows.length > 0) {
    return {
      summary: {
        total_rows: input.rows.length + input.invalidRows.length,
        valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      unit_review_rows: 0,
      created_rows: 0,
      updated_rows: 0,
      skipped_rows: input.rows.length,
      price_created_rows: 0,
      price_updated_rows: 0,
      price_skipped_rows: input.rows.length,
      provisional_stock_created_rows: 0,
      provisional_stock_updated_rows: 0,
      provisional_stock_skipped_rows: input.rows.length,
      bom_created_rows: 0,
      bom_updated_rows: 0,
      bom_skipped_rows: input.rows.length,
      price_list_name: null,
      cleanup_deleted_rows: 0,
      cleanup_blocked_rows: 0,
      },
      invalid_rows: input.invalidRows,
    }
  }

  const cleanup = input.cleanupDemo && input.repository.deleteDemoProductsForImport
    ? await input.repository.deleteDemoProductsForImport({ organizationId: input.organizationId })
    : { deleted: 0, blocked: 0 }
  const groupNames = unique(input.rows.map((row) => row.product_group_name))
  const groupIds = await input.repository.upsertProductGroupsByName?.({ organizationId: input.organizationId, names: groupNames }) ?? new Map()
  const upsertRows = input.rows.map((row) => toUpsertRow(row, groupIds))
  const upsert = await input.repository.upsertProductsByCode?.({ organizationId: input.organizationId, rows: upsertRows }) ?? {
    created: 0,
    updated: 0,
    skipped: upsertRows.length,
  }
  const defaultPriceList = await input.repository.findDefaultPriceList?.({ organizationId: input.organizationId }) ?? null
  const priceRows = priceImportRows(input.rows)
  const priceUpsert = defaultPriceList && input.repository.upsertDefaultPriceListItems
    ? await input.repository.upsertDefaultPriceListItems({
        organizationId: input.organizationId,
        priceListId: defaultPriceList.id,
        rows: priceRows,
      })
    : { created: 0, updated: 0, skipped: priceRows.length }
  const provisionalStockRows = provisionalStockImportRows(input.rows)
  const provisionalStockUpsert = input.repository.upsertProvisionalStockBalances
    ? await input.repository.upsertProvisionalStockBalances({
        organizationId: input.organizationId,
        rows: provisionalStockRows,
      })
    : { created: 0, updated: 0, skipped: provisionalStockRows.length }
  const bomRows = bomImportRows(input.rows)
  const bomUpsert = input.repository.upsertDraftProductBoms
    ? await input.repository.upsertDraftProductBoms({
        organizationId: input.organizationId,
        rows: bomRows,
      })
    : { created: 0, updated: 0, skipped: bomRows.length }

  return {
    summary: {
      total_rows: input.rows.length,
      valid_rows: input.rows.length,
      invalid_rows: 0,
      unit_review_rows: input.rows.filter((row) => row.unit_name_needs_review).length,
      created_rows: upsert.created,
      updated_rows: upsert.updated,
      skipped_rows: upsert.skipped,
      price_created_rows: priceUpsert.created,
      price_updated_rows: priceUpsert.updated,
      price_skipped_rows: input.rows.length - priceRows.length + priceUpsert.skipped,
      provisional_stock_created_rows: provisionalStockUpsert.created,
      provisional_stock_updated_rows: provisionalStockUpsert.updated,
      provisional_stock_skipped_rows: input.rows.length - provisionalStockRows.length + provisionalStockUpsert.skipped,
      bom_created_rows: bomUpsert.created,
      bom_updated_rows: bomUpsert.updated,
      bom_skipped_rows: input.rows.length - bomRows.length + bomUpsert.skipped,
      price_list_name: defaultPriceList?.name ?? null,
      cleanup_deleted_rows: cleanup.deleted,
      cleanup_blocked_rows: cleanup.blocked,
    },
    invalid_rows: [],
  }
}

function priceImportRows(rows: KiotVietImportProductRow[]) {
  return rows
    .filter((row) => row.sale_price !== null && row.sale_price > 0)
    .map((row) => ({ product_code: row.code, unit_price: row.sale_price as number }))
}

function provisionalStockImportRows(rows: KiotVietImportProductRow[]) {
  return rows
    .filter((row) => row.provisional_stock !== null && row.provisional_stock > 0)
    .map((row) => ({
      product_code: row.code,
      quantity: row.provisional_stock as number,
      unit_name: row.unit_name,
      source_label: 'KiotViet product import',
    }))
}

function bomImportRows(rows: KiotVietImportProductRow[]) {
  return rows
    .map((row) => ({ row, components: parseBomText(row.bom_text) }))
    .filter((entry): entry is { row: KiotVietImportProductRow; components: Array<{ component_code: string; quantity: number }> } =>
      entry.components.length > 0,
    )
    .map(({ row, components }) => ({
      product_code: row.code,
      source_text: row.bom_text as string,
      components,
      note: 'Imported from KiotViet product BOM. Review before activating.',
    }))
}

function parseBomText(value: string | null) {
  if (!value) return []
  const components: Array<{ component_code: string; quantity: number }> = []
  for (const part of value.split('|')) {
    const [rawCode, rawQuantity] = part.split(':')
    const componentCode = rawCode?.trim()
    const quantity = Number(String(rawQuantity ?? '').replaceAll(',', '').trim())
    if (!componentCode || !Number.isFinite(quantity) || quantity <= 0) return []
    components.push({ component_code: componentCode, quantity })
  }
  return components
}

function toUpsertRow(row: KiotVietImportProductRow, groupIds: Map<string, string>): ProductImportUpsertRow {
  return {
    code: row.code,
    name: row.name,
    status: row.status,
    product_group_id: groupIds.get(row.product_group_name) ?? null,
    unit_name: row.unit_name,
    sell_method: row.sell_method,
    product_kind: row.product_kind,
    inventory_shape: row.inventory_shape,
    track_inventory: row.track_inventory,
    latest_purchase_cost: row.latest_purchase_cost,
    unit_conversions: row.unit_conversions,
    source_created_at: normalizeSourceCreatedAt(row.source_created_at),
    source: row,
  }
}

function normalizeSourceCreatedAt(value: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  const serial = Number(trimmed)
  if (Number.isFinite(serial) && serial > 0) {
    const excelEpochOffsetDays = 25569
    const date = new Date((serial - excelEpochOffsetDays) * 86400 * 1000)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  }
  const dateTimeMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (dateTimeMatch) {
    const [, day, month, year, hour = '0', minute = '0'] = dateTimeMatch
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0))
    if (
      date.getUTCFullYear() === Number(year)
      && date.getUTCMonth() === Number(month) - 1
      && date.getUTCDate() === Number(day)
    ) {
      return date.toISOString()
    }
    return null
  }
  const timestamp = Date.parse(trimmed)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function readZipEntries(buffer: Buffer) {
  const entries = new Map<string, string>()
  const endOffset = findEndOfCentralDirectory(buffer)
  if (endOffset < 0) return entries
  const centralSize = buffer.readUInt32LE(endOffset + 12)
  const centralOffset = buffer.readUInt32LE(endOffset + 16)
  let cursor = centralOffset

  while (cursor < centralOffset + centralSize && buffer.readUInt32LE(cursor) === 0x02014b50) {
    const method = buffer.readUInt16LE(cursor + 10)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const fileNameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8')
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    entries.set(name, unzipEntry(compressed, method).toString('utf8'))
    cursor += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

function unzipEntry(buffer: Buffer, method: number) {
  if (method === 0) return buffer
  if (method === 8) return inflateRawSync(buffer)
  throw new Error(`Unsupported xlsx compression method: ${method}`)
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset
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
  inventory_shape: InventoryShape
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

function normalizeKiotVietHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
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
