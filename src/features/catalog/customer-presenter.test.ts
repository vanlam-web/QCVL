import { describe, expect, it } from 'vitest'
import { customerDateTime, customerSalesDocumentStatusText, customerVisibleSummary } from './customer-presenter'
import type { SalesDocumentListItem } from '../sales-documents/sales-document-service'

const document = {
  id: 'order-1',
  code: 'HD0001',
  order_type: 'invoice',
  status: 'completed',
  created_at: '2026-07-09T03:00:00Z',
  customer: { id: 'customer-1', code: 'KH001', name: 'Khach', phone: null },
  seller: { id: 'seller-1', name: 'Admin' },
  subtotal_amount: 100000,
  discount_amount: 0,
  total_amount: 100000,
  paid_amount: 0,
  debt_amount: 100000,
  payment_status: 'unpaid',
  note: null,
} satisfies SalesDocumentListItem

describe('customer presenter', () => {
  it('maps customer history document status', () => {
    expect(customerSalesDocumentStatusText(document)).toBe('Nợ')
    expect(customerSalesDocumentStatusText({ ...document, paid_amount: 50000, debt_amount: 50000, payment_status: 'partial' })).toBe('Nợ 1 phần')
    expect(customerSalesDocumentStatusText({ ...document, paid_amount: 100000, debt_amount: 0, payment_status: 'paid' })).toBe('Hoàn tất')
    expect(customerSalesDocumentStatusText({ ...document, order_type: 'quote', status: 'active', payment_status: 'not_applicable' })).toBe('Đang hiệu lực')
  })

  it('formats empty dates safely', () => {
    expect(customerDateTime(null)).toBe('Chưa có dữ liệu')
    expect(customerDateTime('bad')).toBe('Chưa có dữ liệu')
  })
  it('summarizes visible customers outside the page', () => {
    expect(customerVisibleSummary([
      { total_debt_amount: 100000, total_sales_amount: 500000 },
      { total_debt_amount: undefined, total_sales_amount: 200000 },
    ])).toEqual({ visibleDebtTotal: 100000, visibleSalesTotal: 700000 })
  })
})
