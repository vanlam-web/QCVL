import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type Detail=Awaited<ReturnType<NonNullable<ServerRepository['getStocktake']>>>
export function createStocktakeDetailRepository(pool:pg.Pool,deps:{ensureTables:(pool:pg.Pool)=>Promise<void>}):Pick<ServerRepository,'getStocktake'|'updateStocktakeNote'|'cancelStocktake'>{const ensureTables=deps.ensureTables;return{
    async getStocktake(input) {
      const header = await pool.query(
        `
          select
            st.id::text,
            st.code,
            st.status,
            st.source_type,
            st.source_creator_name,
            coalesce(st.source_created_at, st.created_at) as created_at,
            coalesce(st.source_balanced_at, st.balanced_at) as balanced_at,
            coalesce(sum(sti.actual_qty), 0) as total_actual_qty,
            case
              when count(sti.line_actual_value) = 0 then null
              else sum(sti.line_actual_value)
            end as total_actual_value,
            case
              when count(sti.line_difference_value) = 0 then null
              else sum(sti.line_difference_value)
            end as total_difference_value,
            coalesce(sum(greatest(sti.difference_qty, 0)), 0) as increased_qty,
            abs(coalesce(sum(least(sti.difference_qty, 0)), 0)) as decreased_qty,
            created_by_user.id::text as created_by_id,
            created_by_user.display_name as created_by_name,
            st.note
          from stocktakes st
          left join stocktake_items sti on sti.organization_id = st.organization_id and sti.stocktake_id = st.id
          left join users created_by_user on created_by_user.organization_id = st.organization_id and created_by_user.id = st.created_by
          where st.organization_id = $1
            and (st.id::text = $2 or st.code = $2 or st.source_code = $2)
          group by st.id, st.code, st.status, st.source_type, st.source_creator_name, st.source_created_at, st.created_at, st.source_balanced_at, st.balanced_at, created_by_user.id, created_by_user.display_name, st.note
          limit 1
        `,
        [input.organizationId, input.id],
      )
      const stocktake = header.rows[0]
      if (!stocktake) return null

      const items = await pool.query(
        `
          select
            sti.id::text,
            sti.line_no,
            sti.product_id::text,
            coalesce(nullif(sti.source_product_code, ''), p.code, '') as product_code,
            coalesce(nullif(sti.source_product_name, ''), p.name, nullif(sti.source_product_code, ''), '') as product_name,
            coalesce(sti.source_unit_name, u.name) as unit_name,
            sti.system_qty,
            sti.actual_qty,
            sti.difference_qty,
            sti.line_actual_value,
            sti.line_difference_value,
            sti.note
          from stocktake_items sti
          left join products p on p.organization_id = sti.organization_id and p.id = sti.product_id
          left join inventory_units u on u.organization_id = sti.organization_id and u.id = sti.stock_unit_id
          where sti.organization_id = $1 and sti.stocktake_id = $2::uuid
          order by sti.line_no asc, sti.created_at asc
        `,
        [input.organizationId, stocktake.id],
      )

      return {
        id: String(stocktake.id),
        code: String(stocktake.code),
        status: stocktake.status === 'draft' || stocktake.status === 'cancelled' ? stocktake.status : 'balanced',
        source_type: stocktake.source_type === 'kiotviet_import' || stocktake.source_type === 'product_edit' ? stocktake.source_type : 'manual',
        created_at: stocktake.created_at?.toISOString?.() ?? stocktake.created_at,
        balanced_at: stocktake.balanced_at === null ? null : stocktake.balanced_at?.toISOString?.() ?? stocktake.balanced_at,
        source_creator_name: stocktake.source_creator_name === null ? null : String(stocktake.source_creator_name),
        created_by: stocktake.created_by_id === null || stocktake.created_by_id === undefined ? null : {
          id: String(stocktake.created_by_id),
          name: String(stocktake.created_by_name ?? stocktake.created_by_id),
        },
        total_actual_qty: Number(stocktake.total_actual_qty),
        total_actual_value: stocktake.total_actual_value === null ? null : Number(stocktake.total_actual_value),
        total_difference_value: stocktake.total_difference_value === null ? null : Number(stocktake.total_difference_value),
        increased_qty: Number(stocktake.increased_qty),
        decreased_qty: Number(stocktake.decreased_qty),
        note: stocktake.note === null ? null : String(stocktake.note),
        items: items.rows.map((row) => ({
          id: String(row.id),
          line_no: Number(row.line_no),
          product_id: row.product_id === null ? null : String(row.product_id),
          product_code: String(row.product_code),
          product_name: String(row.product_name),
          unit_name: row.unit_name === null ? null : String(row.unit_name),
          system_qty: row.system_qty === null ? null : Number(row.system_qty),
          actual_qty: row.actual_qty === null ? null : Number(row.actual_qty),
          difference_qty: row.difference_qty === null ? null : Number(row.difference_qty),
          line_actual_value: row.line_actual_value === null ? null : Number(row.line_actual_value),
          line_difference_value: row.line_difference_value === null ? null : Number(row.line_difference_value),
          note: row.note === null ? null : String(row.note),
        })),
      } satisfies Detail
    },

    async updateStocktakeNote(input) {
      await ensureTables(pool)
      const result = await pool.query(
        `
          update stocktakes
          set note = $3
          where organization_id = $1
            and (id::text = $2 or code = $2 or source_code = $2)
          returning id::text
        `,
        [input.organizationId, input.id, input.note],
      )
      const updatedId = result.rows[0]?.id
      if (!updatedId) return null
      return this.getStocktake?.({ organizationId: input.organizationId, id: String(updatedId) }) ?? null
    },

    async cancelStocktake(input) {
      await ensureTables(pool)
      const result = await pool.query(
        `
          update stocktakes
          set status = 'cancelled',
              balanced_at = null,
              source_balanced_at = null
          where organization_id = $1
            and (id::text = $2 or code = $2 or source_code = $2)
          returning id::text
        `,
        [input.organizationId, input.id],
      )
      const updatedId = result.rows[0]?.id
      if (!updatedId) return null
      return this.getStocktake?.({ organizationId: input.organizationId, id: String(updatedId) }) ?? null
    },

  }}
