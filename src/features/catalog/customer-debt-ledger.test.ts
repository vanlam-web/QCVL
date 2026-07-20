import { describe, expect, it } from 'vitest'
import type { CashbookEntry } from '../finance/types'
import { buildCustomerDebtLedgerRows } from './customer-debt-ledger'

const financeAccount = {
  id: 'bank-1',
  code: '0947900909',
  name: 'Ngan hang',
  account_type: 'bank' as const,
}

function kvCashbook(code: string): CashbookEntry {
  return {
    id: `entry-${code}`,
    code,
    status: 'posted',
    direction: 'in',
    amount_delta: 100000,
    finance_account: financeAccount,
    is_business_accounted: true,
    source_type: 'kiotviet_cashbook',
    created_at: '2025-12-04T04:10:00.000Z',
    note: 'Khach tra no',
    counterparty: { type: 'customer', name: 'KL2', phone: null },
    source: { type: 'payment_receipt', id: code, code, order_code: null, counterparty_code: 'KH000384' },
  }
}

describe('customer debt ledger', () => {
  it('includes KiotViet customer-debt receipts beyond TT/TTHD codes', () => {
    const rows = buildCustomerDebtLedgerRows(
      [{
        id: 'order-1',
        code: 'HD007698.01',
        created_at: '2025-12-04T03:00:00.000Z',
        total_amount: 500000,
        status: 'completed',
      }],
      [
        kvCashbook('TNHHD000006'),
        kvCashbook('TTMHD000007'),
        kvCashbook('TTM000008'),
        kvCashbook('TNH000009'),
      ],
      [],
    )

    expect(rows.map((row) => row.code)).toContain('TNHHD000006')
    expect(rows.map((row) => row.code)).toContain('TTMHD000007')
    expect(rows.map((row) => row.code)).toContain('TTM000008')
    expect(rows.map((row) => row.code)).not.toContain('TNH000009')
  })

  it('includes KiotViet CB adjustment slips in customer debt history', () => {
    const rows = buildCustomerDebtLedgerRows(
      [{
        id: 'order-1',
        code: 'HD007698.01',
        created_at: '2025-12-04T03:00:00.000Z',
        total_amount: 500000,
        status: 'completed',
      }],
      [
        {
          ...kvCashbook('CB000033'),
          direction: 'out',
          amount_delta: 250000,
          note: 'Dieu chinh cong no',
        },
      ],
      [],
    )

    expect(rows.map((row) => row.code)).toContain('CB000033')
    expect(rows.find((row) => row.code === 'CB000033')?.type).toBe('Điều chỉnh')
  })

  it('shows same-invoice payments above the debt invoice row', () => {
    const rows = buildCustomerDebtLedgerRows(
      [{
        id: 'order-1',
        code: 'HD011150',
        created_at: '2025-12-04T04:10:05.000Z',
        total_amount: 100000,
        status: 'completed',
      }],
      [kvCashbook('TTHD011150')],
      [],
    )

    expect(rows.map((row) => row.code)).toEqual(['TTHD011150', 'HD011150'])
    expect(rows[0].running_debt).toBe(0)
    expect(rows[1].running_debt).toBe(100000)
  })
})
