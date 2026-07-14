import { parseKiotVietProductWorkbookBuffer } from '../catalog/product-import.js'

export type KiotVietCashbookAccountType = 'cash' | 'bank'
export type KiotVietCashbookStatus = 'posted' | 'cancelled'
export type KiotVietCashbookDirection = 'in' | 'out'

export interface KiotVietRawCashbookRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietCashbookImportRow {
  rowNumber: number
  source_code: string
  entry_time: string | null
  source_created_at: string | null
  source_creator_name: string | null
  staff_name: string | null
  category_name: string | null
  account_type: KiotVietCashbookAccountType
  account_name: string
  account_number: string | null
  counterparty_code: string | null
  counterparty_name: string | null
  counterparty_phone: string | null
  counterparty_address: string | null
  transfer_content: string | null
  source_note: string | null
  direction: KiotVietCashbookDirection
  amount_delta: number
  book_type_name: string
  status: KiotVietCashbookStatus
}

export interface KiotVietInvalidCashbookRow {
  rowNumber: number
  source_code: string | null
  errors: Array<'missing_source_code' | 'missing_amount' | 'zero_amount' | 'missing_bank_account'>
}

export interface CashbookImportRepository {
  upsertImportedKiotVietCashbook?(input: {
    organizationId: string
    rows: KiotVietCashbookImportRow[]
  }): Promise<{
    accounts_created: number
    accounts_updated: number
    entries_created: number
    entries_updated: number
    skipped_rows: number
  }>
}

export interface CashbookImportInput {
  organizationId: string
  repository: CashbookImportRepository
  rows: KiotVietCashbookImportRow[]
  invalidRows: KiotVietInvalidCashbookRow[]
}

export function parseKiotVietCashbookWorkbookBuffer(buffer: Buffer): KiotVietRawCashbookRow[] {
  return parseKiotVietProductWorkbookBuffer(buffer)
}

export function mapKiotVietCashbookRows(rows: KiotVietRawCashbookRow[]) {
  const valid: KiotVietCashbookImportRow[] = []
  const invalid: KiotVietInvalidCashbookRow[] = []

  for (const row of rows) {
    const sourceCode = text(valueByHeader(row, 'Mã phiếu', 'Ma phieu'))
    const amount = number(valueByHeader(row, 'Giá trị', 'Gia tri'))
    const bookType = text(valueByHeader(row, 'Loại sổ quỹ', 'Loai so quy')) ?? 'Tiền mặt'
    const accountType = mapAccountType(bookType)
    if (!sourceCode && amount === null) continue

    const accountName = accountType === 'cash'
      ? 'Tiền mặt'
      : text(valueByHeader(row, 'Tên tài khoản', 'Ten tai khoan')) ?? 'Ngân hàng chưa rõ'
    const accountNumber = accountType === 'cash'
      ? null
      : text(valueByHeader(row, 'Số tài khoản', 'So tai khoan'))
    const errors: KiotVietInvalidCashbookRow['errors'] = []

    if (!sourceCode) errors.push('missing_source_code')
    if (amount === null) errors.push('missing_amount')
    if (amount === 0) errors.push('zero_amount')

    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, source_code: sourceCode, errors })
      continue
    }

    valid.push({
      rowNumber: row.rowNumber,
      source_code: sourceCode as string,
      entry_time: kiotVietDate(valueByHeader(row, 'Thời gian', 'Thoi gian')),
      source_creator_name: text(valueByHeader(row, 'Người tạo', 'Nguoi tao')),
      staff_name: text(valueByHeader(row, 'Nhân viên', 'Nhan vien')),
      category_name: text(valueByHeader(row, 'Loại thu chi', 'Loai thu chi')),
      source_created_at: kiotVietDate(valueByHeader(row, 'Thoi gian tao', 'Thá»i gian táº¡o')),
      account_type: accountType,
      account_name: accountName,
      account_number: accountNumber,
      counterparty_code: text(valueByHeader(row, 'Mã người nộp/nhận', 'Ma nguoi nop/nhan')),
      counterparty_name: text(valueByHeader(row, 'Người nộp/nhận', 'Nguoi nop/nhan')),
      counterparty_phone: text(valueByHeader(row, 'Số điện thoại', 'Số điện thoại', 'So dien thoai')),
      counterparty_address: text(valueByHeader(row, 'Dia chi', 'Äá»‹a chá»‰')),
      transfer_content: text(valueByHeader(row, 'Noi dung chuyen khoan', 'Ná»™i dung chuyá»ƒn khoáº£n')),
      source_note: text(valueByHeader(row, 'Ghi chu', 'Ghi chÃº')),
      direction: (amount as number) > 0 ? 'in' : 'out',
      amount_delta: amount as number,
      book_type_name: bookType,
      status: mapStatus(text(valueByHeader(row, 'Trạng thái', 'Trang thai'))),
    })
  }

  return { valid, invalid }
}

export async function previewKiotVietCashbookImport(input: CashbookImportInput) {
  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      account_count: accountKeys(input.rows).length,
      cash_rows: input.rows.filter((row) => row.account_type === 'cash').length,
      bank_rows: input.rows.filter((row) => row.account_type === 'bank').length,
      posted_rows: input.rows.filter((row) => row.status === 'posted').length,
      cancelled_rows: input.rows.filter((row) => row.status === 'cancelled').length,
      cash_total_delta: sum(input.rows.filter((row) => row.account_type === 'cash').map((row) => row.amount_delta)),
      bank_total_delta: sum(input.rows.filter((row) => row.account_type === 'bank').map((row) => row.amount_delta)),
    },
    invalid_rows: input.invalidRows,
    accounts: accountKeys(input.rows),
  }
}

export async function applyKiotVietCashbookImport(input: CashbookImportInput) {
  if (input.invalidRows.length > 0) {
    return {
      summary: {
        total_rows: input.rows.length + input.invalidRows.length,
        valid_rows: input.rows.length,
        invalid_rows: input.invalidRows.length,
        created_rows: 0,
        updated_rows: 0,
        skipped_rows: input.rows.length,
        accounts_created: 0,
        accounts_updated: 0,
      },
      invalid_rows: input.invalidRows,
    }
  }

  const result = await input.repository.upsertImportedKiotVietCashbook?.({
    organizationId: input.organizationId,
    rows: input.rows,
  }) ?? { accounts_created: 0, accounts_updated: 0, entries_created: 0, entries_updated: 0, skipped_rows: input.rows.length }

  return {
    summary: {
      total_rows: input.rows.length,
      valid_rows: input.rows.length,
      invalid_rows: 0,
      created_rows: result.entries_created,
      updated_rows: result.entries_updated,
      skipped_rows: result.skipped_rows,
      accounts_created: result.accounts_created,
      accounts_updated: result.accounts_updated,
    },
    invalid_rows: [],
  }
}

function accountKeys(rows: KiotVietCashbookImportRow[]) {
  const byKey = new Map<string, { account_type: KiotVietCashbookAccountType; account_name: string; account_number: string | null }>()
  for (const row of rows) {
    const key = row.account_type === 'cash' ? 'cash:' : `bank:${normalize(row.account_name)}:${row.account_number ?? ''}`
    if (!byKey.has(key)) byKey.set(key, {
      account_type: row.account_type,
      account_name: row.account_name,
      account_number: row.account_number,
    })
  }
  return [...byKey.values()]
}

function mapAccountType(value: string) {
  return normalize(value).includes('ngan hang') ? 'bank' : 'cash'
}

function mapStatus(value: string | null): KiotVietCashbookStatus {
  return normalize(value).includes('huy') ? 'cancelled' : 'posted'
}

function kiotVietDate(value: unknown) {
  if (typeof value === 'number') return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString()
  return text(value)
}

function valueByHeader(row: KiotVietRawCashbookRow, ...headers: string[]) {
  for (const header of headers) {
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header]
  }
  const normalizedHeaders = new Set(headers.map(normalize))
  const matchedKey = Object.keys(row).find((key) => normalizedHeaders.has(normalize(key)))
  return matchedKey ? row[matchedKey] : undefined
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
  const result = Number(String(value).replaceAll(',', '').trim())
  return Number.isFinite(result) ? result : null
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}
