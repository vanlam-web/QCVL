import { parseKiotVietProductWorkbookBuffer } from '../catalog/product-import.js'
import type { SupplierImportUpsertRow } from './supplier-import.js'

export type KiotVietPurchaseReceiptStatus = 'draft' | 'posted' | 'cancelled'
export const WALK_IN_SUPPLIER_CODE = 'NCC lẻ'
export const WALK_IN_SUPPLIER_NAME = 'Nhà cung cấp lẻ'

export interface KiotVietRawPurchaseReceiptRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietPurchaseReceiptImportRow {
  rowNumber: number
  source_code: string
  received_at: string | null
  source_created_at: string | null
  updated_at: string | null
  supplier_code: string
  supplier_name: string | null
  supplier_phone: string | null
  supplier_address: string | null
  received_by_name: string | null
  source_creator_name: string | null
  subtotal_amount: number
  receipt_discount_amount: number
  payable_amount: number
  paid_amount: number
  note: string | null
  supplier_document_no: string | null
  total_quantity: number | null
  total_item_count: number | null
  status: KiotVietPurchaseReceiptStatus
  product_code: string
  product_name: string | null
  brand_name: string | null
  unit_name: string | null
  product_note: string | null
  list_unit_cost: number | null
  line_discount_percent: number | null
  line_discount_amount: number
  unit_cost: number
  line_amount: number
  quantity: number
}

export interface KiotVietInvalidPurchaseReceiptRow {
  rowNumber: number
  source_code: string | null
  supplier_code: string | null
  product_code: string | null
  errors: Array<
    | 'missing_source_code'
    | 'missing_supplier_code'
    | 'missing_product_code'
    | 'missing_quantity'
    | 'missing_unit_cost'
    | 'missing_supplier_match'
    | 'missing_product_match'
  >
}

export interface PurchaseReceiptImportRepository {
  findPurchaseReceiptsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  findSuppliersByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  findProductsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  upsertSuppliersByCode?(input: { organizationId: string; rows: SupplierImportUpsertRow[] }): Promise<{
    created: number
    updated: number
    skipped: number
  }>
  upsertImportedKiotVietPurchaseReceipts?(input: {
    organizationId: string
    rows: KiotVietPurchaseReceiptImportRow[]
  }): Promise<{
    receipts_created: number
    receipts_updated: number
    items_created: number
    items_updated: number
    skipped_rows: number
  }>
}

export interface PurchaseReceiptImportInput {
  organizationId: string
  repository: PurchaseReceiptImportRepository
  rows: KiotVietPurchaseReceiptImportRow[]
  invalidRows: KiotVietInvalidPurchaseReceiptRow[]
}

export function parseKiotVietPurchaseReceiptWorkbookBuffer(buffer: Buffer): KiotVietRawPurchaseReceiptRow[] {
  return parseKiotVietProductWorkbookBuffer(buffer)
}

export function mapKiotVietPurchaseReceiptRows(rows: KiotVietRawPurchaseReceiptRow[]) {
  const valid: KiotVietPurchaseReceiptImportRow[] = []
  const invalid: KiotVietInvalidPurchaseReceiptRow[] = []

  for (const row of rows) {
    const sourceCode = text(valueByHeader(row, 'Mã nhập hàng', 'Ma nhap hang', 'Mã phiếu nhập', 'Ma phieu nhap'))
    const sourceSupplierCode = text(valueByHeader(row, 'Mã nhà cung cấp', 'Ma nha cung cap', 'Mã NCC', 'Ma NCC'))
    const supplierCode = sourceSupplierCode ?? WALK_IN_SUPPLIER_CODE
    const productCode = text(valueByHeader(row, 'Mã hàng', 'Ma hang', 'Mã sản phẩm', 'Ma san pham', 'SKU'))
    const quantity = number(valueByHeader(row, 'Số lượng', 'So luong'))
    const unitCost = number(valueByHeader(row, 'Giá nhập', 'Gia nhap', 'Đơn giá', 'Don gia'))
    const errors: KiotVietInvalidPurchaseReceiptRow['errors'] = []

    if (!sourceCode) errors.push('missing_source_code')
    if (!productCode) errors.push('missing_product_code')
    if (quantity === null || quantity <= 0) errors.push('missing_quantity')
    if (unitCost === null || unitCost < 0) errors.push('missing_unit_cost')

    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, source_code: sourceCode, supplier_code: supplierCode, product_code: productCode, errors })
      continue
    }

    valid.push({
      rowNumber: row.rowNumber,
      source_code: sourceCode as string,
      received_at: kiotVietDate(valueByHeader(row, 'Thời gian', 'Thoi gian')),
      source_created_at: kiotVietDate(valueByHeader(row, 'Thời gian tạo', 'Thoi gian tao')),
      updated_at: kiotVietDate(valueByHeader(row, 'Ngày cập nhật', 'Ngay cap nhat')),
      supplier_code: supplierCode,
      supplier_name: text(valueByHeader(row, 'Tên nhà cung cấp', 'Ten nha cung cap', 'Tên NCC', 'Ten NCC')) ?? (sourceSupplierCode ? null : WALK_IN_SUPPLIER_NAME),
      supplier_phone: text(valueByHeader(row, 'Điện thoại', 'Dien thoai')),
      supplier_address: text(valueByHeader(row, 'Địa chỉ', 'Dia chi')),
      received_by_name: text(valueByHeader(row, 'Người nhập', 'Nguoi nhap')),
      source_creator_name: text(valueByHeader(row, 'Người tạo', 'Nguoi tao')),
      subtotal_amount: number(valueByHeader(row, 'Tổng tiền hàng', 'Tong tien hang')) ?? 0,
      receipt_discount_amount: number(valueByHeader(row, 'Giảm giá phiếu nhập', 'Giam gia phieu nhap')) ?? 0,
      payable_amount: number(valueByHeader(row, 'Cần trả NCC', 'Can tra NCC')) ?? 0,
      paid_amount: number(valueByHeader(row, 'Tiền đã trả NCC', 'Tien da tra NCC')) ?? 0,
      note: text(valueByHeader(row, 'Ghi chú', 'Ghi chu')),
      supplier_document_no: text(valueByHeader(row, 'Số hóa đơn đầu vào', 'So hoa don dau vao')),
      total_quantity: number(valueByHeader(row, 'Tổng số lượng', 'Tong so luong')),
      total_item_count: number(valueByHeader(row, 'Tổng số mặt hàng', 'Tong so mat hang')),
      status: mapStatus(text(valueByHeader(row, 'Trạng thái', 'Trang thai'))),
      product_code: productCode as string,
      product_name: text(valueByHeader(row, 'Tên hàng', 'Ten hang', 'Tên sản phẩm', 'Ten san pham')),
      brand_name: text(valueByHeader(row, 'Thương hiệu', 'Thuong hieu')),
      unit_name: text(valueByHeader(row, 'ĐVT', 'Đơn vị tính', 'Don vi tinh')),
      product_note: text(valueByHeader(row, 'Ghi chú hàng hóa', 'Ghi chu hang hoa')),
      list_unit_cost: number(valueByHeader(row, 'Đơn giá', 'Don gia')),
      line_discount_percent: number(valueByHeader(row, 'Giảm giá %', 'Giam gia %')),
      line_discount_amount: number(valueByHeader(row, 'Giảm giá', 'Giam gia')) ?? 0,
      unit_cost: unitCost as number,
      line_amount: number(valueByHeader(row, 'Thành tiền', 'Thanh tien')) ?? (quantity as number) * (unitCost as number),
      quantity: quantity as number,
    })
  }

  return { valid, invalid }
}

export async function previewKiotVietPurchaseReceiptImport(input: PurchaseReceiptImportInput) {
  const receiptCodes = unique(input.rows.map((row) => row.source_code))
  const supplierCodes = unique(input.rows.map((row) => row.supplier_code))
  const productCodes = unique(input.rows.map((row) => row.product_code))
  const supplierLookupCodes = unique(supplierCodes.flatMap((code) => codeLookupCandidates(code)))
  const productLookupCodes = unique(productCodes.flatMap((code) => codeLookupCandidates(code)))
  const existingReceipts = await input.repository.findPurchaseReceiptsByCodes?.({
    organizationId: input.organizationId,
    codes: receiptCodes,
  }) ?? new Set<string>()
  const existingSuppliers = await input.repository.findSuppliersByCodes?.({
    organizationId: input.organizationId,
    codes: supplierLookupCodes,
  }) ?? new Set<string>()
  addWalkInSupplierIfUsed(existingSuppliers, supplierLookupCodes)
  const existingProducts = await input.repository.findProductsByCodes?.({
    organizationId: input.organizationId,
    codes: productLookupCodes,
  }) ?? new Set<string>()
  const missingSupplierCodes = supplierCodes.filter((code) => !codeMatchesExisting(code, existingSuppliers))
  const missingProductCodes = productCodes.filter((code) => !codeMatchesExisting(code, existingProducts))
  const updateRows = receiptCodes.filter((code) => existingReceipts.has(code)).length

  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      receipt_count: receiptCodes.length,
      create_rows: receiptCodes.length - updateRows,
      update_rows: updateRows,
      item_rows: input.rows.length,
      missing_supplier_count: missingSupplierCodes.length,
      missing_product_count: missingProductCodes.length,
      payable_total: sum(firstRowsByReceipt(input.rows).map((row) => row.payable_amount)),
      paid_total: sum(firstRowsByReceipt(input.rows).map((row) => row.paid_amount)),
    },
    invalid_rows: input.invalidRows,
    missing_supplier_codes: missingSupplierCodes,
    missing_product_codes: missingProductCodes,
  }
}

export async function applyKiotVietPurchaseReceiptImport(input: PurchaseReceiptImportInput) {
  if (input.invalidRows.length === 0) await ensureWalkInSupplierForImport(input)
  const referenceInvalidRows = await referenceInvalidRowsForImport(input)
  const invalidRows = [...input.invalidRows, ...referenceInvalidRows]
  if (invalidRows.length > 0) {
    return {
      summary: {
        total_rows: input.rows.length + input.invalidRows.length,
        valid_rows: input.rows.length,
        invalid_rows: invalidRows.length,
        created_rows: 0,
        updated_rows: 0,
        skipped_rows: input.rows.length,
        items_created: 0,
        items_updated: 0,
      },
      invalid_rows: invalidRows,
    }
  }

  const upsert = await input.repository.upsertImportedKiotVietPurchaseReceipts?.({
    organizationId: input.organizationId,
    rows: input.rows,
  }) ?? {
    receipts_created: 0,
    receipts_updated: 0,
    items_created: 0,
    items_updated: 0,
    skipped_rows: input.rows.length,
  }

  return {
    summary: {
      total_rows: input.rows.length,
      valid_rows: input.rows.length,
      invalid_rows: 0,
      created_rows: upsert.receipts_created,
      updated_rows: upsert.receipts_updated,
      skipped_rows: upsert.skipped_rows,
      items_created: upsert.items_created,
      items_updated: upsert.items_updated,
    },
    invalid_rows: [],
  }
}

async function referenceInvalidRowsForImport(input: PurchaseReceiptImportInput) {
  const supplierCodes = unique(input.rows.map((row) => row.supplier_code))
  const productCodes = unique(input.rows.map((row) => row.product_code))
  const existingSuppliers = await input.repository.findSuppliersByCodes?.({
    organizationId: input.organizationId,
    codes: unique(supplierCodes.flatMap((code) => codeLookupCandidates(code))),
  }) ?? new Set<string>()
  addWalkInSupplierIfUsed(existingSuppliers, supplierCodes)
  const existingProducts = await input.repository.findProductsByCodes?.({
    organizationId: input.organizationId,
    codes: unique(productCodes.flatMap((code) => codeLookupCandidates(code))),
  }) ?? new Set<string>()
  const invalid: KiotVietInvalidPurchaseReceiptRow[] = []
  for (const row of input.rows) {
    const errors: KiotVietInvalidPurchaseReceiptRow['errors'] = []
    if (!codeMatchesExisting(row.supplier_code, existingSuppliers)) errors.push('missing_supplier_match')
    if (!codeMatchesExisting(row.product_code, existingProducts)) errors.push('missing_product_match')
    if (errors.length > 0) {
      invalid.push({
        rowNumber: row.rowNumber,
        source_code: row.source_code,
        supplier_code: row.supplier_code,
        product_code: row.product_code,
        errors,
      })
    }
  }
  return invalid
}

function firstRowsByReceipt(rows: KiotVietPurchaseReceiptImportRow[]) {
  const byCode = new Map<string, KiotVietPurchaseReceiptImportRow>()
  for (const row of rows) {
    if (!byCode.has(row.source_code)) byCode.set(row.source_code, row)
  }
  return [...byCode.values()]
}

async function ensureWalkInSupplierForImport(input: PurchaseReceiptImportInput) {
  if (!input.rows.some((row) => row.supplier_code === WALK_IN_SUPPLIER_CODE)) return
  await input.repository.upsertSuppliersByCode?.({
    organizationId: input.organizationId,
    rows: [walkInSupplierRow()],
  })
}

function addWalkInSupplierIfUsed(existingSuppliers: Set<string>, supplierCodes: string[]) {
  if (supplierCodes.some((code) => codeLookupCandidates(code).includes(WALK_IN_SUPPLIER_CODE))) {
    existingSuppliers.add(WALK_IN_SUPPLIER_CODE)
  }
}

function walkInSupplierRow(): SupplierImportUpsertRow {
  return {
    rowNumber: 0,
    code: WALK_IN_SUPPLIER_CODE,
    name: WALK_IN_SUPPLIER_NAME,
    phone: null,
    email: null,
    address: null,
    area_name: null,
    ward_name: null,
    tax_code: null,
    note: 'Tạo tự động khi import phiếu nhập KiotViet không có mã nhà cung cấp.',
    company_name: null,
    source_creator_name: null,
    source_created_at: null,
    status: 'active',
    kiotviet_current_payable: null,
    kiotviet_total_purchase: null,
    kiotviet_net_purchase: null,
  }
}

function mapStatus(value: string | null): KiotVietPurchaseReceiptStatus {
  const normalized = normalizeKiotVietHeader(value)
  if (normalized.includes('huy')) return 'cancelled'
  if (normalized.includes('tam') || normalized.includes('draft')) return 'draft'
  return 'posted'
}

export function baseKiotVietCode(value: string) {
  return value.trim().replace(/\{DEL\d*\}$/i, '')
}

function codeLookupCandidates(code: string) {
  const baseCode = baseKiotVietCode(code)
  return baseCode === code ? [code] : [code, baseCode]
}

function codeMatchesExisting(code: string, existingCodes: Set<string>) {
  return codeLookupCandidates(code).some((candidate) => existingCodes.has(candidate))
}

function kiotVietDate(value: unknown) {
  if (typeof value === 'number') return excelSerialToIso(value)
  return text(value)
}

function excelSerialToIso(value: number) {
  return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString()
}

function valueByHeader(row: KiotVietRawPurchaseReceiptRow, ...headers: string[]) {
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
    .replace(/[đĐ]/g, 'd')
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

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}
