import { describe, expect, it } from 'vitest'
import type { CashbookEntry } from '../finance/types'
import { buildCustomerDebtLedgerRows, customerDebtLedgerRowsFromBackend } from './customer-debt-ledger'

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
  it('uses backend ledger rows with backend running balances', () => {
    const rows = customerDebtLedgerRowsFromBackend({
      ledger_rows: [
        {
          id: 'order-hd000001',
          code: 'HD000001',
          created_at: '2026-07-01T01:00:00.000Z',
          amount_delta: 100000,
          balance_after: 100000,
          source_type: 'invoice',
          source_id: 'order-hd000001',
        },
        {
          id: 'cashbook-tt000001',
          code: 'TT000001',
          created_at: '2026-07-02T01:00:00.000Z',
          amount_delta: -40000,
          balance_after: 60000,
          source_type: 'payment',
          source_id: 'cashbook-tt000001',
        },
        {
          id: 'adjustment-cb000001',
          code: 'CB000001',
          created_at: '2026-07-03T01:00:00.000Z',
          amount_delta: -5000,
          balance_after: 55000,
          source_type: 'adjustment',
          source_id: 'adjustment-cb000001',
        },
      ],
    })

    expect(rows.map((row) => [row.code, row.value_delta, row.running_debt])).toEqual([
      ['CB000001', -5000, 55000],
      ['TT000001', -40000, 60000],
      ['HD000001', 100000, 100000],
    ])
  })

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

  it('sorts ledger rows by real datetime when ISO and KV datetime strings are mixed', () => {
    const rows = buildCustomerDebtLedgerRows(
      [
        {
          id: 'order-old',
          code: 'HD011163',
          created_at: '14/07/2026 14:18',
          total_amount: 209300,
          status: 'completed',
        },
        {
          id: 'order-new',
          code: 'HD011167',
          created_at: '2026-07-14T15:25:00.000Z',
          total_amount: 1258530,
          status: 'completed',
        },
      ],
      [],
      [],
    )

    expect(rows.map((row) => row.code)).toEqual(['HD011167', 'HD011163'])
  })

  it('does not create a synthetic reconciliation row when the API total differs', () => {
    const rows = buildCustomerDebtLedgerRows(
      [{
        id: 'order-1',
        code: 'HD011150',
        created_at: '2026-07-01T03:00:00.000Z',
        total_amount: 100000,
        status: 'completed',
      }],
      [kvCashbook('TTHD011150')],
      [{
        id: 'adjustment-1',
        source_code: 'CB000001',
        created_at: '2026-07-02T03:00:00.000Z',
        transaction_type: 'Điều chỉnh',
        amount_delta: 400000,
        paid_amount: 0,
        remaining_amount: 400000,
        balance_after: 400000,
        source_file: null,
      }],
      [],
      { currentTotal: 350000 },
    )

    expect(rows.map((row) => row.code)).not.toContain('Đối soát công nợ')
    expect(rows[0]).toEqual(expect.objectContaining({
      code: 'CB000001',
      running_debt: 400000,
    }))
  })

  it('does not show linked supplier receipts as customer debt payments', () => {
    const rows = buildCustomerDebtLedgerRows(
      [{
        id: 'order-1',
        code: 'HD011163',
        created_at: '2026-07-14T14:18:00.000Z',
        total_amount: 1000000,
        status: 'completed',
      }],
      [],
      [],
      [{
        id: 'receipt-1',
        code: 'PN000566',
        created_at: '2026-07-15T09:14:00.000Z',
        supplier_id: 'supplier-ut',
        supplier_code: 'NCC000035',
        supplier_name: 'Ut Teo',
        payable_amount: 400000,
        paid_amount: 0,
        remaining_amount: 400000,
      }],
    )

    expect(rows.map((row) => row.code)).toEqual(['HD011163'])
    expect(rows[0].running_debt).toBe(1000000)
  })
})
