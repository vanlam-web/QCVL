import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { ServerRepository } from '../../http-types.js'
import { buildPriceFormulaPreview, selectedFormulaPrices, type PriceFormulaApplyResult, type PriceFormulaInput, type PriceFormulaPreview } from './price-formula-core.js'

type PreviewInput = { organizationId: string; formula: PriceFormulaInput }
export function createPriceFormulaRepository(pool: pg.Pool, deps: { ensureCatalog: (pool: pg.Pool) => Promise<void>; ensurePriceLists: (pool: pg.Pool) => Promise<void> }): Pick<ServerRepository, 'previewPriceFormula' | 'applyPriceFormula'> {
  async function load(input: PreviewInput, database: pg.Pool | pg.PoolClient = pool) {
    await deps.ensureCatalog(pool)
    await deps.ensurePriceLists(pool)
    const [productsResult, listsResult, pricesResult] = await Promise.all([
      database.query('select id::text, code, name, status, sell_method, latest_purchase_cost from products where organization_id=$1', [input.organizationId]),
      database.query('select id::text, name, is_active from price_lists where organization_id=$1', [input.organizationId]),
      database.query('select product_id::text, price_list_id::text, unit_price from price_list_items where organization_id=$1', [input.organizationId]),
    ])
    const pricesByProduct = new Map<string, Map<string, number>>()
    for (const row of pricesResult.rows) {
      const productId = String(row.product_id)
      const items = pricesByProduct.get(productId) ?? new Map<string, number>()
      items.set(String(row.price_list_id), Number(row.unit_price))
      pricesByProduct.set(productId, items)
    }
    return buildPriceFormulaPreview(
      input.formula,
      productsResult.rows.map((row) => ({ id: String(row.id), code: String(row.code), name: String(row.name), status: String(row.status), sell_method: String(row.sell_method), latest_purchase_cost: row.latest_purchase_cost === null ? null : Number(row.latest_purchase_cost) })),
      listsResult.rows.map((row) => ({ id: String(row.id), name: String(row.name), is_active: Boolean(row.is_active) })),
      pricesByProduct,
    )
  }
  return {
    async previewPriceFormula(input): Promise<PriceFormulaPreview> { return load(input) },
    async applyPriceFormula(input): Promise<PriceFormulaApplyResult> {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const preview = await load(input, client)
        const prices = selectedFormulaPrices(preview, input.selectedItems)
        for (const price of prices) {
          const valid = await client.query(`select 1 from products p join price_lists pl on pl.organization_id=p.organization_id where p.organization_id=$1 and p.id=$2 and p.status='active' and pl.id=$3 and pl.is_active=true for update of p, pl`, [input.organizationId, price.product_id, price.price_list_id])
          if (valid.rowCount !== 1) throw new Error('PRICE_FORMULA_SELECTION_STALE')
          await client.query(`insert into price_list_items (id, organization_id, price_list_id, product_id, unit_price, created_at, updated_at) values ($1,$2,$3,$4,$5,now(),now()) on conflict (price_list_id, product_id) do update set unit_price=excluded.unit_price, updated_at=now()`, [randomUUID(), input.organizationId, price.price_list_id, price.product_id, price.unit_price])
        }
        await client.query('commit')
        return { formula_rule_id: randomUUID(), affected_count: prices.length }
      } catch (error) {
        await client.query('rollback')
        throw error
      } finally {
        client.release()
      }
    },
  }
}
