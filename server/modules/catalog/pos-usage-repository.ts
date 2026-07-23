import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
export function createPosUsageRepository(pool:pg.Pool,deps:{ensureUsage:(pool:pg.Pool)=>Promise<void>;ensureSearch:(pool:pg.Pool)=>Promise<void>}):Pick<ServerRepository,'getPosProductUsageCounts'|'recordPosProductUsage'|'recordSearchSelection'|'findProductsByCodes'>{return{
    async getPosProductUsageCounts(organizationId) {
      await deps.ensureUsage(pool)
      const result = await pool.query(
        `
          select product_id, usage_count
          from pos_product_usage
          where organization_id = $1
        `,
        [organizationId],
      )
      return new Map(result.rows.map((row) => [row.product_id, Number(row.usage_count)]))
    },

    async recordPosProductUsage(input) {
      const productCounts = new Map<string, number>()
      for (const productId of input.productIds) {
        productCounts.set(productId, (productCounts.get(productId) ?? 0) + 1)
      }
      if (productCounts.size === 0) return
      await deps.ensureUsage(pool)
      await pool.query('begin')
      try {
        for (const [productId, count] of productCounts) {
          await pool.query(
            `
              insert into pos_product_usage (organization_id, product_id, usage_count)
              values ($1, $2, $3)
              on conflict (organization_id, product_id)
              do update set
                usage_count = pos_product_usage.usage_count + excluded.usage_count,
                updated_at = now()
            `,
            [input.organizationId, productId, count],
          )
        }
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async recordSearchSelection(input) {
      await deps.ensureSearch(pool)
      await pool.query(
        `
          insert into search_selection_stats (
            organization_id, user_id, entity_type, entity_id, select_count, last_selected_at
          )
          values ($1, $2, $3, $4, 1, now())
          on conflict (organization_id, user_id, entity_type, entity_id) do update
          set select_count = search_selection_stats.select_count + 1,
              last_selected_at = now()
        `,
        [input.organizationId, input.userId, input.entityType, input.entityId],
      )
    },

    async findProductsByCodes(input) {
      const result = await pool.query(
        `
          select requested.code
          from unnest($2::text[]) as requested(code)
          where exists (
            select 1
            from products p
            where p.organization_id = $1
              and p.code = requested.code
          )
          or exists (
            select 1
            from product_unit_conversions puc
            where puc.organization_id = $1
              and puc.source_code = requested.code
              and puc.is_active = true
          )
        `,
        [input.organizationId, input.codes],
      )
      return new Set(result.rows.map((row) => String(row.code)))
    },

  }}
