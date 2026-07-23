import { describe, expect, it } from 'vitest'
import type pg from 'pg'
import type { PurchaseReceiptData } from '../../http.js'
import { createPurchaseReceiptTransactions } from './purchase-receipt-transactions.js'

const currentUser = { user: { id: 'user-1', display_name: 'User' }, organization: { id: 'org-1' } } as never
const receipt = {
  id: 'receipt-1', code: 'PN000001', status: 'draft', supplier_id: 'supplier-1',
  supplier: { id: 'supplier-1', code: 'NCC000001', name: 'Supplier' },
  paid_amount: 0, payable_amount: 100, remaining_amount: 100, supplier_payments: [], items: [],
  created_at: '2026-07-23T01:00:00.000Z', received_at: '2026-07-23T01:00:00.000Z', updated_at: '2026-07-23T01:00:00.000Z',
} as unknown as PurchaseReceiptData

function setup(inputReceipt: PurchaseReceiptData = receipt, options: { failBalance?: boolean } = {}) {
  const queries: string[] = []
  const directQueries: string[] = []
  let released = false
  let cashbookInserts = 0
  const client = {
    async query(text: string) { queries.push(text.trim()); return { rows: [] } },
    release() { released = true },
  }
  const pool = { connect: async () => client, query: async (text: string) => { directQueries.push(text); return { rows: [] } } } as unknown as pg.Pool
  const repository = createPurchaseReceiptTransactions(pool, {
    ensureSnapshots: async () => undefined,
    ensureStock: async () => undefined,
    ensureCatalog: async () => undefined,
    ensureSalesFinance: async () => undefined,
    loadReceipt: async () => inputReceipt,
    replaceMovements: async (transactionPool) => { await transactionPool.query('replace movements'); return new Set(['product-1']) },
    updateCosts: async (transactionPool) => { await transactionPool.query('update costs') },
    cashEntry: async () => ({ id: 'cash-1', code: 'PC000001', created_at: '2026-07-23T01:00:00.000Z' }) as never,
    insertCashbook: async (transactionPool) => { cashbookInserts += 1; await transactionPool.query('insert cashbook') },
    recomputeBalances: async (transactionPool) => { await transactionPool.query('recompute balances'); if (options.failBalance) throw new Error('balance failed') },
    recomputeSupplier: async (transactionPool) => { await transactionPool.query('recompute supplier') },
    deleteMovements: async (transactionPool) => { await transactionPool.query('delete movements'); return new Set(['product-1']) },
  })
  return { repository, queries, directQueries, released: () => released, cashbookInserts: () => cashbookInserts }
}

describe('purchase receipt transaction client', () => {
  it('posts stock, costs, snapshot, balances and supplier debt on one client', async () => {
    const fake = setup()
    await fake.repository.postPurchaseReceipt?.({ organizationId: 'org-1', id: 'receipt-1', currentUser })
    expect(fake.queries[0]).toBe('begin')
    expect(fake.queries[1]).toBe('select pg_advisory_xact_lock(hashtext($1))')
    expect(fake.queries).toEqual(expect.arrayContaining(['replace movements', 'update costs', 'recompute balances', 'recompute supplier', 'commit']))
    expect(fake.directQueries).toEqual([])
    expect(fake.released()).toBe(true)
  })

  it('does not repeat stock or cashbook effects when receipt is already posted', async () => {
    const fake = setup({ ...receipt, status: 'posted' })
    const result = await fake.repository.postPurchaseReceipt?.({ organizationId: 'org-1', id: 'receipt-1', currentUser })
    expect(result?.status).toBe('posted')
    expect(fake.queries).toEqual(['begin', 'select pg_advisory_xact_lock(hashtext($1))', 'rollback'])
    expect(fake.cashbookInserts()).toBe(0)
    expect(fake.released()).toBe(true)
  })

  it('rolls back cancellation when balance recompute fails', async () => {
    const fake = setup(receipt, { failBalance: true })
    await expect(fake.repository.cancelPurchaseReceipt?.({ organizationId: 'org-1', id: 'receipt-1' })).rejects.toThrow('balance failed')
    expect(fake.queries).toContain('delete movements')
    expect(fake.queries.at(-1)).toBe('rollback')
    expect(fake.released()).toBe(true)
  })

  it('rejects supplier allocation above payable before cashbook mutation', async () => {
    const fake = setup({ ...receipt, status: 'posted', remaining_amount: 40 })
    await expect(fake.repository.paySupplier?.({ organizationId: 'org-1', supplierId: 'supplier-1', currentUser, paymentMethod: 'cash', allocations: [{ purchase_receipt_id: 'receipt-1', amount: 50 }] })).rejects.toThrow('Số tiền phân bổ vượt số còn phải trả của PN000001.')
    expect(fake.cashbookInserts()).toBe(0)
    expect(fake.queries.at(-1)).toBe('rollback')
    expect(fake.released()).toBe(true)
  })
})
