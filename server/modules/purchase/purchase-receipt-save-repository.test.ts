import { describe, expect, it } from 'vitest'
import type pg from 'pg'
import { createPurchaseReceiptSaveRepository } from './purchase-receipt-save-repository.js'

type SaveInput = Parameters<NonNullable<import('../../http-types.js').ServerRepository['savePurchaseReceipt']>>[0]
const receipt = {
  id: 'receipt-1', code: '', supplier_id: 'supplier-1', created_at: '2026-07-23T01:00:00.000Z',
} as SaveInput['receipt']

function setup(options: { failSupplier?: boolean } = {}) {
  const queries: string[] = []
  const directQueries: string[] = []
  let released = false
  const client = {
    async query(text: string) {
      const normalized = text.trim()
      queries.push(normalized)
      if (normalized.startsWith('select id from purchase_receipt_snapshots')) return { rows: [] }
      return { rows: [] }
    },
    release() { released = true },
  }
  const pool = { connect: async () => client, query: async (text: string) => { directQueries.push(text); return { rows: [] } } } as unknown as pg.Pool
  const repository = createPurchaseReceiptSaveRepository(pool, {
    ensureSnapshots: async () => undefined,
    safeCode: async (transactionPool, _organizationId, inputReceipt) => {
      await transactionPool.query('allocate safe code')
      return { ...inputReceipt, code: 'PN000001' }
    },
    recomputeSupplier: async (transactionPool) => {
      await transactionPool.query('recompute supplier')
      if (options.failSupplier) throw new Error('supplier recompute failed')
    },
  })
  return { repository, queries, directQueries, released: () => released }
}

describe('purchase receipt draft save transaction client', () => {
  it('locks, allocates code, inserts and recomputes supplier on one client', async () => {
    const fake = setup()
    const result = await fake.repository.savePurchaseReceipt?.({ organizationId: 'org-1', receipt, sourceType: 'manual' })
    expect(result?.code).toBe('PN000001')
    expect(fake.queries[0]).toBe('begin')
    expect(fake.queries).toEqual(expect.arrayContaining(['allocate safe code', 'recompute supplier', 'commit']))
    expect(fake.queries.some((query) => query.startsWith('insert into purchase_receipt_snapshots'))).toBe(true)
    expect(fake.directQueries).toEqual([])
    expect(fake.released()).toBe(true)
  })

  it('rolls back draft insert when supplier recompute fails', async () => {
    const fake = setup({ failSupplier: true })
    await expect(fake.repository.savePurchaseReceipt?.({ organizationId: 'org-1', receipt, sourceType: 'manual' })).rejects.toThrow('supplier recompute failed')
    expect(fake.queries.at(-1)).toBe('rollback')
    expect(fake.released()).toBe(true)
  })
})
