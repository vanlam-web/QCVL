import { describe, expect, it } from 'vitest'
import {
  accountTypeText,
  bankAccountDisplayParts,
  bankAccountDisplayText,
  bankAccountTriggerText,
  cashbookDetailPrimaryStatusText,
  cashbookDetailPrimaryStatusTone,
  cashbookDetailPaymentMethodText,
  cashbookLinkedDocumentCode,
  cashbookLinkedDocumentMessage,
  cashbookLinkedDocumentRows,
  financeDateText,
  financeAccountChoiceLabel,
  isDeletedFinanceAccount,
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
  finance_account: { id: 'bank-1', code: '0947900909', name: 'MBBank', account_type: 'bank', account_number: '0947900909', account_holder: 'VAN VIET PHUONG LAM' },
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
    expect(bankAccountDisplayText(bankAccount)).toBe('123456 - Vietcombank - CONG TY QC')
    expect(bankAccountTriggerText(bankAccount)).toBe('123456')
    expect(bankAccountDisplayParts(bankAccount)).toEqual({
      primary: '123456',
      secondary: 'Vietcombank',
      tertiary: 'CONG TY QC',
    })
    expect(bankAccountDisplayText({
      ...bankAccount,
      code: '0947900909',
      name: 'van viet phuong lam',
      account_number: '0947900909',
      account_holder: 'van viet phuong lam',
    })).toBe('0947900909 - van viet phuong lam')
    expect(isDeletedFinanceAccount({ ...bankAccount, account_number: '123456{DEL}' })).toBe(true)
  })

  it('maps cashbook status and source labels', () => {
    expect(statusText('posted')).toBe('Đã ghi')
    expect(statusText('cancelled')).toBe('Đã hủy')
    expect(paymentMethodText('bank_transfer')).toBe('Ngân hàng')
    expect(sourceTypeText('payment_receipt_method')).toBe('Phiếu thu')
    expect(sourceTypeText('kiotviet_cashbook')).toBe('Sổ quỹ KV')
    expect(financeDateText('bad-date')).toBe('Chưa có')
    expect(financeDateText('2026-07-09T03:00:00Z')).toBe('09/07/2026 03:00')
  })

  it('shows the concrete bank and account number for bank cashbook payment method', () => {
    expect(cashbookDetailPaymentMethodText(receiptEntry)).toBe('MBBank: 0947900909')
    expect(cashbookDetailPaymentMethodText({ ...receiptEntry, payment_method: 'cash', finance_account: { ...receiptEntry.finance_account, account_type: 'cash' } })).toBe('Tiền mặt')
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

  it('infers linked KiotViet invoice and purchase receipt codes from cashbook voucher codes', () => {
    const importedInvoiceReceipt = {
      ...receiptEntry,
      id: 'entry-kv-tthd',
      code: 'TTHD011149',
      source_type: 'kiotviet_cashbook',
      note: 'Phiếu thu Tiền khách trả',
      source: { type: 'payment_receipt', id: 'TTHD011149', code: 'TTHD011149', order_code: null },
      allocations: [],
    } satisfies CashbookEntryDetail
    const importedSupplierPayment = {
      ...receiptEntry,
      id: 'entry-kv-pcpn',
      code: 'PCPN000679',
      direction: 'out',
      amount_delta: -6899000,
      source_type: 'kiotviet_cashbook',
      note: 'Phiếu chi Tiền trả nhà cung cấp',
      source: { type: 'manual_voucher', id: 'PCPN000679', code: 'PCPN000679', order_code: null },
      allocations: [],
    } satisfies CashbookEntryDetail

    expect(cashbookLinkedDocumentCode(importedInvoiceReceipt)).toBe('HD011149')
    expect(cashbookLinkedDocumentRows(importedInvoiceReceipt)[0]?.code).toBe('HD011149')
    expect(cashbookLinkedDocumentCode(importedSupplierPayment)).toBe('PN000679')
    expect(cashbookLinkedDocumentRows(importedSupplierPayment)[0]?.code).toBe('PN000679')
  })
})
