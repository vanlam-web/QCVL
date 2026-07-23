import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type ImportedProductRow = Parameters<NonNullable<ServerRepository['upsertProductsByCode']>>[0]['rows'][number]
type CatalogProductImportDeps = {
  ensureCatalog(pool: pg.Pool): Promise<void>
  ensureUnits(pool: pg.Pool): Promise<void>
  upsertUnit(pool: pg.Pool, organizationId: string, unitName: string): Promise<string>
  upsertSettings(pool: pg.Pool, organizationId: string, productId: string, row: ImportedProductRow, stockUnitId: string): Promise<void>
  upsertConversions(pool: pg.Pool, organizationId: string, productId: string, stockUnitId: string, conversions: ImportedProductRow['unit_conversions']): Promise<void>
  groupCode(name: string): string
}
export function createCatalogProductImportRepository(pool:pg.Pool,deps:CatalogProductImportDeps):Pick<ServerRepository,'upsertProductGroupsByName'|'upsertProductsByCode'>{const {ensureCatalog,ensureUnits,upsertUnit,upsertSettings,upsertConversions,groupCode}=deps;return{
    async upsertProductGroupsByName(input) {
      const names = [...new Set(input.names.map((name) => name.trim()).filter(Boolean))]
      if (names.length === 0) return new Map()

      await ensureCatalog(pool)
      await pool.query('begin')
      try {
        const existing = await pool.query(
          `
            select id, name
            from product_groups
            where organization_id = $1
              and name = any($2::text[])
          `,
          [input.organizationId, names],
        )
        const existingNames = new Set(existing.rows.map((row) => String(row.name)))
        for (const name of names) {
          if (existingNames.has(name)) continue
          const code = groupCode(name)
          await pool.query(
            `
              insert into product_groups (id, organization_id, code, name, is_default, is_active, created_at, updated_at)
              values ($1, $2, $3, $4, false, true, now(), now())
              on conflict (organization_id, code)
              do update set
                name = excluded.name,
                is_active = true,
                updated_at = now()
            `,
            [randomUUID(), input.organizationId, code, name],
          )
        }
        const result = await pool.query(
          `
            select id, name
            from product_groups
            where organization_id = $1
              and name = any($2::text[])
          `,
          [input.organizationId, names],
        )
        await pool.query('commit')
        return new Map(result.rows.map((row) => [String(row.name), String(row.id)]))
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertProductsByCode(input) {
      if (input.rows.length === 0) return { created: 0, updated: 0, skipped: 0 }

      await ensureCatalog(pool)
      await ensureUnits(pool)
      let created = 0
      let updated = 0
      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const result = await pool.query(
            `
              insert into products (
                id, organization_id, code, name, status, product_group_id, unit_name,
                sell_method, product_kind, inventory_shape, track_inventory,
                latest_purchase_cost, latest_purchase_cost_at, created_at, updated_at
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, case when $12::numeric is null then null else now() end, coalesce($13::timestamptz, now()), now())
              on conflict (organization_id, code)
              do update set
                name = excluded.name,
                status = excluded.status,
                product_group_id = excluded.product_group_id,
                unit_name = excluded.unit_name,
                sell_method = excluded.sell_method,
                product_kind = excluded.product_kind,
                inventory_shape = excluded.inventory_shape,
                track_inventory = excluded.track_inventory,
                latest_purchase_cost = excluded.latest_purchase_cost,
                latest_purchase_cost_at = case
                  when excluded.latest_purchase_cost is distinct from products.latest_purchase_cost then now()
                  else products.latest_purchase_cost_at
                end,
                created_at = coalesce(excluded.created_at, products.created_at),
                updated_at = now()
              returning id::text, (xmax = 0) as inserted
            `,
            [
              randomUUID(),
              input.organizationId,
              row.code,
              row.name,
              row.status,
              row.product_group_id,
              row.unit_name,
              row.sell_method,
              row.product_kind,
              row.inventory_shape,
              row.track_inventory,
              row.latest_purchase_cost,
              row.source_created_at,
            ],
          )
          const productId = String(result.rows[0]?.id)
          if (result.rows[0]?.inserted) created += 1
          else updated += 1
          const stockUnitId = await upsertUnit(pool, input.organizationId, row.unit_name)
          await upsertSettings(pool, input.organizationId, productId, row, stockUnitId)
          if (row.unit_conversions.length > 0) {
            await upsertConversions(pool, input.organizationId, productId, stockUnitId, row.unit_conversions)
          }
        }
        await pool.query('commit')
        return { created, updated, skipped: 0 }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

  }}
