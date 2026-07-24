import type pg from 'pg'
import type { CustomerListData, SalesDocumentData, ServerRepository } from '../../http.js'
type SalesImportRow = Parameters<NonNullable<ServerRepository['upsertImportedKiotVietInvoices']>>[0]['rows'][number]
type SalesImportProduct = { id: string; factor: number; track_inventory: boolean; product_kind: string; latest_purchase_cost: number | null }
type BomComponent = { productId: string; quantity: number; factor: number; trackInventory: boolean; latestPurchaseCost: number | null }
type SalesMovement = { id: string; productId: string; movementType: string; quantityDelta: number; endingQty: number | null; documentType: string; documentCode: string; transactionPrice: number | null; costPrice: number | null; partnerName: string | null; createdAt: string }
type SalesImportDeps = {
  ensureTables(pool: pg.Pool): Promise<void>
  ensureMovements(pool: pg.Pool): Promise<void>
  ensureSnapshots(pool: pg.Pool): Promise<void>
  deleteMovementsForDocuments(pool: pg.Pool, organizationId: string, documentType: string): Promise<Set<string>>
  recomputeBalances(pool: pg.Pool, organizationId: string, productIds: Set<string>): Promise<void>
  ensureBom(pool: pg.Pool): Promise<void>
  productsByCode(pool: pg.Pool, organizationId: string): Promise<unknown>
  bomComponents(pool: pg.Pool, organizationId: string): Promise<Map<string, BomComponent[]>>
  customerByCode(pool: pg.Pool, organizationId: string, code: string): Promise<CustomerListData | null>
  resolveProduct(products: unknown, code: string): SalesImportProduct | null
  documentFromRows(sourceCode: string, rows: SalesImportRow[], customer: CustomerListData | null): SalesDocumentData
  insertDocument(pool: pg.Pool, organizationId: string, document: SalesDocumentData): Promise<void>
  deleteMovementsForDocument(pool: pg.Pool, organizationId: string, documentType: string, documentCode: string): Promise<Set<string>>
  insertMovement(pool: pg.Pool, organizationId: string, movement: SalesMovement): Promise<void>
  stableId(value: string): string
}
export function createSalesImportRepository(pool:pg.Pool,deps:SalesImportDeps):Pick<ServerRepository,'findSalesDocumentsByCodes'|'deleteImportedKiotVietInvoices'|'upsertImportedKiotVietInvoices'>{const {ensureTables,ensureMovements,ensureSnapshots,deleteMovementsForDocuments,recomputeBalances,ensureBom,productsByCode,bomComponents,customerByCode,resolveProduct,documentFromRows,insertDocument,deleteMovementsForDocument,insertMovement,stableId}=deps;return{
    async findSalesDocumentsByCodes(input) {
      await ensureTables(pool)
      const result = await pool.query(
        `
          select requested.code
          from unnest($2::text[]) as requested(code)
          where exists (
            select 1 from orders o
            where o.organization_id = $1 and lower(o.code) = lower(requested.code)
          )
        `,
        [input.organizationId, input.codes],
      )
      return new Set(result.rows.map((row) => String(row.code)))
    },

    async deleteImportedKiotVietInvoices(input) {
      await ensureTables(pool)
      await ensureMovements(pool)
      await pool.query('begin')
      try {
        const affected = await deleteMovementsForDocuments(pool, input.organizationId, 'sale_invoice')
        const result = await pool.query(
          `
            delete from orders
            where organization_id = $1
              and code like 'HD%'
          `,
          [input.organizationId],
        )
        await recomputeBalances(pool, input.organizationId, affected)
        await pool.query('commit')
        return { deleted: result.rowCount ?? 0, blocked: 0 }
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    },

    async upsertImportedKiotVietInvoices(input) {
      const client = await pool.connect()
      const transactionPool = Object.create(pool) as pg.Pool
      transactionPool.query = client.query.bind(client) as pg.Pool['query']
      try {
        await ensureSnapshots(transactionPool)
        await ensureTables(transactionPool)
        await ensureMovements(transactionPool)
        await ensureBom(transactionPool)
        const products = await productsByCode(transactionPool, input.organizationId)
        const bomComponentsByProductId = await bomComponents(transactionPool, input.organizationId)
        let invoicesCreated = 0
        let invoicesUpdated = 0
        let itemsCreated = 0
        let itemsUpdated = 0
        let skippedRows = 0
        const rowsBySourceCode = new Map<string, typeof input.rows>()

        for (const row of input.rows) {
          const customer = await customerByCode(transactionPool, input.organizationId, row.customer_code)
          const product = resolveProduct(products, row.product_code)
          if (!customer || !product) {
            skippedRows += 1
            continue
          }
          const rows = rowsBySourceCode.get(row.source_code) ?? []
          rows.push(row)
          rowsBySourceCode.set(row.source_code, rows)
        }

        const affectedProducts = new Set<string>()
        await client.query('begin')
        try {
          for (const [sourceCode, rows] of rowsBySourceCode) {
            const existing = await transactionPool.query('select id from orders where organization_id = $1 and code = $2 limit 1', [input.organizationId, sourceCode])
            if (existing.rows[0]) invoicesUpdated += 1
            else invoicesCreated += 1
            if (existing.rows[0]) itemsUpdated += rows.length
            else itemsCreated += rows.length

            const first = rows[0]
            const customer = await customerByCode(transactionPool, input.organizationId, first.customer_code)
            const document = documentFromRows(sourceCode, rows, customer)
            await insertDocument(transactionPool, input.organizationId, document)

            const deleted = await deleteMovementsForDocument(transactionPool, input.organizationId, 'sale_invoice', sourceCode)
            for (const productId of deleted) affectedProducts.add(productId)

            if (first.status !== 'completed') continue
            let runningEndingQty = 0
            for (const row of [...rows].sort((left, right) => left.rowNumber - right.rowNumber)) {
              const product = resolveProduct(products, row.product_code)
              if (!product) continue
              const saleUnitFactor = row.stock_qty_per_sale_unit && row.stock_qty_per_sale_unit > 0 ? row.stock_qty_per_sale_unit : product.factor
              const soldQuantity = row.quantity * saleUnitFactor
              const parentKind = product.product_kind.trim().toLowerCase()
              if (product.track_inventory && parentKind !== 'combo' && parentKind !== 'service') {
                const quantityDelta = -soldQuantity
                if (quantityDelta !== 0) {
                  runningEndingQty += quantityDelta
                  affectedProducts.add(product.id)
                  await insertMovement(transactionPool, input.organizationId, {
                    id: stableId(`stock-movement-kv-sale-${sourceCode}-${row.rowNumber}`),
                    productId: product.id, movementType: 'sale_deduction', quantityDelta, endingQty: runningEndingQty,
                    documentType: 'sale_invoice', documentCode: sourceCode, transactionPrice: row.unit_price,
                    costPrice: product.latest_purchase_cost, partnerName: customer?.name ?? row.customer_name,
                    createdAt: first.created_at ?? first.updated_at ?? new Date().toISOString(),
                  })
                }
              }
              for (const component of bomComponentsByProductId.get(product.id) ?? []) {
                if (!component.trackInventory) continue
                const quantityDelta = -soldQuantity * component.quantity * component.factor
                if (quantityDelta === 0) continue
                affectedProducts.add(component.productId)
                await insertMovement(transactionPool, input.organizationId, {
                  id: stableId(`stock-movement-kv-sale-bom-${sourceCode}-${row.rowNumber}-${component.productId}`),
                  productId: component.productId, movementType: 'sale_deduction', quantityDelta, endingQty: null,
                  documentType: 'sale_invoice', documentCode: sourceCode, transactionPrice: null,
                  costPrice: component.latestPurchaseCost, partnerName: customer?.name ?? row.customer_name,
                  createdAt: first.created_at ?? first.updated_at ?? new Date().toISOString(),
                })
              }
            }
          }
          await recomputeBalances(transactionPool, input.organizationId, affectedProducts)
          await client.query('commit')
        } catch (error) {
          await client.query('rollback')
          throw error
        }

        return { invoices_created: invoicesCreated, invoices_updated: invoicesUpdated, items_created: itemsCreated, items_updated: itemsUpdated, skipped_rows: skippedRows }
      } finally {
        client.release()
      }
    },

  }}
