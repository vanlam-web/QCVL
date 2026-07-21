import { describe, expect, it } from 'vitest'
import { allocateOldestFirst, buildPartnerDebtLedger, debtDeltaForVoucher } from './partner-debt-ledger.js'

describe('partner debt sign rules', () => {
  it.each([
    ['HD011293', 'customer', false, 107352],
    ['HDO000001', 'customer', false, 107352],
    ['TT001869', 'customer', false, -3000000],
    ['TTHD011293', 'customer', false, -107352],
    ['TTHDO000001', 'customer', false, -107352],
    ['TTM000001', 'customer', false, -500000],
    ['TTMHD011293', 'customer', false, -107352],
    ['TNH000001', 'customer', false, -500000],
    ['TNHHD011293', 'customer', false, -107352],
    ['CKKH000228', 'customer', false, -15100],
    ['CB000033', 'customer', false, 179396],
    ['PN000566', 'customer', false, 0],
    ['PCPN000566', 'customer', false, 0],
    ['PN000566', 'supplier', false, 3206581],
    ['PCPN000566', 'supplier', false, -3206581],
  ])('maps %s for pure %s', (code, view, linked, expected) => {
    expect(debtDeltaForVoucher({
      code,
      view: view as 'customer' | 'supplier',
      linked,
      sourceAmount: Math.abs(expected),
      normalizedAmountDelta: expected,
    })).toBe(expected)
  })

  it('inverts linked customer-supplier signs per view', () => {
    expect(debtDeltaForVoucher({ code: 'HD011293', view: 'customer', linked: true, sourceAmount: 107352 })).toBe(107352)
    expect(debtDeltaForVoucher({ code: 'HD011293', view: 'supplier', linked: true, sourceAmount: 107352 })).toBe(-107352)
    expect(debtDeltaForVoucher({ code: 'PN000566', view: 'customer', linked: true, sourceAmount: 3206581 })).toBe(-3206581)
    expect(debtDeltaForVoucher({ code: 'PN000566', view: 'supplier', linked: true, sourceAmount: 3206581 })).toBe(3206581)
    expect(debtDeltaForVoucher({ code: 'CB000033', view: 'customer', linked: true, normalizedAmountDelta: 179396 })).toBe(179396)
    expect(debtDeltaForVoucher({ code: 'CB000033', view: 'supplier', linked: true, normalizedAmountDelta: 179396 })).toBe(-179396)
  })
})

describe('partner debt ledger builder', () => {
  it('builds pure customer total and running rows from documents', () => {
    const ledger = buildPartnerDebtLedger({
      view: 'customer',
      linked: false,
      documents: [
        { id: 'hd1', code: 'HD000001', time: '2026-07-01T01:00:00.000Z', amount: 100000, status: 'posted' },
        { id: 'tt1', code: 'TT000001', time: '2026-07-02T01:00:00.000Z', amount: 40000, status: 'posted' },
        { id: 'ck1', code: 'CKKH000001', time: '2026-07-03T01:00:00.000Z', amount: 10000, status: 'posted' },
        { id: 'cb1', code: 'CB000001', time: '2026-07-04T01:00:00.000Z', amount: 5000, normalizedAmountDelta: 5000, status: 'posted' },
      ],
    })
    expect(ledger.totalDebt).toBe(55000)
    expect(ledger.rows.map((row) => [row.code, row.amountDelta, row.balanceAfter])).toEqual([
      ['HD000001', 100000, 100000],
      ['TT000001', -40000, 60000],
      ['CKKH000001', -10000, 50000],
      ['CB000001', 5000, 55000],
    ])
  })

  it('skips cancelled and replaced documents', () => {
    const ledger = buildPartnerDebtLedger({
      view: 'customer',
      linked: false,
      documents: [
        { id: 'hd1', code: 'HD000001', time: '2026-07-01T01:00:00.000Z', amount: 100000, status: 'cancelled' },
        { id: 'hd2', code: 'HD000002', time: '2026-07-02T01:00:00.000Z', amount: 70000, status: 'posted' },
        { id: 'hd3', code: 'HD000003', time: '2026-07-03T01:00:00.000Z', amount: 90000, status: 'replaced' },
      ],
    })
    expect(ledger.totalDebt).toBe(70000)
    expect(ledger.rows).toHaveLength(1)
  })
})

describe('partner debt allocation', () => {
  it('allocates payment to oldest open documents first', () => {
    expect(allocateOldestFirst({
      amount: 120000,
      documents: [
        { id: 'new', code: 'HD000002', time: '2026-07-02T00:00:00.000Z', remainingAmount: 50000 },
        { id: 'old', code: 'HD000001', time: '2026-07-01T00:00:00.000Z', remainingAmount: 100000 },
      ],
    })).toEqual([
      { documentId: 'old', documentCode: 'HD000001', allocatedAmount: 100000, remainingAfter: 0 },
      { documentId: 'new', documentCode: 'HD000002', allocatedAmount: 20000, remainingAfter: 30000 },
    ])
  })
})
