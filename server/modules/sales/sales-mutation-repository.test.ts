import { describe, expect, it } from 'vitest'
import type pg from 'pg'
import { createSalesMutationRepository } from './sales-mutation-repository.js'

function makePool(options: { orderId?: string; failDebt?: boolean } = {}) {
  const queries: string[] = []
  let released = false
  const client = {
    async query(text: string) {
      const normalized = text.trim()
      queries.push(normalized)
      if (options.failDebt && normalized.startsWith('update customer_debt_entries')) throw new Error('debt close failed')
      if (normalized.startsWith('update orders')) return { rows: options.orderId ? [{ id: options.orderId }] : [] }
      return { rows: [] }
    },
    release() { released = true },
  }
  const directQueries: string[] = []
  const pool = {
    connect: async () => client,
    query: async (text: string) => { directQueries.push(text); return { rows: [] } },
  } as unknown as pg.Pool
  return { pool, queries, directQueries, released: () => released }
}

function repository(pool: pg.Pool) {
  return createSalesMutationRepository(pool, {
    ensureTables: async () => undefined,
    loadDocument: async ({ id }) => ({ id, code: 'HD000001' }) as never,
    receiptBaseCode: () => null,
    missingGuard: () => false,
  })
}

describe('sales cancellation transaction client', () => {
  it('commits order cancellation and debt close on one checked-out client', async () => {
    const fake = makePool({ orderId: 'order-1' })

    await repository(fake.pool).cancelSalesDocument?.({ organizationId: 'org-1', id: 'order-1' })

    expect(fake.queries[0]).toBe('begin')
    expect(fake.queries.some((query) => query.startsWith('update orders'))).toBe(true)
    expect(fake.queries.some((query) => query.startsWith('update customer_debt_entries'))).toBe(true)
    expect(fake.queries.at(-1)).toBe('commit')
    expect(fake.directQueries).toEqual([])
    expect(fake.released()).toBe(true)
  })

  it('rolls back and releases when order is already cancelled or missing', async () => {
    const fake = makePool()

    await repository(fake.pool).cancelSalesDocument?.({ organizationId: 'org-1', id: 'order-1' })

    expect(fake.queries.at(-1)).toBe('rollback')
    expect(fake.released()).toBe(true)
  })

  it('rolls back and releases when debt close fails', async () => {
    const fake = makePool({ orderId: 'order-1', failDebt: true })

    await expect(repository(fake.pool).cancelSalesDocument?.({ organizationId: 'org-1', id: 'order-1' })).rejects.toThrow('debt close failed')
    expect(fake.queries.at(-1)).toBe('rollback')
    expect(fake.released()).toBe(true)
  })
})
