import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type AdjustmentProduct = { id: string; inventory_shape: string; stock_unit_id: string | null; latest_purchase_cost: number | null }
type InventoryMovementInput = { id: string; productId: string; movementType: string; quantityDelta: number; endingQty: number; documentType: string; documentCode: string; transactionPrice: number | null; costPrice: number | null; partnerName: string | null; createdAt: string }
type InventoryAdjustmentDeps = {
  ensureStocktakes(pool: pg.Pool): Promise<void>
  ensureMovements(pool: pg.Pool): Promise<void>
  insertMovement(pool: pg.Pool, organizationId: string, movement: InventoryMovementInput): Promise<void>
  recomputeBalances(pool: pg.Pool, organizationId: string, productIds: Set<string>): Promise<void>
  stableId(value: string): string
  latestQty(pool: pg.Pool, organizationId: string, productId: string): Promise<number>
  loadStocktake: NonNullable<ServerRepository['getStocktake']>
  ensureUnits(pool: pg.Pool): Promise<void>
  ensureOpenings(pool: pg.Pool): Promise<void>
  openingProduct(pool: pg.Pool, organizationId: string, productId: string): Promise<AdjustmentProduct | null>
  openingFactor(pool: pg.Pool, organizationId: string, productId: string, openedUnitId: string, stockUnitId: string | null): Promise<number>
}
export function createInventoryAdjustmentRepository(pool:pg.Pool,deps:InventoryAdjustmentDeps):Pick<ServerRepository,'adjustNormalProductStock'|'createMaterialOpening'>{const {ensureStocktakes,ensureMovements,insertMovement,recomputeBalances,stableId,latestQty,loadStocktake,ensureUnits,ensureOpenings,openingProduct,openingFactor}=deps;return{
    async adjustNormalProductStock(input) {
      await ensureStocktakes(pool)
      await ensureMovements(pool)
      const product = await pool.query(
        `
          select p.id::text, p.code, p.name, p.unit_name, p.latest_purchase_cost
          from products p
          where p.organization_id = $1
            and p.id = $2
            and p.track_inventory = true
          limit 1
        `,
        [input.organizationId, input.productId],
      )
      const productRow = product.rows[0]
      if (!productRow) return null

      const settings = await pool.query(
        `
          select stock_unit_id::text
          from product_inventory_settings
          where organization_id = $1
            and product_id = $2
          limit 1
        `,
        [input.organizationId, input.productId],
      )
      const currentQty = await latestQty(pool, input.organizationId, input.productId)
      const differenceQty = input.actualQty - currentQty
      const stocktakeId = randomUUID()
      const stocktakeCode = `KK-QCVL-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`
      const costPrice = productRow.latest_purchase_cost === null ? null : Number(productRow.latest_purchase_cost)
      await pool.query('begin')
      try {
        const stocktake = await pool.query(
          `
            insert into stocktakes (
              id, organization_id, source_system, source_code, code, status, source_type,
              source_created_at, source_balanced_at, source_creator_name, note, balanced_at, created_by,
              created_at, updated_at
            )
            values ($1, $2, 'qcvl', $3, $3, 'balanced', 'manual', now(), now(), $4, $5, now(), $6, now(), now())
            returning id::text, code
          `,
          [stocktakeId, input.organizationId, stocktakeCode, input.createdBy.name, input.reason, input.createdBy.id],
        )
        const code = String(stocktake.rows[0]?.code ?? stocktakeCode)
        await pool.query(
          `
            insert into stocktake_items (
              id, organization_id, stocktake_id, line_no, product_id, stock_unit_id,
              system_qty, actual_qty, difference_qty, note, source_row_number,
              source_product_code, source_product_name, source_unit_name,
              line_actual_value, line_difference_value, created_at
            )
            values ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, 1, $10, $11, $12, $13, $14, now())
          `,
          [
            randomUUID(),
            input.organizationId,
            stocktakeId,
            input.productId,
            settings.rows[0]?.stock_unit_id ?? null,
            currentQty,
            input.actualQty,
            differenceQty,
            input.reason,
            productRow.code,
            productRow.name,
            productRow.unit_name,
            costPrice === null ? null : input.actualQty * costPrice,
            costPrice === null ? null : differenceQty * costPrice,
          ],
        )
        await insertMovement(pool, input.organizationId, {
          id: stableId(`stock-movement-manual-stocktake-${code}-${input.productId}`),
          productId: input.productId,
          movementType: 'stocktake_balance',
          quantityDelta: differenceQty,
          endingQty: input.actualQty,
          documentType: 'stocktake',
          documentCode: code,
          transactionPrice: null,
          costPrice,
          partnerName: null,
          createdAt: new Date().toISOString(),
        })
        await recomputeBalances(pool, input.organizationId, new Set([input.productId]))
        await pool.query('commit')
        return loadStocktake({ organizationId: input.organizationId, id: stocktakeId })
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async createMaterialOpening(input) {
      await ensureUnits(pool)
      await ensureMovements(pool)
      await ensureOpenings(pool)
      if (input.input.inventory_shape !== 'normal') {
        throw new Error('MATERIAL_OPENING_SHAPE_NOT_SUPPORTED')
      }
      const product = await openingProduct(pool, input.organizationId, input.input.product_id)
      if (!product) throw new Error('PRODUCT_NOT_FOUND')
      if (product.inventory_shape !== 'normal') {
        throw new Error('MATERIAL_OPENING_SHAPE_NOT_SUPPORTED')
      }
      const openedUnitId = input.input.opened_unit_id ?? ''
      const openedQty = Number(input.input.opened_qty ?? 0)
      const oldRemainingQty = Number(input.input.old_remaining_qty ?? 0)
      if (!openedUnitId || !Number.isFinite(openedQty) || openedQty <= 0 || !Number.isFinite(oldRemainingQty) || oldRemainingQty < 0) {
        throw new Error('INVALID_MATERIAL_OPENING')
      }
      const stockQtyPerUnit = await openingFactor(pool, input.organizationId, product.id, openedUnitId, product.stock_unit_id)
      const openedStockQty = openedQty * stockQtyPerUnit
      const quantityDelta = openedStockQty - oldRemainingQty
      const openingId = randomUUID()
      const createdAt = new Date().toISOString()
      let stockMovementId: string | null = null
      await pool.query('begin')
      try {
        const opening = await pool.query(
          `
            insert into inventory_material_openings (
              id, organization_id, product_id, inventory_shape, source_type,
              opened_unit_id, opened_qty, opened_stock_qty, old_remaining_qty,
              stock_movement_id, note, created_at
            )
            values ($1, $2, $3, 'normal', 'manual_normal', $4, $5, $6, $7, null, $8, $9)
            returning id::text, created_at
          `,
          [openingId, input.organizationId, product.id, openedUnitId, openedQty, openedStockQty, oldRemainingQty, input.input.note ?? null, createdAt],
        )
        if (quantityDelta !== 0) {
          stockMovementId = stableId(`stock-movement-material-opening-${openingId}`)
          await insertMovement(pool, input.organizationId, {
            id: stockMovementId,
            productId: product.id,
            movementType: 'material_opening',
            quantityDelta,
            endingQty: quantityDelta,
            documentType: 'material_opening',
            documentCode: String(opening.rows[0]?.id ?? openingId),
            transactionPrice: null,
            costPrice: product.latest_purchase_cost,
            partnerName: null,
            createdAt,
          })
          await pool.query(
            `
              update inventory_material_openings
              set stock_movement_id = $3
              where organization_id = $1 and id = $2
            `,
            [input.organizationId, openingId, stockMovementId],
          )
          await recomputeBalances(pool, input.organizationId, new Set([product.id]))
        }
        await pool.query('commit')
        return {
          id: String(opening.rows[0]?.id ?? openingId),
          product_id: product.id,
          inventory_shape: 'normal',
          source_type: 'manual_normal',
          opened_unit_id: openedUnitId,
          opened_qty: openedQty,
          opened_stock_qty: openedStockQty,
          stock_movement_id: stockMovementId,
          warnings: [],
          created_at: opening.rows[0]?.created_at?.toISOString?.() ?? createdAt,
        }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

  }}
