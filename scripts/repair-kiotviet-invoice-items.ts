import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import pg from 'pg'
import {
  mapKiotVietInvoiceRows,
  parseKiotVietInvoiceWorkbookBuffer,
  type KiotVietInvoiceImportRow,
} from '../server/modules/sales/kiotviet-invoice-import.js'
import { baseKiotVietCode } from '../server/modules/purchase/purchase-receipt-import.js'

const { Pool } = pg

const confirmRepair = process.env.QCVL_IMPORT_CONFIRM === 'true'
const organizationCode = process.env.QCVL_IMPORT_ORGANIZATION_CODE ?? 'VAN-LAM'
const exportDir = resolve(process.env.QCVL_KV_EXPORT_DIR ?? 'Y:\\DuLieuKV')
const explicitCodes = new Set(
  (process.env.QCVL_REPAIR_INVOICE_CODES ?? '')
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean),
)

function readEnvFile(path: string) {
  if (!existsSync(path)) return {} as Record<string, string>
  const entries: Record<string, string> = {}
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const rawValue = line.slice(separator + 1).trim()
    const value = (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue
    entries[key] = value
  }
  return entries
}

function postgresUrlFromParts(env: Record<string, string>) {
  if (!env.POSTGRES_DB || !env.POSTGRES_USER || !env.POSTGRES_PASSWORD) return undefined
  const host = process.env.QCVL_NAS_DB_HOST ?? env.POSTGRES_HOST ?? '192.168.1.188'
  const port = process.env.QCVL_NAS_DB_PORT ?? env.POSTGRES_PORT ?? '55433'
  return `postgres://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${host}:${port}/${encodeURIComponent(env.POSTGRES_DB)}`
}

function databaseUrl() {
  const nasRoot = process.env.QCVL_NAS_APP_PATH ?? '\\\\192.168.1.188\\docker\\QCVL\\app'
  const nasEnvPath = process.env.QCVL_NAS_ENV_PATH ?? join(dirname(nasRoot), '.env')
  const nasEnv = readEnvFile(nasEnvPath)
  return process.env.QCVL_NAS_DATABASE_URL ?? process.env.DATABASE_URL ?? nasEnv.DATABASE_URL ?? postgresUrlFromParts(nasEnv)
}

function latestSourceFile() {
  const explicitFile = process.env.QCVL_KV_INVOICE_FILE
  if (explicitFile) return resolve(explicitFile)
  if (!existsSync(exportDir)) throw new Error(`KV export dir not found: ${exportDir}`)
  const candidates = readdirSync(exportDir)
    .filter((name) => /^DanhSachChiTietHoaDon_KV.*\.xlsx$/i.test(name))
    .map((name) => join(exportDir, name))
  if (candidates.length === 0) throw new Error(`No KiotViet invoice export found in: ${exportDir}`)
  return candidates
    .map((file) => ({ file, mtime: statSync(file).mtimeMs }))
    .sort((left, right) => right.mtime - left.mtime || left.file.localeCompare(right.file))[0].file
}

function rowsByInvoice(file: string) {
  const mapped = mapKiotVietInvoiceRows(parseKiotVietInvoiceWorkbookBuffer(readFileSync(file)))
  const byCode = new Map<string, KiotVietInvoiceImportRow[]>()
  for (const row of mapped.valid) {
    const rows = byCode.get(row.source_code) ?? []
    rows.push(row)
    byCode.set(row.source_code, rows)
  }
  return { byCode, invalidRows: mapped.invalid }
}

async function resolveOrganizationId(pool: pg.Pool) {
  const result = await pool.query('select id::text from organizations where code = $1 limit 1', [organizationCode])
  const id = result.rows[0]?.id
  if (!id) throw new Error(`Organization code not found: ${organizationCode}`)
  return String(id)
}

async function loadRepairTargets(pool: pg.Pool, organizationId: string) {
  if (explicitCodes.size > 0) {
    const result = await pool.query(
      `
        select id::text, code
        from orders
        where organization_id = $1
          and upper(code) = any($2::text[])
        order by created_at, code
      `,
      [organizationId, [...explicitCodes]],
    )
    return result.rows.map((row) => ({ id: String(row.id), code: String(row.code) }))
  }

  const result = await pool.query(
    `
      select o.id::text, o.code
      from orders o
      left join order_items oi on oi.organization_id = o.organization_id and oi.order_id = o.id
      where o.organization_id = $1
        and o.order_type = 'invoice'
        and o.status <> 'cancelled'
        and o.total_amount > 0
      group by o.id, o.code, o.created_at
      having coalesce(sum(oi.line_total), 0) = 0
      order by o.created_at, o.code
    `,
    [organizationId],
  )
  return result.rows.map((row) => ({ id: String(row.id), code: String(row.code) }))
}

async function productIdsByCode(pool: pg.Pool, organizationId: string, rows: KiotVietInvoiceImportRow[]) {
  const codes = [...new Set(rows.flatMap((row) => [row.product_code, baseKiotVietCode(row.product_code)]))]
  const result = await pool.query(
    `
      select id::text, code
      from products
      where organization_id = $1
        and lower(code) = any($2::text[])
    `,
    [organizationId, codes.map((code) => code.toLowerCase())],
  )
  return new Map(result.rows.map((row) => [String(row.code).toLowerCase(), String(row.id)]))
}

function resolveProductId(row: KiotVietInvoiceImportRow, products: Map<string, string>) {
  return products.get(row.product_code.toLowerCase()) ?? products.get(baseKiotVietCode(row.product_code).toLowerCase()) ?? null
}

async function repairInvoiceItems(pool: pg.Pool, organizationId: string, orderId: string, rows: KiotVietInvoiceImportRow[]) {
  const products = await productIdsByCode(pool, organizationId, rows)
  const itemRows = rows
    .sort((left, right) => left.rowNumber - right.rowNumber)
    .map((row, index) => ({
      row,
      productId: resolveProductId(row, products),
      sortOrder: index + 1,
    }))
  const missingProducts = itemRows.filter((item) => !item.productId).map((item) => item.row.product_code)
  if (missingProducts.length > 0) return { repaired: false, items: 0, missingProducts }

  await pool.query(
    `
      delete from order_items
      where organization_id = $1
        and order_id = $2
    `,
    [organizationId, orderId],
  )
  for (const item of itemRows) {
    await pool.query(
      `
        insert into order_items (
          organization_id, order_id, product_id, product_snapshot, quantity, unit_price, discount_amount, line_total, sort_order
        )
        values ($1, $2, $3, '{}'::jsonb, $4, $5, $6, $7, $8)
      `,
      [
        organizationId,
        orderId,
        item.productId,
        item.row.quantity,
        item.row.unit_price,
        item.row.line_discount_amount,
        item.row.line_amount,
        item.sortOrder,
      ],
    )
  }
  return { repaired: true, items: itemRows.length, missingProducts: [] as string[] }
}

async function main() {
  const url = databaseUrl()
  if (!url) throw new Error('DATABASE_URL or NAS .env database settings are required')
  const file = latestSourceFile()
  const { byCode, invalidRows } = rowsByInvoice(file)
  const pool = new Pool({ connectionString: url })
  try {
    const organizationId = await resolveOrganizationId(pool)
    const targets = (await loadRepairTargets(pool, organizationId)).filter((target) => byCode.has(target.code))
    if (!confirmRepair) {
      console.log(JSON.stringify({
        dry_run: true,
        file,
        invalid_rows: invalidRows.length,
        targets: targets.length,
        sample_codes: targets.slice(0, 20).map((target) => target.code),
      }, null, 2))
      return
    }

    let repaired = 0
    let repairedItems = 0
    const skipped: Array<{ code: string; missing_products: string[] }> = []
    await pool.query('begin')
    try {
      for (const target of targets) {
        const result = await repairInvoiceItems(pool, organizationId, target.id, byCode.get(target.code) ?? [])
        if (!result.repaired) {
          skipped.push({ code: target.code, missing_products: result.missingProducts })
          continue
        }
        repaired += 1
        repairedItems += result.items
      }
      await pool.query('commit')
    } catch (error) {
      await pool.query('rollback')
      throw error
    }

    console.log(JSON.stringify({
      dry_run: false,
      file,
      invalid_rows: invalidRows.length,
      targets: targets.length,
      repaired,
      repaired_items: repairedItems,
      skipped: skipped.slice(0, 20),
    }, null, 2))
  } finally {
    await pool.end()
  }
}

await main()
