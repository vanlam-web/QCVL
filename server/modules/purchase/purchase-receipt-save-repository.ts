import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type Receipt = Parameters<NonNullable<ServerRepository['savePurchaseReceipt']>>[0]['receipt']
type Source = Parameters<NonNullable<ServerRepository['savePurchaseReceipt']>>[0]['sourceType']
type Deps = {
  ensureSnapshots(pool: pg.Pool): Promise<void>
  safeCode(pool: pg.Pool, organizationId: string, receipt: Receipt, source: Source): Promise<Receipt>
  recomputeSupplier(pool: pg.Pool, organizationId: string, supplierId: string | null): Promise<void>
}

export function createPurchaseReceiptSaveRepository(connectionPool: pg.Pool, deps: Deps): Pick<ServerRepository, 'savePurchaseReceipt'> {
  return {
    async savePurchaseReceipt(input) {
      await deps.ensureSnapshots(connectionPool)
      const client = await connectionPool.connect()
      const pool = Object.create(connectionPool) as pg.Pool
      pool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await client.query('begin')
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [`purchase-receipts:${input.organizationId}`])
        const existing = await client.query(
          'select id from purchase_receipt_snapshots where organization_id = $1 and id = $2 limit 1',
          [input.organizationId, input.receipt.id],
        )
        const receipt = existing.rows[0]
          ? input.receipt
          : await deps.safeCode(pool, input.organizationId, input.receipt, input.sourceType)
        if (existing.rows[0]) {
          await client.query(
            'update purchase_receipt_snapshots set code = $3, data = $4::jsonb, source_type = $5, updated_at = now() where organization_id = $1 and id = $2',
            [input.organizationId, receipt.id, receipt.code, JSON.stringify(receipt), input.sourceType],
          )
        } else {
          await client.query(
            `insert into purchase_receipt_snapshots (id, organization_id, code, data, source_type, created_at, updated_at)
             values ($1, $2, $3, $4::jsonb, $5, coalesce($6::timestamptz, now()), now())`,
            [receipt.id, input.organizationId, receipt.code, JSON.stringify(receipt), input.sourceType, receipt.created_at],
          )
        }
        await deps.recomputeSupplier(pool, input.organizationId, receipt.supplier_id)
        await client.query('commit')
        return receipt
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
  }
}
