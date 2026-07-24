import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import pg from 'pg'

type Target = { id: string }
type Plan = { orders: Target[]; payment_receipts: Target[]; cashbook_entries: Target[]; purchase_receipt_snapshots: Target[]; stock_movements: Target[]; supplier_payment_operations: Target[]; stocktakes: Target[] }
const planPath = process.env.QCVL_RECOVERY_TARGET_PLAN
const manifestPath = process.env.QCVL_RECOVERY_MANIFEST
const url = process.env.QCVL_NAS_DATABASE_URL
const apply = process.env.QCVL_RECOVERY_APPLY === 'true'
if (!planPath || !manifestPath || !url || !existsSync(planPath) || !existsSync(manifestPath)) throw new Error('Plan, manifest, and database URL required')
if (apply && process.env.QCVL_RECOVERY_CONFIRM !== 'DELETE_QCVL_AFTER_2026_07_11') throw new Error('Explicit recovery confirmation required')
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const planHash = hash(planPath)
const manifestHash = hash(manifestPath)
if (process.env.QCVL_RECOVERY_TARGET_PLAN_SHA256 !== planHash) throw new Error('Target plan SHA-256 mismatch')
if (process.env.QCVL_RECOVERY_MANIFEST_SHA256 !== manifestHash) throw new Error('Manifest SHA-256 mismatch')
const plan = JSON.parse(readFileSync(planPath, 'utf8')) as Plan
const ids = (items: Target[]) => items.map((item) => item.id)
const count = async (client: pg.PoolClient, table: string, column: string, values: string[], arrayType: 'text' | 'uuid') => {
  if (!values.length) return 0
  return Number((await client.query(`select count(*)::int as count from ${table} where ${column} = any($1::${arrayType}[])`, [values])).rows[0].count)
}
async function main() {
  const pool = new pg.Pool({ connectionString: url })
  const client = await pool.connect()
  try {
    await client.query('begin isolation level serializable')
    const before = {
      orders: await count(client, 'orders', 'id', ids(plan.orders), 'text'),
      receipts: await count(client, 'payment_receipts', 'id', ids(plan.payment_receipts), 'text'),
      cashbook: await count(client, 'cashbook_entries', 'id', ids(plan.cashbook_entries), 'text'),
      purchases: await count(client, 'purchase_receipt_snapshots', 'id', ids(plan.purchase_receipt_snapshots), 'text'),
      movements: await count(client, 'stock_movements', 'id', ids(plan.stock_movements), 'uuid'),
      supplier_operations: await count(client, 'supplier_payment_operations', 'operation_id', ids(plan.supplier_payment_operations), 'uuid'),
      stocktakes: await count(client, 'stocktakes', 'id', ids(plan.stocktakes), 'uuid'),
    }
    await client.query('delete from payment_receipt_methods where payment_receipt_id = any($1::text[])', [ids(plan.payment_receipts)])
    await client.query('delete from payment_receipts where id = any($1::text[])', [ids(plan.payment_receipts)])
    await client.query('delete from cashbook_entries where id = any($1::text[])', [ids(plan.cashbook_entries)])
    await client.query('delete from supplier_payment_operations where operation_id = any($1::uuid[])', [ids(plan.supplier_payment_operations)])
    await client.query('delete from stock_movements where id = any($1::uuid[])', [ids(plan.stock_movements)])
    await client.query('delete from purchase_receipt_snapshots where id = any($1::text[])', [ids(plan.purchase_receipt_snapshots)])
    await client.query('delete from stocktakes where id = any($1::uuid[])', [ids(plan.stocktakes)])
    await client.query('delete from orders where id = any($1::text[])', [ids(plan.orders)])
    const after = {
      orders: await count(client, 'orders', 'id', ids(plan.orders), 'text'), receipts: await count(client, 'payment_receipts', 'id', ids(plan.payment_receipts), 'text'), cashbook: await count(client, 'cashbook_entries', 'id', ids(plan.cashbook_entries), 'text'), purchases: await count(client, 'purchase_receipt_snapshots', 'id', ids(plan.purchase_receipt_snapshots), 'text'), movements: await count(client, 'stock_movements', 'id', ids(plan.stock_movements), 'uuid'), supplier_operations: await count(client, 'supplier_payment_operations', 'operation_id', ids(plan.supplier_payment_operations), 'uuid'), stocktakes: await count(client, 'stocktakes', 'id', ids(plan.stocktakes), 'uuid'),
    }
    if (Object.values(after).some((value) => value !== 0)) throw new Error(`Exact target residual: ${JSON.stringify(after)}`)
    if (apply) await client.query('commit'); else await client.query('rollback')
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run-rolled-back', plan_hash: planHash, manifest_hash: manifestHash, before, after }, null, 2))
  } catch (error) { await client.query('rollback').catch(() => undefined); throw error } finally { client.release(); await pool.end() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
