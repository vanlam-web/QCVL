import type pg from 'pg'
import type { PurchaseReceiptData, ServerRepository, SupplierListData } from '../../http.js'
type Input=Parameters<NonNullable<ServerRepository['upsertImportedKiotVietPurchaseReceipts']>>[0]
type ImportRow = Input['rows'][number]
type ImportProduct = { id: string; track_inventory: boolean; factor: number }
type MovementInput = { id: string; productId: string; movementType: string; quantityDelta: number; endingQty: number; documentType: string; documentCode: string; transactionPrice: number; costPrice: number; partnerName: string | null; createdAt: string }
type PurchaseImportDeps = {
  ensureSnapshots(pool: pg.Pool): Promise<void>
  ensureStock(pool: pg.Pool): Promise<void>
  productsByCode(pool: pg.Pool, organizationId: string): Promise<unknown>
  supplierByCode(pool: pg.Pool, table: string, organizationId: string, code: string): Promise<SupplierListData | null>
  resolveProduct(products: unknown, code: string): ImportProduct | null
  receiptFromRows(sourceCode: string, rows: ImportRow[], supplier: SupplierListData | null): PurchaseReceiptData
  deleteMovementsForDocument(pool: pg.Pool, organizationId: string, documentType: string, documentCode: string): Promise<Set<string>>
  insertMovement(pool: pg.Pool, organizationId: string, movement: MovementInput): Promise<void>
  recomputeBalances(pool: pg.Pool, organizationId: string, productIds: Set<string>): Promise<void>
  stableId(value: string): string
}
export function createPurchaseImportRepository(pool:pg.Pool,deps:PurchaseImportDeps):Pick<ServerRepository,'upsertImportedKiotVietPurchaseReceipts'>{ const {ensureSnapshots,ensureStock,productsByCode,supplierByCode,resolveProduct,receiptFromRows,deleteMovementsForDocument,insertMovement,recomputeBalances,stableId}=deps
 return {
    async upsertImportedKiotVietPurchaseReceipts(input:Input) {
      await ensureSnapshots(pool)
      await ensureStock(pool)
      const products = await productsByCode(pool, input.organizationId)
      let receiptsCreated = 0
      let receiptsUpdated = 0
      let itemsCreated = 0
      let itemsUpdated = 0
      let skippedRows = 0
      const rowsBySourceCode = new Map<string, typeof input.rows>()

      for (const row of input.rows) {
        const supplier = await supplierByCode(pool, 'supplier_snapshots', input.organizationId, row.supplier_code)
        const product = resolveProduct(products, row.product_code)
        if (!supplier || !product) {
          skippedRows += 1
          continue
        }
        const rows = rowsBySourceCode.get(row.source_code) ?? []
        rows.push(row)
        rowsBySourceCode.set(row.source_code, rows)
      }

      const affectedProducts = new Set<string>()
      await pool.query('begin')
      try {
        for (const [sourceCode, rows] of rowsBySourceCode) {
          const existing = await pool.query('select data from purchase_receipt_snapshots where organization_id = $1 and code = $2 limit 1', [input.organizationId, sourceCode])
          if (existing.rows[0]) receiptsUpdated += 1
          else receiptsCreated += 1
          if (existing.rows[0]) itemsUpdated += rows.length
          else itemsCreated += rows.length

          const first = rows[0]
          const supplier = await supplierByCode(pool, 'supplier_snapshots', input.organizationId, first.supplier_code)
          const receipt = receiptFromRows(sourceCode, rows, supplier)
          await pool.query(
            `
              insert into purchase_receipt_snapshots (id, organization_id, code, data, source_type, created_at, updated_at)
              values ($1, $2, $3, $4::jsonb, 'kiotviet_import', coalesce($5::timestamptz, now()), now())
              on conflict (organization_id, code)
              do update set data = excluded.data, source_type = excluded.source_type, updated_at = now()
            `,
            [receipt.id, input.organizationId, receipt.code, JSON.stringify(receipt), receipt.received_at],
          )

          const deleted = await deleteMovementsForDocument(pool, input.organizationId, 'purchase_receipt', sourceCode)
          for (const productId of deleted) affectedProducts.add(productId)

          if (first.status !== 'posted') continue
          let runningEndingQty = 0
          for (const row of [...rows].sort((left, right) => left.rowNumber - right.rowNumber)) {
            const product = resolveProduct(products, row.product_code)
            if (!product?.track_inventory) continue
            const quantityDelta = row.quantity * product.factor
            if (quantityDelta === 0) continue
            runningEndingQty += quantityDelta
            affectedProducts.add(product.id)
            await insertMovement(pool, input.organizationId, {
              id: stableId(`stock-movement-kv-purchase-${sourceCode}-${row.rowNumber}`),
              productId: product.id,
              movementType: 'purchase_receipt',
              quantityDelta,
              endingQty: runningEndingQty,
              documentType: 'purchase_receipt',
              documentCode: sourceCode,
              transactionPrice: row.unit_cost,
              costPrice: row.unit_cost,
              partnerName: supplier?.name ?? row.supplier_name ?? null,
              createdAt: first.received_at ?? first.source_created_at ?? first.updated_at ?? new Date().toISOString(),
            })
          }
        }
        await recomputeBalances(pool, input.organizationId, affectedProducts)
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }

      return {
        receipts_created: receiptsCreated,
        receipts_updated: receiptsUpdated,
        items_created: itemsCreated,
        items_updated: itemsUpdated,
        skipped_rows: skippedRows,
      }
    },

  }
}
