import { describe, expect, it } from 'vitest'
import {
  documentTypeFilterLabel,
  lifecycleFilterLabel,
  paymentMethodFilterLabel,
  paymentReceiptMethodLabel,
  paymentReceiptMethodTotal,
  paymentReceiptStatusLabel,
  salesDocumentDateTimeText,
  salesDocumentCreatedDateTimeText,
  salesDocumentLineSellPrice,
  salesDocumentListSummary,
  salesDocumentMeasureText,
  salesDocumentMoneyText,
  paymentStatusFilterLabel,
  salesDocumentQuoteLineDimensionText,
  salesDocumentPaymentSettlementStatus,
  salesDocumentStatusLabel,
  salesDocumentStatusTone,
} from './sales-document-presenter'
import type { SalesDocumentDetail } from './types'

const invoice = {
  id: 'order-1',
  code: 'HD0001',
  order_type: 'invoice',
  status: 'completed',
  created_at: '2026-07-09T03:00:00Z',
  customer: { id: 'customer-1', code: 'KH001', name: 'Khach 1', phone: null },
  seller: { id: 'seller-1', name: 'Admin' },
  subtotal_amount: 100000,
  discount_amount: 0,
  total_amount: 100000,
  paid_amount: 30000,
  debt_amount: 70000,
  payment_status: 'partial',
  note: null,
  price_list: null,
  change_returned_amount: 0,
  items: [],
  payment_receipts: [],
  debt_entries: [],
  stock_movements: [],
  history: [],
} satisfies SalesDocumentDetail

describe('sales document presenter', () => {
  it('maps invoice and quote statuses for UI only', () => {
    expect(salesDocumentPaymentSettlementStatus(invoice)).toBe('partial')
    expect(salesDocumentStatusLabel(invoice)).toBe('Thanh toán 1 phần')
    expect(salesDocumentStatusTone(invoice)).toBe('warning')

    expect(salesDocumentStatusLabel({ ...invoice, order_type: 'quote', status: 'active', payment_status: 'not_applicable' })).toBe('Đang hiệu lực')
    expect(salesDocumentStatusLabel({ ...invoice, status: 'cancelled' })).toBe('Đã hủy')
  })

  it('maps filter labels and payment receipt labels', () => {
    expect(documentTypeFilterLabel('invoice')).toBe('Hóa đơn')
    expect(lifecycleFilterLabel('completed')).toBe('Hoàn tất')
    expect(paymentStatusFilterLabel('unpaid')).toBe('Chưa thanh toán')
    expect(paymentMethodFilterLabel('bank_transfer')).toBe('Chuyển khoản')
    expect(paymentReceiptStatusLabel('posted')).toBe('Đã thanh toán')
  })

  it('reads receipt methods without changing business data', () => {
    const receipt = {
      id: 'receipt-1',
      code: 'PT0001',
      status: 'posted',
      receipt_type: 'sale_payment',
      total_received_amount: 120000,
      created_at: '2026-07-09T03:00:00Z',
      created_by: { id: 'user-1', name: 'Admin' },
      methods: [
        { method_type: 'cash', amount: 50000, finance_account: { id: 'cash', code: 'TM', name: 'Tiền mặt' } },
        { method_type: 'bank_transfer', amount: 70000, finance_account: { id: 'bank', code: 'VCB', name: 'VCB' } },
      ],
      allocations: [],
    } satisfies SalesDocumentDetail['payment_receipts'][number]

    expect(paymentReceiptMethodLabel(receipt)).toBe('Tiền mặt, Chuyển khoản')
    expect(paymentReceiptMethodTotal(receipt)).toBe(120000)
    expect(paymentReceiptMethodTotal({ ...receipt, methods: [] })).toBe(120000)
  })

  it('summarizes list totals and line sell price outside the page', () => {
    expect(salesDocumentListSummary([
      { total_amount: 100000, debt_amount: 25000 },
      { total_amount: 200000, debt_amount: 0 },
    ])).toEqual({ totalAmount: 300000, debtAmount: 25000 })
    expect(salesDocumentLineSellPrice({ quantity: 2, line_total: 120000 })).toBe(60000)
    expect(salesDocumentLineSellPrice({ quantity: 0, line_total: 120000 })).toBe(120000)
  })

  it('formats sales document date text outside the page', () => {
    expect(salesDocumentDateTimeText(null)).toBe('-')
    expect(salesDocumentDateTimeText('bad-date', '2026-07-09T03:00:00Z')).not.toBe('-')
  })

  it('formats POS-created invoices in local time but keeps KiotViet source clock unchanged', () => {
    expect(salesDocumentCreatedDateTimeText({
      code: 'HD-POS-021-37F1D9E6',
      created_at: '2026-07-12T17:20:00.000Z',
    })).toBe('13/07/2026 00:20')
    expect(salesDocumentCreatedDateTimeText({
      code: 'HD011143',
      created_at: '2026-07-12T17:20:00.000Z',
    })).toBe('12/07/2026 17:20')
  })

  it('formats quote print values outside the print page', () => {
    expect(salesDocumentMoneyText(1200000)).toBe('1 200 000')
    expect(salesDocumentMeasureText(1.25)).toBe('1.25')
    expect(salesDocumentQuoteLineDimensionText({
      width_m: 1.2,
      height_m: 0.5,
      linear_m: null,
      product: { id: 'product-1', code: 'SP001', name: 'San pham', sell_method: 'area_m2', unit_name: 'm2' },
    })).toBe('1.2 x 0.5 m')
    expect(salesDocumentQuoteLineDimensionText({
      width_m: null,
      height_m: null,
      linear_m: 3,
      product: { id: 'product-2', code: 'SP002', name: 'San pham 2', sell_method: 'linear_m', unit_name: 'm' },
    })).toBe('3 m tá»›i')
  })
})
