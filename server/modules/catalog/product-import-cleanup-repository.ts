import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type ReferenceGuard = { table: string; column: string }
type ProductCleanupDeps = {
  ensureCatalog(pool: pg.Pool): Promise<void>
  ensureUnits(pool: pg.Pool): Promise<void>
  ensureBom(pool: pg.Pool): Promise<void>
  ensureBalances(pool: pg.Pool): Promise<void>
  referenceGuards: readonly ReferenceGuard[]
  referencedIds(pool: pg.Pool, table: string, column: string, organizationId: string, ids: string[], options?: { inTransaction?: boolean }): Promise<string[]>
  deleteOptionalRows(pool: pg.Pool, sql: string, values: unknown[]): Promise<void>
}
export function createProductImportCleanupRepository(pool:pg.Pool,deps:ProductCleanupDeps):Pick<ServerRepository,'deleteDemoProductsForImport'|'deleteImportedKiotVietProducts'>{const {ensureCatalog,ensureUnits,ensureBom,ensureBalances,referenceGuards,referencedIds,deleteOptionalRows}=deps;return{
    async deleteDemoProductsForImport(input) {
      await ensureCatalog(pool)
      const candidates = await pool.query(
        `
          select id
          from products
          where organization_id = $1
            and (
              code like 'DEV20-SP-%'
              or code in ('MICA-3MM', 'DECAL-PP', 'CUT-CNC')
            )
        `,
        [input.organizationId],
      )
      const candidateIds = candidates.rows.map((row) => String(row.id))
      if (candidateIds.length === 0) return { deleted: 0, blocked: 0 }

      const referenced = new Set<string>()
      for (const guard of referenceGuards) {
        for (const productId of await referencedIds(pool, guard.table, guard.column, input.organizationId, candidateIds)) {
          referenced.add(productId)
        }
      }
      const deletable = candidateIds.filter((productId) => !referenced.has(productId))
      if (deletable.length === 0) return { deleted: 0, blocked: referenced.size }

      const result = await pool.query(
        `
          delete from products
          where organization_id = $1
            and id = any($2::uuid[])
        `,
        [input.organizationId, deletable],
      )
      return { deleted: result.rowCount ?? 0, blocked: referenced.size }
    },

    async deleteImportedKiotVietProducts(input) {
      await ensureCatalog(pool)
      await ensureUnits(pool)
      await ensureBalances(pool)
      await ensureBom(pool)

      await pool.query('begin')
      try {
        await pool.query(
          `
            delete from inventory_provisional_balances
            where organization_id = $1
              and source_type = 'kiotviet_import'
          `,
          [input.organizationId],
        )
        await pool.query(
          `
            delete from product_boms
            where organization_id = $1
              and notes like 'Imported from KiotViet%'
          `,
          [input.organizationId],
        )
        const candidates = await pool.query(
          `
            select id
            from products
            where organization_id = $1
          `,
          [input.organizationId],
        )
        const candidateIds = candidates.rows.map((row) => String(row.id))
        if (candidateIds.length === 0) {
          await pool.query('commit')
          return { deleted: 0, blocked: 0 }
        }

        await deleteOptionalRows(
          pool,
          `
            delete from price_list_items
            where organization_id = $1
              and product_id = any($2::uuid[])
          `,
          [input.organizationId, candidateIds],
        )

        const guards = referenceGuards.filter((guard) => guard.table !== 'price_list_items' && guard.table !== 'product_boms')
        const referenced = new Set<string>()
        for (const guard of guards) {
          for (const productId of await referencedIds(pool, guard.table, guard.column, input.organizationId, candidateIds, {
            inTransaction: true,
          })) {
            referenced.add(productId)
          }
        }
        const deletable = candidateIds.filter((productId) => !referenced.has(productId))
        if (deletable.length === 0) {
          await pool.query('commit')
          return { deleted: 0, blocked: referenced.size }
        }

        const result = await pool.query(
          `
            delete from products
            where organization_id = $1
              and id = any($2::uuid[])
          `,
          [input.organizationId, deletable],
        )
        await pool.query('commit')
        return { deleted: result.rowCount ?? 0, blocked: referenced.size }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

  }}
