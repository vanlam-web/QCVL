import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
type Movement=Awaited<ReturnType<NonNullable<ServerRepository['listStockMovements']>>>[number]
export function createStockMovementRepository(pool:pg.Pool,deps:{ensureStock:(pool:pg.Pool)=>Promise<void>;derivePurchase:(pool:pg.Pool,organizationId:string,productId:string)=>Promise<Movement[]>}):Pick<ServerRepository,'listStockMovements'>{const {ensureStock,derivePurchase}=deps;return{
    async listStockMovements(input) {
      await ensureStock(pool)
      const productId = input.url.searchParams.get('product_id')
      const values: unknown[] = [input.organizationId]
      const clauses = ['sm.organization_id = $1']
      if (productId) {
        values.push(productId)
        clauses.push(`sm.product_id = $${values.length}::uuid`)
      }
      const result = await pool.query(
        `
          select
            sm.id::text,
            sm.product_id::text,
            sm.movement_type,
            sm.quantity_delta,
            sm.created_at,
            sm.document_code,
            sm.document_type,
            sm.transaction_price,
            sm.cost_price,
            sm.ending_qty,
            sm.partner_name
          from stock_movements sm
          where ${clauses.join(' and ')}
          order by sm.created_at desc, sm.id desc
        `,
        values,
      )
      const movements = result.rows.map((row) => ({
        id: String(row.id),
        product_id: String(row.product_id),
        movement_type: String(row.movement_type),
        quantity_delta: Number(row.quantity_delta),
        created_at: row.created_at?.toISOString?.() ?? row.created_at,
        document_code: row.document_code === null ? null : String(row.document_code),
        document_type: row.document_type === null ? null : String(row.document_type) as Movement['document_type'],
        transaction_price: row.transaction_price === null ? null : Number(row.transaction_price),
        cost_price: row.cost_price === null ? null : Number(row.cost_price),
        ending_qty: row.ending_qty === null ? null : Number(row.ending_qty),
        partner_name: row.partner_name === null ? null : String(row.partner_name),
      }))
      if (!productId) return movements
      const derived = await derivePurchase(pool, input.organizationId, productId)
      if (movements.length === 0) return derived
      const existingPurchaseCodes = new Set(
        movements
          .filter((movement) => movement.document_type === 'purchase_receipt' && movement.document_code)
          .map((movement) => movement.document_code as string),
      )
      const missingDerived = derived.filter((movement) => (
        movement.document_code !== null && !existingPurchaseCodes.has(movement.document_code)
      ))
      if (missingDerived.length === 0) return movements
      const merged = [...movements, ...missingDerived].sort((left, right) => {
        const timeDiff = Date.parse(String(left.created_at)) - Date.parse(String(right.created_at))
        if (timeDiff !== 0) return timeDiff
        return String(left.id).localeCompare(String(right.id))
      })
      let endingQty = 0
      for (const movement of merged) {
        endingQty += Number(movement.quantity_delta)
        movement.ending_qty = endingQty
      }
      return merged.reverse()
    },

  }}
