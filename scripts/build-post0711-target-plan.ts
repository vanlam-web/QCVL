import { writeFileSync, readFileSync } from 'node:fs'
import pg from 'pg'

const manifestPath = process.env.QCVL_RECOVERY_MANIFEST
const databaseUrl = process.env.QCVL_NAS_DATABASE_URL
const output = process.env.QCVL_RECOVERY_TARGET_PLAN
if (!manifestPath || !databaseUrl || !output) throw new Error('QCVL_RECOVERY_MANIFEST, QCVL_NAS_DATABASE_URL, QCVL_RECOVERY_TARGET_PLAN required')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { records: Array<{ source_code: string | null }> }
const sourceCodes = new Set(manifest.records.flatMap((row) => row.source_code ? [row.source_code.toUpperCase()] : []))
const cutoff = '2026-07-11T17:00:00.000Z'
const pool = new pg.Pool({ connectionString: databaseUrl })

type Target = { id: string; code: string; created_at: string; classification: 'source_backed' | 'local_or_missing_source' }
async function targets(sql: string, codeExpression = 'code') {
  const rows = (await pool.query<{ id: string; code: string; created_at: string }>(sql, [cutoff])).rows
  return rows.map((row): Target => ({ ...row, code: String(row.code), classification: sourceCodes.has(String(row.code).split(':').at(-1)!.toUpperCase()) ? 'source_backed' : 'local_or_missing_source' }))
}

async function main() {
  const plan = {
    generated_at: new Date().toISOString(), cutoff,
    orders: await targets(`select id, code, created_at from orders where created_at >= $1 order by id`),
    payment_receipts: await targets(`select id, code, created_at from payment_receipts where created_at >= $1 order by id`),
    cashbook_entries: await targets(`select id, code, created_at from cashbook_entries where created_at >= $1 order by id`),
    purchase_receipt_snapshots: await targets(`select id, code, created_at from purchase_receipt_snapshots where created_at >= $1 order by id`),
    stock_movements: await targets(`select id, coalesce(document_type, '') || ':' || coalesce(document_code, '') as code, created_at from stock_movements where created_at >= $1 order by id`),
    supplier_payment_operations: await targets(`select operation_id as id, operation_id::text as code, created_at from supplier_payment_operations where created_at >= $1 order by operation_id`),
    stocktakes: await targets(`select id, coalesce(code, id::text) as code, created_at from stocktakes where created_at >= $1 order by id`),
  }
  writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`)
  console.log(JSON.stringify(Object.fromEntries(Object.entries(plan).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, { total: value.length, source_backed: value.filter((row) => row.classification === 'source_backed').length }])), null, 2))
  await pool.end()
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
