import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type RepositoryLifecycleDeps = {
  ensureTables(pool: pg.Pool): Promise<void>
  insertDocument(pool: pg.Pool, organizationId: string, document: Parameters<NonNullable<ServerRepository['saveSalesDocument']>>[0]['document']): Promise<void>
  insertEntry(pool: pg.Pool, organizationId: string, entry: Parameters<NonNullable<ServerRepository['createCashbookVoucher']>>[0]['entry']): Promise<void>
}

export function createRepositoryLifecycle(pool:pg.Pool,deps:RepositoryLifecycleDeps):Pick<ServerRepository,'ensureSalesFinanceSeed'> & { close(): Promise<void> }{const {ensureTables,insertDocument,insertEntry}=deps;return{
    async ensureSalesFinanceSeed(input) {
      await ensureTables(pool)
      const count = await pool.query('select count(*)::int as count from orders where organization_id = $1', [input.organizationId])
      if (Number(count.rows[0]?.count ?? 0) > 0) return

      await pool.query('begin')
      try {
        for (const document of input.documents) {
          await insertDocument(pool, input.organizationId, document)
        }
        for (const entry of input.cashbookEntries) {
          await insertEntry(pool, input.organizationId, entry)
        }
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async close() {
      await pool.end()
    },
  }}
