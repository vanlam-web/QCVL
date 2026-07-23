import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type StocktakeImportRow = Parameters<NonNullable<ServerRepository['upsertImportedKiotVietStocktakes']>>[0]['rows'][number]
type StocktakeImportDeps = {
  ensureTables(pool: pg.Pool): Promise<void>
  statusFromSource(status: StocktakeImportRow['status']): string
  noteFromRows(rows: StocktakeImportRow[]): string | null
  creatorFromRows(rows: StocktakeImportRow[]): string | null
  userIdByCreator(pool: pg.Pool, organizationId: string, creatorName: string | null): Promise<string | null>
  productIdByCode(pool: pg.Pool, organizationId: string, code: string): Promise<string | null>
}
export function createStocktakeImportRepository(pool:pg.Pool,deps:StocktakeImportDeps):Pick<ServerRepository,'upsertImportedKiotVietStocktakes'|'deleteDemoStocktakesForImport'|'deleteImportedKiotVietStocktakes'>{const {ensureTables,statusFromSource,noteFromRows,creatorFromRows,userIdByCreator,productIdByCode}=deps;return{
    async upsertImportedKiotVietStocktakes(input) {
      if (input.rows.length === 0) {
        return {
          stocktakes_created: 0,
          stocktakes_updated: 0,
          items_created: 0,
          items_updated: 0,
          missing_product_rows: 0,
        }
      }

      await ensureTables(pool)
      let stocktakesCreated = 0
      let stocktakesUpdated = 0
      let itemsCreated = 0
      let itemsUpdated = 0
      let missingProductRows = 0
      const rowsBySourceCode = new Map<string, typeof input.rows>()
      for (const row of input.rows) {
        const groupedRows = rowsBySourceCode.get(row.source_code) ?? []
        groupedRows.push(row)
        rowsBySourceCode.set(row.source_code, groupedRows)
      }

      await pool.query('begin')
      try {
        for (const [sourceCode, rows] of rowsBySourceCode) {
          const firstRow = rows[0]
          const status = statusFromSource(firstRow.status)
          const note = noteFromRows(rows)
          const sourceCreatorName = creatorFromRows(rows)
          const sourceCreatorUserId = await userIdByCreator(pool, input.organizationId, sourceCreatorName)
          const stocktake = await pool.query(
            `
              insert into stocktakes (
                id, organization_id, source_system, source_code, code, status, source_type,
                source_created_at, source_balanced_at, source_creator_name, note, balanced_at, created_by,
                created_at, updated_at
              )
              values ($1, $2, $3, $4, $4, $5, 'kiotviet_import', $6, $7, $8, $9, $10, $11, coalesce($6::timestamptz, now()), now())
              on conflict (organization_id, source_system, source_code)
              where source_system is not null and source_code is not null
              do update set
                status = excluded.status,
                source_created_at = excluded.source_created_at,
                source_balanced_at = excluded.source_balanced_at,
                source_creator_name = excluded.source_creator_name,
                note = excluded.note,
                balanced_at = excluded.balanced_at,
                created_by = excluded.created_by,
                updated_at = now()
              returning id::text, (xmax = 0) as inserted
            `,
            [
              randomUUID(),
              input.organizationId,
              'kiotviet',
              sourceCode,
              status,
              firstRow.source_created_at,
              firstRow.source_balanced_at,
              sourceCreatorName,
              note,
              status === 'balanced' ? firstRow.source_balanced_at : null,
              sourceCreatorUserId,
            ],
          )
          const stocktakeId = String(stocktake.rows[0]?.id)
          if (stocktake.rows[0]?.inserted) stocktakesCreated += 1
          else stocktakesUpdated += 1

          for (const row of rows) {
            const productId = await productIdByCode(pool, input.organizationId, row.product_code)
            if (!productId) missingProductRows += 1
            const item = await pool.query(
              `
                insert into stocktake_items (
                  id, organization_id, stocktake_id, line_no, product_id, stock_unit_id,
                  system_qty, actual_qty, difference_qty, note, source_row_number,
                  source_product_code, source_product_name, source_unit_name,
                  line_actual_value, line_difference_value, created_at
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $4, $11, $12, $13, $14, $15, now())
                on conflict (stocktake_id, source_row_number)
                where source_row_number is not null
                do update set
                  line_no = excluded.line_no,
                  product_id = excluded.product_id,
                  stock_unit_id = excluded.stock_unit_id,
                  system_qty = excluded.system_qty,
                  actual_qty = excluded.actual_qty,
                  difference_qty = excluded.difference_qty,
                  note = excluded.note,
                  source_product_code = excluded.source_product_code,
                  source_product_name = excluded.source_product_name,
                  source_unit_name = excluded.source_unit_name,
                  line_actual_value = excluded.line_actual_value,
                  line_difference_value = excluded.line_difference_value
                returning (xmax = 0) as inserted
              `,
              [
                randomUUID(),
                input.organizationId,
                stocktakeId,
                row.rowNumber,
                productId,
                null,
                row.system_qty,
                row.actual_qty,
                row.difference_qty,
                row.note,
                row.product_code,
                row.product_name,
                row.unit_name,
                row.total_actual_value,
                row.line_difference_value,
              ],
            )
            if (item.rows[0]?.inserted) itemsCreated += 1
            else itemsUpdated += 1
          }
        }
        await pool.query('commit')
        return {
          stocktakes_created: stocktakesCreated,
          stocktakes_updated: stocktakesUpdated,
          items_created: itemsCreated,
          items_updated: itemsUpdated,
          missing_product_rows: missingProductRows,
        }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async deleteDemoStocktakesForImport(input) {
      await ensureTables(pool)
      const result = await pool.query(
        `
          delete from stocktakes
          where organization_id = $1
            and source_system = 'kiotviet'
            and source_code = any($2::text[])
        `,
        [input.organizationId, ['KK-JULY', 'KK-JUNE', 'KK-DEMO']],
      )
      return { deleted: result.rowCount ?? 0, blocked: 0 }
    },

    async deleteImportedKiotVietStocktakes(input) {
      await ensureTables(pool)
      await pool.query(
        `
          delete from stocktake_items
          where organization_id = $1
            and stocktake_id in (
              select id
              from stocktakes
              where organization_id = $1
                and (
                  source_type = 'kiotviet_import'
                  or source_system = 'kiotviet'
                )
            )
        `,
        [input.organizationId],
      )
      const result = await pool.query(
        `
          delete from stocktakes
          where organization_id = $1
            and (
              source_type = 'kiotviet_import'
              or source_system = 'kiotviet'
            )
        `,
        [input.organizationId],
      )
      return { deleted: result.rowCount ?? 0, blocked: 0 }
    },

  }}
