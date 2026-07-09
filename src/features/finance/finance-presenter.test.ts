import { describe, expect, it } from 'vitest'
import {
  accountTypeText,
  bankAccountDisplayText,
  cashbookDetailPrimaryStatusText,
  cashbookDetailPrimaryStatusTone,
  cashbookLinkedDocumentCode,
  cashbookLinkedDocumentMessage,
  cashbookLinkedDocumentRows,
  financeDateText,
  financeAccountChoiceLabel,
  paymentMethodText,
  sourceTypeText,
  statusText,
} from './finance-presenter'
import type { CashbookEntryDetail, FinanceAccount } from './types'

const bankAccount = {
  id: 'bank-1',
  code: 'VCB',
  name: 'Vietcombank',
  account_type: 'bank',
  is_default_cash: false,
  is_active: true,
  account_number: '123456',
  account_holder: 'CONG TY QC',
} satisfies FinanceAccount

const receiptEntry = {
  id: 'entry-1',
  code: 'PT0001',
  status: 'posted',
  direction: 'in',
  amount_delta: 300000,
  finance_account: { id: 'bank-1', code: 'VCB', name: 'Vietcombank', account_type: 'bank' },
  is_business_accounted: true,
  source_type: 'payment_receipt_method',
  created_at: '2026-07-09T03:00:00Z',
  note: 'Checkout HD0001',
  counterparty: { type: 'customer', name: 'Khach 1', phone: null },
  created_by: { id: 'user-1', name: 'Admin' },
  payment_method: 'bank_transfer',
  source: { type: 'payment_receipt', id: 'receipt-1', code: 'PT0001', order_code: 'HD0001' },
  allocations: [
    {
      order_id: 'order-1',
      order_code: 'HD0001',
      order_total_amount: 600000,
      collected_before: 0,
      allocated_amount: 300000,
      remaining_after: 300000,
    },
  ],
} satisfies CashbookEntryDetail

describe('finance presenter', () => {
  it('maps finance account labels', () => {
    expect(accountTypeText('cash')).toBe('Tiền mặt')
    expect(accountTypeText('bank')).toBe('Ngân hàng')
    expect(financeAccountChoiceLabel(bankAccount)).toBe('VCB · Vietcombank')
    expect(bankAccountDisplayText(bankAccount)).toBe('VCB - 123456 - CONG TY QC')
  })

  it('maps cashbook status and source labels', () => {
    expect(statusText('posted')).toBe('Đã ghi')
    expect(statusText('cancelled')).toBe('Đã hủy')
    expect(paymentMethodText('bank_transfer')).toBe('Ngân hàng')
    expect(sourceTypeText('payment_receipt_method')).toBe('Phiếu thu')
    expect(financeDateText('bad-date')).toBe('Chưa có')
  })

  it('builds linked document display rows from allocations', () => {
    expect(cashbookLinkedDocumentCode(receiptEntry)).toBe('HD0001')
    expect(cashbookLinkedDocumentMessage(receiptEntry)).toBe('Phiếu thu tự động được gắn với hóa đơn HD0001.')
    expect(cashbookDetailPrimaryStatusText(receiptEntry)).toBe('Thanh toán 1 phần')
    expect(cashbookDetailPrimaryStatusTone(receiptEntry)).toBe('warning')
    expect(cashbookLinkedDocumentRows(receiptEntry)).toEqual([
      {
        id: 'order-1',
        code: 'HD0001',
        totalAmount: 600000,
        settledBefore: 0,
        allocatedAmount: 300000,
        remainingAmount: 300000,
        status: 'Thanh toán 1 phần',
      },
    ])
  })
})
