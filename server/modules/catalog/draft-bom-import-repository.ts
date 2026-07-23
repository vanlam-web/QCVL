import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
export function createDraftBomImportRepository(pool:pg.Pool,deps:{ensureTables:(pool:pg.Pool)=>Promise<void>;productIdByCode:(pool:pg.Pool,organizationId:string,code:string)=>Promise<string|null>}):Pick<ServerRepository,'upsertDraftProductBoms'>{const {ensureTables,productIdByCode}=deps;return{
    async upsertDraftProductBoms(input) {
      if (input.rows.length === 0) return { created: 0, updated: 0, skipped: 0 }

      await ensureTables(pool)
      let created = 0
      let updated = 0
      let skipped = 0
      await pool.query('begin')
      try {
        for (const row of input.rows) {
          const productId = await productIdByCode(pool, input.organizationId, row.product_code)
          if (!productId) {
            skipped += 1
            continue
          }
          const componentIds: Array<{ id: string; quantity: number; sortOrder: number; code: string }> = []
          let missingComponent = false
          for (const [index, component] of row.components.entries()) {
            const componentId = await productIdByCode(pool, input.organizationId, component.component_code)
            if (!componentId) {
              missingComponent = true
              break
            }
            componentIds.push({ id: componentId, quantity: component.quantity, sortOrder: index + 1, code: component.component_code })
          }
          if (missingComponent || componentIds.length === 0) {
            skipped += 1
            continue
          }

          const hadExisting = await pool.query(
            `
              select id
              from product_boms
              where organization_id = $1
                and product_id = $2
                and status in ('draft', 'active')
                and notes like 'Imported from KiotViet%'
              limit 1
            `,
            [input.organizationId, productId],
          )
          await pool.query(
            `
              update product_boms
              set status = 'archived'
              where organization_id = $1
                and product_id = $2
                and status in ('draft', 'active')
                and notes like 'Imported from KiotViet%'
            `,
            [input.organizationId, productId],
          )
          const version = await pool.query(
            `
              select coalesce(max(version), 0) + 1 as next_version
              from product_boms
              where organization_id = $1
                and product_id = $2
            `,
            [input.organizationId, productId],
          )
          const bom = await pool.query(
            `
              insert into product_boms (id, organization_id, product_id, version, status, notes, created_at)
              values ($1, $2, $3, $4, 'active', $5, now())
              returning id::text, (xmax = 0) as inserted
            `,
            [
              randomUUID(),
              input.organizationId,
              productId,
              Number(version.rows[0]?.next_version ?? 1),
              `${row.note} Source: ${row.source_text}`,
            ],
          )
          const bomId = String(bom.rows[0]?.id)
          for (const component of componentIds) {
            await pool.query(
              `
                insert into product_bom_items (
                  id, organization_id, bom_id, component_product_id, quantity,
                  calculation_payload, sort_order, notes
                )
                values ($1, $2, $3, $4, $5, '{}'::jsonb, $6, $7)
              `,
              [randomUUID(), input.organizationId, bomId, component.id, component.quantity, component.sortOrder, `KiotViet component ${component.code}`],
            )
          }
          if (hadExisting.rows.length > 0) updated += 1
          else created += 1
        }
        await pool.query('commit')
        return { created, updated, skipped }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

  }}
