import { describe, expect, test } from 'vitest'
import { rebuildKiotVietCashbookAllocations } from './kiotviet-cashbook-allocation.js'

const receipt = (overrides = {}) => ({
  id: 'receipt-690', code: 'PN000690', received_at: '2026-07-15T02:24:00.000Z',
  status: 'posted', payable_amount: 2040000, paid_amount: 0, remaining_amount: 2040000,
  supplier: { id: 'supplier-26', code: 'NCC000026', name: 'Chị giao' },
  ...overrides,
})
const shiftedRow = {
  id: 'cashbook-686', source_code: 'PCPN000686', entry_time: '2026-07-15T02:24:43.337Z',
  direction: 'out' as const, amount_delta: -2040000, status: 'posted',
  counterparty_code: 'NCC000026', counterparty_name: 'Chị giao', category_name: 'Tiền trả NCC',
}

describe('KiotViet shifted PCPN allocation', () => {
  test('allocates unique supplier, amount, and time match when suffix receipt unavailable', () => {
    const result = rebuildKiotVietCashbookAllocations({ invoices: [], receipts: [receipt()], cashbookRows: [shiftedRow] })
    expect(result.cashbookAllocations[0]).toMatchObject({ order_code: 'PN000690', allocations: [{ order_id: 'receipt-690', allocated_amount: 2040000 }] })
    expect(result.receipts[0]).toMatchObject({ paid_amount: 2040000, remaining_amount: 0 })
  })
  test('does not allocate ambiguous shifted PCPN candidates', () => {
    const result = rebuildKiotVietCashbookAllocations({ invoices: [], receipts: [receipt(), receipt({ id: 'receipt-other', code: 'PN000691' })], cashbookRows: [shiftedRow] })
    expect(result.cashbookAllocations[0]?.allocations).toEqual([])
    expect(result.receipts.map((item) => item.paid_amount)).toEqual([0, 0])
  })
})
