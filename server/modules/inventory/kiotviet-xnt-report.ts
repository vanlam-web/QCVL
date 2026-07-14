import { parseKiotVietProductWorkbookBuffer } from '../catalog/product-import.js'
import type { KiotVietStocktakeImportRow } from './kiotviet-stocktake-import.js'

export interface KiotVietRawXntReportRow {
  rowNumber: number
  [header: string]: unknown
}

export interface KiotVietXntReportRow {
  rowNumber: number
  product_code: string
  product_name: string | null
  unit_name: string | null
  opening_qty: number
  purchase_qty: number
  stocktake_in_qty: number
  return_in_qty: number
  production_in_qty: number
  sale_out_qty: number
  damage_out_qty: number
  internal_use_out_qty: number
  supplier_return_out_qty: number
  stocktake_out_qty: number
  production_out_qty: number
  ending_qty: number
}

export interface KiotVietInvalidXntReportRow {
  rowNumber: number
  product_code: string | null
  errors: Array<'missing_product_code'>
}

export interface QcvMovementBucketRow {
  product_code: string
  purchase_qty?: number
  stocktake_in_qty?: number
  sale_out_qty?: number
  stocktake_out_qty?: number
  ending_qty?: number
}

export interface XntComparisonRow {
  product_code: string
  product_name: string | null
  unit_name: string | null
  kv_ending_qty: number
  qcv_ending_qty: number | null
  ending_diff: number | null
  bucket_diffs: {
    purchase_qty: number
    stocktake_in_qty: number
    sale_out_qty: number
    stocktake_out_qty: number
  }
}

export function parseKiotVietXntReportWorkbookBuffer(buffer: Buffer): KiotVietRawXntReportRow[] {
  return parseKiotVietProductWorkbookBuffer(buffer)
}

export function mapKiotVietXntReportRows(rows: KiotVietRawXntReportRow[]) {
  const valid: KiotVietXntReportRow[] = []
  const invalid: KiotVietInvalidXntReportRow[] = []

  for (const row of rows) {
    const productCode = text(valueByHeader(row, 'Ma hang', 'Mã hàng'))
    if (!productCode) {
      invalid.push({ rowNumber: row.rowNumber, product_code: null, errors: ['missing_product_code'] })
      continue
    }

    valid.push({
      rowNumber: row.rowNumber,
      product_code: productCode,
      product_name: text(valueByHeader(row, 'Ten hang', 'Tên hàng')),
      unit_name: text(valueByHeader(row, 'Don vi tinh', 'Đơn vị tính', 'DVT', 'ĐVT')),
      opening_qty: qty(row, 'Ton dau ki', 'Tồn đầu kì', 'Tồn đầu kỳ'),
      purchase_qty: qty(row, 'Nhap NCC', 'Nhập NCC'),
      stocktake_in_qty: qty(row, 'Nhap kiem', 'Nhập kiểm'),
      return_in_qty: qty(row, 'Nhap tra', 'Nhập trả'),
      production_in_qty: qty(row, 'Nhap SX', 'Nhập SX'),
      sale_out_qty: qty(row, 'Xuat ban', 'Xuất bán'),
      damage_out_qty: qty(row, 'Xuat huy', 'Xuất hủy'),
      internal_use_out_qty: qty(row, 'Xuat dung noi bo', 'Xuất dùng nội bộ'),
      supplier_return_out_qty: qty(row, 'Xuat tra', 'Xuất trả'),
      stocktake_out_qty: qty(row, 'Xuat kiem', 'Xuất kiểm'),
      production_out_qty: qty(row, 'Xuat SX', 'Xuất SX'),
      ending_qty: qty(row, 'Ton cuoi ki', 'Tồn cuối kì', 'Tồn cuối kỳ'),
    })
  }

  return { valid, invalid }
}

export function compareQcvMovementBucketsWithKiotVietXnt(input: {
  xntRows: KiotVietXntReportRow[]
  qcvRows: QcvMovementBucketRow[]
}) {
  const qcvByCode = new Map(input.qcvRows.map((row) => [row.product_code, row]))
  return input.xntRows.map<XntComparisonRow>((kv) => {
    const qcv = qcvByCode.get(kv.product_code)
    const qcvEnding = qcv?.ending_qty ?? null
    return {
      product_code: kv.product_code,
      product_name: kv.product_name,
      unit_name: kv.unit_name,
      kv_ending_qty: kv.ending_qty,
      qcv_ending_qty: qcvEnding,
      ending_diff: qcvEnding === null ? null : round(qcvEnding - kv.ending_qty),
      bucket_diffs: {
        purchase_qty: round((qcv?.purchase_qty ?? 0) - kv.purchase_qty),
        stocktake_in_qty: round((qcv?.stocktake_in_qty ?? 0) - kv.stocktake_in_qty),
        sale_out_qty: round((qcv?.sale_out_qty ?? 0) - kv.sale_out_qty),
        stocktake_out_qty: round((qcv?.stocktake_out_qty ?? 0) - kv.stocktake_out_qty),
      },
    }
  })
}

export function toKiotVietXntCheckpointRows(input: {
  sourceCode: string
  checkpointAt: string
  rows: KiotVietXntReportRow[]
}): KiotVietStocktakeImportRow[] {
  return input.rows.map((row) => ({
    rowNumber: row.rowNumber,
    source_code: input.sourceCode,
    source_created_at: input.checkpointAt,
    source_creator_name: 'KiotViet XNT',
    source_balanced_at: input.checkpointAt,
    status: 'balanced',
    product_code: row.product_code,
    product_name: row.product_name,
    unit_name: row.unit_name,
    system_qty: null,
    actual_qty: row.ending_qty,
    difference_qty: null,
    increased_qty: null,
    decreased_qty: null,
    total_actual_value: null,
    total_difference_value: null,
    line_difference_value: null,
    note: 'Checkpoint tồn cuối kỳ từ báo cáo Xuất nhập tồn KiotViet.',
    is_deleted_product_code: /\{DEL\d*\}$/i.test(row.product_code),
    formula_valid: true,
  }))
}

function qty(row: KiotVietRawXntReportRow, ...headers: string[]) {
  return number(valueByHeader(row, ...headers)) ?? 0
}

function valueByHeader(row: KiotVietRawXntReportRow, ...headers: string[]) {
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

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}
