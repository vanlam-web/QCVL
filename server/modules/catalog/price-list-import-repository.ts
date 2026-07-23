import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type PriceListImportDeps = {
  ensureCatalog(pool: pg.Pool): Promise<void>
  ensurePriceLists(pool: pg.Pool): Promise<void>
  isDefaultName(name: string): boolean
  upsertByName(pool: pg.Pool, organizationId: string, name: string): Promise<string>
}
export function createPriceListImportRepository(pool:pg.Pool,deps:PriceListImportDeps):Pick<ServerRepository,'upsertDefaultPriceListItems'|'upsertPriceListItemsByName'>{const {ensureCatalog,ensurePriceLists,isDefaultName,upsertByName}=deps;return{
    async upsertDefaultPriceListItems(input) {
      if (input.rows.length === 0) return { created: 0, updated: 0, skipped: 0 }

      await ensureCatalog(pool)
      await ensurePriceLists(pool)
      let created = 0
      let updated = 0
      let skipped = 0
      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const product = await pool.query(
            `
              select id
              from products
              where organization_id = $1
                and code = $2
              limit 1
            `,
            [input.organizationId, row.product_code],
          )
          const productId = product.rows[0]?.id
          if (!productId) {
            skipped += 1
            continue
          }
          const result = await pool.query(
            `
              insert into price_list_items (id, organization_id, price_list_id, product_id, unit_price, created_at, updated_at)
              values ($1, $2, $3::uuid, $4, $5, now(), now())
              on conflict (price_list_id, product_id)
              do update set
                unit_price = excluded.unit_price,
                updated_at = now()
              returning (xmax = 0) as inserted
            `,
            [randomUUID(), input.organizationId, input.priceListId, productId, row.unit_price],
          )
          if (result.rows[0]?.inserted) created += 1
          else updated += 1
        }
        await pool.query('commit')
        return { created, updated, skipped }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertPriceListItemsByName(input) {
      if (input.rows.length === 0) return { created: 0, updated: 0, skipped: 0 }

      await ensureCatalog(pool)
      await ensurePriceLists(pool)
      let created = 0
      let updated = 0
      let skipped = 0
      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const product = await pool.query(
            `
              select id
              from products
              where organization_id = $1
                and code = $2
              limit 1
            `,
            [input.organizationId, row.product_code],
          )
          const productId = product.rows[0]?.id
          if (!productId) {
            skipped += 1
            continue
          }

          const priceListId = isDefaultName(row.price_list_name) && input.defaultPriceListId
            ? input.defaultPriceListId
            : await upsertByName(pool, input.organizationId, row.price_list_name)
          const result = await pool.query(
            `
              insert into price_list_items (id, organization_id, price_list_id, product_id, unit_price, created_at, updated_at)
              values ($1, $2, $3::uuid, $4, $5, now(), now())
              on conflict (price_list_id, product_id)
              do update set
                unit_price = excluded.unit_price,
                updated_at = now()
              returning (xmax = 0) as inserted
            `,
            [randomUUID(), input.organizationId, priceListId, productId, row.unit_price],
          )
          if (result.rows[0]?.inserted) created += 1
          else updated += 1
        }
        await pool.query('commit')
        return { created, updated, skipped }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

  }}
