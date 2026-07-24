import { describe, expect, it } from 'vitest'
import type pg from 'pg'
import { createSalesImportRepository } from './sales-import-repository.js'

const organizationId = 'org-1'
const customer = { id: 'customer-1', code: 'KH000001', name: 'Customer' } as never
const row = (productCode: string, rowNumber: number) => ({
  source_code: 'HD000001', rowNumber, customer_code: 'KH000001', customer_name: 'Customer',
  product_code: productCode, quantity: 2, unit_price: 10, stock_qty_per_sale_unit: 1,
  status: 'completed', created_at: '2026-07-23T00:00:00.000Z', updated_at: '2026-07-23T00:00:00.000Z',
}) as never

function setup(products: Record<string, { id: string; factor: number; product_kind: string; track_inventory: boolean; latest_purchase_cost: number | null }>) {
  const movements: Array<{ productId: string; quantityDelta: number }> = []
  const query = async () => ({ rows: [] })
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as pg.Pool
  const repository = createSalesImportRepository(pool, {
    ensureTables: async () => undefined,
    ensureMovements: async () => undefined,
    ensureSnapshots: async () => undefined,
    ensureBom: async () => undefined,
    productsByCode: async () => products,
    bomComponents: async () => new Map([['combo-1', [{ productId: 'component-1', quantity: 3, factor: 1, trackInventory: true, latestPurchaseCost: 4 }]]]),
    customerByCode: async () => customer,
    resolveProduct: (items, code) => (items as typeof products)[code] ?? null,
    documentFromRows: (sourceCode, rows) => ({ code: sourceCode, status: 'completed', items: rows, customer }) as never,
    insertDocument: async () => undefined,
    deleteMovementsForDocument: async () => new Set<string>(),
    deleteMovementsForDocuments: async () => new Set<string>(),
    insertMovement: async (_pool, _organizationId, movement) => { movements.push({ productId: movement.productId, quantityDelta: movement.quantityDelta }) },
    recomputeBalances: async () => undefined,
    stableId: (value) => value,
  })
  return { repository, movements }
}

describe('KiotViet combo inventory import', () => {
  it('deducts only active BOM components for a combo parent', async () => {
    const fake = setup({ COMBO: { id: 'combo-1', factor: 1, product_kind: 'combo', track_inventory: true, latest_purchase_cost: null } })
    await fake.repository.upsertImportedKiotVietInvoices?.({ organizationId, rows: [row('COMBO', 1)] })
    expect(fake.movements).toEqual([{ productId: 'component-1', quantityDelta: -6 }])
  })

  it('still deducts a normal stock-tracked product itself', async () => {
    const fake = setup({ GOODS: { id: 'goods-1', factor: 1, product_kind: 'goods', track_inventory: true, latest_purchase_cost: null } })
    await fake.repository.upsertImportedKiotVietInvoices?.({ organizationId, rows: [row('GOODS', 1)] })
    expect(fake.movements).toEqual([{ productId: 'goods-1', quantityDelta: -2 }])
  })
})