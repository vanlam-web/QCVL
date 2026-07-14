export interface KiotVietRawStocktakeRow {
  rowNumber: number
  [header: string]: unknown
}

export type KiotVietStocktakeStatus = 'draft' | 'balanced' | 'cancelled' | 'unknown'

export interface KiotVietStocktakeImportRow {
  rowNumber: number
  source_code: string
  source_created_at: string | null
  source_creator_name?: string | null
  source_balanced_at: string | null
  status: KiotVietStocktakeStatus
  product_code: string
  product_name: string | null
  unit_name: string | null
  system_qty: number | null
  actual_qty: number | null
  difference_qty: number | null
  increased_qty: number | null
  decreased_qty: number | null
  total_actual_value: number | null
  total_difference_value: number | null
  line_difference_value: number | null
  note: string | null
  is_deleted_product_code: boolean
  formula_valid: boolean
}

export interface KiotVietInvalidStocktakeRow {
  rowNumber: number
  source_code: string | null
  product_code: string | null
  errors: Array<'missing_source_code' | 'missing_product_code' | 'formula_mismatch'>
}

export interface KiotVietMappedStocktakeRows {
  valid: KiotVietStocktakeImportRow[]
  invalid: KiotVietInvalidStocktakeRow[]
}

export interface KiotVietStocktakeImportRepository {
  findProductsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
}

export interface KiotVietStocktakePreviewInput {
  organizationId: string
  repository: KiotVietStocktakeImportRepository
  rows: KiotVietStocktakeImportRow[]
  invalidRows: KiotVietInvalidStocktakeRow[]
}

const formulaTolerance = 0.000001

export function mapKiotVietStocktakeRows(rows: KiotVietRawStocktakeRow[]): KiotVietMappedStocktakeRows {
  const valid: KiotVietStocktakeImportRow[] = []
  const invalid: KiotVietInvalidStocktakeRow[] = []

  for (const row of rows) {
    const sourceCode = text(valueByHeader(row, 'Mã kiểm kho', 'Ma kiem kho'))
    const productCode = text(valueByHeader(row, 'Mã hàng', 'Ma hang', 'Mã sản phẩm', 'SKU'))
    const systemQty = number(valueByHeader(row, 'Tồn kho', 'Ton kho'))
    const actualQty = number(valueByHeader(row, 'Kiểm thực tế', 'Kiem thuc te'))
    const differenceQty = number(valueByHeader(row, 'SL lệch', 'SL lech'))
    const formulaValid = stocktakeFormulaValid(systemQty, actualQty, differenceQty)
    const errors: KiotVietInvalidStocktakeRow['errors'] = []

    if (!sourceCode) errors.push('missing_source_code')
    if (!productCode) errors.push('missing_product_code')
    if (!formulaValid) errors.push('formula_mismatch')

    if (errors.length > 0) {
      invalid.push({
        rowNumber: row.rowNumber,
        source_code: sourceCode,
        product_code: productCode,
        errors,
      })
      continue
    }

    const validSourceCode = sourceCode as string
    const validProductCode = productCode as string

    valid.push({
      rowNumber: row.rowNumber,
      source_code: validSourceCode,
      source_created_at: stocktakeDate(valueByHeader(row, 'Thời gian', 'Thoi gian')),
      source_creator_name: text(valueByHeader(row, 'Người tạo', 'Nguoi tao')),
      source_balanced_at: stocktakeDate(valueByHeader(row, 'Ngày cân bằng', 'Ngay can bang')),
      status: mapKiotVietStocktakeStatus(text(valueByHeader(row, 'Trạng thái', 'Trang thai'))),
      product_code: validProductCode,
      product_name: text(valueByHeader(row, 'Tên hàng', 'Ten hang', 'Tên sản phẩm')),
      unit_name: text(valueByHeader(row, 'Đơn vị tính', 'Don vi tinh', 'ĐVT')),
      system_qty: systemQty,
      actual_qty: actualQty,
      difference_qty: differenceQty,
      increased_qty: number(valueByHeader(row, 'SL lệch tăng', 'SL lech tang')),
      decreased_qty: number(valueByHeader(row, 'SL lệch giảm', 'SL lech giam')),
      total_actual_value: number(valueByHeader(row, 'Tổng thực tế', 'Tong thuc te')),
      total_difference_value: number(valueByHeader(row, 'Tổng chênh lệch', 'Tong chenh lech')),
      line_difference_value: number(valueByHeader(row, 'Giá trị lệch', 'Gia tri lech')),
      note: text(valueByHeader(row, 'Ghi chú', 'Ghi chu')),
      is_deleted_product_code: validProductCode.endsWith('{DEL}'),
      formula_valid: true,
    })
  }

  return { valid, invalid }
}

export function excelSerialToIso(value: unknown) {
  const serial = number(value)
  if (serial === null) return null
  const timestamp = Math.round((serial - 25569) * 86400 * 1000)
  return new Date(timestamp).toISOString()
}

export async function previewKiotVietStocktakeImport(input: KiotVietStocktakePreviewInput) {
  const productCodes = unique(input.rows.map((row) => row.product_code))
  const existingCodes = await input.repository.findProductsByCodes?.({
    organizationId: input.organizationId,
    codes: productCodes,
  }) ?? new Set<string>()
  const missingProductCodes = productCodes.filter((code) => !existingCodes.has(code))

  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      stocktake_count: unique(input.rows.map((row) => row.source_code)).length,
      product_code_count: productCodes.length,
      matched_product_count: productCodes.length - missingProductCodes.length,
      missing_product_count: missingProductCodes.length,
      deleted_product_code_count: unique(input.rows.filter((row) => row.is_deleted_product_code).map((row) => row.product_code)).length,
      formula_error_count: input.invalidRows.filter((row) => row.errors.includes('formula_mismatch')).length,
    },
    invalid_rows: input.invalidRows,
    missing_product_codes: missingProductCodes,
  }
}

function stocktakeDate(value: unknown) {
  if (typeof value === 'number') return excelSerialToIso(value)
  return text(value)
}

function stocktakeFormulaValid(systemQty: number | null, actualQty: number | null, differenceQty: number | null) {
  if (systemQty === null || actualQty === null || differenceQty === null) return true
  return Math.abs((actualQty - systemQty) - differenceQty) <= formulaTolerance
}

function mapKiotVietStocktakeStatus(value: string | null): KiotVietStocktakeStatus {
  const normalized = normalizeKiotVietHeader(value)
  if (normalized.includes('tam')) return 'draft'
  if (normalized.includes('can bang')) return 'balanced'
  if (normalized.includes('huy')) return 'cancelled'
  return 'unknown'
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function valueByHeader(row: KiotVietRawStocktakeRow, ...headers: string[]) {
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header]
  }
  const normalizedHeaders = new Set(headers.map(normalizeKiotVietHeader))
  const matchedKey = Object.keys(row).find((key) => normalizedHeaders.has(normalizeKiotVietHeader(key)))
  return matchedKey ? row[matchedKey] : undefined
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
