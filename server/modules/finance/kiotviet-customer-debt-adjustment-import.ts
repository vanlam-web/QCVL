import { parseKiotVietProductWorkbookBuffer } from '../catalog/product-import.js'

export interface KiotVietRawCustomerDebtAdjustmentRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietCustomerDebtAdjustmentImportRow {
  rowNumber: number
  customer_code: string
  customer_name: string
  source_code: string
  transaction_time: string | null
  transaction_type: string
  amount_delta: number
  balance_after: number
  source_file: string | null
}

export interface KiotVietInvalidCustomerDebtAdjustmentRow {
  rowNumber: number
  customer_code: string | null
  source_code: string | null
  errors: Array<'missing_customer_code' | 'missing_source_code' | 'missing_amount' | 'missing_balance_after'>
}

export interface CustomerDebtAdjustmentImportRepository {
  upsertImportedKiotVietCustomerDebtAdjustments?(input: {
    organizationId: string
    rows: KiotVietCustomerDebtAdjustmentImportRow[]
  }): Promise<{
    created: number
    updated: number
    skipped: number
  }>
}

export interface CustomerDebtAdjustmentImportInput {
  organizationId: string
  repository: CustomerDebtAdjustmentImportRepository
  rows: KiotVietCustomerDebtAdjustmentImportRow[]
  invalidRows: KiotVietInvalidCustomerDebtAdjustmentRow[]
}

export function parseKiotVietCustomerDebtAdjustmentWorkbookBuffer(buffer: Buffer): KiotVietRawCustomerDebtAdjustmentRow[] {
  return parseKiotVietProductWorkbookBuffer(buffer)
}

export function mapKiotVietCustomerDebtAdjustmentRows(
  rows: KiotVietRawCustomerDebtAdjustmentRow[],
  options: { sourceFile?: string | null } = {},
) {
  const valid: KiotVietCustomerDebtAdjustmentImportRow[] = []
  const invalid: KiotVietInvalidCustomerDebtAdjustmentRow[] = []
  let currentCustomerCode: string | null = null
  let currentCustomerName: string | null = null

  for (const row of rows) {
    currentCustomerCode = text(valueByHeader(row, 'Ma KH', 'Mã KH')) ?? currentCustomerCode
    currentCustomerName = text(valueByHeader(row, 'Khach hang', 'Khách hàng')) ?? currentCustomerName

    const sourceCode = text(valueByHeader(row, 'Ma giao dich', 'Mã giao dịch'))
    if (!sourceCode || !customerDebtAdjustmentSourceCode(sourceCode)) continue

    const amount = number(valueByHeader(row, 'Gia tri', 'Giá trị'))
    const balanceAfter = number(valueByHeader(row, 'Du no cuoi', 'Dư nợ cuối'))
    const errors: KiotVietInvalidCustomerDebtAdjustmentRow['errors'] = []
    if (!currentCustomerCode) errors.push('missing_customer_code')
    if (!sourceCode) errors.push('missing_source_code')
    if (amount === null) errors.push('missing_amount')
    if (balanceAfter === null) errors.push('missing_balance_after')

    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, customer_code: currentCustomerCode, source_code: sourceCode, errors })
      continue
    }

    valid.push({
      rowNumber: row.rowNumber,
      customer_code: currentCustomerCode as string,
      customer_name: currentCustomerName ?? (currentCustomerCode as string),
      source_code: sourceCode.toUpperCase(),
      transaction_time: kiotVietDate(valueByHeader(row, 'Thoi gian', 'Thời gian')),
      transaction_type: text(valueByHeader(row, 'Loai giao dich', 'Loại giao dịch')) ?? 'Dieu chinh',
      amount_delta: amount as number,
      balance_after: balanceAfter as number,
      source_file: options.sourceFile ?? text(valueByHeader(row, 'source_file', 'Source file')),
    })
  }

  return { valid, invalid }
}

export async function previewKiotVietCustomerDebtAdjustmentImport(input: CustomerDebtAdjustmentImportInput) {
  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      customer_count: new Set(input.rows.map((row) => row.customer_code)).size,
      adjustment_total_delta: sum(input.rows.map((row) => row.amount_delta)),
    },
    invalid_rows: input.invalidRows,
  }
}

export async function applyKiotVietCustomerDebtAdjustmentImport(input: CustomerDebtAdjustmentImportInput) {
  if (input.invalidRows.length > 0) {
    return {
      summary: {
        total_rows: input.rows.length + input.invalidRows.length,
        valid_rows: input.rows.length,
        invalid_rows: input.invalidRows.length,
        created_rows: 0,
        updated_rows: 0,
        skipped_rows: input.rows.length,
      },
      invalid_rows: input.invalidRows,
    }
  }

  const result = await input.repository.upsertImportedKiotVietCustomerDebtAdjustments?.({
    organizationId: input.organizationId,
    rows: input.rows,
  }) ?? { created: 0, updated: 0, skipped: input.rows.length }

  return {
    summary: {
      total_rows: input.rows.length,
      valid_rows: input.rows.length,
      invalid_rows: 0,
      created_rows: result.created,
      updated_rows: result.updated,
      skipped_rows: result.skipped,
    },
    invalid_rows: [],
  }
}

function valueByHeader(row: KiotVietRawCustomerDebtAdjustmentRow, ...headers: string[]) {
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header]
  }
  const normalizedHeaders = new Set(headers.map(normalize))
  const matchedKey = Object.keys(row).find((key) => normalizedHeaders.has(normalize(key)))
  return matchedKey ? row[matchedKey] : undefined
}

function customerDebtAdjustmentSourceCode(sourceCode: string) {
  return /^CB/i.test(sourceCode)
}

function kiotVietDate(value: unknown) {
  if (typeof value === 'number') return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString()
  const valueText = text(value)
  if (!valueText) return null
  const match = valueText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!match) return valueText
  const [, day, month, year, hour = '0', minute = '0', second = '0'] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))).toISOString()
}

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^\w\s/]/g, ' ')
    .replace(/\s+/g, ' ')
}

function text(value: unknown) {
  const result = String(value ?? '').trim()
  return result.length > 0 ? result : null
}

function number(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const result = Number(String(value).replaceAll(',', '').replace(/\s/g, '').trim())
  return Number.isFinite(result) ? result : null
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}
