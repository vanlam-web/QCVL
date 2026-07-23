import { describe, expect, it } from 'vitest'
import type pg from 'pg'
import { createSalesMutationRepository } from './sales-mutation-repository.js'

function makePool(options: { order?: { id: string; code: string; status: string }; fail?: 'payment' | 'debt' } = {}) {
  const queries: string[] = []; let released = false
  const client = { async query(text: string) { const normalized = text.trim(); queries.push(normalized); if (options.fail === 'payment' && normalized === 'cancel payment cashbook') throw new Error('payment cancellation failed'); if (options.fail === 'debt' && normalized.startsWith('update customer_debt_entries')) throw new Error('debt close failed'); if (normalized.startsWith('select id, code, status from orders')) return { rows: options.order ? [options.order] : [] }; return { rows: [] } }, release() { released = true } }
  const directQueries: string[] = []; const pool = { connect: async () => client, query: async (text: string) => { directQueries.push(text); return { rows: [] } } } as unknown as pg.Pool
  return { pool, queries, directQueries, released: () => released }
}
function repository(pool: pg.Pool, calls: string[]) { return createSalesMutationRepository(pool, { ensureTables: async () => undefined, ensureMovements: async () => undefined, loadDocument: async ({ id }) => ({ id, code: 'HD000001' }) as never, receiptBaseCode: () => null, missingGuard: () => false, cancelPaymentCashbook: async (tx) => { calls.push('payment'); await tx.query('cancel payment cashbook') }, reverseMovements: async (tx) => { calls.push('stock'); await tx.query('reverse stock movements'); return new Set(['product-1']) }, recomputeBalances: async (tx) => { calls.push('balance'); await tx.query('recompute balances') } }) }
const input = { organizationId: 'org-1', id: 'order-1', reason: { code: 'wrong_price', note: null } }
describe('sales cancellation transaction client', () => {
  it('reverses payment and stock before cancelling invoice on one checked-out client', async () => { const fake = makePool({ order: { id: 'order-1', code: 'HD000001', status: 'completed' } }); const calls: string[] = []; await repository(fake.pool, calls).cancelSalesDocument?.(input); expect(calls).toEqual(['payment', 'stock', 'balance']); expect(fake.queries[0]).toBe('begin'); expect(fake.queries.at(-1)).toBe('commit'); expect(fake.directQueries).toEqual([]); expect(fake.released()).toBe(true) })
  it('replays an already cancelled invoice without reversal', async () => { const fake = makePool({ order: { id: 'order-1', code: 'HD000001', status: 'cancelled' } }); const calls: string[] = []; await repository(fake.pool, calls).cancelSalesDocument?.(input); expect(calls).toEqual([]); expect(fake.queries.at(-1)).toBe('rollback') })
  it('rolls back all effects when linked payment cancellation fails', async () => { const fake = makePool({ order: { id: 'order-1', code: 'HD000001', status: 'completed' }, fail: 'payment' }); const calls: string[] = []; await expect(repository(fake.pool, calls).cancelSalesDocument?.(input)).rejects.toThrow('payment cancellation failed'); expect(fake.queries.at(-1)).toBe('rollback'); expect(fake.released()).toBe(true) })
})