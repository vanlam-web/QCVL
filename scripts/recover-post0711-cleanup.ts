import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import pg from 'pg'

type SourceManifest = { sources?: Array<{ file: string; sha256: string; source_kind: string; date_range: string }> }
type Count = { table_name: string; records: number }

const { Pool } = pg
const cutoff = '2026-07-11T17:00:00.000Z'
const manifestPath = process.env.QCVL_RECOVERY_MANIFEST
const databaseUrl = process.env.QCVL_NAS_DATABASE_URL ?? process.env.DATABASE_URL
const apply = process.env.QCVL_RECOVERY_APPLY === 'true'
const expectedManifestSha = process.env.QCVL_RECOVERY_MANIFEST_SHA256

if (!manifestPath || !existsSync(manifestPath)) throw new Error('QCVL_RECOVERY_MANIFEST must name frozen source manifest')
if (!databaseUrl) throw new Error('QCVL_NAS_DATABASE_URL or DATABASE_URL is required')
if (apply && process.env.QCVL_RECOVERY_CONFIRM !== 'DELETE_QCVL_AFTER_2026_07_11') throw new Error('Set QCVL_RECOVERY_CONFIRM=DELETE_QCVL_AFTER_2026_07_11 for destructive apply')

const manifestBuffer = readFileSync(manifestPath)
const manifestSha256 = createHash('sha256').update(manifestBuffer).digest('hex')
if (expectedManifestSha && manifestSha256 !== expectedManifestSha.toLowerCase()) throw new Error(`Frozen manifest hash mismatch: expected ${expectedManifestSha}, got ${manifestSha256}`)
const manifest = JSON.parse(manifestBuffer.toString('utf8')) as SourceManifest
const sources = manifest.sources ?? []
const requiredFrozenSources = ['product_catalog_KV25072026-001338-346.xlsx', 'inventory_xnt_2026-07-12_to_2026-07-23_KV25072026-002936-510.xlsx']
if (sources.length < 11 || requiredFrozenSources.some((file) => !sources.some((source) => source.file === file && source.sha256.length === 64))) throw new Error('Frozen manifest lacks required post-cutoff source files')

const pool = new Pool({ connectionString: databaseUrl })

async function counts(client: pg.PoolClient): Promise<Count[]> {
  const result = await client.query<Count>(`
    select 'orders' as table_name, count(*)::int as records from orders where created_at >= $1
    union all select 'order_items', count(*)::int from order_items oi join orders o on o.id=oi.order_id where o.created_at >= $1
    union all select 'customer_debt_entries', count(*)::int from customer_debt_entries d join orders o on o.id=d.order_id where o.created_at >= $1
    union all select 'payment_receipts', count(*)::int from payment_receipts where created_at >= $1
    union all select 'payment_receipt_methods', count(*)::int from payment_receipt_methods m join payment_receipts r on r.id=m.payment_receipt_id where r.created_at >= $1
    union all select 'cashbook_entries', count(*)::int from cashbook_entries where created_at >= $1
    union all select 'stock_movements', count(*)::int from stock_movements where created_at >= $1
    union all select 'purchase_receipt_snapshots', count(*)::int from purchase_receipt_snapshots where created_at >= $1
    union all select 'supplier_payment_operations', count(*)::int from supplier_payment_operations where created_at >= $1
    union all select 'stocktakes', count(*)::int from stocktakes where created_at >= $1
  `, [cutoff])
  return result.rows.map((row) => ({ table_name: row.table_name, records: Number(row.records) }))
}

async function executeCleanup(client: pg.PoolClient) {
  await client.query(`delete from payment_receipt_methods where payment_receipt_id in (select id from payment_receipts where created_at >= $1)`, [cutoff])
  await client.query(`delete from payment_receipts where created_at >= $1`, [cutoff])
  await client.query(`delete from cashbook_entries where created_at >= $1`, [cutoff])
  await client.query(`delete from supplier_payment_operations where created_at >= $1`, [cutoff])
  await client.query(`delete from stock_movements where created_at >= $1`, [cutoff])
  await client.query(`delete from purchase_receipt_snapshots where created_at >= $1`, [cutoff])
  await client.query(`delete from stocktakes where created_at >= $1`, [cutoff])
  await client.query(`delete from orders where created_at >= $1`, [cutoff])
}

async function main() {
  const client = await pool.connect()
  try {
    await client.query('begin isolation level serializable')
    const before = await counts(client)
    await executeCleanup(client)
    const after = await counts(client)
    const residual = after.filter((row) => row.records !== 0)
    if (residual.length > 0) throw new Error(`Cleanup left target rows: ${JSON.stringify(residual)}`)
    if (apply) await client.query('commit')
    else await client.query('rollback')
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run-rolled-back', cutoff, manifest_sha256: manifestSha256, manifest_source_count: sources.length, before, after }, null, 2))
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

await main()
