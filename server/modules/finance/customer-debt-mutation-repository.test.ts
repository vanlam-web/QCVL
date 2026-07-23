import { describe, expect, it } from 'vitest'
import type pg from 'pg'
import { createCustomerDebtMutationRepository } from './customer-debt-mutation-repository.js'

type FakeClient = {
  queries: string[]
  released: boolean
  failUpdate: boolean
  query: (text: string) => Promise<{ rows: unknown[] }>
  release: () => void
}

function makePool(totalDebt = 0, openDebtRows: unknown[] = []) {
  const client: FakeClient = {
    queries: [],
    released: false,
    failUpdate: false,
    async query(text) {
      const normalized = text.trim()
      this.queries.push(normalized)
      if (normalized.includes('from customer_debt_entries cde')) return { rows: openDebtRows }
      if (normalized.includes('as total_debt')) return { rows: [{ total_debt: totalDebt }] }
      if (this.failUpdate && normalized.startsWith('update customer_debt_adjustments')) throw new Error('update failed')
      if (normalized.startsWith('update customer_debt_adjustments')) {
        return { rows: [{ id: 'adjustment-1', source_code: 'CN001', created_at: new Date('2026-07-23T01:00:00.000Z'), transaction_type: 'adjustment', amount_delta: 100, paid_amount: 0, remaining_amount: 100, balance_after: 100, source_file: null }] }
      }
      return { rows: [] }
    },
    release() { this.released = true },
  }
  const directQueries: string[] = []
  const pool = {
    connect: async () => client,
    query: async (text: string) => { directQueries.push(text); return { rows: [] } },
  } as unknown as pg.Pool
  return { pool, client, directQueries }
}

function makeRepository(pool: pg.Pool, entries: unknown[] = []) {
  return createCustomerDebtMutationRepository(pool, {
    ensureTables: async () => undefined,
    cashAccount: () => ({ id: 'cash-1', code: 'TM', name: 'Cash', account_type: 'cash' }),
    bankAccount: () => ({ id: 'bank-1', code: 'NH', name: 'Bank', account_type: 'bank' }),
    insertEntry: async (_pool, _organizationId, entry) => { entries.push(entry) },
  })
}

describe('customer debt transaction client', () => {
  it('writes one cashbook line per positive payment method', async () => {
    const debtRow = { debt_id: 'debt-1', remaining_debt: 100, order_id: 'order-1', order_code: 'HD000001', order_created_at: new Date('2026-07-23T01:00:00.000Z'), paid_amount: 0, total_amount: 100, customer_snapshot: { name: 'Customer', phone: null } }
    const { pool, client } = makePool(100, [debtRow])
    const entries: Array<{ amount_delta?: number; finance_account?: { account_type?: string } }> = []
    const repository = makeRepository(pool, entries)

    const result = await repository.collectCustomerDebt?.({ organizationId: 'org-1', customerId: 'customer-1', amount: 100, cashAmount: 30, bankAmount: 70, bankAccountId: 'bank-1' })

    expect(result?.allocated_amount).toBe(100)
    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => [entry.finance_account?.account_type, entry.amount_delta])).toEqual([['cash', 30], ['bank', 70]])
    expect(entries.reduce((sum, entry) => sum + Number(entry.amount_delta ?? 0), 0)).toBe(100)
    expect(client.queries.filter((query) => query.startsWith('insert into payment_receipt_methods'))).toHaveLength(2)
    expect(client.queries.at(-1)).toBe('commit')
  })
  it('rejects explicit allocation total above collected amount', async () => {
    const debtRow = { debt_id: 'debt-1', remaining_debt: 100, order_id: 'order-1', order_code: 'HD000001', paid_amount: 0, total_amount: 100, customer_snapshot: {} }
    const { pool, client } = makePool(100, [debtRow])
    const repository = makeRepository(pool)

    await expect(repository.collectCustomerDebt?.({ organizationId: 'org-1', customerId: 'customer-1', amount: 50, cashAmount: 50, bankAmount: 0, allocations: [{ order_id: 'order-1', order_code: 'HD000001', allocated_amount: 60 }] })).rejects.toThrow('Tổng phân bổ vượt số tiền thu nợ.')
    expect(client.queries.at(-1)).toBe('rollback')
    expect(client.queries.some((query) => query.startsWith('update customer_debt_entries'))).toBe(false)
  })

  it('rejects explicit allocation above the locked invoice debt', async () => {
    const debtRow = { debt_id: 'debt-1', remaining_debt: 40, order_id: 'order-1', order_code: 'HD000001', paid_amount: 60, total_amount: 100, customer_snapshot: {} }
    const { pool, client } = makePool(100, [debtRow])
    const repository = makeRepository(pool)

    await expect(repository.collectCustomerDebt?.({ organizationId: 'org-1', customerId: 'customer-1', amount: 50, cashAmount: 50, bankAmount: 0, allocations: [{ order_id: 'order-1', order_code: 'HD000001', allocated_amount: 50 }] })).rejects.toThrow('Phân bổ vượt dư nợ hóa đơn HD000001.')
    expect(client.queries.at(-1)).toBe('rollback')
    expect(client.queries.some((query) => query.startsWith('update customer_debt_entries'))).toBe(false)
  })

  it('rolls back before mutations when collection exceeds canonical debt', async () => {
    const { pool, client } = makePool(50)
    const repository = makeRepository(pool)

    await expect(repository.collectCustomerDebt?.({ organizationId: 'org-1', customerId: 'customer-1', amount: 100, cashAmount: 100, bankAmount: 0 })).rejects.toMatchObject({
      name: 'CustomerDebtOverCollectionError',
      requestedAmount: 100,
      availableDebt: 50,
    })
    expect(client.queries[0]).toBe('begin')
    expect(client.queries.at(-1)).toBe('rollback')
    expect(client.queries.some((query) => query.startsWith('insert into payment_receipts'))).toBe(false)
    expect(client.released).toBe(true)
  })

  it('commits no-op collection on one client and releases it', async () => {
    const { pool, client, directQueries } = makePool(100)
    const repository = makeRepository(pool)

    const result = await repository.collectCustomerDebt?.({ organizationId: 'org-1', customerId: 'customer-1', amount: 100, cashAmount: 100, bankAmount: 0 })

    expect(result).toEqual({ payment_receipt_id: '', allocated_amount: 0 })
    expect(client.queries[0]).toBe('begin')
    expect(client.queries.at(-1)).toBe('commit')
    expect(directQueries).toEqual([])
    expect(client.released).toBe(true)
  })

  it('commits adjustment update and releases the client', async () => {
    const { pool, client, directQueries } = makePool()
    const repository = makeRepository(pool)

    const result = await repository.updateCustomerDebtAdjustment?.({ organizationId: 'org-1', adjustmentId: 'adjustment-1', amountDelta: 100 })

    expect(result?.id).toBe('adjustment-1')
    expect(client.queries[0]).toBe('begin')
    expect(client.queries.at(-1)).toBe('commit')
    expect(directQueries).toEqual([])
    expect(client.released).toBe(true)
  })

  it('rolls back failed adjustment update and releases the client', async () => {
    const { pool, client } = makePool()
    client.failUpdate = true
    const repository = makeRepository(pool)

    await expect(repository.updateCustomerDebtAdjustment?.({ organizationId: 'org-1', adjustmentId: 'adjustment-1', amountDelta: 100 })).rejects.toThrow('update failed')
    expect(client.queries[0]).toBe('begin')
    expect(client.queries.at(-1)).toBe('rollback')
    expect(client.released).toBe(true)
  })
})
