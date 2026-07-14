import { parseKiotVietProductWorkbookBuffer } from './product-import.js'

export type KiotVietCustomerStatus = 'active' | 'inactive'
export type KiotVietCustomerType = 'individual' | 'company' | 'other'

export interface KiotVietRawCustomerRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietCustomerImportRow {
  rowNumber: number
  code: string
  name: string
  customer_type: KiotVietCustomerType
  company_name: string | null
  phone: string | null
  tax_code: string | null
  address: string | null
  area_name: string | null
  ward_name: string | null
  customer_group_name: string | null
  note: string | null
  source_creator_name: string | null
  source_created_at: string | null
  last_transaction_at: string | null
  status: KiotVietCustomerStatus
  kiotviet_current_debt: number | null
  kiotviet_total_sales: number | null
  kiotviet_net_sales: number | null
}

export interface KiotVietInvalidCustomerRow {
  rowNumber: number
  code: string | null
  name: string | null
  errors: Array<'missing_code' | 'missing_name'>
}

export interface CustomerImportUpsertRow extends KiotVietCustomerImportRow {
  customer_group_id: string | null
}

export interface CustomerImportRepository {
  findCustomersByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  upsertCustomerGroupsByName?(input: { organizationId: string; names: string[] }): Promise<Map<string, string>>
  upsertCustomersByCode?(input: { organizationId: string; rows: CustomerImportUpsertRow[] }): Promise<{
    created: number
    updated: number
    skipped: number
  }>
}

export interface CustomerImportInput {
  organizationId: string
  repository: CustomerImportRepository
  rows: KiotVietCustomerImportRow[]
  invalidRows: KiotVietInvalidCustomerRow[]
}

export const ignoredKiotVietCustomerColumns = ['Chi nhánh tạo', 'Số CMND/CCCD', 'Ngày sinh', 'Giới tính', 'Email', 'Facebook']

export function parseKiotVietCustomerWorkbookBuffer(buffer: Buffer): KiotVietRawCustomerRow[] {
  return parseKiotVietProductWorkbookBuffer(buffer)
}

export function mapKiotVietCustomerRows(rows: KiotVietRawCustomerRow[]) {
  const valid: KiotVietCustomerImportRow[] = []
  const invalid: KiotVietInvalidCustomerRow[] = []

  for (const row of rows) {
    const code = text(valueByHeader(row, 'Mã khách hàng', 'Ma khach hang'))
    const name = text(valueByHeader(row, 'Tên khách hàng', 'Ten khach hang'))
    const errors: KiotVietInvalidCustomerRow['errors'] = []
    if (!code) errors.push('missing_code')
    if (!name) errors.push('missing_name')

    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, code, name, errors })
      continue
    }

    const address = customerAddress(
      text(valueByHeader(row, 'Địa chỉ', 'Dia chi')),
      text(valueByHeader(row, 'Phường/Xã', 'Phuong/Xa', 'Phuong Xa')),
      text(valueByHeader(row, 'Khu vực giao hàng', 'Khu vuc giao hang')),
    )

    valid.push({
      rowNumber: row.rowNumber,
      code: code as string,
      name: name as string,
      customer_type: mapCustomerType(text(valueByHeader(row, 'Loại khách', 'Loai khach'))),
      company_name: text(valueByHeader(row, 'Công ty', 'Cong ty')),
      phone: text(valueByHeader(row, 'Điện thoại', 'Dien thoai')),
      tax_code: text(valueByHeader(row, 'Mã số thuế', 'Ma so thue', 'MST')),
      address,
      area_name: text(valueByHeader(row, 'Khu vực giao hàng', 'Khu vuc giao hang')),
      ward_name: text(valueByHeader(row, 'Phường/Xã', 'Phuong/Xa', 'Phuong Xa')),
      customer_group_name: text(valueByHeader(row, 'Nhóm khách hàng', 'Nhom khach hang')),
      note: text(valueByHeader(row, 'Ghi chú', 'Ghi chu')),
      source_creator_name: text(valueByHeader(row, 'Người tạo', 'Nguoi tao')),
      source_created_at: customerDate(valueByHeader(row, 'Ngày tạo', 'Ngay tao')),
      last_transaction_at: customerDate(valueByHeader(row, 'Ngày giao dịch cuối', 'Ngay giao dich cuoi')),
      status: number(valueByHeader(row, 'Trạng thái', 'Trang thai')) === 0 ? 'inactive' : 'active',
      kiotviet_current_debt: number(valueByHeader(row, 'Nợ cần thu hiện tại', 'No can thu hien tai')),
      kiotviet_total_sales: number(valueByHeader(row, 'Tổng bán', 'Tong ban')),
      kiotviet_net_sales: number(valueByHeader(row, 'Tổng bán trừ trả hàng', 'Tong ban tru tra hang')),
    })
  }

  return { valid, invalid }
}

export async function previewKiotVietCustomerImport(input: CustomerImportInput) {
  const codes = unique(input.rows.map((row) => row.code))
  const existingCodes = await input.repository.findCustomersByCodes?.({ organizationId: input.organizationId, codes }) ?? new Set<string>()
  const updateRows = input.rows.filter((row) => existingCodes.has(row.code)).length
  const groupRows = unique(input.rows.map((row) => row.customer_group_name ?? '')).length

  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      create_rows: input.rows.length - updateRows,
      update_rows: updateRows,
      group_rows: groupRows,
      kiotviet_debt_total: sum(input.rows.map((row) => row.kiotviet_current_debt)),
      kiotviet_total_sales: sum(input.rows.map((row) => row.kiotviet_total_sales)),
      ignored_columns: ignoredKiotVietCustomerColumns,
    },
    invalid_rows: input.invalidRows,
  }
}

export async function applyKiotVietCustomerImport(input: CustomerImportInput) {
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

  const importRows = input.rows.filter((row) => !isDefaultRetailCustomerCode(row.code))
  const skippedDefaultRows = input.rows.length - importRows.length
  const groupNames = unique(importRows.map((row) => row.customer_group_name ?? ''))
  const groupIds = await input.repository.upsertCustomerGroupsByName?.({ organizationId: input.organizationId, names: groupNames }) ?? new Map<string, string>()
  const rows = importRows.map((row) => ({
    ...row,
    customer_group_id: row.customer_group_name ? groupIds.get(row.customer_group_name) ?? null : null,
  }))
  const upsert = await input.repository.upsertCustomersByCode?.({ organizationId: input.organizationId, rows }) ?? {
    created: 0,
    updated: 0,
    skipped: rows.length,
  }

  return {
    summary: {
      total_rows: input.rows.length,
      valid_rows: input.rows.length,
      invalid_rows: 0,
      created_rows: upsert.created,
      updated_rows: upsert.updated,
      skipped_rows: upsert.skipped + skippedDefaultRows,
      group_rows: groupNames.length,
      kiotviet_debt_total: sum(input.rows.map((row) => row.kiotviet_current_debt)),
      kiotviet_total_sales: sum(input.rows.map((row) => row.kiotviet_total_sales)),
    },
    invalid_rows: [],
  }
}

function isDefaultRetailCustomerCode(code: string) {
  return normalizeKiotVietHeader(code) === 'khachle'
}

function customerAddress(address: string | null, wardName: string | null, areaName: string | null) {
  const parts = [address, wardName, areaName].filter((part): part is string => Boolean(part))
  const uniqueParts: string[] = []
  for (const part of parts) {
    const normalized = normalizeKiotVietHeader(part)
    if (uniqueParts.some((current) => normalizeKiotVietHeader(current).includes(normalized))) continue
    uniqueParts.push(part)
  }
  return uniqueParts.length > 0 ? uniqueParts.join(', ') : null
}

function mapCustomerType(value: string | null): KiotVietCustomerType {
  const normalized = normalizeKiotVietHeader(value)
  if (normalized.includes('cong ty') || normalized.includes('to chuc')) return 'company'
  if (normalized.includes('ca nhan')) return 'individual'
  return 'other'
}

function customerDate(value: unknown) {
  if (typeof value === 'number') return excelSerialToIso(value)
  return text(value)
}

function excelSerialToIso(value: number) {
  return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString()
}

function valueByHeader(row: KiotVietRawCustomerRow, ...headers: string[]) {
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

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function sum(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}
