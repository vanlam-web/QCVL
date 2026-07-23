import { describe, expect, it } from 'vitest'
import type pg from 'pg'
import { createSalesSaveRepository } from './sales-save-repository.js'

type SaveInput = Parameters<NonNullable<import('../../http-types.js').ServerRepository['saveSalesDocument']>>[0]
type ReviseInput = Parameters<NonNullable<import('../../http-types.js').ServerRepository['reviseSalesDocument']>>[0]

type FakeClient = {
  queries: string[]
  released: boolean
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>
  release: () => void
}

function makeFakePool() {
  const client: FakeClient = {
    queries: [],
    released: false,
    async query(text) {
      this.queries.push(text.trim())
      if (text.includes('from orders')) return { rows: [{ id: 'original-id', code: 'HD000001', base_code: 'HD000001' }] }
      if (text.includes('max(revision_no)')) return { rows: [{ max_revision: 0 }] }
      return { rows: [] }
    },
    release() {
      this.released = true
    },
  }
  const pool = { client, connect: async () => client } as unknown as pg.Pool
  return { pool, client }
}

const checkoutInput = {
  organizationId: 'org-1',
  document: { id: 'order-1', code: 'HD000001', order_type: 'invoice', status: 'completed', created_at: '2026-07-23T01:00:00.000Z', customer: { id: 'customer-1', code: 'KH000001', name: 'Customer', phone: null }, seller: { id: 'user-1', name: 'Seller' }, subtotal_amount: 100, discount_amount: 0, total_amount: 100, paid_amount: 100, debt_amount: 0, payment_status: 'paid', note: null, items: [] },
  cashbookEntries: [],
} as unknown as SaveInput
const revisionInput = {
  organizationId: 'org-1',
  originalOrderId: 'original-id',
  originalOrderCode: 'HD000001',
  document: { id: 'revision-1', code: 'HD000001.01', order_type: 'invoice', status: 'completed', created_at: '2026-07-23T01:00:00.000Z', customer: { id: 'customer-1', code: 'KH000001', name: 'Customer', phone: null }, seller: { id: 'user-1', name: 'Seller' }, subtotal_amount: 100, discount_amount: 0, total_amount: 100, paid_amount: 100, debt_amount: 0, payment_status: 'paid', note: null, items: [], base_code: 'HD000001', revision_no: 1 },
  cashbookEntries: [],
  reason: { code: 'correction', note: null },
} as unknown as ReviseInput

describe('sales save transaction', () => {
  it('uses one checked-out client and releases it after commit', async () => {
    const { pool, client } = makeFakePool()
    const seenPools: pg.Pool[] = []
    const repository = createSalesSaveRepository(pool, {
      ensureTables: async () => undefined,
      ensureMovements: async () => undefined,
      insertDocument: async (transactionPool) => { seenPools.push(transactionPool); await transactionPool.query('insert document') },
      insertEntry: async (transactionPool) => { seenPools.push(transactionPool); await transactionPool.query('insert entry') },
      saveMovements: async (transactionPool) => { seenPools.push(transactionPool); await transactionPool.query('insert movement') },
      loadDocument: () => undefined,
    })

    await repository.saveSalesDocument?.(checkoutInput)

    expect(seenPools).toHaveLength(2)
    expect(seenPools[0]).toBe(seenPools[1])
    expect(client.queries).toEqual(['begin', 'insert document', 'insert movement', 'commit'])
    expect(client.released).toBe(true)
  })

  it('rolls back and releases client when save fails', async () => {
    const { pool, client } = makeFakePool()
    const repository = createSalesSaveRepository(pool, {
      ensureTables: async () => undefined,
      ensureMovements: async () => undefined,
      insertDocument: async (transactionPool) => { await transactionPool.query('insert document') },
      insertEntry: async () => undefined,
      saveMovements: async () => { throw new Error('movement failed') },
      loadDocument: () => undefined,
    })

    await expect(repository.saveSalesDocument?.(checkoutInput)).rejects.toThrow('movement failed')
    expect(client.queries).toEqual(['begin', 'insert document', 'rollback'])
    expect(client.released).toBe(true)
  })

  it('locks original revision row and uses one client', async () => {
    const { pool, client } = makeFakePool()
    const repository = createSalesSaveRepository(pool, {
      ensureTables: async () => undefined,
      ensureMovements: async () => undefined,
      insertDocument: async (transactionPool) => { await transactionPool.query('insert revised document') },
      insertEntry: async () => undefined,
      saveMovements: async () => undefined,
      loadDocument: () => undefined,
    })

    await repository.reviseSalesDocument?.(revisionInput)

    expect(client.queries[0]).toBe('begin')
    expect(client.queries.some((query) => query.includes('for update'))).toBe(true)
    expect(client.queries.at(-1)).toBe('commit')
    expect(client.released).toBe(true)
  })
})
