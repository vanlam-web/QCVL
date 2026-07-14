import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  compareQcvMovementBucketsWithKiotVietXnt,
  mapKiotVietXntReportRows,
  parseKiotVietXntReportWorkbookBuffer,
  type QcvMovementBucketRow,
} from '../server/modules/inventory/kiotviet-xnt-report.ts'

const apiBase = process.env.QCVL_API_BASE ?? 'http://127.0.0.1:3100'
const login = process.env.QCVL_LOGIN ?? 'admin'
const password = process.env.QCVL_PASSWORD ?? 'ChangeMe123!'
const reportPath = process.argv[2] ?? await latestXntReportPath()

if (!reportPath) {
  throw new Error('Khong tim thay file BaoCaoXuatNhapTonChiTiet_KV*.xlsx trong Downloads.')
}

const token = await loginToken()
const products = await fetchAllProducts(token)
const movements = await fetchStockMovements(token)
const rawRows = parseKiotVietXntReportWorkbookBuffer(readFileSync(reportPath))
const mapped = mapKiotVietXntReportRows(rawRows)
const productById = new Map(products.map((product) => [product.id, product]))
const productsByCode = new Map(products.map((product) => [product.code, product]))
const qcvRows = movementBucketsByProductCode(movements, productById, productsByCode)
const comparison = compareQcvMovementBucketsWithKiotVietXnt({ xntRows: mapped.valid, qcvRows })
const mismatches = comparison
  .filter((row) => row.qcv_ending_qty !== null && Math.abs(row.ending_diff ?? 0) > 0.001)
  .sort((left, right) => Math.abs(right.ending_diff ?? 0) - Math.abs(left.ending_diff ?? 0))
const comparableMismatches = mismatches.filter((row) => {
  const product = productsByCode.get(row.product_code)
  return product?.status === 'active' && product.track_inventory !== false && product.product_kind !== 'combo' && product.product_kind !== 'service'
})
const missingInQcv = comparison.filter((row) => row.qcv_ending_qty === null)

await mkdir('logs', { recursive: true })
await writeFile(
  'logs/kiotviet-xnt-comparison-latest.json',
  `${JSON.stringify({
    generated_at: new Date().toISOString(),
    report_file: reportPath,
    xnt_rows: mapped.valid.length,
    invalid_xnt_rows: mapped.invalid.length,
    qcv_products: products.length,
    qcv_movements: movements.length,
    mismatch_count: mismatches.length,
    comparable_mismatch_count: comparableMismatches.length,
    missing_in_qcv_count: missingInQcv.length,
    mismatches,
    comparable_mismatches: comparableMismatches,
    missing_in_qcv: missingInQcv,
  }, null, 2)}\n`,
  'utf8',
)

console.log(`KV XNT: ${basename(reportPath)}`)
console.log(`Dong XNT hop le: ${mapped.valid.length}; dong loi: ${mapped.invalid.length}`)
console.log(`QCVL san pham: ${products.length}; movement: ${movements.length}`)
console.log(`Lech ton > 0.001: ${mismatches.length}; lech hang active/co ton: ${comparableMismatches.length}; co tren KV nhung khong co QCVL: ${missingInQcv.length}`)
console.table(comparableMismatches.slice(0, 20).map((row) => ({
  code: row.product_code,
  name: row.product_name,
  unit: row.unit_name,
  qcv: row.qcv_ending_qty,
  kv: row.kv_ending_qty,
  diff: row.ending_diff,
  purchaseDiff: row.bucket_diffs.purchase_qty,
  stocktakeInDiff: row.bucket_diffs.stocktake_in_qty,
  saleDiff: row.bucket_diffs.sale_out_qty,
  stocktakeOutDiff: row.bucket_diffs.stocktake_out_qty,
})))

async function loginToken() {
  const response = await fetch(`${apiBase}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login, password }),
  })
  const body = await response.json() as { data?: { access_token?: string } }
  if (!body.data?.access_token) throw new Error('Dang nhap QCVL API that bai.')
  return body.data.access_token
}

async function fetchAllProducts(token: string) {
  const body = await apiGet<{
    data: {
        items: Array<{
          id: string
          code: string
          name: string
          status: string
          product_kind: string
          track_inventory: boolean
          unit_name: string | null
          operating_stock?: { quantity?: number | null } | null
        }>
    }
  }>(`/api/v1/products?status=all&page=1&page_size=5000`, token)
  return body.data.items
}

async function fetchStockMovements(token: string) {
  const body = await apiGet<{
    data: {
      items: Array<{
        product_id: string
        movement_type: string
        quantity_delta: number
      }>
    }
  }>(`/api/v1/inventory/stock-movements?page=1&page_size=100000`, token)
  return body.data.items
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { headers: { authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`QCVL API loi ${response.status}: ${path}`)
  return await response.json() as T
}

function movementBucketsByProductCode(
  movements: Awaited<ReturnType<typeof fetchStockMovements>>,
  productById: Map<string, Awaited<ReturnType<typeof fetchAllProducts>>[number]>,
  productsByCode: Map<string, Awaited<ReturnType<typeof fetchAllProducts>>[number]>,
) {
  const buckets = new Map<string, QcvMovementBucketRow>()
  for (const movement of movements) {
    const product = productById.get(movement.product_id)
    if (!product) continue
    const bucket = buckets.get(product.code) ?? { product_code: product.code, purchase_qty: 0, sale_out_qty: 0, stocktake_in_qty: 0, stocktake_out_qty: 0 }
    if (movement.movement_type === 'purchase_receipt') bucket.purchase_qty = (bucket.purchase_qty ?? 0) + movement.quantity_delta
    if (movement.movement_type === 'sale_deduction') bucket.sale_out_qty = (bucket.sale_out_qty ?? 0) + Math.abs(movement.quantity_delta)
    if (movement.movement_type === 'stocktake_balance' && movement.quantity_delta >= 0) {
      bucket.stocktake_in_qty = (bucket.stocktake_in_qty ?? 0) + movement.quantity_delta
    }
    if (movement.movement_type === 'stocktake_balance' && movement.quantity_delta < 0) {
      bucket.stocktake_out_qty = (bucket.stocktake_out_qty ?? 0) + Math.abs(movement.quantity_delta)
    }
    buckets.set(product.code, bucket)
  }
  for (const product of productsByCode.values()) {
    const bucket = buckets.get(product.code) ?? { product_code: product.code }
    bucket.ending_qty = product.operating_stock?.quantity ?? 0
    buckets.set(product.code, bucket)
  }
  return [...buckets.values()]
}

async function latestXntReportPath() {
  const downloads = join(process.env.USERPROFILE ?? 'C:/Users/Admin', 'Downloads')
  const files = await readdir(downloads, { withFileTypes: true })
  const matches = files
    .filter((file) => file.isFile() && /^BaoCaoXuatNhapTonChiTiet_KV.*\.xlsx$/i.test(file.name))
    .map((file) => join(downloads, file.name))
  return matches.sort().at(-1) ?? null
}
