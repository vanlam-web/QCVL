import type { CustomerImportUpsertRow } from '../catalog/customer-import.js'
import { parseKiotVietProductWorkbookBuffer, type ProductImportUpsertRow } from '../catalog/product-import.js'
import { baseKiotVietCode } from '../purchase/purchase-receipt-import.js'

export type KiotVietInvoiceStatus = 'completed' | 'cancelled'

export interface KiotVietRawInvoiceRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietInvoiceImportRow {
  rowNumber: number
  source_code: string
  created_at: string | null
  updated_at: string | null
  customer_code: string
  customer_name: string
  customer_phone: string | null
  customer_address: string | null
  price_list_name: string | null
  source_user_name: string | null
  channel_name: null
  note: string | null
  subtotal_amount: number
  invoice_discount_amount: number
  other_income_amount: number
  total_amount: number
  paid_amount: number
  cash_amount: number
  bank_amount: number
  status: KiotVietInvoiceStatus
  product_code: string
  product_name: string
  unit_name: string | null
  stock_qty_per_sale_unit?: number | null
  product_note: string | null
  quantity: number
  list_unit_price: number | null
  line_discount_percent: number | null
  line_discount_amount: number
  unit_price: number
  line_amount: number
}

export interface KiotVietInvalidInvoiceRow {
  rowNumber: number
  source_code: string | null
  customer_code: string | null
  product_code: string | null
  errors: Array<
    | 'missing_source_code'
    | 'missing_customer_code'
    | 'missing_product_code'
    | 'missing_quantity'
    | 'missing_unit_price'
    | 'missing_customer_match'
    | 'missing_product_match'
  >
}

export interface InvoiceImportRepository {
  findSalesDocumentsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  findCustomersByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  findProductsByCodes?(input: { organizationId: string; codes: string[] }): Promise<Set<string>>
  upsertCustomersByCode?(input: { organizationId: string; rows: CustomerImportUpsertRow[] }): Promise<{ created: number; updated: number; skipped: number }>
  upsertProductsByCode?(input: { organizationId: string; rows: ProductImportUpsertRow[] }): Promise<{ created: number; updated: number; skipped: number }>
  upsertImportedKiotVietInvoices?(input: {
    organizationId: string
    rows: KiotVietInvoiceImportRow[]
  }): Promise<{
    invoices_created: number
    invoices_updated: number
    items_created: number
    items_updated: number
    skipped_rows: number
  }>
}

export interface InvoiceImportInput {
  organizationId: string
  repository: InvoiceImportRepository
  rows: KiotVietInvoiceImportRow[]
  invalidRows: KiotVietInvalidInvoiceRow[]
}

export function parseKiotVietInvoiceWorkbookBuffer(buffer: Buffer): KiotVietRawInvoiceRow[] {
  return parseKiotVietProductWorkbookBuffer(buffer)
}

export function mapKiotVietInvoiceRows(rows: KiotVietRawInvoiceRow[]) {
  const valid: KiotVietInvoiceImportRow[] = []
  const invalid: KiotVietInvalidInvoiceRow[] = []

  for (const row of rows) {
    const sourceCode = text(valueByHeader(row, 'Mã hóa đơn', 'Ma hoa don'))
    const rawCustomerCode = text(valueByHeader(row, 'Mã khách hàng', 'Ma khach hang'))
    const customerCode = normalizeInvoiceCustomerCode(rawCustomerCode)
    const productCode = text(valueByHeader(row, 'Mã hàng', 'Ma hang', 'Mã sản phẩm', 'Ma san pham', 'SKU'))
    const quantity = number(valueByHeader(row, 'Số lượng', 'So luong'))
    const unitPrice = number(valueByHeader(row, 'Giá bán', 'Gia ban', 'Đơn giá', 'Don gia'))
    const errors: KiotVietInvalidInvoiceRow['errors'] = []

    if (!sourceCode) errors.push('missing_source_code')
    if (!customerCode) errors.push('missing_customer_code')
    if (!productCode) errors.push('missing_product_code')
    if (quantity === null || quantity <= 0) errors.push('missing_quantity')
    if (unitPrice === null || unitPrice < 0) errors.push('missing_unit_price')

    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, source_code: sourceCode, customer_code: customerCode, product_code: productCode, errors })
      continue
    }

    const customerName = text(valueByHeader(row, 'Tên khách hàng', 'Ten khach hang')) ?? (customerCode === WALK_IN_CUSTOMER_CODE ? 'Khách lẻ' : customerCode)
    const subtotal = number(valueByHeader(row, 'Tổng tiền hàng', 'Tong tien hang')) ?? 0
    const discount = number(valueByHeader(row, 'Giảm giá hóa đơn', 'Giam gia hoa don')) ?? 0
    const otherIncome = number(valueByHeader(row, 'Thu khác', 'Thu khac')) ?? 0
    const total = number(valueByHeader(row, 'Khách cần trả', 'Khach can tra')) ?? Math.max(subtotal - discount + otherIncome, 0)
    const paid = number(valueByHeader(row, 'Khách đã trả', 'Khach da tra')) ?? 0

    valid.push({
      rowNumber: row.rowNumber,
      source_code: sourceCode as string,
      created_at: kiotVietDate(valueByHeader(row, 'Thời gian', 'Thoi gian', 'Thời gian tạo', 'Thoi gian tao')),
      updated_at: kiotVietDate(valueByHeader(row, 'Ngày cập nhật', 'Ngay cap nhat')),
      customer_code: customerCode as string,
      customer_name: customerName,
      customer_phone: text(valueByHeader(row, 'Điện thoại', 'Dien thoai')),
      customer_address: compactAddress(
        text(valueByHeader(row, 'Địa chỉ (Khách hàng)', 'Dia chi (Khach hang)')),
        text(valueByHeader(row, 'Phường/Xã (Khách hàng)', 'Phuong/Xa (Khach hang)')),
        text(valueByHeader(row, 'Khu vực (Khách hàng)', 'Khu vuc (Khach hang)')),
      ),
      price_list_name: text(valueByHeader(row, 'Bảng giá', 'Bang gia')),
      source_user_name: text(valueByHeader(row, 'Người tạo', 'Nguoi tao')) ?? text(valueByHeader(row, 'Người bán', 'Nguoi ban')),
      channel_name: null,
      note: text(valueByHeader(row, 'Ghi chú', 'Ghi chu')),
      subtotal_amount: subtotal,
      invoice_discount_amount: discount,
      other_income_amount: otherIncome,
      total_amount: total,
      paid_amount: paid,
      cash_amount: number(valueByHeader(row, 'Tiền mặt', 'Tien mat')) ?? 0,
      bank_amount: number(valueByHeader(row, 'Chuyển khoản', 'Chuyen khoan')) ?? 0,
      status: mapInvoiceStatus(text(valueByHeader(row, 'Trạng thái', 'Trang thai'))),
      product_code: productCode as string,
      product_name: text(valueByHeader(row, 'Tên hàng', 'Ten hang', 'Tên sản phẩm', 'Ten san pham')) ?? productCode as string,
      unit_name: text(valueByHeader(row, 'ĐVT', 'Đơn vị tính', 'Don vi tinh')),
      product_note: text(valueByHeader(row, 'Ghi chú hàng hóa', 'Ghi chu hang hoa')),
      quantity: quantity as number,
      list_unit_price: number(valueByHeader(row, 'Đơn giá', 'Don gia')),
      line_discount_percent: number(valueByHeader(row, 'Giảm giá %', 'Giam gia %')),
      line_discount_amount: number(valueByHeader(row, 'Giảm giá', 'Giam gia')) ?? 0,
      unit_price: unitPrice as number,
      line_amount: number(valueByHeader(row, 'Thành tiền', 'Thanh tien')) ?? (quantity as number) * (unitPrice as number),
    })
  }

  return { valid, invalid }
}

export async function previewKiotVietInvoiceImport(input: InvoiceImportInput) {
  const invoiceCodes = unique(input.rows.map((row) => row.source_code))
  const customerCodes = unique(input.rows.map((row) => row.customer_code))
  const productCodes = unique(input.rows.map((row) => row.product_code))
  const existingInvoices = await input.repository.findSalesDocumentsByCodes?.({ organizationId: input.organizationId, codes: invoiceCodes }) ?? new Set<string>()
  const existingCustomers = await input.repository.findCustomersByCodes?.({ organizationId: input.organizationId, codes: customerCodes }) ?? new Set<string>()
  addAutoResolvableCustomerCodes(existingCustomers, customerCodes)
  const existingProducts = await input.repository.findProductsByCodes?.({
    organizationId: input.organizationId,
    codes: unique(productCodes.flatMap((code) => codeLookupCandidates(code))),
  }) ?? new Set<string>()
  addAutoResolvableProductCodes(existingProducts, productCodes)
  const missingCustomerCodes = customerCodes.filter((code) => !codeMatchesExisting(code, existingCustomers))
  const missingProductCodes = productCodes.filter((code) => !codeMatchesExisting(code, existingProducts))
  const updateRows = invoiceCodes.filter((code) => existingInvoices.has(code)).length
  const firstRows = firstRowsByInvoice(input.rows)

  return {
    summary: {
      total_rows: input.rows.length + input.invalidRows.length,
      valid_rows: input.rows.length,
      invalid_rows: input.invalidRows.length,
      invoice_count: invoiceCodes.length,
      create_rows: invoiceCodes.length - updateRows,
      update_rows: updateRows,
      item_rows: input.rows.length,
      missing_customer_count: missingCustomerCodes.length,
      missing_product_count: missingProductCodes.length,
      total_amount: sum(firstRows.map((row) => row.total_amount)),
      paid_total: sum(firstRows.map((row) => row.paid_amount)),
      cash_total: sum(firstRows.map((row) => row.cash_amount)),
      bank_total: sum(firstRows.map((row) => row.bank_amount)),
    },
    invalid_rows: input.invalidRows,
    missing_customer_codes: missingCustomerCodes,
    missing_product_codes: missingProductCodes,
  }
}

export async function applyKiotVietInvoiceImport(input: InvoiceImportInput) {
  if (input.invalidRows.length === 0) await ensureAutoReferencesForImport(input)
  const invalidRows = [...input.invalidRows, ...await referenceInvalidRowsForImport(input)]
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

  const upsert = await input.repository.upsertImportedKiotVietInvoices?.({
    organizationId: input.organizationId,
    rows: input.rows,
  }) ?? {
    invoices_created: 0,
    invoices_updated: 0,
    items_created: 0,
    items_updated: 0,
    skipped_rows: input.rows.length,
  }

  return {
    summary: {
      total_rows: input.rows.length,
      valid_rows: input.rows.length,
      invalid_rows: 0,
      created_rows: upsert.invoices_created,
      updated_rows: upsert.invoices_updated,
      skipped_rows: upsert.skipped_rows,
      items_created: upsert.items_created,
      items_updated: upsert.items_updated,
    },
    invalid_rows: [],
  }
}

const WALK_IN_CUSTOMER_CODE = 'khachle'

async function ensureAutoReferencesForImport(input: InvoiceImportInput) {
  const customerRows = autoCustomerRows(input.rows)
  const productRows = autoDeletedProductRows(input.rows)
  if (customerRows.length > 0) {
    await input.repository.upsertCustomersByCode?.({ organizationId: input.organizationId, rows: customerRows })
  }
  if (productRows.length > 0) {
    await input.repository.upsertProductsByCode?.({ organizationId: input.organizationId, rows: productRows })
  }
}

function addAutoResolvableCustomerCodes(existingCustomers: Set<string>, customerCodes: string[]) {
  for (const code of customerCodes) {
    if (code === WALK_IN_CUSTOMER_CODE || isDeletedKiotVietCode(code)) existingCustomers.add(code)
  }
}

function addAutoResolvableProductCodes(existingProducts: Set<string>, productCodes: string[]) {
  for (const code of productCodes) {
    if (isDeletedKiotVietCode(code)) existingProducts.add(code)
  }
}

function autoCustomerRows(rows: KiotVietInvoiceImportRow[]): CustomerImportUpsertRow[] {
  const byCode = new Map<string, KiotVietInvoiceImportRow>()
  for (const row of rows) {
    if (row.customer_code !== WALK_IN_CUSTOMER_CODE && !isDeletedKiotVietCode(row.customer_code)) continue
    if (!byCode.has(row.customer_code)) byCode.set(row.customer_code, row)
  }
  return [...byCode.values()].map((row) => row.customer_code === WALK_IN_CUSTOMER_CODE ? walkInCustomerRow(row) : deletedCustomerRow(row))
}

function autoDeletedProductRows(rows: KiotVietInvoiceImportRow[]): ProductImportUpsertRow[] {
  const byCode = new Map<string, KiotVietInvoiceImportRow>()
  for (const row of rows) {
    if (!isDeletedKiotVietCode(row.product_code)) continue
    if (!byCode.has(row.product_code)) byCode.set(row.product_code, row)
  }
  return [...byCode.values()].map(deletedProductRow)
}

function walkInCustomerRow(row: KiotVietInvoiceImportRow): CustomerImportUpsertRow {
  return {
    rowNumber: 0,
    code: WALK_IN_CUSTOMER_CODE,
    name: row.customer_name || 'Khách lẻ',
    customer_type: 'individual',
    company_name: null,
    phone: row.customer_phone,
    tax_code: null,
    address: row.customer_address,
    area_name: null,
    ward_name: null,
    customer_group_name: null,
    customer_group_id: null,
    note: 'Tạo tự động khi import hóa đơn KiotViet không có mã khách hàng.',
    source_creator_name: null,
    source_created_at: null,
    last_transaction_at: row.created_at,
    status: 'active',
    kiotviet_current_debt: null,
    kiotviet_total_sales: null,
    kiotviet_net_sales: null,
  }
}

function deletedCustomerRow(row: KiotVietInvoiceImportRow): CustomerImportUpsertRow {
  return {
    rowNumber: row.rowNumber,
    code: row.customer_code,
    name: row.customer_name || row.customer_code,
    customer_type: 'individual',
    company_name: null,
    phone: row.customer_phone,
    tax_code: null,
    address: row.customer_address,
    area_name: null,
    ward_name: null,
    customer_group_name: null,
    customer_group_id: null,
    note: 'Khách hàng lịch sử đã xóa trên KiotViet, tạo để giữ hóa đơn cũ.',
    source_creator_name: row.source_user_name,
    source_created_at: row.created_at,
    last_transaction_at: row.created_at,
    status: 'inactive',
    kiotviet_current_debt: null,
    kiotviet_total_sales: null,
    kiotviet_net_sales: null,
  }
}

function deletedProductRow(row: KiotVietInvoiceImportRow): ProductImportUpsertRow {
  const unitName = row.unit_name ?? 'ĐVT'
  const source = {
    rowNumber: row.rowNumber,
    code: row.product_code,
    name: row.product_name || row.product_code,
    product_group_name: '',
    product_kind: 'goods',
    inventory_shape: 'normal',
    sell_method: 'quantity',
    track_inventory: false,
    unit_name: unitName,
    unit_name_needs_review: false,
    latest_purchase_cost: null,
    status: 'inactive',
    unit_conversions: [],
    sale_price: row.unit_price,
    provisional_stock: null,
    bom_text: null,
    expected_out_of_stock_text: null,
    source_created_at: row.created_at,
    ignored: {
      brand: null,
      min_stock: null,
      max_stock: null,
      direct_sale: null,
      location: null,
    },
  } satisfies ProductImportUpsertRow['source']
  return {
    code: row.product_code,
    name: row.product_name || row.product_code,
    status: 'inactive',
    product_group_id: null,
    unit_name: unitName,
    sell_method: 'quantity',
    product_kind: 'goods',
    inventory_shape: 'normal',
    track_inventory: false,
    latest_purchase_cost: null,
    unit_conversions: [],
    source_created_at: row.created_at,
    source,
  }
}

function isDeletedKiotVietCode(code: string) {
  return /\{DEL\d*\}$/i.test(code.trim())
}

async function referenceInvalidRowsForImport(input: InvoiceImportInput) {
  const customerCodes = unique(input.rows.map((row) => row.customer_code))
  const productCodes = unique(input.rows.map((row) => row.product_code))
  const existingCustomers = await input.repository.findCustomersByCodes?.({ organizationId: input.organizationId, codes: customerCodes }) ?? new Set<string>()
  addAutoResolvableCustomerCodes(existingCustomers, customerCodes)
  const existingProducts = await input.repository.findProductsByCodes?.({
    organizationId: input.organizationId,
    codes: unique(productCodes.flatMap((code) => codeLookupCandidates(code))),
  }) ?? new Set<string>()
  addAutoResolvableProductCodes(existingProducts, productCodes)
  const invalid: KiotVietInvalidInvoiceRow[] = []
  for (const row of input.rows) {
    const errors: KiotVietInvalidInvoiceRow['errors'] = []
    if (!codeMatchesExisting(row.customer_code, existingCustomers)) errors.push('missing_customer_match')
    if (!codeMatchesExisting(row.product_code, existingProducts)) errors.push('missing_product_match')
    if (errors.length > 0) {
      invalid.push({ rowNumber: row.rowNumber, source_code: row.source_code, customer_code: row.customer_code, product_code: row.product_code, errors })
    }
  }
  return invalid
}

function firstRowsByInvoice(rows: KiotVietInvoiceImportRow[]) {
  const byCode = new Map<string, KiotVietInvoiceImportRow>()
  for (const row of rows) {
    if (!byCode.has(row.source_code)) byCode.set(row.source_code, row)
  }
  return [...byCode.values()]
}

function normalizeInvoiceCustomerCode(value: string | null) {
  const normalized = String(value ?? '').trim()
  if (!normalized || normalizeKiotVietHeader(normalized) === 'khach le') return WALK_IN_CUSTOMER_CODE
  return normalized
}

function mapInvoiceStatus(value: string | null): KiotVietInvoiceStatus {
  const normalized = normalizeKiotVietHeader(value)
  return normalized.includes('huy') ? 'cancelled' : 'completed'
}

function codeLookupCandidates(code: string) {
  const baseCode = baseKiotVietCode(code)
  return baseCode === code ? [code] : [code, baseCode]
}

function codeMatchesExisting(code: string, existingCodes: Set<string>) {
  return codeLookupCandidates(code).some((candidate) => existingCodes.has(candidate))
}

function compactAddress(...parts: Array<string | null>) {
  const result = parts.filter(Boolean).join(', ')
  return result || null
}

function kiotVietDate(value: unknown) {
  if (typeof value === 'number') return excelSerialToIso(value)
  return text(value)
}

function excelSerialToIso(value: number) {
  return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString()
}

function valueByHeader(row: KiotVietRawInvoiceRow, ...headers: string[]) {
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
