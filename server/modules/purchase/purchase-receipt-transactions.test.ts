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

function setup(inputReceipt: PurchaseReceiptData = receipt, options: { failBalance?: boolean; operation?: { payload_hash: string; response: { supplier_payment_id: string; code: string; amount: number; cashbook_voucher_id: string } } } = {}) {
  const queries: string[] = []
  const directQueries: string[] = []
  let released = false
  let cashbookInserts = 0
  let cashbookCancellations = 0
  let movementReversals = 0
  const client = {
    async query(text: string) {
      queries.push(text.trim())
      if (text.includes('select payload_hash, response from supplier_payment_operations')) {
        return { rows: options.operation ? [options.operation] : [] }
      }
      return { rows: [] }
    },
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
    reverseMovements: async (transactionPool) => { movementReversals += 1; await transactionPool.query('reverse movements'); return new Set(['product-1']) },
    cancelSupplierPaymentCashbook: async (transactionPool) => { cashbookCancellations += 1; await transactionPool.query('cancel supplier payment cashbook') },
  })
  return { repository, queries, directQueries, released: () => released, cashbookInserts: () => cashbookInserts, cashbookCancellations: () => cashbookCancellations, movementReversals: () => movementReversals }
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
    const fake = setup({ ...receipt, status: 'posted' }, { failBalance: true })
    await expect(fake.repository.cancelPurchaseReceipt?.({ organizationId: 'org-1', id: 'receipt-1' })).rejects.toThrow('balance failed')
    expect(fake.queries).toContain('cancel supplier payment cashbook')
    expect(fake.queries).toContain('reverse movements')
    expect(fake.queries.at(-1)).toBe('rollback')
    expect(fake.released()).toBe(true)
  })

  it('cancels paid receipt cashbook and appends stock reversal on one client', async () => {
    const fake = setup({ ...receipt, status: 'posted', paid_amount: 100, remaining_amount: 0, supplier_payments: [{ id: 'payment-1', status: 'posted', amount: 100 }] as never })
    const cancelled = await fake.repository.cancelPurchaseReceipt?.({ organizationId: 'org-1', id: 'receipt-1' })
    expect(cancelled).toMatchObject({ status: 'cancelled', paid_amount: 0, remaining_amount: 0 })
    expect(fake.cashbookCancellations()).toBe(1)
    expect(fake.movementReversals()).toBe(1)
    expect(fake.queries).toEqual(expect.arrayContaining(['cancel supplier payment cashbook', 'reverse movements', 'recompute balances', 'recompute supplier', 'commit']))
    expect(fake.directQueries).toEqual([])
  })

  it('rejects supplier allocation above payable before cashbook mutation', async () => {
    const fake = setup({ ...receipt, status: 'posted', remaining_amount: 40 })
    await expect(fake.repository.paySupplier?.({ organizationId: 'org-1', supplierId: 'supplier-1', operationId: '11111111-1111-4111-8111-111111111111', currentUser, paymentMethod: 'cash', allocations: [{ purchase_receipt_id: 'receipt-1', amount: 50 }] })).rejects.toThrow('Số tiền phân bổ vượt số còn phải trả của PN000001.')
    expect(fake.cashbookInserts()).toBe(0)
    expect(fake.queries.at(-1)).toBe('rollback')
    expect(fake.released()).toBe(true)
  })

  it('replays an identical supplier payment operation without another cashbook mutation', async () => {
    const result = { supplier_payment_id: 'payment-1', code: 'PCPN000001', amount: 40, cashbook_voucher_id: 'cashbook-1' }
    const fake = setup({ ...receipt, status: 'posted', remaining_amount: 40 }, {
      operation: { payload_hash: '786c5e9c45de84db1165c7aa4eb4bca68fa313d18db55cba28b758ee54d2ffd6', response: result },
    })
    const replay = await fake.repository.paySupplier?.({ organizationId: 'org-1', supplierId: 'supplier-1', operationId: '11111111-1111-4111-8111-111111111111', currentUser, paymentMethod: 'cash', allocations: [{ purchase_receipt_id: 'receipt-1', amount: 40 }] })
    expect(replay).toEqual(result)
    expect(fake.cashbookInserts()).toBe(0)
    expect(fake.queries.at(-1)).toBe('rollback')
  })

  it('rejects changed payload for an already used supplier payment operation', async () => {
    const fake = setup({ ...receipt, status: 'posted', remaining_amount: 40 }, {
      operation: { payload_hash: 'different-payload', response: { supplier_payment_id: 'payment-1', code: 'PCPN000001', amount: 40, cashbook_voucher_id: 'cashbook-1' } },
    })
    await expect(fake.repository.paySupplier?.({ organizationId: 'org-1', supplierId: 'supplier-1', operationId: '11111111-1111-4111-8111-111111111111', currentUser, paymentMethod: 'cash', allocations: [{ purchase_receipt_id: 'receipt-1', amount: 40 }] })).rejects.toThrow('Mã thao tác thanh toán đã được dùng với nội dung khác.')
    expect(fake.cashbookInserts()).toBe(0)
    expect(fake.queries.at(-1)).toBe('rollback')
  })
})
