import { parseKiotVietProductWorkbookBuffer } from '../catalog/product-import.js'

export type KiotVietSupplierStatus = 'active' | 'inactive'

export interface KiotVietRawSupplierRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietSupplierImportRow {
  rowNumber: number
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  area_name: string | null
  ward_name: string | null
  tax_code: string | null
  note: string | null
  company_name: string | null
  source_creator_name: string | null
  source_created_at: string | null
  status: KiotVietSupplierStatus
  kiotviet_current_payable: number | null
  kiotviet_total_purchase: number | null
  kiotviet_net_purchase: number | null
}

export interface KiotVietInvalidSupplierRow {
  rowNumber: number
  code: string | null
  name: string | null
  errors: Array<'missing_code' | 'missing_name'>
}

export type SupplierImportUpsertRow = KiotVietSupplierImportRow

export interface SupplierImportRepository {
  findSuppliersByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  upsertSuppliersByCode?(input: { organizationId: string; rows: SupplierImportUpsertRow[] }): Promise<{
    created: number
    updated: number
    skipped: number
  }>
}

export interface SupplierImportInput {
  organizationId: string
  repository: SupplierImportRepository
  rows: KiotVietSupplierImportRow[]
  invalidRows: KiotVietInvalidSupplierRow[]
}

export const ignoredKiotVietSupplierColumns = ['Số CMND/CCCD', 'Nhóm nhà cung cấp']

export function parseKiotVietSupplierWorkbookBuffer(buffer: Buffer): KiotVietRawSupplierRow[] {
  return parseKiotVietProductWorkbookBuffer(buffer)
}

export function mapKiotVietSupplierRows(rows: KiotVietRawSupplierRow[]) {
  const valid: KiotVietSupplierImportRow[] = []
  const invalid: KiotVietInvalidSupplierRow[] = []

  for (const row of rows) {
    const code = text(valueByHeader(row, 'Mã nhà cung cấp', 'Ma nha cung cap', 'Mã NCC', 'Ma NCC'))
    const name = text(valueByHeader(row, 'Tên nhà cung cấp', 'Ten nha cung cap', 'Tên NCC', 'Ten NCC'))
    const errors: KiotVietInvalidSupplierRow['errors'] = []
    if (!code) errors.push('missing_code')
    if (!name) errors.push('missing_name')

    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, code, name, errors })
      continue
    }

    const areaName = text(valueByHeader(row, 'Khu vực', 'Khu vuc'))
    const wardName = text(valueByHeader(row, 'Phường/Xã', 'Phuong/Xa', 'Phuong Xa'))

    valid.push({
      rowNumber: row.rowNumber,
      code: code as string,
      name: name as string,
      phone: text(valueByHeader(row, 'Điện thoại', 'Dien thoai')),
      email: text(valueByHeader(row, 'Email')),
      address: supplierAddress(text(valueByHeader(row, 'Địa chỉ', 'Dia chi')), wardName, areaName),
      area_name: areaName,
      ward_name: wardName,
      tax_code: text(valueByHeader(row, 'Mã số thuế', 'Ma so thue', 'MST')),
      note: text(valueByHeader(row, 'Ghi chú', 'Ghi chu')),
      company_name: text(valueByHeader(row, 'Công ty', 'Cong ty')),
      source_creator_name: text(valueByHeader(row, 'Người tạo', 'Nguoi tao')),
      source_created_at: supplierDate(valueByHeader(row, 'Ngày tạo', 'Ngay tao')),
      status: number(valueByHeader(row, 'Trạng thái', 'Trang thai')) === 0 ? 'inactive' : 'active',
      kiotviet_current_payable: number(valueByHeader(row, 'Nợ cần trả hiện tại', 'No can tra hien tai')),
      kiotviet_total_purchase: number(valueByHeader(row, 'Tổng mua', 'Tong mua')),
      kiotviet_net_purchase: number(valueByHeader(row, 'Tổng mua trừ trả hàng', 'Tong mua tru tra hang')),
    })
  }

  return { valid, invalid }
}

export async function previewKiotVietSupplierImport(input: SupplierImportInput) {
  const codes = unique(input.rows.map((row) => row.code))
  const existingCodes = await input.repository.findSuppliersByCodes?.({ organizationId: input.organizationId, codes }) ?? new Set<string>()
  const updateRows = input.rows.filter((row) => existingCodes.has(row.code)).length

  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      create_rows: input.rows.length - updateRows,
      update_rows: updateRows,
      kiotviet_payable_total: sum(input.rows.map((row) => row.kiotviet_current_payable)),
      kiotviet_total_purchase: sum(input.rows.map((row) => row.kiotviet_total_purchase)),
      ignored_columns: ignoredKiotVietSupplierColumns,
    },
    invalid_rows: input.invalidRows,
  }
}

export async function applyKiotVietSupplierImport(input: SupplierImportInput) {
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

  const upsert = await input.repository.upsertSuppliersByCode?.({ organizationId: input.organizationId, rows: input.rows }) ?? {
    created: 0,
    updated: 0,
    skipped: input.rows.length,
  }

  return {
    summary: {
      total_rows: input.rows.length,
      valid_rows: input.rows.length,
      invalid_rows: 0,
      created_rows: upsert.created,
      updated_rows: upsert.updated,
      skipped_rows: upsert.skipped,
      kiotviet_payable_total: sum(input.rows.map((row) => row.kiotviet_current_payable)),
      kiotviet_total_purchase: sum(input.rows.map((row) => row.kiotviet_total_purchase)),
    },
    invalid_rows: [],
  }
}

function supplierAddress(address: string | null, wardName: string | null, areaName: string | null) {
  const parts = [address, wardName, areaName].filter((part): part is string => Boolean(part))
  const uniqueParts: string[] = []
  for (const part of parts) {
    const normalized = normalizeKiotVietHeader(part)
    if (uniqueParts.some((current) => normalizeKiotVietHeader(current).includes(normalized))) continue
    uniqueParts.push(part)
  }
  return uniqueParts.length > 0 ? uniqueParts.join(', ') : null
}

function supplierDate(value: unknown) {
  if (typeof value === 'number') return excelSerialToIso(value)
  return text(value)
}

function excelSerialToIso(value: number) {
  return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString()
}

function valueByHeader(row: KiotVietRawSupplierRow, ...headers: string[]) {
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
    .replace(/Đ/g, 'd')
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
